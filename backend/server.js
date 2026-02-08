const express = require('express');
const cors = require('cors');
const { Connection, PublicKey } = require('@solana/web3.js');
const { calculateGini, calculateHHI } = require('./integrityEngine');

const app = express();
const port = 3001;

// Solana Mainnet RPC (using public endpoint for demo)
const rpcEndpoint = 'https://api.mainnet-beta.solana.com';
const connection = new Connection(rpcEndpoint, 'confirmed');

// Middleware
app.use(cors({
  origin: ['https://trustchain-2-frontend.vercel.app', /\.vercel\.app$/],
  methods: ['GET', 'POST'],
  credentials: true
}));

app.use(express.json());

// Root route
app.get('/', (req, res) => res.json({ status: 'TrustChain Solana API Active' }));

// Helper to delay response (prevent rate limits)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * MOCK_MODE: Returns hardcoded integrity data to bypass RPC rate limits.
 * Real logic would query Solana history for the pool address.
 */
app.get('/api/pool/:id/integrity', async (req, res) => {
  const poolId = req.params.id;

  // Simulate network delay
  await delay(500);

  if (process.env.MOCK_MODE !== 'false') {
    // MOCK DATA for specific pools (aligned with frontend)
  const mockData = {
    'SOL-USDC': {
      giniScore: 0.25,
      extractivenessScore: 0.05, // Low Risk
      topHolders: 15,
      totalLiquidity: 5000000
    },
    'JUP-SOL': {
      giniScore: 0.42,
      extractivenessScore: 0.35, // Medium Risk
      topHolders: 8,
      totalLiquidity: 1200000
    },
    'RAY-SOL': {
      giniScore: 0.78,
      extractivenessScore: 0.85, // High Risk
      topHolders: 3,
      totalLiquidity: 300000
    }
  };

    const data = mockData[poolId] || {
      giniScore: 0.5,
      status: 'PROBATIONARY',
      extractivenessScore: 0.5,
      topHolders: 0,
      totalLiquidity: 0
    };
    return res.json(data);
  }

  // Real logic placeholder (would call integrityEngine if enabled)
  return res.status(501).json({ error: 'Real integrity check not implemented in this demo version' });
});

/**
 * BATCH ENDPOINT: Fetches integrity data for multiple pools in one request.
 * Optimization to prevent N+1 API calls from frontend.
 */
app.post('/api/pools/integrity', async (req, res) => {
  const { poolIds } = req.body;

  if (!Array.isArray(poolIds)) {
    return res.status(400).json({ error: 'poolIds must be an array' });
  }

  // Simulate network delay (only once for the entire batch)
  await delay(500);

  if (process.env.MOCK_MODE !== 'false') {
    const mockData = {
      'SOL-USDC': {
        giniScore: 0.25,
        extractivenessScore: 0.05,
        topHolders: 15,
        totalLiquidity: 5000000
      },
      'JUP-SOL': {
        giniScore: 0.42,
        extractivenessScore: 0.35,
        topHolders: 8,
        totalLiquidity: 1200000
      },
      'RAY-SOL': {
        giniScore: 0.78,
        extractivenessScore: 0.85,
        topHolders: 3,
        totalLiquidity: 300000
      }
    };

    const results = {};
    poolIds.forEach(id => {
      // Fallback for unknown pools to prevent Sybil attacks
      results[id] = mockData[id] || {
        giniScore: 0.5,
        status: 'PROBATIONARY',
        extractivenessScore: 0.5,
        topHolders: 0,
        totalLiquidity: 0
      };
    });

    return res.json(results);
  }

  return res.status(501).json({ error: 'Real batch integrity check not implemented' });
});

// Real endpoint to fetch Solana transaction history (Optional usage)
app.get('/api/wallet/:address/history', async (req, res) => {
  const { address } = req.params;

  // Validate Solana address format (Base58, 32-44 chars)
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  if (!address || typeof address !== 'string' || !base58Regex.test(address)) {
    return res.status(400).json({ error: 'Invalid Solana wallet address format' });
  }

  try {
    const pubKey = new PublicKey(address);

    // Fetch last 15 signatures
    const signatures = await connection.getSignaturesForAddress(pubKey, { limit: 15 });

    res.json(signatures);
  } catch (error) {
    console.error('Solana RPC Error:', error);
    res.status(500).json({ error: 'Failed to fetch Solana history' });
  }
});

// Standardized Verification Endpoint
app.post('/api/verify', async (req, res) => {
  const { address } = req.body;
  if (!address) {
    return res.status(400).json({ error: 'Wallet address is required' });
  }

  // Validate Solana address format (Base58, 32-44 chars)
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  if (typeof address !== 'string' || !base58Regex.test(address)) {
    return res.status(400).json({ error: 'Invalid Solana wallet address format' });
  }

  // Integration Mocking for Verification
  if (address === '11111111111111111111111111111111') {
    return res.json({ giniScore: 0.5, status: 'PROBATIONARY' });
  }
  if (address === '22222222222222222222222222222222') {
    return res.json({ giniScore: 0.1, hhiScore: 0.05, status: 'VERIFIED' });
  }

  try {
    const pubKey = new PublicKey(address);

    // Fetch recent transaction signatures (limit to 5 for performance and rate limits)
    const signatures = await connection.getSignaturesForAddress(pubKey, { limit: 5 });

    // Thin Wallet Logic: Default to 0.5 (Probationary) if not enough history
    // This prevents Sybil attacks where fresh wallets appear "perfect"
    if (signatures.length < 2) {
      return res.json({ giniScore: 0.5, status: 'PROBATIONARY' });
    }

    const values = [];

    // Fetch transactions sequentially to avoid rate limits
    for (const sigInfo of signatures) {
      try {
        await delay(200); // Rate limit throttle
        const tx = await connection.getParsedTransaction(sigInfo.signature, {
          maxSupportedTransactionVersion: 0
        });

        if (!tx || !tx.meta) continue;

        // Find the account index for the wallet
        const accountIndex = tx.transaction.message.accountKeys.findIndex(
          key => key.pubkey.toBase58() === address
        );

        if (accountIndex !== -1) {
          // Calculate the absolute change in SOL balance (in lamports)
          const pre = tx.meta.preBalances[accountIndex] || 0;
          const post = tx.meta.postBalances[accountIndex] || 0;
          const change = Math.abs(pre - post);
          values.push(change);
        }
      } catch (err) {
        console.warn(`Failed to fetch tx ${sigInfo.signature}:`, err.message);
        continue;
      }
    }

    // Calculate Real Gini Score
    const realGini = calculateGini(values);

    // Calculate HHI Score (Gas-efficient proxy)
    const hhiScore = calculateHHI(values);

    // Scaling Logic: Move from 0.5 (default) toward real Gini as history grows
    // Weight of real data increases with number of transactions (2 to 5)
    // len=2: 25% real, 75% default
    // len=5: 100% real
    const dataCount = signatures.length;
    const trustFactor = Math.min((dataCount - 1) / 4, 1);

    // Weighted Average
    const giniScore = (0.5 * (1 - trustFactor)) + (realGini * trustFactor);

    return res.json({ giniScore, hhiScore, status: 'VERIFIED' });

  } catch (error) {
    console.error('Error calculating integrity:', error);
    // Fallback to safe default (0.5) on RPC error to avoid marking as Trusted
    return res.json({ giniScore: 0.5, status: 'ERROR' });
  }
});

// Start server
app.listen(port, () => {
  console.log(`TrustChain Solana Backend running on port ${port}`);
});
