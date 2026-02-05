
import 'dotenv/config';
import tmdb from './services/tmdbAPI.js';
import scraper1337x from './services/scraper1337x.js';

async function testDualSearch() {
    console.log("--- Testing Dual-Language Search Logic ---");
    const query = 'بتمن'; // Batman in Persian

    try {
        const tmdbMatches = await tmdb.searchMovies(query);
        if (tmdbMatches.length > 0) {
            const bestMatch = tmdbMatches[0];
            const englishTitle = bestMatch.originalTitle || bestMatch.title;
            console.log(`✅ Persian query "${query}" matched TMDB: ${bestMatch.title} (${englishTitle})`);

            console.log(`🔍 Searching 1337x with English title: "${englishTitle}"`);
            const x1337Results = await scraper1337x.searchWithMagnets(englishTitle, 5);
            console.log(`1337x Results: ${x1337Results.length}`);
            if (x1337Results.length > 0) {
                console.log("First 1337x result:", x1337Results[0].title);
            }
        } else {
            console.log("❌ Persian query failed to match TMDB");
        }
    } catch (e) {
        console.error("Test Error:", e);
    }
}

testDualSearch();
