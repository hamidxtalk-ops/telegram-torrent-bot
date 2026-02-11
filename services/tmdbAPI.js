/**
 * TMDb API Service
 * Fetches movie metadata, posters, and ratings
 * Supports both API key and Bearer token authentication
 */

import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';

// Load config
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_READ_ACCESS_TOKEN = process.env.TMDB_READ_ACCESS_TOKEN;
const PROXY_URL = process.env.PROXY_URL;

const TMDB_API_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

/**
 * Create TMDb API client with proper authentication
 */
function createClient() {
    const apiKey = process.env.TMDB_API_KEY || '';

    // Check if it's a Bearer token (JWT) or regular API key
    const isBearer = apiKey.startsWith('eyJ');

    const config = {
        baseURL: TMDB_API_BASE,
        timeout: 15000,
        headers: {}
    };

    if (isBearer) {
        config.headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const client = axios.create(config);

    // Add api_key param if not using Bearer token
    if (!isBearer && apiKey) {
        client.interceptors.request.use((config) => {
            config.params = config.params || {};
            config.params.api_key = apiKey;
            return config;
        });
    }

    return { client, hasKey: !!apiKey };
}

/**
 * Search for movies on TMDb
 */
export async function searchMovies(query, year = null) {
    const { client, hasKey } = createClient();
    if (!hasKey) {
        console.warn('TMDb API key not configured');
        return [];
    }

    try {
        const params = {
            query: query,
            include_adult: false,
            language: 'fa-IR' // Get Persian metadata if available
        };

        if (year) {
            params.primary_release_year = year;
        }

        const response = await client.get('/search/movie', { params });

        console.log('✅ TMDb search successful');

        // Format results
        const results = (response.data?.results || []).map(formatMovie);

        // Score by BOTH title similarity AND popularity
        const queryLower = query.toLowerCase().replace(/[^a-z0-9]/g, '');

        results.forEach(r => {
            const titleLower = (r.originalTitle || r.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');

            // Title similarity score (0-100)
            let titleScore = 0;
            if (titleLower === queryLower) {
                titleScore = 100; // Exact match
            } else if (titleLower.startsWith(queryLower) || queryLower.startsWith(titleLower)) {
                titleScore = 80; // Starts with query
            } else if (titleLower.includes(queryLower)) {
                titleScore = 50; // Contains query
            }

            // Combined score: title match is more important
            r.matchScore = (titleScore * 2) + Math.min(r.popularity || 0, 100);
        });

        // Sort by combined score (higher is better)
        results.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));

        return results;
    } catch (error) {
        console.error('TMDb API Error:', error.message);
        return [];
    }
}

/**
 * Get movie details by TMDb ID
 */
export async function getMovieDetails(tmdbId) {
    const { client, hasKey } = createClient();
    if (!hasKey) return null;

    try {
        const response = await client.get(`/movie/${tmdbId}`, {
            params: {
                append_to_response: 'credits,external_ids',
                language: 'fa-IR'
            }
        });

        return formatMovieDetails(response.data);
    } catch (error) {
        console.error('TMDb API Error:', error.message);
        return null;
    }
}

/**
 * Get movie by IMDb ID
 */
export async function getMovieByImdb(imdbId) {
    const { client, hasKey } = createClient();
    if (!hasKey) return null;

    try {
        const response = await client.get(`/find/${imdbId}`, {
            params: {
                external_source: 'imdb_id'
            }
        });

        const movies = response.data?.movie_results || [];
        if (movies.length === 0) return null;

        return getMovieDetails(movies[0].id);
    } catch (error) {
        console.error('TMDb API Error:', error.message);
        return null;
    }
}

/**
 * Get trending movies
 */
export async function getTrending(timeWindow = 'week') {
    const { client, hasKey } = createClient();
    if (!hasKey) return [];

    try {
        const response = await client.get(`/trending/movie/${timeWindow}`);
        console.log('✅ TMDb trending successful');
        return (response.data?.results || []).map(formatMovie);
    } catch (error) {
        console.error('TMDb API Error:', error.message);
        return [];
    }
}

/**
 * Search for TV series on TMDb
 */
export async function searchTV(query) {
    const { client, hasKey } = createClient();
    if (!hasKey) {
        console.warn('TMDb API key not configured');
        return [];
    }

    try {
        const response = await client.get('/search/tv', {
            params: {
                query: query,
                include_adult: false
            }
        });

        console.log('✅ TMDb TV search successful');
        return (response.data?.results || []).map(formatTVShow);
    } catch (error) {
        console.error('TMDb API Error:', error.message);
        return [];
    }
}

/**
 * Get trending TV series
 */
export async function getTrendingTV(timeWindow = 'week') {
    const { client, hasKey } = createClient();
    if (!hasKey) return [];

    try {
        const response = await client.get(`/trending/tv/${timeWindow}`);
        console.log('✅ TMDb trending TV successful');
        return (response.data?.results || []).map(formatTVShow);
    } catch (error) {
        console.error('TMDb API Error:', error.message);
        return [];
    }
}

/**
 * Get trending all (movies + TV)
 */
export async function getTrendingAll(timeWindow = 'week') {
    const { client, hasKey } = createClient();
    if (!hasKey) return [];

    try {
        const response = await client.get(`/trending/all/${timeWindow}`);
        console.log('✅ TMDb trending all successful');
        return (response.data?.results || []).map(item => {
            if (item.media_type === 'tv') {
                return formatTVShow(item);
            }
            return formatMovie(item);
        });
    } catch (error) {
        console.error('TMDb API Error:', error.message);
        return [];
    }
}

/**
 * Get popular animation/anime movies
 */
