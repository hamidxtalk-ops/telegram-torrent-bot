/**
 * SubDL API Service
 * Provides Persian/Farsi subtitles for movies
 */

import axios from 'axios';

const SUBDL_API = 'https://api.subdl.com/auto';
const SUBDL_DOWNLOAD = 'https://dl.subdl.com';

const client = axios.create({
    timeout: 10000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
    }
});

/**
 * Search for Persian subtitles by movie name
 */
export async function searchSubtitles(movieName, year = null) {
    try {
        let query = movieName;
        if (year) query += ` ${year}`;

        console.log(`🔍 Searching subtitles for: ${query}`);

        const response = await client.get(SUBDL_API, {
            params: {
                query: query,
                languages: 'FA'  // Farsi/Persian
            }
        });

        if (response.data && response.data.subtitles) {
            const subs = response.data.subtitles
                .filter(sub => sub.lang === 'FA' || sub.language === 'Farsi')
                .slice(0, 5)
                .map(sub => ({
                    name: sub.release_name || sub.name,
                    language: 'فارسی',
                    author: sub.author || 'ناشناس',
                    url: sub.url || `${SUBDL_DOWNLOAD}${sub.download_url || sub.subtitlePage}`,
                    downloads: sub.downloads || 0
                }));

            console.log(`✅ Found ${subs.length} Persian subtitles`);
            return subs;
        }

        return [];
    } catch (error) {
        console.error('Subtitle search error:', error.message);
        return [];
    }
}

/**
 * Get subtitle download link for a movie
 */
export async function getSubtitleLink(movieTitle, year = null) {
    const subs = await searchSubtitles(movieTitle, year);

    if (subs.length > 0) {
        return {
            found: true,
            subtitle: subs[0],
            allSubs: subs
        };
    }

    return { found: false };
}

/**
 * Format subtitle info for Telegram message
 */
export function formatSubtitleMessage(subs) {
    if (!subs || subs.length === 0) {
        return '📝 _زیرنویس فارسی یافت نشد_';
    }

    let msg = '📝 *زیرنویس فارسی:*\n';
    subs.slice(0, 3).forEach((sub, i) => {
        msg += `${i + 1}. [${sub.name.substring(0, 40)}](${sub.url})\n`;
    });

    return msg;
}

export default {
    searchSubtitles,
    getSubtitleLink,
    formatSubtitleMessage
};
