
import scraperTelegram from './services/scraperTelegramChannels.js';

async function debugStreamWideTelegram() {
    console.log("--- DEBUG StreamWide Telegram ---");
    const query = '2024';
    console.log(`Querying Telegram for: ${query}`);
    try {
        // searchTelegramChannels searches all channels. We'll check if StreamWide is in the results.
        const results = await scraperTelegram.searchTelegramChannels(query, 50);

        const streamWideResults = results.filter(r => r.source === 'StreamWide');
        console.log(`StreamWide Results: ${streamWideResults.length}`);

        if (streamWideResults.length > 0) {
            console.log("First StreamWide result:", streamWideResults[0]);
        } else {
            console.log("No StreamWide results found among " + results.length + " total results.");
            // Log sources found to verify StreamWide was attempted
            const sources = [...new Set(results.map(r => r.source))];
            console.log("Sources found:", sources);
        }
    } catch (e) {
        console.error("Telegram Error:", e);
    }
}

debugStreamWideTelegram();
