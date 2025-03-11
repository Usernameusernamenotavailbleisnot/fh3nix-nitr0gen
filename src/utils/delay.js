// src/utils/delay.js
const chalk = require('chalk');
const logger = require('./logger');

/**
 * Adds a random delay between operations based on config settings
 * 
 * @param {Object} config - Delay configuration object
 * @param {number} walletNum - Wallet number for logging
 * @param {string} operationName - Name of the operation (for logging)
 * @returns {Promise<boolean>} Success status
 */
async function addRandomDelay(config, walletNum, operationName = 'next transaction') {
    try {
        // Use shared logger
        const log = walletNum !== null ? logger.getInstance(walletNum) : logger.getInstance();
        
        // Extract delay settings from various possible config formats
        const delayConfig = extractDelayConfig(config);
        
        // Generate random delay within the specified range
        const delay = generateDelay(delayConfig.minDelay, delayConfig.maxDelay);
        
        log.custom(`⌛ Waiting ${delay} seconds before ${operationName}...`, chalk.yellow);
        await wait(delay * 1000);
        
        return true;
    } catch (error) {
        // Use shared logger
        const log = walletNum !== null ? logger.getInstance(walletNum) : logger.getInstance();
        log.error(`Error in delay function: ${error.message}`);
        // Continue execution even if delay fails
        return false;
    }
}

/**
 * Extract delay configuration from various possible formats
 * 
 * @param {Object} config - Configuration object
 * @returns {Object} Normalized delay configuration
 */
function extractDelayConfig(config) {
    let minDelay, maxDelay;
    
    if (config.min_seconds !== undefined && config.max_seconds !== undefined) {
        // Direct delay object passed
        minDelay = config.min_seconds;
        maxDelay = config.max_seconds;
    } else if (config.delay && config.delay.min_seconds !== undefined && config.delay.max_seconds !== undefined) {
        // Config with delay property 
        minDelay = config.delay.min_seconds;
        maxDelay = config.delay.max_seconds;
    } else if (config.general && config.general.delay) {
        // Config with general.delay property
        minDelay = config.general.delay.min_seconds;
        maxDelay = config.general.delay.max_seconds;
    } else {
        // Default fallback
        minDelay = 5;
        maxDelay = 30;
    }
    
    return { minDelay, maxDelay };
}

/**
 * Generate a random delay within a range
 * 
 * @param {number} min - Minimum delay in seconds
 * @param {number} max - Maximum delay in seconds
 * @returns {number} Random delay in seconds
 */
function generateDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Promise-based wait function
 * 
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Creates a delay with exponential backoff for retries
 * 
 * @param {number} baseDelay - Base delay in milliseconds
 * @param {number} retryCount - Retry attempt number
 * @param {number} maxDelay - Maximum delay in milliseconds
 * @returns {Promise<void>}
 */
async function exponentialBackoff(baseDelay = 1000, retryCount = 0, maxDelay = 60000) {
    const delay = Math.min(
        Math.floor(baseDelay * Math.pow(1.5, retryCount) + Math.random() * 1000),
        maxDelay
    );
    
    await wait(delay);
    return delay;
}

module.exports = {
    addRandomDelay,
    wait,
    exponentialBackoff
};