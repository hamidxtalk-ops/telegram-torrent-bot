/**
 * /search Command
 * Search for movies with magnet links
 */

import db from '../database/sqlite.js';
import cache, { CacheKeys, TTL } from '../services/cache.js';
import yts from '../services/ytsAPI.js';
import tmdb from '../services/tmdbAPI.js';
import seedr from '../services/seedrAPI.js';
import scraper1337x from '../services/scraper1337x.js';
import scraperTPB from '../services/scraperTPB.js';
import scraperEZTV from '../services/scraperEZTV.js';
import scraperIranian from '../services/scraperIranian.js';
import subtitleAPI from '../services/subtitleAPI.js';
import rateLimiter from '../utils/rateLimiter.js';
import { t } from '../utils/languages.js';
import { escapeMarkdown } from '../utils/formatter.js';

// Check if Seedr is configured
const SEEDR_ENABLED = !!(process.env.SEEDR_USERNAME && process.env.SEEDR_PASSWORD);

// Shared results storage - also used by browse.js
export const searchResults = new Map();

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

            // If YTS has no results, try 1337x
            if (!results || results.length === 0) {
                console.log('YTS empty, trying 1337x...');
                try {
                    const x1337Results = await scraper1337x.searchWithMagnets(query, 8);
                    if (x1337Results && x1337Results.length > 0) {
                        results = scraper1337x.groupByMovie(x1337Results);
                        results = results.map((movie, index) => ({
                            ...movie,
                            localId: index,
                            source: '1337x'
                        }));
                        console.log(`1337x: Found ${results.length} movies`);
                    }
                } catch (e) {
                    console.log('1337x failed:', e.message);
                }
            }

            // If still no results, try TMDb for movie info
            if (!results || results.length === 0) {
                console.log('Trying TMDb for info...');
                const tmdbResults = await tmdb.searchMovies(query);

                if (tmdbResults.length > 0) {
                    results = tmdbResults.map((movie, index) => ({
                        ...movie,
                        localId: index,
                        synopsis: movie.overview || '',
                        torrents: [],
                        source: 'tmdb'
                    }));
                }
            } else {
                // Add local index to results
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
        text += '⚠️ _این فیلم در YTS موجود نیست._\n';
        text += '_میتونید اسم فیلم رو مستقیم سرچ کنید تا نتایج بهتر ببینید._\n';
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

    // Add subtitle button
    keyboard.push([{ text: '📝 زیرنویس فارسی', callback_data: `sub:${movieIndex}` }]);
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
    let movie = results[index];

    if (!movie) {
        await bot.answerCallbackQuery(query.id, {
            text: 'فیلم پیدا نشد. دوباره جستجو کنید.',
            show_alert: true
        });
        return;
    }

    console.log(`User ${userId} selected movie: ${movie.title}`);

    // If movie has no real torrents (from TMDb/Trending), try to fetch from YTS or 1337x
    if (!movie.torrents || movie.torrents.length === 0 || movie.torrents[0]?.isSearchLink) {
        await bot.answerCallbackQuery(query.id, { text: '⏳ در حال یافتن لینک دانلود...' });

        try {
            console.log(`Fetching torrents for: ${movie.title}`);

            // Try YTS first
            const ytsMovies = await yts.searchMovies(movie.title, 3);
            let matchedMovie = null;

            for (const ytsMovie of ytsMovies) {
                if (ytsMovie.year === movie.year ||
                    ytsMovie.title.toLowerCase() === movie.title.toLowerCase()) {
                    matchedMovie = ytsMovie;
                    break;
                }
            }
            if (!matchedMovie && ytsMovies.length > 0) {
                matchedMovie = ytsMovies[0];
            }

            if (matchedMovie && matchedMovie.torrents && matchedMovie.torrents.length > 0) {
                movie = { ...movie, torrents: matchedMovie.torrents, source: 'yts' };
                results[index] = movie;
                searchResults.set(`${userId}:results`, results);
                console.log(`YTS: Found ${movie.torrents.length} torrents`);
            } else {
                // YTS failed, try 1337x
                console.log('YTS empty, trying 1337x...');
                const x1337Results = await scraper1337x.searchWithMagnets(movie.title, 5);

                if (x1337Results && x1337Results.length > 0) {
                    const grouped = scraper1337x.groupByMovie(x1337Results);
                    if (grouped.length > 0 && grouped[0].torrents.length > 0) {
                        movie = { ...movie, torrents: grouped[0].torrents, source: '1337x' };
                        results[index] = movie;
                        searchResults.set(`${userId}:results`, results);
                        console.log(`1337x: Found ${movie.torrents.length} torrents`);
                    }
                }

                // If still no torrents, try TPB
                if (!movie.torrents || movie.torrents.length === 0) {
                    console.log('1337x empty, trying TPB...');
                    const tpbResults = await scraperTPB.searchWithMagnets(movie.title, 3);
                    if (tpbResults && tpbResults.length > 0 && tpbResults[0].torrents.length > 0) {
                        movie = { ...movie, torrents: tpbResults[0].torrents, source: 'TPB' };
                        results[index] = movie;
                        searchResults.set(`${userId}:results`, results);
                        console.log(`TPB: Found ${movie.torrents.length} torrents`);
                    }
                }
            }
        } catch (error) {
            console.error('Failed to fetch torrents:', error.message);
        }
    } else {
        await bot.answerCallbackQuery(query.id);
    }

    try {
        await bot.deleteMessage(chatId, query.message.message_id);
    } catch (e) { }

    await sendMovieWithDownloads(bot, chatId, movie, lang, index);
}

