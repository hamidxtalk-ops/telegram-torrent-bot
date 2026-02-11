
import 'dotenv/config';
import axios from 'axios';

const apiKey = process.env.GEMINI_API_KEY;
console.log('Testing/API Key:', apiKey ? 'Present' : 'Missing');

const models = ['gemini-1.5-flash', 'gemini-pro', 'gemini-1.0-pro', 'gemini-1.5-pro'];

async function testModel(model) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
        console.log(`Testing ${model}...`);
        const response = await axios.post(url, {
            contents: [{ parts: [{ text: 'Hello' }] }]
        });
        console.log(`✅ ${model} SUCCESS!`);
        return true;
    } catch (error) {
        console.log(`❌ ${model} Failed: ${error.response?.status} - ${error.response?.statusText}`);
        if (error.response?.data?.error) {
            console.log('   Reason:', error.response.data.error.message);
        }
        return false;
    }
}

async function run() {
    for (const model of models) {
        if (await testModel(model)) break;
    }
}

run();
