/**
 * LimeTorrents Scraper Service
 * Scrapes LimeTorrents for movie/TV torrents
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

const LIME_URLS = [
    'https://www.limetorrents.lol',
    'https://www.limetorrents.co',
    'https://limetorrents.unblockit.tv'
];

let currentUrl = LIME_URLS[0];

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
    for (let i = 0; i < LIME_URLS.length; i++) {
        const url = `${currentUrl}${path}`;
        try {
            console.log(`🍋 LimeTorrents request: ${url}`);
            const response = await client.get(url);
            return response.data;
        } catch (error) {
            console.log(`❌ LimeTorrents failed: ${error.message}`);
            currentUrl = LIME_URLS[(LIME_URLS.indexOf(currentUrl) + 1) % LIME_URLS.length];
        }
    }
    throw new Error('All LimeTorrents mirrors failed');
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
 * Search torrents on LimeTorrents
 */
export async function searchTorrents(query, limit = 10) {
    try {
        const searchPath = `/search/movies/${encodeURIComponent(query)}/seeds/1/`;
        const html = await fetchWithFallback(searchPath);
        const $ = cheerio.load(html);

        const results = [];

        $('table.table2 tr.table2ta').slice(0, limit).each((i, row) => {
            const $row = $(row);

            // Get title and link
            const $nameLink = $row.find('td.tdleft div.tt-name a').first();
            const name = $nameLink.text().trim();
            const detailUrl = $nameLink.attr('href');

            // Size
            const size = $row.find('td.tdnormal').eq(1).text().trim();

            // Seeds and leeches
            const seeds = parseInt($row.find('td.tdseed').text()) || 0;
            const peers = parseInt($row.find('td.tdleech').text()) || 0;

            // Quality
            const quality = extractQuality(name);

            // Clean title
            let title = name
                .replace(/\./g, ' ')
                .replace(/\[.*?\]/g, '')
                .replace(/\(.*?\)/g, '')
                .replace(/\d{3,4}p.*/i, '')
                .replace(/(BluRay|WEB-DL|WEBDL|HDRip|BRRip).*/i, '')
                .trim();

            if (name && detailUrl) {
                results.push({
                    id: `lime_${i}`,
                    title: title || name.substring(0, 50),
                    titleFull: name,
                    detailUrl,
                    quality,
                    size: size || 'N/A',
                    seeds,
                    peers,
                    magnetLink: null, // Need to fetch from detail page
                    source: 'LimeTorrents',
                    needsFetch: true
                });
            }
        });

        // Fetch magnet links for top results (max 5 to avoid rate limiting)
        const topResults = results.slice(0, Math.min(5, results.length));
        for (const result of topResults) {
            if (result.needsFetch && result.detailUrl) {
                try {
                    const detailHtml = await client.get(currentUrl + result.detailUrl);
                    const $detail = cheerio.load(detailHtml.data);
                    result.magnetLink = $detail('a.csprite_dltorrent[href^="magnet:"]').attr('href') ||
                        $detail('a[href^="magnet:"]').first().attr('href');
                    delete result.needsFetch;
                } catch (e) {
                    console.log(`Failed to fetch magnet for ${result.title}`);
                }
            }
        }

        // Filter out results without magnet links
        const validResults = results.filter(r => r.magnetLink);

        console.log(`✅ LimeTorrents: Found ${validResults.length} results for "${query}"`);
        return validResults;

    } catch (error) {
        console.error('LimeTorrents search error:', error.message);
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
                source: 'LimeTorrents'
            });
        }

        movies.get(key).torrents.push({
            quality: result.quality,
            size: result.size,
            seeds: result.seeds,
            peers: result.peers,
            magnetLink: result.magnetLink,
            source: 'LimeTorrents'
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