/**
 * Handle torrent download - use Seedr for direct file download or fallback to magnet
 */
export async function handleTorrentSelect(bot, query, movieIndex, torrentIndex) {
    const chatId = query.message.chat.id;
    const userId = query.from.id;

    try {
        const results = searchResults.get(`${userId}:results`);
        console.log(`Torrent select: user=${userId}, movieIndex=${movieIndex}, torrentIndex=${torrentIndex}`);

        if (!results) {
            await bot.answerCallbackQuery(query.id, { text: 'نتایج منقضی شده. دوباره جستجو کنید.', show_alert: true });
            return;
        }

        const movie = results[parseInt(movieIndex)];
        if (!movie) {
            await bot.answerCallbackQuery(query.id, { text: 'فیلم پیدا نشد. دوباره جستجو کنید.', show_alert: true });
            return;
        }

        if (!movie.torrents || movie.torrents.length === 0) {
            await bot.answerCallbackQuery(query.id, { text: 'لینک تورنت موجود نیست', show_alert: true });
            return;
        }

        const torrent = movie.torrents[parseInt(torrentIndex)];
        if (!torrent || !torrent.magnetLink) {
            await bot.answerCallbackQuery(query.id, { text: 'لینک موجود نیست', show_alert: true });
            return;
        }

        await bot.answerCallbackQuery(query.id);

        // If Seedr is enabled, use direct download
        if (SEEDR_ENABLED) {
            await handleSeedrDownload(bot, chatId, movie, torrent);
        } else {
            // Fallback to magnet link
            await sendMagnetLink(bot, chatId, movie, torrent);
        }
    } catch (error) {
        console.error('Torrent select error:', error);
        await bot.sendMessage(chatId, `❌ خطا: ${error.message}`);
    }
}

/**
 * Handle download via Seedr - sends actual video file
 */
async function handleSeedrDownload(bot, chatId, movie, torrent) {
    // Send progress message
    const progressMsg = await bot.sendMessage(chatId,
        `🎬 *${escapeMarkdown(movie.title)}*\n` +
        `📦 کیفیت: ${torrent.quality} | حجم: ${torrent.size}\n\n` +
        `⏳ *در حال آماده‌سازی دانلود...*\n` +
        `_لطفاً صبر کنید، این ممکنه چند دقیقه طول بکشه_`,
        { parse_mode: 'Markdown' }
    );

    try {
        console.log(`Starting Seedr download for: ${movie.title} - ${torrent.quality}`);

        // Progress update callback
        let lastProgress = -1;
        const updateProgress = async (progress, name) => {
            if (progress !== lastProgress && progress % 20 === 0) {
                lastProgress = progress;
                try {
                    await bot.editMessageText(
                        `🎬 *${escapeMarkdown(movie.title)}*\n` +
                        `📦 کیفیت: ${torrent.quality}\n\n` +
                        `📥 *در حال دانلود:* ${progress}%\n` +
                        `${'█'.repeat(Math.floor(progress / 10))}${'░'.repeat(10 - Math.floor(progress / 10))}`,
                        {
                            chat_id: chatId,
                            message_id: progressMsg.message_id,
                            parse_mode: 'Markdown'
                        }
                    );
                } catch (e) { }
            }
        };

        // Download via Seedr
        const result = await seedr.downloadTorrent(torrent.magnetLink, updateProgress);

        // Update message
        await bot.editMessageText(
            `🎬 *${escapeMarkdown(movie.title)}*\n` +
            `📦 ${torrent.quality}\n\n` +
            `📤 *در حال ارسال فایل...*`,
            {
                chat_id: chatId,
                message_id: progressMsg.message_id,
                parse_mode: 'Markdown'
            }
        );

        // Check file size (Telegram limit is 2GB for bots)
        const fileSizeGB = result.file.size / (1024 * 1024 * 1024);
        if (fileSizeGB > 2) {
            // File too large, send download link instead
            await bot.editMessageText(
                `🎬 *${escapeMarkdown(movie.title)}*\n` +
                `📦 ${torrent.quality} | ${result.file.name}\n\n` +
                `⚠️ *فایل بزرگتر از ۲ گیگ است*\n\n` +
                `🔗 *لینک دانلود مستقیم:*\n${result.url}\n\n` +
                `⏰ _این لینک تا ۱۰ دقیقه معتبر است_`,
                {
                    chat_id: chatId,
                    message_id: progressMsg.message_id,
                    parse_mode: 'Markdown'
                }
            );
        } else {
            // Send video file directly
            await bot.sendVideo(chatId, result.url, {
                caption: `🎬 ${movie.title} (${movie.year})\n📦 ${torrent.quality} | ${torrent.size}`,
                supports_streaming: true
            });

            // Delete progress message
            try {
                await bot.deleteMessage(chatId, progressMsg.message_id);
            } catch (e) { }
        }

        // Cleanup Seedr after 120 seconds
        setTimeout(async () => {
            try {
                await result.cleanup();
                console.log('✅ Seedr cleanup complete after 120s');
            } catch (e) {
                console.error('Cleanup error:', e.message);
            }
        }, 120000);

    } catch (error) {
        console.error('Seedr download error:', error);

        // Edit progress message to show error
        await bot.editMessageText(
            `❌ *خطا در دانلود*\n\n` +
            `${error.message}\n\n` +
            `🔄 _در حال ارسال لینک مگنت به عنوان جایگزین..._`,
            {
                chat_id: chatId,
                message_id: progressMsg.message_id,
                parse_mode: 'Markdown'
            }
        );

        // Fallback to magnet
        await sendMagnetLink(bot, chatId, movie, torrent);
    }
}

