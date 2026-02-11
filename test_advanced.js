/**
 * Verification Script: Advanced AI Features
 */

import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import ai from './services/aiLearning.js';

// Dummy buffer for audio test
const dummyAudio = Buffer.from('test audio content');

async function testAdvancedFeatures() {
    console.log('🧪 Starting Advanced AI Features Test...');

    // 1. Test Context Search
    console.log('\n🔍 Testing Context Search (Semantic)...');
    const query = 'فیلمی که توش برد پیت قوانین باشگاه رو میگه';
    console.log(`Query: "${query}"`);

    // In a real run without API key, this will return found: false or error
    try {
        const searchResult = await ai.searchByContext(query);
        console.log('Result:', searchResult);
    } catch (e) {
        console.log('Search Error:', e.message);
    }

    // 2. Test Pronunciation Analysis
    console.log('\n🎤 Testing Pronunciation Analysis...');
    const targetText = 'The first rule of Fight Club is: you do not talk about Fight Club.';

    try {
        const feedback = await ai.analyzePronunciation(dummyAudio, targetText);
        console.log('Feedback:', feedback);
    } catch (e) {
        console.log('Pronunciation Error:', e.message);
    }
}

testAdvancedFeatures();
