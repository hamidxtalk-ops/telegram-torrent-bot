
import axios from 'axios';
import * as cheerio from 'cheerio';

async function debugStreamWideRaw() {
    console.log("--- DEBUG StreamWide Channel Raw ---");
    const channelName = 'StreamWide';
    const query = '2024';
    const url = `https://t.me/s/${channelName}?q=${encodeURIComponent(query)}`;
    console.log(`URL: ${url}`);

    try {
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            },
            timeout: 15000
        });

        const $ = cheerio.load(data);
        const messages = $('.tgme_widget_message');
        console.log(`Found ${messages.length} messages`);

        messages.each((i, msg) => {
            const $msg = $(msg);
            const text = $msg.find('.tgme_widget_message_text').text().trim();
            const links = $msg.find('a').length;
            console.log(`Msg ${i}: Length ${text.length}, Links ${links}`);
            console.log(`Snippet: ${text.substring(0, 100)}...`);

            $msg.find('a').each((j, link) => {
                console.log(` - Link: ${$(link).attr('href')}`);
            });
        });

    } catch (e) {
        console.error("Fetch Error:", e.message);
    }
}

debugStreamWideRaw();
