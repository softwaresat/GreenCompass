/**
 * PDF Menu Parser Service
 * Extracts menu content from PDF files and converts to structured data
 */

const pdf = require('pdf-parse');
const axios = require('axios');

class PDFParser {
  constructor() {
    this.maxPdfSize = 10 * 1024 * 1024; // 10MB limit
  }

  /**
   * Parse a PDF menu from URL
   * @param {string} pdfUrl - URL of the PDF file
   * @param {Object} options - Parsing options
   * @returns {Promise<Object>} Parsed menu data
   */
  async parsePDFMenu(pdfUrl, options = {}) {
    const startTime = Date.now();
    
    try {
      console.log(`📄 Starting PDF menu parsing for: ${pdfUrl}`);
      
      // Download PDF
      const pdfBuffer = await this.downloadPDF(pdfUrl);
      
      // Extract text from PDF
      const extractedText = await this.extractTextFromPDF(pdfBuffer);
      
      // Parse menu items from text
      const menuData = await this.parseMenuFromText(extractedText, options);
      
      const totalTime = Date.now() - startTime;
      
      return {
        success: true,
        url: pdfUrl,
        extractionTime: totalTime,
        discoveryMethod: 'pdf-parsing',
        menuPageUrl: pdfUrl,
        ...menuData,
        rawText: extractedText.substring(0, 5000) // Keep first 5000 chars for debugging
      };
      
    } catch (error) {
      console.error(`❌ PDF parsing failed for ${pdfUrl}:`, error.message);
      
      return {
        success: false,
        url: pdfUrl,
        error: error.message,
        extractionTime: Date.now() - startTime,
        discoveryMethod: 'pdf-parsing-failed',
        menuItems: [],
        categories: [],
        restaurantInfo: {}
      };
    }
  }

