/**
 * TorrentDownloads Scraper Service
 * Scrapes TorrentDownloads.pro for movies/TV torrents
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

const TORRENTDL_URLS = [
    'https://www.torrentdownloads.pro',
    'https://www.torrentdownloads.me'
];

let currentUrl = TORRENTDL_URLS[0];

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
    for (let i = 0; i < TORRENTDL_URLS.length; i++) {
        const url = `${currentUrl}${path}`;
        try {
            console.log(`📥 TorrentDownloads request: ${url}`);
            const response = await client.get(url);
            return response.data;
        } catch (error) {
            console.log(`❌ TorrentDownloads failed: ${error.message}`);
            currentUrl = TORRENTDL_URLS[(TORRENTDL_URLS.indexOf(currentUrl) + 1) % TORRENTDL_URLS.length];
        }
    }
    throw new Error('All TorrentDownloads mirrors failed');
}

/**
 * Extract quality from title
 */
function extractQuality(title) {
    if (title.includes('2160p') || title.includes('4K')) return '2160p';
    if (title.includes('1080p')) return '1080p';
    if (title.includes('720p')) return '720p';
    if (title.includes('480p')) return '480p';
    if (title.includes('HDTV')) return '720p';
    return '720p';
}

/**
 * Parse size string
 */
function parseSize(sizeStr) {
    if (!sizeStr) return 'N/A';
    return sizeStr.trim();
}

/**
 * Search torrents on TorrentDownloads
 */
export async function searchTorrents(query, limit = 10) {
    try {
        const searchPath = `/search/?search=${encodeURIComponent(query)}`;
        const html = await fetchWithFallback(searchPath);
        const $ = cheerio.load(html);

        const results = [];

        // Parse search results - each row in the table
        $('table.table2 tr, div.grey_bar, p.tt-name').slice(0, limit * 2).each((i, row) => {
            const $row = $(row);

            // Try to find torrent link
            const $link = $row.find('a[href*="/torrent/"]').first();
            if (!$link.length) return;

            const name = $link.text().trim();
            const detailUrl = $link.attr('href');

            if (!name || !detailUrl) return;

            // Skip unwanted content
            if (name.toLowerCase().includes('xxx') ||
                name.toLowerCase().includes('porn')) return;

            // Get size, seeds, leeches from adjacent cells or spans
            const cells = $row.find('td, span');
            let size = 'N/A';
            let seeds = 0;
            let leeches = 0;

            cells.each((j, cell) => {
                const text = $(cell).text().trim();
                if (text.match(/^\d+(\.\d+)?\s*(GB|MB|KB|TB)/i)) {
                    size = text;
                } else if (text.match(/^\d+$/) && seeds === 0) {
                    seeds = parseInt(text);
                } else if (text.match(/^\d+$/) && leeches === 0) {
                    leeches = parseInt(text);
                }
            });

            const quality = extractQuality(name);

            // Clean title
            let title = name
                .replace(/\./g, ' ')
                .replace(/\[.*?\]/g, '')
                .replace(/\(.*?\)/g, '')
                .replace(/\d{3,4}p.*/i, '')
                .replace(/(BluRay|WEB-DL|WEBDL|HDRip|BRRip|HDTV).*/i, '')
                .replace(/S\d{2}E\d{2}.*/i, '')
                .trim();

            results.push({
                id: `tdl_${i}`,
                title: title || name.substring(0, 50),
                titleFull: name,
                detailUrl,
                quality,
                size,
                seeds,
                peers: leeches,
                magnetLink: null,
                source: 'TorrentDownloads',
                needsFetch: true
            });
        });

        // Fetch magnet links for top results
        const topResults = results.slice(0, Math.min(5, results.length));
        for (const result of topResults) {
            if (result.needsFetch && result.detailUrl) {
                try {
                    const detailHtml = await client.get(currentUrl + result.detailUrl);
                    const $detail = cheerio.load(detailHtml.data);

                    // Find magnet link
                    result.magnetLink = $detail('a[href^="magnet:"]').first().attr('href');
                    delete result.needsFetch;
                } catch (e) {
                    console.log(`Failed to fetch magnet for ${result.title}`);
                }
            }
        }

        // Filter results with magnet links
        const validResults = results.filter(r => r.magnetLink);

        console.log(`✅ TorrentDownloads: Found ${validResults.length} results for "${query}"`);
        return validResults;

    } catch (error) {
        console.error('TorrentDownloads search error:', error.message);
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
                source: 'TorrentDownloads'
            });
        }

        movies.get(key).torrents.push({
            quality: result.quality,
            size: result.size,
            seeds: result.seeds,
            peers: result.peers,
            magnetLink: result.magnetLink,
            source: 'TorrentDownloads'
        });
    }

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
