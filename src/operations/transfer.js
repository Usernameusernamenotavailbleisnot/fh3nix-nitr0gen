// src/operations/transfer.js
const constants = require('../utils/constants');
const BaseOperation = require('./BaseOperation');

/**
 * Manages token self-transfer operations
 * @extends BaseOperation
 */
class TokenTransfer extends BaseOperation {
    /**
     * Create a new TokenTransfer instance
     * 
     * @param {string} privateKey - Wallet private key
     * @param {Object} config - Configuration object
     */
    constructor(privateKey, config = {}) {
        // Define default config
        const defaultConfig = {
            enabled: true,
            use_percentage: true,
            percentage: 90,
            fixed_amount: {
                min: 0.0001,
                max: 0.001,
                decimals: 5
            },
            count: {
                min: 1,
                max: 3
            },
            repeat_times: 1
        };
        
        // Initialize base class
        super(privateKey, config, 'transfer');
        
        // Override the default config
        this.defaultConfig = defaultConfig;
    }
    
    /**
     * Calculate transfer amount based on configuration
     * 
     * @param {string} balance - Current balance in wei
     * @returns {Promise<BigInt>} Amount to transfer in wei
     */
    async calculateTransferAmount(balance) {
        let transferAmount;
        const usePercentage = this.configManager.get('operations.transfer.use_percentage', 
                             this.configManager.get('transfer.use_percentage', true));
        
        if (!usePercentage) {
            // Use fixed amount configuration
            const fixedAmountRange = this.configManager.getRange('transfer', 'fixed_amount', 0.0001, 0.001);
            const decimals = this.configManager.get('operations.transfer.fixed_amount.decimals', 
                           this.configManager.get('transfer.fixed_amount.decimals', 5));
            
            // Generate random amount between min and max
            const amount_eth = Number(fixedAmountRange.min + Math.random() * 
                             (fixedAmountRange.max - fixedAmountRange.min)).toFixed(decimals);
            transferAmount = BigInt(this.blockchain.web3.utils.toWei(amount_eth, 'ether'));
        } else {
            // Use percentage-based amount
            const transferPercentage = BigInt(this.configManager.get('operations.transfer.percentage', 
                                            this.configManager.get('transfer.percentage', 90)));
            transferAmount = (BigInt(balance) * transferPercentage / BigInt(100));
        }
        
        // Adjust for gas costs
        const gasEstimate = await this.estimateGasCost(transferAmount);
        transferAmount = transferAmount > gasEstimate ? transferAmount - gasEstimate : BigInt(0);
        
        return transferAmount;
    }
    
    /**
     * Estimate gas cost for a transfer
     * 
     * @param {BigInt} amount - Transfer amount
     * @returns {Promise<BigInt>} Estimated gas cost in wei
     */
    async estimateGasCost(amount) {
        const txTemplate = {
            to: this.blockchain.address,
            from: this.blockchain.address,
            data: '0x',
            value: amount.toString()
        };
        
        const gasLimit = await this.blockchain.estimateGas(txTemplate);
        const gasPrice = await this.blockchain.getGasPrice();
        return BigInt(gasLimit) * BigInt(gasPrice);
    }
    
    /**
     * Execute a single transfer
     * 
     * @param {number} transferNum - Current transfer number
     * @param {number} totalTransfers - Total transfers to perform
     * @returns {Promise<boolean>} Success status
     */
    async executeTransfer(transferNum, totalTransfers) {
        try {
            // Get wallet balance
            const { balance, balanceInEth, currency } = await this.blockchain.getBalance();
            
            if (balance === '0') {
                this.logger.warn(`No balance to transfer`);
                return true;
            }

            // Add random delay before transfer
            await this.addDelay(`transfer #${transferNum}/${totalTransfers}`);

            // Calculate transfer amount
            const transferAmount = await this.calculateTransferAmount(balance);

            if (transferAmount <= BigInt(0)) {
                this.logger.warn(`Balance too low to cover gas`);
                return true;
            }
            
            // Format amount for display
            const displayAmount = this.blockchain.web3.utils.fromWei(transferAmount.toString(), 'ether');
            
            // Create and send transaction
            const txObject = {
                to: this.blockchain.address,
                value: transferAmount.toString(),
                data: '0x'
            };

            this.logger.info(`Sending transfer #${transferNum}/${totalTransfers} of ${displayAmount} ${currency} to self`);
            
            const result = await this.blockchain.sendTransaction(txObject, `self-transfer #${transferNum}`);
            
            if (result.success) {
                this.logger.success(`Transfer #${transferNum}/${totalTransfers} successful`);
                this.logger.success(`View transaction: ${constants.NETWORK.EXPLORER_URL}/tx/${result.txHash}`);
                return true;
            } else {
                this.logger.error(`Transfer #${transferNum}/${totalTransfers} failed: ${result.error}`);
                return false;
            }
        } catch (error) {
            this.logger.error(`Error in transfer #${transferNum}/${totalTransfers}: ${error.message}`);
            return false;
        }
    }

    /**
     * Implement the executeOperations method from BaseOperation
     * 
     * @returns {Promise<boolean>} Success status
     */
    async executeOperations() {
        // Get transfer count from config
        const transferCount = this.configManager.getRandomInRange('transfer', 'count', 1, 3);
        
        // Get repeat times if configured
        const repeatTimes = this.configManager.getRepeatTimes('transfer', 1);
        
        this.logger.info(`Will perform ${transferCount} self-transfers, repeated ${repeatTimes} time(s)`);
        
        let totalSuccess = 0;
        for (let r = 0; r < repeatTimes; r++) {
            let successCount = 0;
            
            // Reset nonce for each repeat cycle
            this.blockchain.resetNonce();
            
            for (let i = 1; i <= transferCount; i++) {
                const success = await this.executeTransfer(i, transferCount);
                if (success) {
                    successCount++;
                    totalSuccess++;
                }
                
                // Add delay between transfers if not the last one
                if (i < transferCount) {
                    await this.addDelay(`next transfer (${i+1}/${transferCount})`);
                }
            }
            
            // Add delay between repeat cycles if not the last one
            if (r < repeatTimes - 1) {
                this.logger.info(`Completed repeat cycle ${r+1}/${repeatTimes}`);
                await this.addDelay(`next repeat cycle (${r+2}/${repeatTimes})`);
            }
        }
        
        this.logger.success(`Self-transfer operations completed: ${totalSuccess}/${transferCount * repeatTimes} successful transfers`);
        return totalSuccess > 0;
    }
}

module.exports = TokenTransfer;