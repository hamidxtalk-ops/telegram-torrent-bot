/**
 * Telegram Channel Scraper Service
 * Scrapes public Telegram channels via t.me/s/ web pages
 * Priority: User-requested channels first, then other sources
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

// Telegram channels to scrape - PRIORITY ORDER
const CHANNELS = [
    // کانال‌های درخواستی کاربر - اولویت اول
    { name: 'Filmeeh1', displayName: 'فیلمه 1', priority: 1 },
    { name: 'Filmeh_Archive', displayName: 'آرشیو فیلمه', priority: 1 },
    { name: 'Filmeeh_GP', displayName: 'فیلمه GP', priority: 1 },

    // سایر کانال‌های موجود
    { name: 'WhenMoviez', displayName: 'When Moviez', priority: 2 },
    { name: 'Film_Bazzanz', displayName: 'Film Bazzan', priority: 2 },
    { name: 'FilmpokVvip', displayName: 'Filmpok VIP', priority: 2 },
    { name: 'Filmseven_asli7', displayName: 'Film7', priority: 2 },
    { name: 'Mr_Film78', displayName: 'Mr Film', priority: 2 },
    { name: 'Sitofilm', displayName: 'Sito Film', priority: 2 },
    { name: 'CastroFilm4', displayName: 'Castro Film', priority: 2 }
];

// لینک‌های بات‌های تلگرام (برای نمایش به کاربر)
const TELEGRAM_BOTS = [
    { username: 'ArchiveFilmehbot', displayName: 'بات آرشیو فیلمه', url: 'https://t.me/ArchiveFilmehbot' },
    { username: 'FilmehArchive_bot', displayName: 'بات فیلمه آرشیو', url: 'https://t.me/FilmehArchive_bot' },
    { username: 'Archive_Filmehbot', displayName: 'بات آرشیو', url: 'https://t.me/Archive_Filmehbot' }
];

const client = axios.create({
    timeout: 15000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fa-IR,fa;q=0.9,en;q=0.8'
    }
});

/**
 * Search a single Telegram channel
 */
