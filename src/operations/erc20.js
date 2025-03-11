const constants = require('../utils/constants');
const { addRandomDelay } = require('../utils/delay');
const BlockchainManager = require('../managers/BlockchainManager');
const ContractManager = require('../managers/ContractManager');
const ConfigManager = require('../managers/ConfigManager');
const Logger = require('../utils/logger');

class ERC20TokenDeployer {
    constructor(privateKey, config = {}) {
        // Default ERC20 configuration
        this.defaultConfig = {
            enable_erc20: true,
            mint_amount: {
                min: 1000000,
                max: 10000000
            },
            burn_percentage: 10,
            decimals: 18
        };
        
        // Initialize managers
        this.blockchain = new BlockchainManager(privateKey, config);
        this.configManager = new ConfigManager(config, { erc20: this.defaultConfig });
        this.contractManager = new ContractManager(this.blockchain, config);
        
        this.walletNum = null;
        this.logger = new Logger();
    }
    
    setWalletNum(num) {
        this.walletNum = num;
        this.blockchain.setWalletNum(num);
        this.contractManager.logger.setWalletNum(num);
        this.configManager.setWalletNum(num);
        this.logger.setWalletNum(num);
    }
    
    // Generate random token name and symbol
    generateRandomTokenName() {
        const prefix = constants.ERC20.TOKEN_NAME_PREFIXES[Math.floor(Math.random() * constants.ERC20.TOKEN_NAME_PREFIXES.length)];
        const suffix = constants.ERC20.TOKEN_NAME_SUFFIXES[Math.floor(Math.random() * constants.ERC20.TOKEN_NAME_SUFFIXES.length)];
        return `${prefix} ${suffix}`;
    }
    
    generateTokenSymbol(name) {
        const symbol = name.split(' ')
            .map(word => word.charAt(0).toUpperCase())
            .join('');
            
        if (symbol.length > 5) {
            return name.split(' ')[0].substring(0, 4).toUpperCase();
        }
        
        return symbol;
    }
    
    // Format token amount with decimals
    formatTokenAmount(amount, decimals) {
        return BigInt(amount) * BigInt(10) ** BigInt(decimals);
    }
    
    // Execute token operations
    async executeTokenOperations() {
        if (!this.configManager.isEnabled('erc20')) {
            this.logger.warn(`ERC20 token operations disabled in config`);
            return true;
        }
        
        this.logger.header(`Starting ERC20 token operations...`);
        
        try {
            // Reset blockchain manager nonce
            this.blockchain.resetNonce();
            
            // Generate random token name and symbol
            const tokenName = this.generateRandomTokenName();
            const symbol = this.generateTokenSymbol(tokenName);
            const decimals = this.configManager.get('operations.erc20.decimals', 
                            this.configManager.get('erc20.decimals', 18));
            
            this.logger.info(`Token: ${tokenName} (${symbol})`);
            this.logger.info(`Decimals: ${decimals}`);
            
            // Format contract name for Solidity
            const solContractName = tokenName.replace(/[^a-zA-Z0-9]/g, '');
            
            // Compile token contract
            const contractSource = constants.ERC20.CONTRACT_TEMPLATE.replace(/{{CONTRACT_NAME}}/g, solContractName);
            const compiledContract = await this.contractManager.compileContract(solContractName, contractSource);
            
            // Add random delay before deployment
            await addRandomDelay(this.configManager.getDelayConfig(), this.walletNum, "ERC20 contract deployment");
            
            // Deploy token contract
            const deployedContract = await this.contractManager.deployContract(
                compiledContract, 
                [tokenName, symbol, decimals],
                "ERC20 token"
            );
            
            // Determine mint amount
            const mintAmount = this.configManager.getRandomInRange('erc20', 'mint_amount', 1000000, 10000000);
            
            this.logger.info(`Will mint ${mintAmount.toLocaleString()} tokens...`);
            
            // Add random delay before minting
            await addRandomDelay(this.configManager.getDelayConfig(), this.walletNum, "token minting");
            
            // Format amount with decimals
            const formattedAmount = this.formatTokenAmount(mintAmount, decimals).toString();
            
            // Mint tokens
            const mintResult = await this.contractManager.callContractMethod(
                deployedContract.contractAddress,
                deployedContract.abi,
                'mint',
                [this.blockchain.address, formattedAmount]
            );
            
            if (mintResult.success) {
                this.logger.success(`Minted ${mintAmount.toLocaleString()} ${symbol} tokens`);
                
                // Determine burn amount based on config percentage
                const burnPercentage = this.configManager.get('operations.erc20.burn_percentage', 
                                      this.configManager.get('erc20.burn_percentage', 10));
                                      
                const burnAmount = Math.floor(mintAmount * burnPercentage / 100);
                
                if (burnAmount > 0) {
                    this.logger.info(`Burning ${burnAmount.toLocaleString()} tokens (${burnPercentage}% of minted)...`);
                    
                    // Add random delay before burning
                    await addRandomDelay(this.configManager.getDelayConfig(), this.walletNum, "token burning");
                    
                    // Format burn amount with decimals
                    const formattedBurnAmount = this.formatTokenAmount(burnAmount, decimals).toString();
                    
                    // Burn tokens
                    const burnResult = await this.contractManager.callContractMethod(
                        deployedContract.contractAddress,
                        deployedContract.abi,
                        'burn',
                        [formattedBurnAmount]
                    );
                    
                    if (burnResult.success) {
                        this.logger.success(`Burned ${burnAmount.toLocaleString()} ${symbol} tokens`);
                    } else {
                        this.logger.error(`Failed to burn tokens: ${burnResult.error}`);
                    }
                } else {
                    this.logger.info(`No tokens to burn (burn percentage: ${burnPercentage}%)`);
                }
            } else {
                this.logger.error(`Failed to mint tokens: ${mintResult.error}`);
            }
            
            this.logger.success(`ERC20 token operations completed!`);
            this.logger.success(`Contract address: ${deployedContract.contractAddress}`);
            this.logger.success(`Token: ${tokenName} (${symbol})`);
            this.logger.success(`View contract: ${constants.NETWORK.EXPLORER_URL}/address/${deployedContract.contractAddress}`);
            
            return true;
        } catch (error) {
            this.logger.error(`Error executing ERC20 token operations: ${error.message}`);
            return false;
        }
    }
}

module.exports = ERC20TokenDeployer;