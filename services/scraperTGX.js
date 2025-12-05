/**
 * TorrentGalaxy Scraper Service
 * Scrapes TorrentGalaxy for movie/TV torrents
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

const TGX_URLS = [
    'https://torrentgalaxy.to',
    'https://tgx.rs',
    'https://torrentgalaxy.mx'
];

let currentUrl = TGX_URLS[0];

const client = axios.create({
    timeout: 15000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
});

/**
 * Fetch with fallback to mirrors
 */
async function fetchWithFallback(path) {
    for (let i = 0; i < TGX_URLS.length; i++) {
        const url = `${currentUrl}${path}`;
        try {
            console.log(`🌌 TorrentGalaxy request: ${url}`);
            const response = await client.get(url);
            return response.data;
        } catch (error) {
            console.log(`❌ TorrentGalaxy failed: ${error.message}`);
            currentUrl = TGX_URLS[(TGX_URLS.indexOf(currentUrl) + 1) % TGX_URLS.length];
        }
    }
    throw new Error('All TorrentGalaxy mirrors failed');
}

/**
 * Extract quality from title
 */
function extractQuality(title) {
    if (title.includes('2160p') || title.includes('4K') || title.includes('UHD')) return '2160p';
    if (title.includes('1080p')) return '1080p';
    if (title.includes('720p')) return '720p';
    if (title.includes('480p')) return '480p';
    if (title.includes('HDTV')) return 'HDTV';
    if (title.includes('WEB-DL') || title.includes('WEBDL')) return 'WEB-DL';
    if (title.includes('BluRay') || title.includes('BRRip')) return 'BluRay';
    return '720p';
}

/**
 * Parse size string
 */
function parseSize(sizeStr) {
    return sizeStr?.trim() || 'N/A';
}

/**
 * Search torrents on TorrentGalaxy
 */
export async function searchTorrents(query, limit = 10) {
    try {
        const searchPath = `/torrents.php?search=${encodeURIComponent(query)}&sort=seeders&order=desc`;
        const html = await fetchWithFallback(searchPath);
        const $ = cheerio.load(html);

        const results = [];

        $('div.tgxtablerow').slice(0, limit).each((i, row) => {
            const $row = $(row);

            // Get title and link
            const $nameLink = $row.find('a.txlight');
            const name = $nameLink.text().trim();
            const detailUrl = $nameLink.attr('href');

            // Get magnet link
            const magnetLink = $row.find('a[href^="magnet:"]').attr('href');

            // Size - usually in 4th column
            const size = $row.find('span.badge-secondary').first().text().trim();

            // Seeds and leeches
            const seeds = parseInt($row.find('span[title*="Seed"], font[color="green"]').text()) || 0;
            const peers = parseInt($row.find('span[title*="Leech"], font[color="#ff0000"]').text()) || 0;

            // Quality
            const quality = extractQuality(name);

            // Extract movie title (clean)
            let title = name
                .replace(/\./g, ' ')
                .replace(/\[.*?\]/g, '')
                .replace(/\(.*?\)/g, '')
                .replace(/\d{3,4}p.*/i, '')
                .replace(/(BluRay|WEB-DL|WEBDL|HDRip|BRRip|HDTV).*/i, '')
                .trim();

            if (name && magnetLink) {
                results.push({
                    id: `tgx_${i}`,
                    title: title || name.substring(0, 50),
                    titleFull: name,
                    detailUrl,
                    quality,
                    size: parseSize(size),
                    seeds,
                    peers,
                    magnetLink,
                    source: 'TorrentGalaxy'
                });
            }
        });

        console.log(`✅ TorrentGalaxy: Found ${results.length} results for "${query}"`);
        return results;

    } catch (error) {
        console.error('TorrentGalaxy search error:', error.message);
        return [];
    }
}

/**
 * Group results by movie
 */
export function groupByMovie(results) {
    const movies = new Map();

    for (const result of results) {
        const key = result.title.toLowerCase().substring(0, 30);

        if (!movies.has(key)) {
            movies.set(key, {
                id: result.id,
                title: result.title,
                torrents: [],
                source: 'TorrentGalaxy'
            });
        }

        movies.get(key).torrents.push({
            quality: result.quality,
            size: result.size,
            seeds: result.seeds,
            peers: result.peers,
            magnetLink: result.magnetLink,
            source: 'TorrentGalaxy'
        });
    }

    // Sort torrents by seeds
    for (const movie of movies.values()) {
        movie.torrents.sort((a, b) => b.seeds - a.seeds);
    }

    return Array.from(movies.values());
}

/**
 * Search and return with torrents array format
 */
export async function searchWithMagnets(query, limit = 10) {
    const results = await searchTorrents(query, limit);
    return groupByMovie(results);
}

export default {
    searchTorrents,
    searchWithMagnets,
    groupByMovie
};
