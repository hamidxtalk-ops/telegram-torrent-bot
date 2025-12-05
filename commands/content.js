/**
 * Content Command Handlers
 * Handles TV series, anime, and recommendations
 */

import db from '../database/sqlite.js';
import cache, { CacheKeys, TTL } from '../services/cache.js';
import tmdb from '../services/tmdbAPI.js';
import scraperEZTV from '../services/scraperEZTV.js';
import scraperNyaa from '../services/scraperNyaa.js';
import scraper1337x from '../services/scraper1337x.js';
import { t } from '../utils/languages.js';
import { escapeMarkdown } from '../utils/formatter.js';
import { searchResults } from './search.js';

/**
 * Create search torrents for content
 */
function createSearchTorrents(title, year, type = 'movie') {
    const searchQuery = year ? `${title} ${year}` : title;
    const encoded = encodeURIComponent(searchQuery);

    const sources = [
        {
            quality: '🔍 1337x',
            type: 'search',
            size: 'کلیک برای جستجو',
            magnetLink: `https://1337x.to/search/${encoded}/1/`,
            isSearchLink: true
        }
    ];

    if (type === 'tv') {
        sources.push({
            quality: '📺 EZTV',
            type: 'search',
            size: 'کلیک برای جستجو',
            magnetLink: `https://eztv.re/search/${encoded}`,
            isSearchLink: true
        });
    } else if (type === 'anime') {
        sources.push({
            quality: '🎌 Nyaa',
            type: 'search',
            size: 'کلیک برای جستجو',
            magnetLink: `https://nyaa.si/?q=${encoded}`,
            isSearchLink: true
        });
    }

    return sources;
}

/**
 * Format content list for display
 */
function formatContentList(items, title, type = 'movie') {
    let text = `${title}\n\n`;

    items.slice(0, 10).forEach((item, i) => {
        const year = item.year ? ` (${item.year})` : '';
        const rating = item.rating ? ` ⭐ ${(item.rating).toFixed(1)}` : '';
        const typeEmoji = type === 'tv' ? '📺' : type === 'anime' ? '🎌' : '🎬';
        text += `${i + 1}. ${typeEmoji} *${escapeMarkdown(item.title)}*${year}${rating}\n`;
    });

    return text;
}

/**
 * Handle TV Series browsing
 */
export async function handleTVSeries(bot, query) {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const lang = db.getLanguage(userId);

    await bot.answerCallbackQuery(query.id, { text: '📺 در حال بارگذاری سریال‌ها...' });

    try {
        // Check cache
        const cacheKey = 'trending_tv';
        let tvShows = cache.get(cacheKey);

        if (!tvShows) {
            console.log('Fetching trending TV from TMDb...');
            const tmdbTV = await tmdb.getTrendingTV('week');

            if (tmdbTV.length > 0) {
                tvShows = tmdbTV.slice(0, 15).map(show => ({
                    ...show,
                    synopsis: show.overview || '',
                    torrents: createSearchTorrents(show.title, show.year, 'tv'),
                    type: 'tv'
                }));
                cache.set(cacheKey, tvShows, TTL.TRENDING);
            }
        }

        if (!tvShows || tvShows.length === 0) {
            await bot.sendMessage(chatId, '❌ سریالی یافت نشد. لطفاً دوباره امتحان کنید.');
            return;
        }

        // Store for selection
        searchResults.set(`${userId}:results`, tvShows);

        const text = formatContentList(tvShows, '📺 *سریال‌های محبوب این هفته*', 'tv');

        // Create keyboard
        const keyboard = tvShows.slice(0, 10).map((show, i) => [{
            text: `${i + 1}. ${show.title.substring(0, 35)}`,
            callback_data: `sel:${i}`
        }]);

        keyboard.push([{ text: '🔙 بازگشت', callback_data: 'back_main' }]);

        try {
            await bot.editMessageText(text, {
                chat_id: chatId,
                message_id: query.message.message_id,
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: keyboard }
            });
        } catch (e) {
            await bot.sendMessage(chatId, text, {
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: keyboard }
            });
        }

    } catch (error) {
        console.error('TV Series error:', error);
        await bot.sendMessage(chatId, t(lang, 'errorGeneral'));
    }
}

/**
 * Handle Anime browsing
 */
export async function handleAnime(bot, query) {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const lang = db.getLanguage(userId);

    await bot.answerCallbackQuery(query.id, { text: '🎌 در حال بارگذاری انیمه‌ها...' });

    try {
        // Check cache
        const cacheKey = 'popular_anime';
        let animes = cache.get(cacheKey);

        if (!animes) {
            console.log('Fetching popular anime...');

            // Try Nyaa first
            try {
                const nyaaResults = await scraperNyaa.getPopularAnime(15);
                if (nyaaResults.length > 0) {
                    animes = nyaaResults.map((anime, i) => ({
                        ...anime,
                        localId: i,
                        torrents: [{
                            quality: anime.quality,
                            size: anime.size,
                            seeds: anime.seeds,
                            magnetLink: anime.magnetLink,
                            source: 'Nyaa'
                        }]
                    }));
                }
            } catch (e) {
                console.log('Nyaa failed, trying TMDb anime...');
            }

            // Fallback to TMDb anime
            if (!animes || animes.length === 0) {
                const tmdbAnime = await tmdb.getAnimeTV();
                if (tmdbAnime.length > 0) {
                    animes = tmdbAnime.slice(0, 15).map(anime => ({
                        ...anime,
                        synopsis: anime.overview || '',
                        torrents: createSearchTorrents(anime.title, anime.year, 'anime'),
                        type: 'anime'
                    }));
                }
            }

            if (animes && animes.length > 0) {
                cache.set(cacheKey, animes, TTL.TRENDING);
            }
        }

        if (!animes || animes.length === 0) {
            await bot.sendMessage(chatId, '❌ انیمه‌ای یافت نشد. لطفاً دوباره امتحان کنید.');
            return;
        }

        // Store for selection
        searchResults.set(`${userId}:results`, animes);

        const text = formatContentList(animes, '🎌 *انیمه‌های محبوب*', 'anime');

        // Create keyboard
        const keyboard = animes.slice(0, 10).map((anime, i) => [{
            text: `${i + 1}. ${anime.title.substring(0, 35)}`,
            callback_data: `sel:${i}`
        }]);

        keyboard.push([{ text: '🔙 بازگشت', callback_data: 'back_main' }]);

        try {
            await bot.editMessageText(text, {
                chat_id: chatId,
                message_id: query.message.message_id,
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: keyboard }
            });
        } catch (e) {
            await bot.sendMessage(chatId, text, {
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: keyboard }
            });
        }

    } catch (error) {
        console.error('Anime error:', error);
        await bot.sendMessage(chatId, t(lang, 'errorGeneral'));
    }
}

