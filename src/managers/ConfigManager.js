// src/managers/ConfigManager.js
const _ = require('lodash');
const logger = require('../utils/logger');

/**
 * Manages configuration access with support for defaults and type safety
 */
class ConfigManager {
    /**
     * Create a new ConfigManager
     * 
     * @param {Object} config - The configuration object
     * @param {Object} defaultConfig - Default values
     * @param {number|null} walletNum - Wallet identifier for logging
     */
    constructor(config = {}, defaultConfig = {}, walletNum = null) {
        // Deep merge the configuration
        this.config = _.merge({}, defaultConfig, config);
        this.walletNum = walletNum;
        this.logger = walletNum !== null ? logger.getInstance(walletNum) : logger.getInstance();
    }
    
    /**
     * Update the wallet number for this instance
     * 
     * @param {number} num - Wallet number
     * @returns {ConfigManager} This instance for chaining
     */
    setWalletNum(num) {
        this.walletNum = num;
        this.logger = logger.getInstance(num);
        return this;
    }
    
    /**
     * Get a configuration value with dot notation support
     * 
     * @param {string} path - The path to the config value (e.g., "operations.erc20.enabled")
     * @param {any} defaultValue - Default value if path doesn't exist
     * @returns {any} - The config value or defaultValue
     */
    get(path, defaultValue = undefined) {
        return _.get(this.config, path, defaultValue);
    }
    
    /**
     * Get a config value as a number
     * 
     * @param {string} path - The path to the config value
     * @param {number} defaultValue - Default value if path doesn't exist
     * @returns {number} - The config value as a number
     */
    getNumber(path, defaultValue = 0) {
        const value = this.get(path, defaultValue);
        return Number(value);
    }
    
    /**
     * Get a config value as a boolean
     * 
     * @param {string} path - The path to the config value
     * @param {boolean} defaultValue - Default value if path doesn't exist
     * @returns {boolean} - The config value as a boolean
     */
    getBoolean(path, defaultValue = false) {
        const value = this.get(path, defaultValue);
        return Boolean(value);
    }
    
    /**
     * Get a config value as a string
     * 
     * @param {string} path - The path to the config value
     * @param {string} defaultValue - Default value if path doesn't exist
     * @returns {string} - The config value as a string
     */
    getString(path, defaultValue = '') {
        const value = this.get(path, defaultValue);
        return String(value);
    }
    
    /**
     * Get a config value as an array
     * 
     * @param {string} path - The path to the config value
     * @param {Array} defaultValue - Default value if path doesn't exist
     * @returns {Array} - The config value as an array
     */
    getArray(path, defaultValue = []) {
        const value = this.get(path, defaultValue);
        return Array.isArray(value) ? value : defaultValue;
    }
    
    /**
     * Check if a feature is enabled
     * Supports both old and new config formats
     * 
     * @param {string} feature - The feature to check
     * @returns {boolean} - True if the feature is enabled
     */
    isEnabled(feature) {
        // Support both old and new config formats
        const newFormat = this.getBoolean(`operations.${feature}.enabled`);
        const oldFormat = this.getBoolean(`${feature}.enabled`);
        
        return newFormat === true || oldFormat === true;
    }
    
    /**
     * Get min-max range configuration
     * 
     * @param {string} feature - The feature name
     * @param {string} property - The property name
     * @param {number} defaultMin - Default minimum value
     * @param {number} defaultMax - Default maximum value
     * @returns {Object} - Range object with min and max properties
     */
    getRange(feature, property, defaultMin = 1, defaultMax = 10) {
        // Try new format first
        let minValue = this.getNumber(`operations.${feature}.${property}.min`, 
                       this.getNumber(`${feature}.${property}.min`, defaultMin));
        
        let maxValue = this.getNumber(`operations.${feature}.${property}.max`, 
                       this.getNumber(`${feature}.${property}.max`, defaultMax));
        
        // Ensure min is not greater than max
        if (minValue > maxValue) {
            this.logger.warn(`Invalid range for ${feature}.${property}: min (${minValue}) > max (${maxValue}). Using min value.`);
            maxValue = minValue;
        }
        
        return { min: minValue, max: maxValue };
    }
    
    /**
     * Get a random value within a configured range
     * 
     * @param {string} feature - The feature name
     * @param {string} property - The property name
     * @param {number} defaultMin - Default minimum value
     * @param {number} defaultMax - Default maximum value
     * @returns {number} - Random value within the range
     */
    getRandomInRange(feature, property, defaultMin = 1, defaultMax = 10) {
        const range = this.getRange(feature, property, defaultMin, defaultMax);
        return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
    }
    
    /**
     * Get delay configuration
     * 
     * @returns {Object} - Delay configuration object
     */
    getDelayConfig() {
        return (this.config.general && this.config.general.delay) ? this.config.general.delay :
               (this.config.delay) ? this.config.delay :
               { min_seconds: 5, max_seconds: 30 };
    }
    
    /**
     * Get repeated operation count
     * 
     * @param {string} feature - The feature name
     * @param {number} defaultValue - Default repeat times
     * @returns {number} - Number of times to repeat the operation
     */
    getRepeatTimes(feature, defaultValue = 1) {
        return this.getNumber(`operations.${feature}.repeat_times`,
               this.getNumber(`${feature}.repeat_times`, defaultValue));
    }
    
    /**
     * Get gas price multiplier
     * 
     * @returns {number} - Gas price multiplier
     */
    getGasPriceMultiplier() {
        return this.getNumber('general.gas_price_multiplier', 1.2);
    }
    
    /**
     * Set a configuration value
     * 
     * @param {string} path - The path to set
     * @param {any} value - The value to set
     * @returns {ConfigManager} - This instance for chaining
     */
    set(path, value) {
        _.set(this.config, path, value);
        return this;
    }
    
    /**
     * Get randomized operations based on config
     * 
     * @param {Array} allOperations - All available operations
     * @returns {Array} - Operations in execution order
     */
    getRandomizedOperations(allOperations) {
        const randomizationConfig = this.get('randomization', { 
            enable: false, 
            excluded_operations: [],
            operations_to_run: allOperations.map(op => op.name)
        });
        
        // Filter operations based on operations_to_run config
        const operationsToRun = randomizationConfig.operations_to_run || 
            allOperations.map(op => op.name);
        
        const filteredOperations = allOperations.filter(op => operationsToRun.includes(op.name));
        
        // Split operations into fixed and randomizable based on excluded_operations
        const excludedOps = randomizationConfig.excluded_operations || [];
        const fixedOps = filteredOperations.filter(op => excludedOps.includes(op.name));
        const randomizableOps = filteredOperations.filter(op => !excludedOps.includes(op.name));
        
        // Randomize operations if enabled
        if (randomizationConfig.enable && randomizableOps.length > 1) {
            // Fisher-Yates shuffle algorithm
            for (let i = randomizableOps.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [randomizableOps[i], randomizableOps[j]] = [randomizableOps[j], randomizableOps[i]];
            }
        }
        
        // Return operations in order: fixed operations first, then randomized operations
        return [...fixedOps, ...randomizableOps];
    }
}

module.exports = ConfigManager;