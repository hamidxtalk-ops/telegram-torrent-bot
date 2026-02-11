/**
 * Persona Selection Command
 * Allows users to choose their AI teacher persona
 */

import db from '../database/sqlite.js';

const PERSONAS = {
    'Teacher': '👨‍🏫 معلم زبان (رسمی)',
    'Captain Jack Sparrow': '🏴‍☠️ کاپیتان جک اسپارو (دزدان دریایی)',
    'Batman': '🦇 بتمن (شوالیه تاریکی)',
    'Sherlock Holmes': '🕵️‍♂️ شرلوک هلمز (کارآگاه)',
    'Barbie': '👸 باربی (شاد و پرانرژی)',
    'Yoda': '👽 استاد یودا (جنگ ستارگان)',
    'Tony Stark': '🦾 تونی استارک (مرد آهنی)',
    'Godfather': '🌹 دون کورلئونه (پدرخوانده)'
};

export async function handlePersonaCommand(bot, msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    const currentPersona = db.getPersona(userId);

    let text = `🎭 *انتخاب شخصیت معلم هوش مصنوعی*\n\n` +
        `در حال حاضر معلم شما: *${PERSONAS[currentPersona] || currentPersona}* است.\n\n` +
        `یکی از شخصیت‌های زیر را انتخاب کنید تا با لحن او به شما آموزش دهم:`;

    const keyboard = [];
    let row = [];

    Object.entries(PERSONAS).forEach(([key, label], index) => {
        row.push({ text: label, callback_data: `set_persona:${key}` });
        if (row.length === 2) {
            keyboard.push(row);
            row = [];
        }
    });
    if (row.length > 0) keyboard.push(row);

    await bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
    });
}

export async function handleSetPersona(bot, query, personaKey) {
    const userId = query.from.id;
    const chatId = query.message.chat.id;

    if (!PERSONAS[personaKey]) {
        await bot.answerCallbackQuery(query.id, { text: '❌ شخصیت نامعتبر است.' });
        return;
    }

    db.setPersona(userId, personaKey);

    await bot.answerCallbackQuery(query.id, { text: `✅ معلم شما به ${PERSONAS[personaKey]} تغییر کرد!` });

    // Update message text to reflect change
    await bot.editMessageText(
        `🎭 *انتخاب شخصیت معلم هوش مصنوعی*\n\n` +
        `✅ شخصیت فعلی شما: *${PERSONAS[personaKey]}* تغییر یافت.\n\n` +
        `از این به بعد تحلیل‌ها با لحن این شخصیت انجام می‌شود!`,
        {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [] } // Clear keyboard
        }
    );
}
