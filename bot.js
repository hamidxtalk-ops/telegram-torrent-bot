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
import scraperTPB from './services/scraperTPB.js';
import scraperTGX from './services/scraperTGX.js';
import scraperLime from './services/scraperLime.js';
import scraperTodayTV from './services/scraperTodayTV.js';
import scraperTorrentDL from './services/scraperTorrentDL.js';
import scraperGLODLS from './services/scraperGLODLS.js';
import scraperNyaa from './services/scraperNyaa.js';
import subtitleAPI from './services/subtitleAPI.js';
import scraperCoolDL from './services/scraperCoolDL.js';
import scraperUptvs from './services/scraperUptvs.js';
import scraperZardFilm from './services/scraperZardFilm.js';

// Search API - OPTIMIZED for speed (fewer sources, faster timeout)
app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) {
            return res.status(400).json({ error: 'Query parameter q is required' });
        }

        console.log(`🔍 API search: ${query}`);

        // Import Telegram scraper
        const scraperTelegram = (await import('./services/scraperTelegramChannels.js')).default;

        // Timeout wrapper for faster responses (8 seconds max per scraper)
        const withTimeout = (promise, timeoutMs = 8000) => {
            return Promise.race([
                promise,
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Timeout')), timeoutMs)
                )
            ]).catch(err => {
                console.log(`⏱ Scraper timeout/error: ${err.message}`);
                return [];
            });
        };

        // Search only FAST sources in parallel (4 sources instead of 10)
        const [
            telegramResults,
            tmdbResults,
            ytsResults,
            x1337Results
        ] = await Promise.allSettled([
            withTimeout(scraperTelegram.searchWithLinks(query, 8)),
            withTimeout(tmdb.searchMovies(query), 5000),
            withTimeout(yts.searchMovies(query, 6), 6000),
            withTimeout(scraper1337x.searchWithMagnets(query, 5), 8000)
        ]);

        let results = [];

        // 1. FIRST: Telegram channels (Filmeh, etc.) - PRIORITY
        if (telegramResults.status === 'fulfilled' && telegramResults.value?.length > 0) {
            const telegramMovies = telegramResults.value.filter(m => m.torrents && m.torrents.length > 0);
            results.push(...telegramMovies.map(m => ({
                ...m,
                sourceType: 'telegram'
            })));
            console.log(`📢 Telegram: ${telegramMovies.length} results with links`);
        }

        // 2. SECOND: YTS
        if (ytsResults.status === 'fulfilled' && ytsResults.value?.length > 0) {
            const ytsMovies = ytsResults.value.filter(m =>
                m.torrents && m.torrents.length > 0 &&
                !results.find(r => r.title?.toLowerCase() === m.title?.toLowerCase())
            ).map(m => ({
                ...m,
                source: 'YTS',
                sourceType: 'torrent'
            }));
            results.push(...ytsMovies);
            console.log(`🎬 YTS: ${ytsMovies.length} results with links`);
        }

        // 3. THIRD: 1337x
        if (x1337Results.status === 'fulfilled' && x1337Results.value?.length > 0) {
            for (const movie of x1337Results.value) {
                if (!movie.torrents || movie.torrents.length === 0) continue;

                const existing = results.find(r => r.title?.toLowerCase() === movie.title?.toLowerCase());
                if (existing && existing.torrents) {
                    existing.torrents.push(...(movie.torrents || []));
                } else if (!existing) {
                    results.push({
                        ...movie,
                        source: '1337x',
                        sourceType: 'torrent'
                    });
                }
            }
            console.log(`🧲 1337x: processed`);
        }

        // 4. LAST: TMDB for movie info (always show something)
        if (tmdbResults.status === 'fulfilled' && tmdbResults.value?.length > 0) {
            const tmdbMovies = tmdbResults.value
                .filter(movie => !results.find(r => r.title?.toLowerCase() === movie.title?.toLowerCase()))
                .slice(0, results.length > 0 ? 5 : 15) // Show more if no other results
                .map((movie, index) => ({
                    id: movie.id || index,
                    title: movie.title || movie.name,
                    year: movie.release_date?.substring(0, 4),
                    rating: movie.vote_average?.toFixed(1),
                    poster: movie.poster_path ? `https://image.tmdb.org/t/p/w342${movie.poster_path}` : null,
                    posterLarge: movie.backdrop_path ? `https://image.tmdb.org/t/p/w780${movie.backdrop_path}` : null,
                    synopsis: movie.overview || '',
                    torrents: [],
                    source: 'TMDB',
                    sourceType: 'info'
                }));
            results.push(...tmdbMovies);
            console.log(`📋 TMDB: ${tmdbMovies.length} info results`);
        }

        console.log(`✅ Total search results: ${results.length}`);
        res.json({ results: results.slice(0, 30) });
    } catch (error) {
        console.error('API search error:', error);
        res.status(500).json({ error: 'Search failed', results: [] });
    }
});

