const { Web3 } = require('web3');
const chalk = require('chalk');
const constants = require('../utils/constants');
const { addRandomDelay, getTimestamp } = require('../utils/delay');

class Bridge {
    constructor(privateKey, config = {}) {
        // Default bridge configuration
        this.defaultConfig = {
            enabled: false,
            amount: {
                min: 0.0001,
                max: 0.0004,
                decimals: 7
            },
            repeat_times: 1
        };
        
        // Load configuration, supporting both old and new formats
        if (config.operations && config.operations.bridge) {
            // New format
            this.config = { 
                ...this.defaultConfig, 
                ...config.operations.bridge 
            };
        } else if (config.bridge) {
            // Old format
            this.config = { 
                ...this.defaultConfig, 
                ...config.bridge 
            };
        } else {
            // No bridge config found, use defaults
            this.config = this.defaultConfig;
        }
        
        // Extract delay configuration consistently
        this.delayConfig = (config.general && config.general.delay) ? config.general.delay :
                           (config.delay) ? config.delay :
                           { min_seconds: constants.DELAY.MIN_SECONDS, max_seconds: constants.DELAY.MAX_SECONDS };
        
        // Setup web3 connections for both networks
        this.w3_sepolia = new Web3(constants.SEPOLIA.RPC_URL);
        this.w3_fhenix = new Web3(constants.NETWORK.RPC_URL);
        
        // Setup account
        if (!privateKey.startsWith('0x')) {
            privateKey = '0x' + privateKey;
        }
        this.account = this.w3_sepolia.eth.accounts.privateKeyToAccount(privateKey);
        this.walletNum = null;
        
        // Add nonce tracking to avoid transaction issues
        this.currentNonce = null;
        
        // Log the bridge status for debugging
        console.log(chalk.cyan(`${getTimestamp(this.walletNum || 0)} ℹ Bridge enabled: ${this.config.enabled}`));
    }
    
    setWalletNum(num) {
        this.walletNum = num;
    }
    
    async getBalances() {
        try {
            const sepolia_balance = await this.w3_sepolia.eth.getBalance(this.account.address);
            const fhenix_balance = await this.w3_fhenix.eth.getBalance(this.account.address);
            
            const sepolia_eth = Number(this.w3_sepolia.utils.fromWei(sepolia_balance, 'ether')).toFixed(4);
            const fhenix_eth = Number(this.w3_fhenix.utils.fromWei(fhenix_balance, 'ether')).toFixed(4);
            
            console.log(chalk.cyan(`${getTimestamp(this.walletNum)} 💰 Current Balances:`));
            console.log(chalk.cyan(`${getTimestamp(this.walletNum)}   • Sepolia: ${sepolia_eth} ETH`));
            console.log(chalk.cyan(`${getTimestamp(this.walletNum)}   • Fhenix: ${fhenix_eth} FHE`));
            
            return { sepolia_balance, fhenix_balance };
        } catch (error) {
            console.log(chalk.red(`${getTimestamp(this.walletNum)} ❌ Failed to get balances: ${error.message}`));
            return { sepolia_balance: '0', fhenix_balance: '0' };
        }
    }
    
    // Get the next nonce, considering pending transactions
    async getNonce() {
        if (this.currentNonce === null) {
            // If this is the first transaction, get the nonce from the network
            this.currentNonce = await this.w3_sepolia.eth.getTransactionCount(this.account.address);
            console.log(chalk.cyan(`${getTimestamp(this.walletNum)} ℹ Initial nonce from network: ${this.currentNonce}`));
        } else {
            // For subsequent transactions, use the tracked nonce
            console.log(chalk.cyan(`${getTimestamp(this.walletNum)} ℹ Using tracked nonce: ${this.currentNonce}`));
        }
        
        return this.currentNonce;
    }
    
