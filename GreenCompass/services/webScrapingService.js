import axios from 'axios';
import { Platform } from 'react-native';

/**
 * Scrape restaurant menu from website
 * @param {string} websiteUrl - URL of the restaurant website
 * @returns {Promise<Object>} Scraped menu data
 */
export const scrapeRestaurantMenu = async (websiteUrl) => {
  try {
    console.log(`🌐 Starting smart menu scraping for: ${websiteUrl}`);
    
    // Normalize URL
    const normalizedUrl = normalizeUrl(websiteUrl);
    
    // Step 1: Find menu page URL
    const menuPageUrl = await findMenuPage(normalizedUrl);
    console.log(`📄 Menu page found: ${menuPageUrl}`);
    
    // Step 2: Scrape the menu page
    const menuData = await scrapeMenuPage(menuPageUrl);
    
    return menuData;
    
  } catch (error) {
    console.error('🚨 Error scraping restaurant menu:', error);
    return {
      success: false,
      error: error.message,
      menuItems: [],
      method: 'failed'
    };
  }
};

/**
 * Find the menu page URL by analyzing the homepage
 * @param {string} homepageUrl - Homepage URL
 * @returns {Promise<string>} Menu page URL (or homepage if not found)
 */
const findMenuPage = async (homepageUrl) => {
  try {
    console.log('🔍 Looking for menu page...');
    
    // Universal menu page patterns (focus on common terms + structure)
    const commonMenuPaths = [
      '/menu', '/food', '/dining', '/eat', '/restaurant', '/cuisine',
      '/drinks', '/beverages', '/wine', '/cocktails', '/bar',
      '/desserts', '/sweets', '/bakery', '/coffee', '/tea',
      '/breakfast', '/lunch', '/dinner', '/brunch',
      '/offerings', '/selection', '/specialties', '/signature',
      '/order', '/takeout', '/delivery', '/dine-in'
    ];
    
    const baseUrl = new URL(homepageUrl);
    
    // Try each common menu path
    for (const path of commonMenuPaths) {
      const menuUrl = new URL(path, baseUrl).href;
      console.log(`🔗 Testing menu URL: ${menuUrl}`);
      
      if (await isValidMenuPage(menuUrl)) {
        console.log(`✅ Found valid menu page: ${menuUrl}`);
        return menuUrl;
      }
    }
    
    // If no common paths work, scrape homepage to find menu links
    console.log('🔍 Scraping homepage to find menu links...');
    const homepageContent = await fetchPageContent(homepageUrl);
    
    if (homepageContent) {
      const menuLinks = extractMenuLinks(homepageContent, baseUrl);
      
      // Test each found link
      for (const link of menuLinks) {
        console.log(`🔗 Testing found menu link: ${link}`);
        if (await isValidMenuPage(link)) {
          console.log(`✅ Found valid menu page from homepage: ${link}`);
          return link;
        }
      }
    }
    
    // Fall back to homepage
    console.log('📄 No menu page found, using homepage');
    return homepageUrl;
    
  } catch (error) {
    console.error('❌ Error finding menu page:', error);
    return homepageUrl; // Fall back to homepage
  }
};

/**
 * Use AI to analyze if page content represents a menu structure
 * @param {string} textContent - Page text content
 * @returns {Promise<boolean>} True if it looks like a menu page
 */
const analyzePageStructureWithAI = async (textContent) => {
  try {
    // Simple pattern-based analysis for performance (no API call needed)
    const menuPatterns = [
      /(\w+\s+){1,5}[\d\.,]+\s*[€$£¥₹₽₩₪₫₡₦₨₱¢₵]/g, // Item name + price pattern
      /menu|carta|speisekarte|cardápio|меню|メニュー|菜单/i, // Menu word in multiple languages
      /breakfast|lunch|dinner|brunch|dessert|drink|coffee|tea/i, // Meal indicators
      /appetizer|entrée|main|starter|soup|salad|pasta|pizza/i, // Course indicators
    ];
    
    const patternMatches = menuPatterns.reduce((count, pattern) => {
      const matches = textContent.match(pattern);
      return count + (matches ? matches.length : 0);
    }, 0);
    
    // If we find multiple menu patterns, it's likely a menu page
    return patternMatches >= 3;
    
  } catch (error) {
    console.error('❌ Error in AI page analysis:', error);
    return false;
  }
};

/**
 * Check if a URL is a valid menu page
 * @param {string} url - URL to check
 * @returns {Promise<boolean>} True if it's a valid menu page
 */