// Trending API
app.get('/api/trending', async (req, res) => {
    try {
        const period = req.query.period || 'week';
        console.log(`🔥 API trending: ${period}`);

        const trending = await tmdb.getTrending(period);
        const results = trending.map((movie, index) => ({
            id: movie.id || index,
            title: movie.title || movie.name,
            year: movie.release_date?.substring(0, 4) || movie.first_air_date?.substring(0, 4),
            rating: movie.vote_average?.toFixed(1),
            poster: movie.poster_path ? `https://image.tmdb.org/t/p/w342${movie.poster_path}` : null,
            posterLarge: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
            overview: movie.overview,
            mediaType: movie.media_type,
            torrents: []
        }));

        res.json({ results: results.slice(0, 15) });
    } catch (error) {
        console.error('API trending error:', error);
        res.status(500).json({ error: 'Failed to get trending' });
    }
});

// Genres API
app.get('/api/genres', async (req, res) => {
    const genres = [
        { id: 28, name: 'اکشن', nameEn: 'Action' },
        { id: 35, name: 'کمدی', nameEn: 'Comedy' },
        { id: 18, name: 'درام', nameEn: 'Drama' },
        { id: 27, name: 'ترسناک', nameEn: 'Horror' },
        { id: 878, name: 'علمی تخیلی', nameEn: 'Sci-Fi' },
        { id: 10749, name: 'عاشقانه', nameEn: 'Romance' },
        { id: 53, name: 'هیجان‌انگیز', nameEn: 'Thriller' },
        { id: 16, name: 'انیمیشن', nameEn: 'Animation' },
        { id: 80, name: 'جنایی', nameEn: 'Crime' },
        { id: 99, name: 'مستند', nameEn: 'Documentary' }
    ];
    res.json({ genres });
});

// Browse by Genre API
app.get('/api/genre/:id', async (req, res) => {
    try {
        const genreId = req.params.id;
        console.log(`🎭 API genre: ${genreId}`);

        const movies = await tmdb.discoverByGenre(genreId);
        const results = movies.map((movie, index) => ({
            id: movie.id || index,
            title: movie.title || movie.name,
            year: movie.release_date?.substring(0, 4),
            rating: movie.vote_average?.toFixed(1),
            poster: movie.poster_path ? `https://image.tmdb.org/t/p/w342${movie.poster_path}` : null,
            posterLarge: movie.backdrop_path ? `https://image.tmdb.org/t/p/w780${movie.backdrop_path}` : null,
            overview: movie.overview,
            torrents: []
        }));

        res.json({ results: results.slice(0, 20) });
    } catch (error) {
        console.error('API genre error:', error);
        res.status(500).json({ error: 'Failed to get movies by genre' });
    }
});

