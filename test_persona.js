/**
 * Verification Script: Persona AI Integration
 * Tests if the AI adopts the requested persona
 */

import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import ai from './services/aiLearning.js';

async function testPersona() {
    console.log('🧪 Starting Persona AI Test...');

    const movie = 'The Godfather';
    const dialogue = "I'm gonna make him an offer he can't refuse.";
    const persona = 'Captain Jack Sparrow';

    console.log(`🎬 Movie: ${movie}`);
    console.log(`💬 Dialogue: "${dialogue}"`);
    console.log(`🎭 Persona: ${persona}`);

    const result = await ai.explainDialogue(dialogue, movie, persona);

    if (result.error) {
        console.error('❌ Test Failed:', result.error);
    } else {
        console.log('✅ AI Test Successful!');
        console.log('--- AI Response (Should sound like a Pirate) ---');
        console.log(result.explanation);
        console.log('------------------------------------------------');
    }
}

testPersona();