    // Update nonce after a transaction is sent
    incrementNonce() {
        if (this.currentNonce !== null) {
            this.currentNonce++;
            console.log(chalk.cyan(`${getTimestamp(this.walletNum)} ℹ Incremented nonce to: ${this.currentNonce}`));
        }
    }
    
    // Enhanced gas price calculation
    async getGasPrice() {
        try {
            // Get the current gas price from Sepolia
            const gasPrice = await this.w3_sepolia.eth.getGasPrice();
            
            // Apply multiplier (20% increase for safety)
            const adjustedGasPrice = BigInt(Math.floor(Number(gasPrice) * 1.2));
            
            console.log(chalk.cyan(`${getTimestamp(this.walletNum)} ℹ Sepolia gas price: ${this.w3_sepolia.utils.fromWei(gasPrice, 'gwei')} gwei, using: ${this.w3_sepolia.utils.fromWei(adjustedGasPrice.toString(), 'gwei')} gwei`));
            
            return adjustedGasPrice.toString();
        } catch (error) {
            console.log(chalk.red(`${getTimestamp(this.walletNum)} ❌ Error getting gas price: ${error.message}`));
            
            // Fallback to a safe gas price
            const fallbackGasPrice = this.w3_sepolia.utils.toWei('50', 'gwei');
            console.log(chalk.yellow(`${getTimestamp(this.walletNum)} ⚠️ Using fallback gas price: 50 gwei`));
            
            return fallbackGasPrice;
        }
    }
    
    async bridgeETH() {
        if (!this.config.enabled) {
            console.log(chalk.yellow(`${getTimestamp(this.walletNum)} ⚠️ Bridge feature is disabled in config`));
            return false;
        }

        try {
            // Generate random amount
            const min_amount = this.config.amount.min;
            const max_amount = this.config.amount.max;
            const decimals = this.config.amount.decimals;
            
            const amount_eth = Number(min_amount + Math.random() * (max_amount - min_amount)).toFixed(decimals);
            const amount_wei = this.w3_sepolia.utils.toWei(amount_eth, 'ether');
            
            // Get initial balances
            const { sepolia_balance, fhenix_balance } = await this.getBalances();
            
            if (BigInt(sepolia_balance) < BigInt(amount_wei)) {
                console.log(chalk.red(`${getTimestamp(this.walletNum)} ❌ Insufficient Sepolia balance to bridge ${amount_eth} ETH`));
                return false;
            }
            
            console.log(chalk.cyan(`${getTimestamp(this.walletNum)} 🌉 Starting bridge of ${amount_eth} ETH...`));
            
            // Add random delay before bridging - UPDATED to use delayConfig
            await addRandomDelay(this.delayConfig, this.walletNum, "bridge operation");
            
            // Prepare transaction
            const nonce = await this.getNonce();
            const gasPrice = await this.getGasPrice();
            
            const tx = {
                nonce,
                to: constants.BRIDGE.INBOX_ADDRESS,
                value: amount_wei,
                data: constants.BRIDGE.DEPOSIT_FUNCTION,
                chainId: constants.SEPOLIA.CHAIN_ID,
                gas: 300000, // Higher gas limit for bridge transactions
                gasPrice
            };

            // Sign and send transaction
            console.log(chalk.cyan(`${getTimestamp(this.walletNum)} ℹ Signing bridge transaction...`));
            const signedTx = await this.w3_sepolia.eth.accounts.signTransaction(tx, this.account.privateKey);
            
            // Increment nonce before sending
            this.incrementNonce();
            
            console.log(chalk.cyan(`${getTimestamp(this.walletNum)} 📤 Sending bridge transaction...`));
            const receipt = await this.w3_sepolia.eth.sendSignedTransaction(signedTx.rawTransaction);
            
            console.log(chalk.green(`${getTimestamp(this.walletNum)} ✅ Bridge transaction sent: ${receipt.transactionHash}`));
            console.log(chalk.green(`${getTimestamp(this.walletNum)} 🔍 Track on Sepolia: ${constants.SEPOLIA.EXPLORER_URL}/tx/${receipt.transactionHash}`));
            
            // Wait for bridge completion
            return await this.waitForBridgeCompletion(fhenix_balance, amount_wei);
            
        } catch (error) {
            console.log(chalk.red(`${getTimestamp(this.walletNum)} ❌ Bridge transaction failed: ${error.message}`));
            return false;
        }
    }
    
