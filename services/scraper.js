/**
 * Web Scraper Service
 * Uses CORS proxies to bypass ISP blocking
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

// CORS proxies
const CORS_PROXIES = [
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?'
];

const client = axios.create({
    timeout: 25000,
    headers: { 'User-Agent': USER_AGENT }
});

/**
 * Fetch URL through CORS proxy
 */
async function fetchWithProxy(url) {
    // Try direct first
    try {
        const response = await client.get(url);
        return response.data;
    } catch (e) {
        // Try proxies
    }

    for (const proxy of CORS_PROXIES) {
        try {
            const response = await client.get(proxy + encodeURIComponent(url));
            return response.data;
        } catch (e) {
            continue;
        }
    }
    return null;
}

/**
 * Search 1337x for torrents
 */
export async function search1337x(query) {
    try {
        const searchUrl = `https://1337x.to/search/${encodeURIComponent(query)}/1/`;
        const html = await fetchWithProxy(searchUrl);

        if (!html) return [];

        const $ = cheerio.load(html);
        const results = [];

        $('table.table-list tbody tr').each((index, element) => {
            if (index >= 10) return false;

            const $row = $(element);
            const titleCell = $row.find('td.name a:nth-child(2)');
            const title = titleCell.text().trim();
            const detailUrl = titleCell.attr('href');

            const seeds = parseInt($row.find('td.seeds').text().trim()) || 0;
            const leeches = parseInt($row.find('td.leeches').text().trim()) || 0;
            const size = $row.find('td.size').text().replace(/[^\d.GMKB]/gi, '').trim();

            if (title && detailUrl) {
                results.push({
                    title,
                    detailUrl: `https://1337x.to${detailUrl}`,
                    seeds, leeches, size,
                    source: '1337x'
                });
            }
        });

        return results;
    } catch (error) {
        console.error('1337x Scrape Error:', error.message);
        return [];
    }
}

/**
 * Get magnet link from 1337x detail page
 */
export async function get1337xDetails(detailUrl) {
    try {
        const html = await fetchWithProxy(detailUrl);
        if (!html) return null;

        const $ = cheerio.load(html);
        const magnetLink = $('a[href^="magnet:"]').first().attr('href');

        return { magnetLink };
    } catch (error) {
        console.error('1337x Detail Error:', error.message);
        return null;
    }
}

/**
 * Search TorrentGalaxy
 */
export async function searchTorrentGalaxy(query) {
    try {
        const searchUrl = `https://torrentgalaxy.to/torrents.php?search=${encodeURIComponent(query)}&sort=seeders&order=desc`;
        const html = await fetchWithProxy(searchUrl);

        if (!html) return [];

        const $ = cheerio.load(html);
        const results = [];

        $('div.tgxtablerow').each((index, element) => {
            if (index >= 10) return false;

            const $row = $(element);
            const title = $row.find('div.tgxtablecell a.txlight').text().trim();
            const magnetLink = $row.find('a[href^="magnet:"]').attr('href');
            const seeds = parseInt($row.find('span[title="Seeders/Leechers"] font:first-child').text()) || 0;
            const size = $row.find('div.tgxtablecell:nth-child(8)').text().trim();

            if (title && magnetLink) {
                results.push({ title, magnetLink, seeds, size, source: 'torrentgalaxy' });
            }
        });

        return results;
    } catch (error) {
        console.error('TorrentGalaxy Scrape Error:', error.message);
        return [];
    }
}

/**
 * Search all sources
 */
export async function searchAll(query) {
    const [results1337x, resultsTG] = await Promise.allSettled([
        search1337x(query),
        searchTorrentGalaxy(query)
    ]);

    const allResults = [
        ...(results1337x.status === 'fulfilled' ? results1337x.value : []),
        ...(resultsTG.status === 'fulfilled' ? resultsTG.value : [])
    ];

    allResults.sort((a, b) => b.seeds - a.seeds);
    return allResults;
}

export function extractQuality(title) {
    if (/2160p|4k|uhd/i.test(title)) return '4K';
    if (/1080p/i.test(title)) return '1080p';
    if (/720p/i.test(title)) return '720p';
    return 'Unknown';
}

export function extractCodec(title) {
    if (/x265|hevc/i.test(title)) return 'x265';
    if (/x264/i.test(title)) return 'x264';
    return '';
}

export default {
    search1337x,
    get1337xDetails,
    searchTorrentGalaxy,
    searchAll,
    extractQuality,
    extractCodec
};
