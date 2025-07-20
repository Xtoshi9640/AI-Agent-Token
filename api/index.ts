import express from 'express';
import cors from 'cors';
import { config, validateConfig } from '../src/config';
import { ChatbotService } from '../src/services/chatbotService';
import { TokenMetadata } from '../src/utils/chunking';

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Initialize services
let chatbotService: ChatbotService | null = null;

async function initializeServices() {
  if (!chatbotService) {
    console.log('🤖 Initializing AI Token Bot for Vercel...');
    chatbotService = new ChatbotService();
    await chatbotService.initialize();
    console.log('✅ Services initialized for Vercel');
  }
  return chatbotService;
}

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const service = await initializeServices();
    const healthStatus = await service.getHealthStatus();
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
app.post('/api/index', async (req, res) => {
  try {
    const { tokens }: { tokens: TokenMetadata[] } = req.body;
    
    if (!Array.isArray(tokens) || tokens.length === 0) {
      return res.status(400).json({
        error: 'Invalid tokens array provided',
      });
    }

    const service = await initializeServices();
    console.log(`Received request to index ${tokens.length} tokens`);
    const result = await service.indexTokenMetadata(tokens);
    
    return res.json(result);
  } catch (error) {
    console.error('Error in /api/index:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// REST API endpoint for chat
app.post('/api/chat', async (req, res) => {
  try {
    const { query, conversationHistory = [] } = req.body;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        error: 'Query is required and must be a string',
      });
    }

    const service = await initializeServices();
    const response = await service.processQuery(query, conversationHistory);
    return res.json(response);
  } catch (error) {
    console.error('Error in /api/chat:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Search specific token endpoint
app.get('/api/search/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    
    if (!identifier) {
      return res.status(400).json({
        error: 'Token identifier is required',
      });
    }

    const service = await initializeServices();
    const results = await service.searchToken(identifier);
    return res.json({ identifier, results });
  } catch (error) {
    console.error('Error in /api/search:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get index statistics
app.get('/api/stats', async (req, res) => {
  try {
    const service = await initializeServices();
    const stats = await service.getIndexStats();
    return res.json(stats);
  } catch (error) {
    console.error('Error in /api/stats:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Clear index endpoint
app.delete('/api/index', async (req, res) => {
  try {
    const service = await initializeServices();
    const success = await service.clearIndex();
    return res.json({ success });
  } catch (error) {
    console.error('Error in /api/index DELETE:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'AI Token Bot API',
    version: '1.0.0',
    endpoints: [
      'GET /health - Health check',
      'POST /api/index - Index token metadata',
      'POST /api/chat - Chat with the bot',
      'GET /api/search/:identifier - Search for a token',
      'GET /api/stats - Get index statistics',
      'DELETE /api/index - Clear the index'
    ]
  });
});

// Export for Vercel
export default app; 