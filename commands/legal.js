/**
 * /legal Command
 * Display legal disclaimer
 */

import db from '../database/sqlite.js';
import { t } from '../utils/languages.js';

/**
 * Handle /legal command
 * @param {Object} bot - Telegram bot instance
 * @param {Object} msg - Message object
 */
export async function handleLegal(bot, msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const lang = db.getLanguage(userId);

    await bot.sendMessage(chatId, t(lang, 'legal'), {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: '🔙 Back to Main Menu', callback_data: 'back_main' }]
            ]
        }
    });
}

export default { handleLegal };
