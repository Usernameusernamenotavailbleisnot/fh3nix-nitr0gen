// src/operations/bridge.js
const constants = require('../utils/constants');
const BaseOperation = require('./BaseOperation');

/**
 * Manages bridge operations between networks
 * @extends BaseOperation
 */
class Bridge extends BaseOperation {
    /**
     * Create a new Bridge instance
     * 
     * @param {string} privateKey - Wallet private key
     * @param {Object} config - Configuration object
     */
    constructor(privateKey, config = {}) {
        // Define default config
        const defaultConfig = {
            enabled: false,
            amount: {
                min: 0.0001,
                max: 0.0004,
                decimals: 7
            },
            repeat_times: 1
        };
        
        // Initialize base class
        super(privateKey, config, 'bridge');
        
        // Override default config
        this.defaultConfig = defaultConfig;
    }
    
    /**
     * Get balances on both networks
     * 
     * @returns {Promise<Object>} Balance information
     */
    async getBalances() {
        try {
            const sepoliaBalanceData = await this.blockchain.getBalance('sepolia');
            const fhenixBalanceData = await this.blockchain.getBalance('fhenix');
            
            this.logger.info(`💰 Current Balances:`);
            this.logger.info(`  • Sepolia: ${sepoliaBalanceData.balanceInEth} ETH`);
            this.logger.info(`  • Fhenix: ${fhenixBalanceData.balanceInEth} FHE`);
            
            return { 
                sepolia_balance: sepoliaBalanceData.balance, 
                fhenix_balance: fhenixBalanceData.balance
            };
        } catch (error) {
            this.logger.error(`Failed to get balances: ${error.message}`);
            return { 
                sepolia_balance: '0', 
                fhenix_balance: '0'
            };
        }
    }
    
    /**
     * Bridge ETH from Sepolia to Fhenix
     * 
     * @returns {Promise<boolean>} Success status
     */
    async bridgeETH() {
        if (!this.isEnabled()) {
            this.logger.warn(`Bridge feature is disabled in config`);
            return false;
        }

        try {
            // Generate random amount
            const amountRange = this.configManager.getRange('bridge', 'amount', 0.0001, 0.0004);
            const decimals = this.configManager.getNumber('operations.bridge.amount.decimals', 
                             this.configManager.getNumber('bridge.amount.decimals', 7));
            
            const amount_eth = Number(amountRange.min + Math.random() * (amountRange.max - amountRange.min)).toFixed(decimals);
            const amount_wei = this.blockchain.sepoliaWeb3.utils.toWei(amount_eth, 'ether');
            
            // Get initial balances
            const { sepolia_balance, fhenix_balance } = await this.getBalances();
            
            if (BigInt(sepolia_balance) < BigInt(amount_wei)) {
                this.logger.error(`Insufficient Sepolia balance to bridge ${amount_eth} ETH`);
                return false;
            }
            
            this.logger.info(`🌉 Starting bridge of ${amount_eth} ETH...`);
            
            // Add random delay before bridging
            await this.addDelay("bridge operation");
            
            // Prepare transaction
            const txObject = {
                to: constants.BRIDGE.INBOX_ADDRESS,
                value: amount_wei,
                data: constants.BRIDGE.DEPOSIT_FUNCTION
            };

            // Send bridge transaction
            const result = await this.blockchain.sendTransaction(txObject, "bridge", "sepolia");
            
            if (!result.success) {
                this.logger.error(`Bridge transaction failed: ${result.error}`);
                return false;
            }
            
            this.logger.success(`Bridge transaction sent: ${result.txHash}`);
            this.logger.success(`Track on Sepolia: ${constants.SEPOLIA.EXPLORER_URL}/tx/${result.txHash}`);
            
            // Wait for bridge completion
            return await this.waitForBridgeCompletion(fhenix_balance, amount_wei);
            
        } catch (error) {
            this.logger.error(`Bridge transaction failed: ${error.message}`);
            return false;
        }
    }
    
    /**
     * Wait for bridge completion
     * 
     * @param {string} initialFhenixBalance - Initial balance on Fhenix
     * @param {string} amountBridgedWei - Amount bridged in wei
     * @returns {Promise<boolean>} Success status
     */
    async waitForBridgeCompletion(initialFhenixBalance, amountBridgedWei) {
        this.logger.info(`🔄 Monitoring bridge progress...`);
        const checkInterval = 30; // Check every 30 seconds
        const maxChecks = 20;     // Maximum 10 minutes (20 * 30 seconds) of checking
        let checks = 0;
        
        // Convert to BigInt for safer comparison
        const initialBalance = BigInt(initialFhenixBalance);
        
        while (checks < maxChecks) {
            // Add delay between checks
            await new Promise(resolve => setTimeout(resolve, checkInterval * 1000));
            
            try {
                const currentFhenixBalanceData = await this.blockchain.getBalance('fhenix');
                const currentFhenixBalance = BigInt(currentFhenixBalanceData.balance);
                
                if (currentFhenixBalance > initialBalance) {
                    const balanceIncrease = currentFhenixBalance - initialBalance;
                    const increaseEth = this.blockchain.web3.utils.fromWei(balanceIncrease.toString(), 'ether');
                    
                    this.logger.success(`Bridge completed! Received ${Number(increaseEth).toFixed(4)} FHE`);
                    return true;
                }
                
                checks++;
                this.logger.info(`⏳ Waiting for bridge completion... (${checks}/${maxChecks})`);
                
            } catch (error) {
                this.logger.warn(`Error checking balance: ${error.message}`);
                checks++;
            }
        }
        
        this.logger.warn(`Bridge monitoring timed out after ${maxChecks * checkInterval} seconds`);
        return false;
    }
    
    /**
     * Implement the executeOperations method from BaseOperation
     * 
     * @returns {Promise<boolean>} Success status
     */
    async executeOperations() {
        try {
            // Reset nonce tracking at the start of operations
            this.blockchain.resetNonce('sepolia');
            
            // Get repeat count from config
            const repeat_times = this.configManager.getRepeatTimes('bridge', 1);
            
            this.logger.info(`🔄 Will perform ${repeat_times} bridge operations...`);
            
            let successCount = 0;
            for (let i = 0; i < repeat_times; i++) {
                this.logger.info(`📍 Bridge operation ${i+1}/${repeat_times}`);
                
                const success = await this.bridgeETH();
                if (success) {
                    successCount++;
                }
                
                // Add delay between operations if not the last one
                if (i < repeat_times - 1) {
                    this.logger.info(`⏳ Waiting before next bridge operation...`);
                    await new Promise(resolve => setTimeout(resolve, 60000)); // 1 minute delay
                }
            }
            
            this.logger.success(`Bridge operations completed: ${successCount}/${repeat_times} successful`);
            return successCount > 0;
            
        } catch (error) {
            this.logger.error(`Error in bridge operations: ${error.message}`);
            return false;
        }
    }
}

module.exports = Bridge;