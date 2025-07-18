import fs from 'fs';
import path from 'path';
import { TokenMetadata } from './chunking';

/**
 * Load token metadata from JSON file
 */
export async function loadTokensFromFile(filePath: string): Promise<TokenMetadata[]> {
  try {
    const fullPath = path.resolve(filePath);
    
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${fullPath}`);
    }

    const fileContent = fs.readFileSync(fullPath, 'utf-8');
    const data = JSON.parse(fileContent);
    
    // Handle both array and object with tokens array
    let tokens: any[];
    if (Array.isArray(data)) {
      tokens = data;
    } else if (data.tokens && Array.isArray(data.tokens)) {
      tokens = data.tokens;
    } else {
      throw new Error('JSON must be an array or contain a "tokens" array property');
    }

    // Validate and transform data
    const validatedTokens: TokenMetadata[] = tokens.map((token, index) => {
      if (!token.id || !token.name || !token.symbol) {
        throw new Error(`Token at index ${index} missing required fields: id, name, or symbol`);
      }

      // Transform dates if they're strings
      const transformedToken: TokenMetadata = {
        ...token,
        launchDate: token.launchDate ? new Date(token.launchDate) : undefined,
      };

      return transformedToken;
    });

    console.log(`✅ Successfully loaded ${validatedTokens.length} tokens from ${filePath}`);
    return validatedTokens;

  } catch (error) {
    console.error(`❌ Error loading tokens from ${filePath}:`, error);
    throw error;
  }
}

/**
 * Load mockup data from root directory
 */
export async function loadMockupData(): Promise<TokenMetadata[]> {
  const mockupPath = path.join(process.cwd(), 'mockup.json');
  return loadTokensFromFile(mockupPath);
}

/**
 * Validate token metadata structure
 */
export function validateTokenMetadata(token: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Required fields
  if (!token.id) errors.push('Missing required field: id');
  if (!token.name) errors.push('Missing required field: name');
  if (!token.symbol) errors.push('Missing required field: symbol');
  
  // Type validations
  if (token.id && typeof token.id !== 'string') errors.push('id must be a string');
  if (token.name && typeof token.name !== 'string') errors.push('name must be a string');
  if (token.symbol && typeof token.symbol !== 'string') errors.push('symbol must be a string');
  
  if (token.price !== undefined && typeof token.price !== 'number') {
    errors.push('price must be a number');
  }
  
  if (token.marketCap !== undefined && typeof token.marketCap !== 'number') {
    errors.push('marketCap must be a number');
  }
  
  if (token.tags && !Array.isArray(token.tags)) {
    errors.push('tags must be an array');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Generate sample data for testing
 */
export function generateSampleTokens(): TokenMetadata[] {
  return [
    {
      id: 'bitcoin-btc',
      name: 'Bitcoin',
      symbol: 'BTC',
      description: 'Bitcoin is a decentralized digital currency that can be transferred on the peer-to-peer bitcoin network.',
      network: 'Bitcoin',
      totalSupply: '21000000',
      decimals: 8,
      price: 45000,
      marketCap: 945000000000,
      volume24h: 25000000000,
      holders: 45000000,
      website: 'https://bitcoin.org',
      tags: ['currency', 'store-of-value', 'digital-gold'],
      launchDate: new Date('2009-01-03'),
      audit: {
        status: 'N/A - Original blockchain',
        score: 100,
      },
      risk: {
        level: 'Low',
        factors: ['Market volatility'],
      },
      analytics: {
        priceChange24h: 2.5,
        priceChange7d: -1.2,
        priceChange30d: 12.8,
        volatility: 0.04,
        liquidityScore: 0.98,
      },
    },
    {
      id: 'ethereum-eth',
      name: 'Ethereum',
      symbol: 'ETH',
      description: 'Ethereum is a decentralized platform that runs smart contracts.',
      network: 'Ethereum',
      totalSupply: '120000000',
      decimals: 18,
      price: 3200,
      marketCap: 384000000000,
      volume24h: 15000000000,
      holders: 98000000,
      website: 'https://ethereum.org',
      tags: ['smart-contracts', 'defi', 'platform'],
      launchDate: new Date('2015-07-30'),
      audit: {
        status: 'Audited',
        score: 95,
      },
      risk: {
        level: 'Low',
        factors: ['Smart contract risks', 'Network congestion'],
      },
      analytics: {
        priceChange24h: 1.8,
        priceChange7d: -2.5,
        priceChange30d: 8.4,
        volatility: 0.05,
        liquidityScore: 0.95,
      },
    },
  ];
} 