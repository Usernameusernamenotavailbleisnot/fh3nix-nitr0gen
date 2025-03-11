// index.js
const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const Logger = require('./src/utils/logger');
const ConfigManager = require('./src/managers/ConfigManager');
const { addRandomDelay } = require('./src/utils/delay');

// Import operation modules
const TokenTransfer = require('./src/operations/transfer');
const NormalContract = require('./src/operations/normalcontract');
const ERC20Token = require('./src/operations/erc20');
const NFT = require('./src/operations/nft');
const TestContract = require('./src/operations/testcontract');
const BatchOperation = require('./src/operations/batchoperation');
const Bridge = require('./src/operations/bridge');

// Initialize logger
const logger = new Logger();

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error(chalk.red('Unhandled Rejection at:'), promise, chalk.red('reason:'), reason);
    // Don't crash the process
});

// Load configuration from JSON
async function loadConfig() {
    try {
        const jsonExists = await fs.access('config.json').then(() => true).catch(() => false);
        if (jsonExists) {
            logger.success(`Found config.json`);
            const jsonContent = await fs.readFile('config.json', 'utf8');
            return JSON.parse(jsonContent);
        }
        
        logger.warn(`No configuration file found, using defaults`);
        // Return a default configuration with new structure
        return {
            operations: {
                bridge: {
                    enabled: false,
                    amount: {
                        min: 0.0001,
                        max: 0.0004,
                        decimals: 7
                    },
                    repeat_times: 1
                },
                transfer: {
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
                    repeat_times: 2
                },
                contract_deploy: {
                    enabled: true,
                    interactions: {
                        enabled: true,
                        count: {
                            min: 3,
                            max: 8
                        },
                        types: ["setValue", "increment", "decrement", "reset", "contribute"]
                    }
                },
                erc20: {
                    enabled: true,
                    mint_amount: {
                        min: 1000000,
                        max: 10000000
                    },
                    burn_percentage: 10,
                    decimals: 18
                },
                nft: {
                    enabled: true,
                    mint_count: {
                        min: 2,
                        max: 5
                    },
                    burn_percentage: 20,
                    supply: {
                        min: 100,
                        max: 500
                    }
                },
                contract_testing: {
                    enabled: true,
                    test_sequences: ["parameter_variation", "stress_test", "boundary_test"],
                    iterations: {
                        min: 2,
                        max: 3
                    }
                },
                batch_operations: {
                    enabled: true,
                    operations_per_batch: {
                        min: 2,
                        max: 3
                    }
                }
            },
            general: {
                gas_price_multiplier: 1.2,
                max_retries: 5,
                base_wait_time: 10,
                delay: {
                    min_seconds: 5,
                    max_seconds: 30
                }
            },
            randomization: {
                enable: true,
                excluded_operations: [],
                operations_to_run: ["bridge", "transfer", "contract_deploy", "contract_testing", "erc20", "nft", "batch_operations"]
            }
        };
    } catch (error) {
        logger.error(`Error loading configuration: ${error.message}`);
        // Return default configuration as fallback
        return {
            // Default configuration here (same as above)
            operations: {
                // ...
            },
            general: {
                // ...
            },
            randomization: {
                // ...
            }
        };
    }
}

// Load proxies from file
async function loadProxies() {
    try {
        const proxyFile = await fs.readFile('data/proxy.txt', 'utf8');
        const proxies = proxyFile.split('\n').map(line => line.trim()).filter(line => line);
        logger.success(`Successfully loaded ${proxies.length} proxies`);
        return proxies;
    } catch (error) {
        logger.warn(`data/proxy.txt not found, will not use proxies`);
        return [];
    }
}

