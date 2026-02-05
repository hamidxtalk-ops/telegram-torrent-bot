/**
 * Caching Service
 * In-memory caching with TTL support
 */

class Cache {
    constructor() {
        this.store = new Map();
        this.defaultTTL = 3600; // 1 hour in seconds

        // Start cleanup interval (every 5 minutes)
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 5 * 60 * 1000);
    }

    /**
     * Get value from cache
     * @param {string} key - Cache key
     * @returns {*} Cached value or undefined
     */
    get(key) {
        const item = this.store.get(key);

        if (!item) return undefined;

        if (Date.now() > item.expiry) {
            this.store.delete(key);
            return undefined;
        }

        return item.value;
    }

    /**
     * Set value in cache
     * @param {string} key - Cache key
     * @param {*} value - Value to cache
     * @param {number} ttl - Time to live in seconds (default: 1 hour)
     */
    set(key, value, ttl = this.defaultTTL) {
        const expiry = Date.now() + (ttl * 1000);
        this.store.set(key, { value, expiry });
    }

    /**
     * Check if key exists and is not expired
     * @param {string} key - Cache key
     * @returns {boolean}
     */
    has(key) {
        return this.get(key) !== undefined;
    }

    /**
     * Delete key from cache
     * @param {string} key - Cache key
     */
    delete(key) {
        this.store.delete(key);
    }

    /**
     * Clear all cached items
     */
    clear() {
        this.store.clear();
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache stats
     */
    stats() {
        let valid = 0;
        let expired = 0;
        const now = Date.now();

        for (const [_, item] of this.store) {
            if (now > item.expiry) {
                expired++;
            } else {
                valid++;
            }
        }

        return { valid, expired, total: this.store.size };
    }

    /**
     * Remove expired items
     */
    cleanup() {
        const now = Date.now();
        let removed = 0;

        for (const [key, item] of this.store) {
            if (now > item.expiry) {
                this.store.delete(key);
                removed++;
            }
        }

        if (removed > 0 && process.env.DEBUG === 'true') {
            console.log(`Cache cleanup: removed ${removed} expired items`);
        }
    }

    /**
     * Stop the cleanup interval
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }
}

// Create singleton instance
const cache = new Cache();

// Cache key generators for consistency
export const CacheKeys = {
    search: (query) => `search:${query.toLowerCase().trim()}`,
    movie: (id) => `movie:${id}`,
    trending: (type) => `trending:${type}`,
    genre: (genre) => `genre:${genre}`,
    user: (userId) => `user:${userId}`
};

// TTL constants (in seconds)
export const TTL = {
    SEARCH: parseInt(process.env.CACHE_TTL_SEARCH) || 3600,      // 1 hour
    METADATA: parseInt(process.env.CACHE_TTL_METADATA) || 86400, // 24 hours
    TRENDING: parseInt(process.env.CACHE_TTL_TRENDING) || 21600  // 6 hours
};

export default cache;
export { cache };
