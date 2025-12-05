/**
 * 1337x Scraper Service
 * Scrapes 1337x.to for comprehensive movie torrents
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

const BASE_URLS = [
    'https://1337x.to',
    'https://1337x.st',
    'https://1337x.ws',
    'https://1337x.is',
    'https://1337x.gd'
];

let currentBaseUrl = BASE_URLS[0];

const client = axios.create({
    timeout: 15000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
    }
});

/**
 * Try request with fallback URLs
 */
async function fetchWithFallback(path) {
    for (let i = 0; i < BASE_URLS.length; i++) {
        const url = `${currentBaseUrl}${path}`;
        try {
            console.log(`🔍 1337x request: ${url}`);
            const response = await client.get(url);
            return response.data;
        } catch (error) {
            console.log(`❌ 1337x failed: ${error.message}`);
            // Try next URL
            currentBaseUrl = BASE_URLS[(BASE_URLS.indexOf(currentBaseUrl) + 1) % BASE_URLS.length];
        }
    }
    throw new Error('All 1337x mirrors failed');
}

/**
 * Search for movies on 1337x
 */
export async function searchMovies(query, limit = 10) {
    try {
        const searchPath = `/category-search/${encodeURIComponent(query)}/Movies/1/`;
        const html = await fetchWithFallback(searchPath);
        const $ = cheerio.load(html);

        const results = [];

        $('tbody tr').slice(0, limit).each((i, row) => {
            const $row = $(row);
            const $nameLink = $row.find('td.name a:nth-child(2)');

            const name = $nameLink.text().trim();
            const detailUrl = $nameLink.attr('href');
            const seeds = parseInt($row.find('td.seeds').text()) || 0;
            const leeches = parseInt($row.find('td.leeches').text()) || 0;
            const size = $row.find('td.size').text().replace(/[^\d.GMK]/g, '').trim();

            // Parse quality from name
            let quality = '720p';
            if (name.includes('2160p') || name.includes('4K')) quality = '2160p';
            else if (name.includes('1080p')) quality = '1080p';
            else if (name.includes('720p')) quality = '720p';
            else if (name.includes('480p')) quality = '480p';

            // Extract year from name
            const yearMatch = name.match(/\(?(19|20)\d{2}\)?/);
            const year = yearMatch ? parseInt(yearMatch[0].replace(/[()]/g, '')) : null;

            // Clean title
            let title = name
                .replace(/\.(19|20)\d{2}\..*$/i, '')
                .replace(/\(?(19|20)\d{2}\)?.*$/i, '')
                .replace(/\./g, ' ')
                .trim();

            if (name && detailUrl) {
                results.push({
                    id: `1337x_${i}`,
                    title: title || name.substring(0, 50),
                    titleFull: name,
                    year,
                    detailUrl,
                    quality,
                    size,
                    seeds,
                    leeches,
                    source: '1337x'
                });
            }
        });

        console.log(`✅ 1337x: Found ${results.length} results for "${query}"`);
        return results;

    } catch (error) {
        console.error('1337x search error:', error.message);
        return [];
    }
}

/**
 * Get magnet link from detail page
 */
export async function getMagnetLink(detailUrl) {
    try {
        const html = await fetchWithFallback(detailUrl);
        const $ = cheerio.load(html);

        // Find magnet link
        const magnetLink = $('a[href^="magnet:"]').attr('href');

        if (!magnetLink) {
            throw new Error('Magnet link not found');
        }

        console.log('✅ 1337x: Got magnet link');
        return magnetLink;

    } catch (error) {
        console.error('1337x magnet error:', error.message);
        throw error;
    }
}

/**
 * Search and get full torrent data with magnet
 */
export async function searchWithMagnets(query, limit = 5) {
    const searchResults = await searchMovies(query, limit);

    // Get magnet for top results
    const resultsWithMagnets = [];

    for (const result of searchResults.slice(0, limit)) {
        try {
            const magnetLink = await getMagnetLink(result.detailUrl);
            resultsWithMagnets.push({
                ...result,
                torrents: [{
                    quality: result.quality,
                    size: result.size,
                    seeds: result.seeds,
                    peers: result.leeches,
                    magnetLink,
                    source: '1337x'
                }]
            });
        } catch (error) {
            console.log(`Skipping ${result.title}: ${error.message}`);
        }

        // Small delay between requests
        await new Promise(r => setTimeout(r, 500));
    }

    return resultsWithMagnets;
}

/**
 * Group similar movies by title
 */
export function groupByMovie(results) {
    const groups = new Map();

    for (const result of results) {
        const key = result.title.toLowerCase();

        if (!groups.has(key)) {
            groups.set(key, {
                id: result.id,
                title: result.title,
                year: result.year,
                torrents: [],
                source: '1337x'
            });
        }

        if (result.torrents) {
            groups.get(key).torrents.push(...result.torrents);
        }
    }

    // Sort torrents by quality and seeds
    for (const movie of groups.values()) {
        const qualityOrder = { '2160p': 4, '1080p': 3, '720p': 2, '480p': 1 };
        movie.torrents.sort((a, b) => {
            const qDiff = (qualityOrder[b.quality] || 0) - (qualityOrder[a.quality] || 0);
            if (qDiff !== 0) return qDiff;
            return b.seeds - a.seeds;
        });
        // Keep top 4 torrents per movie
        movie.torrents = movie.torrents.slice(0, 4);
    }

    return Array.from(groups.values());
}

export default {
    searchMovies,
    getMagnetLink,
    searchWithMagnets,
    groupByMovie
};
