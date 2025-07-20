import mongoose from 'mongoose';
import { config } from '../config';

const uri = "mongodb+srv://warm624h08:warm624h8@cluster0.nkwblb0.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";


// PumpFun Token Schema
const pumpFunTokenSchema = new mongoose.Schema({
  tokenAddress: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  priceUsd: {
    type: String,
    required: true
  },
  marketCap: {
    type: Number,
    default: 0
  },
  decimals: {
    type: Number,
    default: 9
  },
  supply: {
    type: String,
    default: '0'
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Price History Schema for tracking price changes
const priceHistorySchema = new mongoose.Schema({
  tokenAddress: {
    type: String,
    required: true,
    index: true
  },
  priceUsd: {
    type: String,
    required: true
  },
  marketCap: {
    type: Number,
    default: 0
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Analytics Schema for aggregated data
const analyticsSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    unique: true,
    index: true
  },
  totalTokens: {
    type: Number,
    default: 0
  },
  totalMarketCap: {
    type: Number,
    default: 0
  },
  averagePrice: {
    type: Number,
    default: 0
  },
  newTokensToday: {
    type: Number,
    default: 0
  },
  topTokens: [{
    tokenAddress: String,
    name: String,
    marketCap: Number,
    priceUsd: String
  }]
});

export const PumpFunToken = mongoose.model('PumpFunToken', pumpFunTokenSchema);
export const PriceHistory = mongoose.model('PriceHistory', priceHistorySchema);
export const Analytics = mongoose.model('Analytics', analyticsSchema);

export class MongoService {
  private isConnected = false;

  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      // const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pumpfun-tokens';
      await mongoose.connect(uri);
      this.isConnected = true;
      console.log('✅ Connected to MongoDB');
    } catch (error) {
      console.error('❌ MongoDB connection error:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await mongoose.disconnect();
      this.isConnected = false;
      console.log('📴 Disconnected from MongoDB');
    } catch (error) {
      console.error('❌ MongoDB disconnection error:', error);
    }
  }

  async saveTokens(tokens: any[]): Promise<void> {
    try {
      for (const token of tokens) {
        // Update or create token
        await PumpFunToken.findOneAndUpdate(
          { tokenAddress: token.tokenAddress },
          {
            ...token,
            updatedAt: new Date()
          },
          { upsert: true, new: true }
        );

        // Save price history
        await PriceHistory.create({
          tokenAddress: token.tokenAddress,
          name: token.name,
          symbol: token.symbol,
          logo: token.logo,
          decimals: token.decimals,
          priceUsd: token.priceUsd,
          marketCap: token.marketCap,
          timestamp: new Date()
        });
      }

      console.log(`✅ Saved ${tokens.length} tokens to MongoDB`);
    } catch (error) {
      console.error('❌ Error saving tokens to MongoDB:', error);
      throw error;
    }
  }

  async getLatestTokens(limit: number = 50): Promise<any[]> {
    try {
      return await PumpFunToken.find()
        .sort({ updatedAt: -1 })
        .limit(limit);
    } catch (error) {
      console.error('❌ Error fetching latest tokens:', error);
      throw error;
    }
  }

  async getTokenHistory(tokenAddress: string, days: number = 7): Promise<any[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      return await PriceHistory.find({
        tokenAddress,
        timestamp: { $gte: startDate }
      }).sort({ timestamp: 1 });
    } catch (error) {
      console.error('❌ Error fetching token history:', error);
      throw error;
    }
  }

  async getAnalytics(date: Date = new Date()): Promise<any> {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      // Get today's analytics
      let analytics = await Analytics.findOne({
        date: { $gte: startOfDay, $lte: endOfDay }
      });

      if (!analytics) {
        // Calculate analytics for today
        const todayTokens = await PumpFunToken.find({
          createdAt: { $gte: startOfDay, $lte: endOfDay }
        });

        const allTokens = await PumpFunToken.find().sort({ marketCap: -1 }).limit(10);

        analytics = await Analytics.create({
          date: startOfDay,
          totalTokens: await PumpFunToken.countDocuments(),
          totalMarketCap: allTokens.reduce((sum, token) => sum + (token.marketCap || 0), 0),
          averagePrice: allTokens.reduce((sum, token) => sum + parseFloat(token.priceUsd), 0) / allTokens.length,
          newTokensToday: todayTokens.length,
          topTokens: allTokens.slice(0, 10).map(token => ({
            tokenAddress: token.tokenAddress,
            name: token.name,
            marketCap: token.marketCap,
            priceUsd: token.priceUsd
          }))
        });
      }

      return analytics;
    } catch (error) {
      console.error('❌ Error fetching analytics:', error);
      throw error;
    }
  }

  async getTopTokensByMarketCap(limit: number = 10): Promise<any[]> {
    try {
      return await PumpFunToken.find()
        .sort({ marketCap: -1 })
        .limit(limit);
    } catch (error) {
      console.error('❌ Error fetching top tokens:', error);
      throw error;
    }
  }

  async searchTokens(query: string): Promise<any[]> {
    try {
      return await PumpFunToken.find({
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { tokenAddress: { $regex: query, $options: 'i' } }
        ]
      }).sort({ marketCap: -1 });
    } catch (error) {
      console.error('❌ Error searching tokens:', error);
      throw error;
    }
  }

  async getTokens(): Promise<any[]> {
    try {
      return await PumpFunToken.find()
        .sort({ updatedAt: -1 });
    } catch (error) {
      console.error('❌ Error fetching tokens:', error);
      throw error;
    }
  }
} 