import cron from 'node-cron';
import { MongoService } from './mongoService';
import { ChatbotService } from './chatbotService';

export class SchedulerService {
  private mongoService: MongoService;
  private chatbotService: ChatbotService;
  private isRunning = false;

  constructor(chatbotService: ChatbotService) {
    this.mongoService = new MongoService();
    this.chatbotService = chatbotService;
  }

  async initialize(): Promise<void> {
    try {
      await this.mongoService.connect();
      console.log('✅ Scheduler service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize scheduler service:', error);
      throw error;
    }
  }

  startScheduler(): void {
    if (this.isRunning) {
      console.log('⚠️ Scheduler is already running');
      return;
    }

    console.log('🕐 Starting PumpFun token scheduler (every 5 minutes)...');

    // Schedule the task to run every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      await this.fetchAndSaveTokens();
    }, {
      // scheduled: true,
      timezone: "UTC"
    });

    // Also run immediately on startup
    this.fetchAndSaveTokens();

    this.isRunning = true;
    console.log('✅ Scheduler started successfully');
  }

  stopScheduler(): void {
    if (!this.isRunning) {
      console.log('⚠️ Scheduler is not running');
      return;
    }

    cron.getTasks().forEach(task => task.stop());
    this.isRunning = false;
    console.log('⏹️ Scheduler stopped');
  }

  private async fetchAndSaveTokens(): Promise<void> {
    try {
      console.log(`🔄 [${new Date().toISOString()}] Fetching PumpFun tokens...`);
      
      // Import the function dynamically to avoid circular dependencies
      const { fetchNewPumpFunTokens } = await import('../fetch/pumpfun');
      const tokens = await fetchNewPumpFunTokens();
      
      if (tokens && tokens.length > 0) {
        await this.mongoService.saveTokens(tokens);
        // Map PumpFunToken[] to TokenMetadata[] for Pinecone indexing
        const tokenMetadata = tokens.map(token => ({
          id: `pumpfun-${token.tokenAddress}`,
          name: token.name || 'Unknown',
          symbol: token.name?.substring(0, 5).toUpperCase() || 'UNKNOWN',
          description: `PumpFun token: ${token.name}`,
          network: 'Solana',
          totalSupply: '0',
          decimals: 9,
          price: parseFloat(token.priceUsd),
          marketCap: token.marketCap || 0,
          volume24h: 0,
          holders: 0,
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
        await this.chatbotService.indexTokenMetadata(tokenMetadata);
        console.log(`✅ [${new Date().toISOString()}] Successfully saved and indexed ${tokens.length} tokens`);
      } else {
        console.log(`⚠️ [${new Date().toISOString()}] No tokens fetched`);
      }
    } catch (error) {
      console.error(`❌ [${new Date().toISOString()}] Error in scheduled fetch:`, error);
    }
  }

  async getMongoService(): Promise<MongoService> {
    return this.mongoService;
  }

  async cleanup(): Promise<void> {
    this.stopScheduler();
    await this.mongoService.disconnect();
  }
} 