import {
    Connection,
    Keypair,
    PublicKey,
    Transaction,
    SystemProgram,
    TransactionInstruction,
} from "@solana/web3.js";
import * as nacl from "tweetnacl";
import crypto from "crypto";
import dotenv from "dotenv";
import { TemporalObserver } from "./temporal_observer";

dotenv.config();

// --- 🛡️ INITIALIZATION ---
const observer = new TemporalObserver(process.env.RPC_URL || "https://api.devnet.solana.com");
const PROGRAM_ID = new PublicKey("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");
const MOCK_WALLET = new PublicKey("11111111111111111111111111111111");

// Load Notary Secret
if (!process.env.NOTARY_SECRET) throw new Error("NOTARY_SECRET not set.");

let notarySecret: Uint8Array;
try {
    const parsed = JSON.parse(process.env.NOTARY_SECRET);
    notarySecret = Array.isArray(parsed) ? new Uint8Array(parsed) : Uint8Array.from(Buffer.from(process.env.NOTARY_SECRET.replace(/^0x/, ''), 'hex'));
} catch (e) {
    notarySecret = Uint8Array.from(Buffer.from(process.env.NOTARY_SECRET.replace(/^0x/, ''), 'hex'));
}
const NOTARY_KEYPAIR = Keypair.fromSecretKey(notarySecret);

interface IntegrityScore {
    gini: number;
    hhi: number;
    status: string;
}

// --- 🛠️ LOGIC ---

async function updateOnChainPDA(wallet: PublicKey, score: IntegrityScore) {
    const connection = new Connection(process.env.RPC_URL || "https://api.devnet.solana.com", "confirmed");

    // Derive PDA using "config" seed
    const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("config"), wallet.toBuffer()],
        PROGRAM_ID
    );

    // 1. Calculate Instruction Data & Discriminator
    const discriminator = crypto.createHash("sha256").update("global:update_integrity").digest().subarray(0, 8);
    const giniBuffer = Buffer.alloc(2);
    giniBuffer.writeUInt16LE(Math.floor(score.gini * 10000));
    const hhiBuffer = Buffer.alloc(2);
    hhiBuffer.writeUInt16LE(Math.floor(score.hhi * 10000));
    const statusBuffer = Buffer.alloc(1);

    // 🛡️ SYBIL INTERCEPTION
    // Map score.status to initial value
    let statusVal = (score.status === 'VERIFIED') ? 1 : 2;

    // Perform Temporal Analysis
    const rawPayload = Buffer.concat([giniBuffer, hhiBuffer]).toString('hex');
    const syncIndex = await observer.observeTransaction(wallet.toBase58(), PROGRAM_ID.toBase58(), rawPayload);

    if (syncIndex > 0.5) {
        console.warn(`[!] High Temporal Sync Index (${syncIndex}). Overriding status to PROBATIONARY.`);
        statusVal = 2; // Force PROBATIONARY
    }

    statusBuffer.writeUInt8(statusVal);
    const data = Buffer.concat([discriminator, giniBuffer, hhiBuffer, statusBuffer]);

    // 2. Build Transaction
    const instruction = new TransactionInstruction({
        keys: [
            { pubkey: pda, isSigner: false, isWritable: true },
            { pubkey: wallet, isSigner: false, isWritable: false },
            { pubkey: NOTARY_KEYPAIR.publicKey, isSigner: true, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data: data,
    });

    const transaction = new Transaction().add(instruction);
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = NOTARY_KEYPAIR.publicKey;
    transaction.sign(NOTARY_KEYPAIR);

    // 3. Security Verification
    if (!transaction.verifySignatures()) throw new Error("Transaction signature failed!");

    console.log(`✅ Sovereign V2: Notary Sync Complete. Sync Index: ${syncIndex}`);
}

async function main() {
    try {
        // Simulation: Fetching score for mock wallet
        const score = { gini: 0.25, hhi: 0.15, status: "VERIFIED" };
        await updateOnChainPDA(MOCK_WALLET, score);
    } catch (e) {
        console.error("Error during notary sync:", e);
        process.exit(1);
    }
}

main();