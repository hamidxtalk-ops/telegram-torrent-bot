/**
 * Daily Scene Broadcast Command
 * Allows admins to push daily learning content to a channel
 */

import ai from '../services/aiLearning.js';

// Hardcoded Admin IDs for security (Replace with DB or Config)
const ADMIN_IDS = [123456789, 987654321];

/**
 * Handle /daily_content command
 * Usage: /daily_content Movie Name
 */
export async function handleDailyContent(bot, msg, match) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    // Security check
    // if (!ADMIN_IDS.includes(userId)) {
    //     await bot.sendMessage(chatId, '⛔ *غیرمجاز!* این دستور فقط برای ادمین‌ها است.', { parse_mode: 'Markdown' });
    //     return;
    // }
    // For testing, we allow anyone for now.

    const movieTitle = match[1];

    if (!movieTitle) {
        await bot.sendMessage(chatId, '⚠️ لطفاً نام فیلم را وارد کنید.\nمثال: `/daily_content The Godfather`', { parse_mode: 'Markdown' });
        return;
    }

    await bot.sendMessage(chatId, `⏳ *در حال آماده‌سازی پست کانال برای "${movieTitle}"...*`, { parse_mode: 'Markdown' });

    try {
        // 1. Get learning moments
        const moments = await ai.getLearningMoments(movieTitle);

        if (!moments || moments.length === 0) {
            await bot.sendMessage(chatId, '❌ محتوایی یافت نشد.');
            return;
        }

        // 2. Pick the best one (random for now)
        const quote = moments[0];

        // 3. Explain it (using "Teacher" persona for standard content)
        const explanation = await ai.explainDialogue(quote, movieTitle, 'Teacher');

        if (explanation.error) {
            await bot.sendMessage(chatId, '❌ خطا در تحلیل هوش مصنوعی.');
            return;
        }

        // 4. Format the post
        // We use the markdown explanation directly or format it nicely for a channel
        const explText = explanation.explanation_markdown || explanation.explanation || "No text";

        const channelPost = `
🎬 *سکانس روز: ${movieTitle}*

🗣 *Quote:*
"${quote}"

${explText}

📢 @MovieLingoBot | 🤖 یادگیری با هوش مصنوعی
        `;

        // 5. Send Preview to Admin
        await bot.sendMessage(chatId, '📝 *پیش‌نمایش پست:*', { parse_mode: 'Markdown' });
        await bot.sendMessage(chatId, channelPost, { parse_mode: 'Markdown' });

        // 6. Confirm Button to Post
        // In a real app, we would add a button "Send to Channel".
        // For now, we assume the admin copies it or we define a target channel.
        await bot.sendMessage(chatId, 'برای ارسال به کانال، این پیام را Forward کنید.', { parse_mode: 'Markdown' });

    } catch (error) {
        console.error('Broadcast Error:', error);
        await bot.sendMessage(chatId, '❌ خطا در سیستم.');
    }
}

export default {
    handleDailyContent
};