// TV Series API
app.get('/api/tv', async (req, res) => {
    try {
        console.log('📺 API TV series');
        const tvShows = await tmdb.getPopularTV();
        const results = tvShows.map((show, index) => ({
            id: show.id || index,
            title: show.name,
            year: show.first_air_date?.substring(0, 4),
            rating: show.vote_average?.toFixed(1),
            poster: show.poster_path ? `https://image.tmdb.org/t/p/w342${show.poster_path}` : null,
            posterLarge: show.backdrop_path ? `https://image.tmdb.org/t/p/w780${show.backdrop_path}` : null,
            overview: show.overview,
            mediaType: 'tv',
            torrents: []
        }));

        res.json({ results: results.slice(0, 20) });
    } catch (error) {
        console.error('API TV error:', error);
        res.status(500).json({ error: 'Failed to get TV series' });
    }
});

// Anime API
app.get('/api/anime', async (req, res) => {
    try {
        console.log('🎌 API Anime');
        const anime = await tmdb.discoverByGenre(16); // Animation genre
        const results = anime.map((show, index) => ({
            id: show.id || index,
            title: show.title || show.name,
            year: show.release_date?.substring(0, 4) || show.first_air_date?.substring(0, 4),
            rating: show.vote_average?.toFixed(1),
            poster: show.poster_path ? `https://image.tmdb.org/t/p/w342${show.poster_path}` : null,
            posterLarge: show.backdrop_path ? `https://image.tmdb.org/t/p/w780${show.backdrop_path}` : null,
            overview: show.overview,
            mediaType: 'anime',
            torrents: []
        }));

        res.json({ results: results.slice(0, 20) });
    } catch (error) {
        console.error('API anime error:', error);
        res.status(500).json({ error: 'Failed to get anime' });
    }
});

