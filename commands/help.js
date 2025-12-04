/**
 * /help Command
 * Display help information
 */

import db from '../database/sqlite.js';
import { t } from '../utils/languages.js';

/**
 * Handle /help command
 * @param {Object} bot - Telegram bot instance
 * @param {Object} msg - Message object
 */
export async function handleHelp(bot, msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const lang = db.getLanguage(userId);

    await bot.sendMessage(chatId, t(lang, 'help'), {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '🔍 Search Movies', callback_data: 'prompt_search' },
                    { text: '🔥 Trending', callback_data: 'trending' }
                ],
                [
                    { text: '⭐ Favorites', callback_data: 'favorites' },
                    { text: '📜 History', callback_data: 'history' }
                ],
                [
                    { text: '🎭 Browse Genres', callback_data: 'browse' }
                ]
            ]
        }
    });
}

export default { handleHelp };
