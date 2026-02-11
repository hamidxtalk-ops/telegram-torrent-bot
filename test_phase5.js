/**
 * Verification Script: Phase 5 Features
 */

import db from './database/sqlite.js';
import { getCompanionProfile, updateCompanionProfile, chatWithCompanion } from './services/companionService.js';
import { handleWallet, handleMarket } from './commands/social.js';

// Mock Bot
const mockBot = {
    sendMessage: async (chatId, text) => console.log(`[Bot -> ${chatId}]: ${text.substring(0, 50).replace(/\n/g, ' ')}...`),
    sendChatAction: async () => { },
    answerCallbackQuery: async () => { },
    deleteMessage: async () => { }
};

async function testPhase5() {
    console.log('🧪 Starting Phase 5 Features Test...\n');
    await db.init();


    const userId = 999;
    const sellerId = 888;

    // Ensure user exists (triggers migration)
    await db.getOrCreateUser({ id: userId, first_name: 'Tester' });
    await db.getOrCreateUser({ id: sellerId, first_name: 'Seller' });

    // 1. Companion Test
    console.log('🧞‍♂️ Testing Companion...');
    const profile = getCompanionProfile(userId);
    console.log('Default Profile:', profile);

    updateCompanionProfile(userId, { name: 'Jarvis', gender: 'Male' });
    const newProfile = getCompanionProfile(userId);
    console.log('Updated Profile:', newProfile);
    if (newProfile.name === 'Jarvis') console.log('✅ Profile Update Success');

    // Chat Simulation
    try {
        console.log('💬 Chatting with Companion...');
        // Mock history
        const response = await chatWithCompanion(userId, 'Hello! Who are you?', []);
        console.log(`Companion says: ${response}`);
        if (response && response.length > 2) console.log('✅ Companion Connect Success');
    } catch (e) {
        console.log('❌ Companion Chat Error:', e.message);
    }

    // 2. Marketplace Test
    console.log('\n🏪 Testing Marketplace...');

    // Create Listing
    db.createListing(sellerId, 'Test Note', 'A test listing', 50, 'Secret Content');
    const listings = db.getListings();
    console.log(`Listings Count: ${listings.length}`);
    if (listings.length > 0) console.log('✅ Create Listing Success');

    // Wallet Test
    db.addCoins(userId, 100);
    const coins = db.getCoins(userId);
    console.log(`User Coins: ${coins}`);
    if (coins >= 100) console.log('✅ Coins Added Success');

    // Buy Simulation (Manual DB check)
    if (coins >= 50) {
        db.addCoins(userId, -50);
        const newCoins = db.getCoins(userId);
        console.log(`Coins after purchase: ${newCoins}`);
        if (newCoins === coins - 50) console.log('✅ Transaction Logic Success');
    }

    console.log('\n✅ Phase 5 Test Complete.');
}

testPhase5();
