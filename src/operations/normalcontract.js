// src/operations/normalcontract.js
const constants = require('../utils/constants');
const { addRandomDelay } = require('../utils/delay');
const BlockchainManager = require('../managers/BlockchainManager');
const ContractManager = require('../managers/ContractManager');
const ConfigManager = require('../managers/ConfigManager');
const logger = require('../utils/logger');

class ContractDeployer {
    constructor(privateKey, config = {}) {
        // Default configuration
        this.defaultConfig = {
            enable_contract_deploy: true,
            contract_interactions: {
                enabled: true,
                count: {
                    min: 3,
                    max: 8
                },
                types: ["setValue", "increment", "decrement", "reset", "contribute"]
            }
        };
        
        // Initialize blockchain manager
        this.blockchain = new BlockchainManager(privateKey, config);
        this.walletNum = this.blockchain.walletNum;
        
        // Initialize other managers with shared logger
        this.configManager = new ConfigManager(config, { contract_deploy: this.defaultConfig }, this.walletNum);
        this.contractManager = new ContractManager(this.blockchain, config);
        
        // Use shared logger instance
        this.logger = this.walletNum !== null ? logger.getInstance(this.walletNum) : logger.getInstance();
    }
    
    setWalletNum(num) {
        this.walletNum = num;
        this.blockchain.setWalletNum(num);
        this.configManager.setWalletNum(num);
        this.logger = logger.getInstance(num);
    }
    
    async executeContractOperations() {
        if (!this.configManager.isEnabled('contract_deploy')) {
            this.logger.warn(`Contract deployment disabled in config`);
            return true;
        }
        
        this.logger.header(`Starting contract operations...`);
        
        try {
            // Reset blockchain manager nonce
            this.blockchain.resetNonce();
            
            // Step 1: Compile the contract
            this.logger.info(`Compiling smart contract...`);
            const compiledContract = await this.contractManager.compileContract(
                'InteractiveContract', 
                constants.CONTRACT.SAMPLE_CONTRACT_SOURCE,
                'Contract.sol'
            );
            
            // Add random delay before contract deployment
            await addRandomDelay(this.configManager.getDelayConfig(), this.walletNum, "contract deployment");
            
            // Step 2: Deploy the contract
            this.logger.info(`Deploying smart contract...`);
            const deployedContract = await this.contractManager.deployContract(
                compiledContract, 
                [], 
                "InteractiveContract"
            );
            
            this.logger.success(`Contract deployed at: ${deployedContract.contractAddress}`);
            
            // Skip interactions if disabled in config
            if (!this.configManager.get('operations.contract_deploy.contract_interactions.enabled', 
                 this.configManager.get('contract_deploy.contract_interactions.enabled', true))) {
                this.logger.warn(`Contract interactions disabled in config`);
                return true;
            }
            
            // Step 3: Interact with the contract multiple times
            // Get interaction count from config
            let interactionCount = this.configManager.getRandomInRange(
                'contract_deploy', 
                'contract_interactions.count', 
                3, 
                8
            );
            
            const interactionTypes = this.configManager.get(
                'operations.contract_deploy.contract_interactions.types', 
                this.configManager.get(
                    'contract_deploy.contract_interactions.types', 
                    ["setValue", "increment", "decrement", "reset", "contribute"]
                )
            );
            
            this.logger.info(`Will perform ${interactionCount} interactions with contract...`);
            
            let successCount = 0;
            for (let i = 0; i < interactionCount; i++) {
                // Select a random interaction type from the available types
                const interactionType = interactionTypes[Math.floor(Math.random() * interactionTypes.length)];
                
                this.logger.info(`Interaction ${i+1}/${interactionCount}: ${interactionType}...`);
                
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
                
                await addRandomDelay(this.configManager.getDelayConfig(), this.walletNum, `contract interaction (${interactionType})`);
                
                const result = await this.contractManager.callContractMethod(
                    deployedContract.contractAddress,
                    deployedContract.abi,
                    interactionType,
                    methodArgs,
                    value
                );
                
                if (result.success) {
                    this.logger.success(`${interactionType} successful`);
                    successCount++;
                } else {
                    this.logger.error(`${interactionType} failed: ${result.error}`);
                }
            }
            
            this.logger.success(`Contract operations completed: ${successCount}/${interactionCount} successful interactions`);
            return true;
            
        } catch (error) {
            this.logger.error(`Error in contract operations: ${error.message}`);
            return false;
        }
    }
}

module.exports = ContractDeployer;