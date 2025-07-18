import { config } from '../config';

export interface TokenMetadata {
  id: string;
  name: string;
  symbol: string;
  description?: string;
  contractAddress?: string;
  network?: string;
  totalSupply?: string;
  decimals?: number;
  price?: number;
  marketCap?: number;
  volume24h?: number;
  holders?: number;
  website?: string;
  whitepaper?: string;
  github?: string;
  twitter?: string;
  telegram?: string;
  discord?: string;
  tags?: string[];
  launchDate?: Date;
  audit?: {
    status: string;
    report?: string;
    score?: number;
  };
  risk?: {
    level: string;
    factors: string[];
  };
  analytics?: {
    priceChange24h?: number;
    priceChange7d?: number;
    priceChange30d?: number;
    volatility?: number;
    liquidityScore?: number;
  };
  additional?: Record<string, any>;
}

export interface ChunkedData {
  id: string;
  chunkIndex: number;
  totalChunks: number;
  content: string;
  metadata: {
    tokenId: string;
    tokenName: string;
    tokenSymbol: string;
    chunkType: string;
    originalLength: number;
  };
}

/**
 * Splits text into chunks with overlap for better context preservation
 */
export function splitTextIntoChunks(
  text: string,
  chunkSize: number = config.embedding.chunkSize,
  overlap: number = config.embedding.chunkOverlap
): string[] {
  if (text.length <= chunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    let chunk = text.substring(start, end);

    // Try to break at word boundaries to avoid cutting words
    if (end < text.length) {
      const lastSpaceIndex = chunk.lastIndexOf(' ');
      if (lastSpaceIndex > chunkSize * 0.8) { // Only break on space if it's not too early
        chunk = chunk.substring(0, lastSpaceIndex);
      }
    }

    chunks.push(chunk.trim());

    // Move start position, accounting for overlap
    if (end >= text.length) break;
    start = Math.max(start + chunkSize - overlap, start + 1);
  }

  return chunks.filter(chunk => chunk.length > 0);
}

/**
 * Converts token metadata to structured text representation
 */
export function tokenMetadataToText(token: TokenMetadata): string {
  const sections: string[] = [];

  // Basic information
  sections.push(`Token: ${token.name} (${token.symbol})`);
  if (token.description) {
    sections.push(`Description: ${token.description}`);
  }

  // Technical details
  if (token.contractAddress) {
    sections.push(`Contract Address: ${token.contractAddress}`);
  }
  if (token.network) {
    sections.push(`Network: ${token.network}`);
  }
  if (token.totalSupply) {
    sections.push(`Total Supply: ${token.totalSupply}`);
  }
  if (token.decimals !== undefined) {
    sections.push(`Decimals: ${token.decimals}`);
  }

  // Market data
  if (token.price !== undefined) {
    sections.push(`Price: $${token.price}`);
  }
  if (token.marketCap !== undefined) {
    sections.push(`Market Cap: $${token.marketCap.toLocaleString()}`);
  }
  if (token.volume24h !== undefined) {
    sections.push(`24h Volume: $${token.volume24h.toLocaleString()}`);
  }
  if (token.holders !== undefined) {
    sections.push(`Holders: ${token.holders.toLocaleString()}`);
  }

  // Links
  if (token.website) {
    sections.push(`Website: ${token.website}`);
  }
  if (token.whitepaper) {
    sections.push(`Whitepaper: ${token.whitepaper}`);
  }
  if (token.github) {
    sections.push(`GitHub: ${token.github}`);
  }

  // Social media
  const socialLinks: string[] = [];
  if (token.twitter) socialLinks.push(`Twitter: ${token.twitter}`);
  if (token.telegram) socialLinks.push(`Telegram: ${token.telegram}`);
  if (token.discord) socialLinks.push(`Discord: ${token.discord}`);
  if (socialLinks.length > 0) {
    sections.push(`Social Media: ${socialLinks.join(', ')}`);
  }

  // Tags
  if (token.tags && token.tags.length > 0) {
    sections.push(`Tags: ${token.tags.join(', ')}`);
  }

  // Launch date
  if (token.launchDate) {
    sections.push(`Launch Date: ${token.launchDate.toDateString()}`);
  }

  // Audit information
  if (token.audit) {
    sections.push(`Audit Status: ${token.audit.status}`);
    if (token.audit.score !== undefined) {
      sections.push(`Audit Score: ${token.audit.score}/100`);
    }
    if (token.audit.report) {
      sections.push(`Audit Report: ${token.audit.report}`);
    }
  }

  // Risk assessment
  if (token.risk) {
    sections.push(`Risk Level: ${token.risk.level}`);
    if (token.risk.factors && token.risk.factors.length > 0) {
      sections.push(`Risk Factors: ${token.risk.factors.join(', ')}`);
    }
  }

  // Analytics
  if (token.analytics) {
    const analytics = token.analytics;
    const analyticsParts: string[] = [];
    
    if (analytics.priceChange24h !== undefined) {
      analyticsParts.push(`24h Change: ${analytics.priceChange24h}%`);
    }
    if (analytics.priceChange7d !== undefined) {
      analyticsParts.push(`7d Change: ${analytics.priceChange7d}%`);
    }
    if (analytics.priceChange30d !== undefined) {
      analyticsParts.push(`30d Change: ${analytics.priceChange30d}%`);
    }
    if (analytics.volatility !== undefined) {
      analyticsParts.push(`Volatility: ${analytics.volatility}`);
    }
    if (analytics.liquidityScore !== undefined) {
      analyticsParts.push(`Liquidity Score: ${analytics.liquidityScore}`);
    }
    
    if (analyticsParts.length > 0) {
      sections.push(`Analytics: ${analyticsParts.join(', ')}`);
    }
  }

  // Additional data
  if (token.additional) {
    const additionalParts = Object.entries(token.additional)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
    if (additionalParts) {
      sections.push(`Additional Info: ${additionalParts}`);
    }
  }

  return sections.join('\n');
}

