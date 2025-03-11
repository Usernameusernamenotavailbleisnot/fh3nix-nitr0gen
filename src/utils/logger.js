const chalk = require('chalk');

// Enhanced Singleton pattern for Logger
class Logger {
    constructor() {
        // Keep track of existing loggers by wallet
        this.instances = new Map();
        this._defaultLogger = this._createLogger(null);
        
        // Track last used wallet number for consistency
        this._lastWalletNum = null;
    }

    // Get logger instance for specific wallet
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

    // Create a new logger object for a wallet
    _createLogger(walletNum) {
        return {
            walletNum,
            
            // Get a timestamp string for logging
            getTimestamp() {
                const now = new Date();
                const timestamp = now.toLocaleTimeString('en-US', { hour12: false });
                if (this.walletNum !== null) {
                    return `[${timestamp} - Wallet ${this.walletNum}]`;
                }
                return `[${timestamp} - System]`; // Add "System" to non-wallet logs for clarity
            },
            
            // Regular info message
            info(message) {
                console.log(chalk.cyan(`${this.getTimestamp()} ℹ ${message}`));
            },
            
            // Success message
            success(message) {
                console.log(chalk.green(`${this.getTimestamp()} ✓ ${message}`));
            },
            
            // Warning message
            warn(message) {
                console.log(chalk.yellow(`${this.getTimestamp()} ⚠ ${message}`));
            },
            
            // Error message
            error(message) {
                console.log(chalk.red(`${this.getTimestamp()} ✗ ${message}`));
            },
            
            // Bold header
            header(message) {
                console.log(chalk.blue.bold(`\n${this.getTimestamp()} ${message}\n`));
            },
            
            // Log with custom chalk style
            custom(message, style) {
                console.log(style(`${this.getTimestamp()} ${message}`));
            }
        };
    }

    // Helper method to update all instances with new wallet numbers
    setWalletNum(num) {
        // Set the last wallet number - important for consistency!
        this._lastWalletNum = num;
        
        // Create or get the logger for this wallet number
        this.getInstance(num);
        
        // Return the instance for method chaining
        return this.getInstance(num);
    }
    
    getTimestamp() {
        return this.getInstance().getTimestamp();
    }

    // Proxy methods to the instance with last wallet number for maximum consistency
    info(message) {
        this.getInstance().info(message);
    }
    
    success(message) {
        this.getInstance().success(message);
    }
    
    warn(message) {
        this.getInstance().warn(message);
    }
    
    error(message) {
        this.getInstance().error(message);
    }
    
    header(message) {
        this.getInstance().header(message);
    }
    
    custom(message, style) {
        this.getInstance().custom(message, style);
    }
}

// Export a singleton instance
module.exports = new Logger();