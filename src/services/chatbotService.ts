import axios, { AxiosResponse } from 'axios';
import { config } from '../config';
import { EmbeddingService } from './embeddingService';
import { VectorSearchService, SimilarityResult } from './vectorSearchService';
import { TokenMetadata, chunkTokenMetadataCollection } from '../utils/chunking';

interface OpenAIChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatbotResponse {
  response: string;
  sources: SimilarityResult[];
  tokensUsed: number;
  confidence: number;
  processingTime: number;
}

export interface IndexingResult {
  success: boolean;
  indexedTokens: number;
  totalChunks: number;
  error?: string;
}

export class ChatbotService {
  private embeddingService: EmbeddingService;
  private vectorSearchService: VectorSearchService;
  private apiKey: string;
  private baseURL = 'https://api.openai.com/v1';
  private model: string;

  constructor() {
    this.embeddingService = new EmbeddingService();
    this.vectorSearchService = new VectorSearchService();
    this.apiKey = config.openai.apiKey;
    this.model = config.openai.model;

    if (!this.apiKey) {
      throw new Error('OpenAI API key is required');
    }
  }

  /**
   * Initialize the chatbot by setting up the vector database
   */
  async initialize(): Promise<void> {
    const modelInfo = this.embeddingService.getModelInfo();
    await this.vectorSearchService.initializeIndex(modelInfo.dimensions);
    console.log('Chatbot initialized successfully');
  }