// Movie details with ALL download links - Telegram channels FIRST
app.get('/api/movie/:id', async (req, res) => {
    try {
        const movieId = req.params.id;
        console.log(`🎬 API movie details: ${movieId}`);

        // Get details from TMDB
        const details = await tmdb.getMovieDetails(movieId);

        if (!details) {
            return res.status(404).json({ error: 'Movie not found' });
        }

        const movieTitle = details.title;
        let allTorrents = [];

        // Import Telegram scraper
        const scraperTelegram = (await import('./services/scraperTelegramChannels.js')).default;

        // Search ALL sources in parallel - Telegram channels FIRST
        const [telegramRes, ytsRes, x1337Res, tpbRes, tgxRes, limeRes, iranianRes] = await Promise.allSettled([
            scraperTelegram.searchWithLinks(movieTitle, 5),
            yts.searchMovies(movieTitle, 3),
            scraper1337x.searchWithMagnets(movieTitle, 5),
            scraperTPB.searchWithMagnets(movieTitle, 3),
            scraperTGX.searchWithMagnets(movieTitle, 3),
            scraperLime.searchWithMagnets(movieTitle, 3),
            scraperIranian.searchWithLinks(movieTitle, 5)
        ]);

        // 1. FIRST: Telegram channels (PRIORITY)
        if (telegramRes.status === 'fulfilled' && telegramRes.value?.length > 0) {
            for (const movie of telegramRes.value) {
                if (movie.torrents) {
                    allTorrents.push(...movie.torrents.map(t => ({
                        ...t,
                        type: 'telegram'
                    })));
                }
            }
            console.log(`📢 Telegram: ${telegramRes.value.length} results`);
        }

        // Add direct links to Filmeh bots (always available)
        const imdbId = details.imdb_id;
        if (imdbId) {
            const botLinks = scraperTelegram.getTelegramBotLinks(imdbId);
            allTorrents.push(...botLinks.map(link => ({
                quality: 'دانلود از بات',
                magnetLink: link.url,
                source: link.source,
                isTelegramBot: true,
                type: 'telegram'
            })));
        }

        // 2. YTS torrents
        if (ytsRes.status === 'fulfilled' && ytsRes.value?.[0]?.torrents) {
            allTorrents.push(...ytsRes.value[0].torrents.map(t => ({
                ...t,
                source: 'YTS',
                type: 'torrent'
            })));
        }

        // 3. 1337x torrents
        if (x1337Res.status === 'fulfilled' && x1337Res.value?.length > 0) {
            const grouped = scraper1337x.groupByMovie(x1337Res.value);
            if (grouped[0]?.torrents) {
                allTorrents.push(...grouped[0].torrents.map(t => ({
                    ...t,
                    source: '1337x',
                    type: 'torrent'
                })));
            }
        }

        // 4. TPB torrents
        if (tpbRes.status === 'fulfilled' && tpbRes.value?.[0]?.torrents) {
            allTorrents.push(...tpbRes.value[0].torrents.slice(0, 3).map(t => ({
                ...t,
                source: 'TPB',
                type: 'torrent'
            })));
        }

        // 5. TorrentGalaxy torrents
        if (tgxRes.status === 'fulfilled' && tgxRes.value?.[0]?.torrents) {
            allTorrents.push(...tgxRes.value[0].torrents.slice(0, 3).map(t => ({
                ...t,
                source: 'TorrentGalaxy',
                type: 'torrent'
            })));
        }

        // 6. LimeTorrents
        if (limeRes.status === 'fulfilled' && limeRes.value?.[0]?.torrents) {
            allTorrents.push(...limeRes.value[0].torrents.slice(0, 3).map(t => ({
                ...t,
                source: 'LimeTorrents',
                type: 'torrent'
            })));
        }

        // 7. Iranian/Persian sources
        if (iranianRes.status === 'fulfilled' && iranianRes.value?.length > 0) {
            for (const movie of iranianRes.value) {
                if (movie.torrents) {
                    allTorrents.push(...movie.torrents.map(t => ({
                        ...t,
                        type: t.isTelegramBot ? 'telegram' : 'direct'
                    })));
                }
            }
        }

        console.log(`📥 Found ${allTorrents.length} total download links`);

        res.json({
            ...details,
            title: details.title,
            year: details.release_date?.substring(0, 4),
            rating: details.vote_average?.toFixed(1),
            runtime: details.runtime,
            genres: details.genres,
            poster: details.poster_path ? `https://image.tmdb.org/t/p/w342${details.poster_path}` : null,
            posterLarge: details.backdrop_path ? `https://image.tmdb.org/t/p/w780${details.backdrop_path}` : null,
            synopsis: details.overview,
            torrents: allTorrents
        });
    } catch (error) {
        console.error('API movie details error:', error);
        res.status(500).json({ error: 'Failed to get movie details' });
    }
});

// ==================== NEW MINI APP ENDPOINTS ====================

// Subtitle Search API - Persian subtitles
app.get('/api/subtitles', async (req, res) => {
    try {
        const title = req.query.title;
        const year = req.query.year;

        if (!title) {
            return res.status(400).json({ error: 'Title is required' });
        }

        console.log(`📝 API subtitle search: ${title} (${year})`);

        const subtitles = await subtitleAPI.searchSubtitles(title, year);

        res.json({
            subtitles,
            searchUrl: `https://subscene.com/subtitles/searchbytitle?query=${encodeURIComponent(title)}`
        });
    } catch (error) {
        console.error('Subtitle API error:', error);
        res.status(500).json({ error: 'Failed to search subtitles' });
    }
});

