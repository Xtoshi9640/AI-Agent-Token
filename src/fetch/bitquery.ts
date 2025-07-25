import fetch from 'node-fetch';

// Your Bitquery API key
const BITQUERY_API_KEY = 'YOUR_BITQUERY_API_KEY';
const BITQUERY_API_URL = 'https://graphql.bitquery.io/';

// Bitquery allows 10 rows per request and 10 requests per minute free, so to get 1000 tokens, 
// you batch 100 requests (each fetching 10 tokens).
// Each request uses a pagination skip argument to get different tokens.

// GraphQL query template with pagination (skip)
function buildQuery(skip: number): string {
  return `
  {
    solana {
      tokens(
        options: {offset: ${skip}, limit: 10, asc: "tokenName"}
        network: solana
        where: {
          platform: {is: "pumpfun"}
          isFungible: {is: true}
        }
      ) {
        tokenName
        symbol
        price {
          priceUsd
          timestamp
        }
        marketCapUSD
      }
    }
  }
  `;
}

async function fetchTokens(skip: number) {
  const query = buildQuery(skip);

  const response = await fetch(BITQUERY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': BITQUERY_API_KEY,
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
  }

  const result = await response.json();
  
  // Add debugging to see the actual response structure
  console.log('API Response:', JSON.stringify(result, null, 2));
  
  // Check if the response has errors
  if (result.errors) {
    console.error('GraphQL errors:', result.errors);
    throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
  }
  
  // Safely access nested properties
  if (!result.data) {
    throw new Error('No data in response');
  }
  
  if (!result.data.solana) {
    throw new Error('No solana data in response');
  }
  
  if (!result.data.solana.tokens) {
    console.warn('No tokens found in response');
    return [];
  }
  
  return result.data.solana.tokens;
}

async function fetch1000Tokens() {
  const allTokens: any[] = [];

  for (let i = 0; i < 100; i++) { // 100 requests, 10 tokens each = 1000 tokens
    try {
      // Pause between requests if needed to avoid rate limits
      // For free plan: max 10 requests per minute => wait 6 seconds between 10 requests
      if (i > 0 && i % 10 === 0) {
        console.log('Pausing to respect rate limits...');
        await new Promise(r => setTimeout(r, 60000)); // wait 60 seconds every 10 requests
      }

      console.log(`Fetching tokens batch ${i + 1}`);
      const tokens = await fetchTokens(i * 10);
      allTokens.push(...tokens);
    } catch (error) {
      console.error(`Error fetching batch ${i + 1}:`, error);
      break;
    }
  }
  return allTokens;
}

(async () => {
  try {
    const tokens = await fetch1000Tokens();
    console.log('Fetched tokens:', tokens.length);

    // Example output format:
    tokens.forEach((token, idx) => {
      console.log(`${idx + 1}. ${token.tokenName} (${token.symbol}) - Price: ${token.price?.priceUsd ?? 'N/A'} USD - Market Cap: ${token.marketCapUSD ?? 'N/A'} - Timestamp: ${token.price?.timestamp ?? 'N/A'}`);
    });
  } catch (error) {
    console.error('Failed to fetch tokens:', error);
  }
})();