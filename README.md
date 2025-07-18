# AI Token Bot 🤖

A sophisticated AI chatbot that uses vector embeddings and OpenAI to provide intelligent responses about cryptocurrency tokens and their metadata. The system handles large token metadata collections by splitting them into chunks, generating embeddings, and performing vector similarity searches.

## 🚀 Features

- **Vector Search**: Uses Pinecone for efficient similarity search across large token datasets
- **Smart Chunking**: Automatically splits large metadata into manageable pieces for embedding
- **OpenAI Integration**: Leverages GPT models and embeddings for natural language responses
- **Real-time Chat**: Socket.io support for real-time conversations
- **REST API**: Complete API for programmatic access
- **Web Interface**: Simple web UI for testing and interaction
- **Conversation Memory**: Maintains context across chat sessions
- **Hybrid Search**: Combines semantic similarity with keyword matching

## 🛠 Tech Stack

- **Backend**: Node.js + TypeScript + Express
- **Vector Database**: Pinecone
- **AI/ML**: OpenAI (GPT-4 + Embeddings)
- **Real-time**: Socket.io
- **HTTP Client**: Axios
- **Environment**: dotenv

## 📋 Prerequisites

- Node.js (v18 or higher)
- OpenAI API key
- Pinecone account and API key

## ⚙️ Installation

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd ai-token-bot
   npm install
   ```

2. **Environment Configuration:**
   Create a `.env` file in the project root:
   ```env
   # OpenAI Configuration
   OPENAI_API_KEY=your_openai_api_key_here
   OPENAI_MODEL=gpt-4
   EMBEDDING_MODEL=text-embedding-3-small

   # Pinecone Configuration  
   PINECONE_API_KEY=your_pinecone_api_key_here
   PINECONE_ENVIRONMENT=your_pinecone_environment_here
   PINECONE_INDEX_NAME=token-metadata-index

   # Server Configuration
   PORT=3000
   NODE_ENV=development

   # Optional: Embedding Configuration
   CHUNK_SIZE=1000
   CHUNK_OVERLAP=200
   MAX_CONTEXT_LENGTH=8000
   TOP_K_RESULTS=10
   SIMILARITY_THRESHOLD=0.7
   ```

3. **Start the application:**
   ```bash
   # Development mode
   npm run dev

   # Production mode
   npm run build
   npm start
   ```

## 🎯 Usage

### Web Interface
Visit `http://localhost:3000` for a simple chat interface.

### API Endpoints

#### 1. Health Check
```bash
GET http://localhost:3000/health
```

#### 2. Index Token Metadata
```bash
POST http://localhost:3000/api/index
Content-Type: application/json

{
  "tokens": [
    {
      "id": "bitcoin-btc",
      "name": "Bitcoin",
      "symbol": "BTC",
      "description": "Bitcoin is a decentralized digital currency...",
      "price": 45000,
      "marketCap": 945000000000,
      "website": "https://bitcoin.org",
      "tags": ["currency", "store-of-value"],
      "analytics": {
        "priceChange24h": 2.5,
        "volatility": 0.04
      }
    }
  ]
}
```

#### 3. Chat Query
```bash
POST http://localhost:3000/api/chat
Content-Type: application/json

{
  "query": "Tell me about Bitcoin's price performance",
  "conversationHistory": []
}
```

#### 4. Search Specific Token
```bash
GET http://localhost:3000/api/search/BTC
```

#### 5. Get Index Statistics
```bash
GET http://localhost:3000/api/stats
```

#### 6. Clear Index
```bash
DELETE http://localhost:3000/api/index
```

### Socket.io Real-time Chat

Connect to `ws://localhost:3000` and use these events:

```javascript
// Connect to server
const socket = io('http://localhost:3000');

// Send chat message
socket.emit('chatMessage', { 
  query: 'What is the market cap of Ethereum?' 
});

// Receive response
socket.on('chatResponse', (data) => {
  console.log('Response:', data.response);
  console.log('Sources:', data.sources);
  console.log('Confidence:', data.confidence);
});

// Handle errors
socket.on('error', (error) => {
  console.error('Error:', error.message);
});
```

## 📊 Token Metadata Schema

The system expects token metadata in the following format:

