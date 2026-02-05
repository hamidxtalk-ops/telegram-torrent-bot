/**
 * Rate Limiter Utility
 * Token bucket algorithm for rate limiting
 */

class RateLimiter {
    constructor() {
        // Per-user limits
        this.userBuckets = new Map();

        // Configuration
        this.maxSearchesPerMinute = parseInt(process.env.MAX_SEARCHES_PER_MINUTE) || 2;
        this.maxSearchesPerDay = parseInt(process.env.MAX_SEARCHES_PER_DAY) || 50;

        // Cleanup old entries every 10 minutes
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 10 * 60 * 1000);
    }

    /**
     * Check if user can perform action
     * @param {number} userId - Telegram user ID
     * @param {string} action - Action type (e.g., 'search')
     * @returns {Object} { allowed: boolean, retryAfter: number (seconds) }
     */
    checkLimit(userId, action = 'search') {
        const key = `${userId}:${action}`;
        const now = Date.now();

        let bucket = this.userBuckets.get(key);

        if (!bucket) {
            bucket = {
                tokens: this.maxSearchesPerMinute,
                lastRefill: now,
                minuteStart: now,
                minuteCount: 0
            };
            this.userBuckets.set(key, bucket);
        }

        // Refill tokens (1 token per 30 seconds for search)
        const refillRate = 30000; // 30 seconds
        const elapsed = now - bucket.lastRefill;
        const tokensToAdd = Math.floor(elapsed / refillRate);

        if (tokensToAdd > 0) {
            bucket.tokens = Math.min(this.maxSearchesPerMinute, bucket.tokens + tokensToAdd);
            bucket.lastRefill = now;
        }

        // Reset minute counter if a minute has passed
        if (now - bucket.minuteStart >= 60000) {
            bucket.minuteStart = now;
            bucket.minuteCount = 0;
        }

        // Check if limit exceeded
        if (bucket.tokens <= 0 || bucket.minuteCount >= this.maxSearchesPerMinute) {
            const retryAfter = Math.ceil((bucket.minuteStart + 60000 - now) / 1000);
            return {
                allowed: false,
                retryAfter: Math.max(1, retryAfter),
                message: `Rate limit exceeded. Please wait ${retryAfter} seconds.`
            };
        }

        // Consume token
        bucket.tokens--;
        bucket.minuteCount++;

        return { allowed: true };
    }

    /**
     * Check daily limit
     * @param {number} currentCount - Current daily search count from DB
     * @returns {Object} { allowed: boolean, remaining: number }
     */
    checkDailyLimit(currentCount) {
        const remaining = this.maxSearchesPerDay - currentCount;
        return {
            allowed: remaining > 0,
            remaining: Math.max(0, remaining),
            message: remaining <= 0
                ? 'Daily search limit reached. Try again tomorrow!'
                : null
        };
    }

    /**
     * Get user's remaining limits
     * @param {number} userId - Telegram user ID
     * @param {number} dailyCount - Current daily count from DB
     * @returns {Object} Limit information
     */
    getLimits(userId, dailyCount = 0) {
        const key = `${userId}:search`;
        const bucket = this.userBuckets.get(key);

        return {
            perMinute: {
                remaining: bucket?.tokens || this.maxSearchesPerMinute,
                max: this.maxSearchesPerMinute
            },
            perDay: {
                remaining: Math.max(0, this.maxSearchesPerDay - dailyCount),
                max: this.maxSearchesPerDay
            }
        };
    }

    /**
     * Reset user limits (admin function)
     * @param {number} userId - Telegram user ID
     */
    resetUser(userId) {
        this.userBuckets.delete(`${userId}:search`);
    }

    /**
     * Cleanup old entries
     */
    cleanup() {
        const now = Date.now();
        const maxAge = 3600000; // 1 hour

        for (const [key, bucket] of this.userBuckets) {
            if (now - bucket.lastRefill > maxAge) {
                this.userBuckets.delete(key);
            }
        }
    }

    /**
     * Destroy rate limiter
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }
}

// Export singleton
const rateLimiter = new RateLimiter();
export default rateLimiter;
export { RateLimiter };