/**
 * Chunks token metadata into smaller pieces for embedding
 */
export function chunkTokenMetadata(
  token: TokenMetadata,
  chunkSize: number = config.embedding.chunkSize,
  overlap: number = config.embedding.chunkOverlap
): ChunkedData[] {
  const fullText = tokenMetadataToText(token);
  const textChunks = splitTextIntoChunks(fullText, chunkSize, overlap);
  
  return textChunks.map((chunk, index) => ({
    id: `${token.id}-chunk-${index}`,
    chunkIndex: index,
    totalChunks: textChunks.length,
    content: chunk,
    metadata: {
      tokenId: token.id,
      tokenName: token.name,
      tokenSymbol: token.symbol,
      chunkType: 'metadata',
      originalLength: fullText.length,
    },
  }));
}

/**
 * Chunks an array of token metadata efficiently
 */
export function chunkTokenMetadataCollection(
  tokens: TokenMetadata[],
  chunkSize: number = config.embedding.chunkSize,
  overlap: number = config.embedding.chunkOverlap
): ChunkedData[] {
  const allChunks: ChunkedData[] = [];
  
  for (const token of tokens) {
    const tokenChunks = chunkTokenMetadata(token, chunkSize, overlap);
    allChunks.push(...tokenChunks);
  }
  
  return allChunks;
}

/**
 * Estimates the number of tokens in a text (rough approximation)
 */
export function estimateTokenCount(text: string): number {
  // Rough estimation: 1 token ≈ 4 characters for English text
  return Math.ceil(text.length / 4);
}

/**
 * Validates if chunked data fits within context limits
 */
export function validateChunkSize(chunks: ChunkedData[]): boolean {
  const maxTokens = config.embedding.maxContextLength;
  
  for (const chunk of chunks) {
    const estimatedTokens = estimateTokenCount(chunk.content);
    if (estimatedTokens > maxTokens) {
      console.warn(`Chunk ${chunk.id} may exceed token limit: ${estimatedTokens} > ${maxTokens}`);
      return false;
    }
  }
  
  return true;
} 