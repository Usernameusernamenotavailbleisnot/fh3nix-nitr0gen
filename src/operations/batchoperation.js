// src/operations/batchoperation.js
const constants = require('../utils/constants');
const BaseOperation = require('./BaseOperation');
const ContractManager = require('../managers/ContractManager');

/**
 * Manages batch operation execution
 * @extends BaseOperation
 */
class BatchOperation extends BaseOperation {
    /**
     * Create a new BatchOperation instance
     * 
     * @param {string} privateKey - Wallet private key
     * @param {Object} config - Configuration object
     */
    constructor(privateKey, config = {}) {
        // Define default config
        const defaultConfig = {
            enabled: true,
            operations_per_batch: {
                min: 2,
                max: 5
            }
        };
        
        // Initialize base class
        super(privateKey, config, 'batch_operations');
        
        // Override default config
        this.defaultConfig = defaultConfig;
        
        // Initialize contract manager
        this.contractManager = new ContractManager(this.blockchain, config);
    }
    
    /**
     * Get batch processor contract source
     * 
     * @returns {string} Contract source code
     */
    getBatchProcessorSource() {
        return `
        // SPDX-License-Identifier: MIT
        pragma solidity >=0.8.0 <0.9.0;
        
        contract BatchProcessor {
            address public owner;
            uint256 public operationCount;
            uint256 public lastValue;
            mapping(uint256 => string) public operations;
            
            event OperationExecuted(uint256 indexed opId, string operationType);
            event BatchProcessed(uint256 operationCount);
            
            constructor() {
                owner = msg.sender;
                operationCount = 0;
                lastValue = 0;
            }
            
            function setValue(uint256 _value) public {
                lastValue = _value;
                operations[operationCount] = "setValue";
                operationCount++;
                emit OperationExecuted(operationCount - 1, "setValue");
            }
            
            function incrementValue() public {
                lastValue++;
                operations[operationCount] = "incrementValue";
                operationCount++;
                emit OperationExecuted(operationCount - 1, "incrementValue");
            }
            
            function decrementValue() public {
                if (lastValue > 0) {
                    lastValue--;
                }
                operations[operationCount] = "decrementValue";
                operationCount++;
                emit OperationExecuted(operationCount - 1, "decrementValue");
            }
            
            function squareValue() public {
                lastValue = lastValue * lastValue;
                operations[operationCount] = "squareValue";
                operationCount++;
                emit OperationExecuted(operationCount - 1, "squareValue");
            }
            
            function resetValue() public {
                lastValue = 0;
                operations[operationCount] = "resetValue";
                operationCount++;
                emit OperationExecuted(operationCount - 1, "resetValue");
            }
            
            function multiplyValue(uint256 _multiplier) public {
                lastValue = lastValue * _multiplier;
                operations[operationCount] = "multiplyValue";
                operationCount++;
                emit OperationExecuted(operationCount - 1, "multiplyValue");
            }
            
            function executeBatch(string[] memory batchOperations, uint256[] memory parameters) public {
                require(batchOperations.length > 0, "Empty batch");
                require(batchOperations.length == parameters.length, "Operations and parameters length mismatch");
                
                uint256 initialOpCount = operationCount;
                
                for (uint256 i = 0; i < batchOperations.length; i++) {
                    bytes32 opHash = keccak256(abi.encodePacked(batchOperations[i]));
                    
                    if (opHash == keccak256(abi.encodePacked("setValue"))) {
                        setValue(parameters[i]);
                    } else if (opHash == keccak256(abi.encodePacked("incrementValue"))) {
                        incrementValue();
                    } else if (opHash == keccak256(abi.encodePacked("decrementValue"))) {
                        decrementValue();
                    } else if (opHash == keccak256(abi.encodePacked("squareValue"))) {
                        squareValue();
                    } else if (opHash == keccak256(abi.encodePacked("resetValue"))) {
                        resetValue();
                    } else if (opHash == keccak256(abi.encodePacked("multiplyValue"))) {
                        multiplyValue(parameters[i]);
                    } else {
                        revert("Unknown operation");
                    }
                }
                
                emit BatchProcessed(operationCount - initialOpCount);
            }
            
            function getStatus() public view returns (uint256, uint256) {
                return (operationCount, lastValue);
            }
        }
        `;
    }
    
    /**
     * Generate random batch operations
     * 
     * @returns {Object} Batch operations and parameters
     */
    generateBatchOperations() {
        // Available operations
        const operations = [
            "setValue",
            "incrementValue",
            "decrementValue",
            "squareValue",
            "resetValue",
            "multiplyValue"
        ];
        
        // Determine number of operations in batch
        const numOperations = this.configManager.getRandomInRange('batch_operations', 'operations_per_batch', 2, 5);
        
        this.logger.info(`Generating batch with ${numOperations} operations...`);
        
        // Generate random operations and parameters
        const batchOperations = [];
        const parameters = [];
        
        for (let i = 0; i < numOperations; i++) {
            // Select random operation
            const operation = operations[Math.floor(Math.random() * operations.length)];
            batchOperations.push(operation);
            
            // Generate appropriate parameter based on operation
            let parameter = 0;
            if (operation === "setValue") {
                parameter = Math.floor(Math.random() * 100) + 1; // Random value from 1 to 100
            } else if (operation === "multiplyValue") {
                parameter = Math.floor(Math.random() * 5) + 2; // Random multiplier from 2 to 6
            } else {
                parameter = 0; // Other operations don't use parameters
            }
            parameters.push(parameter);
        }
        
        return { batchOperations, parameters };
    }
    