    async waitForBridgeCompletion(initialFhenixBalance, amountBridgedWei) {
        console.log(chalk.cyan(`${getTimestamp(this.walletNum)} 🔄 Monitoring bridge progress...`));
        const checkInterval = 30; // Check every 30 seconds
        const maxChecks = 20;     // Maximum 10 minutes (20 * 30 seconds) of checking
        let checks = 0;
        
        // Convert to BigInt for safer comparison
        const initialBalance = BigInt(initialFhenixBalance);
        
        while (checks < maxChecks) {
            // Add delay between checks
            await new Promise(resolve => setTimeout(resolve, checkInterval * 1000));
            
            try {
                const currentFhenixBalance = BigInt(await this.w3_fhenix.eth.getBalance(this.account.address));
                
                if (currentFhenixBalance > initialBalance) {
                    const balanceIncrease = currentFhenixBalance - initialBalance;
                    const increaseEth = this.w3_fhenix.utils.fromWei(balanceIncrease.toString(), 'ether');
                    
                    console.log(chalk.green(`${getTimestamp(this.walletNum)} ✅ Bridge completed! Received ${Number(increaseEth).toFixed(4)} FHE`));
                    return true;
                }
                
                checks++;
                console.log(chalk.cyan(`${getTimestamp(this.walletNum)} ⏳ Waiting for bridge completion... (${checks}/${maxChecks})`));
                
            } catch (error) {
                console.log(chalk.yellow(`${getTimestamp(this.walletNum)} ⚠️ Error checking balance: ${error.message}`));
                checks++;
            }
        }
        
        console.log(chalk.yellow(`${getTimestamp(this.walletNum)} ⚠️ Bridge monitoring timed out after ${maxChecks * checkInterval} seconds`));
        return false;
    }
    
    async executeBridgeOperations() {
        if (!this.config.enabled) {
            console.log(chalk.yellow(`${getTimestamp(this.walletNum)} ⚠️ Bridge operations disabled in config`));
            return true; // Return success to not interrupt the flow
        }
        
        console.log(chalk.blue.bold(`${getTimestamp(this.walletNum)} Starting bridge operations...`));
        
        try {
            // Reset nonce tracking at the start of operations
            this.currentNonce = null;
            
            // Get repeat count from config
            const repeat_times = this.config.repeat_times || 1;
            
            console.log(chalk.cyan(`${getTimestamp(this.walletNum)} 🔄 Will perform ${repeat_times} bridge operations...`));
            
            let successCount = 0;
            for (let i = 0; i < repeat_times; i++) {
                console.log(chalk.cyan(`${getTimestamp(this.walletNum)} 📍 Bridge operation ${i+1}/${repeat_times}`));
                
                const success = await this.bridgeETH();
                if (success) {
                    successCount++;
                }
                
                // Add delay between operations if not the last one
                if (i < repeat_times - 1) {
                    console.log(chalk.cyan(`${getTimestamp(this.walletNum)} ⏳ Waiting before next bridge operation...`));
                    await new Promise(resolve => setTimeout(resolve, 60000)); // 1 minute delay
                }
            }
            
            console.log(chalk.green(`${getTimestamp(this.walletNum)} ✅ Bridge operations completed: ${successCount}/${repeat_times} successful`));
            return successCount > 0;
            
        } catch (error) {
            console.log(chalk.red(`${getTimestamp(this.walletNum)} ❌ Error in bridge operations: ${error.message}`));
            return false;
        }
    }
}

module.exports = Bridge;