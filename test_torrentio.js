
import 'dotenv/config';
import scraperTorrentio from './services/scraperTorrentio.js';

async function testTorrentio() {
    console.log("--- Testing Torrentio Scraper ---");
    const query = 'Inception';
    try {
        const results = await scraperTorrentio.searchWithLinks(query, 5);
        console.log(`Found ${results.length} movies/results.`);

        if (results.length > 0) {
            const movie = results[0];
            console.log(`Movie: ${movie.title} (${movie.year})`);
            console.log(`Torrents found: ${movie.torrents.length}`);

            if (movie.torrents.length > 0) {
                console.log("First Torrent Sample:");
                console.log(movie.torrents[0]);
            }
        } else {
            console.log("No results. Note: Torrentio depends on TMDB -> IMDB mapping.");
        }
    } catch (e) {
        console.error("Torrentio Test/Error:", e);
    }
}

testTorrentio();
