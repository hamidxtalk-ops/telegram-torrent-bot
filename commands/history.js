/**
 * /history Command
 * Display user's search history
 */

import db from '../database/sqlite.js';
import { formatHistory } from '../utils/formatter.js';

/**
 * Handle /history command
 * @param {Object} bot - Telegram bot instance
 * @param {Object} msg - Message object
 */
export async function handleHistory(bot, msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    const history = db.getSearchHistory(userId, 10);
    const { text, keyboard } = formatHistory(history);

    // Add utility buttons
    const fullKeyboard = [...keyboard];
    if (history.length > 0) {
        fullKeyboard.push([
            { text: '🗑️ Clear History', callback_data: 'clear_history' }
        ]);
    }
    fullKeyboard.push([
        { text: '🔍 New Search', callback_data: 'prompt_search' }
    ]);

    await bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: fullKeyboard }
    });
}

/**
 * Handle history callback from button
 * @param {Object} bot - Telegram bot instance
 * @param {Object} query - Callback query
 */
export async function handleHistoryCallback(bot, query) {
    const chatId = query.message.chat.id;
    const userId = query.from.id;

    const history = db.getSearchHistory(userId, 10);
    const { text, keyboard } = formatHistory(history);

    const fullKeyboard = [...keyboard];
    if (history.length > 0) {
        fullKeyboard.push([
            { text: '🗑️ Clear History', callback_data: 'clear_history' }
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
        await bot.sendMessage(chatId, text, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: fullKeyboard }
        });
    }

    await bot.answerCallbackQuery(query.id);
}

/**
 * Handle re-search from history
 * @param {Object} bot - Telegram bot instance
 * @param {Object} query - Callback query
 * @param {string} searchQuery - Query to re-search
 * @param {Function} searchHandler - Search handler function
 */
export async function handleHistorySearch(bot, query, searchQuery, searchHandler) {
    const chatId = query.message.chat.id;

    await bot.answerCallbackQuery(query.id);

    // Create fake message object for search handler
    const fakeMsg = {
        chat: { id: chatId },
        from: query.from
    };

    await searchHandler(bot, fakeMsg, searchQuery);
}

export default {
    handleHistory,
    handleHistoryCallback,
    handleHistorySearch
};
