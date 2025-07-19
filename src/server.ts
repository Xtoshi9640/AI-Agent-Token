import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { config, validateConfig } from './config';
import { ChatbotService } from './services/chatbotService';
import { TokenMetadata } from './utils/chunking';

const path = require('path');



interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

interface SocketSession {
  id: string;
  conversationHistory: ChatMessage[];
  connected: boolean;
}

export class ChatbotServer {
  private app: express.Application;
  private server: any;
  private io: Server;
  private chatbotService: ChatbotService;
  private sessions: Map<string, SocketSession>;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    this.chatbotService = new ChatbotService();
    this.sessions = new Map();

    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketHandlers();
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    
    // Request logging
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', async (req, res) => {
      try {
        const healthStatus = await this.chatbotService.getHealthStatus();
        return res.json({
          status: 'ok',
          timestamp: new Date().toISOString(),
          chatbot: healthStatus,
        });
      } catch (error) {
        return res.status(500).json({
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Index token metadata endpoint
    this.app.post('/api/index', async (req, res) => {
      try {
        const { tokens }: { tokens: TokenMetadata[] } = req.body;
        
        if (!Array.isArray(tokens) || tokens.length === 0) {
          return res.status(400).json({
            error: 'Invalid tokens array provided',
          });
        }

        console.log(`Received request to index ${tokens.length} tokens`);
        const result = await this.chatbotService.indexTokenMetadata(tokens);
        
        return res.json(result);
      } catch (error) {
        console.error('Error in /api/index:', error);
        return res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // REST API endpoint for chat (alternative to Socket.io)
    this.app.post('/api/chat', async (req, res) => {
      try {
        const { query, conversationHistory = [] } = req.body;
        
        if (!query || typeof query !== 'string') {
          return res.status(400).json({
            error: 'Query is required and must be a string',
          });
        }

        const response = await this.chatbotService.processQuery(query, conversationHistory);
        return res.json(response);
      } catch (error) {
        console.error('Error in /api/chat:', error);
        return res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Search specific token endpoint
    this.app.get('/api/search/:identifier', async (req, res) => {
      try {
        const { identifier } = req.params;
        const results = await this.chatbotService.searchToken(identifier);
        
        return res.json({
          identifier,
          results: results.map(result => ({
            id: result.id,
            score: result.score,
            metadata: result.metadata,
            content: result.content.substring(0, 500), // Truncate for API response
          })),
        });
      } catch (error) {
        console.error('Error in /api/search:', error);
        return res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Get index statistics
    this.app.get('/api/stats', async (req, res) => {
      try {
        const stats = await this.chatbotService.getIndexStats();
        return res.json(stats);
      } catch (error) {
        console.error('Error in /api/stats:', error);
        return res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Clear index endpoint
    this.app.delete('/api/index', async (req, res) => {
      try {
        const success = await this.chatbotService.clearIndex();
        return res.json({ success });
      } catch (error) {
        console.error('Error in /api/index DELETE:', error);
        return res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Fetch and analyze PumpFun tokens endpoint
    this.app.get('/api/pumpfun/tokens', async (req, res) => {
      try {
        const { fetchNewPumpFunTokens } = await import('./fetch/pumpfun');
        const tokens = await fetchNewPumpFunTokens();
        
        return res.json({
          success: true,
          count: tokens.length,
          tokens: tokens,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Error fetching PumpFun tokens:', error);
        return res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Index PumpFun tokens for analysis endpoint
    this.app.post('/api/pumpfun/index', async (req, res) => {
      try {
        const { fetchNewPumpFunTokens } = await import('./fetch/pumpfun');
        const tokens = await fetchNewPumpFunTokens();
        
        // Convert PumpFun tokens to TokenMetadata format
        const tokenMetadata = tokens.map(token => ({
          id: `pumpfun-${token.tokenAddress}`,
          name: token.name || 'Unknown',
          symbol: token.name?.substring(0, 5).toUpperCase() || 'UNKNOWN',
          description: `PumpFun token: ${token.name}`,
          network: 'Solana',
          totalSupply: '0', // Would need to fetch from blockchain
          decimals: 9, // Default for Solana tokens
          price: parseFloat(token.priceUsd),
          marketCap: token.marketCap || 0,
          volume24h: 0, // Not available in current API
          holders: 0, // Not available in current API
          website: '',
          tags: ['pumpfun', 'solana', 'new-token'],
          launchDate: new Date(),
          audit: {
            status: 'Not audited',
            score: 0,
          },
          risk: {
            level: 'High',
            factors: ['New token', 'Limited liquidity', 'No audit'],
          },
          analytics: {
            priceChange24h: 0,
            priceChange7d: 0,
            priceChange30d: 0,
            volatility: 0,
            liquidityScore: 0,
          },
        }));

        // Index the tokens for analysis
        const result = await this.chatbotService.indexTokenMetadata(tokenMetadata);
        
        return res.json({
          success: true,
          indexed: result.indexedTokens,
          tokens: tokenMetadata,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Error indexing PumpFun tokens:', error);
        return res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Serve the main page
    this.app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, 'index.html'));
    });
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket) => {
      console.log(`Client connected: ${socket.id}`);
      
      // Initialize session
      const session: SocketSession = {
        id: socket.id,
        conversationHistory: [],
        connected: true,
      };
      this.sessions.set(socket.id, session);

      // Handle chat messages
      socket.on('chatMessage', async (data) => {
        try {
          const { query } = data;
          
          if (!query || typeof query !== 'string') {
            socket.emit('error', { message: 'Invalid query' });
            return;
          }

          // Add user message to history
          const userMessage: ChatMessage = {
            role: 'user',
            content: query,
            timestamp: new Date(),
          };
          session.conversationHistory.push(userMessage);

          // Process the query
          const response = await this.chatbotService.processConversationalQuery(
            query,
            session.conversationHistory
          );

          // Add assistant response to history
          const assistantMessage: ChatMessage = {
            role: 'assistant',
            content: response.response,
            timestamp: new Date(),
          };
          session.conversationHistory.push(assistantMessage);

          // Keep conversation history manageable
          if (session.conversationHistory.length > 20) {
            session.conversationHistory = session.conversationHistory.slice(-20);
          }

          // Send response
          socket.emit('chatResponse', response);
          
        } catch (error) {
          console.error(`Error processing chat message for ${socket.id}:`, error);
          socket.emit('error', { 
            message: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      });

      // Handle token search
      socket.on('searchToken', async (data) => {
        try {
          const { identifier } = data;
          const results = await this.chatbotService.searchToken(identifier);
          socket.emit('searchResults', { identifier, results });
        } catch (error) {
          console.error(`Error searching token for ${socket.id}:`, error);
          socket.emit('error', { 
            message: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      });

      // Handle health check
      socket.on('healthCheck', async () => {
        try {
          const health = await this.chatbotService.getHealthStatus();
          socket.emit('healthStatus', health);
        } catch (error) {
          console.error(`Error getting health status for ${socket.id}:`, error);
          socket.emit('error', { 
            message: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
        this.sessions.delete(socket.id);
      });
    });
  }

  async initialize(): Promise<void> {
    // Validate configuration
    validateConfig();
    
    // Initialize chatbot service
    await this.chatbotService.initialize();
    
    console.log('Server initialized successfully');
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(config.server.port, () => {
        console.log(`🚀 AI Token Bot server running on port ${config.server.port}`);
        console.log(`📊 Health check: http://localhost:${config.server.port}/health`);
        console.log(`💬 Web interface: http://localhost:${config.server.port}/`);
        console.log(`🔌 Socket.io endpoint: ws://localhost:${config.server.port}`);
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        console.log('Server stopped');
        resolve();
      });
    });
  }

  // Get current active sessions
  getActiveSessions(): SocketSession[] {
    return Array.from(this.sessions.values()).filter(session => session.connected);
  }

  // Broadcast message to all connected clients
  broadcast(event: string, data: any): void {
    this.io.emit(event, data);
  }
} 