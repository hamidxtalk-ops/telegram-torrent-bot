/**
 * /start Command
 * Welcome message and terms acceptance
 */

import db from '../database/sqlite.js';
import { t, getLanguageKeyboard } from '../utils/languages.js';

/**
 * Handle /start command
 * @param {Object} bot - Telegram bot instance
 * @param {Object} msg - Message object
 */
export async function handleStart(bot, msg) {
    const chatId = msg.chat.id;
    const user = db.getOrCreateUser(msg.from);
    const lang = user.language_code || 'en';

    // Check if user has accepted terms
    if (!db.hasAcceptedTerms(msg.from.id)) {
        // Show terms acceptance message
        const termsMessage = `${t(lang, 'legal')}\n\n_${t(lang, 'welcome')}_`;

        await bot.sendMessage(chatId, termsMessage, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: `✅ ${t(lang, 'acceptTerms')}`, callback_data: 'accept_terms' }]
                ]
            }
        });
        return;
    }

    // User has accepted terms, show welcome
    await bot.sendMessage(chatId, t(lang, 'welcome'), {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '🔍 Search Movies', callback_data: 'prompt_search' },
                    { text: '🔥 Trending', callback_data: 'trending' }
                ],
                [
                    { text: '⭐ Favorites', callback_data: 'favorites' },
                    { text: '🎭 Browse Genres', callback_data: 'browse' }
                ],
                [
                    { text: '🌐 Language', callback_data: 'select_language' }
                ]
            ]
        }
    });
}

/**
 * Handle terms acceptance callback
 * @param {Object} bot - Telegram bot instance
 * @param {Object} query - Callback query object
 */
export async function handleAcceptTerms(bot, query) {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const lang = db.getLanguage(userId);

    // Mark terms as accepted
    db.acceptTerms(userId);

    // Answer callback
    await bot.answerCallbackQuery(query.id, {
        text: t(lang, 'termsAccepted'),
        show_alert: true
    });

    // Delete the terms message
    try {
        await bot.deleteMessage(chatId, query.message.message_id);
    } catch (e) {
        // Message might already be deleted
    }

    // Send welcome message
    await bot.sendMessage(chatId, t(lang, 'welcome'), {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '🔍 Search Movies', callback_data: 'prompt_search' },
                    { text: '🔥 Trending', callback_data: 'trending' }
                ],
                [
                    { text: '⭐ Favorites', callback_data: 'favorites' },
                    { text: '🎭 Browse Genres', callback_data: 'browse' }
                ]
            ]
        }
    });
}

/**
 * Handle language selection
 * @param {Object} bot - Telegram bot instance
 * @param {Object} query - Callback query object
 */
export async function handleLanguageSelect(bot, query) {
    const chatId = query.message.chat.id;

    await bot.editMessageText('🌐 *Select your language:*', {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: getLanguageKeyboard()
        }
    });

    await bot.answerCallbackQuery(query.id);
}

/**
 * Handle language change callback
 * @param {Object} bot - Telegram bot instance
 * @param {Object} query - Callback query object
 * @param {string} langCode - Language code
 */
export async function handleLanguageChange(bot, query, langCode) {
    const chatId = query.message.chat.id;
    const userId = query.from.id;

    // Update language
    db.setLanguage(userId, langCode);

    await bot.answerCallbackQuery(query.id, {
        text: '✅ Language updated!',
        show_alert: false
    });

    // Resend welcome in new language
    try {
        await bot.deleteMessage(chatId, query.message.message_id);
    } catch (e) { }

    await bot.sendMessage(chatId, t(langCode, 'welcome'), {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '🔍 Search Movies', callback_data: 'prompt_search' },
                    { text: '🔥 Trending', callback_data: 'trending' }
                ],
                [
                    { text: '⭐ Favorites', callback_data: 'favorites' },
                    { text: '🎭 Browse Genres', callback_data: 'browse' }
                ]
            ]
        }
    });
}

export default { handleStart, handleAcceptTerms, handleLanguageSelect, handleLanguageChange };
