/**
 * SQLite Database Service
 * Handles user data, favorites, and search history
 * Uses sql.js (pure JavaScript SQLite implementation)
 */

import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'bot.db');

class DatabaseService {
    constructor() {
        this.db = null;
        this.SQL = null;
    }

    /**
     * Initialize database
     */
    async init() {
        // Initialize SQL.js
        this.SQL = await initSqlJs();

        // Load existing database or create new one
        if (existsSync(DB_PATH)) {
            const fileBuffer = readFileSync(DB_PATH);
            this.db = new this.SQL.Database(fileBuffer);
        } else {
            this.db = new this.SQL.Database();
        }

        // Run schema and migrations
        this.initSchema();
        this.migrate();
        this.save();

        return this;
    }

    /**
     * Initialize database schema
     */
    initSchema() {
        const schema = `
      -- Users table
      CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          telegram_id INTEGER UNIQUE NOT NULL,
          username TEXT,
          first_name TEXT,
          last_name TEXT,
          language_code TEXT DEFAULT 'en',
          terms_accepted INTEGER DEFAULT 0,
          terms_accepted_at TEXT,
          search_count_today INTEGER DEFAULT 0,
          last_search_date TEXT,
          is_banned INTEGER DEFAULT 0,
          persona TEXT DEFAULT 'Teacher',
          coins INTEGER DEFAULT 0,
          companion_data TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Search history table
      CREATE TABLE IF NOT EXISTS search_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          query TEXT NOT NULL,
          results_count INTEGER DEFAULT 0,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Favorites table
      CREATE TABLE IF NOT EXISTS favorites (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          movie_id TEXT NOT NULL,
          movie_title TEXT NOT NULL,
          movie_year INTEGER,
          imdb_id TEXT,
          poster_url TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, movie_id)
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
      CREATE INDEX IF NOT EXISTS idx_search_history_user_id ON search_history(user_id);
      CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);

      -- Vocabulary table (Flashcards)
      CREATE TABLE IF NOT EXISTS vocabulary (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          word TEXT NOT NULL,
          definition TEXT,
          context TEXT,
          movie_source TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, word)
      );
      CREATE INDEX IF NOT EXISTS idx_vocabulary_user_id ON vocabulary(user_id);

      -- Marketplace Listings (Phase 5)
      CREATE TABLE IF NOT EXISTS marketplace_listings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          seller_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          price INTEGER DEFAULT 0,
          content TEXT,
          status TEXT DEFAULT 'active',
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Reminders table
      CREATE TABLE IF NOT EXISTS reminders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          task TEXT NOT NULL,
          remind_at TEXT NOT NULL,
          status TEXT DEFAULT 'pending',
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON reminders(user_id);
      CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status);
      CREATE INDEX IF NOT EXISTS idx_reminders_at ON reminders(remind_at);
    `;
        this.db.run(schema);
    }

    /**
     * Run migrations (Phase updates)
     */
    migrate() {
        try {
            const columns = this.all(`PRAGMA table_info(users)`);

            const hasPersona = columns.some(c => c.name === 'persona');
            if (!hasPersona) {
                this.run(`ALTER TABLE users ADD COLUMN persona TEXT DEFAULT 'Teacher'`);
            }

            const hasCoins = columns.some(c => c.name === 'coins');
            if (!hasCoins) {
                this.run(`ALTER TABLE users ADD COLUMN coins INTEGER DEFAULT 0`);
                this.run(`ALTER TABLE users ADD COLUMN companion_data TEXT`);
            }
        } catch (e) {
            console.error('Migration error:', e);
        }
    }

    /**
     * Save database to file
     */
    save() {
        const data = this.db.export();
        const buffer = Buffer.from(data);
        writeFileSync(DB_PATH, buffer);
    }

    /**
     * Execute a query and get first result
     */
    get(sql, params = []) {
        const stmt = this.db.prepare(sql);
        stmt.bind(params);
        if (stmt.step()) {
            const result = stmt.getAsObject();
            stmt.free();
            return result;
        }
        stmt.free();
        return null;
    }

