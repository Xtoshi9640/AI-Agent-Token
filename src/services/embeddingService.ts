import { pipeline, Pipeline } from '@xenova/transformers';
import { ChunkedData } from '../utils/chunking';

export interface EmbeddingResult {
  id: string;
  embedding: number[];
  metadata: ChunkedData['metadata'];
  content: string;
  tokens: number;
}

export class EmbeddingService {
  private model: Pipeline | null = null;
  private modelName = 'Xenova/all-MiniLM-L6-v2'; // Free 384-dimensional model
  private isInitialized = false;

  constructor() {
    // Model will be loaded lazily
  }

  /**
   * Initialize the embedding model
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('Loading free embedding model...');
      this.model = await pipeline('feature-extraction', this.modelName);
      this.isInitialized = true;
      console.log('Embedding model loaded successfully!');
    } catch (error) {
      console.error('Failed to load embedding model:', error);
      throw new Error('Failed to initialize local embedding model');
    }
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    await this.ensureInitialized();

    try {
      if (!this.model) {
        throw new Error('Model not initialized');
      }

      // Generate embedding
      const result = await this.model(text, { pooling: 'mean', normalize: true });
      
      // Convert to regular array
      const embedding = Array.from(result.data) as number[];
      
      return embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    await this.ensureInitialized();

    try {
      const embeddings: number[][] = [];
      
      // Process in smaller batches to manage memory
      const BATCH_SIZE = 10;
      
      for (let i = 0; i < texts.length; i += BATCH_SIZE) {
        const batch = texts.slice(i, i + BATCH_SIZE);
        
        const batchPromises = batch.map(text => this.generateEmbedding(text));
        const batchEmbeddings = await Promise.all(batchPromises);
        
        embeddings.push(...batchEmbeddings);
        
        // Log progress
        console.log(`Generated embeddings: ${Math.min(i + BATCH_SIZE, texts.length)}/${texts.length}`);
        
        // Small delay to prevent overwhelming the system
        if (i + BATCH_SIZE < texts.length) {
          await this.delay(100);
        }
      }

      return embeddings;
    } catch (error) {
      console.error('Error generating batch embeddings:', error);
      throw new Error(`Failed to generate batch embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    topK: number = 10,
    threshold: number = 0.7
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
   * Ensure model is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
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
    return {
      model: this.modelName,
      dimensions: 384, // all-MiniLM-L6-v2 produces 384-dimensional embeddings
    };
  }

  /**
   * Check if service is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.model !== null;
  }
} 