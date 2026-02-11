/**
 * Cinema Battle Command
 * Simple PvP movie guessing game
 */

// Simple in-memory state for prototype
// { chatId: { isActive: true, answer: 'Inception', clue: '🦁👑' } }
const activeGames = new Map();

const GAMES = [
    { answer: 'The Lion King', clue: '🦁 👑' },
    { answer: 'Titanic', clue: '🚢 🧊' },
    { answer: 'Inception', clue: '😴 🌀 🏢' },
    { answer: 'The Matrix', clue: '💊 🕶️ 🟢' },
    { answer: 'Harry Potter', clue: '⚡ 🧙‍♂️ 👓' },
    { answer: 'Joker', clue: '🤡 🃏 😆' },
    { answer: 'Spider-Man', clue: '🕷️ 🕸️ 🔴' },
    { answer: 'Star Wars', clue: '⚔️ 🌌 🤖' }
];

/**
 * Handle /battle command
 */
export async function handleBattleCommand(bot, msg) {
    const chatId = msg.chat.id;

    if (activeGames.has(chatId)) {
        await bot.sendMessage(chatId, '⚠️ بازی در جریان است! اول قبلی را تمام کنید.');
        return;
    }

    // Pick random game
    const game = GAMES[Math.floor(Math.random() * GAMES.length)];

    activeGames.set(chatId, {
        isActive: true,
        answer: game.answer.toLowerCase(),
        startTime: Date.now()
    });

    const text = `🎮 *Cinema Battle Started!*\n\n` +
        `حدس بزنید این چه فیلمی است؟\n\n` +
        `🧩 **Clue:** ${game.clue}\n\n` +
        `اولین نفری که اسم درست را بفرستد برنده است!`;

    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
}

/**
 * Check messages for game answers
 */
export async function checkGameAnswer(bot, msg) {
    const chatId = msg.chat.id;
    const game = activeGames.get(chatId);

    if (!game || !game.isActive) return false;

    // Check match (simple fuzzy or exact)
    if (msg.text && msg.text.toLowerCase().includes(game.answer)) {
        const user = msg.from.first_name;
        const timeTaken = ((Date.now() - game.startTime) / 1000).toFixed(1);

        await bot.sendMessage(chatId, `🏆 *تبریک!* \n\n👤 **${user}** درست حدس زد!\n🎬 جواب: *${game.answer}*\n⏱ زمان: ${timeTaken} ثانیه`, { parse_mode: 'Markdown' });

        activeGames.delete(chatId);
        return true;
    }

    return false;
}

export default {
    handleBattleCommand,
    checkGameAnswer
};
