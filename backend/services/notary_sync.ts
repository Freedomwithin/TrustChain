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

dotenv.config();

// Mock data
const MOCK_WALLET = new PublicKey("11111111111111111111111111111111");

// Load Notary Secret from Environment Variable
if (!process.env.NOTARY_SECRET) {
    throw new Error("NOTARY_SECRET environment variable not set. Please set it in .env file.");
}

// Support both JSON array format and Hex string format for convenience
let notarySecret: Uint8Array;
try {
    const parsed = JSON.parse(process.env.NOTARY_SECRET);
    if (Array.isArray(parsed)) {
        notarySecret = new Uint8Array(parsed);
    } else {
        throw new Error("NOTARY_SECRET JSON is not an array");
    }
} catch (e) {
    // If not JSON, try Hex
    // Remove '0x' prefix if present
    const cleanHex = process.env.NOTARY_SECRET.replace(/^0x/, '');
    if (/^[0-9a-fA-F]+$/.test(cleanHex)) {
         notarySecret = Uint8Array.from(Buffer.from(cleanHex, 'hex'));
    } else {
        throw new Error("Invalid NOTARY_SECRET format. Must be JSON array of numbers or Hex string.");
    }
}

const NOTARY_KEYPAIR = Keypair.fromSecretKey(notarySecret);

// Placeholder Program ID from lib.rs
const PROGRAM_ID = new PublicKey("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

interface IntegrityScore {
  gini: number;
  hhi: number;
  status: string;
}

// Mock function to fetch score from Integrity Engine
async function fetchVerifiedScore(wallet: PublicKey): Promise<IntegrityScore> {
  // In reality, this would call backend/integrityEngine.js logic
  console.log(`Fetching score for ${wallet.toBase58()}...`);
  return {
    gini: 0.25,
    hhi: 0.15,
    status: "VERIFIED",
  };
}

async function updateOnChainPDA(wallet: PublicKey, score: IntegrityScore) {
  // Connect to devnet (or localnet)
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  // PDA derivation: seeds = [b"integrity", user.key().as_ref()]
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config"), wallet.toBuffer()],
    PROGRAM_ID
  );

  console.log(`PDA for wallet ${wallet.toBase58()}: ${pda.toBase58()}`);

  // Calculate Discriminator for "global:update_integrity"
  // Anchor uses sha256("global:<instruction_name>") and takes first 8 bytes
  const discriminator = crypto.createHash("sha256").update("global:update_integrity").digest().subarray(0, 8);

  const giniBuffer = Buffer.alloc(2);
  giniBuffer.writeUInt16LE(Math.floor(score.gini * 10000)); // Scale by 10000

  const hhiBuffer = Buffer.alloc(2);
  hhiBuffer.writeUInt16LE(Math.floor(score.hhi * 10000)); // Scale by 10000

  const statusBuffer = Buffer.alloc(1);
  // status: VERIFIED = 1, PROBATIONARY = 2, ERROR = 0 (Example mapping)
  let statusVal = 0;
  if (score.status === 'VERIFIED') statusVal = 1;
  else if (score.status === 'PROBATIONARY') statusVal = 2;

  statusBuffer.writeUInt8(statusVal);

  const data = Buffer.concat([discriminator, giniBuffer, hhiBuffer, statusBuffer]);

  // Construct instruction
  // Accounts must match the UpdateIntegrity struct in lib.rs:
  // 1. user_integrity (PDA, mut)
  // 2. user (Unchecked, not mut)
  // 3. notary (Signer, mut)
  // 4. system_program
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: pda, isSigner: false, isWritable: true }, // user_integrity
      { pubkey: wallet, isSigner: false, isWritable: false }, // user
      { pubkey: NOTARY_KEYPAIR.publicKey, isSigner: true, isWritable: true }, // notary
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
    ],
    programId: PROGRAM_ID,
    data: data,
  });

  const transaction = new Transaction().add(instruction);

  // Sign transaction (Offline signing simulation)
  // We need a recent blockhash to sign.
  try {
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
  } catch (err) {
      console.warn("Could not fetch blockhash (network issue?), using mock blockhash for simulation.");
      transaction.recentBlockhash = Keypair.generate().publicKey.toBase58(); // Mock blockhash
  }

  transaction.feePayer = NOTARY_KEYPAIR.publicKey;
  transaction.sign(NOTARY_KEYPAIR);

  // ---------------------------------------------------------
  // Ed25519 Verification Step
  // ---------------------------------------------------------

  // 1. Verify that the transaction object itself considers the signatures valid
  if (!transaction.verifySignatures()) {
      throw new Error("Transaction signature verification failed!");
  }

  // 2. Explicitly verify using nacl to ensure the Notary signed it
  const signatureObj = transaction.signatures.find(s => s.publicKey.equals(NOTARY_KEYPAIR.publicKey));

  if (!signatureObj || !signatureObj.signature) {
      throw new Error("Notary signature missing from transaction");
  }

  const message = transaction.serializeMessage();
  const isValid = nacl.sign.detached.verify(
      message,
      signatureObj.signature,
      NOTARY_KEYPAIR.publicKey.toBuffer()
  );

  if (isValid) {
      console.log("✅ Ed25519 Signature Verified: Update authorized by TrustChain Notary.");
      console.log("Notary Public Key:", NOTARY_KEYPAIR.publicKey.toBase58());
      console.log("Signature:", Buffer.from(signatureObj.signature).toString('hex'));
  } else {
      console.error("❌ Invalid Signature: Unauthorized update attempt.");
      throw new Error("Security Violation: Invalid Signature");
  }

  console.log("Transaction successfully constructed with correct discriminator and accounts.");
}

async function main() {
    try {
        const score = await fetchVerifiedScore(MOCK_WALLET);
        await updateOnChainPDA(MOCK_WALLET, score);
    } catch (e) {
        console.error("Error during notary sync:", e);
        process.exit(1);
    }
}

main();
