/**
 * Subtitle Processor Service
 * Parses SRT files and uses AI to extract difficult vocabulary
 */

import fs from 'fs';
import { callGemini } from './aiLearning.js';

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
        // Note: Centralized callGemini handles keys and rotation.

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

        const response = await callGemini({
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
