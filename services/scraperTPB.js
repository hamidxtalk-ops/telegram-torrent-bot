/**
 * ThePirateBay Scraper Service
 * Scrapes TPB for movies and other content
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

// TPB proxy list (main site often blocked)
const TPB_URLS = [
    'https://thepiratebay.org',
    'https://thepiratebay10.org',
    'https://tpb.party',
    'https://piratebay.live',
    'https://thepiratebay.zone'
];

let currentUrl = TPB_URLS[0];

const client = axios.create({
    timeout: 15000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
});

/**
 * Fetch with fallback to different TPB mirrors
 */
async function fetchWithFallback(path) {
    for (let i = 0; i < TPB_URLS.length; i++) {
        const url = `${currentUrl}${path}`;
        try {
            console.log(`🏴‍☠️ TPB request: ${url}`);
            const response = await client.get(url);
            return response.data;
        } catch (error) {
            console.log(`❌ TPB failed: ${error.message}`);
            currentUrl = TPB_URLS[(TPB_URLS.indexOf(currentUrl) + 1) % TPB_URLS.length];
        }
    }
    throw new Error('All TPB mirrors failed');
}

/**
 * Parse size string
 */
function parseSize(sizeStr) {
    if (!sizeStr) return 'N/A';
    // Extract size like "1.5 GiB" or "700 MiB"
    const match = sizeStr.match(/([\d.]+)\s*(GiB|MiB|GB|MB)/i);
    if (match) {
        return `${match[1]} ${match[2].replace('iB', 'B')}`;
    }
    return sizeStr;
}

/**
 * Search movies on TPB
 */
export async function searchMovies(query, limit = 10) {
    try {
        // Category 200 = Video, 201 = Movies
        const searchPath = `/search/${encodeURIComponent(query)}/1/99/200`;
        const html = await fetchWithFallback(searchPath);
        const $ = cheerio.load(html);

        const results = [];

        $('#searchResult tbody tr, table#searchResult tr').slice(0, limit).each((i, row) => {
            const $row = $(row);

            // Skip header row
            if ($row.find('th').length > 0) return;

            const $nameLink = $row.find('a.detLink, td:nth-child(2) a');
            const name = $nameLink.text().trim();
            const detailUrl = $nameLink.attr('href');

            // Get magnet link directly
            const magnetLink = $row.find('a[href^="magnet:"]').attr('href');

            // Parse info
            const infoText = $row.find('font.detDesc, td:nth-child(2)').text();
            const sizeMatch = infoText.match(/Size\s*([\d.]+\s*[GMK]iB)/i);
            const size = sizeMatch ? parseSize(sizeMatch[1]) : 'N/A';

            // Seeds and leeches
            const seeds = parseInt($row.find('td:nth-child(3), td.seeders').text()) || 0;
            const leeches = parseInt($row.find('td:nth-child(4), td.leechers').text()) || 0;

            // Parse quality
            let quality = '720p';
            if (name.includes('2160p') || name.includes('4K')) quality = '2160p';
            else if (name.includes('1080p')) quality = '1080p';
            else if (name.includes('720p')) quality = '720p';
            else if (name.includes('480p')) quality = '480p';

            // Extract year
            const yearMatch = name.match(/\(?(19|20)\d{2}\)?/);
            const year = yearMatch ? parseInt(yearMatch[0].replace(/[()]/g, '')) : null;

            // Clean title
            let title = name
                .replace(/\.(19|20)\d{2}\..*$/i, '')
                .replace(/\(?(19|20)\d{2}\)?.*$/i, '')
                .replace(/\./g, ' ')
                .trim();

            if (name && magnetLink) {
                results.push({
                    id: `tpb_${i}`,
                    title: title || name.substring(0, 50),
                    titleFull: name,
                    year,
                    detailUrl,
                    quality,
                    size,
                    seeds,
                    leeches,
                    magnetLink,
                    source: 'TPB'
                });
            }
        });

        console.log(`✅ TPB: Found ${results.length} results for "${query}"`);
        return results;

    } catch (error) {
        console.error('TPB search error:', error.message);
        return [];
    }
}

/**
 * Search with ready magnets grouped by movie
 */
export async function searchWithMagnets(query, limit = 5) {
    const results = await searchMovies(query, limit * 2);

    // Group by similar title
    const groups = new Map();

    for (const result of results) {
        const key = result.title.toLowerCase();

        if (!groups.has(key)) {
            groups.set(key, {
                id: result.id,
                title: result.title,
                year: result.year,
                torrents: [],
                source: 'TPB'
            });
        }

        groups.get(key).torrents.push({
            quality: result.quality,
            size: result.size,
            seeds: result.seeds,
            peers: result.leeches,
            magnetLink: result.magnetLink,
            source: 'TPB'
        });
    }

    // Sort and limit torrents
    const movies = Array.from(groups.values()).slice(0, limit);
    const qualityOrder = { '2160p': 4, '1080p': 3, '720p': 2, '480p': 1 };

    for (const movie of movies) {
        movie.torrents.sort((a, b) => {
            const qDiff = (qualityOrder[b.quality] || 0) - (qualityOrder[a.quality] || 0);
            if (qDiff !== 0) return qDiff;
            return b.seeds - a.seeds;
        });
        movie.torrents = movie.torrents.slice(0, 4);
    }

    return movies;
}

export default {
    searchMovies,
    searchWithMagnets
};
