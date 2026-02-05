
import axios from 'axios';
import fs from 'fs';
import path from 'path';

// Create debug directory
if (!fs.existsSync('debug_html')) {
    fs.mkdirSync('debug_html');
}

async function fetchAndSave(url, filename) {
    try {
        console.log(`Fetching ${url}...`);
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            },
            timeout: 15000
        });
        fs.writeFileSync(path.join('debug_html', filename), data);
        console.log(`Saved to debug_html/${filename}`);
    } catch (error) {
        console.error(`Error fetching ${url}:`, error.message);
    }
}

async function main() {
    await fetchAndSave('https://streamwide.tv/?s=avengers', 'streamwide.html');
    await fetchAndSave('https://t.me/s/Filmeh_Archive', 'telegram_channel.html');
    // Try the bot link just in case
    await fetchAndSave('https://t.me/s/StreamWideBot', 'telegram_bot.html');
}

main();
