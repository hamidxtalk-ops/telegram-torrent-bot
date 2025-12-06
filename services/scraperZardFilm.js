/**
 * ZardFilm Scraper Service
 * Scrapes movies and series from zardfilm.in
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

const BASE_URL = 'https://zardfilm.in';

const client = axios.create({
    timeout: 15000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fa-IR,fa;q=0.9,en;q=0.8'
    }
});

/**
 * Search ZardFilm for movies/series
 */
export async function searchZardFilm(query, limit = 10) {
    try {
        const url = `${BASE_URL}/page/1/?s=${encodeURIComponent(query)}`;
        console.log(`🎬 ZardFilm search: ${url}`);

        const response = await client.get(url);
        const $ = cheerio.load(response.data);

        const results = [];

        // Parse movie/series cards
        $('article, .post-item, .item, .movie-item').slice(0, limit).each((i, article) => {
            const $article = $(article);

            // Get title and link
            const $link = $article.find('a[href*="/movie/"]').first();
            const title = $link.attr('title') || $article.find('h2, .title, .post-title').text().trim();
            const detailUrl = $link.attr('href');

            // Get poster
            const poster = $article.find('img').attr('src') ||
                $article.find('img').attr('data-src') ||
                $article.find('img').attr('data-lazy-src');

            // Extract year from title
            const yearMatch = title.match(/\(?(19|20)\d{2}\)?/);
            const year = yearMatch ? parseInt(yearMatch[0].replace(/[()]/g, '')) : null;

            // Clean title
            let cleanTitle = title
                .replace(/\(?(19|20)\d{2}\)?/g, '')
                .replace(/دانلود فیلم|دانلود سریال|دوبله فارسی|با زیرنویس/g, '')
                .trim();

            if (cleanTitle && detailUrl) {
                results.push({
                    id: `zf_${i}`,
                    title: cleanTitle,
                    titleOriginal: title,
                    year,
                    poster,
                    detailUrl,
                    source: 'ZardFilm',
                    type: 'persian'
                });
            }
        });

        console.log(`✅ ZardFilm: Found ${results.length} results`);
        return results;

    } catch (error) {
        console.error('ZardFilm search error:', error.message);
        return [];
    }
}

/**
 * Get download links from ZardFilm detail page
 */
export async function getDownloadLinks(detailUrl) {
    try {
        console.log(`🔗 ZardFilm getting links: ${detailUrl}`);
        const response = await client.get(detailUrl);
        const $ = cheerio.load(response.data);

        const links = [];

        // Look for download links - ZardFilm typically has quality-based links
        $('a[href*="download"], a[href*=".mkv"], a[href*=".mp4"], .download-box a, .dlbox a, .btn-download').each((i, link) => {
            const $link = $(link);
            const href = $link.attr('href');
            const text = $link.text().trim();

            if (href && !href.includes('javascript') && !href.includes('#') && href.startsWith('http')) {
                // Parse quality
                let quality = 'نامشخص';
                const fullText = text.toLowerCase();
                if (fullText.includes('1080') || fullText.includes('فول')) quality = '1080p';
                else if (fullText.includes('720')) quality = '720p';
                else if (fullText.includes('480')) quality = '480p';
                else if (fullText.includes('4k') || fullText.includes('2160')) quality = '2160p';

                // Check if dubbed or subtitled
                const isDubbed = fullText.includes('دوبله');

                links.push({
                    url: href,
                    quality,
                    label: text.substring(0, 60),
                    isDirect: true,
                    isDubbed,
                    source: 'ZardFilm'
                });
            }
        });

        // Also look for links in tables (common pattern)
        $('table a[href*="http"]').each((i, link) => {
            const $link = $(link);
            const href = $link.attr('href');
            const text = $link.closest('tr').text() || $link.text();

            if (href && (href.includes('.mkv') || href.includes('.mp4') || href.includes('download'))) {
                let quality = 'نامشخص';
                if (text.includes('1080')) quality = '1080p';
                else if (text.includes('720')) quality = '720p';
                else if (text.includes('480')) quality = '480p';

                // Avoid duplicates
                if (!links.find(l => l.url === href)) {
                    links.push({
                        url: href,
                        quality,
                        label: text.substring(0, 60).trim(),
                        isDirect: true,
                        source: 'ZardFilm'
                    });
                }
            }
        });

        console.log(`✅ ZardFilm: Found ${links.length} download links`);
        return links;

    } catch (error) {
        console.error('ZardFilm links error:', error.message);
        return [];
    }
}

/**
 * Search with download links
 */
export async function searchWithLinks(query, limit = 5) {
    const movies = await searchZardFilm(query, limit);

    const results = [];
    for (const movie of movies.slice(0, 3)) {
        try {
            const links = await getDownloadLinks(movie.detailUrl);
            if (links.length > 0) {
                results.push({
                    ...movie,
                    torrents: links.map(l => ({
                        quality: l.quality,
                        size: 'N/A',
                        seeds: 0,
                        magnetLink: l.url,
                        isDirect: true,
                        source: 'ZardFilm'
                    }))
                });
            }
            // Delay between requests
            await new Promise(r => setTimeout(r, 500));
        } catch (e) {
            console.log(`Skipping ${movie.title}: ${e.message}`);
        }
    }

    return results;
}

export default {
    searchZardFilm,
    getDownloadLinks,
    searchWithLinks
};
