/**
 * Smart Vision / Universal Media Handler
 * Handles all image-based features: Casting, Wardrobe, Location, Analysis
 */

import ai from '../services/aiLearning.js';
import { downloadTelegramFile, cleanupFile } from '../utils/mediaUtils.js';
import fs from 'fs';

// Temporary storage for file IDs to context
// { chatId: { fileId: '...', type: 'photo', localPath: '...' } }
const mediaContexts = new Map();

/**
 * Handle incoming photo/image
 */
export async function handleSmartMedia(bot, msg) {
    const chatId = msg.chat.id;
    const fileId = msg.photo ? msg.photo[msg.photo.length - 1].file_id : null;

    if (!fileId) return;

    // Save context
    mediaContexts.set(chatId, { fileId, type: 'photo', timestamp: Date.now() });

    const text = `📸 *تصویر دریافت شد!*
    
چه کاری با این عکس انجام دهم؟`;

    const keyboard = [
        [
            { text: '🎭 Casting AI (من شبیه کی‌ام؟)', callback_data: 'vision_casting' },
            { text: '👗 Wardrobe (لباس فیلم)', callback_data: 'vision_wardrobe' }
        ],
        [
            { text: '📍 Locations (لوکیشن)', callback_data: 'vision_location' },
            { text: '🎓 Film School (تحلیل سینمایی)', callback_data: 'vision_analysis' }
        ],
        [{ text: '❌ بیخیال', callback_data: 'vision_cancel' }]
    ];

    await bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard },
        reply_to_message_id: msg.message_id
    });
}

/**
 * Handle vision callbacks
 */
export async function handleVisionCallback(bot, query) {
    const chatId = query.message.chat.id;
    const action = query.data;
    const context = mediaContexts.get(chatId);

    if (action === 'vision_cancel') {
        mediaContexts.delete(chatId);
        await bot.deleteMessage(chatId, query.message.message_id);
        return;
    }

    if (!context || !context.fileId) {
        await bot.answerCallbackQuery(query.id, { text: '❌ تصویر منقضی شده. لطفاً دوباره بفرستید.' });
        return;
    }

    await bot.answerCallbackQuery(query.id, { text: '🤖 در حال پردازش هوشمند...' });
    await bot.editMessageText('⏳ *هوش مصنوعی در حال آنالیز تصویر...*', {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'Markdown'
    });

    let localFilePath = null;
    try {
        const fileLink = await bot.getFileLink(context.fileId);
        localFilePath = await downloadTelegramFile(fileLink, context.fileId);
        const fileBuffer = fs.readFileSync(localFilePath);

        let resultText = '';
        let mode = '';

        switch (action) {
            case 'vision_casting':
                mode = 'casting';
                resultText = await ai.analyzeImage(fileBuffer, 'casting');
                break;
            case 'vision_wardrobe':
                mode = 'wardrobe';
                resultText = await ai.analyzeImage(fileBuffer, 'wardrobe');
                break;
            case 'vision_location':
                mode = 'location';
                resultText = await ai.analyzeImage(fileBuffer, 'location');
                break;
            case 'vision_analysis':
                mode = 'analysis';
                resultText = await ai.analyzeImage(fileBuffer, 'analysis');
                break;
        }

        await bot.editMessageText(resultText, {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'Markdown'
        });

    } catch (error) {
        console.error('Vision Error:', error);
        await bot.editMessageText('❌ خطا در پردازش تصویر.', {
            chat_id: chatId,
            message_id: query.message.message_id
        });
    } finally {
        if (localFilePath) cleanupFile(localFilePath);
        mediaContexts.delete(chatId);
    }
}

export default {
    handleSmartMedia,
    handleVisionCallback
};
