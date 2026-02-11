
import 'dotenv/config';
import https from 'https';

const apiKey = process.env.GEMINI_API_KEY;
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

console.log('Fetching models...');

https.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            if (json.error) {
                console.error('API Error:', json.error);
            } else {
                console.log('--- Models supporting generateContent ---');
                (json.models || []).forEach(m => {
                    if (m.supportedGenerationMethods.includes('generateContent')) {
                        console.log(m.name.replace('models/', ''));
                    }
                });
                console.log('---------------------------------------');
            }
        } catch (e) {
            console.error('Parse Error:', e.message);
            console.log('Raw Data:', data);
        }
    });
}).on('error', err => {
    console.error('Network Error:', err.message);
});
