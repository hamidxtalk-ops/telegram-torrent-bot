/**
 * Message Queue Utility
 * Handles Telegram's rate limits (30 messages/second)
 */

class MessageQueue {
    constructor() {
        this.queue = [];
        this.processing = false;
        this.messagesPerSecond = 30;
        this.messageInterval = 1000 / this.messagesPerSecond; // ~33ms
        this.lastMessageTime = 0;
    }

    /**
     * Add a message sending function to the queue
     * @param {Function} sendFn - Async function that sends a message
     * @param {number} priority - Higher priority = processed first (default: 0)
     * @returns {Promise} Resolves when message is sent
     */
    add(sendFn, priority = 0) {
        return new Promise((resolve, reject) => {
            this.queue.push({
                sendFn,
                priority,
                resolve,
                reject,
                addedAt: Date.now()
            });

            // Sort by priority (higher first)
            this.queue.sort((a, b) => b.priority - a.priority);

            // Start processing if not already
            if (!this.processing) {
                this.process();
            }
        });
    }

    /**
     * Process the queue
     */
    async process() {
        if (this.processing || this.queue.length === 0) {
            return;
        }

        this.processing = true;

        while (this.queue.length > 0) {
            const item = this.queue.shift();

            // Calculate delay to respect rate limit
            const now = Date.now();
            const timeSinceLastMessage = now - this.lastMessageTime;
            const delay = Math.max(0, this.messageInterval - timeSinceLastMessage);

            if (delay > 0) {
                await this.sleep(delay);
            }

            try {
                const result = await item.sendFn();
                item.resolve(result);
            } catch (error) {
                // Handle Telegram rate limit errors
                if (error.response?.statusCode === 429) {
                    const retryAfter = error.response.body?.parameters?.retry_after || 1;
                    console.warn(`Rate limited. Retrying after ${retryAfter}s`);

                    // Re-add to queue with higher priority
                    this.queue.unshift(item);
                    await this.sleep(retryAfter * 1000);
                } else {
                    item.reject(error);
                }
            }

            this.lastMessageTime = Date.now();
        }

        this.processing = false;
    }

    /**
     * Sleep utility
     * @param {number} ms - Milliseconds to sleep
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get queue length
     */
    get length() {
        return this.queue.length;
    }

    /**
     * Clear the queue
     */
    clear() {
        // Reject all pending
        this.queue.forEach(item => {
            item.reject(new Error('Queue cleared'));
        });
        this.queue = [];
    }
}

// Export singleton
const messageQueue = new MessageQueue();
export default messageQueue;
export { MessageQueue };
