/**
 * Media Generator Service
 * Handles Text-to-Speech and Video Note generation
 */

import googleTTS from 'google-tts-api'; // ESM import might differ, check if it needs require or import
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMP_DIR = path.join(__dirname, '..', 'temp_media');

// Ensure temp dir exists
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR);
}

/**
 * Generate MP3 from Text
 * @param {string} text - Text to speak
 * @param {string} lang - Language code (en, fa, etc.)
 * @returns {Promise<string>} - Path to the generated MP3 file
 */
export async function generateVoice(text, lang = 'en') {
    try {
        // 1. Get audio URL (splitting text if too long)
        // For simplicity, we assume text < 200 chars for quick chat
        // or we take the first chunk.
        const url = googleTTS.getAudioUrl(text, {
            lang: lang,
            slow: false,
            host: 'https://translate.google.com',
        });

        // 2. Download the audio
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream',
        });

        const fileName = `voice_${Date.now()}.mp3`;
        const filePath = path.join(TEMP_DIR, fileName);

        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => resolve(filePath));
            writer.on('error', reject);
        });
    } catch (error) {
        console.error('TTS Error:', error);
        throw new Error('Failed to generate voice.');
    }
}

/**
 * Generate Video Note (Simulated)
 * @param {string} imagePath - Path to avatar image
 * @param {string} audioPath - Path to audio file
 * @returns {Promise<string>} - Path to the generated MP4 file
 */
export async function generateVideoNote(imagePath, audioPath) {
    // Output file
    const outputName = `videonote_${Date.now()}.mp4`;
    const outputPath = path.join(TEMP_DIR, outputName);

    return new Promise((resolve, reject) => {
        ffmpeg()
            .input(imagePath)
            .inputOptions(['-loop 1']) // Loop image to matching audio length
            .input(audioPath)
            // Add pulse effect (scale varies with time)
            // simple scaling: 'iw + 10*sin(2*PI*t)' ... actually complex filter needed for pulse
            // Let's use a simpler zoompan or just static for MVP reliability first, 
            // then add pulse if stable.
            // Advanced "Talking Head" Simulation
            // 1. scale=320:320:force_original_aspect_ratio=increase,crop=320:320 (Ensure square)
            // 2. zoompan (Slow "Breathing" movement): zoom in/out slightly over 5 seconds
            // 3. eq (adjust brightness slightly) to make it look less static?
            // Note: True lip-sync requires Wav2Lip (Python/GPU). 
            // Here we use a "Camera Shake/Zoom" effect to mimic energy.

            .outputOptions([
                '-c:v libx264',
                '-tune stillimage',
                '-c:a aac',
                '-b:a 192k',
                '-pix_fmt yuv420p',
                '-shortest', // End when audio ends

                // Complex Filter:
                // 1. Crop to square
                // 2. Zoompan: localized zoom to center, slow oscillation d=25*5 (5 sec)
                // Remove quotes to avoid Windows shell escaping issues
                // '-vf', `scale=320:320:force_original_aspect_ratio=increase,crop=320:320,setsar=1,zoompan=z=min(zoom+0.0015,1.1):d=125:x=iw/2-(iw/zoom/2):y=ih/2-(ih/zoom/2):s=320x320`

                // Fallback to simple reliable filter for now
                '-vf', 'scale=320:320:force_original_aspect_ratio=increase,crop=320:320,setsar=1'
            ])
            .save(outputPath)
            .on('start', (cmd) => console.log('FFmpeg Command:', cmd))
            .on('end', () => resolve(outputPath))
            .on('error', (err) => {
                console.error('FFmpeg Error:', err);
                reject(err);
            });
    });
}

export default {
    generateVoice,
    generateVideoNote
};
