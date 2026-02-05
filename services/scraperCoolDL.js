/**
 * CoolDL Scraper Service
 * Scrapes movies from cooldl.net
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

const BASE_URL = 'https://cooldl.net';

const client = axios.create({
    timeout: 15000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fa-IR,fa;q=0.9,en;q=0.8'
    }
});

/**
 * Search CoolDL for movies
 */
export async function searchCoolDL(query, limit = 10) {
    try {
        const url = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
        console.log(`🎬 CoolDL search: ${url}`);

        const response = await client.get(url);
        const $ = cheerio.load(response.data);

        const results = [];

        // Parse movie cards - CoolDL uses article/post structure
        $('article, .post, .item, .movie-box').slice(0, limit).each((i, article) => {
            const $article = $(article);

            // Get link and title
            const $link = $article.find('a[href*="cooldl.net"]').first();
            const href = $link.attr('href');
            const title = $article.find('h2, .title, .entry-title').text().trim() ||
                $link.attr('title') || '';

            // Get poster
            const poster = $article.find('img').attr('src') ||
                $article.find('img').attr('data-src');

            // Extract year
            const yearMatch = title.match(/\(?(19|20)\d{2}\)?/);
            const year = yearMatch ? parseInt(yearMatch[0].replace(/[()]/g, '')) : null;

            // Clean title
            let cleanTitle = title
                .replace(/\(?(19|20)\d{2}\)?/g, '')
                .replace(/دانلود فیلم|دانلود سریال|دوبله|زیرنویس|✔️/g, '')
                .replace(/کول دانلود/g, '')
                .trim();

            if (cleanTitle && href && href.includes('cooldl.net')) {
                results.push({
                    id: `cdl_${i}`,
                    title: cleanTitle,
                    titleOriginal: title,
                    year,
                    poster,
                    detailUrl: href,
                    source: 'CoolDL',
                    type: 'persian'
                });
            }
        });

        console.log(`✅ CoolDL: Found ${results.length} results`);
        return results;

    } catch (error) {
        console.error('CoolDL search error:', error.message);
        return [];
    }
}

/**
 * Get download links from CoolDL detail page
 */
export async function getDownloadLinks(detailUrl) {
    try {
        console.log(`🔗 CoolDL getting links: ${detailUrl}`);
        const response = await client.get(detailUrl);
        const $ = cheerio.load(response.data);

        const links = [];

        // CoolDL has download links with quality indicators
        // Look for various download link patterns
        $('a').each((i, link) => {
            const $link = $(link);
            const href = $link.attr('href');
            const text = $link.text().trim();
            const parentText = $link.parent().text();

            // Check if it's a download link
            if (href && href.startsWith('http') &&
                (text.includes('دانلود') || text.includes('Download') ||
                    href.includes('.mkv') || href.includes('.mp4') ||
                    href.includes('download') || href.includes('dl.'))) {

                // Skip non-download links
                if (href.includes('javascript') || href.includes('#') ||
                    href.includes('t.me') || href.includes('instagram')) return;

                // Parse quality from text or parent
                const fullText = (text + ' ' + parentText).toLowerCase();
                let quality = 'نامشخص';
                if (fullText.includes('hq1080') || fullText.includes('1080')) quality = '1080p HQ';
                else if (fullText.includes('1080')) quality = '1080p';
                else if (fullText.includes('720')) quality = '720p';
                else if (fullText.includes('480')) quality = '480p';
                else if (fullText.includes('4k') || fullText.includes('2160')) quality = '2160p';

                // Check dubbed or subtitled
                const isDubbed = fullText.includes('دوبله');
                const hasSubtitle = fullText.includes('زیرنویس');

                // Create label
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
                        source: 'CoolDL'
                    });
                }
            }
        });

        // Sort by quality preference
        const qualityOrder = { '2160p': 0, '1080p HQ': 1, '1080p': 2, '720p': 3, '480p': 4, 'نامشخص': 5 };
        links.sort((a, b) => (qualityOrder[a.quality] || 5) - (qualityOrder[b.quality] || 5));

        console.log(`✅ CoolDL: Found ${links.length} download links`);
        return links.slice(0, 10); // Limit to top 10 links

    } catch (error) {
        console.error('CoolDL links error:', error.message);
        return [];
    }
}

/**
 * Search with download links
 */
export async function searchWithLinks(query, limit = 5) {
    const movies = await searchCoolDL(query, limit);

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
                        source: 'CoolDL'
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
    searchCoolDL,
    getDownloadLinks,
    searchWithLinks
};
