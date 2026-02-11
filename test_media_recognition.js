/**
 * Verification Script: AI Media Recognition
 * Simulates passing a media buffer to the AI service
 */

import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import ai from './services/aiLearning.js';
import fs from 'fs';
import path from 'path';

// Create a dummy small buffer to simulate a file (in a real test, use a real small image)
// For this test, we might fail recognition if the buffer is garbage, but we test the API connectivity.
const dummyBuffer = Buffer.from('test media content');

async function testMediaRecognition() {
    console.log('🧪 Starting Media Recognition Test...');

    // Test Case 1: Text/Image recognition (Simulated)
    console.log('\n📸 Testing Image Recognition (Simulation)...');
    try {
        // In a real scenario, this would be a real image buffer
        const result = await ai.recognizeMedia(dummyBuffer, 'image/jpeg');

        console.log('Response:', result);

        if (result.error) {
            console.log('❌ Error:', result.error);
        } else if (result.found) {
            console.log('✅ Found:', result.title);
        } else {
            console.log('⚠️ Not found (Expected for dummy buffer)');
        }
    } catch (e) {
        console.error('Test failed:', e.message);
    }
}

testMediaRecognition();
