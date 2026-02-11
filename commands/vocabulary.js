/**
 * Vocabulary / Flashcard Commands
 * Handles saving words, listing them, and exporting to Anki
 */

import db from '../database/sqlite.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Handle /words command - List saved vocabulary
 */
export async function handleVocabularyList(bot, msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    const words = db.getVocabulary(userId);

    if (!words || words.length === 0) {
        await bot.sendMessage(chatId, '📚 *جعبه لغت شما خالی است.*\n\nهنگام استفاده از یادگیری، روی دکمه‌های "ذخیره لغت" کلیک کنید.', { parse_mode: 'Markdown' });
        return;
    }

    let text = `📚 *لغات من (${words.length})*\n\n`;

    // Show last 10 words
    words.slice(0, 10).forEach((w, i) => {
        text += `${i + 1}. *${w.word}*\n   📝 ${w.definition || ''}\n   🎥 ${w.movie_source || 'Unknown'}\n\n`;
    });

    if (words.length > 10) {
        text += `_...و ${words.length - 10} لغت دیگر_`;
    }

    const keyboard = [
        [{ text: '📤 خروجی آنکی (Anki Export)', callback_data: 'export_anki' }],
        [{ text: '🗑 پاکسازی لیست', callback_data: 'clear_vocab' }]
    ];

    await bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
    });
}

/**
 * Handle save word callback
 * callback_data: save_word:WORD:MOVIE_TITLE (Encoded)
 */
export async function handleSaveWord(bot, query, data) {
    const userId = query.from.id;
    const parts = data.split(':');

    if (parts.length < 2) return;

    // Decode word and movie (using base64 or just URI component if simple)
    // For simplicity here, assuming simple text or URI encoded
    const word = decodeURIComponent(parts[1]);
    const movie = parts[2] ? decodeURIComponent(parts[2]) : 'Unknown';
    // Definition is tricky to pass in callback data due to length limits.
    // For now, we save it without definition, or fetch logic. 
    // BETTER APPROACH: The definition is in the message text.
    // But reading message text to find definition is hard.
    // Simpler: Just save the word and context is the movie. user can edit later or we rely on user knowledge.

    // Check if word exists
    db.addWord(userId, word, '', '', movie);

    await bot.answerCallbackQuery(query.id, { text: `✅ لغت "${word}" ذخیره شد!` });
}

/**
 * Handle Anki Export
 */
export async function handleAnkiExport(bot, query) {
    const userId = query.from.id;
    const chatId = query.message.chat.id;

    const words = db.getVocabulary(userId);
    if (!words.length) {
        await bot.answerCallbackQuery(query.id, { text: 'لیست خالی است.' });
        return;
    }

    await bot.sendMessage(chatId, '📤 *در حال آماده‌سازی فایل آنکی...*', { parse_mode: 'Markdown' });

    // Create CSV content
    // Format: "Front","Back","Context"
    let csvContent = 'Front,Back,Context\n';
    words.forEach(w => {
        const front = w.word.replace(/"/g, '""');
        const back = (w.definition || 'Definition').replace(/"/g, '""');
        const context = `Source: ${w.movie_source}`.replace(/"/g, '""');
        csvContent += `"${front}","${back}","${context}"\n`;
    });

    const filePath = path.join(__dirname, `../temp_vocab_${userId}.csv`);
    fs.writeFileSync(filePath, csvContent, 'utf8');

    await bot.sendDocument(chatId, filePath, {
        caption: '📦 *فایل فلش‌کارت آنکی شما*\n\nاین فایل را در برنامه Anki دسکتاپ یا موبایل Import کنید.'
    });

    // Cleanup
    fs.unlinkSync(filePath);
}
