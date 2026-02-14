import React from 'react';
import { useIntegrity } from '../hooks/useIntegrity';

const PROBATIONARY_THRESHOLD = 0.5;

interface GuardProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

export const Guard: React.FC<GuardProps> = ({ children, fallback }) => {
    const { giniScore, loading, error, status } = useIntegrity();

    if (loading) {
        return <div className="p-4 text-center">Verifying integrity...</div>;
    }

    if (error) {
        return <div className="p-4 text-red-500">Error verifying wallet: {error}</div>;
    }

    // Logic: Block if Gini > 0.5 or status is explicitly SYBIL
    // Note: Gini <= 0.5 is Probationary or Verified. > 0.5 is Sybil.
    const isSybil = (giniScore !== null && giniScore > PROBATIONARY_THRESHOLD) || status === 'SYBIL';

    if (isSybil) {
        if (fallback) {
            return <>{fallback}</>;
        }
        return (
            <div className="guard-blocked p-4 bg-red-100 text-red-800 rounded-lg border border-red-200">
                <h3 className="font-bold text-lg mb-2">Protected Swap: Access Denied</h3>
                <p>Your wallet integrity score indicates high risk (Sybil detected).</p>
                <div className="mt-2 text-sm">
                    <span>Gini Score: {giniScore?.toFixed(3)}</span>
                    <span className="ml-2">(Threshold: {PROBATIONARY_THRESHOLD})</span>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};
