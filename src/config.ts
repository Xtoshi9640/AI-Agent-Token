import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface Config {
  // OpenAI Configuration
  openai: {
    apiKey: string;
    model: string;
  };
  
  // Pinecone Configuration
  pinecone: {
    apiKey: string;
    environment: string;
    indexName: string;
  };
  
  // Server Configuration
  server: {
    port: number;
    nodeEnv: string;
  };
  
  // Embedding Configuration
  embedding: {
    chunkSize: number;
    chunkOverlap: number;
    maxContextLength: number;
  };
  
  // Vector Search Configuration
  vectorSearch: {
    topK: number;
    similarityThreshold: number;
  };
}

const config: Config = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  },
  
  pinecone: {
    apiKey: process.env.PINECONE_API_KEY || '',
    environment: process.env.PINECONE_ENVIRONMENT || '',
    indexName: process.env.PINECONE_INDEX_NAME || 'token-metadata-index',
  },
  
  server: {
    port: parseInt(process.env.PORT || '3000'),
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  
  embedding: {
    chunkSize: parseInt(process.env.CHUNK_SIZE || '1000'),
    chunkOverlap: parseInt(process.env.CHUNK_OVERLAP || '200'),
    maxContextLength: parseInt(process.env.MAX_CONTEXT_LENGTH || '8000'),
  },
  
  vectorSearch: {
    topK: parseInt(process.env.TOP_K_RESULTS || '10'),
    similarityThreshold: parseFloat(process.env.SIMILARITY_THRESHOLD || '0.7'),
  },
};

// Validate required environment variables
const validateConfig = (): void => {
  const required = [
    { key: 'OPENAI_API_KEY', value: config.openai.apiKey },
    { key: 'PINECONE_API_KEY', value: config.pinecone.apiKey },
    { key: 'PINECONE_ENVIRONMENT', value: config.pinecone.environment },
  ];

  const missing = required.filter(({ value }) => !value);
  
  if (missing.length > 0) {
    console.error('Missing required environment variables:');
    missing.forEach(({ key }) => console.error(`- ${key}`));
    console.error('\nPlease create a .env file with the following variables:');
    console.error('OPENAI_API_KEY=your_openai_api_key_here');
    console.error('PINECONE_API_KEY=your_pinecone_api_key_here');
    console.error('PINECONE_ENVIRONMENT=your_pinecone_environment_here');
    console.error('PINECONE_INDEX_NAME=token-metadata-index');
    console.error('PORT=3000');
    process.exit(1);
  }
};

export { config, validateConfig }; 