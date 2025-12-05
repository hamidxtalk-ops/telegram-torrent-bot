/**
 * Nyaa.si Scraper Service
 * Scrapes Nyaa.si for anime torrents
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

const NYAA_URLS = [
    'https://nyaa.si',
    'https://nyaa.land'
];

let currentUrl = NYAA_URLS[0];

const client = axios.create({
    timeout: 15000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
});

/**
 * Fetch with fallback
 */
async function fetchWithFallback(path) {
    for (let i = 0; i < NYAA_URLS.length; i++) {
        const url = `${currentUrl}${path}`;
        try {
            console.log(`🎌 Nyaa request: ${url}`);
            const response = await client.get(url);
            return response.data;
        } catch (error) {
            console.log(`❌ Nyaa failed: ${error.message}`);
            currentUrl = NYAA_URLS[(NYAA_URLS.indexOf(currentUrl) + 1) % NYAA_URLS.length];
        }
    }
    throw new Error('All Nyaa mirrors failed');
}

/**
 * Parse size string to readable format
 */
function parseSize(sizeStr) {
    return sizeStr || 'N/A';
}

/**
 * Extract quality from title
 */
function extractQuality(title) {
    if (title.includes('2160p') || title.includes('4K')) return '2160p';
    if (title.includes('1080p')) return '1080p';
    if (title.includes('720p')) return '720p';
    if (title.includes('480p')) return '480p';
    return '720p';
}

/**
 * Search anime on Nyaa.si
 */
export async function searchAnime(query, limit = 10) {
    try {
        // Category 1_2 = Anime - English-translated
        const searchPath = `/?f=0&c=1_2&q=${encodeURIComponent(query)}&s=seeders&o=desc`;
        const html = await fetchWithFallback(searchPath);
        const $ = cheerio.load(html);

        const results = [];

        $('table.torrent-list tbody tr').slice(0, limit).each((i, row) => {
            const $row = $(row);

            // Get title and link
            const $nameLink = $row.find('td:nth-child(2) a:not(.comments)').last();
            const name = $nameLink.text().trim();
            const detailUrl = $nameLink.attr('href');

            // Get magnet link
            const magnetLink = $row.find('a[href^="magnet:"]').attr('href');

            // Size
            const size = $row.find('td:nth-child(4)').text().trim();

            // Seeds and leeches
            const seeds = parseInt($row.find('td:nth-child(6)').text()) || 0;
            const peers = parseInt($row.find('td:nth-child(7)').text()) || 0;

            // Date
            const date = $row.find('td:nth-child(5)').text().trim();

            // Quality
            const quality = extractQuality(name);

            // Clean anime title (remove quality, release group, episode numbers)
            let title = name
                .replace(/\[.*?\]/g, '')  // Remove [SubGroup] tags
                .replace(/\(.*?\)/g, '')  // Remove (info) tags
                .replace(/S\d+E\d+.*/i, '')
                .replace(/\d{3,4}p.*/i, '')
                .replace(/Episode \d+.*/i, '')
                .replace(/ - \d+.*/i, '')
                .trim();

            if (name && magnetLink) {
                results.push({
                    id: `nyaa_${i}`,
                    title: title || name.substring(0, 50),
                    titleFull: name,
                    detailUrl,
                    quality,
                    size: parseSize(size),
                    seeds,
                    peers,
                    date,
                    magnetLink,
                    source: 'Nyaa',
                    type: 'anime'
                });
            }
        });

        console.log(`✅ Nyaa: Found ${results.length} results for "${query}"`);
        return results;

    } catch (error) {
        console.error('Nyaa search error:', error.message);
        return [];
    }
}

/**
 * Get latest/popular anime
 */
export async function getPopularAnime(limit = 10) {
    try {
        // Get popular anime sorted by seeders
        const searchPath = `/?f=0&c=1_2&q=&s=seeders&o=desc`;
        const html = await fetchWithFallback(searchPath);
        const $ = cheerio.load(html);

        const results = [];

        $('table.torrent-list tbody tr').slice(0, limit).each((i, row) => {
            const $row = $(row);

            const $nameLink = $row.find('td:nth-child(2) a:not(.comments)').last();
            const name = $nameLink.text().trim();
            const detailUrl = $nameLink.attr('href');

            const magnetLink = $row.find('a[href^="magnet:"]').attr('href');
            const size = $row.find('td:nth-child(4)').text().trim();
            const seeds = parseInt($row.find('td:nth-child(6)').text()) || 0;
            const peers = parseInt($row.find('td:nth-child(7)').text()) || 0;
            const date = $row.find('td:nth-child(5)').text().trim();
            const quality = extractQuality(name);

            let title = name
                .replace(/\[.*?\]/g, '')
                .replace(/\(.*?\)/g, '')
                .replace(/S\d+E\d+.*/i, '')
                .replace(/\d{3,4}p.*/i, '')
                .replace(/Episode \d+.*/i, '')
                .replace(/ - \d+.*/i, '')
                .trim();

            if (name && magnetLink) {
                results.push({
                    id: `nyaa_${i}`,
                    title: title || name.substring(0, 50),
                    titleFull: name,
                    detailUrl,
                    quality,
                    size: parseSize(size),
                    seeds,
                    peers,
                    date,
                    magnetLink,
                    source: 'Nyaa',
                    type: 'anime'
                });
            }
        });

        console.log(`✅ Nyaa: Found ${results.length} popular anime`);
        return results;

    } catch (error) {
        console.error('Nyaa popular error:', error.message);
        return [];
    }
}

/**
 * Group results by anime series
 */
export function groupByAnime(results) {
    const animes = new Map();

    for (const result of results) {
        const key = result.title.toLowerCase();

        if (!animes.has(key)) {
            animes.set(key, {
                id: result.id,
                title: result.title,
                type: 'anime',
                torrents: [],
                source: 'Nyaa'
            });
        }

        animes.get(key).torrents.push({
            name: result.titleFull,
            quality: result.quality,
            size: result.size,
            seeds: result.seeds,
            peers: result.peers,
            magnetLink: result.magnetLink
        });
    }

    // Sort torrents by seeds
    for (const anime of animes.values()) {
        anime.torrents.sort((a, b) => b.seeds - a.seeds);
    }

    return Array.from(animes.values());
}

/**
 * Search and get anime with magnets
 */
export async function searchWithMagnets(query, limit = 10) {
    const results = await searchAnime(query, limit);
    return results.map(r => ({
        ...r,
        torrents: [{
            quality: r.quality,
            size: r.size,
            seeds: r.seeds,
            peers: r.peers,
            magnetLink: r.magnetLink,
            source: 'Nyaa'
        }]
    }));
}

export default {
    searchAnime,
    searchWithMagnets,
    getPopularAnime,
    groupByAnime
};
