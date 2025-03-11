// src/utils/errorHandler.js
const logger = require('./logger');

/**
 * Wraps an async function with standardized error handling
 * 
 * @param {Function} fn - The async function to execute
 * @param {Object} options - Error handling options
 * @param {Object} options.logger - Logger instance
 * @param {number|null} options.walletNum - Wallet number for logging
 * @param {string} options.operationName - Name of the operation for error logging
 * @param {number} options.maxRetries - Maximum retry attempts
 * @param {number} options.retryDelay - Delay between retries in milliseconds
 * @param {Function} options.onError - Custom error handler function
 * @returns {Promise<any>} - Result of the function or error handler
 */
async function withErrorHandling(fn, options = {}) {
    const { 
        logger: loggerInstance = logger,
        walletNum = null, 
        operationName = 'operation', 
        maxRetries = 0,
        retryDelay = 1000,
        onError = null 
    } = options;
    
    let attempts = 0;
    
    while (true) {
        attempts++;
        try {
            return await fn();
        } catch (error) {
            const log = walletNum !== null ? loggerInstance.getInstance(walletNum) : loggerInstance.getInstance();
            log.error(`Error in ${operationName}: ${error.message}`);
            
            if (attempts <= maxRetries) {
                log.info(`Retrying ${operationName} (${attempts}/${maxRetries})...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempts)); // Exponential backoff
            } else {
                if (onError) return onError(error);
                return false;
            }
        }
    }
}

/**
 * Creates a wrapper function that applies error handling to the provided methods
 * 
 * @param {Object} instance - The class instance
 * @param {string[]} methodNames - Array of method names to wrap
 * @param {Object} options - Error handling options
 * @returns {Object} - The original instance with wrapped methods
 */
function wrapMethodsWithErrorHandling(instance, methodNames, options = {}) {
    const defaults = {
        logger,
        walletNum: instance.walletNum,
        maxRetries: 0,
        retryDelay: 1000
    };
    
    methodNames.forEach(methodName => {
        const originalMethod = instance[methodName];
        if (typeof originalMethod !== 'function') return;
        
        instance[methodName] = async function(...args) {
            const methodOptions = {
                ...defaults,
                ...options,
                operationName: methodName
            };
            
            return withErrorHandling(
                () => originalMethod.apply(instance, args),
                methodOptions
            );
        };
    });
    
    return instance;
}

module.exports = { 
    withErrorHandling,
    wrapMethodsWithErrorHandling
};