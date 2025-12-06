/**
 * UpTVs Scraper Service
 * Scrapes movies and series from uptvs.com
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

const BASE_URL = 'https://uptvs.com';

const client = axios.create({
    timeout: 15000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fa-IR,fa;q=0.9,en;q=0.8',
        'Referer': 'https://uptvs.com/'
    }
});

/**
 * Search UpTVs for movies/series
 */
export async function searchUptvs(query, limit = 10) {
    try {
        const url = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
        console.log(`🎬 UpTVs search: ${url}`);

        const response = await client.get(url);
        const $ = cheerio.load(response.data);

        const results = [];

        // Parse movie/series cards
        $('article, .post, .item, .movie-item, .content-item').slice(0, limit).each((i, article) => {
            const $article = $(article);

            // Get link
            const $link = $article.find('a[href*="uptvs.com"]').first();
            const href = $link.attr('href');
            const title = $article.find('h2, .title, .entry-title, h3').text().trim() ||
                $link.attr('title') || '';

            // Get poster
            const poster = $article.find('img').attr('src') ||
                $article.find('img').attr('data-src') ||
                $article.find('img').attr('data-lazy-src');

            // Extract year
            const yearMatch = title.match(/\(?(19|20)\d{2}\)?/);
            const year = yearMatch ? parseInt(yearMatch[0].replace(/[()]/g, '')) : null;

            // Clean title
            let cleanTitle = title
                .replace(/\(?(19|20)\d{2}\)?/g, '')
                .replace(/فیلم|سریال|دوبله فارسی|با زیرنویس|آپ تی وی/g, '')
                .trim();

            if (cleanTitle && href && href.includes('uptvs.com')) {
                results.push({
                    id: `uptv_${i}`,
                    title: cleanTitle,
                    titleOriginal: title,
                    year,
                    poster,
                    detailUrl: href,
                    source: 'UpTVs',
                    type: 'persian'
                });
            }
        });

        console.log(`✅ UpTVs: Found ${results.length} results`);
        return results;

    } catch (error) {
        console.error('UpTVs search error:', error.message);
        return [];
    }
}

/**
 * Get download links from UpTVs detail page
 */
export async function getDownloadLinks(detailUrl) {
    try {
        console.log(`🔗 UpTVs getting links: ${detailUrl}`);
        const response = await client.get(detailUrl);
        const $ = cheerio.load(response.data);

        const links = [];

        // UpTVs has download sections with quality options
        // Look for download links in various containers
        $('a[href*="http"]').each((i, link) => {
            const $link = $(link);
            const href = $link.attr('href');
            const text = $link.text().trim();
            const parentText = $link.parent().text();

            // Filter for download links
            if (href &&
                (text.includes('دانلود') || text.includes('Download') ||
                    href.includes('.mkv') || href.includes('.mp4') ||
                    href.includes('download') || href.includes('/dl/'))) {

                // Skip social/non-download links
                if (href.includes('javascript') || href.includes('#') ||
                    href.includes('t.me') || href.includes('instagram') ||
                    href.includes('twitter') || href.includes('facebook')) return;

                const fullText = (text + ' ' + parentText).toLowerCase();

                // Parse quality
                let quality = 'نامشخص';
                if (fullText.includes('1080')) quality = '1080p';
                else if (fullText.includes('720')) quality = '720p';
                else if (fullText.includes('480')) quality = '480p';
                else if (fullText.includes('4k') || fullText.includes('2160')) quality = '2160p';

                // Check type
                const isDubbed = fullText.includes('دوبله');
                const hasSubtitle = fullText.includes('زیرنویس');

                let label = quality;
                if (isDubbed) label += ' (دوبله)';
                else if (hasSubtitle) label += ' (زیرنویس)';

                // Avoid duplicates
                if (!links.find(l => l.url === href)) {
                    links.push({
                        url: href,
                        quality,
                        label,
                        isDirect: true,
                        isDubbed,
                        hasSubtitle,
                        source: 'UpTVs'
                    });
                }
            }
        });

        // Also check for download boxes/tables
        $('.download-box a, .dlbox a, .quality-box a, table.downloads a').each((i, link) => {
            const $link = $(link);
            const href = $link.attr('href');
            const text = $link.closest('tr, .item, div').text();

            if (href && href.startsWith('http') && !links.find(l => l.url === href)) {
                let quality = 'نامشخص';
                if (text.includes('1080')) quality = '1080p';
                else if (text.includes('720')) quality = '720p';
                else if (text.includes('480')) quality = '480p';

                links.push({
                    url: href,
                    quality,
                    label: quality,
                    isDirect: true,
                    source: 'UpTVs'
                });
            }
        });

        // Sort by quality
        const qualityOrder = { '2160p': 0, '1080p': 1, '720p': 2, '480p': 3, 'نامشخص': 4 };
        links.sort((a, b) => (qualityOrder[a.quality] || 4) - (qualityOrder[b.quality] || 4));

        console.log(`✅ UpTVs: Found ${links.length} download links`);
        return links.slice(0, 10);

    } catch (error) {
        console.error('UpTVs links error:', error.message);
        return [];
    }
}

/**
 * Search with download links
 */
export async function searchWithLinks(query, limit = 5) {
    const movies = await searchUptvs(query, limit);

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
                        source: 'UpTVs'
                    }))
                });
            }
            await new Promise(r => setTimeout(r, 500));
        } catch (e) {
            console.log(`Skipping ${movie.title}: ${e.message}`);
        }
    }

    return results;
}

export default {
    searchUptvs,
    getDownloadLinks,
    searchWithLinks
};
