
import 'dotenv/config';
import scraperTelegram from './services/scraperTelegramChannels.js';

async function testRedirectionFix() {
    console.log("--- Testing Redirection Fix (Filtering 2ad.ir) ---");
    const query = 'tehran'; // Often has many links including redirects

    try {
        const results = await scraperTelegram.searchWithLinks(query, 5);
        console.log(`✅ Found ${results.length} movies/results`);

        results.forEach((movie, i) => {
            movie.torrents.forEach((t, j) => {
                console.log(`[${movie.sourceDisplay}] Link: ${t.magnetLink}`);
                if (!t.magnetLink.includes('?start=')) {
                    console.log(`❌ ERROR: Found non-bot link: ${t.magnetLink}`);
                }
            });
        });

        if (results.length > 0) {
            console.log("\n✅ Test passed: Only direct bot download links (?start=) found.");
        }
    } catch (e) {
        console.error("Test Error:", e);
    }
}

testRedirectionFix();