/**
 * Handle Recommended content
 */
export async function handleRecommended(bot, query) {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const lang = db.getLanguage(userId);

    await bot.answerCallbackQuery(query.id, { text: '💫 پیشنهادات...' });

    // Show genre selection for recommendations
    const genres = {
        action: '💥 اکشن',
        comedy: '😂 کمدی',
        drama: '🎭 درام',
        horror: '👻 ترسناک',
        scifi: '🚀 علمی-تخیلی',
        romance: '💕 عاشقانه',
        thriller: '😱 هیجانی',
        animation: '🎨 انیمیشن',
        crime: '🔪 جنایی',
        documentary: '📚 مستند'
    };

    const genreButtons = Object.entries(genres).map(([key, label]) => ({
        text: label,
        callback_data: `rec_genre:${key}`
    }));

    const keyboard = [];
    for (let i = 0; i < genreButtons.length; i += 2) {
        keyboard.push(genreButtons.slice(i, i + 2));
    }
    keyboard.push([{ text: '🔙 بازگشت', callback_data: 'back_main' }]);

    const text = `💫 *پیشنهادات براساس ژانر*\n\nیک ژانر انتخاب کنید تا فیلم‌های پیشنهادی رو ببینید:`;

    try {
        await bot.editMessageText(text, {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboard }
        });
    } catch (e) {
        await bot.sendMessage(chatId, text, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboard }
        });
    }
}

/**
 * Handle genre-based recommendations
 */
export async function handleRecommendedGenre(bot, query, genre) {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const lang = db.getLanguage(userId);

    await bot.answerCallbackQuery(query.id, { text: '⏳ در حال بارگذاری...' });

    try {
        const genreMap = {
            action: 28, adventure: 12, animation: 16, comedy: 35,
            crime: 80, documentary: 99, drama: 18, family: 10751,
            fantasy: 14, history: 36, horror: 27, music: 10402,
            mystery: 9648, romance: 10749, scifi: 878, thriller: 53,
            war: 10752, western: 37
        };

        const genreId = genreMap[genre] || 28;
        const cacheKey = `rec_${genre}`;
        let movies = cache.get(cacheKey);

        if (!movies) {
            const tmdbMovies = await tmdb.browseByGenre(genreId);

            if (tmdbMovies.length > 0) {
                // Sort by release date (newest first)
                movies = tmdbMovies
                    .sort((a, b) => new Date(b.releaseDate || 0) - new Date(a.releaseDate || 0))
                    .slice(0, 15)
                    .map(movie => ({
                        ...movie,
                        synopsis: movie.overview || '',
                        torrents: createSearchTorrents(movie.title, movie.year)
                    }));
                cache.set(cacheKey, movies, TTL.TRENDING);
            }
        }

        if (!movies || movies.length === 0) {
            await bot.sendMessage(chatId, '❌ فیلمی یافت نشد.');
            return;
        }

        // Store for selection
        searchResults.set(`${userId}:results`, movies);

        const genreLabels = {
            action: 'اکشن', comedy: 'کمدی', drama: 'درام', horror: 'ترسناک',
            scifi: 'علمی-تخیلی', romance: 'عاشقانه', thriller: 'هیجانی',
            animation: 'انیمیشن', crime: 'جنایی', documentary: 'مستند'
        };

        const text = formatContentList(movies, `💫 *پیشنهادی ${genreLabels[genre] || genre}* (جدید به قدیم)`);

        const keyboard = movies.slice(0, 10).map((movie, i) => [{
            text: `${i + 1}. ${movie.title.substring(0, 35)}`,
            callback_data: `sel:${i}`
        }]);

        keyboard.push([
            { text: '🎭 ژانر دیگر', callback_data: 'recommended' },
            { text: '🔙 بازگشت', callback_data: 'back_main' }
        ]);

        try {
            await bot.editMessageText(text, {
                chat_id: chatId,
                message_id: query.message.message_id,
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: keyboard }
            });
        } catch (e) {
            await bot.sendMessage(chatId, text, {
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: keyboard }
            });
        }

    } catch (error) {
        console.error('Recommended genre error:', error);
        await bot.sendMessage(chatId, t(lang, 'errorGeneral'));
    }
}

export default {
    handleTVSeries,
    handleAnime,
    handleRecommended,
    handleRecommendedGenre
};
