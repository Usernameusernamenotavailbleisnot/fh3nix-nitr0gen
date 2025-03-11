// src/managers/BlockchainManager.js
const { Web3 } = require('web3');
const constants = require('../utils/constants');
const logger = require('../utils/logger');

class BlockchainManager {
    constructor(privateKey, config = {}, walletNum = null) {
        // Initialize web3 connection
        this.rpcUrl = constants.NETWORK.RPC_URL;
        this.web3 = new Web3(this.rpcUrl);
        
        // For bridging, we need Sepolia connection too
        this.sepoliaWeb3 = new Web3(constants.SEPOLIA.RPC_URL);
        
        // Setup account from private key
        if (privateKey && !privateKey.startsWith('0x')) {
            privateKey = '0x' + privateKey;
        }
        
        if (privateKey) {
            this.account = this.web3.eth.accounts.privateKeyToAccount(privateKey);
            this.address = this.account.address;
            this.privateKey = privateKey;
        }
        
        this.walletNum = walletNum;
        this.config = config;
        
        // Add nonce tracking
        this.currentNonce = null;
        this.sepoliaNonce = null;
        
        // Use shared logger
        this.logger = walletNum !== null ? logger.getInstance(walletNum) : logger.getInstance();
    }
    
    // Helper method to safely stringify objects that might contain BigInt values
    safeStringify(obj) {
        return JSON.stringify(obj, (key, value) => 
            typeof value === 'bigint' ? value.toString() : value
        );
    }
    
    setWalletNum(num) {
        this.walletNum = num;
        this.logger = logger.getInstance(num);
    }
    
    // Get the next nonce, considering pending transactions
    async getNonce(network = 'fhenix') {
        if (network === 'sepolia') {
            if (this.sepoliaNonce === null) {
                // If this is the first transaction, get the nonce from the network
                this.sepoliaNonce = await this.sepoliaWeb3.eth.getTransactionCount(this.address);
                this.logger.info(`Initial Sepolia nonce from network: ${this.sepoliaNonce}`);
            } else {
                // For subsequent transactions, use the tracked nonce
                this.logger.info(`Using tracked Sepolia nonce: ${this.sepoliaNonce}`);
            }
            return this.sepoliaNonce;
        } else {
            if (this.currentNonce === null) {
                // If this is the first transaction, get the nonce from the network
                this.currentNonce = await this.web3.eth.getTransactionCount(this.address);
                this.logger.info(`Initial nonce from network: ${this.currentNonce}`);
            } else {
                // For subsequent transactions, use the tracked nonce
                this.logger.info(`Using tracked nonce: ${this.currentNonce}`);
            }
            return this.currentNonce;
        }
    }
    
    // Update nonce after a transaction is sent
    incrementNonce(network = 'fhenix') {
        if (network === 'sepolia') {
            if (this.sepoliaNonce !== null) {
                this.sepoliaNonce++;
                this.logger.info(`Incremented Sepolia nonce to: ${this.sepoliaNonce}`);
            }
        } else {
            if (this.currentNonce !== null) {
                this.currentNonce++;
                this.logger.info(`Incremented nonce to: ${this.currentNonce}`);
            }
        }
    }
    
    // Enhanced gas price calculation with retries
    async getGasPrice(retryCount = 0, network = 'fhenix') {
        try {
            const web3Instance = network === 'sepolia' ? this.sepoliaWeb3 : this.web3;
            const networkName = network === 'sepolia' ? 'Sepolia' : 'Fhenix';
            
            // Get the current gas price from the network
            const networkGasPrice = await web3Instance.eth.getGasPrice();
            
            // Apply base multiplier from config - use global gas_price_multiplier or fallback to constants
            let multiplier = (this.config.general && this.config.general.gas_price_multiplier) || constants.GAS.PRICE_MULTIPLIER;
            
            // Apply additional multiplier for retries
            if (retryCount > 0) {
                const retryMultiplier = Math.pow(constants.GAS.RETRY_INCREASE, retryCount);
                multiplier *= retryMultiplier;
                this.logger.info(`Applying retry multiplier: ${retryMultiplier.toFixed(2)}x (total: ${multiplier.toFixed(2)}x)`);
            }
            
            // Calculate gas price with multiplier
            const adjustedGasPrice = BigInt(Math.floor(Number(networkGasPrice) * multiplier));
            
            // Convert to gwei for display
            const gweiPrice = web3Instance.utils.fromWei(adjustedGasPrice.toString(), 'gwei');
            this.logger.info(`${networkName} gas price: ${web3Instance.utils.fromWei(networkGasPrice, 'gwei')} gwei, using: ${gweiPrice} gwei (${multiplier.toFixed(2)}x)`);
            
            // Enforce min/max gas price in gwei
            const minGasPrice = BigInt(web3Instance.utils.toWei(constants.GAS.MIN_GWEI.toString(), 'gwei'));
            const maxGasPrice = BigInt(web3Instance.utils.toWei(constants.GAS.MAX_GWEI.toString(), 'gwei'));
            
            // Ensure gas price is within bounds
            let finalGasPrice = adjustedGasPrice;
            if (adjustedGasPrice < minGasPrice) {
                finalGasPrice = minGasPrice;
                this.logger.warn(`Gas price below minimum, using: ${constants.GAS.MIN_GWEI} gwei`);
            } else if (adjustedGasPrice > maxGasPrice) {
                finalGasPrice = maxGasPrice;
                this.logger.warn(`Gas price above maximum, using: ${constants.GAS.MAX_GWEI} gwei`);
            }
            
            return finalGasPrice.toString();
        } catch (error) {
            this.logger.warn(`Error getting gas price: ${error.message}`);
            
            // Fallback to a low gas price
            const web3Instance = network === 'sepolia' ? this.sepoliaWeb3 : this.web3;
            const fallbackGasPrice = web3Instance.utils.toWei(constants.GAS.MIN_GWEI.toString(), 'gwei');
            this.logger.warn(`Using fallback gas price: ${constants.GAS.MIN_GWEI} gwei`);
            
            return fallbackGasPrice;
        }
    }
    
