/**
 * Media Utilities
 * Handles downloading files from Telegram for AI processing
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure temp directory exists
const TEMP_DIR = path.join(__dirname, '../temp_media');
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Downloads a file from Telegram and returns the local file path
 * @param {string} fileUrl - Full URL to the file on Telegram servers
 * @param {string} fileId - Unique file ID (used for naming)
 * @returns {Promise<string>} - Path to the downloaded file
 */
export async function downloadTelegramFile(fileUrl, fileId) {
    try {
        const response = await axios({
            method: 'GET',
            url: fileUrl,
            responseType: 'stream'
        });

        // Determine extension from URL or content-type
        let ext = path.extname(fileUrl);
        if (!ext) ext = '.bin';

        const fileName = `${fileId}${ext}`;
        const filePath = path.join(TEMP_DIR, fileName);

        const writer = fs.createWriteStream(filePath);

        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => resolve(filePath));
            writer.on('error', reject);
        });
    } catch (error) {
        console.error('Download error:', error.message);
        throw error;
    }
}

/**
 * Clean up a temporary file
 */
export function cleanupFile(filePath) {
    try {
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (error) {
        console.error('Cleanup error:', error.message);
    }
}

/**
 * Convert file to base64 for Gemini API (if needed for small files)
 */
export function fileToBase64(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    return fileBuffer.toString('base64');
}

export default {
    downloadTelegramFile,
    cleanupFile,
    fileToBase64
};
