/**
 * YTS API Service with DNS and Proxy support
 */

import axios from 'axios';
import dns from 'dns';
import https from 'https';

// Use Cloudflare DNS (1.1.1.1) and Google DNS (8.8.8.8)
dns.setServers(['1.1.1.1', '8.8.8.8', '8.8.4.4']);

const YTS_API = 'https://yts.mx/api/v2';

// Custom HTTPS agent with longer timeout
const httpsAgent = new https.Agent({
    rejectUnauthorized: true,
    timeout: 30000,
    keepAlive: true
});

/**
 * Create axios client
 */
function createClient() {
    const proxyUrl = process.env.PROXY_URL;

    const config = {
        timeout: 30000,
        httpsAgent: httpsAgent,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json',
            'Accept-Language': 'en-US,en;q=0.9',
            'Connection': 'keep-alive'
        }
    };

    // Add proxy if configured
    if (proxyUrl) {
        console.log(`🔐 Using proxy: ${proxyUrl}`);

        if (proxyUrl.startsWith('socks')) {
            // For SOCKS proxy, we need socks-proxy-agent
            import('socks-proxy-agent').then(({ SocksProxyAgent }) => {
                config.httpsAgent = new SocksProxyAgent(proxyUrl);
                config.httpAgent = new SocksProxyAgent(proxyUrl);
            }).catch(() => { });
        } else {
            import('https-proxy-agent').then(({ HttpsProxyAgent }) => {
                config.httpsAgent = new HttpsProxyAgent(proxyUrl);
            }).catch(() => { });
        }
    }

    return axios.create(config);
}

/**
 * Fetch from YTS API with retries
 */
async function fetchYTS(endpoint) {
    const client = createClient();
    const maxRetries = 3;

    for (let i = 0; i < maxRetries; i++) {
        try {
            console.log(`🔍 YTS request (attempt ${i + 1})...`);
            const response = await client.get(`${YTS_API}${endpoint}`);

            if (response.data?.status === 'ok') {
                console.log('✅ YTS fetch successful!');
                return response.data;
            }
        } catch (error) {
            console.log(`❌ Attempt ${i + 1} failed: ${error.message}`);

            // Wait before retry
            if (i < maxRetries - 1) {
                await new Promise(r => setTimeout(r, 1000));
            }
        }
    }

    return null;
}

/**
 * Search movies
 */
export async function searchMovies(query, limit = 10) {
    try {
        const data = await fetchYTS(`/list_movies.json?query_term=${encodeURIComponent(query)}&limit=${limit}&sort_by=seeds`);

        if (data?.data?.movies) {
            return data.data.movies.map(formatMovie);
        }
        return [];
    } catch (error) {
        console.error('Search Error:', error.message);
        return [];
    }
}

/**
 * Get movie by IMDb ID
 */
export async function getMovieByImdb(imdbId) {
    try {
        const data = await fetchYTS(`/movie_details.json?imdb_id=${imdbId}&with_cast=true`);

        if (data?.data?.movie) {
            return formatMovie(data.data.movie);
        }
        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Get trending movies
 */
export async function getTrending(limit = 10) {
    try {
        const data = await fetchYTS(`/list_movies.json?limit=${limit}&sort_by=download_count&order_by=desc`);

        if (data?.data?.movies) {
            return data.data.movies.map(formatMovie);
        }
        return [];
    } catch (error) {
        return [];
    }
}

/**
 * Browse by genre
 */
export async function browseByGenre(genre, limit = 10) {
    try {
        const data = await fetchYTS(`/list_movies.json?genre=${genre}&limit=${limit}&sort_by=seeds`);

        if (data?.data?.movies) {
            return data.data.movies.map(formatMovie);
        }
        return [];
    } catch (error) {
        return [];
    }
}

/**
 * Format movie with magnet links
 */
function formatMovie(movie) {
    const torrents = (movie.torrents || []).map(torrent => ({
        quality: torrent.quality,
        type: torrent.type || 'bluray',
        size: torrent.size,
        sizeBytes: torrent.size_bytes,
        seeds: torrent.seeds,
        peers: torrent.peers,
        hash: torrent.hash,
        magnetLink: generateMagnetLink(torrent.hash, movie.title_long)
    }));

    // Sort by quality
    const qualityOrder = { '2160p': 4, '1080p': 3, '720p': 2, '480p': 1 };
    torrents.sort((a, b) => (qualityOrder[b.quality] || 0) - (qualityOrder[a.quality] || 0));

    return {
        id: movie.id,
        title: movie.title,
        titleLong: movie.title_long,
        year: movie.year,
        rating: movie.rating,
        runtime: movie.runtime,
        genres: movie.genres || [],
        synopsis: movie.synopsis || movie.description_full || '',
        poster: movie.medium_cover_image || movie.small_cover_image,
        posterLarge: movie.large_cover_image,
        imdbCode: movie.imdb_code,
        language: movie.language,
        torrents: torrents,
        source: 'yts'
    };
}

/**
 * Generate magnet link
 */
function generateMagnetLink(hash, title) {
    const trackers = [
        'udp://open.demonii.com:1337/announce',
        'udp://tracker.openbittorrent.com:80',
        'udp://tracker.coppersurfer.tk:6969',
        'udp://tracker.opentrackr.org:1337/announce',
        'udp://p4p.arenabg.com:1337',
        'udp://tracker.leechers-paradise.org:6969'
    ];

    const encodedTitle = encodeURIComponent(title);
    const trackersParam = trackers.map(t => `&tr=${encodeURIComponent(t)}`).join('');

    return `magnet:?xt=urn:btih:${hash}&dn=${encodedTitle}${trackersParam}`;
}

export default {
    searchMovies,
    getMovieByImdb,
    getTrending,
    browseByGenre
};
