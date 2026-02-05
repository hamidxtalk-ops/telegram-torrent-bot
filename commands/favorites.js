/**
 * /favorites Command
 * Manage user's favorite movies
 */

import db from '../database/sqlite.js';
import { t } from '../utils/languages.js';
import { formatFavorites, escapeMarkdown } from '../utils/formatter.js';

/**
 * Handle /favorites command
 * @param {Object} bot - Telegram bot instance
 * @param {Object} msg - Message object
 */
export async function handleFavorites(bot, msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const lang = db.getLanguage(userId);

    // Check terms
    if (!db.hasAcceptedTerms(userId)) {
        await bot.sendMessage(chatId, t(lang, 'termsRequired'));
        return;
    }

    const favorites = db.getFavorites(userId);
    const { text, keyboard } = formatFavorites(favorites);

    // Add management buttons if there are favorites
    const fullKeyboard = [...keyboard];
    if (favorites.length > 0) {
        fullKeyboard.push([
            { text: '🗑️ Clear All Favorites', callback_data: 'clear_favorites' }
        ]);
    }
    fullKeyboard.push([
        { text: '🔍 Search Movies', callback_data: 'prompt_search' }
    ]);

    await bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: fullKeyboard }
    });
}

/**
 * Handle add to favorites callback
 * @param {Object} bot - Telegram bot instance
 * @param {Object} query - Callback query
 * @param {string} movieId - Movie ID
 * @param {Object} movieData - Movie data (if available)
 */
export async function handleAddFavorite(bot, query, movieId, movieData = null) {
    const userId = query.from.id;
    const lang = db.getLanguage(userId);

    // Check if already favorite
    if (db.isFavorite(userId, movieId)) {
        // Remove from favorites
        db.removeFavorite(userId, movieId);
        await bot.answerCallbackQuery(query.id, {
            text: t(lang, 'removedFromFavorites'),
            show_alert: false
        });
        return;
    }

    // Need movie data to add
    if (!movieData) {
        // Try to get from message context or cache
        await bot.answerCallbackQuery(query.id, {
            text: 'Could not add to favorites. Please try again.',
            show_alert: true
        });
        return;
    }

    // Add to favorites
    const success = db.addFavorite(userId, movieData);

    await bot.answerCallbackQuery(query.id, {
        text: success ? t(lang, 'addedToFavorites') : t(lang, 'errorGeneral'),
        show_alert: !success
    });
}

/**
 * Handle clear all favorites
 * @param {Object} bot - Telegram bot instance
 * @param {Object} query - Callback query
 */
export async function handleClearFavorites(bot, query) {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const lang = db.getLanguage(userId);

    // Get all favorites and remove them
    const favorites = db.getFavorites(userId);
    favorites.forEach(fav => db.removeFavorite(userId, fav.movie_id));

    await bot.answerCallbackQuery(query.id, {
        text: '✅ All favorites cleared!',
        show_alert: false
    });

    // Update message
    await bot.editMessageText('📋 *Your Favorites*\n\n_No favorites yet. Use the ⭐ button to save movies!_', {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: '🔍 Search Movies', callback_data: 'prompt_search' }]
            ]
        }
    });
}

/**
 * Handle favorites callback from other sources
 * @param {Object} bot - Telegram bot instance
 * @param {Object} query - Callback query
 */
export async function handleFavoritesCallback(bot, query) {
    const chatId = query.message.chat.id;
    const userId = query.from.id;

    const favorites = db.getFavorites(userId);
    const { text, keyboard } = formatFavorites(favorites);

    const fullKeyboard = [...keyboard];
    if (favorites.length > 0) {
        fullKeyboard.push([
            { text: '🗑️ Clear All', callback_data: 'clear_favorites' }
        ]);
    }
    fullKeyboard.push([
        { text: '🔙 Back', callback_data: 'back_main' }
    ]);

    try {
        await bot.editMessageText(text, {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: fullKeyboard }
        });
    } catch (e) {
        // Message might not be editable, send new one
        await bot.sendMessage(chatId, text, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: fullKeyboard }
        });
    }

    await bot.answerCallbackQuery(query.id);
}

export default {
    handleFavorites,
    handleAddFavorite,
    handleClearFavorites,
    handleFavoritesCallback
};
