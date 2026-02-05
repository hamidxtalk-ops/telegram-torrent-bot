import axios from 'axios';
import tmdb from './tmdbAPI.js';

const TORRENTIO_URL = 'https://torrentio.strem.fun';

/**
 * Search Torrentio for a movie
 * @param {string} query Movie title
 * @param {number} limit Max results
 */
async function searchWithLinks(query, limit = 10) {
    try {
        console.log(`🦄 Torrentio search: ${query}`);

        // 1. Get IMDB ID from TMDB first (Torrentio needs IMDB ID)
        const tmdbResults = await tmdb.searchMovies(query);

        if (!tmdbResults || tmdbResults.length === 0) {
            console.log('Torrentio: No TMDB match found');
            return [];
        }

        const bestMatch = tmdbResults[0];
        // We need detailed info to get external_ids (IMDB ID)
        const details = await tmdb.getMovieDetails(bestMatch.id);

        if (!details || !details.imdb_id) {
            console.log('Torrentio: No IMDB ID found for movie');
            return [];
        }

        const imdbId = details.imdb_id;
        console.log(`Torrentio: Found IMDB ID ${imdbId} for "${bestMatch.title}"`);

        // 2. Fetch streams from Torrentio
        // Using standard public instance
        const url = `${TORRENTIO_URL}/stream/movie/${imdbId}.json`;

        const { data } = await axios.get(url, {
            timeout: 10000
        });

        if (!data || !data.streams || data.streams.length === 0) {
            return [];
        }

        const torrents = [];

        // 3. Parse streams
        // Torrentio returns streams with title like: "4k\nWarrior (2011) 2160p HDR..."
        for (const stream of data.streams) {
            // Filter only valid torrent streams
            if (!stream.infoHash && !stream.url) continue;

            // Parse quality from title/name
            const titleLine = (stream.title || '').split('\n')[0] || '';
            const nameLine = stream.name || '';
            const fullTitle = (stream.title || '').replace(/\n/g, ' ');

            const is4k = fullTitle.includes('2160p') || titleLine.includes('4k');
            const is1080 = fullTitle.includes('1080p');
            const is720 = fullTitle.includes('720p');
            const is480 = fullTitle.includes('480p');

            let quality = 'Unknown';
            if (is4k) quality = '2160p';
            else if (is1080) quality = '1080p';
            else if (is720) quality = '720p';
            else if (is480) quality = '480p';
            else if (nameLine.includes('4k')) quality = '2160p'; // Fallback

            // Parse size if available in title (often looks like "💾 1.5 GB")
            const sizeMatch = fullTitle.match(/💾\s*([\d.]+\s*[GM]B)/i);
            const size = sizeMatch ? sizeMatch[1] : 'N/A';

            // Seeders often in title "👤 123"
            const seedsMatch = fullTitle.match(/👤\s*(\d+)/);
            const seeds = seedsMatch ? parseInt(seedsMatch[1]) : 0;

            // Construct magnet if only infoHash is present
            let magnetLink = stream.url;
            if (!magnetLink && stream.infoHash) {
                magnetLink = `magnet:?xt=urn:btih:${stream.infoHash}&dn=${encodeURIComponent(bestMatch.title)}`;
            }

            if (magnetLink) {
                torrents.push({
                    quality,
                    size,
                    seeds,
                    magnetLink,
                    source: 'Torrentio',
                    isDirect: false
                });
            }
        }

        // Return standardized result object
        if (torrents.length > 0) {
            return [{
                title: bestMatch.title,
                year: bestMatch.release_date?.substring(0, 4),
                poster: bestMatch.poster_path ? `https://image.tmdb.org/t/p/w342${bestMatch.poster_path}` : null,
                torrents: torrents.slice(0, limit),
                source: 'Torrentio'
            }];
        }

        return [];

    } catch (error) {
        console.error(`Torrentio error: ${error.message}`);
        return [];
    }
}

export default { searchWithLinks };
