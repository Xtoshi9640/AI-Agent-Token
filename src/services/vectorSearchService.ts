import { Pinecone } from '@pinecone-database/pinecone';
import { config } from '../config';
import { EmbeddingResult } from './embeddingService';

export interface VectorMetadata {
  tokenId: string;
  tokenName: string;
  tokenSymbol: string;
  chunkType: string;
  chunkIndex: number;
  totalChunks: number;
  originalLength: number;
  content: string;
  [key: string]: any; // Index signature for Pinecone compatibility
}

export interface SimilarityResult {
  id: string;
  score: number;
  metadata: VectorMetadata;
  content: string;
}

export interface UpsertResponse {
  upsertedCount: number;
  success: boolean;
  error?: string;
}

export class VectorSearchService {
  private pinecone: Pinecone;
  private indexName: string;

  constructor() {
    this.pinecone = new Pinecone({
      apiKey: config.pinecone.apiKey,
    });
    this.indexName = config.pinecone.indexName;
  }

  /**
   * Initialize the Pinecone index if it doesn't exist
   */
  async initializeIndex(dimension: number = 1536): Promise<void> {
    try {
      // Check if index exists
      const indexList = await this.pinecone.listIndexes();
      const indexExists = indexList.indexes?.some(index => index.name === this.indexName);

      if (!indexExists) {
        console.log(`Creating Pinecone index: ${this.indexName}`);
        await this.pinecone.createIndex({
          name: this.indexName,
          dimension: dimension,
          metric: 'cosine',
          spec: {
            serverless: {
              cloud: 'aws',
              region: 'us-east-1'
            }
          }
        });

        // Wait for index to be ready
        console.log('Waiting for index to be ready...');
        await this.waitForIndexReady();
      } else {
        console.log(`Using existing Pinecone index: ${this.indexName}`);
      }
    } catch (error) {
      console.error('Error initializing Pinecone index:', error);
      throw error;
    }
  }

