import { PublicKey } from "@solana/web3.js";
import { TemporalObserver } from "./temporal_observer";

async function simulateSybilAttack() {
    const observer = new TemporalObserver("https://api.devnet.solana.com");
    const programId = "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS";
    const commonInstructionData = "update_integrity_0x12345"; // Identical intent

    const wallets = [
        "Base11111111111111111111111111111111", // Organic 1
        "Fake22222222222222222222222222222222", // Organic 2
        "Fake33333333333333333333333333333333", // 🚨 CLUSTER TRIGGER (3rd)
        "Fake44444444444444444444444444444444"  // 🚨 CLUSTER ESCALATION (4th)
    ];

    console.log("🚀 Starting Sovereign V2 Temporal Simulation...");

    for (const [index, wallet] of wallets.entries()) {
        const syncIndex = await observer.observeTransaction(wallet, programId, commonInstructionData);

        console.log(`\n[Request ${index + 1}] Wallet: ${wallet.substring(0, 8)}...`);
        console.log(`Sync Index: ${syncIndex.toFixed(2)}`);

        if (syncIndex > 0.5) {
            console.log("❌ RESULT: PROBATIONARY OVERRIDE TRIGGERED");
        } else {
            console.log("✅ RESULT: STATUS PASS");
        }

        // Simulate sub-second timing (200ms between "bot" clicks)
        await new Promise(resolve => setTimeout(resolve, 200));
    }
}

simulateSybilAttack();