import { ChatbotServer } from './server';
import { loadMockupData, generateSampleTokens } from './utils/dataLoader';

async function testMockupData() {
  console.log('🤖 Starting AI Token Bot Test with Mockup Data...');
  
  try {
    // Create and initialize server
    const server = new ChatbotServer();
    
    console.log('⚙️  Initializing services...');
    await server.initialize();
    
    // Try to load mockup data
    let tokens;
    try {
      console.log('📄 Loading mockup.json...');
      tokens = await loadMockupData();
    } catch (error) {
      console.log('⚠️  mockup.json not found, using sample data instead');
      tokens = generateSampleTokens();
    }
    
    console.log(`📊 Found ${tokens.length} tokens to index`);
    
    // Log token details
    tokens.forEach((token, index) => {
      console.log(`${index + 1}. ${token.name} (${token.symbol}) - ${token.description?.substring(0, 50)}...`);
    });
    
    // Index the tokens
    console.log('\n🔄 Indexing tokens...');
    const chatbotService = (server as any).chatbotService;
    const result = await chatbotService.indexTokenMetadata(tokens);
    
    if (result.success) {
      console.log(`✅ Successfully indexed ${result.indexedTokens} tokens (${result.totalChunks} chunks)`);
    } else {
      console.log(`❌ Failed to index tokens: ${result.error}`);
      process.exit(1);
    }
    
    // Test some queries
    console.log('\n🧪 Testing sample queries...');
    
    const queries = [
      'What is Bitcoin?',
      'Tell me about Ethereum',
      'Which tokens have the highest market cap?',
      'What are the risk factors for these tokens?'
    ];
    
    for (const query of queries) {
      console.log(`\n❓ Query: "${query}"`);
      try {
        const response = await chatbotService.processQuery(query);
        console.log(`💬 Response: ${response.response.substring(0, 200)}...`);
        console.log(`📊 Confidence: ${(response.confidence * 100).toFixed(1)}%`);
        console.log(`🔍 Sources: ${response.sources.length} found`);
      } catch (error) {
        console.log(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    console.log('\n🎉 Test completed! You can now start the server with: npm run dev');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('Missing required environment variables')) {
        console.log('\n💡 Setup Required:');
        console.log('1. Copy env.example to .env: cp .env.example .env');
        console.log('2. Add your API keys to .env file');
        console.log('3. Run the test again: npm run test-mockup');
      }
    }
    
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testMockupData();
}

export { testMockupData }; 