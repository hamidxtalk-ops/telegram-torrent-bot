/**
 * /browse and /trending Commands
 * Uses TMDb for movie browsing (YTS is blocked)
 */

import db from '../database/sqlite.js';
import cache, { CacheKeys, TTL } from '../services/cache.js';
import tmdb, { GENRE_MAP } from '../services/tmdbAPI.js';
import { t } from '../utils/languages.js';
import { formatMovieList, formatSearchKeyboard, escapeMarkdown } from '../utils/formatter.js';

// Store browse results for pagination
const browseResults = new Map();

/**
 * Create search torrents for movies
 */
function createSearchTorrents(title, year) {
    const searchQuery = year ? `${title} ${year}` : title;
    const encoded = encodeURIComponent(searchQuery);

    return [
        {
            quality: '🔍 1337x',
            type: 'search',
            size: 'Click to search',
            magnetLink: `https://1337x.to/search/${encoded}/1/`,
            isSearchLink: true
        },
        {
            quality: '🔍 YTS',
            type: 'search',
            size: 'Click to search',
            magnetLink: `https://yts.mx/browse-movies/${encoded}`,
            isSearchLink: true
        }
    ];
}

/**
 * Handle /trending command
 */
export async function handleTrending(bot, msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const lang = db.getLanguage(userId);

    // Check terms
    if (!db.hasAcceptedTerms(userId)) {
        await bot.sendMessage(chatId, t(lang, 'termsRequired'));
        return;
    }

    // Send loading message
    const loadingMsg = await bot.sendMessage(chatId, '🔥 Loading trending movies...');

    try {
        // Check cache
        const cacheKey = CacheKeys.trending('week');
        let movies = cache.get(cacheKey);

        if (!movies) {
            // Get from TMDb (not blocked)
            console.log('Fetching trending from TMDb...');
            const tmdbMovies = await tmdb.getTrending('week');

            if (tmdbMovies.length > 0) {
                // Add search links for torrents
                movies = tmdbMovies.slice(0, 10).map(movie => ({
                    ...movie,
                    synopsis: movie.overview || '',
                    torrents: createSearchTorrents(movie.title, movie.year)
                }));
                cache.set(cacheKey, movies, TTL.TRENDING);
            }
        }

        // Delete loading message
        try {
            await bot.deleteMessage(chatId, loadingMsg.message_id);
        } catch (e) { }

        if (!movies || movies.length === 0) {
            await bot.sendMessage(chatId, '❌ Could not fetch trending movies. Please try again.');
            return;
        }

        // Store for pagination
        browseResults.set(`${userId}:trending`, movies);

        const { text } = formatMovieList(movies, t(lang, 'trendingTitle'));
        const keyboard = formatSearchKeyboard(movies, 0);

        // Add time period buttons
        keyboard.push([
            { text: '📅 Today', callback_data: 'trending:day' },
            { text: '📆 This Week', callback_data: 'trending:week' }
        ]);

        await bot.sendMessage(chatId, text, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboard }
        });

    } catch (error) {
        console.error('Trending error:', error);
        try {
            await bot.deleteMessage(chatId, loadingMsg.message_id);
        } catch (e) { }
        await bot.sendMessage(chatId, t(lang, 'errorGeneral'));
    }
}

/**
 * Handle /browse command
 */
export async function handleBrowse(bot, msg, genre = null) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const lang = db.getLanguage(userId);

    // Check terms
    if (!db.hasAcceptedTerms(userId)) {
        await bot.sendMessage(chatId, t(lang, 'termsRequired'));
        return;
    }

    // No genre specified - show genre selection
    if (!genre) {
        const genres = t(lang, 'genres');
        const genreButtons = Object.entries(genres).map(([key, label]) => ({
            text: label,
            callback_data: `genre:${key}`
        }));

        // Create rows of 2 buttons each
        const keyboard = [];
        for (let i = 0; i < genreButtons.length; i += 2) {
            keyboard.push(genreButtons.slice(i, i + 2));
        }

        await bot.sendMessage(chatId, t(lang, 'browseGenres'), {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboard }
        });
        return;
    }

    // Genre specified - fetch movies
    await fetchGenreMovies(bot, chatId, userId, genre, lang);
}

/**
 * Fetch movies by genre from TMDb
 */