const isValidMenuPage = async (url) => {
  try {
    const content = await fetchPageContent(url);
    if (!content) return false;
    
    // Check for menu-related content
    const textContent = htmlToText(content).toLowerCase();
    
    // Universal menu indicators (structure + pricing patterns)
    const universalIndicators = [
      // Universal pricing patterns (any currency)
      '$', '€', '£', '¥', '₹', '₽', '₩', '₪', '₫', '₡', '₦', '₨', '₱', '¢', '₵',
      'price', 'cost', 'free', '00', '.99', '.95', '.50'
    ];
    
    // Count universal indicators
    const priceIndicatorCount = universalIndicators.reduce((count, indicator) => {
      return count + (textContent.includes(indicator) ? 1 : 0);
    }, 0);
    
    // Use AI to determine if this is a menu page (works with any language)
    const hasMenuStructure = await analyzePageStructureWithAI(textContent);
    
    // Must have either price indicators OR AI confirmation to be considered a menu page
    const isMenuPage = priceIndicatorCount >= 2 || hasMenuStructure;
    console.log(`📊 Price indicators: ${priceIndicatorCount}, AI structure analysis: ${hasMenuStructure}, is menu page: ${isMenuPage}`);
    
    return isMenuPage;
    
  } catch (error) {
    console.error(`❌ Error checking menu page ${url}:`, error);
    return false;
  }
};

/**
 * Extract menu links from homepage content
 * @param {string} htmlContent - HTML content
 * @param {URL} baseUrl - Base URL for resolving relative links
 * @returns {Array<string>} Array of potential menu page URLs
 */
const extractMenuLinks = (htmlContent, baseUrl) => {
  const menuLinks = [];
  
  // Universal menu link patterns (works across languages)
  const menuKeywords = [
    'menu', 'food', 'eat', 'drink', 'coffee', 'tea', 'order', 'takeout', 'delivery'
  ];
  
  const linkPattern = /<a[^>]*href=["\']([^"\']*)["\'][^>]*>([^<]*)<\/a>/gi;
  let match;
  
  while ((match = linkPattern.exec(htmlContent)) !== null) {
    const href = match[1];
    const linkText = match[2].toLowerCase();
    
    // Check if link text contains menu keywords
    const hasMenuKeyword = menuKeywords.some(keyword => 
      linkText.includes(keyword) || href.toLowerCase().includes(keyword)
    );
    
    if (hasMenuKeyword) {
      try {
        const fullUrl = new URL(href, baseUrl).href;
        if (!menuLinks.includes(fullUrl)) {
          menuLinks.push(fullUrl);
        }
      } catch (e) {
        // Skip invalid URLs
      }
    }
  }
  
  console.log(`🔗 Found ${menuLinks.length} potential menu links`);
  return menuLinks;
};

/**
 * Scrape menu content from a specific page
 * @param {string} url - Menu page URL
 * @returns {Promise<Object>} Menu data
 */
const scrapeMenuPage = async (url) => {
  try {
    console.log(`🍽️ Scraping menu from: ${url}`);
    
    const htmlContent = await fetchPageContent(url);
    if (!htmlContent) {
      throw new Error('Failed to fetch menu page content');
    }
    
    return parseMenuFromHtml(htmlContent, url);
    
  } catch (error) {
    console.error('❌ Error scraping menu page:', error);
    return {
      success: false,
      error: error.message,
      menuItems: [],
      method: 'menu-page-failed'
    };
  }
};

/**
 * Fetch page content (with platform-specific approach)
 * @param {string} url - URL to fetch
 * @returns {Promise<string>} HTML content
 */
const fetchPageContent = async (url) => {
  try {
    if (Platform.OS === 'web') {
      // Web platform - use CORS proxy
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
      const response = await axios.get(proxyUrl, {
        timeout: 15000,
        headers: { 'Accept': 'application/json' }
      });
      return response.data?.contents || null;
    } else {
      // Mobile platform - direct request
      const response = await axios.get(url, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Connection': 'keep-alive'
        }
      });
      return response.data || null;
    }
  } catch (error) {
    console.error(`❌ Error fetching ${url}:`, error);
    return null;
  }
};

/**
 * Normalize website URL
 * @param {string} url - Raw URL
 * @returns {string} Normalized URL
 */
const normalizeUrl = (url) => {
  if (!url) return '';
  
  // Add https:// if missing
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  
  // Remove trailing slash
  return url.replace(/\/$/, '');
};

/**
 * Parse menu items from HTML content
 * @param {string} htmlContent - HTML content
 * @param {string} url - Source URL
 * @returns {Object} Parsed menu data
 */
