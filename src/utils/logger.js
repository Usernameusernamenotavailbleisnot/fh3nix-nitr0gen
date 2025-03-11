const chalk = require('chalk');

class Logger {
    constructor(walletNum = null) {
        this.walletNum = walletNum;
    }
    
    setWalletNum(num) {
        this.walletNum = num;
    }
    
    // Get a timestamp string for logging
    getTimestamp() {
        const now = new Date();
        const timestamp = now.toLocaleTimeString('en-US', { hour12: false });
        if (this.walletNum !== null) {
            return `[${timestamp} - Wallet ${this.walletNum}]`;
        }
        return `[${timestamp}]`;
    }
    
    // Regular info message
    info(message) {
        console.log(chalk.cyan(`${this.getTimestamp()} ℹ ${message}`));
    }
    
    // Success message
    success(message) {
        console.log(chalk.green(`${this.getTimestamp()} ✓ ${message}`));
    }
    
    // Warning message
    warn(message) {
        console.log(chalk.yellow(`${this.getTimestamp()} ⚠ ${message}`));
    }
    
    // Error message
    error(message) {
        console.log(chalk.red(`${this.getTimestamp()} ✗ ${message}`));
    }
    
    // Bold header
    header(message) {
        console.log(chalk.blue.bold(`\n${this.getTimestamp()} ${message}\n`));
    }
    
    // Log with custom chalk style
    custom(message, style) {
        console.log(style(`${this.getTimestamp()} ${message}`));
    }
}

module.exports = Logger;