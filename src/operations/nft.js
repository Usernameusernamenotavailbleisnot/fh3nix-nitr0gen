// src/operations/nft.js
const constants = require('../utils/constants');
const crypto = require('crypto');
const BaseOperation = require('./BaseOperation');
const ContractManager = require('../managers/ContractManager');

/**
 * Manages NFT collection deployment and interaction
 * @extends BaseOperation
 */
class NFT extends BaseOperation {
    /**
     * Create a new NFT instance
     * 
     * @param {string} privateKey - Wallet private key
     * @param {Object} config - Configuration object
     */
    constructor(privateKey, config = {}) {
        // Define default config
        const defaultConfig = {
            enabled: true,
            mint_count: {
                min: 2,
                max: 10
            },
            burn_percentage: 20,
            supply: {
                min: 100,
                max: 1000
            }
        };
        
        // Initialize base class
        super(privateKey, config, 'nft');
        
        // Override default config
        this.defaultConfig = defaultConfig;
        
        // Initialize contract manager
        this.contractManager = new ContractManager(this.blockchain, config);
    }
    
    /**
     * Generate random NFT collection name
     * 
     * @returns {string} Random collection name
     */
    generateRandomNFTName() {
        const prefix = constants.NFT.NAME_PREFIXES[Math.floor(Math.random() * constants.NFT.NAME_PREFIXES.length)];
        const suffix = constants.NFT.NAME_SUFFIXES[Math.floor(Math.random() * constants.NFT.NAME_SUFFIXES.length)];
        return `${prefix} ${suffix}`;
    }
    
    /**
     * Generate NFT collection symbol from name
     * 
     * @param {string} name - Collection name
     * @returns {string} Collection symbol
     */
    generateRandomNFTSymbol(name) {
        // Create a symbol from the first letters of each word in the name
        return name.split(' ')
            .map(word => word.charAt(0).toUpperCase())
            .join('');
    }
    
    /**
     * Generate NFT metadata
     * 
     * @param {number} tokenId - Token ID
     * @param {string} collectionName - Collection name
     * @returns {string} Token metadata URI
     */
    generateTokenMetadata(tokenId, collectionName) {
        // Generate random attributes
        const rarities = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'];
        const rarity = rarities[Math.floor(Math.random() * rarities.length)];
        
        const categories = ['Art', 'Collectible', 'Game', 'Meme', 'PFP', 'Utility'];
        const category = categories[Math.floor(Math.random() * categories.length)];
        
        // Generate metadata
        const metadata = {
            name: `${collectionName} #${tokenId}`,
            description: `A unique NFT from the ${collectionName} collection.`,
            image: `https://i.seadn.io/s/raw/files/${crypto.randomBytes(16).toString('hex')}.png?auto=format&dpr=1&w=1920`,
            attributes: [
                {
                    trait_type: 'Rarity',
                    value: rarity
                },
                {
                    trait_type: 'Category',
                    value: category
                },
                {
                    trait_type: 'Token ID',
                    value: tokenId.toString()
                },
                {
                    trait_type: 'Generation',
                    value: 'Genesis'
                }
            ]
        };
        
        // Encode as a data URI
        return `data:application/json;base64,${Buffer.from(JSON.stringify(metadata)).toString('base64')}`;
    }
    
    /**
     * Implement the executeOperations method from BaseOperation
     * 
     * @returns {Promise<boolean>} Success status
     */
    async executeOperations() {
        try {
            // Generate random NFT collection name and symbol
            const collectionName = this.generateRandomNFTName();
            const symbol = this.generateRandomNFTSymbol(collectionName);
            
            // Generate random max supply
            const supply = this.configManager.getRandomInRange('nft', 'supply', 100, 1000);
            
            this.logger.info(`NFT Collection: ${collectionName} (${symbol})`);
            this.logger.info(`Max Supply: ${supply}`);
            
            // Format contract name for Solidity
            const solContractName = collectionName.replace(/[^a-zA-Z0-9]/g, '');
            
            // Compile NFT contract
            const contractSource = constants.NFT.CONTRACT_TEMPLATE.replace(/{{CONTRACT_NAME}}/g, solContractName);
            const compiledContract = await this.contractManager.compileContract(
                solContractName, 
                contractSource,
                'NFTContract.sol'
            );
            
            // Add random delay before deployment
            await this.addDelay("NFT contract deployment");
            
            // Deploy NFT contract
            const deployedContract = await this.contractManager.deployContract(
                compiledContract, 
                [collectionName, symbol, supply],
                "NFT collection"
            );
            
            // Mint and burn NFTs
            const mintedTokens = await this.mintNFTs(deployedContract, collectionName);
            await this.burnNFTs(deployedContract, mintedTokens);
            
            this.logger.success(`NFT operations completed successfully!`);
            this.logger.success(`Contract address: ${deployedContract.contractAddress}`);
            this.logger.success(`View collection: ${constants.NETWORK.EXPLORER_URL}/address/${deployedContract.contractAddress}`);
            
            return true;
        } catch (error) {
            this.logger.error(`Error executing NFT operations: ${error.message}`);
            return false;
        }
    }
    
