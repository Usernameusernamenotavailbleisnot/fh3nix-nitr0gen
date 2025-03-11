// src/operations/transfer.js
const constants = require('../utils/constants');
const { addRandomDelay } = require('../utils/delay');
const BlockchainManager = require('../managers/BlockchainManager');
const ConfigManager = require('../managers/ConfigManager');
const logger = require('../utils/logger');

class TokenTransfer {
    constructor(config = {}) {
        // Set default config
        this.defaultConfig = {
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
        
        // Initialize config manager
        this.configManager = new ConfigManager(config, { transfer: this.defaultConfig });
        
        // Initial logger is global
        this.logger = logger.getInstance();
        this.walletNum = null;

        // Will be initialized per wallet in transferToSelf
        this.blockchain = null;
    }

    async executeTransfer(privateKey, walletNum, transferNum = 1, totalTransfers = 1) {
        if (!this.configManager.isEnabled('transfer')) {
            this.logger.warn(`Transfer disabled in config`);
            return true;
        }

        // Initialize blockchain manager for this wallet if not already initialized
        if (!this.blockchain || this.blockchain.walletNum !== walletNum) {
            this.blockchain = new BlockchainManager(privateKey, this.configManager.config, walletNum);
            this.logger = logger.getInstance(walletNum);
        }
        
        try {
            // Get wallet balance
            const { balance, balanceInEth, currency } = await this.blockchain.getBalance();
            
            if (balance === '0') {
                this.logger.warn(`No balance to transfer`);
                return true;
            }

            // Add random delay before transfer
            await addRandomDelay(this.configManager.getDelayConfig(), walletNum, `transfer #${transferNum}/${totalTransfers}`);

            // Determine transfer amount based on config
            let transferAmount;
            
            if (!this.configManager.get('operations.transfer.use_percentage', 
                 this.configManager.get('transfer.use_percentage', true))) {
                // Use fixed amount configuration
                const fixedAmountRange = this.configManager.getRange('transfer', 'fixed_amount', 0.0001, 0.001);
                const decimals = this.configManager.get('operations.transfer.fixed_amount.decimals', 
                               this.configManager.get('transfer.fixed_amount.decimals', 5));
                
                // Generate random amount between min and max
                const amount_eth = Number(fixedAmountRange.min + Math.random() * (fixedAmountRange.max - fixedAmountRange.min)).toFixed(decimals);
                transferAmount = BigInt(this.blockchain.web3.utils.toWei(amount_eth, 'ether'));
                
                // Verify we have enough balance for gas (get estimate first)
                const txTemplate = {
                    to: this.blockchain.address,
                    from: this.blockchain.address,
                    data: '0x',
                    value: transferAmount.toString()
                };
                
                const gasLimit = await this.blockchain.estimateGas(txTemplate);
                const gasPrice = await this.blockchain.getGasPrice();
                const gasCost = BigInt(gasLimit) * BigInt(gasPrice);
                
                // Check if we have enough balance
                if (transferAmount + gasCost > BigInt(balance)) {
                    this.logger.warn(`Balance too low for fixed amount transfer, using 50% of available balance instead`);
                    transferAmount = (BigInt(balance) - gasCost) / BigInt(2);
                }
                
                this.logger.info(`Using fixed amount transfer: ${this.blockchain.web3.utils.fromWei(transferAmount.toString(), 'ether')} ${currency}`);
            } else {
                // Use percentage-based amount
                const transferPercentage = BigInt(this.configManager.get('operations.transfer.percentage', 
                                                this.configManager.get('transfer.percentage', 90)));
                                                
                // Get gas cost estimation
                const txTemplate = {
                    to: this.blockchain.address,
                    from: this.blockchain.address,
                    data: '0x'
                };
                
                const gasLimit = await this.blockchain.estimateGas(txTemplate);
                const gasPrice = await this.blockchain.getGasPrice();
                const gasCost = BigInt(gasLimit) * BigInt(gasPrice);
                
                transferAmount = (BigInt(balance) * transferPercentage / BigInt(100)) - gasCost;
                this.logger.info(`Using percentage (${transferPercentage}%) based transfer: ${this.blockchain.web3.utils.fromWei(transferAmount.toString(), 'ether')} ${currency}`);
            }

            if (transferAmount <= BigInt(0)) {
                this.logger.warn(`Balance too low to cover gas`);
                return true;
            }
            
            // Create and send transaction
            const txObject = {
                to: this.blockchain.address,
                value: transferAmount.toString(),
                data: '0x'
            };

            this.logger.info(`Sending transfer #${transferNum}/${totalTransfers} of ${this.blockchain.web3.utils.fromWei(transferAmount.toString(), 'ether')} ${currency} to self`);
            
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

    async transferToSelf(privateKey, walletNum = 0) {
        // Update wallet number and loggers
        this.walletNum = walletNum;
        this.logger = logger.getInstance(walletNum);
        this.configManager.setWalletNum(walletNum);
        
        if (!this.configManager.isEnabled('transfer')) {
            this.logger.warn(`Transfer disabled in config`);
            return true;
        }

        // Initialize blockchain manager for this wallet
        this.blockchain = new BlockchainManager(privateKey, this.configManager.config, walletNum);
        
        this.logger.header(`Starting token transfer operations...`);
        
        try {
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
                    const success = await this.executeTransfer(privateKey, walletNum, i, transferCount);
                    if (success) {
                        successCount++;
                        totalSuccess++;
                    }
                    
                    // Add delay between transfers if not the last one
                    if (i < transferCount) {
                        await addRandomDelay(this.configManager.getDelayConfig(), walletNum, `next transfer (${i+1}/${transferCount})`);
                    }
                }
                
                // Add delay between repeat cycles if not the last one
                if (r < repeatTimes - 1) {
                    this.logger.info(`Completed repeat cycle ${r+1}/${repeatTimes}`);
                    await addRandomDelay(this.configManager.getDelayConfig(), walletNum, `next repeat cycle (${r+2}/${repeatTimes})`);
                }
            }
            
            this.logger.success(`Self-transfer operations completed: ${totalSuccess}/${transferCount * repeatTimes} successful transfers`);
            return totalSuccess > 0;
        } catch (error) {
            this.logger.error(`Error in transfer operations: ${error.message}`);
            return false;
        }
    }
}

module.exports = TokenTransfer;