// Persian-Only Search API - Direct download links only
app.get('/api/search/persian', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) {
            return res.status(400).json({ error: 'Query parameter q is required' });
        }

        console.log(`🇮🇷 API Persian search: ${query}`);

        // Search all Persian sources in parallel
        const [coolDL, uptvs, zardFilm, film2movie] = await Promise.allSettled([
            scraperCoolDL.searchWithLinks(query, 5),
            scraperUptvs.searchWithLinks(query, 5),
            scraperZardFilm.searchWithLinks(query, 5),
            scraperIranian.searchWithLinks(query, 5)
        ]);

        let results = [];

        // Collect all Persian results
        if (coolDL.status === 'fulfilled' && coolDL.value?.length > 0) {
            results.push(...coolDL.value);
        }
        if (uptvs.status === 'fulfilled' && uptvs.value?.length > 0) {
            results.push(...uptvs.value);
        }
        if (zardFilm.status === 'fulfilled' && zardFilm.value?.length > 0) {
            results.push(...zardFilm.value);
        }
        if (film2movie.status === 'fulfilled' && film2movie.value?.length > 0) {
            results.push(...film2movie.value);
        }

        console.log(`✅ Persian sources: Found ${results.length} results`);
        res.json({ results: results.slice(0, 20) });
    } catch (error) {
        console.error('Persian search error:', error);
        res.status(500).json({ error: 'Persian search failed' });
    }
});

// Download Guide API - Returns instructions in Persian
app.get('/api/download-guide', (req, res) => {
    res.json({
        guides: {
            direct: {
                title: '🔗 لینک مستقیم',
                sources: ['CoolDL', 'UpTVs', 'ZardFilm', 'Film2Movie'],
                steps: [
                    'روی دکمه دانلود کلیک کنید',
                    'دانلود مستقیم شروع می‌شود',
                    'نیازی به برنامه خاصی نیست'
                ]
            },
            telegram: {
                title: '📱 بات تلگرام',
                sources: ['Filmeh', 'CastroFilm'],
                steps: [
                    'روی لینک کلیک کنید',
                    'به بات تلگرام منتقل می‌شوید',
                    'دکمه Start را بزنید',
                    'فایل را دریافت کنید'
                ]
            },
            torrent: {
                title: '🧲 لینک مگنت',
                sources: ['YTS', '1337x', 'TPB', 'TorrentGalaxy'],
                steps: [
                    'یک برنامه تورنت نصب کنید (مثل uTorrent یا qBittorrent)',
                    'روی لینک مگنت کلیک کنید',
                    'در برنامه تورنت باز می‌شود',
                    'دانلود شروع می‌شود'
                ]
            }
        },
        players: {
            mobile: ['MX Player', 'VLC for Mobile'],
            desktop: ['VLC', 'PotPlayer', 'KMPlayer']
        }
    });
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

    // Mini App URL
    const WEBAPP_URL = process.env.RENDER_EXTERNAL_URL
        ? `${process.env.RENDER_EXTERNAL_URL}/webapp/`
        : 'https://telegram-torrent-bot-jqsd.onrender.com/webapp/';

    // Redirect text messages to Mini App (no direct search)
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

        // Redirect to Mini App instead of search
        await bot.sendMessage(msg.chat.id,
            `🎬 *برای جستجو از Mini App استفاده کنید*\n\n` +
            `روی دکمه زیر کلیک کنید و عبارت «${msg.text}» را جستجو کنید:`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[
                        {
                            text: '🎬 ورود به فیلم‌یاب',
                            web_app: { url: WEBAPP_URL }
                        }
                    ]]
                }
            }
        );
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

            // Navigation - Show Mini App button
            if (data === 'back_main') {
                try {
                    await bot.editMessageText(
                        `🎬 *به فیلم‌یاب خوش آمدید!*\n\nبرای جستجو و دانلود فیلم روی دکمه زیر کلیک کنید:`,
                        {
                            chat_id: query.message.chat.id,
                            message_id: query.message.message_id,
                            parse_mode: 'Markdown',
                            reply_markup: {
                                inline_keyboard: [
                                    [
                                        {
                                            text: '🎬 ورود به فیلم‌یاب',
                                            web_app: { url: WEBAPP_URL }
                                        }
                                    ],
                                    [
                                        { text: '🌐 زبان / Language', callback_data: 'select_language' },
                                        { text: '📞 پشتیبانی', url: 'https://t.me/Mound84' }
                                    ]
                                ]
                            }
                        }
                    );
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
