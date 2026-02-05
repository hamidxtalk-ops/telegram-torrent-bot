
import scraperTelegram from './services/scraperTelegramChannels.js';
import scraperStreamWide from './services/scraperStreamWide.js';

async function test() {
    console.log("--- Testing Telegram Scraper (StreamWideBot) ---");
    // Attempt to search specifically for the bot/channel mentioned
    try {
        const results = await scraperTelegram.searchTelegramChannels('avengers', 5);
        console.log(`Telegram Results: ${results.length}`);
        if (results.length > 0) console.log(results[0]);
    } catch (e) {
        console.error("Telegram Error:", e);
    }

    console.log("\n--- Testing StreamWide Website Scraper ---");
    try {
        const swResults = await scraperStreamWide.searchWithLinks('avengers');
        console.log(`StreamWide Results: ${swResults.length}`);
        if (swResults.length > 0) console.log(swResults[0]);
    } catch (e) {
        console.error("StreamWide Error:", e);
    }
}

test();
