import pdf from 'pdf-parse';
import mammoth from 'mammoth';

/**
 * Extract text from uploaded document
 * @param {Buffer} fileBuffer - The file buffer
 * @param {string} fileType - MIME type of the file
 * @returns {Promise<string>} Extracted text content
 */
export async function extractTextFromFile(fileBuffer, fileType) {
  try {
    if (fileType === 'application/pdf') {
      const data = await pdf(fileBuffer);
      return data.text;
    }
    
    if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
        fileType === 'application/msword') {
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      return result.value;
    }
    
    if (fileType === 'text/plain') {
      return fileBuffer.toString('utf8');
    }
    
    throw new Error(`Unsupported file type: ${fileType}`);
  } catch (error) {
    throw new Error(`Failed to extract text: ${error.message}`);
  }
}