  /**
   * Download PDF from URL
   * @param {string} url - PDF URL
   * @returns {Promise<Buffer>} PDF buffer
   */
  async downloadPDF(url) {
    try {
      console.log(`⬇️ Downloading PDF from: ${url}`);
      
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000,
        maxContentLength: this.maxPdfSize,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
        }
      });
      
      const buffer = Buffer.from(response.data);
      console.log(`📥 Downloaded PDF: ${buffer.length} bytes`);
      
      if (buffer.length > this.maxPdfSize) {
        throw new Error(`PDF file too large: ${buffer.length} bytes (max: ${this.maxPdfSize})`);
      }
      
      return buffer;
      
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        throw new Error('PDF download timeout - file may be too large or server too slow');
      } else if (error.response?.status === 404) {
        throw new Error('PDF not found (404) - the menu link may be outdated');
      } else if (error.response?.status === 403) {
        throw new Error('Access denied to PDF - the restaurant may have restricted access');
      } else {
        throw new Error(`Failed to download PDF: ${error.message}`);
      }
    }
  }

  /**
   * Extract text from PDF buffer
   * @param {Buffer} pdfBuffer - PDF file buffer
   * @returns {Promise<string>} Extracted text
   */
  async extractTextFromPDF(pdfBuffer) {
    try {
      console.log(`🔍 Extracting text from PDF...`);
      
      const data = await pdf(pdfBuffer, {
        // PDF parsing options
        normalizeWhitespace: true,
        disableCombineTextItems: false
      });
      
      const extractedText = data.text;
      console.log(`📝 Extracted ${extractedText.length} characters from PDF`);
      console.log(`📄 PDF has ${data.numpages} pages`);
      
      if (!extractedText || extractedText.trim().length < 50) {
        throw new Error('PDF contains no readable text or may be image-based');
      }
      
      return extractedText;
      
    } catch (error) {
      if (error.message.includes('Invalid PDF')) {
        throw new Error('Invalid PDF file format');
      } else if (error.message.includes('Encrypted')) {
        throw new Error('PDF is password protected and cannot be read');
      } else {
        throw new Error(`Failed to extract text from PDF: ${error.message}`);
      }
    }
  }

  /**
   * Parse menu items from extracted text
   * @param {string} text - Extracted PDF text
   * @param {Object} options - Parsing options
   * @returns {Promise<Object>} Parsed menu data
   */
  async parseMenuFromText(text, options = {}) {
    try {
      console.log(`🧠 Parsing menu items from extracted text...`);
      
      // Clean up the text
      const cleanText = this.cleanExtractedText(text);
      
      // Use AI to parse the menu if available
      if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here') {
        return await this.parseMenuWithAI(cleanText, options);
      } else {
        // Fallback to pattern-based parsing
        return this.parseMenuWithPatterns(cleanText, options);
      }
      
    } catch (error) {
      console.error(`❌ Menu parsing failed:`, error.message);
      throw error;
    }
  }

  /**
   * Clean extracted text for better parsing
   * @param {string} text - Raw extracted text
   * @returns {string} Cleaned text
   */
  cleanExtractedText(text) {
    return text
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Remove page numbers and common PDF artifacts
      .replace(/Page \d+/gi, '')
      .replace(/\d+\/\d+/g, '')
      // Clean up common formatting issues
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      // Remove multiple dots/dashes used for alignment
      .replace(/\.{3,}/g, ' ')
      .replace(/-{3,}/g, ' ')
      .trim();
  }

  /**
   * Parse menu using AI (Gemini)
   * @param {string} text - Cleaned text
   * @param {Object} options - Options
   * @returns {Promise<Object>} Parsed menu data
   */
  async parseMenuWithAI(text, options = {}) {
    try {
      const { callGeminiAPI } = require('./geminiHelper');
      
      const prompt = this.createPDFMenuParsingPrompt(text);
      const apiKey = process.env.GEMINI_API_KEY;
      
      console.log(`🤖 Using AI to parse PDF menu content...`);
      const result = await callGeminiAPI(prompt, apiKey);
      
      if (result.success) {
        const parsedData = this.parseAIMenuResponse(result.content);
        console.log(`✅ AI parsed ${parsedData.menuItems.length} menu items`);
        return parsedData;
      } else {
        console.warn(`⚠️ AI parsing failed, falling back to pattern parsing`);
        return this.parseMenuWithPatterns(text, options);
      }
      
    } catch (error) {
      console.warn(`⚠️ AI parsing error, falling back to pattern parsing:`, error.message);
      return this.parseMenuWithPatterns(text, options);
    }
  }

  /**
   * Create AI prompt for PDF menu parsing
   * @param {string} text - PDF text content
   * @returns {string} AI prompt
   */
  createPDFMenuParsingPrompt(text) {
    return `You are a restaurant menu parser. Extract structured menu information from this PDF text content.

PDF CONTENT:
${text.substring(0, 8000)}

EXTRACT THE FOLLOWING:
1. Menu items with names, descriptions, and prices
2. Categories/sections (appetizers, mains, desserts, drinks, etc.)
3. Restaurant information if available

PARSING RULES:
- Look for food item names followed by descriptions and/or prices
- Prices are usually in formats like: $12.95, $12, 12.95, etc.
- Categories are usually headers or section titles
- Items are often separated by line breaks or special formatting
- Some menus use dots or dashes to separate names from prices
- Ignore headers, footers, contact info, and non-menu content

RESPONSE FORMAT (JSON):
{
  "menuItems": [
    {
      "name": "Item Name",
      "description": "Description if available",
      "price": "$12.95",
      "category": "appetizer|main|dessert|beverage|other"
    }
  ],
  "categories": ["appetizers", "mains", "desserts"],
  "restaurantInfo": {
    "name": "Restaurant Name if found",
    "phone": "Phone if found",
    "address": "Address if found"
  }
}

Please respond ONLY with valid JSON.`;
  }

  /**
   * Parse AI response for menu data
   * @param {string} content - AI response content
   * @returns {Object} Parsed menu data
   */
  parseAIMenuResponse(content) {
    try {
      // Clean up AI response
      let cleanContent = content.replace(/```json\s*|\s*```/g, '').trim();
      
      // Find JSON in response
      const jsonStart = cleanContent.indexOf('{');
      const jsonEnd = cleanContent.lastIndexOf('}') + 1;
      
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        cleanContent = cleanContent.substring(jsonStart, jsonEnd);
      }
      
      const parsed = JSON.parse(cleanContent);
      
      return {
        menuItems: Array.isArray(parsed.menuItems) ? parsed.menuItems : [],
        categories: Array.isArray(parsed.categories) ? parsed.categories : [],
        restaurantInfo: parsed.restaurantInfo || {}
      };
      
    } catch (error) {
      console.error(`❌ Failed to parse AI response:`, error.message);
      return { menuItems: [], categories: [], restaurantInfo: {} };
    }
  }

  /**
   * Parse menu using pattern matching (fallback method)
   * @param {string} text - Cleaned text
   * @param {Object} options - Options
   * @returns {Object} Parsed menu data
   */
  parseMenuWithPatterns(text, options = {}) {
    console.log(`🔍 Using pattern-based parsing as fallback...`);
    
    const menuItems = [];
    const categories = [];
    
    // Split text into lines
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    let currentCategory = 'other';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip very short lines or obvious non-menu content
      if (line.length < 3 || this.isNonMenuContent(line)) {
        continue;
      }
      
      // Check if this line is a category/section header
      if (this.looksLikeCategory(line)) {
        currentCategory = this.normalizeCategory(line);
        if (!categories.includes(currentCategory)) {
          categories.push(currentCategory);
        }
        continue;
      }
      
      // Try to extract menu item from this line
      const item = this.extractMenuItem(line, currentCategory);
      if (item) {
        menuItems.push(item);
      }
    }
    
    console.log(`📋 Pattern parsing found ${menuItems.length} items in ${categories.length} categories`);
    
    return {
      menuItems,
      categories,
      restaurantInfo: this.extractRestaurantInfo(text)
    };
  }

  /**
   * Check if line contains non-menu content
   * @param {string} line - Text line
   * @returns {boolean} True if non-menu content
   */
  isNonMenuContent(line) {
    const nonMenuPatterns = [
      /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
      /^(hours|phone|address|website|email)/i,
      /^(www\.|http|@)/i,
      /^\d{3}-\d{3}-\d{4}/,
      /^page \d+/i
    ];
    
    return nonMenuPatterns.some(pattern => pattern.test(line));
  }

  /**
   * Check if line looks like a category header
   * @param {string} line - Text line
   * @returns {boolean} True if looks like category
   */
  looksLikeCategory(line) {
    // Categories are usually short, uppercase, or common menu section names
    const categoryPatterns = [
      /^[A-Z\s]{3,20}$/,
      /^(appetizers?|starters?|salads?|soups?|mains?|entrees?|entretées?|desserts?|beverages?|drinks?|wines?|beers?|cocktails?)/i,
      /^(breakfast|lunch|dinner|brunch)/i,
      /^(pizza|pasta|burgers?|sandwiches?|wraps?)/i
    ];
    
    return categoryPatterns.some(pattern => pattern.test(line.trim())) && line.length < 30;
  }

  /**
   * Normalize category name
   * @param {string} categoryText - Raw category text
   * @returns {string} Normalized category
   */
  normalizeCategory(categoryText) {
    const text = categoryText.toLowerCase().trim();
    
    if (/appetizer|starter/.test(text)) return 'appetizer';
    if (/main|entree|entrée/.test(text)) return 'main';
    if (/dessert|sweet/.test(text)) return 'dessert';
    if (/drink|beverage|cocktail|wine|beer/.test(text)) return 'beverage';
    if (/salad/.test(text)) return 'salad';
    if (/soup/.test(text)) return 'soup';
    if (/side/.test(text)) return 'side';
    
    return 'other';
  }

  /**
   * Extract menu item from a line
   * @param {string} line - Text line
   * @param {string} category - Current category
   * @returns {Object|null} Menu item or null
   */
  extractMenuItem(line, category) {
    // Common patterns for menu items:
    // "Item Name - Description $12.95"
    // "Item Name $12.95"
    // "Item Name ......... $12.95"
    // "Item Name Description 12.95"
    
    const pricePattern = /\$?\d+\.?\d{0,2}$/;
    const price = line.match(pricePattern);
    
    if (price) {
      // Found a price, extract name and description
      const priceText = price[0];
      const beforePrice = line.substring(0, line.lastIndexOf(priceText)).trim();
      
      // Clean up the text before price
      const cleaned = beforePrice
        .replace(/\.{3,}/g, ' ')
        .replace(/-{2,}/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (cleaned.length > 2) {
        // Try to split name and description
        const parts = cleaned.split(/\s-\s|\s\|\s/);
        const name = parts[0].trim();
        const description = parts.slice(1).join(' ').trim();
        
        return {
          name,
          description: description || '',
          price: priceText.startsWith('$') ? priceText : `$${priceText}`,
          category
        };
      }
    } else if (line.length > 10 && line.length < 100) {
      // No price found, but might be a menu item without price
      const cleaned = line.replace(/\.{3,}/g, ' ').replace(/\s+/g, ' ').trim();
      
      // Basic check if it looks like a food item
      if (this.looksLikeFoodItem(cleaned)) {
        return {
          name: cleaned,
          description: '',
          price: '',
          category
        };
      }
    }
    
    return null;
  }

  /**
   * Check if text looks like a food item
   * @param {string} text - Text to check
   * @returns {boolean} True if looks like food
   */
  looksLikeFoodItem(text) {
    // Avoid obvious non-food items
    const nonFoodPatterns = [
      /^(we|our|all|the|this|that|please|thank|call|visit)/i,
      /\d{3}-\d{3}-\d{4}/,
      /www\.|\.com|\.net/,
      /^[A-Z\s]+$/
    ];
    
    return !nonFoodPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Extract restaurant information from text
   * @param {string} text - Full PDF text
   * @returns {Object} Restaurant info
   */
  extractRestaurantInfo(text) {
    const info = {};
    
    // Extract phone number
    const phoneMatch = text.match(/(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})/);
    if (phoneMatch) {
      info.phone = phoneMatch[1];
    }
    
    // Extract website
    const websiteMatch = text.match(/(www\.[^\s]+|https?:\/\/[^\s]+)/i);
    if (websiteMatch) {
      info.website = websiteMatch[1];
    }
    
    // Try to extract restaurant name (often at the beginning)
    const lines = text.split('\n').slice(0, 10);
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length > 5 && trimmed.length < 50 && /^[A-Za-z\s&']+$/.test(trimmed)) {
        info.name = trimmed;
        break;
      }
    }
    
    return info;
  }
}

// Export singleton instance
const pdfParser = new PDFParser();
module.exports = pdfParser;