    // Improved gas estimation with buffer
    async estimateGas(txObject, network = 'fhenix') {
        try {
            const web3Instance = network === 'sepolia' ? this.sepoliaWeb3 : this.web3;
            
            // Get the gas estimate from the blockchain
            const estimatedGas = await web3Instance.eth.estimateGas(txObject);
            
            // Add 20% buffer for safety
            const gasWithBuffer = Math.floor(Number(estimatedGas) * 1.2);
            
            this.logger.info(`Estimated gas: ${estimatedGas}, with buffer: ${gasWithBuffer}`);
            
            return gasWithBuffer;
        } catch (error) {
            // Extract and log detailed error info
            const errorDetails = {
                message: error.message,
                code: error.code || 'unknown',
                data: error.data || 'no data',
                reason: error.reason || 'unknown reason'
            };
            
            this.logger.warn(`Gas estimation failed: ${error.message}`);
            
            // Use default gas
            const defaultGas = constants.GAS.DEFAULT_GAS;
            this.logger.warn(`Using default gas: ${defaultGas}`);
            return defaultGas;
        }
    }
    
    // Unified method to send a transaction
    async sendTransaction(txObject, methodName = "transaction", network = 'fhenix') {
        try {
            const web3Instance = network === 'sepolia' ? this.sepoliaWeb3 : this.web3;
            const chainId = network === 'sepolia' ? constants.SEPOLIA.CHAIN_ID : constants.NETWORK.CHAIN_ID;
            const explorerUrl = network === 'sepolia' ? constants.SEPOLIA.EXPLORER_URL : constants.NETWORK.EXPLORER_URL;
            
            // Get nonce and gas price
            const nonce = await this.getNonce(network);
            const gasPrice = await this.getGasPrice(0, network);
            
            // Create transaction template for gas estimation
            const txTemplate = {
                from: this.address,
                ...txObject,
                nonce: nonce,
                chainId: chainId
            };
            
            // Estimate gas
            const gasLimit = await this.estimateGas(txTemplate, network);
            
            // Create final transaction object
            const tx = {
                ...txTemplate,
                gas: gasLimit,
                gasPrice: gasPrice
            };
            
            // Sign the transaction (less verbose logging)
            const signedTx = await web3Instance.eth.accounts.signTransaction(tx, this.privateKey);
            
            // Increment nonce before sending
            this.incrementNonce(network);
            
            // Send the transaction (less verbose logging)
            const receipt = await web3Instance.eth.sendSignedTransaction(signedTx.rawTransaction);
            
            // Simplified logging - just log success without transaction details
            // Operation-specific classes will log more details as needed
            this.logger.success(`${methodName} transaction successful`);
            
            return {
                txHash: receipt.transactionHash,
                receipt,
                success: true
            };
        } catch (error) {
            // Extract and log detailed error info
            const errorDetails = {
                message: error.message,
                code: error.code || 'unknown',
                data: error.data || 'no data',
                reason: error.reason || 'unknown reason'
            };
            
            this.logger.error(`Error in ${methodName} transaction: ${error.message}`);
            
            return {
                success: false,
                error: error.message,
                details: errorDetails
            };
        }
    }
    
    // Get balance
    async getBalance(network = 'fhenix') {
        try {
            const web3Instance = network === 'sepolia' ? this.sepoliaWeb3 : this.web3;
            const currency = network === 'sepolia' ? 'ETH' : constants.NETWORK.CURRENCY_SYMBOL;
            
            const balance = await web3Instance.eth.getBalance(this.address);
            const balanceInEth = web3Instance.utils.fromWei(balance, 'ether');
            
            this.logger.info(`${network.charAt(0).toUpperCase() + network.slice(1)} Balance: ${balanceInEth} ${currency}`);
            
            return { 
                balance, 
                balanceInEth,
                currency
            };
        } catch (error) {
            this.logger.error(`Error getting balance: ${error.message}`);
            return {
                balance: '0',
                balanceInEth: '0',
                currency: network === 'sepolia' ? 'ETH' : constants.NETWORK.CURRENCY_SYMBOL,
                error: error.message
            };
        }
    }
    
    // Reset nonce tracking (useful at the start of a new operation sequence)
    resetNonce(network = 'fhenix') {
        if (network === 'sepolia') {
            this.sepoliaNonce = null;
        } else {
            this.currentNonce = null;
        }
    }
}

module.exports = BlockchainManager;