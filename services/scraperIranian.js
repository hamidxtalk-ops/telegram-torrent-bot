/**
 * Iranian Movie Scraper Service
 * Aggregates from multiple Persian movie sources
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import scraperZardFilm from './scraperZardFilm.js';
import scraperCoolDL from './scraperCoolDL.js';
import scraperUptvs from './scraperUptvs.js';
import scraperTelegram from './scraperTelegramChannels.js';

// Persian movie sites
const SOURCES = {
    film2movie: {
        baseUrl: 'https://film2movie.asia',
        searchPath: '/page/1/?s=',
        name: 'Film2Movie'
    }
};

const client = axios.create({
    timeout: 15000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fa-IR,fa;q=0.9,en;q=0.8'
    }
});

/**
 * Search Film2Movie for Iranian/dubbed movies
 */
export async function searchFilm2Movie(query, limit = 10) {
    try {
        const url = `${SOURCES.film2movie.baseUrl}${SOURCES.film2movie.searchPath}${encodeURIComponent(query)}`;
        console.log(`🎬 Film2Movie search: ${url}`);

        const response = await client.get(url);
        const $ = cheerio.load(response.data);

        const results = [];

        $('article.post, .post-item, .item').slice(0, limit).each((i, article) => {
            const $article = $(article);

            const $link = $article.find('a.post-title, h2 a, .title a').first();
            const title = $link.text().trim() || $article.find('h2, .title').first().text().trim();
            const detailUrl = $link.attr('href');

            const poster = $article.find('img').attr('src') || $article.find('img').attr('data-src');

            // Try to extract year
            const yearMatch = title.match(/\(?(19|20)\d{2}\)?/);
            const year = yearMatch ? parseInt(yearMatch[0].replace(/[()]/g, '')) : null;

            // Clean title
            let cleanTitle = title
                .replace(/\(?(19|20)\d{2}\)?/g, '')
                .replace(/دانلود فیلم|دانلود سریال|دوبله فارسی/g, '')
                .trim();

            if (title && detailUrl) {
                results.push({
                    id: `f2m_${i}`,
                    title: cleanTitle || title,
                    titleOriginal: title,
                    year,
                    poster,
                    detailUrl,
                    source: 'Film2Movie',
                    type: 'iranian'
                });
            }
        });

        console.log(`✅ Film2Movie: Found ${results.length} results`);
        return results;

    } catch (error) {
        console.error('Film2Movie error:', error.message);
        return [];
    }
}

/**
 * Get download links from Film2Movie detail page
 */
export async function getDownloadLinks(detailUrl) {
    try {
        console.log(`🔗 Getting links from: ${detailUrl}`);
        const response = await client.get(detailUrl);
        const $ = cheerio.load(response.data);

        const links = [];

        // Look for download links
        $('a[href*="download"], a[href*=".mkv"], a[href*=".mp4"], .download-link a, .box-download a').each((i, link) => {
            const $link = $(link);
            const href = $link.attr('href');
            const text = $link.text().trim();

            if (href && !href.includes('javascript') && !href.includes('#')) {
                // Parse quality from text
                let quality = 'نامشخص';
                if (text.includes('1080') || text.includes('فول')) quality = '1080p';
                else if (text.includes('720')) quality = '720p';
                else if (text.includes('480')) quality = '480p';
                else if (text.includes('4K') || text.includes('2160')) quality = '2160p';

                links.push({
                    url: href,
                    quality,
                    label: text.substring(0, 50),
                    isDirect: !href.includes('magnet:')
                });
            }
        });

        console.log(`✅ Found ${links.length} download links`);
        return links;

    } catch (error) {
        console.error('Download links error:', error.message);
        return [];
    }
}

/**
 * Search all Iranian sources
 */
export async function searchIranian(query, limit = 10) {
    console.log(`🇮🇷 Searching all Persian sources for: ${query}`);

    // Search all sources in parallel
    const [film2movieResults, zardfilmResults, cooldlResults, uptvsResults, telegramResults] = await Promise.allSettled([
        searchFilm2Movie(query, limit),
        scraperZardFilm.searchZardFilm(query, limit),
        scraperCoolDL.searchCoolDL(query, limit),
        scraperUptvs.searchUptvs(query, limit),
        scraperTelegram.searchTelegramChannels(query, limit)
    ]);

    const results = [];

    // Collect successful results
    if (film2movieResults.status === 'fulfilled') results.push(...film2movieResults.value);
    if (zardfilmResults.status === 'fulfilled') results.push(...zardfilmResults.value);
    if (cooldlResults.status === 'fulfilled') results.push(...cooldlResults.value);
    if (uptvsResults.status === 'fulfilled') results.push(...uptvsResults.value);
    if (telegramResults.status === 'fulfilled') results.push(...telegramResults.value);

    console.log(`✅ Total Persian results: ${results.length}`);
    return results.slice(0, limit);
}

/**
 * Get movie with download links from all sources
 */
export async function searchWithLinks(query, limit = 5) {
    console.log(`🇮🇷 Searching Persian sources with links: ${query}`);

    // Try all sources in parallel
    const [film2movieResults, zardfilmResults, cooldlResults, uptvsResults, telegramResults] = await Promise.allSettled([
        searchFilm2MovieWithLinks(query, 2),
        scraperZardFilm.searchWithLinks(query, 2),
        scraperCoolDL.searchWithLinks(query, 2),
        scraperUptvs.searchWithLinks(query, 2),
        scraperTelegram.searchWithLinks(query, 2)
    ]);

    const results = [];

    if (film2movieResults.status === 'fulfilled') results.push(...film2movieResults.value);
    if (zardfilmResults.status === 'fulfilled') results.push(...zardfilmResults.value);
    if (cooldlResults.status === 'fulfilled') results.push(...cooldlResults.value);
    if (uptvsResults.status === 'fulfilled') results.push(...uptvsResults.value);
    if (telegramResults.status === 'fulfilled') results.push(...telegramResults.value);

    console.log(`✅ Total Persian results with links: ${results.length}`);
    return results.slice(0, limit);
}

/**
 * Film2Movie search with links (internal)
 */
async function searchFilm2MovieWithLinks(query, limit = 3) {
    const movies = await searchFilm2Movie(query, limit);

    const results = [];
    for (const movie of movies.slice(0, 3)) {
        try {
            const links = await getDownloadLinks(movie.detailUrl);
            results.push({
                ...movie,
                torrents: links.map(l => ({
                    quality: l.quality,
                    size: 'N/A',
                    seeds: 0,
                    magnetLink: l.url,
                    isDirect: l.isDirect,
                    source: 'Film2Movie'
                }))
            });
            await new Promise(r => setTimeout(r, 500));
        } catch (e) {
            console.log(`Skipping ${movie.title}: ${e.message}`);
        }
    }

    return results;
}

export default {
    searchFilm2Movie,
    searchIranian,
    getDownloadLinks,
    searchWithLinks
};