const parseMenuFromHtml = (htmlContent, url) => {
  try {
    console.log('🔍 Parsing menu from HTML content...');
    console.log(`📄 HTML content length: ${htmlContent.length} characters`);
    
    // Convert HTML to text and extract menu-like content
    const textContent = htmlToText(htmlContent);
    
    // Extract menu items using various strategies
    const menuItems = [];
    
    // Strategy 1: Look for structured menu patterns
    const structuredItems = extractStructuredMenuItems(textContent);
    menuItems.push(...structuredItems);
    
    // Strategy 2: Look for price patterns
    const pricePatterns = extractItemsWithPrices(textContent);
    menuItems.push(...pricePatterns);
    
    // Strategy 3: Look for food-related terms
    const foodItems = extractFoodItems(textContent);
    menuItems.push(...foodItems);
    
    // Remove duplicates and clean up
    const uniqueItems = removeDuplicateItems(menuItems);
    const cleanedItems = uniqueItems.map(item => cleanMenuItem(item));
    
    console.log(`✅ Extracted ${cleanedItems.length} menu items from website`);
    
    return {
      success: true,
      menuItems: cleanedItems,
      totalItems: cleanedItems.length,
      method: 'smart-scraping',
      url: url
    };
    
  } catch (error) {
    console.error('❌ Error parsing menu from HTML:', error);
    return {
      success: false,
      error: 'Failed to parse menu from HTML',
      menuItems: [],
      method: 'parsing-failed'
    };
  }
};

/**
 * Convert HTML to plain text
 * @param {string} html - HTML content
 * @returns {string} Plain text
 */
const htmlToText = (html) => {
  if (!html) return '';
  
  // Remove script and style elements
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  
  // Remove HTML tags
  text = text.replace(/<[^>]*>/g, ' ');
  
  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  
  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
};

/**
 * Extract structured menu items from text
 * @param {string} text - Plain text content
 * @returns {Array} Array of menu items
 */
const extractStructuredMenuItems = (text) => {
  const items = [];
  
  // Look for menu sections
  const sectionHeaders = [
    'appetizers?', 'starters?', 'small plates?',
    'soups?', 'salads?', 'entrees?', 'main courses?',
    'pasta', 'pizza', 'burgers?', 'sandwiches?',
    'desserts?', 'drinks?', 'beverages?'
  ];
  
  const sections = [];
  for (const header of sectionHeaders) {
    const regex = new RegExp(`(${header})\\s*:?\\s*([^]*?)(?=${sectionHeaders.join('|')}|$)`, 'gi');
    const matches = text.match(regex);
    if (matches) {
      sections.push(...matches.map(match => ({
        header: header.replace('?', ''),
        content: match
      })));
    }
  }
  
  // Extract items from each section
  for (const section of sections) {
    const sectionItems = extractItemsFromSection(section.content, section.header);
    items.push(...sectionItems);
  }
  
  return items;
};

/**
 * Extract items from a menu section
 * @param {string} sectionText - Section text
 * @param {string} category - Category name
 * @returns {Array} Array of menu items
 */
const extractItemsFromSection = (sectionText, category) => {
  const items = [];
  
  // Detect currency for this section
  const detectedCurrency = detectCurrencyFromText(sectionText);
  
  // Look for items with prices (expanded currency support)
  const pricePattern = /([^.\n]+?)[\s\.]*([\$\£\€\¥\₹\₽\₩\₪\₫\₡\₦\₨\₱\¢\₵]?[\d,]+\.?\d*)/g;
  let match;
  
  while ((match = pricePattern.exec(sectionText)) !== null) {
    const name = match[1].trim();
    let price = match[2];
    
    // If price doesn't have currency symbol, add detected currency
    if (/^\d+\.?\d*$/.test(price)) {
      price = detectedCurrency + price;
    }
    
    if (name.length > 3 && name.length < 100) {
      items.push({
        name: name,
        price: price,
        category: category,
        description: ''
      });
    }
  }
  
  // If no priced items, look for simple line items
  if (items.length === 0) {
    const lines = sectionText.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length > 3 && trimmed.length < 100 && 
          !trimmed.toLowerCase().includes(category.toLowerCase())) {
        items.push({
          name: trimmed,
          price: '',
          category: category,
          description: ''
        });
      }
    }
  }
  
  return items;
};

/**
 * Detect likely currency from text content
 * @param {string} text - Plain text content
 * @returns {string} Currency symbol
 */
