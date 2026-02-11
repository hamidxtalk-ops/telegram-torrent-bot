import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
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
app.use(express.json({ limit: '50mb' })); // Increased limit for Base64 images

// Serve static files for Mini App
app.use('/webapp', express.static(path.join(__dirname, 'webapp')));

// CORS for all origins (website + mini app)
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, X-Telegram-Init-Data');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', bot: 'running' });
});

app.get('/', (req, res) => {
    res.redirect('/webapp/');
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
import assistant from './services/openclawService.js';

// AI Recognition Endpoint (In-App)
app.post('/api/recognize', async (req, res) => {
    try {
        const { image, mimeType } = req.body;
        if (!image) return res.status(400).json({ error: 'Image data required' });

        console.log('👁️ Received image for recognition...');
        const buffer = Buffer.from(image, 'base64');
        const aiLearning = await import('./services/aiLearning.js');

        const result = await aiLearning.recognizeMedia(buffer, mimeType || 'image/jpeg');
        res.json(result);
    } catch (error) {
        console.error('Recognition Error:', error);
        res.status(500).json({ error: 'Failed to recognize image' });
    }
});

// Movie Learning Data
app.get('/api/movie/:id/learning', async (req, res) => {
    try {
        const movieTitle = req.query.title;
        if (!movieTitle) return res.status(400).json({ error: 'Title required' });

        const aiLearning = await import('./services/aiLearning.js');
        const data = await aiLearning.getComprehensiveLearningData(movieTitle);

        res.json(data);
    } catch (error) {
        console.error('Learning API Error:', error);
        res.status(500).json({ error: 'Failed to fetch learning data' });
    }
});

// Media Recognition API
app.post('/api/recognize', express.json({ limit: '50mb' }), async (req, res) => {
    try {
        const { image, mimeType } = req.body;
        if (!image) return res.status(400).json({ error: 'Image data missing' });

        const buffer = Buffer.from(image, 'base64');
        // Import AI service dynamically to avoid circular dependencies if any
        const ai = await import('./services/aiLearning.js');
        const result = await ai.recognizeMedia(buffer, mimeType || 'image/jpeg');

        res.json(result);
    } catch (error) {
        console.error('API Recognition Error:', error);
        res.status(500).json({ error: 'Failed to process image' });
    }
});

// Search API - LASER FOCUS: Return ONLY ONE best-matching movie
app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.q;
        const year = req.query.year;
        if (!query) {
            return res.status(400).json({ error: 'Query parameter q is required' });
        }

        console.log(`🔍 API search (Laser Focus): ${query} ${year ? `(${year})` : ''}`);

        // Import scrapers
        const scraperTelegram = (await import('./services/scraperTelegramChannels.js')).default;
        const scraperStreamWide = (await import('./services/scraperStreamWide.js')).default;
        const scraperTorrentio = (await import('./services/scraperTorrentio.js')).default;

        // Timeout wrapper
        const withTimeout = (promise, timeoutMs = 6000) => {
            return Promise.race([
                promise,
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeoutMs))
            ]).catch(err => {
                console.log(`⏱ Scraper timeout/error: ${err.message}`);
                return [];
            });
        };

        // STEP 1: Get the best movie match from TMDB
        const tmdbResults = await withTimeout(tmdb.searchMovies(query, year), 4000);

        if (!tmdbResults || tmdbResults.length === 0) {
            return res.json({ results: [] });
        }

        // Take ONLY the first (best/most popular) match
        const bestMatch = tmdbResults[0];
        const englishTitle = bestMatch.originalTitle || bestMatch.title;
        const movieYear = bestMatch.year;

        // Get IMDB ID for better Torrentio matching
        let imdbId = null;
        try {
            const details = await withTimeout(tmdb.getMovieDetails(bestMatch.id), 3000);
            imdbId = details?.imdbId;
        } catch (e) { /* ignore */ }

        console.log(`🎯 Best match: ${englishTitle} (${movieYear || 'N/A'}) - IMDB: ${imdbId || 'N/A'}`);

        // Create search query with year for better matching
        const searchWithYear = movieYear ? `${englishTitle} ${movieYear}` : englishTitle;

        // Create the single result object
        let theMovie = {
            id: bestMatch.id,
            title: bestMatch.title,
            originalTitle: englishTitle,
            year: movieYear,
            rating: bestMatch.rating?.toFixed(1),
            poster: bestMatch.poster || null,
            posterLarge: bestMatch.poster?.replace('w342', 'w500') || null,
            overview: bestMatch.overview,
            torrents: [],
            source: 'TMDb',
            imdbId
        };

        // STEP 2: Search all sources for download links IN PARALLEL
        const [telegramRes, streamWideRes, ytsRes, torrentioRes, x1337Res] = await Promise.allSettled([
            withTimeout(scraperTelegram.searchWithLinks(englishTitle, 5), 6000),
            withTimeout(scraperStreamWide.searchWithLinks(englishTitle, 5), 6000),
            withTimeout(yts.searchMovies(englishTitle, 3), 5000),
            withTimeout(scraperTorrentio.searchWithLinks(imdbId || englishTitle, 10), 8000),
            withTimeout(scraper1337x.searchWithMagnets(searchWithYear, 3), 6000)
        ]);

        // Persian Dub and Hardsub detection patterns
        const dubPatterns = ['دوبله', 'dubbed', 'farsi.dub', 'persian.dub', 'fa.dub', 'دوبله فارسی'];
        const hardsubPatterns = ['زیرنویس چسبیده', 'hardsub', 'hs', 'hardcoded', 'زیرنویس'];

        const detectDubSub = (torrent) => {
            const text = `${torrent.title || ''} ${torrent.name || ''} ${torrent.quality || ''} ${torrent.label || ''}`.toLowerCase();
            const isDubbed = dubPatterns.some(p => text.includes(p.toLowerCase()));
            const hasHardSub = hardsubPatterns.some(p => text.includes(p.toLowerCase()));
            return { isDubbed, hasHardSub };
        };

        // Helper to check title relevance
        const isRelevant = (item) => {
            if (!item || !item.title) return false;
            const itemTitle = item.title.toLowerCase().replace(/[^a-z0-9آ-ی]/g, '');
            const searchTitle = englishTitle.toLowerCase().replace(/[^a-z0-9آ-ی]/g, '');
            const queryClean = query.toLowerCase().replace(/[^a-z0-9آ-ی]/g, '');
            return itemTitle.includes(searchTitle) || searchTitle.includes(itemTitle) ||
                itemTitle.includes(queryClean) || queryClean.includes(itemTitle);
        };

        // Helper to merge torrents into theMovie
        const mergeTorrents = (sourceResults, sourceName) => {
            if (!sourceResults || sourceResults.status !== 'fulfilled' || !sourceResults.value) return;

            const items = Array.isArray(sourceResults.value) ? sourceResults.value : [sourceResults.value];
            items.forEach(item => {
                // Skip irrelevant results
                if (!isRelevant(item) && sourceName !== 'Telegram' && sourceName !== 'StreamWide') return;

                if (item.torrents && item.torrents.length > 0) {
                    item.torrents.forEach(t => {
                        // Avoid duplicates
                        const sig = `${t.quality || ''}-${t.size || ''}-${(t.magnetLink || t.url || '').substring(0, 40)}`;
                        if (!theMovie.torrents.find(et => `${et.quality || ''}-${et.size || ''}-${(et.magnetLink || et.url || '').substring(0, 40)}` === sig)) {
                            const { isDubbed, hasHardSub } = detectDubSub(t);

                            // Create label with dub/sub info
                            let label = t.label || t.quality || sourceName;
                            if (isDubbed) label = `🎙️ دوبله فارسی - ${label}`;
                            if (hasHardSub) label = `📝 زیرنویس چسبیده - ${label}`;

                            theMovie.torrents.push({
                                ...t,
                                source: t.source || sourceName,
                                isDubbed,
                                hasHardSub,
                                label
                            });
                        }
                    });
                }
            });
        };

        // Merge all sources
        mergeTorrents(telegramRes, 'Telegram');
        mergeTorrents(streamWideRes, 'StreamWide');
        mergeTorrents(ytsRes, 'YTS');
        mergeTorrents(torrentioRes, 'Torrentio');
        mergeTorrents({ status: 'fulfilled', value: scraper1337x.groupByMovie(x1337Res.value || []) }, '1337x');

        // Sort torrents: Persian dubs first, then Telegram bots, then by seeds
        theMovie.torrents.sort((a, b) => {
            if (a.isDubbed && !b.isDubbed) return -1;
            if (!a.isDubbed && b.isDubbed) return 1;
            if (a.hasHardSub && !b.hasHardSub) return -1;
            if (!a.hasHardSub && b.hasHardSub) return 1;
            if (a.isTelegramBot && !b.isTelegramBot) return -1;
            if (!a.isTelegramBot && b.isTelegramBot) return 1;
            return (b.seeds || 0) - (a.seeds || 0);
        });

        console.log(`✅ Laser Focus result: "${theMovie.title}" with ${theMovie.torrents.length} download links`);

        // Return ONLY this one movie
        res.json({ results: [theMovie] });
    } catch (error) {
        console.error('API search error:', error);
        res.status(500).json({ error: 'Search failed', results: [] });
    }
});

