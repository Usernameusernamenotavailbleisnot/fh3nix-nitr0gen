# fh3nix nitr0gen Testnet Automation Tool

An automation tool designed to perform various blockchain operations on the fh3nix nitr0gen Testnet, helping users participate in testnet activities, build transaction history, and test network functionality.

## Features

- **Token Transfers**: Automated self-transfers with configurable amounts and frequency
- **Smart Contract Deployment**: Deploy sample contracts and interact with them
- **ERC20 Token Operations**: Create and manage custom ERC20 tokens
- **NFT Operations**: Mint and manage NFT collections
- **Contract Testing**: Run various test sequences on deployed contracts
- **Batch Operations**: Execute multiple operations as a batch
- **Bridge Operations**: Transfer assets between Sepolia and fh3nix networks
- **Randomized Operations**: Configure which operations to randomize for each wallet
- **Multi-wallet Support**: Process multiple private keys in sequence

## Installation

### Prerequisites

- Node.js (v14+)
- npm or yarn

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/Usernameusernamenotavailbleisnot/fh3nix-nitr0gen.git
   cd fh3nix-nitr0gen
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create necessary data files:

   Create a `data` directory:
   ```bash
   mkdir -p data
   ```

   Add your private keys to `data/pk.txt` (one private key per line):
   ```
   0x123abc...
   0x456def...
   ```
   
   (Optional) Add proxies to `data/proxy.txt` (one proxy per line):
   ```
   http://username:password@proxy.example.com:port
   ```

## Configuration

The tool uses a `config.json` file to control behavior. A default configuration is provided, but you can customize it according to your needs.

### Configuration Structure

```json
{
  "operations": {
    "bridge": {
      "enabled": false,
      "amount": {
        "min": 0.0001,
        "max": 0.0004,
        "decimals": 7
      },
      "repeat_times": 1
    },
    "transfer": {
      "enabled": true,
      "use_percentage": true,
      "percentage": 90,
      "fixed_amount": {
        "min": 0.001,
        "max": 0.002,
        "decimals": 5
      },
      "count": {
        "min": 2,
        "max": 3
      },
      "repeat_times": 2
    },
    "contract_deploy": {
      "enabled": true,
      "interactions": {
        "enabled": true,
        "count": {
          "min": 3,
          "max": 8
        },
        "types": ["setValue", "increment", "decrement", "reset", "contribute"]
      }
    },
    "contract_testing": {
      "enabled": true,
      "test_sequences": ["parameter_variation", "stress_test", "boundary_test"],
      "iterations": {
        "min": 2,
        "max": 3
      }
    },
    "random_contract": {
      "enabled": true,
      "max_gas": 3000000,
      "repeat_times": 1
    },
    "random_token": {
      "enabled": true,
      "max_gas": 3000000,
      "supply": {
        "min": 1000000,
        "max": 10000000
      },
      "repeat_times": 1
    },
    "erc20": {
      "enabled": true,
      "mint_amount": {
        "min": 1000000,
        "max": 10000000
      },
      "burn_percentage": 10,
      "decimals": 18
    },
    "nft": {
      "enabled": true,
      "mint_count": {
        "min": 2,
        "max": 5
      },
      "burn_percentage": 20,
      "supply": {
        "min": 100,
        "max": 500
      }
    },
    "batch_operations": {
      "enabled": true,
      "operations_per_batch": {
        "min": 2,
        "max": 3
      }
    }
  },
  "general": {
    "gas_price_multiplier": 1,
    "max_retries": 1,
    "base_wait_time": 1,
    "delay": {
      "min_seconds": 1,
      "max_seconds": 1
    }
  },
  "randomization": {
    "enable": true,
    "excluded_operations": ["bridge"],
    "operations_to_run": ["bridge", "transfer", "contract_deploy", "contract_testing", "erc20", "nft", "batch_operations", "random_contract", "random_token"]
  }
}
```

### Configuration Options

#### Operations Configuration

Each operation has the following common properties:
- `enabled`: Whether the operation is enabled
- Various operation-specific settings

#### General Configuration

- `gas_price_multiplier`: Multiplier for gas price
- `max_retries`: Maximum number of retries for failed operations
- `base_wait_time`: Base wait time in seconds between retries
- `delay`: Configuration for random delays between operations

#### Randomization Configuration

- `enable`: Whether to randomize the order of operations
- `excluded_operations`: Operations that should not be randomized (executed first)
- `operations_to_run`: List of operations to run

## Usage

Run the tool using:

```bash
npm start
```

The tool will:
1. Load configuration from `config.json`
2. Load private keys from `data/pk.txt`
3. (Optional) Load proxies from `data/proxy.txt`
4. Process each wallet in sequence, executing the configured operations
5. Wait 8 hours before starting the next cycle

## Operation Types

### Token Transfer

Transfers tokens from a wallet to itself. Configurable to use either a percentage of available balance or a fixed amount.

### Contract Deployment

Deploys a sample interactive contract and performs various interactions like setting values, incrementing, decrementing, and contributing small amounts.

### ERC20 Token Operations

Creates a custom ERC20 token with random name and symbol, mints tokens, and optionally burns a percentage of them.

### NFT Operations

Creates an NFT collection, mints a configurable number of NFTs, and optionally burns a percentage of them.

### Contract Testing

Deploys a contract specifically for testing and runs various test sequences:
- Parameter variation tests
- Stress tests
- Boundary tests

### Batch Operations

Deploys a batch processor contract and executes multiple operations in a single transaction.

### Bridge Operations

Transfers tokens from Sepolia to fh3nix network using the bridge contract.

## Project Structure

- `index.js`: Main entry point
- `config.json`: Configuration file
- `data/`: Directory for private keys and proxies
- `src/`
  - `managers/`: Core functionality managers
    - `BlockchainManager.js`: Manages blockchain interactions
    - `ConfigManager.js`: Manages configuration
    - `ContractManager.js`: Manages contract operations
  - `operations/`: Operation-specific modules
    - `transfer.js`: Token transfer operations
    - `normalcontract.js`: Contract deployment and interaction
    - `erc20.js`: ERC20 token operations
    - `nft.js`: NFT operations
    - `testcontract.js`: Contract testing operations
    - `batchoperation.js`: Batch operations
    - `bridge.js`: Bridge operations
  - `utils/`: Utility functions
    - `logger.js`: Logging functionality
    - `constants.js`: Constant values
    - `delay.js`: Handling delays between operations
    - `banner.js`: ASCII banner display

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Disclaimer

This tool is for educational and testing purposes only. Please use responsibly and in accordance with the terms of service of the networks you interact with.
