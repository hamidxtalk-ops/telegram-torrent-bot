
import axios from 'axios';
import * as cheerio from 'cheerio';

async function debugStreamWideRSS() {
    console.log("--- DEBUG StreamWide RSS ---");
    const query = 'batman';
    const searchUrl = `https://streamwide.tv/feed/?s=${encodeURIComponent(query)}`;
    console.log(`URL: ${searchUrl}`);

    try {
        const { data } = await axios.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/rss+xml, application/xml, text/xml'
            },
            timeout: 10000
        });

        console.log(`Response Length: ${data.length}`);
        console.log(`Response Preview: ${data.substring(0, 500)}`);

        const $ = cheerio.load(data, { xmlMode: true });
        const items = $('item');
        console.log(`Found ${items.length} items`);

        if (items.length > 0) {
            const first = items.first();
            console.log("First Item Title:", first.find('title').text());
            console.log("First Item Link:", first.find('link').text());
        } else {
            console.log("WARNING: No items found in RSS feed for this query.");
        }

    } catch (e) {
        console.error("RSS Fetch Error:", e.message);
    }
}

debugStreamWideRSS();
