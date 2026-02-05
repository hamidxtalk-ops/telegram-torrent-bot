
import axios from 'axios';

async function checkUrl(url, label) {
    try {
        console.log(`Checking ${label}: ${url}`);
        const { data, headers } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 10000,
            validateStatus: () => true
        });

        console.log(`${label} Status: ${data.toString().substring(0, 100).replace(/\n/g, ' ')}...`);

        if (typeof data === 'object') {
            console.log(`${label} JSON Keys:`, Object.keys(data).slice(0, 5));
        } else if (typeof data === 'string') {
            if (data.includes('tgme_widget_message')) {
                console.log(`${label} Valid: Contains tgme_widget_message`);
            } else {
                console.log(`${label} Invalid: content does not match expected pattern`);
            }
        }
    } catch (error) {
        console.error(`${label} Error:`, error.message);
    }
}

async function main() {
    // Check StreamWide WP API
    await checkUrl('https://streamwide.tv/wp-json/wp/v2/posts', 'StreamWide WP POSTS');
    await checkUrl('https://streamwide.tv/wp-json/wp/v2/search?search=avengers', 'StreamWide WP SEARCH');
    await checkUrl('https://streamwide.tv/feed/', 'StreamWide RSS');

    // Check Telegram Search
    await checkUrl('https://t.me/s/Filmeh_Archive?q=avengers', 'Telegram Search (Filmeh)');
    await checkUrl('https://t.me/s/StreamWide?q=avengers', 'Telegram Search (StreamWide)');
}

main();
