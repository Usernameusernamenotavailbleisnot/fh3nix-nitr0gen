// index.js
const fs = require('fs').promises;
const chalk = require('chalk');
const ora = require('ora');
const path = require('path');
const crypto = require('crypto');
const _ = require('lodash');

// Import modules - will update these imports later for file renaming
const TokenTransfer = require('./src/transfer');
const NormalContract = require('./src/normalcontract');
const ERC20Token = require('./src/erc20');
const NFT = require('./src/nft');
const TestContract = require('./src/testcontract');
const BatchOperation = require('./src/batchoperation');
const Bridge = require('./src/bridge');
const constants = require('./utils/constants');
const { addRandomDelay, getTimestamp } = require('./utils/delay');

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't crash the process
});

// Load configuration from JSON
async function loadConfig() {
    try {
        const jsonExists = await fs.access('config.json').then(() => true).catch(() => false);
        if (jsonExists) {
            console.log(chalk.green(`${getTimestamp()} ✓ Found config.json`));
            const jsonContent = await fs.readFile('config.json', 'utf8');
            return JSON.parse(jsonContent);
        }
        
        console.log(chalk.yellow(`${getTimestamp()} ⚠ No configuration file found, using defaults`));
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
                gas_price_multiplier: constants.GAS.PRICE_MULTIPLIER,
                max_retries: 5,
                base_wait_time: 10,
                delay: {
                    min_seconds: constants.DELAY.MIN_SECONDS,
                    max_seconds: constants.DELAY.MAX_SECONDS
                }
            },
            randomization: {
                enable: true,
                excluded_operations: [],
                operations_to_run: ["bridge", "transfer", "contract_deploy", "contract_testing", "erc20", "nft", "batch_operations"]
            }
        };
    } catch (error) {
        console.log(chalk.red(`${getTimestamp()} ✗ Error loading configuration: ${error.message}`));
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
                gas_price_multiplier: constants.GAS.PRICE_MULTIPLIER,
                max_retries: 5,
                base_wait_time: 10,
                delay: {
                    min_seconds: constants.DELAY.MIN_SECONDS,
                    max_seconds: constants.DELAY.MAX_SECONDS
                }
            },
            randomization: {
                enable: true,
                excluded_operations: [],
                operations_to_run: ["bridge", "transfer", "contract_deploy", "contract_testing", "erc20", "nft", "batch_operations"]
            }
        };
    }
}

