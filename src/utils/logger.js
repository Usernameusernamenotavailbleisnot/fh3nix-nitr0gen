// src/utils/logger.js
const chalk = require('chalk');

/**
 * Enhanced Logger with wallet-specific instances and log levels
 */
class Logger {
    /**
     * Create a new Logger
     */
    constructor() {
        // Keep track of existing loggers by wallet
        this.instances = new Map();
        this._defaultLogger = this._createLogger(null);
        
        // Track last used wallet number for consistency
        this._lastWalletNum = null;
        
        // Default log level
        this.logLevel = 'info'; // 'error', 'warn', 'info', 'debug'
    }

    /**
     * Get logger instance for specific wallet
     * 
     * @param {number|null} walletNum - Wallet number
     * @returns {Object} Logger instance
     */
    getInstance(walletNum = null) {
        // If no wallet specified, use last wallet number if available
        if (walletNum === null && this._lastWalletNum !== null) {
            walletNum = this._lastWalletNum;
        } else if (walletNum !== null) {
            // Track this wallet number for future consistency
            this._lastWalletNum = walletNum;
        }
        
        if (walletNum === null) {
            return this._defaultLogger;
        }
        
        if (!this.instances.has(walletNum)) {
            this.instances.set(walletNum, this._createLogger(walletNum));
        }
        
        return this.instances.get(walletNum);
    }

    /**
     * Create a new logger object for a wallet
     * 
     * @param {number|null} walletNum - Wallet number
     * @returns {Object} Logger instance
     * @private
     */
    _createLogger(walletNum) {
        const self = this;
        
        return {
            walletNum,
            
            /**
             * Get a timestamp string for logging
             * 
             * @returns {string} Formatted timestamp
             */
            getTimestamp() {
                const now = new Date();
                
                // Format date DD/MM/YYYY
                const day = String(now.getDate()).padStart(2, '0');
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const year = now.getFullYear();
                const formattedDate = `${day}/${month}/${year}`;
                
                // Format time HH:MM:SS
                const hours = String(now.getHours()).padStart(2, '0');
                const minutes = String(now.getMinutes()).padStart(2, '0');
                const seconds = String(now.getSeconds()).padStart(2, '0');
                const formattedTime = `${hours}:${minutes}:${seconds}`;
                
                // Format as [DD/MM/YYYY - HH:MM:SS - Wallet X]
                if (this.walletNum !== null) {
                    return `[${formattedDate} - ${formattedTime} - Wallet ${this.walletNum}]`;
                }
                return `[${formattedDate} - ${formattedTime} - System]`;
            },
            
            /**
             * Check if a message should be logged based on log level
             * 
             * @param {string} messageLevel - Message log level
             * @returns {boolean} True if message should be logged
             */
            shouldLog(messageLevel) {
                const levels = {
                    error: 0,
                    warn: 1,
                    info: 2,
                    debug: 3
                };
                
                return levels[messageLevel] <= levels[self.logLevel || 'info'];
            },
            
            /**
             * Log an info message
             * 
             * @param {string} message - Message to log
             */
            info(message) {
                if (this.shouldLog('info')) {
                    console.log(chalk.cyan(`${this.getTimestamp()} ℹ ${message}`));
                }
            },
            
            /**
             * Log a success message
             * 
             * @param {string} message - Message to log
             */
            success(message) {
                if (this.shouldLog('info')) {
                    console.log(chalk.green(`${this.getTimestamp()} ✓ ${message}`));
                }
            },
            
            /**
             * Log a warning message
             * 
             * @param {string} message - Message to log
             */
            warn(message) {
                if (this.shouldLog('warn')) {
                    console.log(chalk.yellow(`${this.getTimestamp()} ⚠ ${message}`));
                }
            },
            
            /**
             * Log an error message
             * 
             * @param {string} message - Message to log
             */
            error(message) {
                if (this.shouldLog('error')) {
                    console.log(chalk.red(`${this.getTimestamp()} ✗ ${message}`));
                }
            },
            
            /**
             * Log a debug message
             * 
             * @param {string} message - Message to log
             */
            debug(message) {
                if (this.shouldLog('debug')) {
                    console.log(chalk.gray(`${this.getTimestamp()} 🔍 ${message}`));
                }
            },
            
            /**
             * Log a section header with dividers
             * 
             * @param {string} message - Header message
             */
            header(message) {
                if (this.shouldLog('info')) {
                    // Create divider with width 80 characters
                    const divider = chalk.blue("═".repeat(80));
                    
                    // Display divider, header, and divider
                    console.log(`\n${divider}`);
                    console.log(chalk.blue.bold(`${this.getTimestamp()} ${message}`));
                    console.log(`${divider}\n`);
                }
            },
            
            /**
             * Log with custom chalk style
             * 
             * @param {string} message - Message to log
             * @param {Function} style - Chalk style function
             */
            custom(message, style) {
                if (this.shouldLog('info')) {
                    console.log(style(`${this.getTimestamp()} ${message}`));
                }
            }
        };
    }

    /**
     * Set the log level
     * 
     * @param {string} level - Log level ('error', 'warn', 'info', 'debug')
     * @returns {Logger} This instance for chaining
     */
    setLogLevel(level) {
        if (['error', 'warn', 'info', 'debug'].includes(level)) {
            this.logLevel = level;
        }
        return this;
    }
    
    /**
     * Update the wallet number for logging context
     * 
     * @param {number|null} num - Wallet number
     * @returns {Object} Logger instance
     */
    setWalletNum(num) {
        // Set the last wallet number - important for consistency!
        this._lastWalletNum = num;
        
        // Create or get the logger for this wallet number
        this.getInstance(num);
        
        // Return the instance for method chaining
        return this.getInstance(num);
    }
    
    /**
     * Get a timestamp string
     * 
     * @returns {string} Formatted timestamp
     */
    getTimestamp() {
        return this.getInstance().getTimestamp();
    }

    // Proxy methods to the instance with last wallet number for maximum consistency
    
    /**
     * Log an info message
     * 
     * @param {string} message - Message to log
     */
    info(message) {
        this.getInstance().info(message);
    }
    
    /**
     * Log a success message
     * 
     * @param {string} message - Message to log
     */
    success(message) {
        this.getInstance().success(message);
    }
    
    /**
     * Log a warning message
     * 
     * @param {string} message - Message to log
     */
    warn(message) {
        this.getInstance().warn(message);
    }
    
    /**
     * Log an error message
     * 
     * @param {string} message - Message to log
     */
    error(message) {
        this.getInstance().error(message);
    }
    
    /**
     * Log a debug message
     * 
     * @param {string} message - Message to log
     */
    debug(message) {
        this.getInstance().debug(message);
    }
    
    /**
     * Log a section header with dividers
     * 
     * @param {string} message - Header message
     */
    header(message) {
        this.getInstance().header(message);
    }
    
    /**
     * Log with custom chalk style
     * 
     * @param {string} message - Message to log
     * @param {Function} style - Chalk style function
     */
    custom(message, style) {
        this.getInstance().custom(message, style);
    }
}

// Export a singleton instance
module.exports = new Logger();