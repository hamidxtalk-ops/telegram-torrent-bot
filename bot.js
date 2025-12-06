import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// ES Module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Express app for API and static files
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Serve static files for Mini App
app.use('/webapp', express.static(path.join(__dirname, 'webapp')));

// CORS for Mini App
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, X-Telegram-Init-Data');
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', bot: 'running' });
});

app.get('/', (req, res) => {
    res.json({ status: 'ok', bot: 'running', webapp: '/webapp/' });
});

// ==================== MINI APP API ENDPOINTS ====================

import yts from './services/ytsAPI.js';
import tmdb from './services/tmdbAPI.js';
import scraperIranian from './services/scraperIranian.js';
import scraper1337x from './services/scraper1337x.js';

// Search API
app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) {
            return res.status(400).json({ error: 'Query parameter q is required' });
        }

        console.log(`🔍 API search: ${query}`);

        // Search from multiple sources
        let results = await yts.searchMovies(query, 10);

        // If no YTS results, try TMDB
        if (!results || results.length === 0) {
            const tmdbResults = await tmdb.searchMovies(query);
            results = tmdbResults.map((movie, index) => ({
                ...movie,
                id: movie.id || index,
                synopsis: movie.overview || '',
                torrents: []
            }));
        }

        // Also try Iranian sources
        try {
            const iranianResults = await scraperIranian.searchIranian(query, 5);
            if (iranianResults.length > 0) {
                results = [...results, ...iranianResults];
            }
        } catch (e) {
            console.log('Iranian search failed:', e.message);
        }

        res.json({ results: results.slice(0, 20) });
    } catch (error) {
        console.error('API search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

// Trending API
app.get('/api/trending', async (req, res) => {
    try {
        console.log('🔥 API trending request');

        const trending = await tmdb.getTrending('week');
        const results = trending.map((movie, index) => ({
            id: movie.id || index,
            title: movie.title || movie.name,
            year: movie.release_date?.substring(0, 4) || movie.first_air_date?.substring(0, 4),
            rating: movie.vote_average?.toFixed(1),
            poster: movie.poster_path ? `https://image.tmdb.org/t/p/w342${movie.poster_path}` : null,
            posterLarge: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
            overview: movie.overview,
            torrents: []
        }));

        res.json({ results: results.slice(0, 12) });
    } catch (error) {
        console.error('API trending error:', error);
        res.status(500).json({ error: 'Failed to get trending' });
    }
});

// Movie details API
app.get('/api/movie/:id', async (req, res) => {
    try {
        const movieId = req.params.id;
        console.log(`🎬 API movie details: ${movieId}`);

        // Get details from TMDB
        const details = await tmdb.getMovieDetails(movieId);

        if (!details) {
            return res.status(404).json({ error: 'Movie not found' });
        }

        // Try to get torrents
        let torrents = [];
        try {
            const ytsResults = await yts.searchMovies(details.title, 3);
            if (ytsResults.length > 0) {
                torrents = ytsResults[0].torrents || [];
            }
        } catch (e) {
            console.log('YTS search failed:', e.message);
        }

        // If no YTS torrents, try 1337x
        if (torrents.length === 0) {
            try {
                const x1337Results = await scraper1337x.searchWithMagnets(details.title, 5);
                if (x1337Results.length > 0) {
                    const grouped = scraper1337x.groupByMovie(x1337Results);
                    if (grouped.length > 0) {
                        torrents = grouped[0].torrents || [];
                    }
                }
            } catch (e) {
                console.log('1337x search failed:', e.message);
            }
        }

        res.json({
            ...details,
            poster: details.poster_path ? `https://image.tmdb.org/t/p/w342${details.poster_path}` : null,
            posterLarge: details.backdrop_path ? `https://image.tmdb.org/t/p/w780${details.backdrop_path}` : null,
            torrents
        });
    } catch (error) {
        console.error('API movie details error:', error);
        res.status(500).json({ error: 'Failed to get movie details' });
    }
});

// Start Express server
app.listen(PORT, () => {
    console.log(`🌐 Health check server running on port ${PORT}`);
});

// Self-ping to keep Render free tier instance alive
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || process.env.RENDER_URL;
const PING_INTERVAL = 5 * 60 * 1000; // 5 minutes

function selfPing() {
    if (!RENDER_URL) {
        console.log('⚠️ No RENDER_URL found, self-ping disabled');
        return;
    }

    const pingUrl = `${RENDER_URL}/health`;

    fetch(pingUrl)
        .then(res => {
            if (res.ok) {
                console.log(`🏓 Self-ping successful: ${new Date().toISOString()}`);
            } else {
                console.log(`⚠️ Self-ping returned status: ${res.status}`);
            }
        })
        .catch(err => {
            console.log(`❌ Self-ping failed: ${err.message}`);
        });
}

// Start self-ping after 1 minute, then every 5 minutes
setTimeout(() => {
    selfPing(); // First ping after 1 minute
    setInterval(selfPing, PING_INTERVAL);
    console.log('🔄 Self-ping service started (every 5 minutes)');
}, 60 * 1000);

// Import commands
import { handleStart, handleAcceptTerms, handleLanguageSelect, handleLanguageChange } from './commands/start.js';
import {
    handleSearch,
    handleMovieSelect,
    handlePageChange,
    handleTorrentSelect,
    handleMoreSources,
    handleScraperSelect,
    handleMagnetRequest,
    handleSubtitleRequest
} from './commands/search.js';
import { handleHelp } from './commands/help.js';
import { handleFavorites, handleAddFavorite, handleClearFavorites, handleFavoritesCallback } from './commands/favorites.js';
import { handleHistory, handleHistoryCallback, handleHistorySearch } from './commands/history.js';
import {
    handleTrending,
    handleBrowse,
    handleTrendingCallback,
    handleTrendingPeriod,
    handleBrowseCallback,
    handleGenreCallback
} from './commands/browse.js';
import {
    handleTVSeries,
    handleAnime,
    handleRecommended,
    handleRecommendedGenre
} from './commands/content.js';
import { handleLegal } from './commands/legal.js';

// Import services
import db from './database/sqlite.js';
import cache from './services/cache.js';
import rateLimiter from './utils/rateLimiter.js';
import { t } from './utils/languages.js';

// Validate environment
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
    console.error('❌ BOT_TOKEN is required. Please set it in .env file.');
    process.exit(1);
}

console.log('🤖 Bot is starting...');

// Initialize database and start bot
async function main() {
    // Initialize database (async for sql.js)
    await db.init();
    console.log('✅ Database initialized');

    // Create bot instance
    const bot = new TelegramBot(BOT_TOKEN, {
        polling: true,
        filepath: false // Disable file download for security
    });

    // ==================== COMMAND HANDLERS ====================

    // /start command
    bot.onText(/\/start/, async (msg) => {
        await handleStart(bot, msg);
    });

    // /search command
    bot.onText(/\/search(.*)/, async (msg, match) => {
        const query = match[1]?.trim() || '';
        await handleSearch(bot, msg, query);
    });

    // /help command
    bot.onText(/\/help/, async (msg) => {
        await handleHelp(bot, msg);
    });

    // /favorites command
    bot.onText(/\/favorites/, async (msg) => {
        await handleFavorites(bot, msg);
    });

    // /history command
    bot.onText(/\/history/, async (msg) => {
        await handleHistory(bot, msg);
    });

    // /trending command
    bot.onText(/\/trending/, async (msg) => {
        await handleTrending(bot, msg);
    });

    // /browse command
    bot.onText(/\/browse\s*(.*)/, async (msg, match) => {
        const genre = match[1]?.trim() || null;
        await handleBrowse(bot, msg, genre);
    });

    // /legal command
    bot.onText(/\/legal/, async (msg) => {
        await handleLegal(bot, msg);
    });

    // /language command
    bot.onText(/\/language/, async (msg) => {
        const chatId = msg.chat.id;
        await bot.sendMessage(chatId, '🌐 *Select your language:*', {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🇬🇧 English', callback_data: 'lang:en' }],
                    [{ text: '🇮🇷 فارسی', callback_data: 'lang:fa' }],
                    [{ text: '🇪🇸 Español', callback_data: 'lang:es' }]
                ]
            }
        });
    });

    // ==================== TEXT MESSAGE HANDLER ====================

    // Handle plain text messages as search queries
    bot.on('message', async (msg) => {
        // Ignore commands
        if (msg.text?.startsWith('/')) return;
        // Ignore non-text messages
        if (!msg.text) return;

        const userId = msg.from.id;

        // Check if user is banned
        if (db.isBanned(userId)) {
            return;
        }

        // Check if user has accepted terms
        if (!db.hasAcceptedTerms(userId)) {
            const lang = db.getLanguage(userId);
            await bot.sendMessage(msg.chat.id, t(lang, 'termsRequired'));
            return;
        }

        // Treat as search query
        await handleSearch(bot, msg, msg.text);
    });

    // ==================== CALLBACK QUERY HANDLER ====================

    bot.on('callback_query', async (query) => {
        const data = query.data;
        const userId = query.from.id;

        try {
            // Check if user is banned
            if (db.isBanned(userId)) {
                await bot.answerCallbackQuery(query.id, {
                    text: 'You are banned from using this bot.',
                    show_alert: true
                });
                return;
            }

            // Terms acceptance
            if (data === 'accept_terms') {
                await handleAcceptTerms(bot, query);
                return;
            }

            // Language selection
            if (data === 'select_language') {
                await handleLanguageSelect(bot, query);
                return;
            }

            if (data.startsWith('lang:')) {
                const langCode = data.split(':')[1];
                await handleLanguageChange(bot, query, langCode);
                return;
            }

            // Navigation
            if (data === 'back_main') {
                const lang = db.getLanguage(userId);
                try {
                    await bot.editMessageText(t(lang, 'welcome'), {
                        chat_id: query.message.chat.id,
                        message_id: query.message.message_id,
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: '🔍 جستجوی فیلم', callback_data: 'prompt_search' },
                                    { text: '📺 سریال', callback_data: 'tv_series' }
                                ],
                                [
                                    { text: '🎌 انیمه', callback_data: 'anime' },
                                    { text: '🔥 ترندینگ', callback_data: 'trending' }
                                ],
                                [
                                    { text: '💫 پیشنهادی', callback_data: 'recommended' },
                                    { text: '⭐ علاقه‌مندی‌ها', callback_data: 'favorites' }
                                ],
                                [
                                    { text: '🎭 ژانرها', callback_data: 'browse' },
                                    { text: '📜 تاریخچه', callback_data: 'history' }
                                ]
                            ]
                        }
                    });
                } catch (e) { }
                await bot.answerCallbackQuery(query.id);
                return;
            }

            // Prompt for search
            if (data === 'prompt_search') {
                await bot.sendMessage(query.message.chat.id,
                    '🔍 *اسم فیلم یا سریال رو بفرست تا پیداش کنم*\n\nمثال: `Avengers` یا `Breaking Bad`',
                    { parse_mode: 'Markdown' }
                );
                await bot.answerCallbackQuery(query.id);
                return;
            }

            // Trending
            if (data === 'trending') {
                await handleTrendingCallback(bot, query);
                return;
            }

            if (data.startsWith('trending:')) {
                const period = data.split(':')[1];
                await handleTrendingPeriod(bot, query, period);
                return;
            }

            // TV Series
            if (data === 'tv_series') {
                await handleTVSeries(bot, query);
                return;
            }

            // Anime
            if (data === 'anime') {
                await handleAnime(bot, query);
                return;
            }

            // Recommended
            if (data === 'recommended') {
                await handleRecommended(bot, query);
                return;
            }

            if (data.startsWith('rec_genre:')) {
                const genre = data.split(':')[1];
                await handleRecommendedGenre(bot, query, genre);
                return;
            }

            // Browse genres
            if (data === 'browse') {
                await handleBrowseCallback(bot, query);
                return;
            }

            if (data.startsWith('genre:')) {
                const genre = data.split(':')[1];
                await handleGenreCallback(bot, query, genre);
                return;
            }

            // Favorites
            if (data === 'favorites') {
                await handleFavoritesCallback(bot, query);
                return;
            }

            if (data.startsWith('fav:')) {
                const movieId = data.split(':')[1];
                await handleAddFavorite(bot, query, movieId, null);
                return;
            }

            if (data === 'clear_favorites') {
                await handleClearFavorites(bot, query);
                return;
            }

            // History
            if (data === 'history') {
                await handleHistoryCallback(bot, query);
                return;
            }

            if (data.startsWith('search:')) {
                const searchQuery = data.substring(7);
                await handleHistorySearch(bot, query, searchQuery, handleSearch);
                return;
            }

            if (data === 'clear_history') {
                await bot.answerCallbackQuery(query.id, { text: 'History cleared!' });
                return;
            }

            // Movie selection (new format)
            if (data.startsWith('sel:')) {
                const index = data.split(':')[1];
                await handleMovieSelect(bot, query, index);
                return;
            }

            // Movie selection (old format)
            if (data.startsWith('select:')) {
                const movieId = data.split(':')[1];
                await handleMovieSelect(bot, query, movieId);
                return;
            }

            // Pagination
            if (data.startsWith('page:')) {
                const page = parseInt(data.split(':')[1]);
                await handlePageChange(bot, query, page);
                return;
            }

            // Get torrent (new format)
            if (data.startsWith('get:')) {
                const parts = data.split(':');
                const movieIndex = parts[1];
                const torrentIndex = parts[2];
                await handleTorrentSelect(bot, query, movieIndex, torrentIndex);
                return;
            }

            // Download torrent (old format)
            if (data.startsWith('dl:')) {
                const parts = data.split(':');
                const movieId = parts[1];
                const torrentIndex = parseInt(parts[2]);
                await handleTorrentSelect(bot, query, movieId, torrentIndex);
                return;
            }

            // Subtitle request
            if (data.startsWith('sub:')) {
                const movieIndex = data.split(':')[1];
                await handleSubtitleRequest(bot, query, movieIndex);
                return;
            }

            // More sources
            if (data.startsWith('more:')) {
                const movieId = data.split(':')[1];
                await handleMoreSources(bot, query, movieId);
                return;
            }

            // Scraper result
            if (data.startsWith('scraper:')) {
                const index = parseInt(data.split(':')[1]);
                await handleScraperSelect(bot, query, index);
                return;
            }

            // Magnet link request
            if (data.startsWith('magnet:')) {
                const parts = data.split(':');
                const movieId = parts[1];
                const torrentIndex = parseInt(parts[2]);
                await handleMagnetRequest(bot, query, movieId, torrentIndex);
                return;
            }

            // Unknown callback
            await bot.answerCallbackQuery(query.id);

        } catch (error) {
            console.error('Callback error:', error);
            await bot.answerCallbackQuery(query.id, {
                text: 'An error occurred. Please try again.',
                show_alert: true
            });
        }
    });

    // ==================== ERROR HANDLING ====================

    bot.on('polling_error', (error) => {
        console.error('Polling error:', error.message);
    });

    bot.on('error', (error) => {
        console.error('Bot error:', error.message);
    });

    // ==================== GRACEFUL SHUTDOWN ====================

    process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down...');
        bot.stopPolling();
        db.close();
        cache.destroy();
        rateLimiter.destroy();
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        console.log('\n🛑 Shutting down...');
        bot.stopPolling();
        db.close();
        cache.destroy();
        rateLimiter.destroy();
        process.exit(0);
    });

    console.log('✅ Bot is running! Press Ctrl+C to stop.');
}

// Start the bot
main().catch(error => {
    console.error('Failed to start bot:', error);
    process.exit(1);
});
