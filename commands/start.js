/**
 * /start Command
 * Welcome message and terms acceptance - Mini App Only Mode
 */

import db from '../database/sqlite.js';
import { t, getLanguageKeyboard } from '../utils/languages.js';

// Get Mini App URL from environment
const WEBAPP_URL = process.env.RENDER_EXTERNAL_URL
    ? `${process.env.RENDER_EXTERNAL_URL}/webapp/`
    : 'https://telegram-torrent-bot-hiy7.onrender.com/webapp/';

/**
 * Handle /start command
 * @param {Object} bot - Telegram bot instance
 * @param {Object} msg - Message object
 */
export async function handleStart(bot, msg) {
    const chatId = msg.chat.id;
    const user = db.getOrCreateUser(msg.from);
    const lang = user.language_code || 'fa';

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

    // User has accepted terms, show Mini App button
    await bot.sendMessage(chatId,
        `🎬 *به فیلم‌یاب خوش آمدید!*\n\n` +
        `برای جستجو و دانلود فیلم روی دکمه زیر کلیک کنید:\n\n` +
        `✨ جستجوی هوشمند از کانال‌های تلگرام\n` +
        `📥 دانلود مستقیم از تلگرام\n` +
        `🧲 لینک‌های تورنت`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: '🎬 ورود به فیلم‌یاب',
                            web_app: { url: WEBAPP_URL }
                        }
                    ],
                    [
                        { text: '🌐 زبان / Language', callback_data: 'select_language' },
                        { text: '📞 پشتیبانی', url: 'https://t.me/Mound84' }
                    ]
                ]
            }
        }
    );
}

/**
 * Handle terms acceptance callback
 * @param {Object} bot - Telegram bot instance
 * @param {Object} query - Callback query object
 */
export async function handleAcceptTerms(bot, query) {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const lang = db.getLanguage(userId) || 'fa';

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

    // Send Mini App welcome message
    await bot.sendMessage(chatId,
        `🎬 *به فیلم‌یاب خوش آمدید!*\n\n` +
        `برای جستجو و دانلود فیلم روی دکمه زیر کلیک کنید:\n\n` +
        `✨ جستجوی هوشمند از کانال‌های تلگرام\n` +
        `📥 دانلود مستقیم از تلگرام\n` +
        `🧲 لینک‌های تورنت`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: '🎬 ورود به فیلم‌یاب',
                            web_app: { url: WEBAPP_URL }
                        }
                    ],
                    [
                        { text: '🌐 زبان / Language', callback_data: 'select_language' },
                        { text: '📞 پشتیبانی', url: 'https://t.me/Mound84' }
                    ]
                ]
            }
        }
    );
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

    // Send Mini App welcome message
    const welcomeText = langCode === 'fa'
        ? `🎬 *به فیلم‌یاب خوش آمدید!*\n\nبرای جستجو و دانلود فیلم روی دکمه زیر کلیک کنید:`
        : `🎬 *Welcome to Movie Finder!*\n\nClick the button below to search and download movies:`;

    await bot.sendMessage(chatId, welcomeText, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [
                    {
                        text: langCode === 'fa' ? '🎬 ورود به فیلم‌یاب' : '🎬 Open Movie Finder',
                        web_app: { url: WEBAPP_URL }
                    }
                ],
                [
                    { text: '🌐 زبان / Language', callback_data: 'select_language' },
                    { text: '📞 پشتیبانی', url: 'https://t.me/Mound84' }
                ]
            ]
        }
    });
}

export default { handleStart, handleAcceptTerms, handleLanguageSelect, handleLanguageChange };
