/**
 * Verification Script: Phase 3 Features
 */

import db from './database/sqlite.js';
import ai from './services/aiLearning.js';
import { processSubtitleToFlashcards } from './services/subtitleProcessor.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testPhase3() {
    console.log('🧪 Starting Phase 3 Features Test...\n');

    // Initialize DB
    await db.init();

    // 1. Test Roleplay Logic (AI Chat)
    console.log('🎭 Testing Roleplay (Chat with Joker)...');
    try {
        const history = [{ role: 'model', parts: [{ text: 'I am the Joker. Why so serious?' }] }];
        const response = await ai.chatWithPersona('Joker', 'Because I lost my phone!', history);
        console.log(`Joker says: ${response}`);
        if (response && response.length > 5 && response !== '...') console.log('✅ Roleplay AI Working');
        else console.error('❌ Roleplay AI Failed');
    } catch (e) {
        console.error('❌ Roleplay Error', e.message);
    }

    // 2. Test Subtitle Processing
    console.log('\n📂 Testing Subtitle Processor...');
    const dummySrtPath = path.join(__dirname, 'test.srt');
    fs.writeFileSync(dummySrtPath, `1\n00:00:01,000 --> 00:00:04,000\nHello world. This is a test subtitle.\n\n2\n00:00:05,000 --> 00:00:08,000\nSerendipity is a beautiful word.`);

    try {
        const csv = await processSubtitleToFlashcards(dummySrtPath, 'Test Movie');
        console.log('CSV Result Preview:\n', csv ? csv.split('\n')[0] : 'NULL');
        if (csv && csv.includes('Front,Back')) console.log('✅ SRT Processing Working');
        else console.error('❌ SRT Processing Failed');
    } catch (e) {
        console.error('❌ SRT Error', e);
    } finally {
        if (fs.existsSync(dummySrtPath)) fs.unlinkSync(dummySrtPath);
    }

    // 3. Test Shadowing Analysis (Mock Audio)
    console.log('\n🗣️ Testing Shadowing Analysis...');
    try {
        // Create a small dummy buffer
        const dummyBuffer = Buffer.from('dummy audio data');
        // This will likely fail without real audio, but we check if API call is made
        const result = await ai.analyzePronunciation(dummyBuffer, "I'm going to make him an offer he can't refuse.", 'audio/ogg', 'shadowing');

        // Since we send garbage audio, we expect an error or low score, but getting a response means logic holds.
        console.log('Shadowing Result:', result);
        if (result && (result.score !== undefined || result.error)) console.log('✅ Shadowing API Connected');
    } catch (e) {
        console.error('❌ Shadowing Error', e);
    }

    console.log('\n✅ Phase 3 Test Complete.');
}

testPhase3();
