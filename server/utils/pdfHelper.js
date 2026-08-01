import fs from 'fs/promises';
import { PDFParse } from 'pdf-parse';

/**
 * Reads a PDF from disk and returns its full extracted text.
 * Called once at upload time; the result is stored in Document.extractedText.
 * All AI features (chat, summary, explain, flashcards, quiz) read from the DB
 * field instead of re-parsing the file on every request.
 *
 * Uses pdf-parse v2 API: new PDFParse({ data: Buffer }).getText()
 *
 * @param {string} filePath - Absolute path to the PDF file on disk.
 * @returns {Promise<string>} Extracted plain text from the PDF.
 */
const extractTextFromPDF = async (filePath) => {
  const buffer = await fs.readFile(filePath);
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  await parser.destroy();
  return result.text ?? '';
};

export { extractTextFromPDF };
