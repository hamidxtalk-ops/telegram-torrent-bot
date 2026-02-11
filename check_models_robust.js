
import 'dotenv/config';
import axios from 'axios';

const apiKey = process.env.GEMINI_API_KEY;
console.log('Checking models with API Key ending in:', apiKey ? apiKey.slice(-4) : 'NONE');

const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

async function listModels() {
    try {
        const response = await axios.get(url, { timeout: 10000 });
        console.log('--- AVAILABLE MODELS ---');
        const models = response.data.models || [];
        models.forEach(m => {
            if (m.supportedGenerationMethods.includes('generateContent')) {
                console.log(m.name.replace('models/', ''));
            }
        });
        console.log('------------------------');
    } catch (error) {
        console.error('Error fetching models:', error.response?.data || error.message);
    }
}

listModels();
