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
import scraperTGX from '../services/scraperTGX.js';
import scraperLime from '../services/scraperLime.js';
import scraperEZTV from '../services/scraperEZTV.js';
import scraperNyaa from '../services/scraperNyaa.js';
import scraperIranian from '../services/scraperIranian.js';
import scraperTodayTV from '../services/scraperTodayTV.js';
import scraperTorrentDL from '../services/scraperTorrentDL.js';
import scraperGLODLS from '../services/scraperGLODLS.js';
import scraperStreamWide from '../services/scraperStreamWide.js';
import scraperTelegramChannels from '../services/scraperTelegramChannels.js';
import scraperTorrentio from '../services/scraperTorrentio.js';
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
            // STEP 1: Search TMDB first to get accurate English title and metadata
            console.log(`🔍 Comprehensive search: "${query}"`);
            const tmdbMatches = await tmdb.searchMovies(query);
            const masterTitle = tmdbMatches.length > 0 ? (tmdbMatches[0].originalTitle || tmdbMatches[0].title) : query;
            const masterYear = tmdbMatches.length > 0 ? tmdbMatches[0].year : null;

            // STEP 2: Parallel search all sources
            console.log(`🚀 Searching all sources for balance: Query="${query}", EnglishName="${masterTitle}"`);
            const searchPromises = [
                yts.searchMovies(masterTitle, 5).catch(() => []), // English for YTS
                scraper1337x.searchWithMagnets(masterTitle, 5).catch(() => []), // English for 1337x
                scraperTorrentio.searchWithLinks(masterTitle, 10).catch(() => []), // English for Torrentio
                scraperTelegramChannels.searchWithLinks(query, 5).catch(() => []), // Original for Telegram
                scraperStreamWide.searchWithLinks(query, 5).catch(() => []), // Original for StreamWide
                scraperEZTV.searchWithLinks(masterTitle, 5).catch(() => []),
                scraperNyaa.searchWithMagnets(masterTitle, 5).catch(() => [])
            ];

            const [ytsRes, x1337Res, torrentioRes, telegramRes, streamwideRes, eztvRes, nyaaRes] = await Promise.all(searchPromises);

            // COLLECT ALL MOVIES: Gather all results from all sources
            const allMovies = new Map(); // Key: movieTitle+year, Value: movie object

            const collectMovies = (srcResults) => {
                if (!srcResults) return;
                const flat = Array.isArray(srcResults) ? srcResults : [srcResults];

                flat.forEach(item => {
                    if (!item || !item.title) return;

                    const key = `${item.title.toLowerCase()}|${item.year || ''}`;

                    if (!allMovies.has(key)) {
                        allMovies.set(key, {
                            title: item.title,
                            year: item.year,
                            poster: item.poster || item.posterLarge,
                            rating: item.rating,
                            torrents: [...(item.torrents || [])],
                            source: item.source,
                            synopsis: item.synopsis || item.overview || '',
                            id: item.id,
                            runtime: item.runtime,
                            genres: item.genres
                        });
                    } else {
                        // Merge torrents for duplicate movies
                        const existing = allMovies.get(key);
                        if (item.torrents) {
                            item.torrents.forEach(t => {
                                if (!existing.torrents.find(et => et.magnetLink === t.magnetLink)) {
                                    existing.torrents.push(t);
                                }
                            });
                        }
                        // Update poster if better quality found
                        if (item.posterLarge && !existing.poster) {
                            existing.poster = item.posterLarge;
                        }
                        // Update rating from TMDB if available
                        if (item.rating && !existing.rating) {
                            existing.rating = item.rating;
                        }
                    }
                });
            };

            // Collect all movies from all sources
            collectMovies(tmdbMatches);
            collectMovies(ytsRes);
            collectMovies(Array.isArray(x1337Res) ? scraper1337x.groupByMovie(x1337Res) : []);
            collectMovies(torrentioRes);
            collectMovies(streamwideRes);
            collectMovies(telegramRes);
            collectMovies(eztvRes);
            collectMovies(Array.isArray(nyaaRes) ? nyaaRes : []);

            // Convert to array and sort by rating/seeds
            results = Array.from(allMovies.values());

            // Deduplicate and sort torrents for each movie
            results.forEach(movie => {
                if (movie.torrents && movie.torrents.length > 0) {
                    const uniqueTorrents = [];
                    const seenTorrents = new Set();
                    movie.torrents.forEach(t => {
                        const sig = `${t.quality}-${t.size}-${(t.magnetLink || t.url || '').substring(0, 50)}`;
                        if (!seenTorrents.has(sig)) {
                            uniqueTorrents.push(t);
                            seenTorrents.add(sig);
                        }
                    });
                    movie.torrents = uniqueTorrents.sort((a, b) => {
                        // Priority: Telegram Bots first, then Seeds
                        if (a.isTelegramBot && !b.isTelegramBot) return -1;
                        if (!a.isTelegramBot && b.isTelegramBot) return 1;
                        return (b.seeds || 0) - (a.seeds || 0);
                    });
                }
            });

            // Sort movies by rating (descending)
            results.sort((a, b) => {
                const ratingA = parseFloat(a.rating) || 0;
                const ratingB = parseFloat(b.rating) || 0;
                return ratingB - ratingA;
            });
        }

        if (results && results.length > 0) {
            cache.set(cacheKey, results, TTL.SEARCH);
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

        // Display all found movies in a list
        if (results.length === 1) {
            // If only one result, show it directly with downloads
            await sendMovieWithDownloads(bot, chatId, results[0], lang, 0);
        } else {
            // If multiple results, show list for user to select
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
            const source = torrent.source ? ` (${torrent.source})` : '';
            text += `📦 *${quality}* - ${size} - 🌱${seeds}${source}\n`;
        });
    } else {
        text += '⚠️ _تورنت این فیلم پیدا نشد._\n';
        text += '_منابع چک شده: YTS, 1337x, TPB, TorrentGalaxy, LimeTorrents_\n\n';
        text += '💡 *پیشنهاد:* دکمه "جستجوی مستقیم" رو بزنید\n';
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

            // Add Copy button (Compact on same line if possible, but Telegram limits button characters)
            // Adding as a separate row for clarity and avoiding truncation
            keyboard.push([{
                text: `📋 کپی لینک ${quality}`,
                callback_data: `copy:${movieIndex}:${i}`
            }]);
        });
    } else {
        // Add direct search button when no torrents found
        const searchQuery = encodeURIComponent(movie.title + (movie.year ? ` ${movie.year}` : ''));
        keyboard.push([{ text: '🔍 جستجوی مستقیم در 1337x', url: `https://1337x.to/search/${searchQuery}/1/` }]);
        keyboard.push([{ text: '🔍 جستجوی مستقیم در TorrentGalaxy', url: `https://torrentgalaxy.to/torrents.php?search=${searchQuery}` }]);
    }

    // Add subtitle and learning buttons
    keyboard.push([
        { text: '📝 زیرنویس فارسی', callback_data: `sub:${movieIndex}` },
        { text: '🎓 شروع یادگیری', callback_data: `learn_mode:${movieIndex}` }
    ]);
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

                // If still no torrents, try TorrentGalaxy
                if (!movie.torrents || movie.torrents.length === 0) {
                    console.log('TPB empty, trying TorrentGalaxy...');
                    try {
                        const tgxResults = await scraperTGX.searchWithMagnets(movie.title, 5);
                        if (tgxResults && tgxResults.length > 0 && tgxResults[0].torrents.length > 0) {
                            movie = { ...movie, torrents: tgxResults[0].torrents, source: 'TorrentGalaxy' };
                            results[index] = movie;
                            searchResults.set(`${userId}:results`, results);
                            console.log(`TorrentGalaxy: Found ${movie.torrents.length} torrents`);
                        }
                    } catch (e) {
                        console.log('TorrentGalaxy failed:', e.message);
                    }
                }

                // If still no torrents, try LimeTorrents
                if (!movie.torrents || movie.torrents.length === 0) {
                    console.log('TorrentGalaxy empty, trying LimeTorrents...');
                    try {
                        const limeResults = await scraperLime.searchWithMagnets(movie.title, 5);
                        if (limeResults && limeResults.length > 0 && limeResults[0].torrents.length > 0) {
                            movie = { ...movie, torrents: limeResults[0].torrents, source: 'LimeTorrents' };
                            results[index] = movie;
                            searchResults.set(`${userId}:results`, results);
                            console.log(`LimeTorrents: Found ${movie.torrents.length} torrents`);
                        }
                    } catch (e) {
                        console.log('LimeTorrents failed:', e.message);
                    }
                }

                // If still no torrents, try TodayTV (for TV series)
                if (!movie.torrents || movie.torrents.length === 0) {
                    console.log('LimeTorrents empty, trying TodayTV...');
                    try {
                        const todayResults = await scraperTodayTV.searchWithLinks(movie.title, 3);
                        if (todayResults && todayResults.length > 0 && todayResults[0].torrents.length > 0) {
                            movie = { ...movie, torrents: todayResults[0].torrents, source: 'TodayTV' };
                            results[index] = movie;
                            searchResults.set(`${userId}:results`, results);
                            console.log(`TodayTV: Found ${movie.torrents.length} download links`);
                        }
                    } catch (e) {
                        console.log('TodayTV failed:', e.message);
                    }
                }

                // If still no torrents, try TorrentDownloads
                if (!movie.torrents || movie.torrents.length === 0) {
                    console.log('TodayTV empty, trying TorrentDownloads...');
                    try {
                        const tdlResults = await scraperTorrentDL.searchWithMagnets(movie.title, 5);
                        if (tdlResults && tdlResults.length > 0 && tdlResults[0].torrents.length > 0) {
                            movie = { ...movie, torrents: tdlResults[0].torrents, source: 'TorrentDownloads' };
                            results[index] = movie;
                            searchResults.set(`${userId}:results`, results);
                            console.log(`TorrentDownloads: Found ${movie.torrents.length} torrents`);
                        }
                    } catch (e) {
                        console.log('TorrentDownloads failed:', e.message);
                    }
                }

                // If still no torrents, try GLODLS
                if (!movie.torrents || movie.torrents.length === 0) {
                    console.log('TorrentDownloads empty, trying GLODLS...');
                    try {
                        const gloResults = await scraperGLODLS.searchWithMagnets(movie.title, 5);
                        if (gloResults && gloResults.length > 0 && gloResults[0].torrents.length > 0) {
                            movie = { ...movie, torrents: gloResults[0].torrents, source: 'GLODLS' };
                            results[index] = movie;
                            searchResults.set(`${userId}:results`, results);
                            console.log(`GLODLS: Found ${movie.torrents.length} torrents`);
                        }
                    } catch (e) {
                        console.log('GLODLS failed:', e.message);
                    }
                }

                // If still no torrents, try Iranian sources (Film2Movie, ZardFilm, CoolDL, UpTVs)
                if (!movie.torrents || movie.torrents.length === 0) {
                    console.log('GLODLS empty, trying Persian sources...');
                    try {
                        const iranianResults = await scraperIranian.searchWithLinks(movie.title, 3);
                        if (iranianResults && iranianResults.length > 0 && iranianResults[0].torrents.length > 0) {
                            movie = { ...movie, torrents: iranianResults[0].torrents, source: iranianResults[0].source || 'Persian' };
                            results[index] = movie;
                            searchResults.set(`${userId}:results`, results);
                            console.log(`Persian sources: Found ${iranianResults[0].torrents.length} download links`);
                        }
                    } catch (e) {
                        console.log('Persian sources failed:', e.message);
                    }
                }

                // Try StreamWide
                if (!movie.torrents || movie.torrents.length === 0) {
                    console.log('Trying StreamWide...');
                    try {
                        const swResults = await scraperStreamWide.searchWithLinks(movie.title, 3);
                        if (swResults && swResults.length > 0 && swResults[0].torrents.length > 0) {
                            movie = { ...movie, torrents: swResults[0].torrents, source: 'StreamWide' };
                            results[index] = movie;
                            searchResults.set(`${userId}:results`, results);
                            console.log(`StreamWide: Found ${swResults[0].torrents.length} links`);
                        }
                    } catch (e) {
                        console.log('StreamWide failed:', e.message);
                    }
                }

                // Try Torrentio (Stremio)
                if (!movie.torrents || movie.torrents.length === 0) {
                    console.log('Trying Torrentio...');
                    try {
                        const trResults = await scraperTorrentio.searchWithLinks(movie.title, 5);
                        if (trResults && trResults.length > 0 && trResults[0].torrents.length > 0) {
                            movie = { ...movie, torrents: trResults[0].torrents, source: 'Torrentio' };
                            results[index] = movie;
                            searchResults.set(`${userId}:results`, results);
                            console.log(`Torrentio: Found ${trResults[0].torrents.length} links`);
                        }
                    } catch (e) {
                        console.log('Torrentio failed:', e.message);
                    }
                }

                // Try Telegram Channels
                if (!movie.torrents || movie.torrents.length === 0) {
                    console.log('Trying Telegram Channels...');
                    try {
                        const tgResults = await scraperTelegramChannels.searchWithLinks(movie.title, 5);
                        if (tgResults && tgResults.length > 0 && tgResults[0].torrents.length > 0) {
                            movie = { ...movie, torrents: tgResults[0].torrents, source: 'Telegram' };
                            results[index] = movie;
                            searchResults.set(`${userId}:results`, results);
                            console.log(`Telegram Channels: Found ${tgResults[0].torrents.length} links`);
                        }
                    } catch (e) {
                        console.log('Telegram Channels failed:', e.message);
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

/**
 * Handle magnet copy request - Sends magnet link in monospaced code block
 */
export async function handleMagnetCopy(bot, query, movieIndex, torrentIndex) {
    const chatId = query.message.chat.id;
    const userId = query.from.id;

    const results = searchResults.get(`${userId}:results`);
    if (!results || !results[parseInt(movieIndex)]) {
        await bot.answerCallbackQuery(query.id, { text: 'نتایج منقضی شده', show_alert: true });
        return;
    }

    const movie = results[parseInt(movieIndex)];
    const torrent = movie.torrents[parseInt(torrentIndex)];

    if (!torrent || !torrent.magnetLink) {
        await bot.answerCallbackQuery(query.id, { text: 'لینک موجود نیست', show_alert: true });
        return;
    }

    // Send just the magnet link in code block for one-tap copy
    await bot.sendMessage(chatId, `\`${torrent.magnetLink}\``, { parse_mode: 'Markdown' });
    await bot.answerCallbackQuery(query.id, { text: 'لینک کپی ارسال شد ✅' });
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
    handleSubtitleRequest,
    handleMagnetCopy
};

