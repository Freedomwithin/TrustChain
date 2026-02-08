import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import Navbar from './components/Navbar.jsx';
import './App.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://trustchain-2-backend.vercel.app';

export const TRUSTED_THRESHOLD = 0.1;
export const PROBATIONARY_THRESHOLD = 0.5;

export const getStatusDisplay = (status, score) => {
  if (status === 'ERROR' || score == null || Number.isNaN(score)) {
    return { label: 'ERROR', color: 'red' };
  }
  if (status === 'PROBATIONARY') return { label: 'PROBATIONARY ⚠️', color: 'orange' };
  if (score < TRUSTED_THRESHOLD) return { label: 'TRUSTED ACTOR ✓', color: 'green' };
  if (score <= PROBATIONARY_THRESHOLD) return { label: 'PROBATIONARY ⚠️', color: 'orange' };
  return { label: 'POTENTIAL SYBIL 🚨', color: 'red' };
};

function WalletIntegrity() {
  const { publicKey, connected } = useWallet();
  const [giniScore, setGiniScore] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (connected && publicKey) {
      setLoading(true);
      fetch(`${API_BASE_URL}/api/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: publicKey.toBase58() })
      })
      .then(res => res.json())
      .then(data => {
        setGiniScore(parseFloat(data.giniScore));
        setStatus(data.status);
        setLoading(false);
      })
      .catch(err => {
        console.error('Verify error:', err);
        setLoading(false);
      });
    } else {
      setGiniScore(null);
    }
  }, [connected, publicKey]);

  if (!connected) return null;

  const display = getStatusDisplay(status, giniScore);

  return (
    <div className="pool-card" style={{ marginBottom: '2rem', maxWidth: '600px', margin: '0 auto 2rem auto' }}>
      <h3>Your Wallet Integrity</h3>
      {loading ? (
        <span className="badge loading">Verifying...</span>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <span className={`badge risk-${display.color}`}>
            {display.label}
          </span>
          <div style={{ marginTop: '1rem' }}>
            <small>Personal Gini Score: {giniScore?.toFixed(4)}</small>
            {status === 'PROBATIONARY' && <div style={{ fontSize: '0.8rem', marginTop: '0.5rem', color: '#ffa500' }}>Limited history: Minimum 2 transactions required for full verification.</div>}
            {status === 'ERROR' && <div style={{ fontSize: '0.8rem', marginTop: '0.5rem', color: '#ff4d4d' }}>Verification service error. Defaulting to risk mode.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function PoolIntegrityBadge({ integrity, loading }) {
  if (loading) return <span className="badge loading">Analyzing...</span>;

  const display = getStatusDisplay(integrity?.status, integrity?.extractivenessScore || 0);

  return (
    <span className={`badge risk-${display.color}`}>
      {display.label}
      <br />
      <small>Gini: {integrity?.giniScore?.toFixed(3) || '0.500'}</small>
    </span>
  );
}

const pools = [
  { id: 'SOL-USDC', name: 'SOL-USDC Pool' },
  { id: 'JUP-SOL', name: 'JUP-SOL Pool' },
  { id: 'RAY-SOL', name: 'RAY-SOL Pool' },
];

function App() {
  const [poolIntegrity, setPoolIntegrity] = useState({});
  const [loadingPools, setLoadingPools] = useState(true);

  useEffect(() => {
    const poolIds = pools.map(p => p.id);
    fetch(`${API_BASE_URL}/api/pools/integrity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ poolIds })
    })
    .then(res => res.json())
    .then(data => {
      setPoolIntegrity(data);
      setLoadingPools(false);
    })
    .catch(err => {
      console.error('Batch API error:', err);
      setLoadingPools(false);
    });
  }, []);

  return (
    <div className="App">
      <Navbar />
      <div className="hero-content">
        <h1>🚀 TrustChain - Live Solana Pools</h1>
        <WalletIntegrity />
        <div className="pool-grid">
          {pools.map(pool => (
            <div key={pool.id} className="pool-card">
              <h3>{pool.name}</h3>
              <PoolIntegrityBadge
                integrity={poolIntegrity[pool.id]}
                loading={loadingPools}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