// Trending API - FAST (no torrent search, instant)
app.get('/api/trending', async (req, res) => {
    try {
        const period = req.query.period || 'week';
        console.log(`🔥 API trending: ${period}`);

        const trending = await tmdb.getTrending(period);

        // Return TMDB data instantly - torrents fetched when user clicks movie
        const results = trending.slice(0, 20).map((movie, index) => ({
            id: movie.id || index,
            title: movie.title || movie.name,
            year: movie.release_date?.substring(0, 4) || movie.first_air_date?.substring(0, 4),
            rating: movie.vote_average?.toFixed(1),
            poster: movie.poster_path ? `https://image.tmdb.org/t/p/w342${movie.poster_path}` : null,
            posterLarge: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
            overview: movie.overview,
            mediaType: movie.media_type,
            torrents: [] // Will be fetched on movie detail page
        }));

        res.json({ results });
    } catch (error) {
        console.error('API trending error:', error);
        res.status(500).json({ error: 'Failed to get trending' });
    }
});

// Genres API - Extended list
app.get('/api/genres', async (req, res) => {
    const genres = [
        { id: 28, name: 'اکشن', nameEn: 'Action', icon: '💥' },
        { id: 35, name: 'کمدی', nameEn: 'Comedy', icon: '😂' },
        { id: 18, name: 'درام', nameEn: 'Drama', icon: '🎭' },
        { id: 27, name: 'ترسناک', nameEn: 'Horror', icon: '👻' },
        { id: 878, name: 'علمی تخیلی', nameEn: 'Sci-Fi', icon: '🚀' },
        { id: 10749, name: 'عاشقانه', nameEn: 'Romance', icon: '💕' },
        { id: 53, name: 'هیجان‌انگیز', nameEn: 'Thriller', icon: '😱' },
        { id: 16, name: 'انیمیشن', nameEn: 'Animation', icon: '🎨' },
        { id: 80, name: 'جنایی', nameEn: 'Crime', icon: '🔪' },
        { id: 99, name: 'مستند', nameEn: 'Documentary', icon: '📹' },
        { id: 12, name: 'ماجراجویی', nameEn: 'Adventure', icon: '🏔️' },
        { id: 14, name: 'فانتزی', nameEn: 'Fantasy', icon: '🧙' },
        { id: 10751, name: 'خانوادگی', nameEn: 'Family', icon: '👨‍👩‍👧' },
        { id: 36, name: 'تاریخی', nameEn: 'History', icon: '📜' },
        { id: 10752, name: 'جنگی', nameEn: 'War', icon: '⚔️' },
        { id: 37, name: 'وسترن', nameEn: 'Western', icon: '🤠' }
    ];
    res.json({ genres });
});