async function fetchGenreMovies(bot, chatId, userId, genre, lang) {
    const loadingMsg = await bot.sendMessage(chatId, `🎭 Loading ${genre} movies...`);

    try {
        // Check cache
        const cacheKey = CacheKeys.genre(genre);
        let movies = cache.get(cacheKey);

        if (!movies) {
            // Get genre ID from map
            const genreId = GENRE_MAP[genre.toLowerCase()] || GENRE_MAP.action;

            console.log(`Fetching ${genre} movies from TMDb...`);
            const tmdbMovies = await tmdb.browseByGenre(genreId);

            if (tmdbMovies.length > 0) {
                movies = tmdbMovies.slice(0, 10).map(movie => ({
                    ...movie,
                    synopsis: movie.overview || '',
                    torrents: createSearchTorrents(movie.title, movie.year)
                }));
                cache.set(cacheKey, movies, TTL.TRENDING);
            }
        }

        try {
            await bot.deleteMessage(chatId, loadingMsg.message_id);
        } catch (e) { }

        if (!movies || movies.length === 0) {
            await bot.sendMessage(chatId, `❌ No ${genre} movies found.`);
            return;
        }

        // Store for pagination
        browseResults.set(`${userId}:genre:${genre}`, movies);

        const genreLabel = t(lang, `genres.${genre}`) || genre;
        const { text } = formatMovieList(movies, `${genreLabel} Movies`);
        const keyboard = formatSearchKeyboard(movies, 0);

        // Add back to genres button
        keyboard.push([
            { text: '🎭 Other Genres', callback_data: 'browse' }
        ]);

        await bot.sendMessage(chatId, text, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboard }
        });

    } catch (error) {
        console.error('Browse error:', error);
        try {
            await bot.deleteMessage(chatId, loadingMsg.message_id);
        } catch (e) { }
        await bot.sendMessage(chatId, t(lang, 'errorGeneral'));
    }
}

/**
 * Handle trending callback
 */
export async function handleTrendingCallback(bot, query) {
    const chatId = query.message.chat.id;

    await bot.answerCallbackQuery(query.id, { text: '🔥 Loading...' });

    const fakeMsg = {
        chat: { id: chatId },
        from: query.from
    };

    await handleTrending(bot, fakeMsg);
}

/**
 * Handle trending time period change
 */
export async function handleTrendingPeriod(bot, query, period) {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const lang = db.getLanguage(userId);

    await bot.answerCallbackQuery(query.id, { text: '⏳ Loading...' });

    try {
        const cacheKey = CacheKeys.trending(period);
        let movies = cache.get(cacheKey);

        if (!movies) {
            const tmdbMovies = await tmdb.getTrending(period);
            if (tmdbMovies.length > 0) {
                movies = tmdbMovies.slice(0, 10).map(movie => ({
                    ...movie,
                    synopsis: movie.overview || '',
                    torrents: createSearchTorrents(movie.title, movie.year)
                }));
                cache.set(cacheKey, movies, TTL.TRENDING);
            }
        }

        if (!movies || movies.length === 0) {
            await bot.answerCallbackQuery(query.id, {
                text: 'Could not load movies',
                show_alert: true
            });
            return;
        }

        browseResults.set(`${userId}:trending`, movies);

        const title = period === 'day' ? '🔥 Trending Today' : '🔥 Trending This Week';
        const { text } = formatMovieList(movies, title);
        const keyboard = formatSearchKeyboard(movies, 0);

        keyboard.push([
            { text: period === 'day' ? '✅ Today' : '📅 Today', callback_data: 'trending:day' },
            { text: period === 'week' ? '✅ This Week' : '📆 This Week', callback_data: 'trending:week' }
        ]);

        await bot.editMessageText(text, {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboard }
        });

    } catch (error) {
        console.error('Trending period error:', error);
    }
}

/**
 * Handle browse callback (show genre selection)
 */
export async function handleBrowseCallback(bot, query) {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const lang = db.getLanguage(userId);

    const genres = t(lang, 'genres');
    const genreButtons = Object.entries(genres).map(([key, label]) => ({
        text: label,
        callback_data: `genre:${key}`
    }));

    const keyboard = [];
    for (let i = 0; i < genreButtons.length; i += 2) {
        keyboard.push(genreButtons.slice(i, i + 2));
    }

    keyboard.push([{ text: '🔙 Back', callback_data: 'back_main' }]);

    try {
        await bot.editMessageText(t(lang, 'browseGenres'), {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboard }
        });
    } catch (e) {
        await bot.sendMessage(chatId, t(lang, 'browseGenres'), {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboard }
        });
    }

    await bot.answerCallbackQuery(query.id);
}

/**
 * Handle genre selection callback
 */
export async function handleGenreCallback(bot, query, genre) {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const lang = db.getLanguage(userId);

    await bot.answerCallbackQuery(query.id, { text: '⏳ Loading...' });

    try {
        await bot.deleteMessage(chatId, query.message.message_id);
    } catch (e) { }

    await fetchGenreMovies(bot, chatId, userId, genre, lang);
}

export default {
    handleTrending,
    handleBrowse,
    handleTrendingCallback,
    handleTrendingPeriod,
    handleBrowseCallback,
    handleGenreCallback
};