const detectCurrencyFromText = (text) => {
  const lowerText = text.toLowerCase();
  
  // Currency indicators by region/language
  const currencyIndicators = [
    // USD indicators
    { symbols: ['$'], keywords: ['usd', 'dollar', 'united states', 'america', 'usa'], currency: '$' },
    // EUR indicators  
    { symbols: ['€'], keywords: ['eur', 'euro', 'germany', 'france', 'italy', 'spain', 'portugal'], currency: '€' },
    // GBP indicators
    { symbols: ['£'], keywords: ['gbp', 'pound', 'sterling', 'united kingdom', 'britain', 'uk'], currency: '£' },
    // JPY indicators
    { symbols: ['¥'], keywords: ['jpy', 'yen', 'japan', 'japanese'], currency: '¥' },
    // INR indicators
    { symbols: ['₹'], keywords: ['inr', 'rupee', 'india', 'indian'], currency: '₹' },
    // RUB indicators
    { symbols: ['₽'], keywords: ['rub', 'ruble', 'russia', 'russian'], currency: '₽' },
    // KRW indicators
    { symbols: ['₩'], keywords: ['krw', 'won', 'korea', 'korean'], currency: '₩' },
    // Other currencies
    { symbols: ['₪'], keywords: ['ils', 'shekel', 'israel'], currency: '₪' },
    { symbols: ['₫'], keywords: ['vnd', 'dong', 'vietnam'], currency: '₫' },
    { symbols: ['₨'], keywords: ['pkr', 'lkr', 'rupee', 'pakistan', 'sri lanka'], currency: '₨' },
    { symbols: ['₱'], keywords: ['php', 'peso', 'philippines'], currency: '₱' },
  ];
  
  // First, check for existing currency symbols in the text
  for (const indicator of currencyIndicators) {
    for (const symbol of indicator.symbols) {
      if (lowerText.includes(symbol)) {
        return symbol;
      }
    }
  }
  
  // Then check for currency keywords
  for (const indicator of currencyIndicators) {
    for (const keyword of indicator.keywords) {
      if (lowerText.includes(keyword)) {
        return indicator.currency;
      }
    }
  }
  
  // Default to USD if no currency detected
  return '$';
};

/**
 * Extract items with price patterns
 * @param {string} text - Plain text content
 * @returns {Array} Array of menu items
 */
const extractItemsWithPrices = (text) => {
  const items = [];
  
  // Enhanced price patterns with international currencies
  const pricePatterns = [
    // Currency symbol before price
    /([^.\n]+?)[\s\.]*([\$\£\€\¥\₹\₽\₩\₪\₫\₡\₦\₨\₱\¢\₵][\d,]+\.?\d*)/g,
    // Currency symbol after price
    /([^.\n]+?)[\s\.]*([\d,]+\.?\d*[\$\£\€\¥\₹\₽\₩\₪\₫\₡\₦\₨\₱\¢\₵])/g,
    // Price with decimal (will add currency later)
    /([^.\n]+?)[\s\.]*(\d+\.\d{2})/g,
    // Price without decimal (will add currency later)
    /([^.\n]+?)[\s\.]*(\d+[\d,]*)/g
  ];
  
  // Detect likely currency from text content
  const detectedCurrency = detectCurrencyFromText(text);
  
  for (const pattern of pricePatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const name = match[1].trim();
      let price = match[2];
      
      // If price doesn't have currency symbol, add detected currency
      if (/^\d+\.?\d*$/.test(price)) {
        price = detectedCurrency + price;
      }
      
      if (name.length > 3 && name.length < 100 && 
          !name.toLowerCase().includes('phone') &&
          !name.toLowerCase().includes('address')) {
        items.push({
          name: name,
          price: price,
          category: 'General',
          description: ''
        });
      }
    }
  }
  
  return items;
};

/**
 * Extract food items without prices
 * @param {string} text - Plain text content
 * @returns {Array} Array of menu items
 */
const extractFoodItems = (text) => {
  const items = [];
  
  // Food-related keywords
  const foodKeywords = [
    'grilled', 'fried', 'baked', 'roasted', 'steamed',
    'chicken', 'beef', 'pork', 'fish', 'salmon', 'tuna',
    'pasta', 'pizza', 'salad', 'soup', 'sandwich',
    'burger', 'wrap', 'tacos', 'rice', 'noodles',
    'cheese', 'cream', 'sauce', 'dressing'
  ];
  
  const lines = text.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed.length > 5 && trimmed.length < 100) {
      const lowerLine = trimmed.toLowerCase();
      
      // Check if line contains food keywords
      const hasFood = foodKeywords.some(keyword => lowerLine.includes(keyword));
      
      if (hasFood) {
        items.push({
          name: trimmed,
          price: '',
          category: 'Food',
          description: ''
        });
      }
    }
  }
  
  return items;
};

/**
 * Remove duplicate items
 * @param {Array} items - Array of menu items
 * @returns {Array} Array without duplicates
 */
const removeDuplicateItems = (items) => {
  const seen = new Set();
  const unique = [];
  
  for (const item of items) {
    const key = item.name.toLowerCase().trim();
    if (!seen.has(key) && key.length > 0) {
      seen.add(key);
      unique.push(item);
    }
  }
  
  return unique;
};

/**
 * Clean and normalize menu item
 * @param {Object} item - Menu item
 * @returns {Object} Cleaned menu item
 */
const cleanMenuItem = (item) => {
  return {
    name: item.name.trim(),
    price: item.price ? item.price.trim() : '',
    category: item.category || 'General',
    description: item.description ? item.description.trim() : ''
  };
}; 