// Browse by Genre API - with torrent search (improved)
app.get('/api/genre/:id', async (req, res) => {
    try {
        const genreId = req.params.id;
        console.log(`🎭 API genre: ${genreId}`);

        const movies = await tmdb.discoverByGenre(genreId);

        // Import Telegram scraper
        const scraperTelegram = (await import('./services/scraperTelegramChannels.js')).default;

        // Get torrents for first 20 movies in parallel (increased from 10)
        const moviesWithTorrents = await Promise.all(
            movies.slice(0, 20).map(async (movie, index) => {
                const title = movie.title || movie.name;
                let torrents = [];

                try {
                    // Search Telegram and YTS for torrents
                    const [telegramRes, ytsRes] = await Promise.allSettled([
                        scraperTelegram.searchWithLinks(title, 3).catch(() => []),
                        yts.searchMovies(title, 2).catch(() => [])
                    ]);

                    // Add Telegram results (priority)
                    if (telegramRes.status === 'fulfilled' && telegramRes.value?.[0]?.link) {
                        torrents.push(...telegramRes.value.map(t => ({
                            quality: t.title,
                            magnetLink: t.link,
                            source: t.source,
                            type: 'telegram'
                        })));
                    }

                    // Add YTS results
                    if (ytsRes.status === 'fulfilled' && ytsRes.value?.[0]?.torrents) {
                        torrents.push(...ytsRes.value[0].torrents.map(t => ({
                            ...t,
                            source: 'YTS',
                            type: 'torrent'
                        })));
                    }
                } catch (e) { }

                return {
                    id: movie.id || index,
                    title,
                    year: movie.release_date?.substring(0, 4),
                    rating: movie.vote_average?.toFixed(1),
                    poster: movie.poster_path ? `https://image.tmdb.org/t/p/w342${movie.poster_path}` : null,
                    posterLarge: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
                    overview: movie.overview,
                    torrents
                };
            })
        );

        res.json({ results: moviesWithTorrents });
    } catch (error) {
        console.error('API genre error:', error);
        res.status(500).json({ error: 'Failed to get movies by genre', results: [] });
    }
});

// TV Series API - FAST (no torrent search, instant)
app.get('/api/tv', async (req, res) => {
    try {
        console.log('📺 API TV series');
        const tvShows = await tmdb.getPopularTV();

        // Return TMDB data instantly - torrents fetched when user clicks
        const results = tvShows.slice(0, 20).map((show, index) => ({
            id: show.id || index,
            title: show.name || show.title,
            year: show.first_air_date?.substring(0, 4),
            rating: show.vote_average?.toFixed(1),
            poster: show.poster_path ? `https://image.tmdb.org/t/p/w342${show.poster_path}` : null,
            posterLarge: show.poster_path ? `https://image.tmdb.org/t/p/w500${show.poster_path}` : null,
            overview: show.overview,
            mediaType: 'tv',
            torrents: []
        }));

        res.json({ results });
    } catch (error) {
        console.error('API TV error:', error);
        res.status(500).json({ error: 'Failed to get TV series', results: [] });
    }
});

