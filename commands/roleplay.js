/**
 * Roleplay Challenge Command
 * Handles interactive character conversations
 */

import db from '../database/sqlite.js';
import ai from '../services/aiLearning.js';

// Active roleplay sessions: { chatId: { persona: 'Joker', history: [] } }
const roleplaySessions = new Map();

const CHARACTERS = {
    'Joker': '🤡 جوکر (شوالیه تاریکی)',
    'Tyler Durden': '👊 تایلر دردن (باشگاه مشت‌زنی)',
    'Gandalf': '🧙‍♂️ گاندالف (ارباب حلقه‌ها)',
    'Walter White': '⚗️ والتر وایت (بریکینگ بد)',
    'Harley Quinn': '🤪 هارلی کویین'
};

/**
 * Handle /roleplay command
 */
export async function handleRoleplayCommand(bot, msg) {
    const chatId = msg.chat.id;

    let text = `🎭 *چالش مکالمه زنده (Roleplay)*\n\n` +
        `در این چالش، با یکی از شخصیت‌های معروف سینما وارد مکالمه می‌شوی. \n` +
        `باید سعی کنی مثل یک بازیگر جواب بدی!\n\n` +
        `یکی را انتخاب کن:`;

    const keyboard = [];
    let row = [];
    Object.entries(CHARACTERS).forEach(([key, label]) => {
        row.push({ text: label, callback_data: `start_rp:${key}` });
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

/**
 * Start a roleplay session
 */
export async function startRoleplay(bot, query, characterKey) {
    const chatId = query.message.chat.id;

    if (!CHARACTERS[characterKey]) return;

    // Initialize session
    roleplaySessions.set(chatId, {
        persona: characterKey,
        history: [] // We will store last few turns
    });

    const intro = await getAIResponse(characterKey, "Start a conversation with me. Set the scene and ask me a question.", []);

    await bot.sendMessage(chatId, `🎭 *Roleplay started with ${characterKey}*\n\n${intro}`, {
        reply_markup: { force_reply: true } // Force reply to make it easy to answer
    });

    // Save to history
    roleplaySessions.get(chatId).history.push({ role: 'model', parts: [{ text: intro }] });
}

/**
 * Handle user response in roleplay
 */
export async function handleRoleplayResponse(bot, msg) {
    const chatId = msg.chat.id;
    const session = roleplaySessions.get(chatId);

    if (!session) return false; // Not in roleplay

    // Exit command
    if (msg.text === '/exit' || msg.text === 'پایان') {
        roleplaySessions.delete(chatId);
        await bot.sendMessage(chatId, '🎬 *کات!* مکالمه پایان یافت.');
        return true;
    }

    const userInput = msg.text || (msg.voice ? "[User sent Audio]" : "[Media]");

    // Add user input to history
    session.history.push({ role: 'user', parts: [{ text: userInput }] });

    // Typing indication
    await bot.sendChatAction(chatId, 'typing');

    // Get AI response
    const prompt = msg.voice ?
        `User sent a voice message. Respond to it as ${session.persona}.` :
        userInput;

    const response = await getAIResponse(session.persona, prompt, session.history);

    // Add AI response to history
    session.history.push({ role: 'model', parts: [{ text: response }] });

    // Send back
    await bot.sendMessage(chatId, response);

    return true;
}

/**
 * Helper to get AI response for roleplay
 */
async function getAIResponse(persona, input, history) {
    // We reuse aiLearning service but normally we'd add a dedicated method.
    // For now, let's use a direct call if possible or add a method to aiLearning.
    // Let's add a `chatWithPersona` method to aiLearning.js next.
    return await ai.chatWithPersona(persona, input, history);
}

export default {
    handleRoleplayCommand,
    startRoleplay,
    handleRoleplayResponse
};