  /**
   * Index token metadata collection
   */
  async indexTokenMetadata(tokens: TokenMetadata[]): Promise<IndexingResult> {
    try {
      console.log(`Starting to index ${tokens.length} tokens...`);
      const startTime = Date.now();

      // Chunk the token metadata
      const chunks = chunkTokenMetadataCollection(tokens);
      console.log(`Generated ${chunks.length} chunks from ${tokens.length} tokens`);

      // Generate embeddings
      const embeddings = await this.embeddingService.processChunkedData(chunks);

      // Store in vector database
      const upsertResult = await this.vectorSearchService.upsertEmbeddings(embeddings);

      const processingTime = Date.now() - startTime;
      console.log(`Indexing completed in ${processingTime}ms`);

      return {
        success: upsertResult.success,
        indexedTokens: tokens.length,
        totalChunks: chunks.length,
        error: upsertResult.error,
      };
    } catch (error) {
      console.error('Error indexing token metadata:', error);
      return {
        success: false,
        indexedTokens: 0,
        totalChunks: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Process a user query and generate a response
   */
  async processQuery(query: string, conversationHistory: ChatMessage[] = []): Promise<ChatbotResponse> {
    const startTime = Date.now();

    try {
      // Generate embedding for the query
      const queryEmbedding = await this.embeddingService.generateQueryEmbedding(query);

      // Search for relevant context
      const similarResults = await this.vectorSearchService.hybridSearch(
        queryEmbedding,
        query,
        config.vectorSearch.topK
      );

      // Filter and prepare context
      const relevantContext = this.prepareContext(similarResults, query);
      
      // Calculate confidence score
      const confidence = this.calculateConfidence(similarResults);

      // Generate response using OpenAI
      const response = await this.generateResponse(query, relevantContext, conversationHistory);

      const processingTime = Date.now() - startTime;

      return {
        response: response.content,
        sources: similarResults,
        tokensUsed: response.tokensUsed,
        confidence,
        processingTime,
      };
    } catch (error) {
      console.error('Error processing query:', error);
      throw error;
    }
  }

  /**
   * Prepare context from search results
   */
  private prepareContext(results: SimilarityResult[], query: string): string {
    if (results.length === 0) {
      return 'No relevant token information found.';
    }

    // Group results by token
    const tokenGroups = new Map<string, SimilarityResult[]>();
    
    results.forEach(result => {
      const tokenId = result.metadata.tokenId;
      if (!tokenGroups.has(tokenId)) {
        tokenGroups.set(tokenId, []);
      }
      tokenGroups.get(tokenId)!.push(result);
    });

    // Build context string
    const contextParts: string[] = [];
    let totalLength = 0;
    const maxContextLength = config.embedding.maxContextLength;

    for (const [tokenId, tokenResults] of tokenGroups.entries()) {
      // Sort chunks by index for coherent reading
      const sortedResults = tokenResults.sort((a, b) => 
        a.metadata.chunkIndex - b.metadata.chunkIndex
      );

      const tokenName = sortedResults[0].metadata.tokenName;
      const tokenSymbol = sortedResults[0].metadata.tokenSymbol;
      
      let tokenContext = `\n--- ${tokenName} (${tokenSymbol}) ---\n`;
      
      for (const result of sortedResults) {
        const addition = `${result.content}\n`;
        if (totalLength + tokenContext.length + addition.length > maxContextLength) {
          break;
        }
        tokenContext += addition;
      }

      if (totalLength + tokenContext.length <= maxContextLength) {
        contextParts.push(tokenContext);
        totalLength += tokenContext.length;
      } else {
        break;
      }
    }

    return contextParts.join('\n');
  }

  /**
   * Calculate confidence score based on search results
   */
  private calculateConfidence(results: SimilarityResult[]): number {
    if (results.length === 0) return 0;

    // Average similarity score
    const avgScore = results.reduce((sum, result) => sum + result.score, 0) / results.length;
    
    // Boost confidence if we have multiple high-quality results
    const highQualityResults = results.filter(r => r.score > 0.8).length;
    const diversityBonus = Math.min(highQualityResults / 5, 0.2); // Up to 20% bonus
    
    return Math.min(avgScore + diversityBonus, 1.0);
  }

  /**
   * Generate response using OpenAI
   */
  private async generateResponse(
    query: string,
    context: string,
    conversationHistory: ChatMessage[]
  ): Promise<{ content: string; tokensUsed: number }> {
    const systemPrompt = `You are a knowledgeable AI assistant specializing in cryptocurrency and token analysis. You have access to comprehensive token metadata and market information.

Your role is to:
1. Provide accurate, helpful information about tokens and cryptocurrencies
2. Analyze market data, technical details, and risk factors
3. Answer questions about token economics, audits, and project details
4. Offer insights based on the provided context data
5. Be honest about limitations and uncertainties

Guidelines:
- Use the provided context data to inform your responses
- If information isn't available in the context, clearly state this
- Provide specific data points when available (prices, market caps, etc.)
- Explain technical concepts in accessible terms
- Include relevant warnings about risks when discussing investments
- Cite specific tokens by name and symbol when relevant

Context Information:
${context}`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-6), // Keep last 3 exchanges
      { role: 'user', content: query }
    ];

    try {
      const response: AxiosResponse<OpenAIChatResponse> = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: this.model,
          messages,
          max_tokens: 1000,
          temperature: 0.3,
          top_p: 0.9,
          presence_penalty: 0.1,
          frequency_penalty: 0.1,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000,
        }
      );

      const choice = response.data.choices[0];
      if (!choice || !choice.message) {
        throw new Error('No response generated');
      }

      return {
        content: choice.message.content,
        tokensUsed: response.data.usage?.total_tokens || 0,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.error?.message || error.message;
        throw new Error(`OpenAI API error: ${errorMessage}`);
      }
      throw error;
    }
  }

  /**
   * Search for specific token information
   */
  async searchToken(identifier: string): Promise<SimilarityResult[]> {
    // Try searching by symbol first
    let results = await this.vectorSearchService.searchByTokenSymbol(identifier);
    
    // If no results, try by token ID
    if (results.length === 0) {
      results = await this.vectorSearchService.searchByTokenId(identifier);
    }

    // If still no results, try semantic search
    if (results.length === 0) {
      const queryEmbedding = await this.embeddingService.generateQueryEmbedding(identifier);
      results = await this.vectorSearchService.searchSimilar(queryEmbedding, 10);
    }

    return results;
  }

  /**
   * Get health status of all services
   */
  async getHealthStatus(): Promise<{
    status: string;
    services: {
      embedding: string;
      vectorSearch: { status: string; indexName: string; stats?: any };
    };
  }> {
    try {
      // Check embedding service
      const embeddingStatus = this.embeddingService ? 'healthy' : 'unhealthy';
      
      // Check vector search service
      const vectorSearchStatus = await this.vectorSearchService.healthCheck();

      const overallStatus = embeddingStatus === 'healthy' && vectorSearchStatus.status === 'healthy' 
        ? 'healthy' 
        : 'unhealthy';

      return {
        status: overallStatus,
        services: {
          embedding: embeddingStatus,
          vectorSearch: vectorSearchStatus,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        services: {
          embedding: 'error',
          vectorSearch: { status: 'error', indexName: config.pinecone.indexName },
        },
      };
    }
  }

  /**
   * Clear all indexed data
   */
  async clearIndex(): Promise<boolean> {
    return this.vectorSearchService.clearIndex();
  }

  /**
   * Get index statistics
   */
  async getIndexStats(): Promise<any> {
    return this.vectorSearchService.getIndexStats();
  }

  /**
   * Process conversational query with context awareness
   */
  async processConversationalQuery(
    query: string,
    conversationHistory: ChatMessage[],
    sessionContext?: any
  ): Promise<ChatbotResponse> {
    // Enhance query with conversation context
    const enhancedQuery = this.enhanceQueryWithContext(query, conversationHistory);
    
    return this.processQuery(enhancedQuery, conversationHistory);
  }

  /**
   * Enhance query with conversation context
   */
  private enhanceQueryWithContext(query: string, history: ChatMessage[]): string {
    if (history.length === 0) return query;

    // Look for token mentions in recent history
    const recentMessages = history.slice(-4);
    const tokenMentions = new Set<string>();
    
    recentMessages.forEach(msg => {
      // Simple regex to find token symbols (2-5 uppercase letters)
      const matches = msg.content.match(/\b[A-Z]{2,5}\b/g);
      if (matches) {
        matches.forEach(match => tokenMentions.add(match));
      }
    });

    if (tokenMentions.size > 0) {
      const contextTokens = Array.from(tokenMentions).join(', ');
      return `${query} (Context: Previous discussion about ${contextTokens})`;
    }

    return query;
  }
} 