    /**
     * Execute a query and get all results
     */
    all(sql, params = []) {
        const stmt = this.db.prepare(sql);
        stmt.bind(params);
        const results = [];
        while (stmt.step()) {
            results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
    }

    /**
     * Execute a query (INSERT, UPDATE, DELETE)
     */
    run(sql, params = []) {
        this.db.run(sql, params);
        this.save();
    }

    // ==================== USER OPERATIONS ====================

    /**
     * Get or create user
     */
    getOrCreateUser(telegramUser) {
        const existing = this.get(
            'SELECT * FROM users WHERE telegram_id = ?',
            [telegramUser.id]
        );

        if (existing) {
            // Update user info
            this.run(`
        UPDATE users SET 
          username = ?,
          first_name = ?,
          last_name = ?,
          updated_at = datetime('now')
        WHERE telegram_id = ?
      `, [
                telegramUser.username || null,
                telegramUser.first_name || null,
                telegramUser.last_name || null,
                telegramUser.id
            ]);

            return this.get('SELECT * FROM users WHERE telegram_id = ?', [telegramUser.id]);
        }

        // Create new user
        this.run(`
      INSERT INTO users (telegram_id, username, first_name, last_name, language_code, coins)
      VALUES (?, ?, ?, ?, ?, 0)
    `, [
            telegramUser.id,
            telegramUser.username || null,
            telegramUser.first_name || null,
            telegramUser.last_name || null,
            telegramUser.language_code || 'en'
        ]);

        return this.get('SELECT * FROM users WHERE telegram_id = ?', [telegramUser.id]);
    }

    /**
     * Check if user accepted terms
     */
    hasAcceptedTerms(userId) {
        const user = this.get(
            'SELECT terms_accepted FROM users WHERE telegram_id = ?',
            [userId]
        );
        return user?.terms_accepted === 1;
    }

    /**
     * Mark terms as accepted
     */
    acceptTerms(userId) {
        this.run(`
      UPDATE users SET 
        terms_accepted = 1,
        terms_accepted_at = datetime('now')
      WHERE telegram_id = ?
    `, [userId]);
    }

    /**
     * Set user language
     */
    setLanguage(userId, languageCode) {
        this.run(
            'UPDATE users SET language_code = ? WHERE telegram_id = ?',
            [languageCode, userId]
        );
    }

    /**
     * Get user language
     */
    getLanguage(userId) {
        const user = this.get(
            'SELECT language_code FROM users WHERE telegram_id = ?',
            [userId]
        );
        return user?.language_code || 'en';
    }

    /**
     * Check if user is banned
     */
    isBanned(userId) {
        const user = this.get(
            'SELECT is_banned FROM users WHERE telegram_id = ?',
            [userId]
        );
        return user?.is_banned === 1;
    }

    /**
     * Ban/unban user
     */
    setBanned(userId, banned) {
        this.run(
            'UPDATE users SET is_banned = ? WHERE telegram_id = ?',
            [banned ? 1 : 0, userId]
        );
    }

    /**
     * Set user persona
     */
    setPersona(userId, persona) {
        this.run(
            'UPDATE users SET persona = ? WHERE telegram_id = ?',
            [persona, userId]
        );
    }

    /**
     * Get user persona
     */
    getPersona(userId) {
        const user = this.get(
            'SELECT persona FROM users WHERE telegram_id = ?',
            [userId]
        );
        return user?.persona || 'Teacher';
    }

    /**
     * Set Companion Data
     */
    setCompanionData(userId, data) {
        const json = JSON.stringify(data);
        this.run(
            'UPDATE users SET companion_data = ? WHERE telegram_id = ?',
            [json, userId]
        );
    }

    /**
     * Get Companion Data
     */
    getCompanionData(userId) {
        const user = this.get(
            'SELECT companion_data FROM users WHERE telegram_id = ?',
            [userId]
        );
        return user?.companion_data ? JSON.parse(user.companion_data) : null;
    }

    /**
     * Update Coins
     */
    addCoins(userId, amount) {
        this.run(
            'UPDATE users SET coins = coins + ? WHERE telegram_id = ?',
            [amount, userId]
        );
    }

    getCoins(userId) {
        const user = this.get('SELECT coins FROM users WHERE telegram_id = ?', [userId]);
        return user?.coins || 0;
    }

    // ==================== MARKETPLACE ====================

    createListing(sellerId, title, description, price, content) {
        this.run(`
            INSERT INTO marketplace_listings (seller_id, title, description, price, content)
            VALUES (?, ?, ?, ?, ?)
        `, [sellerId, title, description, price, JSON.stringify(content)]);
    }

    getListings() {
        return this.all(`
            SELECT m.*, u.first_name as seller_name 
            FROM marketplace_listings m
            JOIN users u ON m.seller_id = u.telegram_id
            WHERE m.status = 'active'
            ORDER BY m.created_at DESC
        `);
    }

    // ==================== SEARCH HISTORY ====================

    /**
     * Add search to history
     */
    addSearchHistory(userId, query, resultsCount = 0) {
        this.run(`
      INSERT INTO search_history (user_id, query, results_count)
      VALUES (?, ?, ?)
    `, [userId, query, resultsCount]);

        // Increment daily search count
        const today = new Date().toISOString().split('T')[0];
        const user = this.get(
            'SELECT last_search_date, search_count_today FROM users WHERE telegram_id = ?',
            [userId]
        );

        if (user?.last_search_date === today) {
            this.run(`
        UPDATE users SET search_count_today = search_count_today + 1
        WHERE telegram_id = ?
      `, [userId]);
        } else {
            this.run(`
        UPDATE users SET search_count_today = 1, last_search_date = ?
        WHERE telegram_id = ?
      `, [today, userId]);
        }
    }

    /**
     * Get user search history
     */
    getSearchHistory(userId, limit = 10) {
        return this.all(`
      SELECT query, results_count, created_at
      FROM search_history
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `, [userId, limit]);
    }

    /**
     * Get daily search count
     */
    getDailySearchCount(userId) {
        const today = new Date().toISOString().split('T')[0];
        const user = this.get(
            'SELECT last_search_date, search_count_today FROM users WHERE telegram_id = ?',
            [userId]
        );

        if (user?.last_search_date === today) {
            return user.search_count_today;
        }
        return 0;
    }

    // ==================== FAVORITES ====================

    /**
     * Add movie to favorites
     */
    addFavorite(userId, movie) {
        try {
            this.run(`
        INSERT OR REPLACE INTO favorites (user_id, movie_id, movie_title, movie_year, imdb_id, poster_url)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
                userId,
                movie.id?.toString() || movie.imdbCode,
                movie.title,
                movie.year || null,
                movie.imdbCode || movie.imdbId || null,
                movie.poster || null
            ]);
            return true;
        } catch (error) {
            console.error('Add favorite error:', error.message);
            return false;
        }
    }

    /**
     * Remove movie from favorites
     */
    removeFavorite(userId, movieId) {
        this.run(
            'DELETE FROM favorites WHERE user_id = ? AND movie_id = ?',
            [userId, movieId.toString()]
        );
        return true;
    }

    /**
     * Check if movie is in favorites
     */
    isFavorite(userId, movieId) {
        const fav = this.get(
            'SELECT id FROM favorites WHERE user_id = ? AND movie_id = ?',
            [userId, movieId.toString()]
        );
        return !!fav;
    }

    /**
     * Get user favorites
     */
    getFavorites(userId) {
        return this.all(`
      SELECT movie_id, movie_title, movie_year, imdb_id, poster_url, created_at
      FROM favorites
      WHERE user_id = ?
      ORDER BY created_at DESC
    `, [userId]);
    }

    // ==================== VOCABULARY (FLASHCARDS) ====================

    /**
     * Add word to vocabulary
     */
    addWord(userId, word, definition, context, movieSource) {
        try {
            this.run(`
        INSERT OR REPLACE INTO vocabulary (user_id, word, definition, context, movie_source)
        VALUES (?, ?, ?, ?, ?)
      `, [userId, word, definition, context, movieSource]);
            return true;
        } catch (error) {
            console.error('Add word error:', error.message);
            return false;
        }
    }

    /**
     * Remove word from vocabulary
     */
    removeWord(userId, word) {
        this.run(
            'DELETE FROM vocabulary WHERE user_id = ? AND word = ?',
            [userId, word]
        );
        return true;
    }

    /**
     * Get user vocabulary
     */
    getVocabulary(userId) {
        return this.all(`
      SELECT word, definition, context, movie_source, created_at
      FROM vocabulary
      WHERE user_id = ?
      ORDER BY created_at DESC
    `, [userId]);
    }

    // ==================== STATISTICS ====================

    /**
     * Get user count
     */
    getUserCount() {
        const result = this.get('SELECT COUNT(*) as count FROM users');
        return result?.count || 0;
    }

    /**
     * Get total searches
     */
    getTotalSearches() {
        const result = this.get('SELECT COUNT(*) as count FROM search_history');
        return result?.count || 0;
    }

    /**
     * Get all users (for admin broadcast)
     */
    getAllUsers() {
        return this.all('SELECT telegram_id FROM users WHERE is_banned = 0');
    }

    // ==================== REMINDERS ====================

    /**
     * Create a new reminder
     */
    addReminder(userId, task, remindAt) {
        this.run(`
            INSERT INTO reminders (user_id, task, remind_at)
            VALUES (?, ?, ?)
        `, [userId, task, remindAt]);
        return true;
    }

    /**
     * Get pending reminders that are due
     */
    getDueReminders() {
        const now = new Date().toISOString();
        return this.all(`
            SELECT * FROM reminders 
            WHERE status = 'pending' AND remind_at <= ?
        `, [now]);
    }

    /**
     * Mark reminder as completed
     */
    completeReminder(id) {
        this.run(
            'UPDATE reminders SET status = "completed" WHERE id = ?',
            [id]
        );
    }

    /**
     * Close database connection
     */
    close() {
        if (this.db) {
            this.save();
            this.db.close();
        }
    }
}

// Export singleton instance
const dbService = new DatabaseService();

// Export initialized instance
export default dbService;
export { DatabaseService };
