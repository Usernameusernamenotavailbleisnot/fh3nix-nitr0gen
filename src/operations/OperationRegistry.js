// src/operations/OperationRegistry.js
const ConfigManager = require('../managers/ConfigManager');
const logger = require('../utils/logger');

/**
 * Registry for all blockchain operations
 * Manages initialization and execution order
 */
class OperationRegistry {
    /**
     * Create a new OperationRegistry
     * 
     * @param {string} privateKey - Wallet private key
     * @param {Object} config - Configuration object
     * @param {number|null} walletNum - Wallet identifier for logging
     */
    constructor(privateKey, config = {}, walletNum = null) {
        this.privateKey = privateKey;
        this.config = config;
        this.walletNum = walletNum;
        this.configManager = new ConfigManager(config, {}, walletNum);
        this.logger = walletNum !== null ? logger.getInstance(walletNum) : logger.getInstance();
        
        // Dynamically load all operation classes
        this._loadOperations();
    }
    
    /**
     * Load all operation classes
     * This helps avoid circular dependencies
     * @private
     */
    _loadOperations() {
        // Import all operation classes
        const TokenTransfer = require('./transfer');
        const NormalContract = require('./normalcontract');
        const ERC20Token = require('./erc20');
        const NFT = require('./nft');
        const TestContract = require('./testcontract');
        const BatchOperation = require('./batchoperation');
        const Bridge = require('./bridge');
        
        // Initialize all operation instances
        this.operations = [
            { name: "bridge", instance: new Bridge(this.privateKey, this.config) },
            { name: "transfer", instance: new TokenTransfer(this.privateKey, this.config) },
            { name: "contract_deploy", instance: new NormalContract(this.privateKey, this.config) },
            { name: "contract_testing", instance: new TestContract(this.privateKey, this.config) },
            { name: "erc20", instance: new ERC20Token(this.privateKey, this.config) },
            { name: "nft", instance: new NFT(this.privateKey, this.config) },
            { name: "batch_operations", instance: new BatchOperation(this.privateKey, this.config) }
        ];
        
        // Set wallet number for all operations
        if (this.walletNum !== null) {
            this.operations.forEach(op => op.instance.setWalletNum(this.walletNum));
        }
    }
    
    /**
     * Update the wallet number for all operations
     * 
     * @param {number} num - Wallet number
     */
    setWalletNum(num) {
        this.walletNum = num;
        this.configManager.setWalletNum(num);
        this.logger = logger.getInstance(num);
        this.operations.forEach(op => op.instance.setWalletNum(num));
    }
    
    /**
     * Get a specific operation by name
     * 
     * @param {string} name - Operation name
     * @returns {Object|null} Operation instance or null if not found
     */
    getOperation(name) {
        const operation = this.operations.find(op => op.name === name);
        return operation ? operation.instance : null;
    }
    
    /**
     * Add a new operation to the registry
     * 
     * @param {string} name - Operation name
     * @param {Object} instance - Operation instance
     */
    addOperation(name, instance) {
        // Set wallet number on the new instance
        if (this.walletNum !== null) {
            instance.setWalletNum(this.walletNum);
        }
        
        // Add to operations list
        this.operations.push({ name, instance });
    }
    
    /**
     * Get operations in randomized order based on configuration
     * 
     * @returns {Array} Operations in execution order
     */
    getRandomizedOperations() {
        // Get randomization configuration
        const randomizationConfig = this.configManager.get('randomization', { 
            enable: false, 
            excluded_operations: [],
            operations_to_run: this.operations.map(op => op.name)
        });
        
        // Filter operations based on operations_to_run config
        const operationsToRun = randomizationConfig.operations_to_run || 
            this.operations.map(op => op.name);
        
        const filteredOperations = this.operations.filter(op => 
            operationsToRun.includes(op.name) && op.instance.isEnabled());
        
        // Split operations into fixed and randomizable based on excluded_operations
        const excludedOps = randomizationConfig.excluded_operations || [];
        const fixedOps = filteredOperations.filter(op => excludedOps.includes(op.name));
        const randomizableOps = filteredOperations.filter(op => !excludedOps.includes(op.name));
        
        // Randomize operations if enabled
        if (randomizationConfig.enable && randomizableOps.length > 1) {
            this._shuffleArray(randomizableOps);
        }
        
        // Return operations in order: fixed operations first, then randomized operations
        return [...fixedOps, ...randomizableOps];
    }
    
    /**
     * Shuffle array using Fisher-Yates algorithm
     * 
     * @param {Array} array - Array to shuffle
     * @private
     */
    _shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
    
    /**
     * Execute all operations in optimized order
     * 
     * @returns {Promise<boolean>} Success status
     */
    async executeAll() {
        const operations = this.getRandomizedOperations();
        
        // Log the operation sequence
        this.logger.info(`Operations sequence: ${operations.map(op => op.name).join(' -> ')}`);
        
        let success = true;
        // Execute operations in the determined order
        for (const operation of operations) {
            try {
                logger.setWalletNum(this.walletNum);
                const result = await operation.instance.execute();
                if (!result) success = false;
            } catch (error) {
                this.logger.error(`Error in ${operation.name} operation: ${error.message}`);
                success = false;
            }
        }
        
        return success;
    }
}

module.exports = OperationRegistry;