/**
 * GLODLS (GloTorrents) Scraper Service
 * Scrapes GLODLS.to for movies/TV torrents
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

const GLODLS_URLS = [
    'https://glodls.to',
    'https://gtso.cc'
];

let currentUrl = GLODLS_URLS[0];

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
    for (let i = 0; i < GLODLS_URLS.length; i++) {
        const url = `${currentUrl}${path}`;
        try {
            console.log(`🌍 GLODLS request: ${url}`);
            const response = await client.get(url);
            return response.data;
        } catch (error) {
            console.log(`❌ GLODLS failed: ${error.message}`);
            currentUrl = GLODLS_URLS[(GLODLS_URLS.indexOf(currentUrl) + 1) % GLODLS_URLS.length];
        }
    }
    throw new Error('All GLODLS mirrors failed');
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
 * Search torrents on GLODLS
 */
export async function searchTorrents(query, limit = 10) {
    try {
        // cat=0 for all categories, sort by seeders
        const searchPath = `/search.php?search=${encodeURIComponent(query)}&cat=0&incldead=0&inclexternal=0&lang=0&sort=seeders&order=desc`;
        const html = await fetchWithFallback(searchPath);
        const $ = cheerio.load(html);

        const results = [];

        // Parse torrent links from results
        $('a[href$=".html"]').each((i, link) => {
            if (results.length >= limit) return false;

            const $link = $(link);
            const href = $link.attr('href');
            const name = $link.text().trim();

            // Filter for torrent detail pages
            if (!href || !href.includes('-f-') || !name) return;

            // Skip unwanted content
            if (name.toLowerCase().includes('xxx')) return;

            const quality = extractQuality(name);

            // Clean title
            let title = name
                .replace(/\./g, ' ')
                .replace(/\[.*?\]/g, '')
                .replace(/\d{3,4}p.*/i, '')
                .replace(/(BluRay|WEB-DL|WEBDL|HDRip|BRRip|HDTV|WEBRip).*/i, '')
                .replace(/S\d{2}E\d{2}.*/i, '')
                .trim();

            results.push({
                id: `glo_${results.length}`,
                title: title || name.substring(0, 50),
                titleFull: name,
                detailUrl: href.startsWith('http') ? href : `${currentUrl}/${href}`,
                quality,
                size: 'N/A',
                seeds: 0,
                peers: 0,
                magnetLink: null,
                source: 'GLODLS',
                needsFetch: true
            });
        });

        // Fetch magnet links for top results
        const topResults = results.slice(0, Math.min(5, results.length));
        for (const result of topResults) {
            if (result.needsFetch && result.detailUrl) {
                try {
                    const detailHtml = await client.get(result.detailUrl);
                    const $detail = cheerio.load(detailHtml.data);

                    // Find magnet link
                    result.magnetLink = $detail('a[href^="magnet:"]').first().attr('href');

                    // Try to get size and seeds from detail page
                    const pageText = $detail('body').text();
                    const sizeMatch = pageText.match(/(\d+(?:\.\d+)?\s*(?:GB|MB|KB|TB))/i);
                    if (sizeMatch) result.size = sizeMatch[1];

                    delete result.needsFetch;
                } catch (e) {
                    console.log(`Failed to fetch magnet for ${result.title}`);
                }
            }
        }

        // Filter results with magnet links
        const validResults = results.filter(r => r.magnetLink);

        console.log(`✅ GLODLS: Found ${validResults.length} results for "${query}"`);
        return validResults;

    } catch (error) {
        console.error('GLODLS search error:', error.message);
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
                source: 'GLODLS'
            });
        }

        movies.get(key).torrents.push({
            quality: result.quality,
            size: result.size,
            seeds: result.seeds,
            peers: result.peers,
            magnetLink: result.magnetLink,
            source: 'GLODLS'
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
