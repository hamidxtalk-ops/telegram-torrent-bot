/**
 * Cinematic Playlist Command
 * Generates soundtrack lists for movies
 */

// Mock database of playlists
// In production, use Spotify API or scrape
const PLAYLISTS = {
    'interstellar': {
        composer: 'Hans Zimmer',
        tracks: ['Cornfield Chase', 'Dust', 'Day One', 'Stay', 'Mountains'],
        link: 'https://open.spotify.com/album/1jWkMAefdfNPhh726YWd7m'
    },
    'inception': {
        composer: 'Hans Zimmer',
        tracks: ['Time', 'Dream Is Collapsing', 'Mombasa', 'Old Souls'],
        link: 'https://open.spotify.com/album/1gI2k1dF4M40X2d9Bf7e0B'
    },
    'pulp fiction': {
        composer: 'Various Artists',
        tracks: ['Misirlou', 'Girl, You\'ll Be a Woman Soon', 'You Never Can Tell'],
        link: 'https://open.spotify.com/album/2rT82YYlV9UoxBYLIezkks'
    }
};

/**
 * Handle /playlist command
 */
export async function handlePlaylistCommand(bot, msg, match) {
    const chatId = msg.chat.id;
    const query = match[1] ? match[1].toLowerCase() : null;

    if (!query) {
        await bot.sendMessage(chatId, '🎹 *لطفاً نام فیلم را وارد کنید.*\nمثال: `/playlist Interstellar`', { parse_mode: 'Markdown' });
        return;
    }

    // Simple fuzzy match or check keys
    const movieKey = Object.keys(PLAYLISTS).find(k => query.includes(k));

    if (movieKey) {
        const data = PLAYLISTS[movieKey];
        let text = `🎵 *موسیقی متن فیلم ${query.toUpperCase()}*\n\n` +
            `🎼 **آهنگساز:** ${data.composer}\n\n` +
            `📀 **Tracks:**\n`;

        data.tracks.forEach((t, i) => text += `${i + 1}. ${t}\n`);

        text += `\n🎧 [گوش دادن در اسپاتیفای](${data.link})`;

        await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    } else {
        // Fallback or AI generation
        await bot.sendMessage(chatId, `❌ متاسفانه موسیقی متن "${query}" هنوز در دیتابیس نیست.\n\n_در نسخه بعدی از AI برای تولید لیست استفاده می‌کنیم._`, { parse_mode: 'Markdown' });
    }
}

export default {
    handlePlaylistCommand
};
