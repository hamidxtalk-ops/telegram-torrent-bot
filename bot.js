/**
 * Telegram Torrent Movie Bot
 * Main entry point
 */

import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import http from 'http';

// HTTP Server for Render.com health checks (required for free tier)
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
    if (req.url === '/health' || req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', bot: 'running' }));
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

server.listen(PORT, () => {
    console.log(`🌐 Health check server running on port ${PORT}`);
});

// Import commands
import { handleStart, handleAcceptTerms, handleLanguageSelect, handleLanguageChange } from './commands/start.js';
import {
    handleSearch,
    handleMovieSelect,
    handlePageChange,
    handleTorrentSelect,
    handleMoreSources,
    handleScraperSelect,
    handleMagnetRequest
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
                                    { text: '🔍 Search Movies', callback_data: 'prompt_search' },
                                    { text: '🔥 Trending', callback_data: 'trending' }
                                ],
                                [
                                    { text: '⭐ Favorites', callback_data: 'favorites' },
                                    { text: '🎭 Browse Genres', callback_data: 'browse' }
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
                    '🔍 *Send me a movie name to search*\n\nExample: `The Matrix` or `Avengers`',
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
