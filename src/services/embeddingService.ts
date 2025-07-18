import axios, { AxiosResponse } from 'axios';
import { config } from '../config';
import { ChunkedData } from '../utils/chunking';

interface OpenAIEmbeddingResponse {
  object: string;
  data: Array<{
    object: string;
    index: number;
    embedding: number[];
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export interface EmbeddingResult {
  id: string;
  embedding: number[];
  metadata: ChunkedData['metadata'];
  content: string;
  tokens: number;
}

export class EmbeddingService {
  private apiKey: string;
  private baseURL = 'https://api.openai.com/v1';
  private model: string;

  constructor() {
    this.apiKey = config.openai.apiKey;
    this.model = config.openai.embeddingModel;
    
    if (!this.apiKey) {
      throw new Error('OpenAI API key is required');
    }
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response: AxiosResponse<OpenAIEmbeddingResponse> = await axios.post(
        `${this.baseURL}/embeddings`,
        {
          model: this.model,
          input: text,
          encoding_format: 'float',
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000, // 30 second timeout
        }
      );

      if (!response.data.data || response.data.data.length === 0) {
        throw new Error('No embedding data received from OpenAI');
      }

      return response.data.data[0].embedding;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.error?.message || error.message;
        throw new Error(`OpenAI API error: ${errorMessage}`);
      }
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      // OpenAI has a limit on the number of inputs per request
      const BATCH_SIZE = 100;
      const results: number[][] = [];

      for (let i = 0; i < texts.length; i += BATCH_SIZE) {
        const batch = texts.slice(i, i + BATCH_SIZE);
        
        const response: AxiosResponse<OpenAIEmbeddingResponse> = await axios.post(
          `${this.baseURL}/embeddings`,
          {
            model: this.model,
            input: batch,
            encoding_format: 'float',
          },
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: 60000, // 60 second timeout for batch requests
          }
        );

        if (!response.data.data || response.data.data.length === 0) {
          throw new Error('No embedding data received from OpenAI');
        }

        // Sort by index to maintain order
        const sortedEmbeddings = response.data.data
          .sort((a, b) => a.index - b.index)
          .map(item => item.embedding);

        results.push(...sortedEmbeddings);

        // Add delay between batches to respect rate limits
        if (i + BATCH_SIZE < texts.length) {
          await this.delay(1000); // 1 second delay
        }
      }

      return results;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.error?.message || error.message;
        throw new Error(`OpenAI API error: ${errorMessage}`);
      }
      throw error;
    }
  }

  /**
   * Process chunked data to generate embeddings
   */
  async processChunkedData(chunks: ChunkedData[]): Promise<EmbeddingResult[]> {
    console.log(`Processing ${chunks.length} chunks for embeddings...`);
    
    const texts = chunks.map(chunk => chunk.content);
    const embeddings = await this.generateBatchEmbeddings(texts);

    const results: EmbeddingResult[] = chunks.map((chunk, index) => ({
      id: chunk.id,
      embedding: embeddings[index],
      metadata: chunk.metadata,
      content: chunk.content,
      tokens: this.estimateTokenCount(chunk.content),
    }));

    console.log(`Successfully generated embeddings for ${results.length} chunks`);
    return results;
  }

  /**
   * Generate embedding for a search query
   */
  async generateQueryEmbedding(query: string): Promise<number[]> {
    return this.generateEmbedding(query);
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Find most similar embeddings to a query
   */
  findSimilarEmbeddings(
    queryEmbedding: number[],
    candidateEmbeddings: EmbeddingResult[],
    topK: number = config.vectorSearch.topK,
    threshold: number = config.vectorSearch.similarityThreshold
  ): EmbeddingResult[] {
    const similarities = candidateEmbeddings.map(candidate => ({
      ...candidate,
      similarity: this.calculateCosineSimilarity(queryEmbedding, candidate.embedding),
    }));

    return similarities
      .filter(item => item.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  /**
   * Estimate token count for a text
   */
  private estimateTokenCount(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Utility function to add delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate embedding dimensions
   */
  validateEmbedding(embedding: number[]): boolean {
    if (!Array.isArray(embedding) || embedding.length === 0) {
      return false;
    }

    // Check for NaN or infinite values
    return embedding.every(value => 
      typeof value === 'number' && 
      !isNaN(value) && 
      isFinite(value)
    );
  }

  /**
   * Get model information
   */
  getModelInfo(): { model: string; dimensions: number } {
    // text-embedding-3-small has 1536 dimensions
    // text-embedding-3-large has 3072 dimensions
    const dimensions = this.model.includes('large') ? 3072 : 1536;
    
    return {
      model: this.model,
      dimensions,
    };
  }
} 