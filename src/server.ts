import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { config, validateConfig } from './config';
import { ChatbotService } from './services/chatbotService';
import { TokenMetadata } from './utils/chunking';

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
        res.json({
          status: 'ok',
          timestamp: new Date().toISOString(),
          chatbot: healthStatus,
        });
      } catch (error) {
        res.status(500).json({
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
        
        res.json(result);
      } catch (error) {
        console.error('Error in /api/index:', error);
        res.status(500).json({
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
        res.json(response);
      } catch (error) {
        console.error('Error in /api/chat:', error);
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Search specific token endpoint
    this.app.get('/api/search/:identifier', async (req, res) => {
      try {
        const { identifier } = req.params;
        const results = await this.chatbotService.searchToken(identifier);
        
        res.json({
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
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Get index statistics
    this.app.get('/api/stats', async (req, res) => {
      try {
        const stats = await this.chatbotService.getIndexStats();
        res.json(stats);
      } catch (error) {
        console.error('Error in /api/stats:', error);
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Clear index endpoint
    this.app.delete('/api/index', async (req, res) => {
      try {
        const success = await this.chatbotService.clearIndex();
        res.json({ success });
      } catch (error) {
        console.error('Error in /api/index DELETE:', error);
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Static files for simple web interface
    this.app.get('/', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>AI Token Bot</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; }
                .container { max-width: 800px; margin: 0 auto; }
                .chat-container { border: 1px solid #ccc; height: 400px; padding: 20px; overflow-y: auto; margin: 20px 0; }
                .input-container { display: flex; gap: 10px; }
                input[type="text"] { flex: 1; padding: 10px; }
                button { padding: 10px 20px; }
                .message { margin: 10px 0; padding: 10px; border-radius: 5px; }
                .user-message { background: #e3f2fd; text-align: right; }
                .assistant-message { background: #f5f5f5; }
                .status { padding: 10px; margin: 10px 0; background: #e8f5e8; border-radius: 5px; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>AI Token Bot</h1>
                <div id="status" class="status">Connecting...</div>
                <div id="chat" class="chat-container"></div>
                <div class="input-container">
                    <input type="text" id="messageInput" placeholder="Ask about tokens..." />
                    <button onclick="sendMessage()">Send</button>
                </div>
            </div>

            <script src="/socket.io/socket.io.js"></script>
            <script>
                const socket = io();
                const chatDiv = document.getElementById('chat');
                const statusDiv = document.getElementById('status');
                const messageInput = document.getElementById('messageInput');

                socket.on('connect', () => {
                    statusDiv.textContent = 'Connected - Ready to chat!';
                    statusDiv.style.background = '#e8f5e8';
                });

                socket.on('disconnect', () => {
                    statusDiv.textContent = 'Disconnected';
                    statusDiv.style.background = '#ffebee';
                });

                socket.on('chatResponse', (data) => {
                    addMessage('assistant', data.response);
                    if (data.sources && data.sources.length > 0) {
                        addMessage('system', \`Found \${data.sources.length} relevant sources with \${data.confidence.toFixed(2)} confidence\`);
                    }
                });

                socket.on('error', (error) => {
                    addMessage('system', \`Error: \${error.message}\`);
                });

                function addMessage(role, content) {
                    const messageDiv = document.createElement('div');
                    messageDiv.className = \`message \${role}-message\`;
                    messageDiv.textContent = content;
                    chatDiv.appendChild(messageDiv);
                    chatDiv.scrollTop = chatDiv.scrollHeight;
                }

                function sendMessage() {
                    const message = messageInput.value.trim();
                    if (message) {
                        addMessage('user', message);
                        socket.emit('chatMessage', { query: message });
                        messageInput.value = '';
                    }
                }

                messageInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        sendMessage();
                    }
                });
            </script>
        </body>
        </html>
      `);
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