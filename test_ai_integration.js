/**
 * Verification Script: AI Learning Integration
 */

import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import ai from './services/aiLearning.js';

async function testAI() {
    console.log('🧪 Starting AI Integration Test...');

    const movie = 'The Matrix';
    const dialogue = 'I know kung fu.';

    console.log(`🎬 Testing for movie: ${movie}`);
    console.log(`💬 Dialogue snippet: "${dialogue}"`);

    const result = await ai.explainDialogue(dialogue, movie);

    if (result.error) {
        console.error('❌ AI Test Failed:', result.error);
        if (result.error === 'API key not configured') {
            console.log('ℹ️ Note: This is expected if GEMINI_API_KEY is not set in .env');
        }
    } else {
        console.log('✅ AI Test Successful!');
        console.log('--- AI Response ---');
        console.log(result.explanation);
        console.log('-------------------');
    }

    console.log('\n🧪 Testing learning moments generation...');
    const moments = await ai.getLearningMoments(movie);
    if (moments.length > 0) {
        console.log('✅ Moments generated:', moments);
    } else {
        console.log('⚠️ No moments generated (possible API key issue or rate limit)');
    }
}

testAI();
