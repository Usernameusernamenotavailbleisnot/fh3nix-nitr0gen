// src/managers/ContractManager.js
const solc = require('solc');
const logger = require('../utils/logger');
const constants = require('../utils/constants');
const { addRandomDelay } = require('../utils/delay');

/**
 * Manages contract compilation, deployment, and interaction
 */
class ContractManager {
    /**
     * Create a ContractManager instance
     * 
     * @param {Object} blockchainManager - BlockchainManager instance
     * @param {Object} config - Configuration object
     */
    constructor(blockchainManager, config = {}) {
        this.blockchain = blockchainManager;
        this.config = config;
        // Use the wallet number from blockchain manager
        this.walletNum = blockchainManager.walletNum;
        this.logger = this.walletNum !== null ? logger.getInstance(this.walletNum) : logger.getInstance();
    }
    
    /**
     * Get delay configuration
     * 
     * @returns {Object} Delay configuration
     */
    getDelayConfig() {
        return (this.config.general && this.config.general.delay) 
            ? this.config.general.delay 
            : (this.config.delay) 
                ? this.config.delay 
                : { min_seconds: 5, max_seconds: 30 };
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
     * Compile a Solidity contract
     * 
     * @param {string} contractName - Contract name
     * @param {string} contractSource - Solidity source code
     * @param {string|null} solFileName - Optional file name
     * @returns {Promise<Object>} Compiled contract
     */
    async compileContract(contractName, contractSource, solFileName = null) {
        try {
            this.logger.info(`Compiling ${contractName} contract...`);
            
            // Use provided file name or default based on contract name
            const fileName = solFileName || `${contractName}.sol`;
            
            // Setup compiler input with specific EVM version
            const input = {
                language: 'Solidity',
                sources: {
                    [fileName]: {
                        content: contractSource
                    }
                },
                settings: {
                    outputSelection: {
                        '*': {
                            '*': ['abi', 'evm.bytecode']
                        }
                    },
                    optimizer: {
                        enabled: true,
                        runs: 200
                    },
                    evmVersion: 'paris' // Use paris EVM version (before Shanghai which introduced PUSH0)
                }
            };
            
            // Compile the contract
            const output = JSON.parse(solc.compile(JSON.stringify(input)));
            
            // Check for errors
            if (output.errors) {
                const errors = output.errors.filter(error => error.severity === 'error');
                if (errors.length > 0) {
                    throw new Error(`Compilation errors: ${errors.map(e => e.message).join(', ')}`);
                }
            }
            
            // Extract the contract
            const contract = output.contracts[fileName][contractName];
            
            this.logger.success(`${contractName} contract compiled successfully!`);
            
            return {
                abi: contract.abi,
                bytecode: contract.evm.bytecode.object
            };
        } catch (error) {
            this.logger.error(`Failed to compile ${contractName} contract: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Deploy a compiled contract
     * 
     * @param {Object} compiledContract - Compiled contract object
     * @param {Array} constructorArgs - Constructor arguments
     * @param {string} methodName - Method name for logging
     * @returns {Promise<Object>} Deployed contract info
     */
    async deployContract(compiledContract, constructorArgs = [], methodName = "contract") {
        try {
            this.logger.info(`Deploying ${methodName} contract...`);
            
            // Add random delay before deployment
            await this.addDelay(`${methodName} contract deployment`);
            
            // Create contract instance for deployment
            const contract = new this.blockchain.web3.eth.Contract(compiledContract.abi);
            
            // Prepare deployment transaction
            const deployTx = contract.deploy({
                data: '0x' + compiledContract.bytecode,
                arguments: constructorArgs
            });
            
            // Create transaction object for deployment
            const txObject = {
                data: deployTx.encodeABI()
            };
            
            // Use the blockchain manager to send the transaction
            const result = await this.blockchain.sendTransaction(txObject, `${methodName} deployment`);
            
            if (!result.success) {
                throw new Error(result.error);
            }
            
            // Log only once with specific contract info
            this.logger.success(`${methodName} contract deployed at: ${result.receipt.contractAddress}`);
            this.logger.success(`View transaction: ${constants.NETWORK.EXPLORER_URL}/tx/${result.txHash}`);
            
            return {
                contractAddress: result.receipt.contractAddress,
                abi: compiledContract.abi,
                txHash: result.txHash
            };
        } catch (error) {
            this.logger.error(`Error deploying ${methodName} contract: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Interact with a deployed contract
     * 
     * @param {string} contractAddress - Contract address
     * @param {Array} abi - Contract ABI
     * @param {string} methodName - Method name to call
     * @param {Array} methodArgs - Method arguments
     * @param {string} value - ETH value to send
     * @returns {Promise<Object>} Transaction result
     */
    async callContractMethod(contractAddress, abi, methodName, methodArgs = [], value = '0') {
        try {
            // Add random delay before interaction
            await this.addDelay(`contract method: ${methodName}`);
            
            // Create contract instance
            const contract = new this.blockchain.web3.eth.Contract(abi, contractAddress);
            
            // Prepare the method call
            const method = contract.methods[methodName](...methodArgs);
            
            // Create transaction object
            const txObject = {
                to: contractAddress,
                data: method.encodeABI(),
                value
            };
            
            // Use the blockchain manager to send the transaction
            const simplifiedMethodName = methodName;
            const result = await this.blockchain.sendTransaction(txObject, simplifiedMethodName);
            
            // Only log the transaction URL here if successful
            if (result.success) {
                this.logger.success(`View transaction: ${constants.NETWORK.EXPLORER_URL}/tx/${result.txHash}`);
            }
            
            return result;
        } catch (error) {
            this.logger.error(`Error calling ${methodName}: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Call a read-only (view) method on a contract
     * 
     * @param {string} contractAddress - Contract address
     * @param {Array} abi - Contract ABI
     * @param {string} methodName - Method name to call
     * @param {Array} methodArgs - Method arguments
     * @returns {Promise<Object>} View method result
     */
    async callViewMethod(contractAddress, abi, methodName, methodArgs = []) {
        try {
            // Create contract instance
            const contract = new this.blockchain.web3.eth.Contract(abi, contractAddress);
            
            this.logger.info(`Calling view method: ${methodName}`);
            
            // Call the view method
            const result = await contract.methods[methodName](...methodArgs).call();
            
            return {
                success: true,
                result
            };
        } catch (error) {
            this.logger.error(`Error calling view method ${methodName}: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = ContractManager;