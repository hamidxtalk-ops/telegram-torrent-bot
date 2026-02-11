/**
 * /learn Command & Callbacks
 * Handles the language learning logic
 */

import db from '../database/sqlite.js';
import ai from '../services/aiLearning.js';
import subtitleAPI from '../services/subtitleAPI.js';
import { searchResults } from './search.js';
import { escapeMarkdown } from '../utils/formatter.js';

/**
 * Handle Learn Mode initiation
 */
export async function handleLearnMode(bot, query, movieIndex) {
    const chatId = query.message.chat.id;
    const userId = query.from.id;

    await bot.answerCallbackQuery(query.id, { text: '🎓 فعال‌سازی حالت یادگیری...' });

    const results = searchResults.get(`${userId}:results`);
    const movie = results ? results[parseInt(movieIndex)] : null;

    if (!movie) {
        await bot.sendMessage(chatId, '❌ نتایج یافت نشد. لطفاً دوباره جستجو کنید.');
        return;
    }

    const welcomeMsg = `🎓 *Welcome to MovieLingo Learning Mode!*
    
🎬 Movie: *${escapeMarkdown(movie.title)}*

در این بخش، ما دیالوگ‌های مهم این فیلم را تحلیل می‌کنیم تا عبارات، اصطلاحات و گرامر انگلیسی را یاد بگیرید.

چه کاری می‌خواهید انجام دهید؟`;

    const keyboard = [
        [{ text: '🔍 تحلیل جملات معروف', callback_data: `learn_quotes:${movieIndex}` }],
        [{ text: '📝 لیست لغات کلیدی', callback_data: `learn_vocab:${movieIndex}` }],
        [{ text: '🔙 بازگشت به فیلم', callback_data: `sel:${movieIndex}` }]
    ];

    await bot.sendMessage(chatId, welcomeMsg, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
    });
}

/**
 * Handle "Analyze Quotes"
 */
export async function handleLearnQuotes(bot, query, movieIndex) {
    const chatId = query.message.chat.id;
    const userId = query.from.id;

    await bot.answerCallbackQuery(query.id, { text: '⏳ در حال دریافت جملات...' });

    const results = searchResults.get(`${userId}:results`);
    const movie = results ? results[parseInt(movieIndex)] : null;

    if (!movie) return;

    // Fetch learning moments from AI
    const quotes = await ai.getLearningMoments(movie.title);

    if (!quotes || quotes.length === 0) {
        await bot.sendMessage(chatId, '⚠️ متاسفانه جمله‌ای برای این فیلم یافت نشد.');
        return;
    }

    let msg = `🎓 *دیالوگ‌های آموزشی فیلم ${escapeMarkdown(movie.title)}:*\n\n`;

    const keyboard = quotes.map((quote, i) => {
        msg += `${i + 1}. \`${quote}\`\n\n`;
        return [{ text: `💡 تحلیل جمله ${i + 1}`, callback_data: `explain_quote:${movieIndex}:${i}` }];
    });

    keyboard.push([{ text: '🔙 بازگشت', callback_data: `learn_mode:${movieIndex}` }]);

    await bot.sendMessage(chatId, msg, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
    });

    // Store quotes for explaining
    searchResults.set(`${userId}:quotes`, quotes);
}

/**
 * Handle Quote Explanation
 */
export async function handleExplainQuote(bot, query, movieIndex, quoteIndex) {
    const chatId = query.message.chat.id;
    const userId = query.from.id;

    await bot.answerCallbackQuery(query.id, { text: '🤖 در حال تحلیل توسط هوش مصنوعی...' });

    const quotes = searchResults.get(`${userId}:quotes`);
    const results = searchResults.get(`${userId}:results`);
    const movie = results ? results[parseInt(movieIndex)] : null;
    const quote = quotes ? quotes[parseInt(quoteIndex)] : null;

    if (!movie || !quote) {
        await bot.sendMessage(chatId, '❌ خطا در بازیابی فیلم یا جمله. لطفاً دوباره تلاش کنید.');
        return;
    }

    const loadingMsg = await bot.sendMessage(chatId, '⏳ _هوش مصنوعی در حال بررسی دیالوگ است..._', { parse_mode: 'Markdown' });

    // Get user's persona
    const persona = db.getPersona(userId);

    // Pass persona to AI
    const result = await ai.explainDialogue(quote, movie.title, persona);

    await bot.deleteMessage(chatId, loadingMsg.message_id);

    if (result.error) {
        await bot.sendMessage(chatId, `❌ ${result.error}`, { parse_mode: 'Markdown' });
        return;
    }

    // Build buttons for vocabulary
    const keyboard = [];

    if (result.vocab && Array.isArray(result.vocab)) {
        result.vocab.forEach(v => {
            // Encode word and movie for callback
            // Limit callback data size. We might need a shorter key or store state.
            // Simplified: "save_word:WORD:MOVIE"
            // Ensure no colons in word/movie or escape them.
            // Max 64 bytes is tight. 
            // Better: "save_word:WORD" (we lookup context from session if possible, or just ignore context in callback)
            // Or just allow user to save the word itself.
            const safeWord = encodeURIComponent(v.word).substring(0, 20);
            const safeMovie = encodeURIComponent(movie.title).substring(0, 20);
            keyboard.push([{ text: `💾 ذخیره "${v.word}"`, callback_data: `save_word:${safeWord}:${safeMovie}` }]);
        });
    }

    keyboard.push([{ text: '🔙 بازگشت به لیست جملات', callback_data: `learn_quotes:${movieIndex}` }]);

    // Add persona indicator
    const header = persona && persona !== 'Teacher' ? `🎭 *تحلیل توسط ${persona}:*\n\n` : '';
    const explanationText = result.explanation_markdown || result.explanation; // Handle both formats if needed

    await bot.sendMessage(chatId, header + explanationText, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
    });
}

export default {
    handleLearnMode,
    handleLearnQuotes,
    handleExplainQuote
};
