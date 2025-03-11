// src/operations/normalcontract.js
const constants = require('../utils/constants');
const BaseOperation = require('./BaseOperation');
const ContractManager = require('../managers/ContractManager');

/**
 * Manages contract deployment and interaction operations
 * @extends BaseOperation
 */
class NormalContract extends BaseOperation {
    /**
     * Create a new NormalContract instance
     * 
     * @param {string} privateKey - Wallet private key
     * @param {Object} config - Configuration object
     */
    constructor(privateKey, config = {}) {
        // Define default config
        const defaultConfig = {
            enabled: true,
            interactions: {
                enabled: true,
                count: {
                    min: 3,
                    max: 8
                },
                types: ["setValue", "increment", "decrement", "reset", "contribute"]
            }
        };
        
        // Initialize base class
        super(privateKey, config, 'contract_deploy');
        
        // Override default config
        this.defaultConfig = defaultConfig;
        
        // Initialize contract manager
        this.contractManager = new ContractManager(this.blockchain, config);
    }
    
    /**
     * Implement the executeOperations method from BaseOperation
     * 
     * @returns {Promise<boolean>} Success status
     */
    async executeOperations() {
        try {
            // Step 1: Compile the contract
            this.logger.info(`Compiling smart contract...`);
            const compiledContract = await this.contractManager.compileContract(
                'InteractiveContract', 
                constants.CONTRACT.SAMPLE_CONTRACT_SOURCE,
                'Contract.sol'
            );
            
            // Add random delay before contract deployment
            await this.addDelay("contract deployment");
            
            // Step 2: Deploy the contract
            this.logger.info(`Deploying smart contract...`);
            const deployedContract = await this.contractManager.deployContract(
                compiledContract, 
                [], 
                "InteractiveContract"
            );
            
            this.logger.success(`Contract deployed at: ${deployedContract.contractAddress}`);
            
            // Skip interactions if disabled in config
            if (!this.configManager.getBoolean('operations.contract_deploy.interactions.enabled', 
                 this.configManager.getBoolean('contract_deploy.interactions.enabled', true))) {
                this.logger.warn(`Contract interactions disabled in config`);
                return true;
            }
            
            // Step 3: Interact with the contract multiple times
            // Get interaction count from config
            let interactionCount = this.configManager.getRandomInRange(
                'contract_deploy', 
                'interactions.count', 
                3, 
                8
            );
            
            const interactionTypes = this.configManager.getArray(
                'operations.contract_deploy.interactions.types', 
                this.configManager.getArray(
                    'contract_deploy.interactions.types', 
                    ["setValue", "increment", "decrement", "reset", "contribute"]
                )
            );
            
            this.logger.info(`Will perform ${interactionCount} interactions with contract...`);
            
            let successCount = 0;
            for (let i = 0; i < interactionCount; i++) {
                await this.performRandomInteraction(
                    deployedContract, 
                    interactionTypes, 
                    i + 1, 
                    interactionCount
                );
            }
            
            this.logger.success(`Contract operations completed: ${successCount}/${interactionCount} successful interactions`);
            return true;
            
        } catch (error) {
            this.logger.error(`Error in contract operations: ${error.message}`);
            return false;
        }
    }
    
    /**
     * Perform a random interaction with the contract
     * 
     * @param {Object} deployedContract - Deployed contract info
     * @param {Array} interactionTypes - Available interaction types
     * @param {number} currentNum - Current interaction number
     * @param {number} totalNum - Total interactions
     * @returns {Promise<boolean>} Success status
     */
    async performRandomInteraction(deployedContract, interactionTypes, currentNum, totalNum) {
        try {
            // Select a random interaction type from the available types
            const interactionType = interactionTypes[Math.floor(Math.random() * interactionTypes.length)];
            
            this.logger.info(`Interaction ${currentNum}/${totalNum}: ${interactionType}...`);
            
            let methodArgs = [];
            let value = '0';
            
            switch (interactionType) {
                case 'setValue':
                    methodArgs = [Math.floor(Math.random() * 1000)]; // Random value 0-999
                    break;
                case 'contribute':
                    value = this.blockchain.web3.utils.toWei('0.00001', 'ether'); // Small contribution
                    break;
            }
            
            await this.addDelay(`contract interaction (${interactionType})`);
            
            const result = await this.contractManager.callContractMethod(
                deployedContract.contractAddress,
                deployedContract.abi,
                interactionType,
                methodArgs,
                value
            );
            
            if (result.success) {
                this.logger.success(`${interactionType} successful`);
                return true;
            } else {
                this.logger.error(`${interactionType} failed: ${result.error}`);
                return false;
            }
        } catch (error) {
            this.logger.error(`Error in interaction: ${error.message}`);
            return false;
        }
    }
}

module.exports = NormalContract;