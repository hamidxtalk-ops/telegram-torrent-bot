/**
 * Message Formatter Utility
 * Formats movie results and messages for Telegram
 */

/**
 * Format movie card message
 * @param {Object} movie - Movie data
 * @param {Object} options - Formatting options
 * @returns {Object} { text, parseMode }
 */
export function formatMovieCard(movie, options = {}) {
    const { showTorrents = true, compact = false } = options;

    let text = `🎬 *${escapeMarkdown(movie.title)}*`;

    if (movie.year) {
        text += ` (${movie.year})`;
    }

    text += '\n';

    // Rating
    if (movie.rating) {
        const stars = getStarRating(movie.rating);
        text += `⭐ ${movie.rating}/10 ${stars}\n`;
    }

    // Genres
    if (movie.genres?.length > 0) {
        const genres = movie.genres.slice(0, 3).join(', ');
        text += `🎭 ${escapeMarkdown(genres)}\n`;
    }

    // Runtime
    if (movie.runtime) {
        text += `⏱️ ${formatRuntime(movie.runtime)}\n`;
    }

    // Synopsis (truncated)
    if (movie.synopsis && !compact) {
        const synopsis = truncateText(movie.synopsis, 200);
        text += `\n📝 _${escapeMarkdown(synopsis)}_\n`;
    }

    // Torrents
    if (showTorrents && movie.torrents?.length > 0) {
        text += '\n📦 *Available Qualities:*\n';
        movie.torrents.forEach(torrent => {
            const seedStatus = getSeedStatus(torrent.seeds);
            text += `• ${torrent.quality} • ${torrent.size} • ${seedStatus} ${torrent.seeds}↑ ${torrent.peers}↓\n`;
        });
    }

    text += '\n⏱️ _Results cached • Fast download_';

    return {
        text,
        parseMode: 'Markdown'
    };
}

/**
 * Format movie list message
 * @param {Array} movies - Array of movies
 * @param {string} title - List title
 * @returns {Object} { text, parseMode }
 */
export function formatMovieList(movies, title = '🎬 Search Results') {
    if (!movies?.length) {
        return {
            text: '❌ No results found. Try a different search term.',
            parseMode: 'Markdown'
        };
    }

    let text = `*${title}*\n\n`;

    movies.slice(0, 5).forEach((movie, index) => {
        const num = index + 1;
        text += `${num}. *${escapeMarkdown(movie.title)}*`;

        if (movie.year) text += ` (${movie.year})`;
        if (movie.rating) text += ` ⭐ ${movie.rating}`;

        text += '\n';
    });

    if (movies.length > 5) {
        text += `\n_...and ${movies.length - 5} more results_`;
    }

    return {
        text,
        parseMode: 'Markdown'
    };
}

/**
 * Format torrent inline keyboard
 * @param {Array} torrents - Array of torrent objects
 * @param {string} movieId - Movie ID for callback data
 * @returns {Array} Inline keyboard rows
 */
export function formatTorrentKeyboard(torrents, movieId) {
    if (!torrents?.length) return [];

    const rows = [];

    // Add torrent quality buttons (2 per row)
    for (let i = 0; i < torrents.length; i += 2) {
        const row = [];

        for (let j = i; j < Math.min(i + 2, torrents.length); j++) {
            const t = torrents[j];
            const seedIcon = getSeedStatus(t.seeds);
            row.push({
                text: `${t.quality} • ${t.size} ${seedIcon}`,
                callback_data: `dl:${movieId}:${j}`
            });
        }

        rows.push(row);
    }

    // Add utility buttons
    rows.push([
        { text: '⭐ Add to Favorites', callback_data: `fav:${movieId}` },
        { text: '🔄 More Sources', callback_data: `more:${movieId}` }
    ]);

    return rows;
}

/**
 * Format search results keyboard
 * @param {Array} movies - Array of movies
 * @param {number} page - Current page
 * @returns {Array} Inline keyboard
 */
