// src/operations/BaseOperation.js
const BlockchainManager = require('../managers/BlockchainManager');
const ConfigManager = require('../managers/ConfigManager');
const logger = require('../utils/logger');
const { addRandomDelay } = require('../utils/delay');

/**
 * Base class for all blockchain operations
 * Handles common initialization, configuration, and execution patterns
 */
class BaseOperation {
    /**
     * Create a new operation instance
     * 
     * @param {string} privateKey - Wallet private key
     * @param {Object} config - Configuration object
     * @param {string} operationName - Name of the operation (used for config access)
     */
    constructor(privateKey, config = {}, operationName) {
        this.operationName = operationName;
        this.defaultConfig = {};
        
        // Initialize blockchain manager
        this.blockchain = privateKey ? new BlockchainManager(privateKey, config) : null;
        this.walletNum = this.blockchain ? this.blockchain.walletNum : null;
        
        // Initialize config manager with operation-specific defaults
        this.configManager = new ConfigManager(config, { [operationName]: this.defaultConfig }, this.walletNum);
        
        // Use shared logger instance
        this.logger = this.walletNum !== null ? logger.getInstance(this.walletNum) : logger.getInstance();
    }
    
    /**
     * Update the wallet number for this operation
     * 
     * @param {number} num - Wallet number
     */
    setWalletNum(num) {
        this.walletNum = num;
        if (this.blockchain) this.blockchain.setWalletNum(num);
        this.configManager.setWalletNum(num);
        this.logger = logger.getInstance(num);
    }
    
    /**
     * Check if this operation is enabled in configuration
     * 
     * @returns {boolean} True if operation is enabled
     */
    isEnabled() {
        return this.configManager.isEnabled(this.operationName);
    }
    
    /**
     * Get delay configuration for this operation
     * 
     * @returns {Object} Delay configuration
     */
    getDelayConfig() {
        return this.configManager.getDelayConfig();
    }
    
    /**
     * Add a random delay with logging
     * 
     * @param {string} message - Message to display during delay
     * @returns {Promise<boolean>} Success status
     */
    async addDelay(message) {
        return await addRandomDelay(this.getDelayConfig(), this.walletNum, message);
    }
    
    /**
     * Execute this operation with standardized logging and error handling
     * Template method pattern - subclasses implement executeOperations()
     * 
     * @returns {Promise<boolean>} Success status
     */
    async execute() {
        if (!this.isEnabled()) {
            this.logger.warn(`${this.operationName} operations disabled in config`);
            return true; // Return success to not interrupt the flow
        }
        
        this.logger.header(`Starting ${this.operationName} operations...`);
        
        try {
            // Reset blockchain manager nonce if available
            if (this.blockchain) this.blockchain.resetNonce();
            
            // Execute implementation-specific operations
            const result = await this.executeOperations();
            
            if (result) {
                this.logger.success(`${this.operationName} operations completed successfully!`);
            }
            
            return result;
        } catch (error) {
            this.logger.error(`Error in ${this.operationName} operations: ${error.message}`);
            return false;
        }
    }
    
    /**
     * Execute operation-specific logic
     * To be implemented by subclasses
     * 
     * @returns {Promise<boolean>} Success status
     */
    async executeOperations() {
        throw new Error('executeOperations must be implemented by subclass');
    }
}

module.exports = BaseOperation;