  /**
   * Wait for index to be ready
   */
  private async waitForIndexReady(maxAttempts: number = 60): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const indexStats = await this.getIndex().describeIndexStats();
        if (indexStats) {
          console.log('Index is ready!');
          return;
        }
      } catch (error) {
        // Index might not be ready yet
      }
      
      console.log(`Waiting for index... (${i + 1}/${maxAttempts})`);
      await this.delay(5000); // Wait 5 seconds between checks
    }
    
    throw new Error('Index failed to become ready within timeout');
  }

  /**
   * Get index instance
   */
  private getIndex() {
    return this.pinecone.index(this.indexName);
  }

  /**
   * Upsert embeddings to Pinecone
   */
  async upsertEmbeddings(embeddings: EmbeddingResult[]): Promise<UpsertResponse> {
    try {
      const index = this.getIndex();
      
      // Prepare vectors for upsert
      const vectors = embeddings.map(embedding => ({
        id: embedding.id,
        values: embedding.embedding,
        metadata: {
          tokenId: embedding.metadata.tokenId,
          tokenName: embedding.metadata.tokenName,
          tokenSymbol: embedding.metadata.tokenSymbol,
          chunkType: embedding.metadata.chunkType,
          chunkIndex: 0,
          totalChunks: embedding.metadata.originalLength || 1,
          originalLength: embedding.metadata.originalLength,
          content: embedding.content,
        } as VectorMetadata
      }));

      // Upsert in batches to avoid hitting rate limits
      const BATCH_SIZE = 100;
      let upsertedCount = 0;

      for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
        const batch = vectors.slice(i, i + BATCH_SIZE);
        
        await index.upsert(batch);
        upsertedCount += batch.length;
        
        console.log(`Upserted ${upsertedCount}/${vectors.length} vectors`);
        
        // Add delay between batches
        if (i + BATCH_SIZE < vectors.length) {
          await this.delay(1000);
        }
      }

      return {
        upsertedCount,
        success: true,
      };
    } catch (error) {
      console.error('Error upserting embeddings:', error);
      return {
        upsertedCount: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Search for similar vectors
   */
  async searchSimilar(
    queryEmbedding: number[],
    topK: number = config.vectorSearch.topK,
    filter?: Record<string, any>
  ): Promise<SimilarityResult[]> {
    try {
      const index = this.getIndex();
      
      const searchRequest: any = {
        vector: queryEmbedding,
        topK,
        includeMetadata: true,
        includeValues: false,
      };

      if (filter) {
        searchRequest.filter = filter;
      }

      const searchResult = await index.query(searchRequest);
      
      if (!searchResult.matches) {
        return [];
      }

      return searchResult.matches.map(match => ({
        id: match.id || '',
        score: match.score || 0,
        metadata: match.metadata as unknown as VectorMetadata,
        content: (match.metadata as any)?.content || '',
      }));
    } catch (error) {
      console.error('Error searching vectors:', error);
      throw error;
    }
  }

  /**
   * Search by token ID
   */
  async searchByTokenId(tokenId: string): Promise<SimilarityResult[]> {
    try {
      const index = this.getIndex();
      
      const searchResult = await index.query({
        vector: new Array(1536).fill(0), // Dummy vector since we're filtering
        topK: 1000, // Get all chunks for the token
        includeMetadata: true,
        includeValues: false,
        filter: {
          tokenId: { "$eq": tokenId }
        }
      });

      if (!searchResult.matches) {
        return [];
      }

      return searchResult.matches.map(match => ({
        id: match.id || '',
        score: match.score || 0,
        metadata: match.metadata as unknown as VectorMetadata,
        content: (match.metadata as any)?.content || '',
      }));
    } catch (error) {
      console.error('Error searching by token ID:', error);
      throw error;
    }
  }

  /**
   * Search by token symbol
   */
  async searchByTokenSymbol(symbol: string): Promise<SimilarityResult[]> {
    try {
      const index = this.getIndex();
      
      const searchResult = await index.query({
        vector: new Array(1536).fill(0), // Dummy vector since we're filtering
        topK: 1000,
        includeMetadata: true,
        includeValues: false,
        filter: {
          tokenSymbol: { "$eq": symbol.toUpperCase() }
        }
      });

      if (!searchResult.matches) {
        return [];
      }

      return searchResult.matches.map(match => ({
        id: match.id || '',
        score: match.score || 0,
        metadata: match.metadata as unknown as VectorMetadata,
        content: (match.metadata as any)?.content || '',
      }));
    } catch (error) {
      console.error('Error searching by token symbol:', error);
      throw error;
    }
  }

  /**
   * Delete vectors by token ID
   */
  async deleteByTokenId(tokenId: string): Promise<boolean> {
    try {
      const index = this.getIndex();
      
      await index.deleteMany({
        filter: {
          tokenId: { "$eq": tokenId }
        }
      });

      return true;
    } catch (error) {
      console.error('Error deleting vectors:', error);
      return false;
    }
  }

  /**
   * Get index statistics
   */
  async getIndexStats(): Promise<any> {
    try {
      const index = this.getIndex();
      return await index.describeIndexStats();
    } catch (error) {
      console.error('Error getting index stats:', error);
      throw error;
    }
  }

  /**
   * Clear all vectors from index
   */
  async clearIndex(): Promise<boolean> {
    try {
      const index = this.getIndex();
      await index.deleteAll();
      return true;
    } catch (error) {
      console.error('Error clearing index:', error);
      return false;
    }
  }

  /**
   * Combine and rank results from multiple search strategies
   */
  async hybridSearch(
    queryEmbedding: number[],
    query: string,
    topK: number = config.vectorSearch.topK
  ): Promise<SimilarityResult[]> {
    try {
      // Semantic similarity search
      const semanticResults = await this.searchSimilar(queryEmbedding, topK * 2);
      
      // Keyword-based filters
      const keywords = query.toLowerCase().split(' ').filter(word => word.length > 2);
      
      // Score boost for keyword matches
      const boostedResults = semanticResults.map(result => {
        let boost = 0;
        const content = result.content.toLowerCase();
        
        keywords.forEach(keyword => {
          if (content.includes(keyword)) {
            boost += 0.1; // Boost score by 0.1 for each keyword match
          }
        });
        
        return {
          ...result,
          score: Math.min(result.score + boost, 1.0), // Cap at 1.0
        };
      });
      
      // Re-sort by boosted scores and return top K
      return boostedResults
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
    } catch (error) {
      console.error('Error in hybrid search:', error);
      throw error;
    }
  }

  /**
   * Utility function to add delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Health check for the service
   */
  async healthCheck(): Promise<{ status: string; indexName: string; stats?: any }> {
    try {
      const stats = await this.getIndexStats();
      return {
        status: 'healthy',
        indexName: this.indexName,
        stats,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        indexName: this.indexName,
      };
    }
  }
} 