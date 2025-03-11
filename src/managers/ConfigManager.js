const _ = require('lodash');
const Logger = require('../utils/logger');

class ConfigManager {
    constructor(config = {}, defaultConfig = {}, walletNum = null) {
        // Deep merge the configuration
        this.config = _.merge({}, defaultConfig, config);
        this.logger = new Logger(walletNum);
    }
    
    setWalletNum(num) {
        this.logger.setWalletNum(num);
    }
    
    // Get a configuration value with dot notation support (e.g., "operations.erc20.enabled")
    get(path, defaultValue = undefined) {
        return _.get(this.config, path, defaultValue);
    }
    
    // Check if a feature is enabled
    isEnabled(feature) {
        // Support both old and new config formats
        const newFormat = this.get(`operations.${feature}.enabled`);
        const oldFormat = this.get(`${feature}.enabled`);
        
        return newFormat === true || oldFormat === true;
    }
    
    // Get min-max range configuration
    getRange(feature, property, defaultMin = 1, defaultMax = 10) {
        // Try new format first
        let minValue = this.get(`operations.${feature}.${property}.min`, 
                       this.get(`${feature}.${property}.min`, defaultMin));
        
        let maxValue = this.get(`operations.${feature}.${property}.max`, 
                       this.get(`${feature}.${property}.max`, defaultMax));
        
        // Ensure min is not greater than max
        if (minValue > maxValue) {
            this.logger.warn(`Invalid range for ${feature}.${property}: min (${minValue}) > max (${maxValue}). Using min value.`);
            maxValue = minValue;
        }
        
        return { min: minValue, max: maxValue };
    }
    
    // Get a random value within a configured range
    getRandomInRange(feature, property, defaultMin = 1, defaultMax = 10) {
        const range = this.getRange(feature, property, defaultMin, defaultMax);
        return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
    }
    
    // Get delay configuration
    getDelayConfig() {
        return (this.config.general && this.config.general.delay) ? this.config.general.delay :
               (this.config.delay) ? this.config.delay :
               { min_seconds: 5, max_seconds: 30 };
    }
    
    // Get repeated operation count
    getRepeatTimes(feature, defaultValue = 1) {
        return this.get(`operations.${feature}.repeat_times`,
               this.get(`${feature}.repeat_times`, defaultValue));
    }
    
    // Get gas price multiplier
    getGasPriceMultiplier() {
        return this.get('general.gas_price_multiplier', 1.2);
    }
    
    // Get randomized operations based on config
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