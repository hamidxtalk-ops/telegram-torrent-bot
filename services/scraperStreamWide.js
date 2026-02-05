import axios from 'axios';
import * as cheerio from 'cheerio';

async function searchWithLinks(query, limit = 5) {
    // Priority: Try to use Telegram scraper for StreamWide channel first
    // This is more likely to have @StreamWideBot results
    try {
        const scraperTelegram = (await import('./scraperTelegramChannels.js')).default;
        const tgResults = await scraperTelegram.searchChannel('StreamWide', query);
        if (tgResults && tgResults.length > 0) {
            console.log(`StreamWide: Found ${tgResults.length} results via Telegram`);
            return tgResults.map(m => ({
                ...m,
                source: 'StreamWide',
                torrents: m.botLinks.map(link => ({
                    quality: 'دانلود از تلگرام',
                    size: 'N/A',
                    seeds: 0,
                    magnetLink: link.url,
                    isDirect: false,
                    isTelegramBot: true,
                    source: 'StreamWide'
                }))
            }));
        }
    } catch (e) {
        console.log('StreamWide Telegram fallback error:', e.message);
    }

    const results = [];
    try {
        // Fallback to RSS feed
        const searchUrl = `https://streamwide.tv/feed/?s=${encodeURIComponent(query)}`;
        console.log(`StreamWide RSS Search: ${searchUrl}`);
        // ... rest of the logic ...

        const { data } = await axios.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/rss+xml, application/xml, text/xml'
            },
            timeout: 10000
        });

        const $ = cheerio.load(data, { xmlMode: true });

        $('item').each((i, el) => {
            if (results.length >= limit) return;
            const item = $(el);
            const title = item.find('title').text().trim();
            const link = item.find('link').text().trim();
            // Try to extract content/description for poster or extra info
            const description = item.find('description').text().trim();

            // RSS usually doesn't give poster, use placeholder or extract from content if possible
            // For now, we accept null poster, main app might fill it from TMDB match
            let poster = null;
            const content = item.find('content\\:encoded').text();
            if (content) {
                const imgMatch = content.match(/src="([^"]+)"/);
                if (imgMatch) poster = imgMatch[1];
            }

            if (title && link) {
                results.push({
                    title: title,
                    link: link,
                    poster: poster,
                    source: 'StreamWide',
                    type: 'stream',
                    torrents: [{
                        quality: 'Direct Stream/Download',
                        size: 'N/A',
                        seeds: 0,
                        magnetLink: link,
                        isDirect: true,
                        source: 'StreamWide'
                    }]
                });
            }
        });

    } catch (error) {
        console.error(`StreamWide search error:`, error.message);
    }
    return results;
}

export default { searchWithLinks };
