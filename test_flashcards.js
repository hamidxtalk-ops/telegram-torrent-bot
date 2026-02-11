/**
 * Verification Script: Flashcard System
 */

import db from './database/sqlite.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testFlashcards() {
    console.log('🧪 Starting Flashcard System Test...');

    // Initialize Database
    await db.init();

    const userId = 123456789; // Dummy User ID
    const word = 'Serendipity';
    const movie = 'Serendipity (2001)';

    // 1. Test Add Word
    console.log(`\n📚 Adding word: "${word}" from "${movie}"...`);
    db.addWord(userId, word, 'Finding something good without looking for it', 'It was pure serendipity.', movie);

    // 2. Test Get Words
    console.log('📖 Retrieving vocabulary...');
    const vocab = db.getVocabulary(userId);
    console.log('Vocab List:', vocab);

    if (vocab.some(v => v.word === word)) {
        console.log('✅ Word successfully added!');
    } else {
        console.error('❌ Word not found in DB!');
    }

    // 3. Test Export Logic (Simulation)
    console.log('\n📤 Simulating Anki CSV Export...');
    let csvContent = 'Front,Back,Context\n';
    vocab.forEach(w => {
        const front = w.word.replace(/"/g, '""');
        const back = (w.definition || 'Definition').replace(/"/g, '""');
        const context = `Source: ${w.movie_source}`.replace(/"/g, '""');
        csvContent += `"${front}","${back}","${context}"\n`;
    });
    console.log('CSV Content Preview:');
    console.log(csvContent);

    // 4. Cleanup
    console.log('\n🧹 Cleaning up test data...');
    db.removeWord(userId, word);
    const vocabAfter = db.getVocabulary(userId);
    if (!vocabAfter.some(v => v.word === word)) {
        console.log('✅ Word successfully removed!');
    } else {
        console.error('❌ Word still exists!');
    }
}

testFlashcards();
