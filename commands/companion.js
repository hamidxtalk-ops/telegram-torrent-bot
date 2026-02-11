/**
 * Companion Command Handler
 * Handles /companion command and chat interactions
 */

import { getCompanionProfile, updateCompanionProfile, chatWithCompanion } from '../services/companionService.js';
import { generateVoice, generateVideoNote } from '../services/mediaGenerator.js';
import db from '../database/sqlite.js';
import fs from 'fs';

// User state for companion mode
// { chatId: { mode: 'chat' | 'call', context: [] } }
const companionSessions = new Map();

/**
 * Handle /companion command
 */
export async function handleCompanionCommand(bot, msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const profile = getCompanionProfile(userId);

    const text = `🧞‍♂️ **My Movie Mate**
    
👤 **Name:** ${profile.name}
 **Gender:** ${profile.gender}
🧠 **Personality:** ${profile.personality}
❤️ **Relationship:** Level ${profile.relationship_level}

What would you like to do?`;

    const keyboard = [
        [
            { text: '💬 Chat Mode', callback_data: 'comp_chat' },
            { text: '📞 Call Mode (Voice)', callback_data: 'comp_call' }
        ],
        [
            { text: '✏️ Edit Profile', callback_data: 'comp_edit' },
            { text: '📸 Video Message', callback_data: 'comp_video' }
        ],
        [{ text: '❌ Close', callback_data: 'comp_close' }]
    ];

    await bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
    });
}

/**
 * Handle Companion Callbacks
 */
export async function handleCompanionCallback(bot, query) {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const data = query.data;

    if (data === 'comp_close') {
        companionSessions.delete(chatId);
        await bot.deleteMessage(chatId, query.message.message_id);
        return;
    }

    if (data === 'comp_chat') {
        companionSessions.set(chatId, { mode: 'chat', context: [] });
        await bot.sendMessage(chatId, '💬 **Chat Mode Active**\nSay hello to your companion!', { parse_mode: 'Markdown' });
        return;
    }

    if (data === 'comp_call') {
        companionSessions.set(chatId, { mode: 'call', context: [] });
        await bot.sendMessage(chatId, '📞 **Call Mode Active**\nSend a Voice Note to start talking.', { parse_mode: 'Markdown' });
        return;
    }

    if (data === 'comp_edit') {
        // Simple toggle for demo
        const current = getCompanionProfile(userId);
        const newGender = current.gender === 'Female' ? 'Male' : 'Female';
        updateCompanionProfile(userId, { gender: newGender });

        await bot.answerCallbackQuery(query.id, { text: `Gender switched to ${newGender}` });
        await handleCompanionCommand(bot, query.message); // Refresh menu
        return;
    }

    if (data === 'comp_video') {
        companionSessions.set(chatId, { mode: 'video', context: [] });
        await bot.sendMessage(chatId, '📹 **Video Call Active**\nI will reply with Video Notes!', { parse_mode: 'Markdown' });
        return;
    }
}

/**
 * Process messages when in Companion Mode
 */
export async function handleCompanionMessage(bot, msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const session = companionSessions.get(chatId);

    if (!session) return false; // Not in companion mode

    // Check for exit
    if (msg.text === '/exit' || msg.text === '/stop') {
        companionSessions.delete(chatId);
        await bot.sendMessage(chatId, '❌ Companion mode ended.');
        return true;
    }

    await bot.sendChatAction(chatId, 'typing');

    // Get response
    const userText = msg.text || (msg.voice ? '[Voice Message]' : '[Image]');

    // Manage history limit
    if (session.context.length > 10) session.context.shift();

    const responseText = await chatWithCompanion(userId, userText, session.context);

    // Update history
    session.context.push({ role: 'user', parts: [{ text: userText }] });
    session.context.push({ role: 'model', parts: [{ text: responseText }] });

    // Send response based on mode
    if (session.mode === 'call') {
        try {
            // Voice Mode
            const audioPath = await generateVoice(responseText, 'en');
            await bot.sendVoice(chatId, audioPath);
            fs.unlinkSync(audioPath);
        } catch (e) {
            console.error('Voice Gen Error:', e);
            await bot.sendMessage(chatId, `🎤 (Voice Error): ${responseText}`);
        }
    } else if (session.mode === 'video') {
        try {
            await bot.sendChatAction(chatId, 'upload_video_note');

            // Generate Audio First
            const audioPath = await generateVoice(responseText, 'en');

            // Get Avatar (Placeholder or specific one)
            // For now, use a default placeholder or download user profile photo?
            // Let's use a local asset for the "AI Avatar". 
            // We need to ensure this file exists.
            const avatarPath = './assets/avatar_default.jpg';

            if (!fs.existsSync(avatarPath)) {
                // Fallback if no avatar
                await bot.sendVoice(chatId, audioPath);
            } else {
                const videoPath = await generateVideoNote(avatarPath, audioPath);
                await bot.sendVideoNote(chatId, videoPath);
                fs.unlinkSync(videoPath);
            }
            fs.unlinkSync(audioPath);
        } catch (e) {
            console.error('Video Gen Error:', e);
            // Fallback to Voice if video fails
            try {
                const audioPath = await generateVoice(responseText, 'en');
                await bot.sendVoice(chatId, audioPath);
                fs.unlinkSync(audioPath);
            } catch (err) {
                await bot.sendMessage(chatId, `📹 (Video/Voice Error): ${responseText}`);
            }
        }
    } else {
        await bot.sendMessage(chatId, responseText);
    }

    return true; // Message handled
}

export default {
    handleCompanionCommand,
    handleCompanionCallback,
    handleCompanionMessage
};
