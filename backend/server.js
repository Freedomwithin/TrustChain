const express = require('express');
const cors = require('cors');
const { Connection, PublicKey } = require('@solana/web3.js');

const app = express();
const port = 3001;

// Solana Mainnet RPC (using public endpoint for demo)
const rpcEndpoint = 'https://api.mainnet-beta.solana.com';
const connection = new Connection(rpcEndpoint, 'confirmed');

// Middleware
app.use(cors({
  origin: ['https://trustchain-2-frontend.vercel.app', /.vercel.app$/],
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
const getMockData = (poolId) => {
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

  return mockData[poolId] || {
    giniScore: 0,
    extractivenessScore: 0,
    topHolders: 0,
    totalLiquidity: 0
  };
};

app.get('/api/pool/:id/integrity', async (req, res) => {
  const poolId = req.params.id;
  await delay(500);

  if (process.env.MOCK_MODE !== 'false') {
    return res.json(getMockData(poolId));
  }
  return res.status(501).json({ error: 'Real integrity check not implemented in this demo version' });
});

// New Verification Endpoint
app.get('/api/verify', async (req, res) => {
  // Return Gini score for a default or query param pool
  const poolId = req.query.poolId || 'SOL-USDC';
  await delay(500);

  // Reuse mock logic to ensure consistency
  if (process.env.MOCK_MODE !== 'false') {
    return res.json(getMockData(poolId));
  }
  return res.status(501).json({ error: 'Verification not implemented' });
});

// Real endpoint to fetch Solana transaction history (Optional usage)
app.get('/api/wallet/:address/history', async (req, res) => {
  try {
    const { address } = req.params;
    const pubKey = new PublicKey(address);

    // Fetch last 15 signatures
    const signatures = await connection.getSignaturesForAddress(pubKey, { limit: 15 });

    res.json(signatures);
  } catch (error) {
    console.error('Solana RPC Error:', error);
    res.status(500).json({ error: 'Failed to fetch Solana history' });
  }
});

// Start server
app.listen(port, () => {
  console.log(`TrustChain Solana Backend running on port ${port}`);
});