export function formatSearchKeyboard(movies, page = 0) {
    const rows = [];
    const pageSize = 5;
    const startIndex = page * pageSize;
    const pageMovies = movies.slice(startIndex, startIndex + pageSize);

    // Movie selection buttons
    pageMovies.forEach((movie, index) => {
        const num = startIndex + index + 1;
        const year = movie.year ? ` (${movie.year})` : '';
        const rating = movie.rating ? ` ⭐${movie.rating}` : '';
        rows.push([{
            text: `${num}. ${truncateText(movie.title, 30)}${year}${rating}`,
            callback_data: `select:${movie.id || movie.imdbCode}`
        }]);
    });

    // Pagination buttons
    const navRow = [];
    if (page > 0) {
        navRow.push({ text: '⬅️ Previous', callback_data: `page:${page - 1}` });
    }
    if (startIndex + pageSize < movies.length) {
        navRow.push({ text: 'Next ➡️', callback_data: `page:${page + 1}` });
    }
    if (navRow.length > 0) {
        rows.push(navRow);
    }

    return rows;
}

/**
 * Format favorites list
 * @param {Array} favorites - User's favorites
 * @returns {Object} { text, keyboard }
 */
export function formatFavorites(favorites) {
    if (!favorites?.length) {
        return {
            text: '📋 *Your Favorites*\n\n_No favorites yet. Use the ⭐ button to save movies!_',
            keyboard: []
        };
    }

    let text = '📋 *Your Favorites*\n\n';
    const rows = [];

    favorites.slice(0, 10).forEach((fav, index) => {
        const num = index + 1;
        text += `${num}. ${escapeMarkdown(fav.movie_title)}`;
        if (fav.movie_year) text += ` (${fav.movie_year})`;
        text += '\n';

        rows.push([{
            text: `${num}. ${truncateText(fav.movie_title, 25)}`,
            callback_data: `select:${fav.movie_id}`
        }]);
    });

    return { text, keyboard: rows, parseMode: 'Markdown' };
}

/**
 * Format search history
 * @param {Array} history - Search history entries
 * @returns {Object} { text, keyboard }
 */
export function formatHistory(history) {
    if (!history?.length) {
        return {
            text: '📜 *Search History*\n\n_No searches yet._',
            keyboard: []
        };
    }

    let text = '📜 *Search History*\n\n';
    const rows = [];

    history.slice(0, 10).forEach((entry, index) => {
        const num = index + 1;
        text += `${num}. "${escapeMarkdown(entry.query)}" (${entry.results_count} results)\n`;

        rows.push([{
            text: `🔍 ${truncateText(entry.query, 30)}`,
            callback_data: `search:${entry.query}`
        }]);
    });

    return { text, keyboard: rows, parseMode: 'Markdown' };
}

/**
 * Format file size to human readable
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size
 */
export function formatSize(bytes) {
    if (!bytes) return 'Unknown';

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Format runtime to hours and minutes
 * @param {number} minutes - Runtime in minutes
 * @returns {string} Formatted runtime
 */
export function formatRuntime(minutes) {
    if (!minutes) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

/**
 * Get seed status emoji
 * @param {number} seeds - Number of seeders
 * @returns {string} Status emoji
 */
export function getSeedStatus(seeds) {
    if (seeds >= 100) return '🟢';
    if (seeds >= 20) return '🟡';
    return '🔴';
}

/**
 * Get star rating visual
 * @param {number} rating - Rating out of 10
 * @returns {string} Star visualization
 */
export function getStarRating(rating) {
    const stars = Math.round(rating / 2);
    return '★'.repeat(stars) + '☆'.repeat(5 - stars);
}

/**
 * Escape Markdown special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
export function escapeMarkdown(text) {
    if (!text) return '';
    return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}

/**
 * Truncate text to max length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
export function truncateText(text, maxLength = 100) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}

export default {
    formatMovieCard,
    formatMovieList,
    formatTorrentKeyboard,
    formatSearchKeyboard,
    formatFavorites,
    formatHistory,
    formatSize,
    formatRuntime,
    getSeedStatus,
    getStarRating,
    escapeMarkdown,
    truncateText
};