    /**
     * Implement the executeOperations method from BaseOperation
     * 
     * @returns {Promise<boolean>} Success status
     */
    async executeOperations() {
        try {
            // Step 1: Compile and deploy batch processor contract
            this.logger.info(`Step 1: Compiling batch processor contract...`);
            const compiledContract = await this.contractManager.compileContract(
                'BatchProcessor', 
                this.getBatchProcessorSource(), 
                'BatchProcessor.sol'
            );
            
            // Step 2: Deploy batch processor contract
            this.logger.info(`Step 2: Deploying batch processor contract...`);
            const deployedContract = await this.contractManager.deployContract(
                compiledContract, 
                [], 
                "batch processor"
            );
            
            // Step 3: Test individual operations for verification
            this.logger.info(`Step 3: Testing individual operations...`);
            await this.testIndividualOperations(deployedContract.contractAddress, deployedContract.abi);
            
            // Step 4: Execute multiple batches
            this.logger.info(`Step 4: Executing multiple batches...`);
            const batchResults = await this.executeMultipleBatches(deployedContract.contractAddress, deployedContract.abi);
            
            this.logger.success(`Batch operation operations completed successfully!`);
            this.logger.success(`Batch processor: ${deployedContract.contractAddress}`);
            this.logger.success(`View contract: ${constants.NETWORK.EXPLORER_URL}/address/${deployedContract.contractAddress}`);
            
            return true;
        } catch (error) {
            this.logger.error(`Error in batch operation operations: ${error.message}`);
            return false;
        }
    }
    
    /**
     * Test individual operations for verification
     * 
     * @param {string} contractAddress - Contract address
     * @param {Array} abi - Contract ABI
     * @returns {Promise<Object>} Test results
     */
    async testIndividualOperations(contractAddress, abi) {
        try {
            this.logger.info(`Testing individual operations...`);
            
            // Test setValue operation
            const testValue = Math.floor(Math.random() * 100) + 1;
            
            // Add random delay before operation
            await this.addDelay("individual operation test");
            
            // Call setValue function through contract manager
            const result = await this.contractManager.callContractMethod(
                contractAddress,
                abi,
                'setValue',
                [testValue]
            );
            
            if (result.success) {
                this.logger.success(`setValue operation successful`);
                
                // Verify the status after setting value
                const statusResult = await this.contractManager.callViewMethod(
                    contractAddress,
                    abi,
                    'getStatus',
                    []
                );
                
                if (statusResult.success) {
                    this.logger.info(`Current status - Operation count: ${statusResult.result[0]}, Last value: ${statusResult.result[1]}`);
                }
                
                return {
                    txHash: result.txHash,
                    operationCount: statusResult.success ? statusResult.result[0] : '?',
                    lastValue: statusResult.success ? statusResult.result[1] : '?',
                    success: true
                };
            } else {
                this.logger.error(`Error testing individual operations: ${result.error}`);
                return {
                    success: false,
                    error: result.error
                };
            }
        } catch (error) {
            this.logger.error(`Error testing individual operations: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Execute batch operations
     * 
     * @param {string} contractAddress - Contract address
     * @param {Array} abi - Contract ABI
     * @returns {Promise<Object>} Batch execution results
     */
    async executeBatchOperations(contractAddress, abi) {
        try {
            // Generate random batch operations
            const { batchOperations, parameters } = this.generateBatchOperations();
            
            this.logger.info(`Executing batch operations: ${batchOperations.join(', ')}...`);
            
            // Add random delay before batch execution
            await this.addDelay("batch execution");
            
            // Call executeBatch function through contract manager
            const result = await this.contractManager.callContractMethod(
                contractAddress,
                abi,
                'executeBatch',
                [batchOperations, parameters]
            );
            
            if (result.success) {
                this.logger.success(`Batch execution successful`);
                
                // Verify the status after batch execution
                const statusResult = await this.contractManager.callViewMethod(
                    contractAddress,
                    abi,
                    'getStatus',
                    []
                );
                
                if (statusResult.success) {
                    this.logger.info(`Status after batch execution - Operation count: ${statusResult.result[0]}, Last value: ${statusResult.result[1]}`);
                }
                
                return {
                    txHash: result.txHash,
                    operations: batchOperations,
                    parameters: parameters,
                    operationCount: statusResult.success ? statusResult.result[0] : '?',
                    lastValue: statusResult.success ? statusResult.result[1] : '?',
                    success: true
                };
            } else {
                this.logger.error(`Error executing batch operations: ${result.error}`);
                return {
                    success: false,
                    error: result.error
                };
            }
        } catch (error) {
            this.logger.error(`Error executing batch operations: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Execute multiple batches
     * 
     * @param {string} contractAddress - Contract address
     * @param {Array} abi - Contract ABI
     * @returns {Promise<Array>} Array of batch results
     */
    async executeMultipleBatches(contractAddress, abi) {
        try {
            // Determine number of batches to execute
            const numBatches = Math.floor(Math.random() * 2) + 1; // 1 to 2 batches
            
            this.logger.info(`Will execute ${numBatches} batch operations...`);
            
            const results = [];
            
            for (let i = 0; i < numBatches; i++) {
                this.logger.info(`Executing batch ${i + 1}/${numBatches}...`);
                
                // Execute batch
                const result = await this.executeBatchOperations(contractAddress, abi);
                results.push(result);
                
                // Add random delay between batches if not the last one
                if (i < numBatches - 1) {
                    await this.addDelay(`next batch (${i + 2}/${numBatches})`);
                }
            }
            
            return results;
        } catch (error) {
            this.logger.error(`Error executing multiple batches: ${error.message}`);
            return [];
        }
    }
}

module.exports = BatchOperation;