export async function getAnimationMovies(page = 1) {
    const { client, hasKey } = createClient();
    if (!hasKey) return [];

    try {
        const response = await client.get('/discover/movie', {
            params: {
                with_genres: 16, // Animation
                sort_by: 'popularity.desc',
                page: page
            }
        });

        console.log('✅ TMDb animation movies successful');
        return (response.data?.results || []).map(formatMovie);
    } catch (error) {
        console.error('TMDb API Error:', error.message);
        return [];
    }
}

/**
 * Get popular anime TV series
 */
export async function getAnimeTV(page = 1) {
    const { client, hasKey } = createClient();
    if (!hasKey) return [];

    try {
        const response = await client.get('/discover/tv', {
            params: {
                with_genres: 16, // Animation
                with_origin_country: 'JP', // Japan
                sort_by: 'popularity.desc',
                page: page
            }
        });

        console.log('✅ TMDb anime TV successful');
        return (response.data?.results || []).map(formatTVShow);
    } catch (error) {
        console.error('TMDb API Error:', error.message);
        return [];
    }
}

/**
 * Format TV show data
 */
function formatTVShow(show) {
    return {
        id: show.id,
        title: show.name,
        originalTitle: show.original_name,
        year: show.first_air_date ? new Date(show.first_air_date).getFullYear() : null,
        releaseDate: show.first_air_date,
        rating: show.vote_average,
        voteCount: show.vote_count,
        overview: show.overview,
        poster: getPosterUrl(show.poster_path),
        posterPath: show.poster_path,
        backdrop: getPosterUrl(show.backdrop_path, 'w1280'),
        genreIds: show.genre_ids || [],
        popularity: show.popularity,
        source: 'tmdb',
        type: 'tv'
    };
}

/**
 * Browse movies by genre
 */
export async function browseByGenre(genreId) {
    const { client, hasKey } = createClient();
    if (!hasKey) return [];

    try {
        const response = await client.get('/discover/movie', {
            params: {
                with_genres: genreId,
                sort_by: 'popularity.desc'
            }
        });

        return (response.data?.results || []).map(formatMovie);
    } catch (error) {
        console.error('TMDb API Error:', error.message);
        return [];
    }
}

/**
 * Get poster URL
 */
export function getPosterUrl(posterPath, size = 'w500') {
    if (!posterPath) return null;
    return `${TMDB_IMAGE_BASE}/${size}${posterPath}`;
}

/**
 * Format basic movie data
 */
function formatMovie(movie) {
    return {
        id: movie.id,
        title: movie.title || movie.original_title, // Use title (could be Persian)
        originalTitle: movie.original_title, // Keep English original title
        year: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
        releaseDate: movie.release_date,
        rating: movie.vote_average,
        voteCount: movie.vote_count,
        overview: movie.overview,
        poster: getPosterUrl(movie.poster_path),
        posterPath: movie.poster_path,
        backdrop: getPosterUrl(movie.backdrop_path, 'w1280'),
        genreIds: movie.genre_ids || [],
        popularity: movie.popularity,
        source: 'tmdb'
    };
}

/**
 * Format detailed movie data
 */
function formatMovieDetails(movie) {
    const director = movie.credits?.crew?.find(c => c.job === 'Director');
    const cast = (movie.credits?.cast || []).slice(0, 5).map(c => c.name);

    return {
        id: movie.id,
        title: movie.title || movie.original_title,
        originalTitle: movie.original_title,
        year: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
        releaseDate: movie.release_date,
        rating: movie.vote_average,
        voteCount: movie.vote_count,
        overview: movie.overview,
        poster: getPosterUrl(movie.poster_path),
        posterPath: movie.poster_path,
        backdrop: getPosterUrl(movie.backdrop_path, 'w1280'),
        runtime: movie.runtime,
        genres: (movie.genres || []).map(g => g.name),
        imdbId: movie.external_ids?.imdb_id || movie.imdb_id,
        director: director?.name,
        cast: cast,
        budget: movie.budget,
        revenue: movie.revenue,
        tagline: movie.tagline,
        source: 'tmdb'
    };
};

/**
 * Get popular TV series
 */
export async function getPopularTV(page = 1) {
    const { client, hasKey } = createClient();
    if (!hasKey) return [];

    try {
        const response = await client.get('/tv/popular', {
            params: { page }
        });

        console.log('✅ TMDb popular TV successful');
        return (response.data?.results || []).map(formatTVShow);
    } catch (error) {
        console.error('TMDb API Error:', error.message);
        return [];
    }
}

/**
 * Discover movies by genre (alias for browseByGenre)
 */
export async function discoverByGenre(genreId, page = 1) {
    const { client, hasKey } = createClient();
    if (!hasKey) return [];

    try {
        const response = await client.get('/discover/movie', {
            params: {
                with_genres: genreId,
                sort_by: 'popularity.desc',
                page: page
            }
        });

        console.log('✅ TMDb discover by genre successful');
        return (response.data?.results || []).map(formatMovie);
    } catch (error) {
        console.error('TMDb API Error:', error.message);
        return [];
    }
}

// Genre ID mapping for TMDb
export const GENRE_MAP = {
    action: 28,
    adventure: 12,
    animation: 16,
    comedy: 35,
    crime: 80,
    documentary: 99,
    drama: 18,
    family: 10751,
    fantasy: 14,
    history: 36,
    horror: 27,
    music: 10402,
    mystery: 9648,
    romance: 10749,
    scifi: 878,
    thriller: 53,
    war: 10752,
    western: 37
};

export default {
    searchMovies,
    getMovieDetails,
    getMovieByImdb,
    getTrending,
    getTrendingTV,
    getTrendingAll,
    searchTV,
    getAnimationMovies,
    getAnimeTV,
    browseByGenre,
    discoverByGenre,
    getPopularTV,
    getPosterUrl,
    GENRE_MAP
};
