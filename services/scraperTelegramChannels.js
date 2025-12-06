/**
 * Telegram Channel Scraper Service
 * Scrapes public Telegram channels via t.me/s/ web pages
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

// Telegram channels to scrape
const CHANNELS = [
    { name: 'Filmeh_Archive', displayName: 'Filmeh Archive' },
    { name: 'WhenMoviez', displayName: 'When Moviez' },
    { name: 'Filmeeh1', displayName: 'Filmeh | فیلمه' },
    { name: 'Film_Bazzanz', displayName: 'Film Bazzan' },
    { name: 'FilmpokVvip', displayName: 'Filmpok VIP' },
    { name: 'Filmseven_asli7', displayName: 'Film7' },
    { name: 'Mr_Film78', displayName: 'Mr Film' },
    { name: 'Sitofilm', displayName: 'Sito Film' },
    { name: 'CastroFilm4', displayName: 'Castro Film' }
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

            // Get bot download links
            const botLinks = [];
            $msg.find('a[href*="filmehbot?start="], a[href*="FilmehBot?start="]').each((j, link) => {
                const href = $(link).attr('href');
                const text = $(link).text().trim();
                if (href) {
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
export async function searchTelegramChannels(query, limit = 10) {
    console.log(`📢 Searching Telegram channels for: ${query}`);

    // Search all channels in parallel
    const channelResults = await Promise.allSettled(
        CHANNELS.map(ch => searchChannel(ch.name, query))
    );

    const results = [];

    // Collect successful results
    for (let i = 0; i < channelResults.length; i++) {
        if (channelResults[i].status === 'fulfilled') {
            const channelMovies = channelResults[i].value;
            // Add display name to each result
            channelMovies.forEach(movie => {
                movie.sourceDisplay = CHANNELS[i].displayName;
            });
            results.push(...channelMovies);
        }
    }

    console.log(`✅ Total Telegram results: ${results.length}`);
    return results.slice(0, limit);
}

/**
 * Search with download links (formatted for bot)
 */
export async function searchWithLinks(query, limit = 5) {
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

export default {
    searchTelegramChannels,
    searchWithLinks,
    getFilmehBotLink,
    CHANNELS
};