// Anime API - FAST (no torrent search, instant)
app.get('/api/anime', async (req, res) => {
    try {
        console.log('🎌 API Anime');

        // Get both animation movies and anime TV series
        const [animeMovies, animeTV] = await Promise.allSettled([
            tmdb.discoverByGenre(16), // Animation movies
            tmdb.getAnimeTV() // Anime TV series
        ]);

        let allAnime = [];
        if (animeMovies.status === 'fulfilled') allAnime.push(...animeMovies.value);
        if (animeTV.status === 'fulfilled') allAnime.push(...animeTV.value);

        // Return TMDB data instantly - torrents fetched when user clicks
        const results = allAnime.slice(0, 20).map((show, index) => ({
            id: show.id || index,
            title: show.title || show.name,
            year: show.release_date?.substring(0, 4) || show.first_air_date?.substring(0, 4),
            rating: show.vote_average?.toFixed(1),
            poster: show.poster_path ? `https://image.tmdb.org/t/p/w342${show.poster_path}` : null,
            posterLarge: show.poster_path ? `https://image.tmdb.org/t/p/w500${show.poster_path}` : null,
            overview: show.overview,
            mediaType: 'anime',
            torrents: []
        }));

        res.json({ results });
    } catch (error) {
        console.error('API anime error:', error);
        res.status(500).json({ error: 'Failed to get anime', results: [] });
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
        const [telegramRes, ytsRes, x1337Res, tpbRes, tgxRes, limeRes, nyaaRes, iranianRes, torrentioRes] = await Promise.allSettled([
            scraperTelegram.searchWithLinks(movieTitle, 5),
            yts.searchMovies(movieTitle, 3),
            scraper1337x.searchWithMagnets(movieTitle, 5),
            scraperTPB.searchWithMagnets(movieTitle, 3),
            scraperTGX.searchWithMagnets(movieTitle, 3),
            scraperLime.searchWithMagnets(movieTitle, 3),
            scraperNyaa.searchWithMagnets(movieTitle, 3), // Nyaa.si for anime
            scraperIranian.searchWithLinks(movieTitle, 5),
            (await import('./services/scraperTorrentio.js')).default.searchWithLinks(movieTitle, 5)
        ]);

        // 1. FIRST: Telegram channels (PRIORITY)
        if (telegramRes.status === 'fulfilled' && telegramRes.value?.length > 0) {
            for (const movie of telegramRes.value) {
                if (movie.link) {
                    allTorrents.push({
                        quality: movie.title,
                        magnetLink: movie.link,
                        source: movie.source,
                        type: 'telegram'
                    });
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

        // 8. Nyaa.si for anime
        if (nyaaRes.status === 'fulfilled' && nyaaRes.value?.[0]?.torrents) {
            allTorrents.push(...nyaaRes.value[0].torrents.slice(0, 5).map(t => ({
                ...t,
                source: 'Nyaa.si',
                type: 'torrent'
            })));
        }

        // 9. Torrentio
        if (torrentioRes.status === 'fulfilled' && torrentioRes.value?.length > 0) {
            for (const movie of torrentioRes.value) {
                if (movie.torrents) {
                    allTorrents.push(...movie.torrents.map(t => ({
                        ...t,
                        source: t.source || 'Torrentio',
                        type: 'torrent'
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

// Movie Learning Data
app.get('/api/movie/:id/learning', async (req, res) => {
    try {
        const movieTitle = req.query.title;
        if (!movieTitle) return res.status(400).json({ error: 'Title required' });

        const aiLearning = await import('./services/aiLearning.js');
        const data = await aiLearning.getComprehensiveLearningData(movieTitle);

        res.json(data);
    } catch (error) {
        console.error('Learning API Error:', error);
        res.status(500).json({ error: 'Failed to fetch learning data' });
    }
});

// ==================== LEARNING API ENDPOINTS ====================

// Personas List
const PERSONAS = [
    { id: 'Teacher', name: '👨‍🏫 Teacher', desc: 'Formal & Educational', emoji: '👨‍🏫' },
    { id: 'Jack Sparrow', name: '🏴‍☠️ Jack Sparrow', desc: 'Pirate Slang & Wit', emoji: '🏴‍☠️' },
    { id: 'Yoda', name: '👽 Yoda', desc: 'Wisdom & Odd Grammar', emoji: '👽' },
    { id: 'Batman', name: '🦇 Batman', desc: 'Dark, Gritty & Direct', emoji: '🦇' },
    { id: 'Sherlock', name: '🔍 Sherlock', desc: 'Analytical & Sophisticated', emoji: '🔍' },
    { id: 'Barbie', name: '💅 Barbie', desc: 'Cheerful & Positive', emoji: '💅' }
];

app.get('/api/personas', (req, res) => {
    const userId = req.query.userId; // In a real app, use session/auth
    let currentPersona = 'Teacher';

    if (userId) {
        currentPersona = db.getPersona(userId);
    }

    res.json({
        personas: PERSONAS,
        current: currentPersona
    });
});

app.post('/api/persona/set', (req, res) => {
    const { userId, persona } = req.body;
    if (!userId || !persona) return res.status(400).json({ error: 'Missing data' });

    db.setPersona(userId, persona);
    res.json({ success: true, persona });
});

// Vocabulary List
app.get('/api/vocabulary', (req, res) => {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    const vocab = db.getVocabulary(userId);
    res.json({ words: vocab });
});

// Roleplay Scenarios
app.get('/api/roleplay/scenarios', (req, res) => {
    const scenarios = [
        { id: 'coffee', name: '☕ Ordering Coffee', desc: 'Practice ordering in a cafe', difficulty: 'Easy' },
        { id: 'interview', name: '👔 Job Interview', desc: 'Answer professional questions', difficulty: 'Hard' },
        { id: 'direction', name: '🗺️ Asking Directions', desc: 'Navigate a new city', difficulty: 'Medium' },
        { id: 'shopping', name: '🛍️ Shopping', desc: 'Buying clothes and bargaining', difficulty: 'Medium' }
    ];
    res.json({ scenarios });
});

// Companion Status
app.get('/api/companion/status', (req, res) => {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    const data = db.getCompanionData(userId) || {
        name: 'AI Friend',
        mood: 'Neutral',
        level: 1,
        xp: 0
    };

    res.json({ companion: data });
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
    handleSubtitleRequest,
    handleMagnetCopy
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
import {
    handleLearnMode,
    handleLearnQuotes,
    handleExplainQuote
} from './commands/learn.js';
import { handleLegal } from './commands/legal.js';
import { handlePersonaCommand, handleSetPersona } from './commands/persona.js';
import { handleVocabularyList, handleSaveWord, handleAnkiExport } from './commands/vocabulary.js';
import { handleRoleplayCommand, startRoleplay, handleRoleplayResponse } from './commands/roleplay.js';
import { handleDailyContent } from './commands/broadcast.js';
import { handleSmartMedia, handleVisionCallback } from './commands/smart_media.js';
import { handleBattleCommand, checkGameAnswer } from './commands/game.js';
import { handlePlaylistCommand } from './commands/playlist.js';
import { handleCompanionCommand, handleCompanionCallback, handleCompanionMessage } from './commands/companion.js';
import { handleWallet, handleMarket, handleSell, handleBuy, handleSellResponse } from './commands/social.js';
import { processSubtitleToFlashcards } from './services/subtitleProcessor.js';
import { downloadTelegramFile, cleanupFile, fileToBase64 } from './utils/mediaUtils.js';
import ai from './services/aiLearning.js';
import fs from 'fs';

// Import services
import db from './database/sqlite.js';
import cache from './services/cache.js';
import rateLimiter from './utils/rateLimiter.js';
import { t } from './utils/languages.js';

// Check if Telegram bot should be enabled
const BOT_TOKEN = process.env.BOT_TOKEN;
const ENABLE_TELEGRAM_BOT = BOT_TOKEN && BOT_TOKEN.length > 10;

if (!ENABLE_TELEGRAM_BOT) {
    console.log('⚠️ BOT_TOKEN not set - Running in API-only mode (no Telegram bot)');
} else {
    console.log('🤖 Bot is starting...');
}

// Initialize database and start bot
async function main() {
    // Initialize database (async for sql.js)
    await db.init();
    console.log('✅ Database initialized');

    // Only create bot if token is available
    let bot = null;
    if (ENABLE_TELEGRAM_BOT) {
        bot = new TelegramBot(BOT_TOKEN, {
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
        bot.onText(/\/ai (.+)/, async (msg, match) => {
            const chatId = msg.chat.id;
            const text = match[1];
            const userId = msg.from.id;

            if (db.isBanned(userId)) return;

            const processingMsg = await bot.sendMessage(chatId, '🤖 *در حال پردازش...*', { parse_mode: 'Markdown' });

            try {
                const result = await assistant.processAssistantRequest(text, userId);

                await bot.deleteMessage(chatId, processingMsg.message_id);

                if (result.intent === 'reminder') {
                    const { task, time } = result.data;
                    db.addReminder(userId, task, time);
                    const localTime = new Date(time).toLocaleString('fa-IR');
                    await bot.sendMessage(chatId, `⏰ *یادآوری ثبت شد!*\n\n📝 کار: ${task}\n📅 زمان: ${localTime}`, { parse_mode: 'Markdown' });
                } else if (result.intent === 'search') {
                    const { query } = result.data;
                    const searchMsg = await bot.sendMessage(chatId, `🔍 *درحال جستجوی وب برای:* ${query}...`, { parse_mode: 'Markdown' });
                    const answer = await assistant.performAISearch(query);
                    await bot.deleteMessage(chatId, searchMsg.message_id);
                    await bot.sendMessage(chatId, `🌐 *نتیجه جستجو برای:* ${query}\n\n${answer}`, { parse_mode: 'Markdown' });
                } else {
                    await bot.sendMessage(chatId, result.data.response || 'متوجه نشدم، لطفاً مجدداً بپرسید.', { parse_mode: 'Markdown' });
                }
            } catch (error) {
                console.error('Assistant Command Error:', error);
                await bot.sendMessage(chatId, '❌ متاسفانه خطایی در پردازش رخ داد.');
            }
        });

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

        // /persona or /teacher command
        bot.onText(/\/(persona|teacher)/, async (msg) => {
            await handlePersonaCommand(bot, msg);
        });

        // /words or /vocabulary command
        bot.onText(/\/(words|vocab|vocabulary)/, async (msg) => {
            await handleVocabularyList(bot, msg);
        });

        // /roleplay command
        bot.onText(/\/roleplay/, async (msg) => {
            await handleRoleplayCommand(bot, msg);
        });

        // /daily_content command (Admin)
        bot.onText(/\/daily_content (.+)/, async (msg, match) => {
            await handleDailyContent(bot, msg, match);
        });

        // /battle command (Cinema Battle)
        bot.onText(/\/battle/, async (msg) => {
            await handleBattleCommand(bot, msg);
        });

        // /playlist command
        bot.onText(/\/playlist(?:\s+(.+))?/, async (msg, match) => {
            await handlePlaylistCommand(bot, msg, match);
        });

        // /companion command (AI Friend)
        bot.onText(/\/companion/, async (msg) => {
            await handleCompanionCommand(bot, msg);
        });

        // Social / Marketplace
        bot.onText(/\/wallet/, (msg) => handleWallet(bot, msg));
        bot.onText(/\/market/, (msg) => handleMarket(bot, msg));
        bot.onText(/\/sell (\d+) (.+)/, (msg, match) => handleSell(bot, msg, match));
        bot.onText(/\/buy (\d+)/, (msg, match) => handleBuy(bot, msg, match));

        // ==================== TEXT MESSAGE HANDLER ====================

        // Mini App URL
        const WEBAPP_URL = process.env.RENDER_EXTERNAL_URL
            ? `${process.env.RENDER_EXTERNAL_URL}/webapp/`
            : 'https://telegram-torrent-bot-hiy7.onrender.com/webapp/';

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

            // Check if in Roleplay Mode
            const isInRoleplay = await handleRoleplayResponse(bot, msg);
            if (isInRoleplay) return;

            // Check if Answer to Game
            const isGameAnswer = await checkGameAnswer(bot, msg);
            if (isGameAnswer) return;

            // Check if talking to Companion
            // We need to define handleCompanionMessage in a way that it returns true if handled
            // IMPORTANT: If in companion mode, we SKIP everything else.
            // But we need to make sure handleCompanionMessage checks session existence efficiently.
            try {
                const handledByCompanion = await handleCompanionMessage(bot, msg);
                if (handledByCompanion) return;
            } catch (e) {
                console.error('Companion Handler Error:', e);
            }

            // Check if selling flow
            const handledSell = await handleSellResponse(bot, msg);
            if (handledSell) return;

            // Redirect to Mini App instead of search
            // But first, check if it's a semantic search (Contextual Search)
            // If the text starts with "find movie" or is long, try AI search.
            if (msg.text.length > 20 || msg.text.includes('فیلمی که')) {
                const processingMsg = await bot.sendMessage(msg.chat.id, '🔍 *در حال جستجوی هوشمند...*', { parse_mode: 'Markdown' });
                const aiResult = await ai.searchByContext(msg.text);

                await bot.deleteMessage(msg.chat.id, processingMsg.message_id);

                if (aiResult.found && aiResult.title) {
                    let text = `🎬 *فیلم پیدا شد!*\n\n` +
                        `🎥 *${aiResult.title}* (${aiResult.year || 'Unknown'})\n` +
                        `🧠 دلیل: ${aiResult.reason}\n\n`;

                    if (aiResult.quote) text += `💬 دیالوگ: "${aiResult.quote}"\n\n`;

                    const keyboard = [
                        [{ text: '🔍 دانلود فیلم', callback_data: 'search:' + aiResult.title }],
                        [{ text: '🎓 یادگیری (MovieLingo)', callback_data: 'prompt_learn:' + aiResult.title }]
                    ];

                    await bot.sendMessage(msg.chat.id, text, {
                        parse_mode: 'Markdown',
                        reply_markup: { inline_keyboard: keyboard }
                    });
                    return;
                }
            }

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

        // ==================== MEDIA HANDLER (Movie Recognition) ====================

        const handleMediaMessage = async (msg, type) => {
            const chatId = msg.chat.id;
            const fileId = msg[type][msg[type].length - 1]?.file_id || msg[type].file_id;

            if (!fileId) return;

            // Check rate limit
            const userId = msg.from.id;
            if (db.isBanned(userId)) return;

            // Check file size (Telegram Bot API limit is 20MB for download)
            const fileSize = msg[type][msg[type].length - 1]?.file_size || msg[type].file_size;
            if (fileSize > 20 * 1024 * 1024) {
                await bot.sendMessage(chatId, '⚠️ فایل ارسالی بزرگتر از ۲۰ مگابایت است. لطفاً فایل کوچکتری ارسال کنید.');
                return;
            }

            const processingMsg = await bot.sendMessage(chatId, '🤖 *در حال تحلیل رسانه با هوش مصنوعی...*', { parse_mode: 'Markdown' });

            let localFilePath = null;
            try {
                // Get file path from Telegram
                const fileLink = await bot.getFileLink(fileId);
                console.log(`Downloading file from: ${fileLink}`);

                // Download file
                localFilePath = await downloadTelegramFile(fileLink, fileId);

                // Read file buffer
                const fileBuffer = fs.readFileSync(localFilePath);

                // Check if this is a pronunciation attempt (Reply to a learning message)
                if ((type === 'voice' || type === 'audio') && msg.reply_to_message && msg.reply_to_message.text) {
                    const targetText = msg.reply_to_message.text;
                    // Basic check: is it English?
                    if (/[a-zA-Z]/.test(targetText)) {
                        await bot.editMessageText('🎤 *در حال تحلیل تلفظ (Shadowing)...*', {
                            chat_id: chatId, message_id: processingMsg.message_id, parse_mode: 'Markdown'
                        });

                        // Use shadowing mode if the user is replying to a quote (which usually has English text)
                        // or we can make it default for all audio replies to text.
                        const feedback = await ai.analyzePronunciation(
                            fileBuffer,
                            targetText,
                            type === 'voice' ? 'audio/ogg' : 'audio/mpeg',
                            'shadowing' // Enable shadowing mode
                        );

                        await bot.deleteMessage(chatId, processingMsg.message_id);

                        if (feedback.error) {
                            await bot.sendMessage(chatId, '❌ خطا در تحلیل تلفظ.');
                        } else {
                            const scoreEmoji = feedback.score > 80 ? '🌟' : feedback.score > 50 ? '👍' : '📝';
                            await bot.sendMessage(chatId,
                                `${scoreEmoji} *امتیاز بازیگری/تلفظ: ${feedback.score}/100*\n\n` +
                                `🗣 *فیدبک:* ${feedback.feedback}\n\n` +
                                `📝 *آنچه شنیدم:* "${feedback.transcription}"`,
                                { parse_mode: 'Markdown', reply_to_message_id: msg.message_id }
                            );
                        }
                        cleanupFile(localFilePath);
                        return;
                    }
                }

                const mimeType = type === 'photo' ? 'image/jpeg' :
                    type === 'video' ? 'video/mp4' :
                        type === 'audio' ? 'audio/mpeg' :
                            'audio/ogg'; // voice

                // Send to Gemini
                const result = await ai.recognizeMedia(fileBuffer, mimeType);

                // Cleanup
                cleanupFile(localFilePath);
                await bot.deleteMessage(chatId, processingMsg.message_id);

                if (result.found && result.title) {
                    // Stage 3: TMDB Verification & Poster fetching
                    let tmdbResult = null;
                    try {
                        const searchResults = await tmdb.searchMovies(result.title, result.year);
                        if (searchResults && searchResults.length > 0) {
                            tmdbResult = searchResults[0];
                        }
                    } catch (e) { console.error('TMDB Verify Error:', e); }

                    const confidence = Math.round(result.confidence * 100);
                    let replyText = `🎬 *فیلم با دقت بالا شناسایی شد!*\n\n` +
                        `🎥 *${tmdbResult ? tmdbResult.title : result.title}* (${tmdbResult ? tmdbResult.year : (result.year || 'Unknown')})\n` +
                        `📊 دقت تشخیص: %${confidence}\n` +
                        `🧠 تحلیل: ${result.reasoning || 'Visual match'}\n\n`;

                    if (result.actors && result.actors.length > 0) {
                        replyText += `👥 بازیگران شناسایی شده: ${result.actors.join('، ')}\n\n`;
                    }

                    replyText += `می‌خواهید چکار کنید؟`;

                    const keyboard = [
                        [{ text: '🔍 جستجوی لینک دانلود', callback_data: 'search:' + (tmdbResult ? tmdbResult.originalTitle : result.title) }],
                        [{ text: '🎓 شروع یادگیری (MovieLingo)', callback_data: 'prompt_learn:' + (tmdbResult ? tmdbResult.title : result.title) }]
                    ];

                    if (tmdbResult && tmdbResult.poster) {
                        await bot.sendPhoto(chatId, tmdbResult.poster, {
                            caption: replyText,
                            parse_mode: 'Markdown',
                            reply_markup: { inline_keyboard: keyboard }
                        });
                    } else {
                        await bot.sendMessage(chatId, replyText, {
                            parse_mode: 'Markdown',
                            reply_markup: { inline_keyboard: keyboard }
                        });
                    }
                } else {
                    await bot.sendMessage(chatId, '⚠️ متاسفانه نتوانستم فیلم را تشخیص دهم.\nلطفاً تصویر یا کلیپ واضح‌تری بفرستید.');
                }

            } catch (error) {
                console.error('Media handler error:', error);
                if (localFilePath) cleanupFile(localFilePath);
                try { await bot.deleteMessage(chatId, processingMsg.message_id); } catch (e) { }
                await bot.sendMessage(chatId, '❌ خطا در پردازش فایل.');
            }
        };

        // Listen for media - Route to Smart Vision if it's a photo
        // Videos/Audio still go to media handler or pronunciation
        bot.on('photo', (msg) => handleSmartMedia(bot, msg));
        bot.on('video', (msg) => handleMediaMessage(msg, 'video'));
        bot.on('audio', (msg) => handleMediaMessage(msg, 'audio'));
        bot.on('voice', (msg) => handleMediaMessage(msg, 'voice'));

        // Document Handler (Subtitle to Flashcards)
        bot.on('document', async (msg) => {
            const chatId = msg.chat.id;
            const fileName = msg.document.file_name || 'subtitle.srt';
            const fileId = msg.document.file_id;

            if (fileName.endsWith('.srt') || fileName.endsWith('.sub')) {
                const processingMsg = await bot.sendMessage(chatId, '📂 *در حال پردازش زیرنویس...*\n\nاین عملیات ممکن است کمی طول بکشد.', { parse_mode: 'Markdown' });

                let localFilePath = null;
                try {
                    const fileLink = await bot.getFileLink(fileId);
                    localFilePath = await downloadTelegramFile(fileLink, fileId);

                    const csvContent = await processSubtitleToFlashcards(localFilePath, fileName);

                    if (csvContent) {
                        // Save temporary CSV
                        const csvPath = localFilePath + '.csv';
                        fs.writeFileSync(csvPath, csvContent);

                        await bot.sendDocument(chatId, csvPath, {
                            caption: '✅ *فایل فلش‌کارت آماده شد!*\n\nاین فایل شامل ۲۰ لغت مهم استخراج شده از زیرنویس شماست.'
                        });

                        fs.unlinkSync(csvPath);
                    } else {
                        await bot.sendMessage(chatId, '❌ خطا در پردازش فایل زیرنویس.');
                    }

                } catch (e) {
                    console.error('Subtitle handler error:', e);
                    await bot.sendMessage(chatId, '❌ خطا در دریافت یا پردازش فایل.');
                } finally {
                    if (localFilePath) cleanupFile(localFilePath);
                    try { await bot.deleteMessage(chatId, processingMsg.message_id); } catch (e) { }
                }
            }
        });

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

                // Persona selection
                if (data.startsWith('set_persona:')) {
                    const personaKey = data.substring(12);
                    await handleSetPersona(bot, query, personaKey);
                    return;
                }

                // Vocabulary
                if (data === 'export_anki') {
                    await handleAnkiExport(bot, query);
                    return;
                }

                // Note: Save word logic is tricky with limits. 
                // Let's implement a listener for "save_word"
                if (data.startsWith('save_word')) {
                    // format: save_word:ENCODED_WORD:ENCODED_MOVIE
                    // We need to parse this properly.
                    // Implementation: handleSaveWord handles logic.
                    // But callback data max length is 64 bytes!
                    // If movie title is long, it will fail.
                    // Alternative: save by index if we have state.
                    // For now, let's assume we use very short keys or rely on state.
                    await handleSaveWord(bot, query, data);
                    return;
                }

                // Smart Vision Callbacks
                if (data.startsWith('vision_')) {
                    await handleVisionCallback(bot, query);
                    return;
                }

                // Companion Callbacks
                if (data.startsWith('comp_')) {
                    await handleCompanionCallback(bot, query);
                    return;
                }

                // Roleplay start

                // Roleplay start
                if (data.startsWith('start_rp:')) {
                    const charKey = data.substring(9);
                    await startRoleplay(bot, query, charKey);
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

                if (data.startsWith('prompt_learn:')) {
                    const title = data.substring(13);
                    // Search for movie first to get index
                    await handleHistorySearch(bot, query, title, async (b, m, q) => {
                        // After search is done (and potentially results cached)
                        // We need to trigger learn mode directly. 
                        // But search works by user ID. 
                        // Simplified: redirect to search for now, user clicks learn there.
                        // Or better: Simulate search and then learn.

                        // For now, let's just trigger search, as the "Learn" button is there.
                        await handleSearch(b, m, q);
                    });
                    return;
                }
                if (data.startsWith('copy:')) {
                    const parts = data.split(':');
                    const movieIndex = parts[1];
                    const torrentIndex = parts[2];
                    await handleMagnetCopy(bot, query, movieIndex, torrentIndex);
                    return;
                }

                // Learn mode handlers
                if (data.startsWith('learn_mode:')) {
                    const movieIndex = data.split(':')[1];
                    await handleLearnMode(bot, query, movieIndex);
                    return;
                }

                if (data.startsWith('learn_quotes:')) {
                    const movieIndex = data.split(':')[1];
                    await handleLearnQuotes(bot, query, movieIndex);
                    return;
                }

                if (data.startsWith('explain_quote:')) {
                    const parts = data.split(':');
                    const movieIndex = parts[1];
                    const quoteIndex = parts[2];
                    await handleExplainQuote(bot, query, movieIndex, quoteIndex);
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

        console.log('✅ Bot is running! Press Ctrl+C to stop.');

        // ==================== REMINDER SCHEDULER ====================
        setInterval(async () => {
            try {
                const dueReminders = db.getDueReminders();
                for (const reminder of dueReminders) {
                    await bot.sendMessage(reminder.user_id, `🔔 *یادآوری:* \n\n ${reminder.task}`, { parse_mode: 'Markdown' });
                    db.completeReminder(reminder.id);
                    console.log(`Reminder sent to ${reminder.user_id}: ${reminder.task}`);
                }
            } catch (error) {
                console.error('Reminder Scheduler Error:', error);
            }
        }, 60000); // Check every minute

    } else {
        console.log('✅ API server is running (no Telegram bot)');
    }

    // ==================== GRACEFUL SHUTDOWN ====================
    process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down...');
        if (bot) bot.stopPolling();
        db.close();
        cache.destroy();
        rateLimiter.destroy();
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        console.log('\n🛑 Shutting down...');
        if (bot) bot.stopPolling();
        db.close();
        cache.destroy();
        rateLimiter.destroy();
        process.exit(0);
    });
}

// Start everything
main().catch(error => {
    console.error('Failed to start:', error);
    process.exit(1);
});