/**
 * Send magnet link (fallback when Seedr fails or is not configured)
 */
async function sendMagnetLink(bot, chatId, movie, torrent) {
    const magnetText =
        `🎬 *${escapeMarkdown(movie.title)}*\n` +
        `📦 کیفیت: ${torrent.quality} | حجم: ${torrent.size}\n\n` +
        `🧲 *لینک مگنت:*\n` +
        `_(روی لینک زیر بزنید تا کپی شود)_\n\n` +
        `\`${torrent.magnetLink}\`\n\n` +
        `📱 *راهنما:*\n` +
        `1️⃣ روی لینک بالا بزنید تا کپی بشه\n` +
        `2️⃣ در برنامه تورنت پیست کنید\n` +
        `3️⃣ دانلود شروع میشه! 🎉`;

    await bot.sendMessage(chatId, magnetText, { parse_mode: 'Markdown' });
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

/**
 * Handle subtitle request
 */
export async function handleSubtitleRequest(bot, query, movieIndex) {
    const chatId = query.message.chat.id;
    const userId = query.from.id;

    await bot.answerCallbackQuery(query.id, { text: '🔍 در حال جستجوی زیرنویس...' });

    const results = searchResults.get(`${userId}:results`);
    if (!results || !results[parseInt(movieIndex)]) {
        await bot.sendMessage(chatId, '❌ نتایج منقضی شده. دوباره سرچ کنید.');
        return;
    }

    const movie = results[parseInt(movieIndex)];

    try {
        const subs = await subtitleAPI.searchSubtitles(movie.title, movie.year);

        if (subs && subs.length > 0) {
            let text = `📝 *زیرنویس فارسی برای ${escapeMarkdown(movie.title)}*\n\n`;

            subs.slice(0, 5).forEach((sub, i) => {
                const name = sub.name.length > 45 ? sub.name.substring(0, 45) + '...' : sub.name;
                text += `${i + 1}. [${escapeMarkdown(name)}](${sub.url})\n`;
            });

            text += '\n_روی لینک کلیک کنید تا دانلود شود_';

            await bot.sendMessage(chatId, text, {
                parse_mode: 'Markdown',
                disable_web_page_preview: true
            });
        } else {
            await bot.sendMessage(chatId,
                `📝 *زیرنویس فارسی برای ${escapeMarkdown(movie.title)}*\n\n` +
                `❌ _زیرنویس فارسی یافت نشد_\n\n` +
                `🔍 میتونید در [Subscene](https://subscene.com) جستجو کنید.`,
                { parse_mode: 'Markdown', disable_web_page_preview: true }
            );
        }
    } catch (error) {
        console.error('Subtitle error:', error);
        await bot.sendMessage(chatId, '❌ خطا در جستجوی زیرنویس');
    }
}

export default {
    handleSearch,
    handleMovieSelect,
    handlePageChange,
    handleTorrentSelect,
    handleMoreSources,
    handleScraperSelect,
    sendMovieDetails,
    handleMagnetRequest,
    handleSubtitleRequest
};

