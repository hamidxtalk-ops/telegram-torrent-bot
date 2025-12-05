/**
 * /search Command
 * Search for movies with magnet links
 */

import db from '../database/sqlite.js';
import cache, { CacheKeys, TTL } from '../services/cache.js';
import yts from '../services/ytsAPI.js';
import tmdb from '../services/tmdbAPI.js';
import rateLimiter from '../utils/rateLimiter.js';
import { t } from '../utils/languages.js';
import { escapeMarkdown } from '../utils/formatter.js';

const searchResults = new Map();

/**
 * Handle /search command
 */
export async function handleSearch(bot, msg, query) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const lang = db.getLanguage(userId);

    if (!db.hasAcceptedTerms(userId)) {
        await bot.sendMessage(chatId, t(lang, 'termsRequired'), { parse_mode: 'Markdown' });
        return;
    }

    if (!query || query.trim().length === 0) {
        await bot.sendMessage(chatId, '💡 *Usage:* /search movie name\n\nExample: `/search The Matrix`', {
            parse_mode: 'Markdown'
        });
        return;
    }

    query = query.trim();

    const minuteLimit = rateLimiter.checkLimit(userId, 'search');
    if (!minuteLimit.allowed) {
        await bot.sendMessage(chatId, t(lang, 'rateLimitMinute', { seconds: minuteLimit.retryAfter }));
        return;
    }

    const searchingMsg = await bot.sendMessage(chatId, t(lang, 'searching'), {
        parse_mode: 'Markdown'
    });

    try {
        const cacheKey = CacheKeys.search(query);
        let results = cache.get(cacheKey);

        if (!results) {
            console.log('Searching YTS...');
            results = await yts.searchMovies(query, 10);

            if (!results || results.length === 0) {
                console.log('YTS unavailable, trying TMDb...');
                const tmdbResults = await tmdb.searchMovies(query);

                if (tmdbResults.length > 0) {
                    results = tmdbResults.map((movie, index) => ({
                        ...movie,
                        localId: index, // Add local index for reliable lookup
                        synopsis: movie.overview || '',
                        torrents: [],
                        source: 'tmdb'
                    }));
                }
            } else {
                // Add local index to YTS results too
                results = results.map((movie, index) => ({
                    ...movie,
                    localId: index
                }));
            }

            if (results && results.length > 0) {
                cache.set(cacheKey, results, TTL.SEARCH);
            }
        }

        db.addSearchHistory(userId, query, results?.length || 0);

        try {
            await bot.deleteMessage(chatId, searchingMsg.message_id);
        } catch (e) { }

        if (!results || results.length === 0) {
            await bot.sendMessage(chatId, t(lang, 'noResults'));
            return;
        }

        // Store results with user ID
        searchResults.set(`${userId}:results`, results);
        console.log(`Stored ${results.length} results for user ${userId}`);

        if (results.length === 1) {
            await sendMovieWithDownloads(bot, chatId, results[0], lang);
        } else {
            await sendMovieList(bot, chatId, results, query);
        }

    } catch (error) {
        console.error('Search error:', error);
        try { await bot.deleteMessage(chatId, searchingMsg.message_id); } catch (e) { }
        await bot.sendMessage(chatId, t(lang, 'errorGeneral'));
    }
}

/**
 * Send movie list
 */
async function sendMovieList(bot, chatId, movies, query) {
    let text = `🔍 *Found ${movies.length} results for "${escapeMarkdown(query)}"*\n\n`;

    movies.slice(0, 5).forEach((movie, i) => {
        const year = movie.year ? ` (${movie.year})` : '';
        const rating = movie.rating ? ` ⭐ ${movie.rating}` : '';
        text += `${i + 1}. *${escapeMarkdown(movie.title)}*${year}${rating}\n`;
    });

    // Use localId for callback data
    const keyboard = movies.slice(0, 5).map((movie, i) => [{
        text: `${i + 1}. ${movie.title.substring(0, 35)}`,
        callback_data: `sel:${i}` // Use simple index
    }]);

    await bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
    });
}

/**
 * Send movie with download links
 */
async function sendMovieWithDownloads(bot, chatId, movie, lang, movieIndex = 0) {
    let text = `🎬 *${escapeMarkdown(movie.title)}*`;
    if (movie.year) text += ` (${movie.year})`;
    text += '\n\n';

    if (movie.rating) text += `⭐ *Rating:* ${movie.rating}/10\n`;
    if (movie.runtime) text += `⏱ *Runtime:* ${movie.runtime} min\n`;
    if (movie.genres?.length) text += `🎭 *Genre:* ${movie.genres.slice(0, 3).join(', ')}\n`;
    text += '\n';

    // Add download section
    if (movie.torrents && movie.torrents.length > 0) {
        text += '📥 *دانلود با کیفیت‌های مختلف:*\n';
        text += '_(روی دکمه بزنید تا لینک ارسال شود)_\n\n';

        movie.torrents.forEach((torrent) => {
            const quality = torrent.quality || '720p';
            const size = torrent.size || 'N/A';
            const seeds = torrent.seeds || 0;
            text += `📦 *${quality}* - ${size} - 🌱${seeds}\n`;
        });
    } else {
        text += '⚠️ _لینک دانلود موجود نیست._\n';
        text += '_ISP شما سایت‌های تورنت را مسدود کرده._\n';
        text += '_برای دانلود از VPN استفاده کنید یا ربات را روی سرور خارجی اجرا کنید._\n';
    }

    // Create buttons
    const keyboard = [];

    if (movie.torrents && movie.torrents.length > 0) {
        movie.torrents.forEach((torrent, i) => {
            const quality = torrent.quality || '720p';
            const size = torrent.size || '';
            keyboard.push([{
                text: `📥 دانلود ${quality} (${size})`,
                callback_data: `get:${movieIndex}:${i}`
            }]);
        });
    }

    keyboard.push([{ text: '⭐ افزودن به علاقه‌مندی‌ها', callback_data: `fav:${movie.id}` }]);

    // Send with poster
    if (movie.poster || movie.posterLarge) {
        try {
            await bot.sendPhoto(chatId, movie.posterLarge || movie.poster, {
                caption: text,
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: keyboard }
            });
            return;
        } catch (e) {
            console.log('Photo failed, sending text');
        }
    }

    await bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
    });
}

