/**
 * Subtitle Processor Service
 * Parses SRT files and uses AI to extract difficult vocabulary
 */

import fs from 'fs';
import axi from 'axios';
import ai from './aiLearning.js';

/**
 * Parse SRT content to plain text
 */
function parseSRT(srtContent) {
    // Remove timestamps and numbers
    // Regex to match:
    // 1
    // 00:00:12,345 --> 00:00:15,678
    // Dialogue...

    return srtContent
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/^\d+$/gm, '') // Remove sequence numbers
        .replace(/^[\d:,]+ --> [\d:,]+$/gm, '') // Remove timestamps
        .replace(/<[^>]*>/g, '') // Remove HTML tags like <i>
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join(' '); // Join into one big text blob
}

/**
 * Extract vocabulary from subtitle context
 * Returns CSV content
 */
export async function processSubtitleToFlashcards(filePath, movieTitle) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const fullText = parseSRT(content);

        // We can't send the whole movie to Gemini in one go (token limits).
        // Let's take the first 5000 characters as a sample or chunk it.
        // For this prototype, we'll process a significant chunk.
        const textSample = fullText.substring(0, 10000);

        // Use AI to extract words
        // We'll reuse the AI service endpoint logic but with a custom prompt here
        // forcing it to return a clean JSON list.

        // Note: interacting with aiLearning's endpoint directly if exported or duplicating logic.
        // aiLearning.js doesn't export the raw axios call easily without a wrapper.
        // Let's assume we add a method to aiLearning for "extractVocabFromText".
        // Or we just implement it here using the key from aiLearning (or process.env).

        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        const GEMINI_MODEL = 'gemini-2.0-flash';
        const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

        const prompt = `
        Analyze the following movie transcript from "${movieTitle}".
        Extract 20 difficult/advanced English words (B2/C1 level) that are useful for learners.
        
        For each word, provide:
        1. The Word
        2. A simple definition
        3. A short example sentence from the context (if possible) or a generic one.
        
        RETURN JSON ONLY:
        [
            { "word": "...", "definition": "...", "context": "..." },
            ...
        ]
        
        TRANSCRIPT:
        ${textSample}
        `;

        const response = await axi.post(GEMINI_ENDPOINT, {
            contents: [{ parts: [{ text: prompt }] }]
        });

        const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        const cleanJson = text.replace(/```json|```/g, '').trim();
        const vocabList = JSON.parse(cleanJson);

        // Convert to CSV
        let csvContent = 'Front,Back,Context,Source\n';
        vocabList.forEach(v => {
            csvContent += `"${v.word}","${v.definition}","${v.context}","${movieTitle}"\n`;
        });

        return csvContent;

    } catch (error) {
        console.error('SRT Processing Error:', error);
        return null; // or throw
    }
}

export default {
    processSubtitleToFlashcards
};
