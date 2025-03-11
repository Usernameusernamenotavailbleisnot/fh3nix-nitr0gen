// index.js
const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const logger = require('./src/utils/logger');
const { showBanner } = require('./src/utils/banner');
const { withErrorHandling } = require('./src/utils/errorHandler');

// Import operation registry
const OperationRegistry = require('./src/operations/OperationRegistry');

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error(chalk.red('Unhandled Rejection at:'), promise, chalk.red('reason:'), reason);
    // Don't crash the process
});

/**
 * Load configuration from JSON
 * @returns {Promise<Object>} Configuration object
 */
async function loadConfig() {
    try {
        const jsonExists = await fs.access('config.json').then(() => true).catch(() => false);
        if (jsonExists) {
            logger.success(`Found config.json`);
            const jsonContent = await fs.readFile('config.json', 'utf8');
            return JSON.parse(jsonContent);
        }
        
        logger.warn(`No configuration file found, using defaults`);
        return getDefaultConfig();
    } catch (error) {
        logger.error(`Error loading configuration: ${error.message}`);
        return getDefaultConfig();
    }
}

/**
 * Create default configuration
 * @returns {Object} Default configuration
 */
function getDefaultConfig() {
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
            contract_testing: {
                enabled: true,
                test_sequences: ["parameter_variation", "stress_test", "boundary_test"],
                iterations: {
                    min: 2,
                    max: 3
                }
            },
            random_contract: {
                enabled: true,
                max_gas: 3000000,
                repeat_times: 1
            },
            random_token: {
                enabled: true,
                max_gas: 3000000,
                supply: {
                    min: 1000000,
                    max: 10000000
                },
                repeat_times: 1
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
            operations_to_run: ["bridge", "transfer", "contract_deploy", "contract_testing", "erc20", "nft", "batch_operations", "random_contract", "random_token"]
        }
    };
}

/**
 * Load private keys from file
 * @returns {Promise<string[]>} Array of private keys
 */
async function loadPrivateKeys() {
    try {
        const pkFile = await fs.readFile('data/pk.txt', 'utf8');
        const privateKeys = pkFile.split('\n')
            .map(line => line.trim())
            .filter(line => line);
        
        logger.success(`Successfully loaded ${privateKeys.length} private keys`);
        return privateKeys;
    } catch (error) {
        logger.error(`Error loading private keys: ${error.message}`);
        throw new Error('Unable to load private keys. Make sure data/pk.txt exists.');
    }
}

/**
 * Load proxies from file
 * @returns {Promise<string[]>} Array of proxy strings
 */
async function loadProxies() {
    try {
        const proxyFile = await fs.readFile('data/proxy.txt', 'utf8');
        const proxies = proxyFile.split('\n')
            .map(line => line.trim())
            .filter(line => line);
        
        logger.success(`Successfully loaded ${proxies.length} proxies`);
        return proxies;
    } catch (error) {
        logger.warn(`data/proxy.txt not found, will not use proxies`);
        return [];
    }
}

/**
 * Select a random proxy from the array
 * @param {string[]} proxies - Array of proxy strings
 * @returns {string|null} Selected proxy or null if array is empty
 */
function selectRandomProxy(proxies) {
    if (!proxies || proxies.length === 0) return null;
    return proxies[Math.floor(Math.random() * proxies.length)];
}

/**
 * Execute operations for a wallet
 * @param {string} privateKey - Wallet private key
 * @param {Object} config - Configuration object
 * @param {number} walletNum - Wallet number
 * @returns {Promise<boolean>} Success status
 */
async function executeWalletOperations(privateKey, config, walletNum) {
    return withErrorHandling(async () => {
        const walletLogger = logger.getInstance(walletNum);
        
        // Initialize operation registry with all available operations
        const registry = new OperationRegistry(privateKey, config, walletNum);
        
        // Run all operations in optimized order
        return await registry.executeAll();
    }, {
        logger,
        walletNum,
        operationName: 'wallet operations',
        maxRetries: 0
    });
}

/**
 * Wait between processing wallets
 * @param {Object} walletLogger - Logger instance
 * @returns {Promise<void>}
 */
async function waitBetweenWallets(walletLogger) {
    const waitTime = Math.floor(Math.random() * 11) + 5; // 5-15 seconds
    walletLogger.warn(`Waiting ${waitTime} seconds before next wallet...`);
    await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
}

/**
 * Countdown timer for waiting between batches
 * @param {number} hours - Hours to countdown
 * @returns {Promise<void>}
 */
async function countdownTimer(hours = 8) {
    const totalSeconds = hours * 3600;
    let remainingSeconds = totalSeconds;
    
    // Reset logger to global/system context for countdown
    logger.setWalletNum(null);
    const countdownLogger = logger.getInstance();

    while (remainingSeconds > 0) {
        const hours = Math.floor(remainingSeconds / 3600);
        const minutes = Math.floor((remainingSeconds % 3600) / 60);
        const seconds = remainingSeconds % 60;

        // Clear previous line and update countdown
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
        process.stdout.write(
            chalk.blue(`${countdownLogger.getTimestamp()} Next cycle in: `) + 
            chalk.yellow(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`)
        );

        await new Promise(resolve => setTimeout(resolve, 1000));
        remainingSeconds--;
    }

    // Clear the countdown line
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    countdownLogger.success(`Countdown completed!`);
}

/**
 * Main application function
 */
async function main() {
    while (true) {
        // Start with global logger (no wallet context)
        logger.setWalletNum(null);
        
        // Show ASCII banner
        showBanner();

        try {
            // Load configuration and private keys
            const config = await loadConfig();
            const privateKeys = await loadPrivateKeys();
            const proxies = await loadProxies();
            
            logger.success(`Found ${privateKeys.length} private keys`);
            logger.info(`Initializing automation...`);

            // Process wallets
            logger.header(`Processing ${privateKeys.length} wallets...`);

            for (let i = 0; i < privateKeys.length; i++) {
                const walletNum = i + 1;
                const pk = privateKeys[i];
                
                logger.setWalletNum(walletNum);
                const walletLogger = logger.getInstance(walletNum);
                
                console.log(''); // Add newline for readability
                walletLogger.header(`Processing Wallet ${walletNum}/${privateKeys.length}`);

                // Select random proxy if available
                const proxy = selectRandomProxy(proxies);
                if (proxy) {
                    walletLogger.info(`Using proxy: ${proxy}`);
                }
                
                // Execute operations for this wallet
                await executeWalletOperations(pk, config, walletNum);

                // Wait between wallets if not the last one
                if (i < privateKeys.length - 1) {
                    await waitBetweenWallets(walletLogger);
                }
            }

            // Reset to global logger for completion message
            logger.setWalletNum(null);
            logger.header('Wallet processing completed! Starting 8-hour countdown...');

            // Start the countdown timer
            await countdownTimer(8);

        } catch (error) {
            console.error(`\nError: ${error.message}`);
            process.exit(1);
        }
    }
}

// Start the application
main().catch(console.error);