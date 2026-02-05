
import scraperStreamWide from './services/scraperStreamWide.js';

async function testStreamWide() {
    console.log("--- Testing StreamWide RSS Scraper ---");
    try {
        const swResults = await scraperStreamWide.searchWithLinks('batman');
        console.log(`StreamWide Results: ${swResults.length}`);
        if (swResults.length > 0) {
            console.log("First result:", swResults[0]);
        } else {
            console.log("No results found. Check RSS feed manually.");
        }
    } catch (e) {
        console.error("StreamWide Error:", e);
    }
}

testStreamWide();
