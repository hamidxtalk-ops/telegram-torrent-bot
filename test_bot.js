import fs from 'fs';
import path from 'path';
import TelegramBot from 'node-telegram-bot-api';

const envPath = path.join(process.cwd(), '.env.test');
console.log('Checking path:', envPath);

try {
    const content = fs.readFileSync(envPath, 'utf8');
    console.log('File content length:', content.length);
    console.log('First 20 chars:', content.substring(0, 20));

    // Manual parse
    const match = content.match(/BOT_TOKEN=(.*)/);
    const token = match ? match[1].trim() : null;

    console.log('Token found via FS:', token ? `${token.substring(0, 10)}...` : 'NONE');

    if (!token) {
        console.error('❌ BOT_TOKEN not found in file content');
        process.exit(1);
    }

    const bot = new TelegramBot(token, { polling: false });
    bot.getMe().then(me => {
        console.log('✅ Bot is valid!');
        console.log('Name:', me.first_name);
        process.exit(0);
    }).catch(err => {
        console.error('❌ Bot token invalid or connection error:', err.message);
        process.exit(1);
    });

} catch (e) {
    console.error('❌ Failed to read file:', e.message);
}
