const solc = require('solc');
const Logger = require('../utils/logger');
const { addRandomDelay } = require('../utils/delay');

class ContractManager {
    constructor(blockchainManager, config = {}) {
        this.blockchain = blockchainManager;
        this.config = config;
        this.logger = new Logger(blockchainManager.walletNum);
    }
    
    // Get delay configuration
    getDelayConfig() {
        return (this.config.general && this.config.general.delay) 
            ? this.config.general.delay 
            : (this.config.delay) 
                ? this.config.delay 
                : { min_seconds: 5, max_seconds: 30 };
    }
    
    // Compile a Solidity contract
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
    
    // Deploy a compiled contract
    async deployContract(compiledContract, constructorArgs = [], methodName = "contract") {
        try {
            this.logger.info(`Deploying ${methodName} contract...`);
            
            // Add random delay before deployment
            await addRandomDelay(this.getDelayConfig(), this.blockchain.walletNum, `${methodName} contract deployment`);
            
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
            
            this.logger.success(`${methodName} contract deployed at: ${result.receipt.contractAddress}`);
            
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
    
    // Interact with a deployed contract
    async callContractMethod(contractAddress, abi, methodName, methodArgs = [], value = '0') {
        try {
            // Add random delay before interaction
            await addRandomDelay(this.getDelayConfig(), this.blockchain.walletNum, `contract method: ${methodName}`);
            
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
            // Simplified method name (without full args) to reduce log verbosity
            const simplifiedMethodName = methodName;
            const result = await this.blockchain.sendTransaction(txObject, simplifiedMethodName);
            
            return result;
        } catch (error) {
            this.logger.error(`Error calling ${methodName}: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    // Call a read-only (view) method on a contract (doesn't require a transaction)
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