async function searchChannel(channelName, query) {
    try {
        // Telegram channel search URL
        const url = `https://t.me/s/${channelName}?q=${encodeURIComponent(query)}`;
        console.log(`📢 Telegram search: ${url}`);

        const response = await client.get(url);
        const $ = cheerio.load(response.data);

        const results = [];

        // Parse message posts
        $('.tgme_widget_message').each((i, msg) => {
            const $msg = $(msg);

            // Get message text
            const messageText = $msg.find('.tgme_widget_message_text').text().trim();

            // Get message link
            const messageLink = $msg.find('.tgme_widget_message_date').attr('href');

            // Get bot download links - extended patterns for multiple bots
            const botLinks = [];
            const botPatterns = [
                'filmehbot?start=',
                'FilmehBot?start=',
                'ArchiveFilmehbot?start=',
                'FilmehArchive_bot?start=',
                'Archive_Filmehbot?start=',
                'start=tt'  // Generic IMDB pattern
            ];

            $msg.find('a').each((j, link) => {
                const href = $(link).attr('href') || '';
                const text = $(link).text().trim();

                // Check if it's a download bot link
                const isDownloadLink = botPatterns.some(pattern =>
                    href.toLowerCase().includes(pattern.toLowerCase())
                ) || href.includes('t.me/') && href.includes('start=');

                if (isDownloadLink) {
                    botLinks.push({
                        url: href,
                        label: text || 'دانلود فایل'
                    });
                }
            });

            // Get hashtags (genres)
            const hashtags = [];
            $msg.find('a[href*="?q=%23"]').each((j, tag) => {
                const tagText = $(tag).text().trim();
                if (tagText.startsWith('#')) {
                    hashtags.push(tagText.replace('#', ''));
                }
            });

            // Get image/poster if available
            const posterStyle = $msg.find('.tgme_widget_message_photo_wrap').attr('style') || '';
            const posterMatch = posterStyle.match(/url\(['"]?(.*?)['"]?\)/);
            const poster = posterMatch ? posterMatch[1] : null;

            // Only add if message contains movie-related content
            if (botLinks.length > 0 && messageText) {
                // Try to extract movie title from message
                let title = messageText.split('\n')[0].trim();
                // Remove common prefixes
                title = title.replace(/^[🎬🎥📽️🔥⭐️🌟💯✨]+ ?/, '').trim();

                // Extract year if present
                const yearMatch = messageText.match(/\(?(19|20)\d{2}\)?/);
                const year = yearMatch ? parseInt(yearMatch[0].replace(/[()]/g, '')) : null;

                // Extract IMDB ID if present in bot link
                let imdbId = null;
                for (const link of botLinks) {
                    const imdbMatch = link.url.match(/start=tt(\d+)/);
                    if (imdbMatch) {
                        imdbId = `tt${imdbMatch[1]}`;
                        break;
                    }
                }

                results.push({
                    id: `tg_${channelName}_${i}`,
                    title: title.substring(0, 100),
                    year,
                    genres: hashtags,
                    poster,
                    imdbId,
                    messageLink,
                    botLinks,
                    source: channelName,
                    type: 'telegram'
                });
            }
        });

        console.log(`✅ ${channelName}: Found ${results.length} results`);
        return results;

    } catch (error) {
        console.error(`Telegram ${channelName} error:`, error.message);
        return [];
    }
}

/**
 * Search all Telegram channels
 */
export async function searchTelegramChannels(query, limit = 15) {
    console.log(`📢 Searching Telegram channels for: ${query}`);

    // Search all channels in parallel
    const channelResults = await Promise.allSettled(
        CHANNELS.map(ch => searchChannel(ch.name, query))
    );

    const results = [];

    // Collect successful results with priority ordering
    for (let i = 0; i < channelResults.length; i++) {
        if (channelResults[i].status === 'fulfilled') {
            const channelMovies = channelResults[i].value;
            // Add display name and priority to each result
            channelMovies.forEach(movie => {
                movie.sourceDisplay = CHANNELS[i].displayName;
                movie.priority = CHANNELS[i].priority;
            });
            results.push(...channelMovies);
        }
    }

    // Sort by priority (lower number = higher priority)
    results.sort((a, b) => (a.priority || 2) - (b.priority || 2));

    console.log(`✅ Total Telegram results: ${results.length}`);
    return results.slice(0, limit);
}

/**
 * Search with download links (formatted for bot)
 */
export async function searchWithLinks(query, limit = 10) {
    const movies = await searchTelegramChannels(query, limit);

    // Format results to match expected structure
    const results = movies.map(movie => ({
        ...movie,
        title: movie.title,
        year: movie.year,
        poster: movie.poster,
        torrents: movie.botLinks.map(link => ({
            quality: 'دانلود از تلگرام',
            size: 'N/A',
            seeds: 0,
            magnetLink: link.url, // Bot link acts as download link
            isDirect: false,
            isTelegramBot: true,
            source: movie.sourceDisplay || movie.source
        }))
    })).filter(m => m.torrents.length > 0);

    console.log(`✅ Telegram results with links: ${results.length}`);
    return results.slice(0, limit);
}

/**
 * Get direct link to FilmehBot for a movie
 */
export function getFilmehBotLink(imdbId) {
    if (!imdbId) return null;
    // Remove 'tt' prefix if present
    const id = imdbId.replace('tt', '');
    return `https://t.me/filmehbot?start=tt${id}`;
}

/**
 * Get links to all related Telegram bots
 */
export function getTelegramBotLinks(imdbId) {
    if (!imdbId) return [];
    const id = imdbId.replace('tt', '');

    return TELEGRAM_BOTS.map(bot => ({
        source: bot.displayName,
        url: `https://t.me/${bot.username}?start=tt${id}`,
        isTelegramBot: true
    }));
}

export default {
    searchTelegramChannels,
    searchWithLinks,
    getFilmehBotLink,
    getTelegramBotLinks,
    CHANNELS,
    TELEGRAM_BOTS
};