// Countdown timer for waiting between batches
async function countdownTimer(hours = 8) {
    const totalSeconds = hours * 3600;
    let remainingSeconds = totalSeconds;

    while (remainingSeconds > 0) {
        const hours = Math.floor(remainingSeconds / 3600);
        const minutes = Math.floor((remainingSeconds % 3600) / 60);
        const seconds = remainingSeconds % 60;

        // Clear previous line and update countdown
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
        process.stdout.write(
            chalk.blue(`${logger.getTimestamp()} Next cycle in: `) + 
            chalk.yellow(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`)
        );

        await new Promise(resolve => setTimeout(resolve, 1000));
        remainingSeconds--;
    }

    // Clear the countdown line
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    logger.success(`Countdown completed!`);
}

// Execute bridge operation using Bridge module
async function executeBridgeOperation(pk, config, walletNum) {
    // Check if bridge is enabled in config
    const configManager = new ConfigManager(config);
    if (!configManager.isEnabled('bridge')) {
        logger.setWalletNum(walletNum);
        logger.warn(`Bridge operations disabled in config`);
        return false;
    }

    try {
        // Initialize bridge manager with wallet's private key and current config
        const bridgeManager = new Bridge(pk, config);
        bridgeManager.setWalletNum(walletNum);
        
        // Execute bridge operations
        await bridgeManager.executeBridgeOperations();
        
        // Add random delay after bridge operations
        await addRandomDelay(configManager.getDelayConfig(), walletNum, "next operation");
        
        return true;
    } catch (error) {
        logger.setWalletNum(walletNum);
        logger.error(`Error in bridge operations: ${error.message}`);
        return false;
    }
}

// Execute transfer operations
async function executeTransferOperation(tokenTransfer, pk, config, walletNum) {
    // Verify if transfer is enabled in config
    const configManager = new ConfigManager(config);
    if (!configManager.isEnabled('transfer')) {
        logger.setWalletNum(walletNum);
        logger.warn(`Transfer operations disabled in config`);
        return false;
    }
    
    let success = false;
    let attempt = 0;
    const maxRetries = configManager.get('general.max_retries', 5);
    
    while (!success && attempt < maxRetries) {
        logger.setWalletNum(walletNum);
        logger.header(`Running Transfer Operations for Wallet ${walletNum}`);
        logger.info(`Transferring tokens... (Attempt ${attempt + 1}/${maxRetries})`);
        
        // Transfer function already handles configuration internally
        success = await tokenTransfer.transferToSelf(pk, walletNum);
        
        if (!success) {
            attempt++;
            if (attempt < maxRetries) {
                const waitTime = Math.min(300, (configManager.get('general.base_wait_time', 10) * (2 ** attempt)));
                logger.warn(`Waiting ${waitTime} seconds before retry...`);
                await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
            }
        }
    }
    
    // Add random delay after transfer operations
    await addRandomDelay(configManager.getDelayConfig(), walletNum, "next operation");
    return success;
}

// Execute contract deployment operations
async function executeContractOperation(pk, config, walletNum) {
    const configManager = new ConfigManager(config);
    if (!configManager.isEnabled('contract_deploy')) {
        logger.setWalletNum(walletNum);
        logger.warn(`Contract deployment operations disabled in config`);
        return false;
    }
    
    try {
        logger.setWalletNum(walletNum);
        logger.header(`Running Contract Operations for Wallet ${walletNum}`);
        
        // Initialize contract deployer with wallet's private key and current config
        const contractDeployer = new NormalContract(pk, config);
        contractDeployer.setWalletNum(walletNum);
        
        // Execute contract operations (compile, deploy, interact)
        await contractDeployer.executeContractOperations();
        
        // Add random delay after contract operations
        await addRandomDelay(configManager.getDelayConfig(), walletNum, "next operation");
        
        return true;
    } catch (error) {
        logger.setWalletNum(walletNum);
        logger.error(`Error in contract operations: ${error.message}`);
        return false;
    }
}

// Execute ERC20 token operations
async function executeERC20Operation(pk, config, walletNum) {
    const configManager = new ConfigManager(config);
    if (!configManager.isEnabled('erc20')) {
        logger.setWalletNum(walletNum);
        logger.warn(`ERC20 token operations disabled in config`);
        return false;
    }
    
    try {
        logger.setWalletNum(walletNum);
        logger.header(`Running ERC20 Token Operations for Wallet ${walletNum}`);
        
        // Initialize ERC20 token deployer with wallet's private key and current config
        const erc20Deployer = new ERC20Token(pk, config);
        erc20Deployer.setWalletNum(walletNum);
        
        // Execute ERC20 token operations (compile, deploy, mint, burn)
        await erc20Deployer.executeTokenOperations();
        
        // Add random delay after ERC20 operations
        await addRandomDelay(configManager.getDelayConfig(), walletNum, "next operation");
        
        return true;
    } catch (error) {
        logger.setWalletNum(walletNum);
        logger.error(`Error in ERC20 token operations: ${error.message}`);
        return false;
    }
}

// Execute NFT operations
async function executeNFTOperation(pk, config, walletNum) {
    const configManager = new ConfigManager(config);
    if (!configManager.isEnabled('nft')) {
        logger.setWalletNum(walletNum);
        logger.warn(`NFT operations disabled in config`);
        return false;
    }
    
    try {
        logger.setWalletNum(walletNum);
        logger.header(`Running NFT Operations for Wallet ${walletNum}`);
        
        // Initialize NFT manager with wallet's private key and current config
        const nftManager = new NFT(pk, config);
        nftManager.setWalletNum(walletNum);
        
        // Execute NFT operations (compile, deploy, mint, burn)
        await nftManager.executeNFTOperations();
        
        // Add random delay after NFT operations
        await addRandomDelay(configManager.getDelayConfig(), walletNum, "completing wallet operations");
        
        return true;
    } catch (error) {
        logger.setWalletNum(walletNum);
        logger.error(`Error in NFT operations: ${error.message}`);
        return false;
    }
}

// Execute contract testing operations
async function executeContractTestingOperation(pk, config, walletNum) {
    const configManager = new ConfigManager(config);
    if (!configManager.isEnabled('contract_testing')) {
        logger.setWalletNum(walletNum);
        logger.warn(`Contract testing operations disabled in config`);
        return false;
    }
    
    try {
        logger.setWalletNum(walletNum);
        logger.header(`Running Contract Testing Operations for Wallet ${walletNum}`);
        
        // Initialize contract tester manager with wallet's private key and current config
        const contractTesterManager = new TestContract(pk, config);
        contractTesterManager.setWalletNum(walletNum);
        
        // Execute contract testing operations
        await contractTesterManager.executeContractTestingOperations();
        
        // Add random delay after contract testing operations
        await addRandomDelay(configManager.getDelayConfig(), walletNum, "next operation");
        
        return true;
    } catch (error) {
        logger.setWalletNum(walletNum);
        logger.error(`Error in contract testing operations: ${error.message}`);
        return false;
    }
}

// Execute batch operations
async function executeBatchOperation(pk, config, walletNum) {
    const configManager = new ConfigManager(config);
    if (!configManager.isEnabled('batch_operations')) {
        logger.setWalletNum(walletNum);
        logger.warn(`Batch operations disabled in config`);
        return false;
    }
    
    try {
        logger.setWalletNum(walletNum);
        logger.header(`Running Batch Operations for Wallet ${walletNum}`);
        
        // Initialize batch operation manager with wallet's private key and current config
        const batchOperationManager = new BatchOperation(pk, config);
        batchOperationManager.setWalletNum(walletNum);
        
        // Execute batch operations
        await batchOperationManager.executeBatchOperationOperations();
        
        // Add random delay after batch operations
        await addRandomDelay(configManager.getDelayConfig(), walletNum, "next operation");
        
        return true;
    } catch (error) {
        logger.setWalletNum(walletNum);
        logger.error(`Error in batch operations: ${error.message}`);
        return false;
    }
}

async function main() {
    while (true) {
        logger.header('Fhenix Nitrogen Testnet Automation Tool');

        try {
            // Load configuration
            const config = await loadConfig();
            logger.success(`Configuration loaded`);
            
            // Create config manager
            const configManager = new ConfigManager(config);
            
            // Load proxies
            const proxies = await loadProxies();
            
            // Load private keys
            const privateKeys = (await fs.readFile('data/pk.txt', 'utf8'))
                .split('\n')
                .map(line => line.trim())
                .filter(line => line);

            logger.success(`Found ${privateKeys.length} private keys`);
            logger.info(`Initializing automation...`);

            // Create instances of our modules
            const tokenTransfer = new TokenTransfer(config);

            // Process wallets
            logger.header(`Processing ${privateKeys.length} wallets...`);

            for (let i = 0; i < privateKeys.length; i++) {
                const walletNum = i + 1;
                const pk = privateKeys[i];

                logger.setWalletNum(walletNum);
                logger.header(`Processing Wallet ${walletNum}/${privateKeys.length}`);

                // Get random proxy if available
                const proxy = proxies.length > 0 ? 
                    proxies[Math.floor(Math.random() * proxies.length)] : null;
                
                if (proxy) {
                    logger.info(`Using proxy: ${proxy}`);
                }
                
                // Define all operations
                const allOperations = [
                    { name: "bridge", fn: executeBridgeOperation },
                    { name: "transfer", fn: executeTransferOperation },
                    { name: "contract_deploy", fn: executeContractOperation },
                    { name: "contract_testing", fn: executeContractTestingOperation },
                    { name: "erc20", fn: executeERC20Operation },
                    { name: "nft", fn: executeNFTOperation },
                    { name: "batch_operations", fn: executeBatchOperation }
                ];
                
                // Get randomized operations
                const operations = configManager.getRandomizedOperations(allOperations);
                
                // Log the operation sequence
                logger.info(`Operations sequence: ${operations.map(op => op.name).join(' -> ')}`);
                
                // Execute operations in the determined order
                for (const operation of operations) {
                    if (operation.name === "bridge") {
                        await operation.fn(pk, config, walletNum);
                    } else if (operation.name === "transfer") {
                        await operation.fn(tokenTransfer, pk, config, walletNum);
                    } else {
                        await operation.fn(pk, config, walletNum);
                    }
                }

                // Wait between wallets
                if (i < privateKeys.length - 1) {
                    const waitTime = Math.floor(Math.random() * 11) + 5; // 5-15 seconds
                    logger.warn(`Waiting ${waitTime} seconds before next wallet...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
                }
            }

            logger.header('Wallet processing completed! Starting 8-hour countdown...');

            // Start the countdown timer
            await countdownTimer(8);

        } catch (error) {
            console.error(chalk.red(`\nError: ${error.message}`));
            process.exit(1);
        }
    }
}

main().catch(console.error);