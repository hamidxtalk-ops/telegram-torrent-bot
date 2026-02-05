/**
 * TodayTvSeries Scraper Service
 * Scrapes TodayTvSeries for TV shows and movies with direct download links
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

// Multiple mirror URLs for TodayTvSeries
const TODAYTV_URLS = [
    'https://todaytvseries1.club',
    'https://todaytvseries.one',
    'https://todaytvseries1.com'
];

let currentUrl = TODAYTV_URLS[0];

const client = axios.create({
    timeout: 15000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
    }
});

/**
 * Fetch with fallback to mirrors
 */
async function fetchWithFallback(path) {
    for (let i = 0; i < TODAYTV_URLS.length; i++) {
        const url = `${currentUrl}${path}`;
        try {
            console.log(`📺 TodayTV request: ${url}`);
            const response = await client.get(url);
            return response.data;
        } catch (error) {
            console.log(`❌ TodayTV failed: ${error.message}`);
            currentUrl = TODAYTV_URLS[(TODAYTV_URLS.indexOf(currentUrl) + 1) % TODAYTV_URLS.length];
        }
    }
    throw new Error('All TodayTV mirrors failed');
}

/**
 * Extract quality from title/link text
 */
function extractQuality(text) {
    if (text.includes('2160p') || text.includes('4K')) return '2160p';
    if (text.includes('1080p')) return '1080p';
    if (text.includes('720p')) return '720p';
    if (text.includes('480p')) return '480p';
    return '720p';
}

/**
 * Parse episode info from text
 */
function parseEpisodeInfo(text) {
    const match = text.match(/S(\d+)E(\d+)(?:-E?(\d+))?/i);
    if (match) {
        return {
            season: parseInt(match[1]),
            episode: parseInt(match[2]),
            episodeEnd: match[3] ? parseInt(match[3]) : null
        };
    }
    return null;
}

/**
 * Search for TV shows and movies on TodayTvSeries
 */
export async function searchTodayTV(query, limit = 15) {
    try {
        const searchPath = `/?s=${encodeURIComponent(query)}`;
        const html = await fetchWithFallback(searchPath);
        const $ = cheerio.load(html);

        const results = [];

        // Search results usually in article or result-item divs
        $('article, .result-item, .search-item, .post').slice(0, limit).each((i, item) => {
            const $item = $(item);

            // Get title and link
            const $link = $item.find('a.entry-title, h2 a, .title a, a[href*="/tvshows/"], a[href*="/movies/"]').first();
            let title = $link.text().trim() || $item.find('h2, .title, h3').first().text().trim();
            const detailUrl = $link.attr('href');

            // Get poster image
            const poster = $item.find('img').attr('src') || $item.find('img').attr('data-src');

            // Determine if it's a TV show or movie
            const isTV = detailUrl?.includes('/tvshows/');
            const type = isTV ? 'tv' : 'movie';

            // Try to extract year
            const yearMatch = title.match(/\b(19|20)\d{2}\b/);
            const year = yearMatch ? parseInt(yearMatch[0]) : null;

            // Clean title
            let cleanTitle = title
                .replace(/\b(19|20)\d{2}\b/g, '')
                .replace(/Download|Free|HD|Full/gi, '')
                .trim();

            if (title && detailUrl) {
                results.push({
                    id: `ttv_${i}`,
                    title: cleanTitle || title,
                    titleOriginal: title,
                    year,
                    poster,
                    detailUrl,
                    type,
                    source: 'TodayTV',
                    needsFetch: true
                });
            }
        });

        console.log(`✅ TodayTV: Found ${results.length} search results for "${query}"`);
        return results;

    } catch (error) {
        console.error('TodayTV search error:', error.message);
        return [];
    }
}

/**
 * Get download links from a TodayTV detail page
 */