// Load proxies from file
async function loadProxies() {
    try {
        const proxyFile = await fs.readFile('proxy.txt', 'utf8');
        const proxies = proxyFile.split('\n').map(line => line.trim()).filter(line => line);
        console.log(chalk.green(`${getTimestamp()} ✓ Successfully loaded ${proxies.length} proxies`));
        return proxies;
    } catch (error) {
        console.log(chalk.yellow(`${getTimestamp()} ⚠ proxy.txt not found, will not use proxies`));
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
            chalk.blue(`${getTimestamp()} Next cycle in: `) + 
            chalk.yellow(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`)
        );

        await new Promise(resolve => setTimeout(resolve, 1000));
        remainingSeconds--;
    }

    // Clear the countdown line
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    console.log(chalk.green(`${getTimestamp()} ✓ Countdown completed!`));
}

// Execute bridge operations - updated for new config structure
async function executeBridgeOperation(pk, config, walletNum) {
    // Check if bridge is enabled in config
    if (config.operations?.bridge?.enabled) {
        try {
            console.log(chalk.blue.bold(`\n=== Running Bridge Operations for Wallet ${walletNum} ===\n`));
            
            // Initialize bridge manager with wallet's private key and current config
            const bridgeManager = new Bridge(pk, config);
            bridgeManager.setWalletNum(walletNum);
            
            // Execute bridge operations
            await bridgeManager.executeBridgeOperations();
            
            // Add random delay after bridge operations
            await addRandomDelay(config.general, walletNum, "next operation");
            
            return true;
        } catch (error) {
            console.log(chalk.red(`${getTimestamp(walletNum)} ✗ Error in bridge operations: ${error.message}`));
            return false;
        }
    } else {
        console.log(chalk.yellow(`${getTimestamp(walletNum)} ⚠ Bridge operations disabled in config`));
        return false;
    }
}

// Execute transfer operations - updated for new config structure
async function executeTransferOperation(tokenTransfer, pk, config, walletNum) {
    if (config.operations?.transfer?.enabled) {
        let success = false;
        let attempt = 0;
        
        while (!success && attempt < (config.general?.max_retries || 5)) {
            console.log(chalk.blue.bold(`\n=== Running Transfer Operations for Wallet ${walletNum} ===\n`));
            console.log(chalk.blue.bold(`${getTimestamp(walletNum)} Transferring tokens... (Attempt ${attempt + 1}/${config.general?.max_retries || 5})`));
            success = await tokenTransfer.transferToSelf(pk, walletNum);
            
            if (!success) {
                attempt++;
                if (attempt < (config.general?.max_retries || 5)) {
                    const waitTime = Math.min(300, (config.general?.base_wait_time || 10) * (2 ** attempt));
                    console.log(chalk.yellow(`${getTimestamp(walletNum)} Waiting ${waitTime} seconds before retry...`));
                    await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
                }
            }
        }
        
        // Add random delay after transfer operations
        await addRandomDelay(config.general, walletNum, "next operation");
        return success;
    }
    return false;
}

// Execute contract deployment operations - updated for new config structure
async function executeContractOperation(pk, config, walletNum) {
    if (config.operations?.contract_deploy?.enabled) {
        try {
            console.log(chalk.blue.bold(`\n=== Running Contract Operations for Wallet ${walletNum} ===\n`));
            
            // Initialize contract deployer with wallet's private key and current config
            const contractDeployer = new NormalContract(pk, config);
            contractDeployer.setWalletNum(walletNum);
            
            // Execute contract operations (compile, deploy, interact)
            await contractDeployer.executeContractOperations();
            
            // Add random delay after contract operations
            await addRandomDelay(config.general, walletNum, "next operation");
            
            return true;
        } catch (error) {
            console.log(chalk.red(`${getTimestamp(walletNum)} ✗ Error in contract operations: ${error.message}`));
            return false;
        }
    }
    return false;
}

// Execute ERC20 token operations - updated for new config structure
async function executeERC20Operation(pk, config, walletNum) {
    if (config.operations?.erc20?.enabled) {
        try {
            console.log(chalk.blue.bold(`\n=== Running ERC20 Token Operations for Wallet ${walletNum} ===\n`));
            
            // Initialize ERC20 token deployer with wallet's private key and current config
            const erc20Deployer = new ERC20Token(pk, config);
            erc20Deployer.setWalletNum(walletNum);
            
            // Execute ERC20 token operations (compile, deploy, mint, burn)
            await erc20Deployer.executeTokenOperations();
            
            // Add random delay after ERC20 operations
            await addRandomDelay(config.general, walletNum, "next operation");
            
            return true;
        } catch (error) {
            console.log(chalk.red(`${getTimestamp(walletNum)} ✗ Error in ERC20 token operations: ${error.message}`));
            return false;
        }
    }
    return false;
}

// Execute NFT operations - updated for new config structure
async function executeNFTOperation(pk, config, walletNum) {
    if (config.operations?.nft?.enabled) {
        try {
            console.log(chalk.blue.bold(`\n=== Running NFT Operations for Wallet ${walletNum} ===\n`));
            
            // Initialize NFT manager with wallet's private key and current config
            const nftManager = new NFT(pk, config);
            nftManager.setWalletNum(walletNum);
            
            // Execute NFT operations (compile, deploy, mint, burn)
            await nftManager.executeNFTOperations();
            
            // Add random delay after NFT operations
            await addRandomDelay(config.general, walletNum, "completing wallet operations");
            
            return true;
        } catch (error) {
            console.log(chalk.red(`${getTimestamp(walletNum)} ✗ Error in NFT operations: ${error.message}`));
            return false;
        }
    }
    return false;
}

// Execute contract testing operations - updated for new config structure
async function executeContractTestingOperation(pk, config, walletNum) {
    if (config.operations?.contract_testing?.enabled) {
        try {
            console.log(chalk.blue.bold(`\n=== Running Contract Testing Operations for Wallet ${walletNum} ===\n`));
            
            // Initialize contract tester manager with wallet's private key and current config
            const contractTesterManager = new TestContract(pk, config);
            contractTesterManager.setWalletNum(walletNum);
            
            // Execute contract testing operations
            await contractTesterManager.executeContractTestingOperations();
            
            // Add random delay after contract testing operations
            await addRandomDelay(config.general, walletNum, "next operation");
            
            return true;
        } catch (error) {
            console.log(chalk.red(`${getTimestamp(walletNum)} ✗ Error in contract testing operations: ${error.message}`));
            return false;
        }
    }
    return false;
}

// Execute batch operations - updated for new config structure
async function executeBatchOperation(pk, config, walletNum) {
    if (config.operations?.batch_operations?.enabled) {
        try {
            console.log(chalk.blue.bold(`\n=== Running Batch Operations for Wallet ${walletNum} ===\n`));
            
            // Initialize batch operation manager with wallet's private key and current config
            const batchOperationManager = new BatchOperation(pk, config);
            batchOperationManager.setWalletNum(walletNum);
            
            // Execute batch operations
            await batchOperationManager.executeBatchOperationOperations();
            
            // Add random delay after batch operations
            await addRandomDelay(config.general, walletNum, "next operation");
            
            return true;
        } catch (error) {
            console.log(chalk.red(`${getTimestamp(walletNum)} ✗ Error in batch operations: ${error.message}`));
            return false;
        }
    }
    return false;
}

// Randomize operations order - updated for new config structure
function getRandomizedOperations(config) {
    const randomizationConfig = config.randomization || { 
        enable: false, 
        excluded_operations: [],
        operations_to_run: ["bridge", "transfer", "contract_deploy", "contract_testing", "erc20", "nft", "batch_operations"]
    };
    
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
    
    // Filter operations based on operations_to_run config
    const operationsToRun = randomizationConfig.operations_to_run || 
        ["bridge", "transfer", "contract_deploy", "contract_testing", "erc20", "nft", "batch_operations"];
    
    const filteredOperations = allOperations.filter(op => operationsToRun.includes(op.name));
    
    // Split operations into fixed and randomizable based on excluded_operations
    const excludedOps = randomizationConfig.excluded_operations || [];
    const fixedOps = filteredOperations.filter(op => excludedOps.includes(op.name));
    const randomizableOps = filteredOperations.filter(op => !excludedOps.includes(op.name));
    
    // Randomize operations if enabled
    if (randomizationConfig.enable && randomizableOps.length > 1) {
        // Fisher-Yates shuffle algorithm
        for (let i = randomizableOps.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [randomizableOps[i], randomizableOps[j]] = [randomizableOps[j], randomizableOps[i]];
        }
    }
    
    // Return operations in order: fixed operations first, then randomized operations
    return [...fixedOps, ...randomizableOps];
}

async function main() {
    while (true) {
        console.log(chalk.blue.bold('\n=== Fhenix Nitrogen Testnet Automation Tool ===\n'));

        try {
            // Load configuration
            const config = await loadConfig();
            console.log(chalk.green(`${getTimestamp()} ✓ Configuration loaded`));
            
            // Load proxies
            const proxies = await loadProxies();
            
            // Load private keys
            const privateKeys = (await fs.readFile('pk.txt', 'utf8'))
                .split('\n')
                .map(line => line.trim())
                .filter(line => line);

            console.log(chalk.green(`${getTimestamp()} ✓ Found ${privateKeys.length} private keys`));
            
            console.log(chalk.blue.bold(`${getTimestamp()} Initializing automation...`));

            // Create instances of our modules
            const tokenTransfer = new TokenTransfer(config);

            // Process wallets
            console.log(chalk.blue.bold(`\nProcessing ${privateKeys.length} wallets...\n`));

            for (let i = 0; i < privateKeys.length; i++) {
                const walletNum = i + 1;
                const pk = privateKeys[i];

                console.log(chalk.blue.bold(`\n=== Processing Wallet ${walletNum}/${privateKeys.length} ===\n`));

                // Get random proxy if available
                const proxy = proxies.length > 0 ? 
                    proxies[Math.floor(Math.random() * proxies.length)] : null;
                
                if (proxy) {
                    console.log(chalk.cyan(`${getTimestamp(walletNum)} ℹ Using proxy: ${proxy}`));
                }
                
                // Create a Web3 account from the private key to get the address
                const { Web3 } = require('web3');
                const web3 = new Web3();
                const account = web3.eth.accounts.privateKeyToAccount(pk.startsWith('0x') ? pk : '0x' + pk);
                const walletAddress = account.address;
                
                // Get randomized operations
                const operations = getRandomizedOperations(config);
                
                // Log the operation sequence
                console.log(chalk.cyan(`${getTimestamp(walletNum)} ℹ Operations sequence: ${operations.map(op => op.name).join(' -> ')}`));
                
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
                    console.log(chalk.yellow(`\n${getTimestamp(walletNum)} Waiting ${waitTime} seconds before next wallet...\n`));
                    await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
                }
            }

            console.log(chalk.green.bold('\nWallet processing completed! Starting 8-hour countdown...\n'));

            // Start the countdown timer
            await countdownTimer(8);

        } catch (error) {
            console.error(chalk.red(`\nError: ${error.message}`));
            process.exit(1);
        }
    }
}

main().catch(console.error);