import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://trustchain-2-backend.vercel.app';

export interface IntegrityData {
    giniScore: number | null;
    hhiScore: number | null;
    status: string | null;
    loading: boolean;
    error: string | null;
}

export function useIntegrity(): IntegrityData {
    const { publicKey, connected } = useWallet();
    const [giniScore, setGiniScore] = useState<number | null>(null);
    const [hhiScore, setHhiScore] = useState<number | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (connected && publicKey) {
            setLoading(true);
            setError(null);

            fetch(`${API_BASE_URL}/api/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address: publicKey.toBase58() })
            })
            .then(res => {
                if (!res.ok) {
                    throw new Error('Failed to fetch integrity score');
                }
                return res.json();
            })
            .then(data => {
                setGiniScore(data.giniScore != null ? parseFloat(data.giniScore) : null);
                setHhiScore(data.hhiScore != null ? parseFloat(data.hhiScore) : null);
                setStatus(data.status);
                setLoading(false);
            })
            .catch(err => {
                console.error('Verify error:', err);
                setError(err instanceof Error ? err.message : 'Unknown error');
                setLoading(false);
            });
        } else {
            setGiniScore(null);
            setHhiScore(null);
            setStatus(null);
            setError(null);
            setLoading(false);
        }
    }, [connected, publicKey]);

    return { giniScore, hhiScore, status, loading, error };
}
