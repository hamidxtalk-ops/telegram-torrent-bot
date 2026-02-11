
import https from 'node:https';
import 'dotenv/config';

const apiKey = process.env.GEMINI_API_KEY;
const models = ['gemini-1.5-flash', 'gemini-pro', 'gemini-1.0-pro'];

console.log(`API Key present: ${!!apiKey}`);

function checkModel(model) {
    return new Promise((resolve) => {
        const options = {
            hostname: 'generativelanguage.googleapis.com',
            path: `/v1beta/models/${model}:generateContent?key=${apiKey}`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    console.log(`✅ ${model} WORKS`);
                    resolve(true);
                } else {
                    console.log(`❌ ${model} FAILED (${res.statusCode})`);
                    // Try to print error message
                    try {
                        const json = JSON.parse(data);
                        if (json.error) console.log(`   Reason: ${json.error.message}`);
                    } catch (e) { }
                    resolve(false);
                }
            });
        });

        req.on('error', (e) => {
            console.log(`❌ ${model} ERROR: ${e.message}`);
            resolve(false);
        });

        req.write(JSON.stringify({
            contents: [{ parts: [{ text: "Hi" }] }]
        }));
        req.end();
    });
}

async function run() {
    console.log('--- Testing Models ---');
    for (const model of models) {
        if (await checkModel(model)) break;
    }
    console.log('----------------------');
}

run();
