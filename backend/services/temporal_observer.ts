import { Connection } from '@solana/web3.js';

interface ClusterWindow {
    timestamp: number;
    wallets: Set<string>;
    instructionData: string;
}

export class TemporalObserver {
    private connection: Connection; // 🛡️ Added: Store the connection
    private buffer: Map<string, ClusterWindow> = new Map();
    private readonly WINDOW_MS = 2000;

    // 🛡️ Added: Constructor to accept the RPC URL
    constructor(rpcUrl: string) {
        this.connection = new Connection(rpcUrl, 'confirmed');
    }

    public async observeTransaction(wallet: string, target: string, data: string): Promise<number> {
        const now = Date.now();
        const clusterId = `${target}_${data.substring(0, 16)}`;

        let window = this.buffer.get(clusterId);

        if (!window || (now - window.timestamp) > this.WINDOW_MS) {
            this.buffer.set(clusterId, {
                timestamp: now,
                wallets: new Set([wallet]),
                instructionData: data
            });
            return 0;
        }

        window.wallets.add(wallet);

        if (window.wallets.size >= 3) {
            const syncIndex = Math.min(window.wallets.size / 10, 1.0);
            console.log(`[Temporal Alert] Sync Index ${syncIndex.toFixed(2)} for cluster ${clusterId}`);
            return syncIndex;
        }

        return 0;
    }
}