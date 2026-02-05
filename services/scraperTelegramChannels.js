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
    // { name: 'StreamWideBot', displayName: 'StreamWide Bot', priority: 1 }, // Bot doesn't have public preview
    { name: 'StreamWide', displayName: 'StreamWide', priority: 1 },
    { name: 'StreamWideBot', displayName: 'StreamWide Bot', priority: 1, isBotChannel: true },
    { name: 'filmehbot', displayName: 'Filmeh Bot', priority: 1, isBotChannel: true },
    { name: 'Filmeeh1', displayName: 'فیلمه 1', priority: 1 },
    { name: 'Filmeh_Archive', displayName: 'آرشیو فیلمه', priority: 1 },
    { name: 'Filmeeh_GP', displayName: 'فیلمه GP', priority: 1 },
    { name: 'WhenMoviez', displayName: 'When Moviez', priority: 1 },

    // کانال‌های بزرگ ایرانی - اولویت دوم
    { name: 'Film_Bazzanz', displayName: 'Film Bazzan', priority: 2 },
    { name: 'FilmpokVvip', displayName: 'Filmpok VIP', priority: 2 },
    { name: 'Filmseven_asli7', displayName: 'Film7', priority: 2 },
    { name: 'Mr_Film78', displayName: 'Mr Film', priority: 2 },
    { name: 'Sitofilm', displayName: 'Sito Film', priority: 2 },
    { name: 'CastroFilm4', displayName: 'Castro Film', priority: 2 },

    // کانال‌های جدید با پوشش گسترده
    { name: 'MovieDL_ir', displayName: 'MovieDL', priority: 2 },
    { name: 'Filmkadeh1', displayName: 'فیلمکده', priority: 2 },
    { name: 'FilmHD1080', displayName: 'Film HD 1080', priority: 2 },
    { name: 'Filmiha', displayName: 'فیلمیها', priority: 2 },
    { name: 'DigiMoviezz', displayName: 'DigiMoviez', priority: 2 },
    { name: 'FilmabadMovie', displayName: 'فیلم‌آباد', priority: 2 },
    { name: 'UpMovies1', displayName: 'UpMovies', priority: 2 },
    { name: 'MovieBox_ir', displayName: 'MovieBox', priority: 2 },

    // کانال‌های سریال و انیمه
    { name: 'SerialHD480', displayName: 'سریال HD', priority: 3 },
    { name: 'Anime_IR', displayName: 'انیمه ایران', priority: 3 },
    { name: 'KoreaDrama', displayName: 'کره دراما', priority: 3 },
    { name: 'TurkDizi_ir', displayName: 'سریال ترکی', priority: 3 },

    // کانال‌های پوشش کامل
    { name: 'Full_Movie_ir', displayName: 'Full Movie', priority: 3 },
    { name: 'MyFilmm', displayName: 'مای فیلم', priority: 3 },
    { name: 'Film2Khone', displayName: 'فیلم تو خونه', priority: 3 },
    { name: 'MovieLand_ir', displayName: 'MovieLand', priority: 3 }
];

// بات‌های تلگرام - غیرفعال (این بات‌ها توسط تلگرام مسدود شده‌اند)
// const TELEGRAM_BOTS = [];
const TELEGRAM_BOTS = []; // Bots are banned by Telegram for copyright

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
export async function searchChannel(channelName, query) {
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

            // Get bot download links - ONLY channel message links (bots are banned)
            const botLinks = [];

            // Skip banned bot patterns and only get direct message links
            const bannedPatterns = [
                'archivefilmehbot', 'filmeharchive_bot', 'archive_filmehbot',
                '2ad.ir', 'yun.ir', 'opizo.com', 'opizo.me', 'zi.link', 'uprocket.ir'
            ];

            $msg.find('a').each((j, link) => {
                const href = $(link).attr('href') || '';
                const text = $(link).text().trim();
                const hrefLower = href.toLowerCase();

                // Skip banned bot links
                // For StreamWide, we want to allow some bot links if they seem valid or are from our target channel
                const isBanned = bannedPatterns.some(pattern => hrefLower.includes(pattern)) && !hrefLower.includes('streamwide');
                if (isBanned) return;

                // Only include direct Telegram channel/message links OR direct file links
                // Allow t.me links and potential direct download text links
                const isChannelLink = href.includes('t.me/');

                // Check if it's a download-related text or link
                const downloadKeywords = ['دانلود', 'download', '480p', '720p', '1080p', '2160p', 'x265', 'x264', 'bluray', 'webrip', 'mkv', 'mp4'];
                const hasDownloadKeyword = downloadKeywords.some(kw => text.toLowerCase().includes(kw) || href.toLowerCase().includes(kw));

                // VERY Strict check: ONLY allow direct bot download links (?start=)
                // OR direct t.me links to the bots themselves if we are in search mode
                const isBotStart = href.includes('?start=');
                const isBotTarget = hrefLower.includes('filmehbot') && !hrefLower.includes('archive');

                if (isBotStart || (isBotTarget && isChannelLink)) {
                    botLinks.push({
                        url: href,
                        label: '🚀 شروع دانلود در ربات'
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

                // Detect Persian dub and hardsub in message text
                const msgLower = messageText.toLowerCase();
                const isDubbed = ['دوبله', 'dubbed', 'فارسی'].some(p => msgLower.includes(p));
                const hasHardSub = ['زیرنویس چسبیده', 'hardsub', 'زیرنویس'].some(p => msgLower.includes(p));

                // Extract IMDB ID if present in bot link
                let imdbId = null;
                for (const link of botLinks) {
                    const imdbMatch = link.url.match(/start=tt(\d+)/);
                    if (imdbMatch) {
                        imdbId = `tt${imdbMatch[1]}`;
                        break;
                    }
                }

                // Convert bot links to torrents format
                const torrents = botLinks.map(link => {
                    let label = link.label || '🚀 دانلود از ربات';
                    if (isDubbed) label = `🎙️ دوبله فارسی - ${label}`;
                    if (hasHardSub) label = `📝 زیرنویس - ${label}`;

                    return {
                        url: link.url,
                        label,
                        source: 'Telegram',
                        isTelegramBot: true,
                        isDubbed,
                        hasHardSub
                    };
                });

                results.push({
                    id: `tg_${channelName}_${i}`,
                    title: title.substring(0, 100),
                    year,
                    genres: hashtags,
                    poster,
                    imdbId,
                    messageLink,
                    botLinks,
                    torrents,
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
 * Get direct link to FilmehBot for a movie - DISABLED (bots are banned)
 */
export function getFilmehBotLink(imdbId) {
    // Bot is banned by Telegram for copyright infringement
    return null;
}

/**
 * Get links to all related Telegram bots - DISABLED (bots are banned)
 */
export function getTelegramBotLinks(imdbId) {
    // Bots are banned by Telegram for copyright infringement
    return [];
}

export default {
    searchChannel, // Exported now
    searchTelegramChannels,
    searchWithLinks,
    getFilmehBotLink,
    getTelegramBotLinks,
    CHANNELS,
    TELEGRAM_BOTS
};