    /**
     * Mint NFTs
     * 
     * @param {Object} deployedContract - Deployed contract info
     * @param {string} collectionName - Collection name
     * @returns {Promise<Array>} Array of minted token IDs
     */
    async mintNFTs(deployedContract, collectionName) {
        // Determine mint count based on config
        const mintCount = this.configManager.getRandomInRange('nft', 'mint_count', 2, 10);
        
        this.logger.info(`Will mint ${mintCount} NFTs...`);
        
        // Mint NFTs
        const mintedTokens = [];
        for (let i = 0; i < mintCount; i++) {
            const tokenId = i;
            const tokenURI = this.generateTokenMetadata(tokenId, collectionName);
            
            this.logger.info(`Minting token #${tokenId}...`);
            
            // Add random delay before minting
            await this.addDelay(`NFT minting (token #${tokenId})`);
            
            const mintResult = await this.contractManager.callContractMethod(
                deployedContract.contractAddress,
                deployedContract.abi,
                'mint',
                [this.blockchain.address, tokenId, tokenURI]
            );
            
            if (mintResult.success) {
                mintedTokens.push(tokenId);
                this.logger.success(`Token #${tokenId} minted successfully`);
            } else {
                this.logger.error(`Failed to mint token #${tokenId}: ${mintResult.error}`);
            }
        }
        
        return mintedTokens;
    }
    
    /**
     * Burn NFTs
     * 
     * @param {Object} deployedContract - Deployed contract info
     * @param {Array} mintedTokens - Array of minted token IDs
     * @returns {Promise<number>} Number of tokens burned
     */
    async burnNFTs(deployedContract, mintedTokens) {
        // Determine burn count based on config percentage
        const burnPercentage = this.configManager.getNumber('operations.nft.burn_percentage', 
                           this.configManager.getNumber('nft.burn_percentage', 20));
                           
        const burnCount = Math.ceil(mintedTokens.length * burnPercentage / 100);
        
        if (burnCount > 0 && mintedTokens.length > 0) {
            this.logger.info(`Burning ${burnCount} NFTs (${burnPercentage}% of minted)...`);
            
            // Randomly select tokens to burn
            const tokensToBurn = [...mintedTokens]
                .sort(() => Math.random() - 0.5) // Shuffle
                .slice(0, burnCount);
            
            let burnedCount = 0;
            for (const tokenId of tokensToBurn) {
                this.logger.info(`Burning token #${tokenId}...`);
                
                // Add random delay before burning
                await this.addDelay(`NFT burning (token #${tokenId})`);
                
                // Verify token ownership before burning
                const ownerResult = await this.contractManager.callViewMethod(
                    deployedContract.contractAddress,
                    deployedContract.abi,
                    'ownerOf',
                    [tokenId]
                );
                
                if (!ownerResult.success || ownerResult.result.toLowerCase() !== this.blockchain.address.toLowerCase()) {
                    this.logger.error(`Token #${tokenId} not owned by this wallet`);
                    continue;
                }
                
                const burnResult = await this.contractManager.callContractMethod(
                    deployedContract.contractAddress,
                    deployedContract.abi,
                    'burn',
                    [tokenId]
                );
                
                if (burnResult.success) {
                    this.logger.success(`Token #${tokenId} burned successfully`);
                    burnedCount++;
                } else {
                    this.logger.error(`Failed to burn token #${tokenId}: ${burnResult.error}`);
                }
            }
            
            return burnedCount;
        } else {
            this.logger.info(`No tokens to burn (burn percentage: ${burnPercentage}%)`);
            return 0;
        }
    }
}

module.exports = NFT;