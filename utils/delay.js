const chalk = require('chalk');
const constants = require('./constants');

/**
 * Get a timestamp string for logging
 * @param {number|null} walletNum - Wallet number for contextual logging
 * @returns {string} - Formatted timestamp
 */
function getTimestamp(walletNum = null) {
    const now = new Date();
    const timestamp = now.toLocaleTimeString('en-US', { hour12: false });
    if (walletNum !== null) {
        return `[${timestamp} - Wallet ${walletNum}]`;
    }
    return `[${timestamp}]`;
}

/**
 * Adds a random delay between transactions based on config settings
 * @param {Object} config - The configuration object
 * @param {number} walletNum - The wallet number for logging
 * @param {string} operationName - The name of the operation (for logging)
 * @returns {Promise<void>}
 */
async function addRandomDelay(config, walletNum, operationName = 'next transaction') {
    try {
        // Extract delay settings from various possible config formats
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
            minDelay = constants.DELAY.MIN_SECONDS;
            maxDelay = constants.DELAY.MAX_SECONDS;
        }
        
        // Generate random delay within the specified range
        const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
        
        console.log(chalk.yellow(`${getTimestamp(walletNum)} ⌛ Waiting ${delay} seconds before ${operationName}...`));
        await new Promise(resolve => setTimeout(resolve, delay * 1000));
        
        return true;
    } catch (error) {
        console.log(chalk.red(`${getTimestamp(walletNum)} ✗ Error in delay function: ${error.message}`));
        // Continue execution even if delay fails
        return false;
    }
}

module.exports = {
    addRandomDelay,
    getTimestamp
};