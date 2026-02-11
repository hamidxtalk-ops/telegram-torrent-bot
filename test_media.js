/**
 * Test Media Generation
 */

import { generateVoice, generateVideoNote } from './services/mediaGenerator.js';
import fs from 'fs';
import path from 'path';

async function test() {
    console.log('🧪 Testing Media Generation...');

    // 1. Test Voice
    try {
        console.log('🎤 Generating Voice...');
        const audioPath = await generateVoice('Hello! This is your AI companion speaking.', 'en');
        console.log('✅ Voice Generated:', audioPath);

        if (fs.existsSync(audioPath)) {
            console.log('File size:', fs.statSync(audioPath).size, 'bytes');

            // 2. Test Video (requires avatar)
            console.log('\n📹 Generating Video Note...');
            const avatarPath = './assets/avatar_default.jpg';

            // Create dummy avatar if missing
            if (!fs.existsSync(avatarPath)) {
                if (!fs.existsSync('./assets')) fs.mkdirSync('./assets');
                console.log('⚠️ Creating valid dummy avatar using FFmpeg...');

                await new Promise((resolve, reject) => {
                    ffmpeg()
                        .input('color=c=red:s=320x320')
                        .inputFormat('lavfi')
                        .output(avatarPath)
                        .frames(1)
                        .on('end', resolve)
                        .on('error', reject)
                        .run();
                });
            }

            try {
                console.log('🎬 Starting FFmpeg generation with:', avatarPath);
                // Generate Video
                const videoPath = await generateVideoNote(avatarPath, audioPath);
                console.log('✅ Video Generated:', videoPath);
                if (fs.existsSync(videoPath)) {
                    console.log('Video size:', fs.statSync(videoPath).size, 'bytes');
                    // fs.unlinkSync(videoPath);
                }
            } catch (vErr) {
                console.error('❌ Video Error Details:', vErr);
                if (vErr.message) console.error('Message:', vErr.message);
            }

            // Cleanup
            fs.unlinkSync(audioPath);
            if (fs.existsSync(avatarPath) && fs.readFileSync(avatarPath).toString() === 'dummy data') {
                fs.unlinkSync(avatarPath);
            }
        }
    } catch (e) {
        console.error('❌ Error:', e);
    }
}

test();