```typescript
interface TokenMetadata {
  id: string;                    // Unique identifier
  name: string;                  // Token name
  symbol: string;                // Token symbol
  description?: string;          // Token description
  contractAddress?: string;      // Smart contract address
  network?: string;              // Blockchain network
  totalSupply?: string;          // Total token supply
  decimals?: number;             // Token decimals
  price?: number;                // Current price
  marketCap?: number;            // Market capitalization
  volume24h?: number;            // 24h trading volume
  holders?: number;              // Number of holders
  website?: string;              // Official website
  whitepaper?: string;           // Whitepaper URL
  github?: string;               // GitHub repository
  twitter?: string;              // Twitter handle
  telegram?: string;             // Telegram group
  discord?: string;              // Discord server
  tags?: string[];               // Category tags
  launchDate?: Date;             // Launch date
  audit?: {                      // Audit information
    status: string;
    report?: string;
    score?: number;
  };
  risk?: {                       // Risk assessment
    level: string;
    factors: string[];
  };
  analytics?: {                  // Analytics data
    priceChange24h?: number;
    priceChange7d?: number;
    priceChange30d?: number;
    volatility?: number;
    liquidityScore?: number;
  };
  additional?: Record<string, any>; // Additional custom fields
}
```

## 🔧 Configuration

### Chunking Settings
- `CHUNK_SIZE`: Maximum size of text chunks (default: 1000)
- `CHUNK_OVERLAP`: Overlap between chunks (default: 200)
- `MAX_CONTEXT_LENGTH`: Maximum context length for GPT (default: 8000)

### Vector Search Settings
- `TOP_K_RESULTS`: Number of similar results to return (default: 10)
- `SIMILARITY_THRESHOLD`: Minimum similarity score (default: 0.7)

### Models
- **Chat**: GPT-4 (configurable)
- **Embeddings**: text-embedding-3-small (1536 dimensions)

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Client Layer                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │ Web Interface│  │  REST API   │  │  Socket.io  │ │
│  └─────────────┘  └─────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────┘
                           │
┌─────────────────────────────────────────────────────┐
│                 Application Layer                   │
│  ┌─────────────────────────────────────────────────┐ │
│  │            ChatbotService                       │ │
│  │  • Query processing                             │ │
│  │  • Context preparation                          │ │
│  │  • Response generation                          │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
                           │
┌─────────────────────────────────────────────────────┐
│                  Service Layer                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │ Embedding   │  │Vector Search│  │  Chunking   │ │
│  │  Service    │  │   Service   │  │   Utils     │ │
│  └─────────────┘  └─────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────┘
                           │
┌─────────────────────────────────────────────────────┐
│                External Services                    │
│  ┌─────────────┐  ┌─────────────┐                  │
│  │   OpenAI    │  │  Pinecone   │                  │
│  │    API      │  │   Vector    │                  │
│  │             │  │  Database   │                  │
│  └─────────────┘  └─────────────┘                  │
└─────────────────────────────────────────────────────┘
```

## 📝 API Response Examples

### Chat Response
```json
{
  "response": "Bitcoin (BTC) is currently trading at $45,000 with a market cap of $945 billion...",
  "sources": [
    {
      "id": "bitcoin-btc-chunk-0",
      "score": 0.92,
      "metadata": {
        "tokenId": "bitcoin-btc",
        "tokenName": "Bitcoin",
        "tokenSymbol": "BTC"
      },
      "content": "Bitcoin is a decentralized digital currency..."
    }
  ],
  "tokensUsed": 245,
  "confidence": 0.89,
  "processingTime": 1250
}
```

### Indexing Response
```json
{
  "success": true,
  "indexedTokens": 100,
  "totalChunks": 342,
  "error": null
}
```

## 🚨 Error Handling

The system includes comprehensive error handling:

- **Configuration Errors**: Missing environment variables
- **API Errors**: OpenAI and Pinecone API issues  
- **Data Validation**: Invalid token metadata
- **Rate Limiting**: Automatic retry with backoff
- **Connection Issues**: Graceful degradation

## 🔍 Troubleshooting

### Common Issues

1. **Missing Environment Variables**
   - Ensure all required API keys are set
   - Check `.env` file format

2. **Pinecone Index Issues**
   - Verify Pinecone environment and API key
   - Check index name configuration

3. **OpenAI API Errors**
   - Verify API key validity
   - Check quota and rate limits

4. **Memory Issues**
   - Adjust chunk size for large datasets
   - Monitor token usage

### Debug Mode
Set `NODE_ENV=development` for detailed logging.

## 📈 Performance Considerations

- **Batch Processing**: Embeddings are processed in batches
- **Rate Limiting**: Built-in delays between API calls
- **Memory Management**: Automatic cleanup of old conversations
- **Chunking Strategy**: Optimized for embedding quality and search performance

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the ISC License.

## 🆘 Support

For issues and questions:
- Check the troubleshooting section
- Review API documentation
- Verify environment configuration
- Check service health endpoints

---

**Built with ❤️ using OpenAI, Pinecone, and modern TypeScript** 