/**
 * Handle movie selection - using simple index
 */
export async function handleMovieSelect(bot, query, indexStr) {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const lang = db.getLanguage(userId);

    const results = searchResults.get(`${userId}:results`);

    if (!results || results.length === 0) {
        await bot.answerCallbackQuery(query.id, {
            text: 'نتایج منقضی شده. دوباره جستجو کنید.',
            show_alert: true
        });
        return;
    }

    const index = parseInt(indexStr);
    const movie = results[index];

    if (!movie) {
        await bot.answerCallbackQuery(query.id, {
            text: 'فیلم پیدا نشد. دوباره جستجو کنید.',
            show_alert: true
        });
        return;
    }

    console.log(`User ${userId} selected movie: ${movie.title}`);

    try {
        await bot.deleteMessage(chatId, query.message.message_id);
    } catch (e) { }

    await sendMovieWithDownloads(bot, chatId, movie, lang, index);
    await bot.answerCallbackQuery(query.id);
}

/**
 * Handle torrent download - send magnet link
 */
export async function handleTorrentSelect(bot, query, movieIndex, torrentIndex) {
    const chatId = query.message.chat.id;
    const userId = query.from.id;

    try {
        const results = searchResults.get(`${userId}:results`);
        console.log(`Torrent select: user=${userId}, movieIndex=${movieIndex}, torrentIndex=${torrentIndex}`);
        console.log(`Results available: ${results ? results.length : 0}`);

        if (!results) {
            await bot.answerCallbackQuery(query.id, { text: 'نتایج منقضی شده. دوباره جستجو کنید.', show_alert: true });
            return;
        }

        const movie = results[parseInt(movieIndex)];
        console.log(`Movie found: ${movie ? movie.title : 'null'}`);
        console.log(`Torrents available: ${movie?.torrents?.length || 0}`);

        if (!movie) {
            await bot.answerCallbackQuery(query.id, { text: 'فیلم پیدا نشد. دوباره جستجو کنید.', show_alert: true });
            return;
        }

        if (!movie.torrents || movie.torrents.length === 0) {
            await bot.answerCallbackQuery(query.id, { text: 'لینک تورنت موجود نیست', show_alert: true });
            return;
        }

        const torrent = movie.torrents[parseInt(torrentIndex)];

        if (!torrent) {
            await bot.answerCallbackQuery(query.id, { text: 'این کیفیت موجود نیست', show_alert: true });
            return;
        }

        if (!torrent.magnetLink) {
            await bot.answerCallbackQuery(query.id, { text: 'لینک مگنت موجود نیست', show_alert: true });
            return;
        }

        console.log(`Sending magnet for: ${movie.title} - ${torrent.quality}`);

        // Send magnet link (Telegram doesn't allow magnet: URLs in buttons, so just send as text)
        const magnetText =
            `🎬 *${escapeMarkdown(movie.title)}*\n` +
            `📦 کیفیت: ${torrent.quality} | حجم: ${torrent.size}\n\n` +
            `🧲 *لینک مگنت:*\n` +
            `_(روی لینک زیر بزنید تا کپی شود)_\n\n` +
            `\`${torrent.magnetLink}\`\n\n` +
            `📱 *راهنما:*\n` +
            `1️⃣ روی لینک بالا بزنید تا کپی بشه\n` +
            `2️⃣ در برنامه تورنت (مثل uTorrent) پیست کنید\n` +
            `3️⃣ دانلود شروع میشه! 🎉`;

        await bot.sendMessage(chatId, magnetText, {
            parse_mode: 'Markdown'
        });

        await bot.answerCallbackQuery(query.id);
    } catch (error) {
        console.error('Torrent select error:', error);
        await bot.answerCallbackQuery(query.id, {
            text: `خطا: ${error.message}`,
            show_alert: true
        });
    }
}

/**
 * Handle magnet request
 */
export async function handleMagnetRequest(bot, query, movieIndex, torrentIndex) {
    await handleTorrentSelect(bot, query, movieIndex, torrentIndex);
}

// Compatibility exports
export async function handlePageChange(bot, query, page) {
    await bot.answerCallbackQuery(query.id);
}

export async function handleMoreSources(bot, query, movieId) {
    await bot.answerCallbackQuery(query.id, { text: 'از دکمه‌های دانلود استفاده کنید' });
}

export async function handleScraperSelect(bot, query, index) {
    await bot.answerCallbackQuery(query.id);
}

export async function sendMovieDetails(bot, chatId, movie, lang) {
    await sendMovieWithDownloads(bot, chatId, movie, lang, 0);
}

export default {
    handleSearch,
    handleMovieSelect,
    handlePageChange,
    handleTorrentSelect,
    handleMoreSources,
    handleScraperSelect,
    sendMovieDetails,
    handleMagnetRequest
};
