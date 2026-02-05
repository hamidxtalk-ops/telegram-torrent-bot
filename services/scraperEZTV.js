/**
 * EZTV Scraper Service
 * Scrapes EZTV for TV series torrents
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

const EZTV_URLS = [
    'https://eztv.re',
    'https://eztv.wf',
    'https://eztv.ch',
    'https://eztv.tf'
];

let currentUrl = EZTV_URLS[0];

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
    for (let i = 0; i < EZTV_URLS.length; i++) {
        const url = `${currentUrl}${path}`;
        try {
            console.log(`📺 EZTV request: ${url}`);
            const response = await client.get(url);
            return response.data;
        } catch (error) {
            console.log(`❌ EZTV failed: ${error.message}`);
            currentUrl = EZTV_URLS[(EZTV_URLS.indexOf(currentUrl) + 1) % EZTV_URLS.length];
        }
    }
    throw new Error('All EZTV mirrors failed');
}

/**
 * Search TV series on EZTV
 */
export async function searchSeries(query, limit = 10) {
    try {
        const searchPath = `/search/${encodeURIComponent(query)}`;
        const html = await fetchWithFallback(searchPath);
        const $ = cheerio.load(html);

        const results = [];

        $('table.forum_header_border tr.forum_header_border').slice(0, limit).each((i, row) => {
            const $row = $(row);

            const $nameLink = $row.find('td:nth-child(2) a');
            const name = $nameLink.text().trim();
            const detailUrl = $nameLink.attr('href');

            // Get magnet link
            const magnetLink = $row.find('a.magnet, a[href^="magnet:"]').attr('href');

            // Size
            const size = $row.find('td:nth-child(4)').text().trim() || 'N/A';

            // Seeds
            const seeds = parseInt($row.find('td:nth-child(6)').text()) || 0;

            // Parse episode info (S01E01 format)
            const episodeMatch = name.match(/S(\d+)E(\d+)/i);
            const season = episodeMatch ? parseInt(episodeMatch[1]) : null;
            const episode = episodeMatch ? parseInt(episodeMatch[2]) : null;

            // Quality
            let quality = '720p';
            if (name.includes('2160p') || name.includes('4K')) quality = '2160p';
            else if (name.includes('1080p')) quality = '1080p';
            else if (name.includes('720p')) quality = '720p';
            else if (name.includes('480p')) quality = '480p';

            // Clean show title
            let title = name
                .replace(/S\d+E\d+.*/i, '')
                .replace(/\./g, ' ')
                .trim();

            if (name && magnetLink) {
                results.push({
                    id: `eztv_${i}`,
                    title: title || name.substring(0, 50),
                    titleFull: name,
                    season,
                    episode,
                    detailUrl,
                    quality,
                    size,
                    seeds,
                    magnetLink,
                    source: 'EZTV',
                    type: 'series'
                });
            }
        });

        console.log(`✅ EZTV: Found ${results.length} results for "${query}"`);
        return results;

    } catch (error) {
        console.error('EZTV search error:', error.message);
        return [];
    }
}

/**
 * Group by show and season
 */
export function groupBySeries(results) {
    const shows = new Map();

    for (const result of results) {
        const key = result.title.toLowerCase();

        if (!shows.has(key)) {
            shows.set(key, {
                id: result.id,
                title: result.title,
                type: 'series',
                episodes: [],
                source: 'EZTV'
            });
        }

        shows.get(key).episodes.push({
            season: result.season,
            episode: result.episode,
            name: result.titleFull,
            quality: result.quality,
            size: result.size,
            seeds: result.seeds,
            magnetLink: result.magnetLink
        });
    }

    // Sort episodes
    for (const show of shows.values()) {
        show.episodes.sort((a, b) => {
            if (a.season !== b.season) return (b.season || 0) - (a.season || 0);
            return (b.episode || 0) - (a.episode || 0);
        });
    }

    return Array.from(shows.values());
}

/**
 * Search and get episodes with magnets
 */
export async function searchWithMagnets(query, limit = 10) {
    const results = await searchSeries(query, limit);
    return results.map(r => ({
        ...r,
        torrents: [{
            quality: r.quality,
            size: r.size,
            seeds: r.seeds,
            peers: 0,
            magnetLink: r.magnetLink,
            source: 'EZTV'
        }]
    }));
}

export default {
    searchSeries,
    searchWithMagnets,
    groupBySeries
};
