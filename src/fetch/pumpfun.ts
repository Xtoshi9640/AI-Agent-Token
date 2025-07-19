import * as dotenv from 'dotenv';
import { Connection, PublicKey } from '@solana/web3.js';

dotenv.config();

interface TokenMint {
    decimals : number,
    freezeAuthority : null,
    isInitialized : any,
    mintAuthority : any,
    supply : string
}

interface PumpFunToken {
    tokenAddress: string;
    name: string | null;
    priceUsd: string;
    marketCap?: number;
}

interface PumpFunResponse {
    result: PumpFunToken[];
}

async function fetchNewPumpFunTokens() {
  const connection = new Connection(process.env.rpc_url as string, 'confirmed');
  const response = await fetch(
    "https://solana-gateway.moralis.io/token/mainnet/exchange/pumpfun/new?limit=10",
    {
      headers: {
        accept: "application/json",
        "X-API-Key": process.env.morailis_api_key as string,
      },
    }
  );

  const data = await response.json() as PumpFunResponse;

  console.log('data ===>', data);
  const tokenList: PumpFunToken[] = [];
  const tokenData = await connection.getParsedAccountInfo(new PublicKey(data.result[0].tokenAddress));
  console.log("tokenData ===>", (tokenData.value?.data as any).parsed);

  for(let i = 0; i < data.result.length; i++) {
    if(data.result[i].name == null) continue;
    try {
        const tokenData = await connection.getParsedAccountInfo(new PublicKey(data.result[i].tokenAddress));
        const tokenMint : TokenMint = (tokenData.value?.data as any).parsed.info;
        data.result[i].marketCap = parseInt(tokenMint.supply) / (Math.pow(10, tokenMint.decimals)) * parseFloat(data.result[i].priceUsd);
        tokenList.push(data.result[i]);
    } catch(err) {
        continue;
    }
  }
  console.log("token list ===>", tokenList);
  return tokenList;
}