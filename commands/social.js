/**
 * Social & Marketplace Commands
 * Handles /wallet, /market, /sell, /buy
 */

import db from '../database/sqlite.js';

/**
 * Handle /wallet
 */
export async function handleWallet(bot, msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const coins = db.getCoins(userId);

    const text = `🍿 *کیف پول شما*
    
💰 موجودی: **${coins} Popcorn**

_با یادگیری لغات و شرکت در مسابقات، پاپ‌کورن بیشتری جمع کنید!_`;

    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
}

/**
 * Handle /market (List items)
 */
export async function handleMarket(bot, msg) {
    const chatId = msg.chat.id;
    const listings = db.getListings();

    if (listings.length === 0) {
        await bot.sendMessage(chatId, '🏪 *بازارچه خالی است!* \nاولین نفری باشید که چیزی برای فروش می‌گذارد.\n\nاستفاده: `/sell [قیمت] [عنوان]`', { parse_mode: 'Markdown' });
        return;
    }

    let text = '🏪 **Popcorn Bazaar**\n\n';
    listings.forEach(item => {
        text += `🆔 \`${item.id}\` | **${item.title}**\n`;
        text += `👤 ${item.seller_name} | 💰 ${item.price} 🍿\n`;
        text += `📄 ${item.description || 'بدون توضیحات'}\n`;
        text += `🛒 خرید: \`/buy ${item.id}\`\n\n`;
    });

    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
}

/**
 * Handle /sell [price] [title]
 */
export async function handleSell(bot, msg, match) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const input = match[1]; // "50 My List"

    if (!input) {
        await bot.sendMessage(chatId, '⚠️ فرمت صحیح: `/sell [قیمت] [عنوان]`\nمثال: `/sell 50 لیست اصطلاحات جوکر`', { parse_mode: 'Markdown' });
        return;
    }

    const parts = input.split(' ');
    const price = parseInt(parts[0]);
    const title = parts.slice(1).join(' ');

    if (isNaN(price) || !title) {
        await bot.sendMessage(chatId, '⚠️ قیمت باید عدد باشد.');
        return;
    }

    // Interactive: Ask for content
    await bot.sendMessage(chatId, `📝 **محتوای "${title}" را بفرستید.**\n\nمی‌تواند متن، عکس یا فایل باشد. (فعلاً فقط متن)`, { parse_mode: 'Markdown' });

    // Save state (in memory for simplicity)
    sellSession.set(userId, { title, price, step: 'waiting_content' });
}

// Simple in-memory session for selling
const sellSession = new Map();

export async function handleSellResponse(bot, msg) {
    const userId = msg.from.id;
    const chatId = msg.chat.id;

    if (!sellSession.has(userId)) return false;

    const session = sellSession.get(userId);
    const content = msg.text; // Assume text for now

    db.createListing(userId, session.title, 'Created by User', session.price, content);

    sellSession.delete(userId);
    await bot.sendMessage(chatId, '✅ **آگهی شما ثبت شد!**\nدر `/market` قابل مشاهده است.', { parse_mode: 'Markdown' });
    return true;
}

/**
 * Handle /buy [id]
 */
export async function handleBuy(bot, msg, match) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const listingId = parseInt(match[1]);

    if (!listingId) return;

    // In a real app, we check listing exists, check balance, deduct coins, transfer content.
    // For prototype:
    const coins = db.getCoins(userId);
    // Mock price check (assuming simple flow)
    const listing = db.getListings().find(l => l.id === listingId);

    if (!listing) {
        await bot.sendMessage(chatId, '❌ آیتم یافت نشد.');
        return;
    }

    if (coins < listing.price) {
        await bot.sendMessage(chatId, `❌ **پاپ‌کورن کافی ندارید!**\nموجودی: ${coins} | قیمت: ${listing.price}`);
        return;
    }

    // Transaction
    db.addCoins(userId, -listing.price);
    db.addCoins(listing.seller_id, listing.price);

    // Deliver content
    let content = "محتوا یافت نشد";
    try { content = JSON.parse(listing.content); } catch (e) { content = listing.content; }

    await bot.sendMessage(chatId, `✅ **خرید موفق!**\n\n📦 **محتوا:**\n${content}`, { parse_mode: 'Markdown' });

    // Notify seller
    try {
        await bot.sendMessage(listing.seller_id, `💰 **فروش موفق!**\nآیتم "${listing.title}" فروخته شد. +${listing.price} 🍿`);
    } catch (e) { }
}

export default {
    handleWallet,
    handleMarket,
    handleSell,
    handleSellResponse,
    handleBuy
};
