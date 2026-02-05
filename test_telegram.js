
import scraperTelegram from './services/scraperTelegramChannels.js';

async function testTelegram() {
    console.log("--- Testing Telegram Scraper (StreamWide) ---");
    try {
        const results = await scraperTelegram.searchTelegramChannels('batman', 5);
        console.log(`Telegram Results: ${results.length}`);
        if (results.length > 0) {
            console.log("First result:", results[0]);
        } else {
            console.log("No results found. Checking if channels are actually being queried...");
        }
    } catch (e) {
        console.error("Telegram Error:", e);
    }
}

testTelegram();
