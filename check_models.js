
import dotenv from 'dotenv';
dotenv.config();
import axios from 'axios';

const apiKey = process.env.GEMINI_API_KEY;
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

async function listModels() {
    try {
        console.log('Querying:', url);
        const response = await axios.get(url);
        console.log('Available Models:');
        response.data.models.forEach(m => {
            if (m.name.includes('gemini')) {
                console.log(`- ${m.name} (${m.supportedGenerationMethods.join(', ')})`);
            }
        });
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
    }
}

listModels();
