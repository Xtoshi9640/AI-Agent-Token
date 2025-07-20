import { ChatbotServer } from './server';
import { TokenMetadata } from './utils/chunking';
import { loadMockupData, generateSampleTokens } from './utils/dataLoader';

async function main() {
  console.log('🤖 Starting AI Token Bot...');
  
  try {
    // Create and initialize server
    const server = new ChatbotServer();
    
    console.log('⚙️  Initializing services...');
    await server.initialize();
    
    console.log('🚀 Starting server...');
    await server.start();
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n📴 Shutting down gracefully...');
      await server.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n📴 Shutting down gracefully...');
      await server.stop();
      process.exit(0);
    });

    // Log example usage
    console.log('\n📋 Example Usage:');
    console.log('');
    console.log('1. Index token metadata:');
    console.log('   POST http://localhost:3000/api/index');
    console.log('   Body: { "tokens": [TokenMetadata[]] }');
    console.log('');
    console.log('2. Chat via REST API:');
    console.log('   POST http://localhost:3000/api/chat');
    console.log('   Body: { "query": "Tell me about Bitcoin" }');
    console.log('');
    console.log('3. Search specific token:');
    console.log('   GET http://localhost:3000/api/search/BTC');
    console.log('');
    console.log('4. Real-time chat via Socket.io:');
    console.log('   Connect to ws://localhost:3000');
    console.log('   Emit: "chatMessage" with { "query": "your question" }');
    console.log('');
    console.log('5. Web interface:');
    console.log('   Open http://localhost:3000 in your browser');
    console.log('');
    console.log('6. PumpFun token analysis:');
    console.log('   GET http://localhost:3000/api/pumpfun/tokens - Fetch latest PumpFun tokens');
    console.log('   POST http://localhost:3000/api/pumpfun/index - Index PumpFun tokens for analysis');
    console.log('');
    console.log('7. MongoDB Analytics (Auto-updated every 5 minutes):');
    console.log('   GET http://localhost:3000/api/mongodb/tokens - Get all stored tokens');
    console.log('   GET http://localhost:3000/api/mongodb/analytics - Get daily analytics');
    console.log('   GET http://localhost:3000/api/mongodb/top-tokens - Get top tokens by market cap');
    console.log('   GET http://localhost:3000/api/mongodb/search/:query - Search tokens');
    console.log('   GET http://localhost:3000/api/mongodb/history/:tokenAddress - Get token price history');
    console.log('');

  } catch (error) {
    console.error('❌ Failed to start AI Token Bot:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('Missing required environment variables')) {
        console.log('\n💡 Quick Setup:');
        console.log('1. Create a .env file in the project root');
        console.log('2. Add the following variables:');
        console.log('   OPENAI_API_KEY=your_openai_api_key_here');
        console.log('   PINECONE_API_KEY=your_pinecone_api_key_here');
        console.log('   PINECONE_ENVIRONMENT=your_pinecone_environment_here');
        console.log('   PINECONE_INDEX_NAME=token-metadata-index');
        console.log('   PORT=3000');
      }
    }
    
    process.exit(1);
  }
}

// Sample token metadata for testing
export const sampleTokens: TokenMetadata[] = [
  {
    id: 'bitcoin-btc',
    name: 'Bitcoin',
    symbol: 'BTC',
    description: 'Bitcoin is a decentralized digital currency that can be transferred on the peer-to-peer bitcoin network.',
    network: 'Bitcoin',
    totalSupply: '21000000',
    decimals: 8,
    price: 45000,
    marketCap: 945000000000,
    volume24h: 25000000000,
    holders: 45000000,
    website: 'https://bitcoin.org',
    tags: ['currency', 'store-of-value', 'digital-gold'],
    launchDate: new Date('2009-01-03'),
    audit: {
      status: 'N/A - Original blockchain',
      score: 100,
    },
    risk: {
      level: 'Low',
      factors: ['Market volatility'],
    },
    analytics: {
      priceChange24h: 2.5,
      priceChange7d: -1.2,
      priceChange30d: 12.8,
      volatility: 0.04,
      liquidityScore: 0.98,
    },
  },
  {
    id: 'ethereum-eth',
    name: 'Ethereum',
    symbol: 'ETH',
    description: 'Ethereum is a decentralized platform that runs smart contracts: applications that run exactly as programmed without any possibility of downtime, censorship, fraud or third-party interference.',
    network: 'Ethereum',
    totalSupply: '120000000',
    decimals: 18,
    price: 3200,
    marketCap: 384000000000,
    volume24h: 15000000000,
    holders: 98000000,
    website: 'https://ethereum.org',
    tags: ['smart-contracts', 'defi', 'platform'],
    launchDate: new Date('2015-07-30'),
    audit: {
      status: 'Audited',
      score: 95,
    },
    risk: {
      level: 'Low',
      factors: ['Smart contract risks', 'Network congestion'],
    },
    analytics: {
      priceChange24h: 1.8,
      priceChange7d: -2.5,
      priceChange30d: 8.4,
      volatility: 0.05,
      liquidityScore: 0.95,
    },
  },
];

// Export for use in other modules
export { ChatbotServer };

// Start the application
if (require.main === module) {
  main();
}