export async function getDownloadLinks(detailUrl) {
    try {
        console.log(`🔗 TodayTV fetching links from: ${detailUrl}`);

        // Handle relative URLs
        const fullUrl = detailUrl.startsWith('http') ? detailUrl : `${currentUrl}${detailUrl}`;
        const response = await client.get(fullUrl);
        const $ = cheerio.load(response.data);

        const links = [];
        const seen = new Set();

        // TodayTV has download links in format: [Title SxxExx Quality Codec](url)
        // Links often point to 5play.cc
        $('a[href*="5play.cc"], a[href*="download"], .download-link a').each((i, link) => {
            const $link = $(link);
            const href = $link.attr('href');
            const text = $link.text().trim();

            if (!href || href.includes('javascript') || href.includes('#')) return;
            if (seen.has(href)) return;
            seen.add(href);

            const quality = extractQuality(text);
            const episodeInfo = parseEpisodeInfo(text);

            links.push({
                url: href,
                quality,
                label: text.substring(0, 80),
                episodeInfo,
                isDirect: true,
                source: 'TodayTV'
            });
        });

        // Also look for links in post content
        $('.entry-content a, .post-content a, article a').each((i, link) => {
            const $link = $(link);
            const href = $link.attr('href');
            const text = $link.text().trim();

            if (!href || href.includes('javascript') || href.includes('#')) return;
            if (!href.includes('5play.cc') && !text.match(/\d{3,4}p/i)) return;
            if (seen.has(href)) return;
            seen.add(href);

            const quality = extractQuality(text);
            const episodeInfo = parseEpisodeInfo(text);

            links.push({
                url: href,
                quality,
                label: text.substring(0, 80),
                episodeInfo,
                isDirect: true,
                source: 'TodayTV'
            });
        });

        console.log(`✅ TodayTV: Found ${links.length} download links`);
        return links;

    } catch (error) {
        console.error('TodayTV download links error:', error.message);
        return [];
    }
}

/**
 * Search and get results with download links
 */
export async function searchWithLinks(query, limit = 5) {
    const searchResults = await searchTodayTV(query, limit);
    const results = [];

    // Get download links for first few results
    for (const item of searchResults.slice(0, 3)) {
        try {
            const links = await getDownloadLinks(item.detailUrl);

            if (links.length > 0) {
                // Group links by episode if it's a TV show
                const torrents = links.map(l => ({
                    quality: l.quality,
                    size: 'N/A',
                    seeds: 0,
                    magnetLink: l.url,
                    isDirect: l.isDirect,
                    label: l.label,
                    episodeInfo: l.episodeInfo,
                    source: 'TodayTV'
                }));

                results.push({
                    ...item,
                    torrents,
                    needsFetch: false
                });
            }

            // Small delay between requests
            await new Promise(r => setTimeout(r, 300));
        } catch (e) {
            console.log(`Skipping ${item.title}: ${e.message}`);
        }
    }

    return results;
}

/**
 * Get latest TV shows
 */
export async function getLatestShows(limit = 10) {
    try {
        const html = await fetchWithFallback('/tvshows/');
        const $ = cheerio.load(html);

        const shows = [];

        $('.item, article, .show-item').slice(0, limit).each((i, item) => {
            const $item = $(item);
            const $link = $item.find('a').first();
            const title = $item.find('h2, .title, h3').first().text().trim() || $link.attr('title') || $link.text().trim();
            const url = $link.attr('href');
            const poster = $item.find('img').attr('src') || $item.find('img').attr('data-src');

            if (title && url) {
                shows.push({
                    id: `ttv_latest_${i}`,
                    title,
                    detailUrl: url,
                    poster,
                    type: 'tv',
                    source: 'TodayTV'
                });
            }
        });

        console.log(`✅ TodayTV: Found ${shows.length} latest shows`);
        return shows;

    } catch (error) {
        console.error('TodayTV latest shows error:', error.message);
        return [];
    }
}

/**
 * Get latest movies
 */
export async function getLatestMovies(limit = 10) {
    try {
        const html = await fetchWithFallback('/movies/');
        const $ = cheerio.load(html);

        const movies = [];

        $('.item, article, .movie-item').slice(0, limit).each((i, item) => {
            const $item = $(item);
            const $link = $item.find('a').first();
            const title = $item.find('h2, .title, h3').first().text().trim() || $link.attr('title') || $link.text().trim();
            const url = $link.attr('href');
            const poster = $item.find('img').attr('src') || $item.find('img').attr('data-src');

            // Extract year from title
            const yearMatch = title.match(/\b(19|20)\d{2}\b/);
            const year = yearMatch ? parseInt(yearMatch[0]) : null;

            if (title && url) {
                movies.push({
                    id: `ttv_movie_${i}`,
                    title: title.replace(/\b(19|20)\d{2}\b/g, '').trim(),
                    year,
                    detailUrl: url,
                    poster,
                    type: 'movie',
                    source: 'TodayTV'
                });
            }
        });

        console.log(`✅ TodayTV: Found ${movies.length} latest movies`);
        return movies;

    } catch (error) {
        console.error('TodayTV latest movies error:', error.message);
        return [];
    }
}

export default {
    searchTodayTV,
    getDownloadLinks,
    searchWithLinks,
    getLatestShows,
    getLatestMovies
};
