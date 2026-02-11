
import https from 'node:https';
import 'dotenv/config';

const apiKey = process.env.GEMINI_API_KEY;
console.log(`API Key present: ${!!apiKey}`);

const options = {
    hostname: 'generativelanguage.googleapis.com',
    path: `/v1beta/models?key=${apiKey}`,
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
};

const req = https.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            if (json.error) {
                console.log('Error:', json.error);
            } else {
                console.log('--- Models ---');
                (json.models || []).forEach(m => {
                    if (m.supportedGenerationMethods.includes('generateContent')) {
                        console.log(m.name);
                    }
                });
                console.log('--------------');
            }
        } catch (e) {
            console.log('Parse error:', e.message);
            console.log(data);
        }
    });
});

req.on('error', (e) => {
    console.log(`Error: ${e.message}`);
});

req.end();
