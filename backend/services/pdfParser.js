/**
 * PDF Menu Parser Service
 * Extracts menu content from PDF files and converts to structured data
 */

const pdf = require('pdf-parse');
const axios = require('axios');

class PDFParser {
  constructor() {
    this.maxPdfSize = 50 * 1024 * 1024; // 50MB limit - increased for larger restaurant menus
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
        timeout: 120000,
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
   * Parse menu from extracted text (main parsing coordinator)
   * @param {string} text - Extracted text from PDF
   * @param {Object} options - Parsing options
   * @returns {Promise<Object>} Parsed menu data
   */
  async parseMenuFromText(text, options = {}) {
    try {
      // Clean the text first
      const cleanedText = this.cleanExtractedText(text);
      
      // Pre-filter text to extract only likely menu content
      console.log(`🔍 Pre-filtering text to extract menu content...`);
      const menuFilteredText = this.preFilterMenuContent(cleanedText);
      
      console.log(`📊 Text filtering: ${cleanedText.length} → ${menuFilteredText.length} chars (${Math.round((1 - menuFilteredText.length/cleanedText.length) * 100)}% reduction)`);
      
      // Try AI parsing on the filtered content
      console.log(`🧠 Parsing menu items from filtered text...`);
      const result = await this.parseMenuWithAI(menuFilteredText, options);
      
      if (result && result.menuItems && result.menuItems.length > 0) {
        return result;
      }
      
      // Fallback to pattern parsing if AI fails
      console.log(`🔄 AI parsing returned no items, falling back to pattern parsing...`);
      return this.parseMenuWithPatterns(cleanedText, options);
      
    } catch (error) {
      console.warn(`⚠️ parseMenuFromText error, using pattern parsing:`, error.message);
      return this.parseMenuWithPatterns(text, options);
    }
  }

  /**
   * Parse menu items from extracted text using AI with batching for large texts
   * @param {string} text - Extracted PDF text
   * @param {Object} options - Parsing options
   * @returns {Promise<Object>} Parsed menu data
   */
  async parseMenuWithAI(text, options = {}) {
    try {
      const { callGeminiAPI } = require('./geminiHelper');
      const apiKey = process.env.GEMINI_API_KEY;
      
      console.log(`🤖 Using AI to parse filtered menu content...`);
      console.log(`📊 Filtered text length: ${text.length} characters`);
      
      // Use much smaller chunks to avoid timeouts
      const MAX_CHUNK_SIZE = 6000; // Reduced to ensure no timeouts
      if (text.length > MAX_CHUNK_SIZE) {
        // Calculate actual chunks to provide accurate logging
        const actualChunks = this.splitTextIntoChunks(text, MAX_CHUNK_SIZE);
        console.log(`📦 Large content detected, using batching approach (${actualChunks.length} chunks)`);
        return await this.parseMenuWithBatching(text, options, actualChunks);
      }
      
      // For smaller texts, process normally
      const prompt = this.createPDFMenuParsingPrompt(text);
      const result = await callGeminiAPI(prompt, apiKey, 'PDF parsing');
      
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
   * Parse large PDF menu using batching approach
   * @param {string} text - Full PDF text
   * @param {Object} options - Parsing options
   * @param {Array} preCalculatedChunks - Pre-calculated chunks (optional)
   * @returns {Promise<Object>} Combined parsed menu data
   */
  async parseMenuWithBatching(text, options = {}, preCalculatedChunks = null) {
    try {
      const { callGeminiAPI } = require('./geminiHelper');
      const apiKey = process.env.GEMINI_API_KEY;
      
      // Use pre-calculated chunks if provided, otherwise calculate them
      const chunks = preCalculatedChunks || this.splitTextIntoChunks(text, 6000);
      
      console.log(`🔄 Processing ${chunks.length} chunks...`);
      
      const allMenuItems = [];
      const allCategories = new Set();
      let restaurantInfo = {};
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`📦 Processing chunk ${i + 1}/${chunks.length} (${chunk.length} chars)...`);
        
        try {
          const prompt = this.createPDFMenuParsingPrompt(chunk, { 
            isChunk: true, 
            chunkNumber: i + 1, 
            totalChunks: chunks.length 
          });
          
          const result = await callGeminiAPI(prompt, apiKey, `PDF parsing chunk ${i + 1}/${chunks.length}`);
          
          if (result.success) {
            const chunkData = this.parseAIMenuResponse(result.content);
            
            // Combine results
            allMenuItems.push(...chunkData.menuItems);
            chunkData.categories.forEach(cat => allCategories.add(cat));
            
            // Use restaurant info from first successful chunk
            if (Object.keys(restaurantInfo).length === 0 && chunkData.restaurantInfo) {
              restaurantInfo = chunkData.restaurantInfo;
            }
            
            console.log(`✅ Chunk ${i + 1} parsed: ${chunkData.menuItems.length} items`);
          } else {
            console.warn(`⚠️ Chunk ${i + 1} AI parsing failed, trying pattern parsing`);
            const chunkData = this.parseMenuWithPatterns(chunk, options);
            allMenuItems.push(...chunkData.menuItems);
            chunkData.categories.forEach(cat => allCategories.add(cat));
          }
          
          // Reduced delay since we're processing filtered, more relevant content
          if (i < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
          
        } catch (error) {
          console.warn(`⚠️ Error processing chunk ${i + 1}:`, error.message);
          // Continue with next chunk
        }
      }
      
      // Deduplicate items (simple name-based deduplication)
      const uniqueItems = this.deduplicateMenuItems(allMenuItems);
      
      console.log(`🎯 Batching complete: ${uniqueItems.length} unique items from ${allMenuItems.length} total`);
      
      return {
        success: true,
        menuItems: uniqueItems,
        categories: Array.from(allCategories),
        restaurantInfo: restaurantInfo,
        totalItemsFound: allMenuItems.length,
        uniqueItemsCount: uniqueItems.length,
        chunksProcessed: chunks.length
      };
      
    } catch (error) {
      console.error(`❌ Batching failed:`, error.message);
      console.log(`🔄 Falling back to pattern parsing for full text`);
      return this.parseMenuWithPatterns(text, options);
    }
  }

  /**
   * Split text into chunks for processing
   * @param {string} text - Full text
   * @param {number} maxSize - Maximum chunk size
   * @returns {Array<string>} Text chunks
   */
  splitTextIntoChunks(text, maxSize) {
    const chunks = [];
    let currentChunk = '';
    
    // Split by lines to preserve structure
    const lines = text.split('\n');
    
    console.log(`📏 Splitting ${text.length} chars into chunks (max ${maxSize} chars per chunk, ${lines.length} lines)`);
    
    for (const line of lines) {
      // If adding this line would exceed max size, start new chunk
      if (currentChunk.length + line.length + 1 > maxSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        console.log(`📦 Chunk ${chunks.length} created: ${currentChunk.length} chars`);
        currentChunk = line;
      } else {
        currentChunk += (currentChunk ? '\n' : '') + line;
      }
    }
    
    // Add final chunk
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
      console.log(`📦 Final chunk ${chunks.length} created: ${currentChunk.trim().length} chars`);
    }
    
    console.log(`✅ Text split into ${chunks.length} chunks (estimated: ${Math.ceil(text.length / maxSize)})`);
    return chunks;
  }

  /**
   * Deduplicate menu items based on name similarity
   * @param {Array} items - Array of menu items
   * @returns {Array} Deduplicated items
   */
  deduplicateMenuItems(items) {
    const seen = new Set();
    const unique = [];
    
    for (const item of items) {
      if (!item.name) continue;
      
      // Normalize name for comparison
      const normalizedName = item.name.toLowerCase().trim().replace(/[^\w\s]/g, '');
      
      if (!seen.has(normalizedName)) {
        seen.add(normalizedName);
        unique.push(item);
      }
    }
    
    return unique;
  }

  /**
   * Clean extracted text for better parsing
   * @param {string} text - Raw extracted text
   * @returns {string} Cleaned text
   */
  cleanExtractedText(text) {
    return text
      // Remove page numbers and common PDF artifacts
      .replace(/Page \d+/gi, '')
      .replace(/\d+\/\d+/g, '')
      // Clean up common formatting issues but preserve line breaks
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      // Remove multiple dots/dashes used for alignment
      .replace(/\.{3,}/g, ' ')
      .replace(/-{3,}/g, ' ')
      // Clean up excessive spaces on same line but keep line breaks
      .replace(/[ \t]+/g, ' ')
      // Remove excessive blank lines (more than 2 consecutive)
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();
  }

  /**
   * Create AI prompt for PDF menu parsing
   * @param {string} text - PDF text content
   * @returns {string} AI prompt
   */
  /**
   * Create AI prompt for PDF menu parsing
   * @param {string} text - PDF text content
   * @param {Object} options - Prompt options (for chunking)
   * @returns {string} AI prompt
   */
  createPDFMenuParsingPrompt(text, options = {}) {
    const isChunk = options.isChunk || false;
    const chunkInfo = isChunk ? `\n\nCHUNK INFO: This is chunk ${options.chunkNumber} of ${options.totalChunks} from a larger PDF.` : '';
    
    return `You are a restaurant menu parser. Extract structured menu information from this heavily pre-filtered content containing likely menu items.${chunkInfo}

FILTERED MENU CONTENT:
${text.substring(0, 8000)}${text.length > 8000 ? '\n[Content truncated...]' : ''}

EXTRACTION INSTRUCTIONS:
This content has been aggressively pre-filtered to contain mostly menu items and prices. Extract ALL food items found.

PARSING RULES:
- Look for item names followed by prices ($X.XX format)
- Extract descriptions if present
- Identify categories (appetizers, mains, etc.)
- Skip non-food content${isChunk ? '\n- IMPORTANT: Extract ALL menu items from this chunk, even partial ones' : ''}

RESPONSE FORMAT (JSON only):
{
  "menuItems": [
    {
      "name": "Item Name",
      "description": "Brief description",
      "price": "$12.95",
      "category": "appetizer|main|dessert|beverage|other"
    }
  ],
  "categories": ["category1", "category2"],
  "restaurantInfo": {"name": "Name if found"}
}

Return ONLY valid JSON.`;
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
      
      const parsed = this.parseRobustJSON(cleanContent);
      
      if (!parsed) {
        console.error(`❌ Failed to parse AI response JSON`);
        return { menuItems: [], categories: [], restaurantInfo: {} };
      }
      
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
      // Days and times
      /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
      /\d{1,2}:\d{2}\s*(am|pm)/i,
      /^(hours|phone|address|website|email|fax)/i,
      
      // Contact info
      /^(www\.|http|@)/i,
      /^\d{3}-\d{3}-\d{4}/,
      /^\(\d{3}\)\s*\d{3}-\d{4}/,
      
      // Common non-menu text
      /^page \d+/i,
      /^(copyright|all rights reserved|terms|conditions)/i,
      /^(thank you|please|welcome|location|directions)/i,
      /^(we are|we're|our|about|history|since)/i,
      
      // Pure navigation/headers
      /^(home|menu|contact|about|order|online)/i,
      /^(catering|events|private|party|book)/i,
      
      // Addresses and locations
      /^\d+\s+\w+\s+(street|st|avenue|ave|road|rd|drive|dr|lane|ln|blvd)/i,
      /^\w+,\s*\w{2}\s*\d{5}/,
      
      // Social media
      /^(facebook|twitter|instagram|yelp|google)/i,
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

  /**
   * Pre-filter text to extract only likely menu content
   * @param {string} text - Cleaned extracted text
   * @returns {string} Filtered text with only menu-relevant content
   */
  preFilterMenuContent(text) {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const menuLines = [];
    const categories = [];
    
    console.log(`🔍 Pre-filtering ${lines.length} lines...`);
    console.log(`📝 Sample lines:`, lines.slice(0, 5));
    
    let skippedShort = 0, skippedLong = 0, skippedNonMenu = 0, skippedOther = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip very short lines or very long lines (likely not menu items)
      if (line.length < 3) {
        skippedShort++;
        continue;
      }
      if (line.length > 300) {
        skippedLong++;
        continue;
      }
      
      // Skip obvious non-menu content aggressively
      if (this.isNonMenuContent(line)) {
        skippedNonMenu++;
        continue;
      }
      
      // Skip lines that are just numbers, dates, or common filler
      if (/^\d+$/.test(line) || /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(line)) {
        skippedOther++;
        continue;
      }
      if (/^(page|call|visit|located|open|hours|closed)/i.test(line)) {
        skippedOther++;
        continue;
      }
      
      // Keep category headers
      if (this.looksLikeCategory(line)) {
        categories.push(line);
        menuLines.push(line);
        continue;
      }
      
      // Keep lines that look like menu items (with prices)
      if (this.containsPrice(line)) {
        menuLines.push(line);
        continue;
      }
      
      // Keep lines with strong food indicators OR prices
      if (this.containsFoodKeywords(line) || this.looksLikeMenuItem(line)) {
        menuLines.push(line);
        continue;
      }
      
      // If we get here, the line was skipped for other reasons
      skippedOther++;
    }
    
    console.log(`📊 Pre-filtering stats: Short(${skippedShort}) Long(${skippedLong}) NonMenu(${skippedNonMenu}) Other(${skippedOther})`);
    console.log(`📊 Pre-filtering: ${lines.length} → ${menuLines.length} lines (${Math.round((1 - menuLines.length/lines.length) * 100)}% reduction)`);
    
    // Join with newlines but don't add extra context - be aggressive
    const filteredText = menuLines.join('\n');
    console.log(`📏 Final filtered text: ${filteredText.length} characters`);
    
    return filteredText;
  }

  /**
   * Check if line looks like a menu item
   * @param {string} line - Text line
   * @returns {boolean} True if looks like menu item
   */
  looksLikeMenuItem(line) {
    // Menu items typically have:
    // - Reasonable length (not too short, not too long)
    // - Mix of letters and possibly numbers/prices
    
    if (line.length < 5 || line.length > 150) return false;
    
    // Must have letters
    if (!/[a-zA-Z]/.test(line)) return false;
    
    // Skip if it's all uppercase and long (likely headers/non-menu)
    if (line === line.toUpperCase() && line.length > 25) return false;
    
    // Check for price patterns (strong indicator)
    if (this.containsPrice(line)) return true;
    
    // Check for common menu item patterns
    const menuItemPatterns = [
      /\w+\s+\w+.*\$\d+/,  // "Item Name $price"
      /\w+.*\.\.\.\.*\$?\d+/,  // "Item ... price"
      /\w+.*-.*\$?\d+/,    // "Item - description price"
      /^[A-Z][a-z]+\s+[A-Z]/,  // "Title Case Words"
      /\b(served|grilled|fried|baked|fresh|with|topped|sauce|cheese)\b/i
    ];
    
    // Match patterns OR have food keywords (not both required)
    return menuItemPatterns.some(pattern => pattern.test(line)) || 
           this.containsFoodKeywords(line);
  }

  /**
   * Check if line contains food-related keywords
   * @param {string} line - Text line
   * @returns {boolean} True if contains food keywords
   */
  containsFoodKeywords(line) {
    const foodKeywords = [
      // Cooking methods
      'grilled', 'fried', 'baked', 'roasted', 'steamed', 'sautéed', 'braised',
      // Ingredients
      'chicken', 'beef', 'pork', 'fish', 'salmon', 'shrimp', 'pasta', 'rice',
      'cheese', 'mushroom', 'onion', 'tomato', 'lettuce', 'avocado',
      // Descriptors
      'fresh', 'organic', 'local', 'seasonal', 'homemade', 'crispy', 'tender',
      // Food types
      'sandwich', 'burger', 'pizza', 'salad', 'soup', 'steak', 'wrap',
      // Common menu words
      'served', 'topped', 'with', 'sauce', 'dressing', 'side', 'choice'
    ];
    
    const lowerLine = line.toLowerCase();
    return foodKeywords.some(keyword => lowerLine.includes(keyword));
  }

  /**
   * Check if line contains price information
   * @param {string} line - Text line
   * @returns {boolean} True if contains price
   */
  containsPrice(line) {
    const pricePatterns = [
      /\$\d+\.?\d{0,2}/,     // $12.95, $12
      /\d+\.\d{2}\s*$/,      // 12.95 at end
      /\d+\s*dollars?/i,     // 12 dollars
      /\d+\s*\$\s*$/,        // 12$ at end
    ];
    
    return pricePatterns.some(pattern => pattern.test(line));
  }

  /**
   * Robust JSON parsing that handles common AI response issues
   * @param {string} jsonString - JSON string to parse
   * @returns {Object|null} Parsed object or null if failed
   */
  parseRobustJSON(jsonString) {
    try {
      // First, try standard parsing
      return JSON.parse(jsonString);
    } catch (error) {
      console.log(`[PDF JSON Parser] Standard parse failed: ${error.message}`);
      
      try {
        // Clean common JSON issues
        let cleaned = jsonString
          // Remove trailing commas before closing brackets/braces
          .replace(/,(\s*[}\]])/g, '$1')
          // Fix common quote issues
          .replace(/'/g, '"')
          // Remove comments
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/\/\/.*$/gm, '')
          // Trim whitespace
          .trim();
        
        // Try parsing the cleaned version
        return JSON.parse(cleaned);
      } catch (cleanError) {
        console.log(`[PDF JSON Parser] Cleaned parse failed: ${cleanError.message}`);
        
        try {
          // Extract just the JSON object/array part
          const jsonMatch = cleaned.match(/[\{\[][\s\S]*[\}\]]/);
          if (jsonMatch) {
            let extracted = jsonMatch[0];
            
            // Fix trailing commas in the extracted part
            extracted = extracted.replace(/,(\s*[}\]])/g, '$1');
            
            return JSON.parse(extracted);
          }
        } catch (extractError) {
          console.log(`[PDF JSON Parser] Extract parse failed: ${extractError.message}`);
        }
        
        console.error(`[PDF JSON Parser] All parsing attempts failed for: ${jsonString.substring(0, 200)}...`);
        return null;
      }
    }
  }

  /**
   * Add context lines around identified menu sections
   * @param {Array<string>} allLines - All lines from text
   * @param {Array<string>} menuLines - Already identified menu lines
   * @returns {Array<string>} Lines with added context
   */
  addContextAroundMenuSections(allLines, menuLines) {
    const contextualLines = new Set(menuLines);
    
    // For each menu line, add 1-2 lines of context if they seem relevant
    for (const menuLine of menuLines) {
      const index = allLines.indexOf(menuLine);
      if (index === -1) continue;
      
      // Add previous line if it looks relevant
      if (index > 0) {
        const prevLine = allLines[index - 1];
        if (this.isRelevantContext(prevLine)) {
          contextualLines.add(prevLine);
        }
      }
      
      // Add next line if it looks relevant
      if (index < allLines.length - 1) {
        const nextLine = allLines[index + 1];
        if (this.isRelevantContext(nextLine)) {
          contextualLines.add(nextLine);
        }
      }
    }
    
    // Return lines in original order
    return allLines.filter(line => contextualLines.has(line));
  }

  /**
   * Check if line is relevant context for menu items
   * @param {string} line - Text line
   * @returns {boolean} True if relevant context
   */
  isRelevantContext(line) {
    if (line.length < 3 || line.length > 200) return false;
    
    // Skip obvious non-menu content
    if (this.isNonMenuContent(line)) return false;
    
    // Include if it has food keywords or looks descriptive
    return this.containsFoodKeywords(line) || 
           this.looksLikeDescription(line) ||
           this.containsPrice(line);
  }

  /**
   * Check if line looks like a menu description
   * @param {string} line - Text line
   * @returns {boolean} True if looks like description
   */
  looksLikeDescription(line) {
    // Descriptions often contain certain words and structures
    const descriptionPatterns = [
      /\b(served with|topped with|includes|featuring|made with|choice of)\b/i,
      /\b(fresh|homemade|local|organic|seasonal)\b/i,
      /\([^)]+\)/,  // Text in parentheses
      /\b(and|or|with)\b.*\b(sauce|dressing|cheese|vegetables?)\b/i
    ];
    
    return descriptionPatterns.some(pattern => pattern.test(line));
  }
}

// Export singleton instance
const pdfParser = new PDFParser();
module.exports = pdfParser;
