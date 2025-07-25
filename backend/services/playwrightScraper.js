/**
 * Playwright Web Scraper Service
 * Optimized for reliable menu extraction with reasonable performance
 */

// Load environment variables
require('dotenv').config();

const { chromium } = require('playwright');
const axios = require('axios');
const { callGeminiAPI } = require('./geminiHelper');


class PlaywrightScraper {
  constructor() {
    this.browser = null;
    this.maxConcurrentPages = 10; // Increased for better performance
    this.activeScrapes = new Set();
  }

  async initBrowser() {
    if (this.browser) return this.browser;
    
    try {
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        ]
      });
      
      console.log('✅ Playwright browser initialized');
      return this.browser;
    } catch (error) {
      console.error('❌ Failed to initialize browser:', error.message);
      throw error;
    }
  }

  async findAndScrapeMenu(url, options = {}) {
    console.log(`🔍 Starting AI-powered intelligent menu discovery for: ${url}`);
    
    // Check if this is a PDF URL first - PDFs should be handled differently
    if (url.toLowerCase().endsWith('.pdf') || url.toLowerCase().includes('.pdf')) {
      console.log(`📄 Detected PDF URL, delegating to PDF parser: ${url}`);
      try {
        const pdfParser = require('./pdfParser');
        const pdfResult = await pdfParser.parsePDFMenu(url, options);
        
        if (pdfResult.success) {
          console.log(`✅ PDF parsing successful: ${pdfResult.menuItems?.length || 0} items found`);
          return pdfResult;
        } else {
          console.log(`❌ PDF parsing failed: ${pdfResult.error}`);
          return pdfResult; // Return the failed result, don't try web scraping methods
        }
      } catch (error) {
        console.error(`❌ PDF parsing error: ${error.message}`);
        return {
          success: false,
          url: url,
          error: `PDF parsing failed: ${error.message}`,
          discoveryMethod: 'pdf-parsing-error',
          menuItems: [],
          categories: [],
          restaurantInfo: {}
        };
      }
    }
    
    const discoveryStartTime = Date.now();
    let menuPageUrl = null;
    let discoveryMethod = 'none';
    
    try {
      // Step 1: Try the original URL first, but validate with AI
      console.log(`📍 Testing original URL with AI validation: ${url}`);
      const originalResult = await this.scrapeMenuData(url, { ...options, skipDiscovery: true });
      
      if (originalResult.success && originalResult.menuItems && originalResult.menuItems.length > 0) {
        console.log(`🔍 Found ${originalResult.menuItems.length} items on original URL, validating with AI...`);
        
        // Use AI to validate if this is actually a menu page
        const apiKey = process.env.GEMINI_API_KEY;
        if (apiKey && apiKey !== 'your_gemini_api_key_here') {
          const htmlContent = await this.fetchPageContentForAI(url, options);
          if (htmlContent) {
            const isMenuResult = await this.checkIfPageIsMenuWithAI(htmlContent, url, apiKey);
            
            if (isMenuResult && isMenuResult.isMenu && isMenuResult.confidence > 75) {
              console.log(`✅ AI confirmed original URL is a menu page: ${url} (confidence: ${isMenuResult.confidence}%)`);
              
              // Now check for sub-menus on this validated menu page
              const comprehensiveResult = await this.scrapeMenuWithSubMenus(url, options);
              
              return {
                ...comprehensiveResult,
                menuPageUrl: url,
                discoveryMethod: 'original-url-ai-validated-with-submenus',
                discoveryTime: Date.now() - discoveryStartTime,
                aiValidation: {
                  confidence: isMenuResult.confidence,
                  reason: isMenuResult.reason
                }
              };
            } else {
              console.log(`❌ AI determined original URL is NOT a menu page: ${url} (confidence: ${isMenuResult?.confidence || 0}%, reason: ${isMenuResult?.reason || 'unknown'})`);
              // Continue to AI discovery instead of returning false positive
            }
          }
        } else {
          console.log(`⚠️ No Gemini API key configured, skipping AI validation for original URL`);
          // Without AI validation, we'll still return the result but with lower confidence
          const comprehensiveResult = await this.scrapeMenuWithSubMenus(url, options);
          return {
            ...comprehensiveResult,
            menuPageUrl: url,
            discoveryMethod: 'original-url-unvalidated-with-submenus',
            discoveryTime: Date.now() - discoveryStartTime
          };
        }
      }
      
      // Step 2: Use AI-powered menu discovery
      console.log(`🤖 Using AI-powered menu discovery...`);
      const aiMenuUrl = await this.findMenuPageWithAI(url, 0, new Set(), options);
      
      if (aiMenuUrl) {
        console.log(`🧪 Testing AI-discovered menu URL: ${aiMenuUrl}`);
        
        try {
          const result = await this.scrapeMenuData(aiMenuUrl, { ...options, skipDiscovery: true });
          
          if (result.success && result.menuItems && result.menuItems.length > 0) {
            console.log(`✅ Menu found at AI-discovered URL ${aiMenuUrl}: ${result.menuItems.length} items`);
            
            // Now check for sub-menus on this discovered menu page
            const comprehensiveResult = await this.scrapeMenuWithSubMenus(aiMenuUrl, options);
            
            return {
              ...comprehensiveResult,
              url: url, // Keep original URL
              menuPageUrl: aiMenuUrl,
              discoveryMethod: 'ai-discovery-with-submenus',
              discoveryTime: Date.now() - discoveryStartTime
            };
          }
        } catch (error) {
          console.log(`❌ Failed to scrape AI-discovered URL ${aiMenuUrl}: ${error.message}`);
        }
      }
      
      // Step 3: Fallback to common paths with AI validation
      console.log(`� Trying common menu paths with AI validation...`);
      const aiCommonResult = await this.tryCommonMenuPathsWithAI(url, options);
      
      if (aiCommonResult) {
        console.log(`✅ Menu found via AI-validated common path: ${aiCommonResult}`);
        
        const result = await this.scrapeMenuData(aiCommonResult, { ...options, skipDiscovery: true });
        
        if (result.success) {
          // Now check for sub-menus on this common path menu page
          const comprehensiveResult = await this.scrapeMenuWithSubMenus(aiCommonResult, options);
          
          return {
            ...comprehensiveResult,
            url: url, // Keep original URL
            menuPageUrl: aiCommonResult,
            discoveryMethod: 'ai-common-paths-with-submenus',
            discoveryTime: Date.now() - discoveryStartTime
          };
        }
      }
      
      // Step 4: No menu found anywhere
      console.log(`❌ No menu found after comprehensive AI discovery process`);
      return {
        success: false,
        error: 'No menu page could be found on this website after comprehensive AI-powered search',
        url: url,
        menuPageUrl: null,
        discoveryMethod: 'failed',
        discoveryTime: Date.now() - discoveryStartTime
      };
      
    } catch (error) {
      console.error(`💥 Menu discovery error for ${url}:`, error.message);
      return {
        success: false,
        error: `Menu discovery failed: ${error.message}`,
        url: url,
        menuPageUrl: null,
        discoveryMethod: 'error',
        discoveryTime: Date.now() - discoveryStartTime
      };
    }
  }

  /**
   * Comprehensive menu scraping that includes sub-menus
   * @param {string} menuPageUrl - Main menu page URL
   * @param {Object} options - Scraping options
   * @returns {Promise<Object>} Complete menu data from all sub-menus
   */
  async scrapeMenuWithSubMenus(menuPageUrl, options = {}) {
    console.log(`🔍 Starting comprehensive menu scraping with sub-menu discovery for: ${menuPageUrl}`);
    
    const subMenuStartTime = Date.now();
    const allMenuItems = [];
    const allCategories = [];
    const visitedUrls = new Set();
    const subMenuUrls = [];
    let restaurantInfo = {};

    try {
      // Step 1: Scrape the main menu page
      console.log(`📋 Scraping main menu page: ${menuPageUrl}`);
      const mainMenuResult = await this.scrapeMenuData(menuPageUrl, { ...options, skipDiscovery: true });
      
      if (mainMenuResult.success) {
        allMenuItems.push(...(mainMenuResult.menuItems || []));
        allCategories.push(...(mainMenuResult.categories || []));
        restaurantInfo = mainMenuResult.restaurantInfo || {};
        visitedUrls.add(menuPageUrl);
        
        console.log(`✅ Main menu page scraped: ${mainMenuResult.menuItems?.length || 0} items found`);
      }

      // Step 2: Find sub-menu links on the main menu page
      console.log(`🔗 Discovering sub-menu links on main menu page...`);
      const subMenuLinks = await this.findSubMenuLinks(menuPageUrl, options);
      
      if (subMenuLinks && subMenuLinks.length > 0) {
        console.log(`📁 Found ${subMenuLinks.length} potential sub-menu links`);
        
        // Step 3: Process each sub-menu link
        for (const subMenuLink of subMenuLinks) {
          if (visitedUrls.has(subMenuLink.url)) {
            console.log(`⏭️ Skipping already visited URL: ${subMenuLink.url}`);
            continue;
          }
          
          console.log(`📄 Scraping sub-menu: ${subMenuLink.url} (${subMenuLink.category || 'Unknown Category'})`);
          
          try {
            // Use enhanced scraping that can detect if this page actually contains menu items
            const subMenuResult = await this.scrapeMenuDataWithMenuDetection(subMenuLink.url, { 
              ...options, 
              skipDiscovery: true,
              expectedCategory: subMenuLink.category 
            });
            
            if (subMenuResult.success && subMenuResult.menuItems && subMenuResult.menuItems.length > 0) {
              // Check if this page actually contains menu items (not just navigation)
              if (subMenuResult.isActualMenu && subMenuResult.menuConfidence > 60) {
                console.log(`✅ Sub-menu contains actual items: ${subMenuResult.menuItems.length} items from ${subMenuLink.category || 'Unknown'} (confidence: ${subMenuResult.menuConfidence}%)`);
              } else {
                console.log(`📝 Sub-menu is likely navigation page: ${subMenuResult.menuItems.length} extracted items (confidence: ${subMenuResult.menuConfidence}%)`);
              }
              
              // Add category context to items if available
              const categorizedItems = subMenuResult.menuItems.map(item => ({
                ...item,
                subMenuCategory: subMenuLink.category || 'Menu',
                sourceUrl: subMenuLink.url,
                isFromActualMenu: subMenuResult.isActualMenu,
                menuConfidence: subMenuResult.menuConfidence
              }));
              
              allMenuItems.push(...categorizedItems);
              allCategories.push(...(subMenuResult.categories || []));
              if (subMenuLink.category) {
                allCategories.push(subMenuLink.category);
              }
              
              subMenuUrls.push({
                url: subMenuLink.url,
                category: subMenuLink.category,
                itemCount: subMenuResult.menuItems.length
              });
              
              visitedUrls.add(subMenuLink.url);
            } else {
              console.log(`⚠️ Sub-menu returned no items: ${subMenuLink.url}`);
            }
          } catch (error) {
            console.log(`❌ Error scraping sub-menu ${subMenuLink.url}: ${error.message}`);
          }
          
          // Small delay between sub-menu requests to be polite
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } else {
        console.log(`📋 No sub-menu links found, using main menu only`);
      }

      // Step 4: Deduplicate and organize results
      const uniqueMenuItems = this.deduplicateMenuItems(allMenuItems);
      const uniqueCategories = [...new Set(allCategories)].filter(cat => cat && cat.length > 0);
      
      const totalTime = Date.now() - subMenuStartTime;
      console.log(`🎯 Comprehensive menu scraping completed: ${uniqueMenuItems.length} unique items from ${visitedUrls.size} pages in ${totalTime}ms`);
      
      return {
        success: true,
        menuItems: uniqueMenuItems,
        categories: uniqueCategories,
        restaurantInfo: restaurantInfo,
        subMenuUrls: subMenuUrls,
        totalPagesScraped: visitedUrls.size,
        extractionTime: totalTime,
        isComprehensive: true
      };
      
    } catch (error) {
      console.error(`❌ Comprehensive menu scraping failed: ${error.message}`);
      return {
        success: false,
        error: `Comprehensive menu scraping failed: ${error.message}`,
        menuItems: allMenuItems,
        categories: allCategories,
        restaurantInfo: restaurantInfo,
        subMenuUrls: subMenuUrls,
        totalPagesScraped: visitedUrls.size,
        extractionTime: Date.now() - subMenuStartTime,
        isComprehensive: false
      };
    }
  }

  /**
   * Find sub-menu links on a menu page using AI
   * @param {string} menuPageUrl - Menu page URL to analyze
   * @param {Object} options - Scraping options
   * @returns {Promise<Array>} Array of sub-menu link objects
   */
  async findSubMenuLinks(menuPageUrl, options = {}) {
    console.log(`🔍 Analyzing page for sub-menu links: ${menuPageUrl}`);
    
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === 'your_gemini_api_key_here') {
        console.log('[Sub-Menu Discovery] No API key, using basic link detection');
        return await this.findSubMenuLinksBasic(menuPageUrl, options);
      }

      const htmlContent = await this.fetchPageContentForAI(menuPageUrl, options);
      if (!htmlContent) {
        console.log(`[Sub-Menu Discovery] Could not fetch content from: ${menuPageUrl}`);
        return [];
      }

      const enhancedHtml = this.prepareEnhancedHtmlForGemini(htmlContent);
      const textContent = this.htmlToText(htmlContent);

      const prompt = `Analyze this restaurant menu page to find SUB-MENU links that lead to specific menu categories or sections.

Menu Page URL: ${menuPageUrl}

HTML Structure:
${enhancedHtml}

Text Content Sample:
${textContent.substring(0, 5000)}

FIND SUB-MENU LINKS - Look for these specific patterns:

1. MENU CATEGORY LINKS:
   - Links to specific food categories: "Appetizers", "Entrees", "Desserts", "Drinks", "Lunch", "Dinner"
   - Navigation within the menu system
   - Tabs or sections that load different menu parts

2. SPECIALIZED MENU LINKS:
   - "Brunch Menu", "Lunch Menu", "Dinner Menu", "Kids Menu", "Wine List"
   - "Bar Menu", "Cocktails", "Beer List", "Specials"
   - "Catering Menu", "Takeout Menu", "Delivery Menu"

3. EXTRACT ACTUAL SUB-MENU URLs:
   - Look for href attributes that contain menu-related paths
   - Examples: "/menu/appetizers", "/lunch-menu", "/dinner", "/drinks"
   - Convert relative URLs to absolute URLs using base: ${menuPageUrl}

4. IDENTIFY CATEGORY CONTEXT:
   - Determine what category each link represents based on link text
   - Examples: "Appetizers" → category: "Appetizers", "Wine" → category: "Wine & Beverages"

IGNORE:
- Links back to main homepage
- Contact/location/about pages
- External ordering platforms
- Social media links
- Non-menu related content
- The current page URL itself

REQUIREMENTS:
- Only include links that are likely to contain MORE menu items
- Focus on category-specific or meal-specific menu pages
- Prioritize links with clear food/drink category indicators

Return ONLY a JSON object:
{
  "subMenuLinks": [
    {
      "url": "EXACT full URL (e.g., ${menuPageUrl}/appetizers)",
      "category": "Category name (e.g., Appetizers, Lunch, Wine)",
      "confidence": 80,
      "linkText": "Original link text",
      "reason": "Why this is likely a sub-menu"
    }
  ]
}

Return maximum 10 sub-menu links, highest confidence first!`;

      console.log(`[Sub-Menu Discovery] Running AI analysis for sub-menu links...`);
      const result = await callGeminiAPI(prompt, apiKey, 'sub-menu discovery');

      if (!result.success) {
        console.warn(`[Sub-Menu Discovery] AI analysis failed: ${result.error}`);
        return await this.findSubMenuLinksBasic(menuPageUrl, options);
      }

      // Extract JSON from response
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn(`[Sub-Menu Discovery] No valid JSON found in AI response`);
        return await this.findSubMenuLinksBasic(menuPageUrl, options);
      }

      try {
        const parsedResult = JSON.parse(jsonMatch[0]);
        const subMenuLinks = parsedResult.subMenuLinks || [];

        // Validate and normalize URLs
        const validSubMenuLinks = [];
        for (const link of subMenuLinks) {
          if (link.url && link.confidence > 50) {
            // Convert relative URLs to absolute
            try {
              if (!link.url.startsWith('http')) {
                const baseUrl = new URL(menuPageUrl);
                if (link.url.startsWith('/')) {
                  link.url = `${baseUrl.origin}${link.url}`;
                } else {
                  link.url = `${baseUrl.origin}/${link.url}`;
                }
              }
              validSubMenuLinks.push(link);
            } catch (error) {
              console.warn(`[Sub-Menu Discovery] Could not normalize URL: ${link.url}`);
            }
          }
        }

        console.log(`[Sub-Menu Discovery] AI found ${validSubMenuLinks.length} valid sub-menu links`);
        return validSubMenuLinks;

      } catch (parseError) {
        console.error(`[Sub-Menu Discovery] JSON parse error: ${parseError.message}`);
        return await this.findSubMenuLinksBasic(menuPageUrl, options);
      }

    } catch (error) {
      console.error(`[Sub-Menu Discovery] Error: ${error.message}`);
      return await this.findSubMenuLinksBasic(menuPageUrl, options);
    }
  }

  /**
   * Basic sub-menu link detection without AI
   * @param {string} menuPageUrl - Menu page URL
   * @param {Object} options - Scraping options
   * @returns {Promise<Array>} Array of sub-menu links
   */
  async findSubMenuLinksBasic(menuPageUrl, options = {}) {
    let context = null;
    let page = null;
    
    try {
      await this.initBrowser();
      context = await this.browser.newContext({
        viewport: options.mobile ? { width: 375, height: 667 } : { width: 1920, height: 1080 },
        userAgent: options.mobile ? 
          'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1' :
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      });
      
      page = await context.newPage();
      await page.goto(menuPageUrl, { 
        waitUntil: 'domcontentloaded',
        timeout: options.timeout || 30000 
      });
      
      await page.waitForTimeout(2000);
      
      const subMenuLinks = await page.evaluate((currentUrl) => {
        const links = Array.from(document.querySelectorAll('a[href]'));
        const categoryKeywords = [
          'appetizer', 'starter', 'app', 'entree', 'main', 'dessert', 'drink', 'beverage',
          'lunch', 'dinner', 'breakfast', 'brunch', 'bar', 'wine', 'cocktail', 'beer',
          'kids', 'children', 'special', 'seasonal', 'catering', 'takeout', 'delivery'
        ];
        
        const potentialSubMenus = [];
        
        for (const link of links) {
          const href = link.getAttribute('href');
          const text = link.textContent.toLowerCase().trim();
          const title = (link.getAttribute('title') || '').toLowerCase();
          
          // Skip if it's the current page
          if (href === currentUrl || href === window.location.pathname) continue;
          
          // Check if the link contains category keywords
          const hasCategory = categoryKeywords.some(keyword => 
            href.toLowerCase().includes(keyword) ||
            text.includes(keyword) ||
            title.includes(keyword)
          );
          
          if (hasCategory && href) {
            let fullUrl;
            try {
              fullUrl = new URL(href, window.location.origin).href;
            } catch {
              continue;
            }
            
            // Try to determine category from text
            let category = 'Menu';
            for (const keyword of categoryKeywords) {
              if (text.includes(keyword)) {
                category = keyword.charAt(0).toUpperCase() + keyword.slice(1);
                break;
              }
            }
            
            potentialSubMenus.push({
              url: fullUrl,
              category: category,
              confidence: 70,
              linkText: text,
              reason: 'Contains menu category keywords'
            });
          }
        }
        
        return potentialSubMenus;
      }, menuPageUrl);
      
      // Remove duplicates and limit results
      const uniqueLinks = subMenuLinks
        .filter((link, index, arr) => arr.findIndex(l => l.url === link.url) === index)
        .slice(0, 8);
      
      console.log(`[Basic Sub-Menu Discovery] Found ${uniqueLinks.length} potential sub-menu links`);
      return uniqueLinks;
      
    } catch (error) {
      console.error(`[Basic Sub-Menu Discovery] Error: ${error.message}`);
      return [];
    } finally {
      if (context) {
        await context.close();
      }
    }
  }

  /**
   * Deduplicate menu items based on name similarity
   * @param {Array} menuItems - Array of menu items
   * @returns {Array} Deduplicated menu items
   */
  deduplicateMenuItems(menuItems) {
    if (!menuItems || menuItems.length === 0) return [];
    
    const uniqueItems = [];
    const seenNames = new Set();
    
    for (const item of menuItems) {
      if (!item.name) continue;
      
      // Normalize name for comparison
      const normalizedName = item.name.toLowerCase().trim().replace(/[^\w\s]/g, '');
      
      // Check for exact duplicates
      if (seenNames.has(normalizedName)) {
        continue;
      }
      
      // Check for similar names (basic similarity check)
      let isDuplicate = false;
      for (const existingName of seenNames) {
        if (this.calculateStringSimilarity(normalizedName, existingName) > 0.85) {
          isDuplicate = true;
          break;
        }
      }
      
      if (!isDuplicate) {
        uniqueItems.push(item);
        seenNames.add(normalizedName);
      }
    }
    
    console.log(`🔄 Deduplication: ${menuItems.length} → ${uniqueItems.length} unique items`);
    return uniqueItems;
  }

  /**
   * Calculate string similarity between two strings
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Similarity score between 0 and 1
   */
  calculateStringSimilarity(str1, str2) {
    if (str1 === str2) return 1;
    
    const len1 = str1.length;
    const len2 = str2.length;
    
    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;
    
    const matrix = [];
    for (let i = 0; i <= len2; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len1; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= len2; i++) {
      for (let j = 1; j <= len1; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    const maxLen = Math.max(len1, len2);
    return (maxLen - matrix[len2][len1]) / maxLen;
  }

  async findMenuLinksOnPage(url, options = {}) {
    let context = null;
    let page = null;
    
    try {
      await this.initBrowser();
      context = await this.browser.newContext({
        viewport: options.mobile ? { width: 375, height: 667 } : { width: 1920, height: 1080 },
        userAgent: options.mobile ? 
          'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1' :
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      });
      
      page = await context.newPage();
      await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: options.timeout || 30000 
      });
      
      // Wait a bit for dynamic content
      await page.waitForTimeout(2000);
      
      // Find potential menu links
      const menuLinks = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href]'));
        const menuKeywords = [
          'menu', 'menus', 'food', 'order', 'dining', 'eat', 'kitchen', 
          'dishes', 'restaurant', 'cuisine', 'meals', 'lunch', 'dinner',
          'breakfast', 'food-menu', 'our-menu', 'view-menu'
        ];
        
        const potentialMenuLinks = [];
        
        for (const link of links) {
          const href = link.getAttribute('href');
          const text = link.textContent.toLowerCase().trim();
          const title = (link.getAttribute('title') || '').toLowerCase();
          const ariaLabel = (link.getAttribute('aria-label') || '').toLowerCase();
          
          // Check if the link or its text contains menu-related keywords
          const hasMenuKeyword = menuKeywords.some(keyword => 
            href.toLowerCase().includes(keyword) ||
            text.includes(keyword) ||
            title.includes(keyword) ||
            ariaLabel.includes(keyword)
          );
          
          if (hasMenuKeyword && href) {
            // Convert relative URLs to absolute
            let fullUrl;
            try {
              fullUrl = new URL(href, window.location.origin).href;
            } catch {
              continue;
            }
            
            potentialMenuLinks.push({
              url: fullUrl,
              text: text,
              href: href
            });
          }
        }
        
        return potentialMenuLinks;
      });
      
      // Return just the URLs, sorted by relevance
      const urls = menuLinks
        .map(link => link.url)
        .filter((url, index, arr) => arr.indexOf(url) === index) // Remove duplicates
        .slice(0, 5); // Limit to top 5 candidates
      
      console.log(`🔗 Found ${urls.length} potential menu links on homepage`);
      return urls;
      
    } catch (error) {
      console.error(`❌ Error finding menu links on ${url}:`, error.message);
      return [];
    } finally {
      if (context) {
        await context.close();
      }
    }
  }

  /**
   * Enhanced menu scraping with intelligent menu detection during navigation
   * @param {string} url - URL to scrape
   * @param {Object} options - Scraping options
   * @returns {Promise<Object>} Enhanced scraping result with menu detection
   */
  async scrapeMenuDataWithMenuDetection(url, options = {}) {
    // Check if this is a PDF URL first
    if (url.toLowerCase().endsWith('.pdf') || url.toLowerCase().includes('.pdf')) {
      console.log(`📄 Detected PDF URL during navigation, using PDF parser: ${url}`);
      const pdfParser = require('./pdfParser');
      return await pdfParser.parsePDFMenu(url, options);
    }

    const startTime = Date.now();
    let context = null;
    let page = null;

    try {
      const browser = await this.initBrowser();
      context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        viewport: options.mobile ? 
          { width: 375, height: 667 } : 
          { width: 1280, height: 800 }
      });
      
      page = await context.newPage();
      page.setDefaultTimeout(45000);
      page.setDefaultNavigationTimeout(45000);
      
      // Block heavy media content
      await page.route('**/*', (route) => {
        const resourceType = route.request().resourceType();
        if (['image', 'media', 'font'].includes(resourceType)) {
          route.abort();
        } else {
          route.continue();
        }
      });
      
      console.log(`🌐 Navigating to: ${url}`);
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: 45000
      });
      
      // Wait for dynamic content
      await page.waitForTimeout(3000);
      
      // First, check if this page contains actual menu items using AI
      const pageContent = await page.content();
      const hasMenuItems = await this.detectMenuContentOnPage(pageContent, url, options.expectedCategory);
      
      console.log(`🔍 Menu content detection: ${hasMenuItems.isMenu ? 'Contains menu items' : 'Navigation/landing page'} (confidence: ${hasMenuItems.confidence}%)`);
      
      // Extract menu data regardless, but flag the type of page
      const menuData = await this.extractMenuData(page, url);
      
      const totalTime = Date.now() - startTime;
      
      return {
        success: true,
        url: url,
        extractionTime: totalTime,
        isActualMenu: hasMenuItems.isMenu,
        menuConfidence: hasMenuItems.confidence,
        pageType: hasMenuItems.isMenu ? 'menu-page' : 'navigation-page',
        ...menuData,
        menuDetectionInfo: {
          reason: hasMenuItems.reason,
          expectedCategory: options.expectedCategory,
          itemsFoundCount: menuData.menuItems?.length || 0
        }
      };
      
    } catch (error) {
      console.error(`❌ Enhanced scraping failed for ${url}:`, error.message);
      return {
        success: false,
        url: url,
        error: error.message,
        extractionTime: Date.now() - startTime,
        isActualMenu: false,
        menuConfidence: 0,
        pageType: 'error'
      };
    } finally {
      if (context) {
        await context.close();
      }
    }
  }

  /**
   * Detect if a page contains actual menu content using AI
   * @param {string} htmlContent - Page HTML content
   * @param {string} url - Page URL
   * @param {string} expectedCategory - Expected menu category
   * @returns {Promise<Object>} Menu detection result
   */
  async detectMenuContentOnPage(htmlContent, url, expectedCategory = null) {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === 'your_gemini_api_key_here') {
        // Fallback to basic detection
        return this.detectMenuContentBasic(htmlContent, expectedCategory);
      }

      const textContent = this.htmlToText(htmlContent);
      const sampleText = textContent.substring(0, 8000); // Larger sample for menu detection
      
      const prompt = `Analyze this webpage content to determine if it contains an actual restaurant menu with food items and prices, or if it's just a navigation/landing page.

URL: ${url}
Expected Category: ${expectedCategory || 'Unknown'}

Page Content:
${sampleText}

MENU DETECTION CRITERIA:

✅ ACTUAL MENU PAGE - Look for:
- Multiple food/drink items with names and prices (e.g., "Caesar Salad $12.95")
- Menu structure with categories like appetizers, entrees, desserts, beverages
- Detailed food descriptions and ingredients
- Multiple items listed in an organized format
- Price information for most items

❌ NAVIGATION/LANDING PAGE - Typically has:
- Just category buttons/links ("Appetizers", "Entrees", "View Menu")
- Restaurant information, hours, location
- General descriptions without specific items
- Links to other menu pages
- Single or very few food mentions
- No actual menu items with prices

ANALYSIS FOCUS:
${expectedCategory ? `- This page should contain items from category: "${expectedCategory}"` : '- Look for any menu category content'}
- Count actual food items with descriptions/prices
- Distinguish between menu content and navigation elements
- Consider if this is a sub-category page with actual items

Return ONLY JSON:
{
  "isMenu": true/false,
  "confidence": 0-100,
  "reason": "Brief explanation of why this is/isn't a menu page",
  "itemsDetected": 0-50,
  "categoryMatch": true/false
}`;

      const result = await callGeminiAPI(prompt, apiKey, 'menu content detection');
      
      if (result.success) {
        try {
          const jsonMatch = result.content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
              isMenu: !!parsed.isMenu,
              confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 50,
              reason: parsed.reason || 'AI analysis completed',
              itemsDetected: parsed.itemsDetected || 0,
              categoryMatch: !!parsed.categoryMatch
            };
          }
        } catch (parseError) {
          console.warn(`[Menu Detection] JSON parse error, using fallback`);
        }
      }
      
      // Fallback to basic detection
      return this.detectMenuContentBasic(htmlContent, expectedCategory);
      
    } catch (error) {
      console.warn(`[Menu Detection] Error: ${error.message}, using basic detection`);
      return this.detectMenuContentBasic(htmlContent, expectedCategory);
    }
  }

  /**
   * Basic menu content detection (fallback method)
   * @param {string} htmlContent - Page HTML content
   * @param {string} expectedCategory - Expected category
   * @returns {Object} Detection result
   */
  detectMenuContentBasic(htmlContent, expectedCategory = null) {
    const textContent = this.htmlToText(htmlContent).toLowerCase();
    
    // Count price patterns
    const pricePattern = /\$\d+\.?\d{0,2}|£\d+\.?\d{0,2}|€\d+\.?\d{0,2}/g;
    const priceMatches = textContent.match(pricePattern) || [];
    
    // Look for food-related words
    const foodWords = ['menu', 'appetizer', 'entree', 'main', 'dessert', 'salad', 'soup', 'pasta', 'pizza', 'burger', 'sandwich', 'drink', 'wine', 'beer'];
    const foodWordCount = foodWords.reduce((count, word) => {
      return count + (textContent.split(word).length - 1);
    }, 0);
    
    // Calculate confidence based on patterns
    let confidence = 0;
    if (priceMatches.length >= 5) confidence += 40;
    if (priceMatches.length >= 10) confidence += 20;
    if (foodWordCount >= 10) confidence += 30;
    if (textContent.length > 2000) confidence += 10;
    
    const isMenu = confidence >= 60 || priceMatches.length >= 8;
    
    return {
      isMenu,
      confidence: Math.min(confidence, 95),
      reason: `Basic detection: ${priceMatches.length} prices, ${foodWordCount} food terms`,
      itemsDetected: Math.min(priceMatches.length, 50),
      categoryMatch: expectedCategory ? textContent.includes(expectedCategory.toLowerCase()) : true
    };
  }

  async scrapeMenuData(url, options = {}) {
    // Check if this is a PDF URL and handle it differently
    if (url.toLowerCase().endsWith('.pdf') || url.toLowerCase().includes('.pdf')) {
      console.log(`📄 Detected PDF URL, using PDF parser: ${url}`);
      const pdfParser = require('./pdfParser');
      return await pdfParser.parsePDFMenu(url, options);
    }

    // Check concurrent scrapes limit
    if (this.activeScrapes.size >= this.maxConcurrentPages) {
      throw new Error('Too many concurrent scrapes. Please try again in a moment.');
    }

    const scrapeId = `${url}-${Date.now()}`;
    this.activeScrapes.add(scrapeId);
    
    let context = null;
    let page = null;
    const startTime = Date.now();

    try {
      const browser = await this.initBrowser();
      context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        viewport: options.mobile ? 
          { width: 375, height: 667 } : 
          { width: 1280, height: 800 }
      });
      
      page = await context.newPage();
      
      // Set reasonable timeouts
      page.setDefaultTimeout(45000);
      page.setDefaultNavigationTimeout(45000);
      
      // Block only heavy media content (keep stylesheets for layout)
      await page.route('**/*', (route) => {
        const resourceType = route.request().resourceType();
        const url = route.request().url();
        
        // Block only the heaviest content
        if (['media', 'websocket'].includes(resourceType)) {
          route.abort();
          return;
        }
        
        // Block known tracking/ads
        if (url.includes('google-analytics') || 
            url.includes('googletagmanager') ||
            url.includes('facebook.com/tr') ||
            url.includes('doubleclick') ||
            url.includes('googlesyndication')) {
          route.abort();
          return;
        }
        
        route.continue();
      });
      
      console.log(`🌐 Navigating to: ${url}`);
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: 45000
      });
      
      // Wait for selector if provided
      if (options.waitForSelector) {
        try {
          await page.waitForSelector(options.waitForSelector, { 
            timeout: 10000,
            state: 'visible'
          });
          console.log(`✅ Found selector: ${options.waitForSelector}`);
        } catch (error) {
          console.log(`⚠️ Selector not found: ${options.waitForSelector}`);
        }
      }
      
      // Wait for dynamic content
      await page.waitForTimeout(3000);
      
      console.log(`🔍 Extracting menu data...`);
      const menuData = await this.extractMenuData(page, url);
      
      const totalTime = Date.now() - startTime;
      console.log(`✅ Menu extraction completed in ${totalTime}ms`);
      
      return {
        success: true,
        url: url,
        extractionTime: totalTime,
        ...menuData
      };
      
    } catch (error) {
      console.error(`❌ Scraping failed for ${url}:`, error.message);
      return {
        success: false,
        url: url,
        error: error.message,
        extractionTime: Date.now() - startTime
      };
    } finally {
      // Cleanup
      try {
        if (page) await page.close();
        if (context) await context.close();
      } catch (error) {
        console.warn('⚠️ Cleanup error:', error.message);
      }
      this.activeScrapes.delete(scrapeId);
    }
  }

  async extractMenuData(page, url) {
    try {
      const menuData = await page.evaluate(() => {
        // Enhanced menu extraction logic
        const results = {
          menuItems: [],
          categories: [],
          restaurantInfo: {},
          rawText: ''
        };

        // Get page title and basic info
        results.restaurantInfo.name = document.title;
        results.restaurantInfo.url = window.location.href;

        // Common menu selectors (more comprehensive)
        const menuSelectors = [
          '[class*="menu"]',
          '[class*="item"]', 
          '[class*="dish"]',
          '[class*="food"]',
          '[class*="product"]',
          '[id*="menu"]',
          '[data-*="menu"]',
          '.card',
          '.listing',
          'article',
          '[role="listitem"]'
        ];

        const priceSelectors = [
          '[class*="price"]',
          '[class*="cost"]',
          '[class*="amount"]',
          '.currency',
          '[data-*="price"]'
        ];

        // Extract menu items
        const menuElements = document.querySelectorAll(menuSelectors.join(','));
        const seenItems = new Set();

        menuElements.forEach((element, index) => {
          const text = element.textContent?.trim();
          if (!text || text.length < 5 || seenItems.has(text)) return;
          
          // Look for price in element
          let price = '';
          const priceElement = element.querySelector(priceSelectors.join(','));
          if (priceElement) {
            price = priceElement.textContent?.trim() || '';
          } else {
            // Look for price pattern in text
            const priceMatch = text.match(/[$£€¥₹][\d,]+\.?\d*/);
            if (priceMatch) price = priceMatch[0];
          }

          // Extract name (first meaningful line)
          const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
          const name = lines[0] || text.substring(0, 100);
          
          if (name.length > 2) {
            results.menuItems.push({
              name: name,
              price: price,
              description: lines.slice(1).join(' ').substring(0, 200),
              fullText: text.substring(0, 300),
              element: index
            });
            seenItems.add(text);
          }
        });

        // Extract categories
        const categorySelectors = [
          'h1, h2, h3, h4',
          '[class*="category"]',
          '[class*="section"]',
          '[class*="heading"]',
          '.title'
        ];

        document.querySelectorAll(categorySelectors.join(',')).forEach(element => {
          const text = element.textContent?.trim();
          if (text && text.length > 2 && text.length < 100) {
            results.categories.push(text);
          }
        });

        // Get raw text for fallback analysis
        results.rawText = document.body.innerText?.substring(0, 5000) || '';

        return results;
      });

      // Post-process and validate
      menuData.menuItems = menuData.menuItems
        .filter(item => item.name && item.name.length > 2)
        .slice(0, 100); // Reasonable limit

      menuData.categories = [...new Set(menuData.categories)]
        .slice(0, 20); // Reasonable limit

      console.log(`📊 Extracted ${menuData.menuItems.length} items, ${menuData.categories.length} categories`);
      
      return menuData;

    } catch (error) {
      console.error('❌ Menu extraction error:', error.message);
      return {
        menuItems: [],
        categories: [],
        restaurantInfo: { name: 'Unknown', url: url },
        rawText: '',
        error: error.message
      };
    }
  }

  async closeBrowser() {
    if (this.browser) {
      try {
        await this.browser.close();
        console.log('🔒 Browser closed');
      } catch (error) {
        console.warn('⚠️ Browser close error:', error.message);
      } finally {
        this.browser = null;
        this.activeScrapes.clear();
      }
    }
  }

  getStats() {
    return {
      activeScrapes: this.activeScrapes.size,
      maxConcurrent: this.maxConcurrentPages,
      browserActive: !!this.browser
    };
  }

  // ========== AI-POWERED MENU DISCOVERY METHODS ==========
  
  /**
   * Use AI to intelligently find menu page with context clues
   * @param {string} currentUrl - Current URL to analyze
   * @param {number} depth - Current recursion depth
   * @param {Set} visitedUrls - Set of already visited URLs to prevent loops
   * @param {Object} options - Scraping options
   * @returns {Promise<string|null>} Menu page URL or null if not found
   */
  async findMenuPageWithAI(currentUrl, depth = 0, visitedUrls = new Set(), options = {}) {
    // Prevent infinite recursion and loops
    if (depth >= 3 || visitedUrls.has(currentUrl)) {
      console.log(`[AI Search] Stopping recursion for: ${currentUrl} (depth: ${depth}, visited: ${visitedUrls.has(currentUrl)})`);
      return null;
    }
    
    visitedUrls.add(currentUrl);
    console.log(`[AI Search] Analyzing (depth ${depth}): ${currentUrl}`);
    
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === 'your_gemini_api_key_here') {
        console.warn('Gemini API key not configured, falling back to basic discovery');
        return await this.findMenuLinksOnPage(currentUrl, options).then(links => links[0] || null);
      }

      // Fetch the page content using Playwright
      const htmlContent = await this.fetchPageContentForAI(currentUrl, options);
      if (!htmlContent) {
        console.log(`[AI Search] Could not fetch content from: ${currentUrl}`);
        return null;
      }
      
      // Use AI to find menu pages
      console.log(`[AI Search] Running Enhanced AI Search to find dedicated menu pages...`);
      const menuSearchResult = await this.findMenuWithContextualAI(htmlContent, currentUrl, apiKey);
      
      if (menuSearchResult && menuSearchResult.menuUrls && menuSearchResult.menuUrls.length > 0) {
        // Try each suggested URL in order of confidence
        for (const suggestion of menuSearchResult.menuUrls) {
          console.log(`[AI Search] Testing suggested URL: ${suggestion.url} (confidence: ${suggestion.confidence}%, type: ${suggestion.type})`);
          console.log(`[AI Search] Reason: ${suggestion.reason}`);
          
          // Skip if already visited
          if (visitedUrls.has(suggestion.url)) {
            console.log(`[AI Search] Already visited: ${suggestion.url}`);
            continue;
          }
          
          // Handle PDF links differently - don't try to fetch HTML content
          if (suggestion.type === 'pdf' || suggestion.url.toLowerCase().endsWith('.pdf')) {
            console.log(`[AI Search] Found PDF menu link: ${suggestion.url}`);
            console.log(`[AI Search] PDF menus require special handling - returning PDF URL for processing`);
            
            // For high-confidence PDF menus, return the URL directly
            if (suggestion.confidence > 70) {
              console.log(`[AI Search] ✓ High-confidence PDF menu found: ${suggestion.url}`);
              return suggestion.url;
            } else {
              console.log(`[AI Search] Low-confidence PDF, continuing to look for HTML alternatives...`);
              continue;
            }
          }
          
          // For HTML pages, check if the URL exists and is accessible
          const testContent = await this.fetchPageContentForAI(suggestion.url, options);
          if (testContent) {
            // Check if this is a menu page for HTML content
            console.log(`[AI Search] Testing if ${suggestion.url} is a menu page...`);
            const isMenuResult = await this.checkIfPageIsMenuWithAI(testContent, suggestion.url, apiKey);
            
            if (isMenuResult && isMenuResult.isMenu && isMenuResult.confidence > 40) {
              console.log(`[AI Search] ✓ Confirmed dedicated menu page: ${suggestion.url} (confidence: ${isMenuResult.confidence}%)`);
              return suggestion.url;
            } else if (isMenuResult) {
              console.log(`[AI Search] ✗ Not a menu page: ${suggestion.url} (confidence: ${isMenuResult.confidence}%, reason: ${isMenuResult.reason})`);
              
              // If this was a high-confidence suggestion that turned out not to be a menu,
              // and we haven't hit max depth, try to recursively search from this page
              if (suggestion.confidence > 70 && depth < 2) {
                console.log(`[AI Search] High-confidence suggestion failed, trying recursive search from: ${suggestion.url}`);
                const recursiveResult = await this.findMenuPageWithAI(suggestion.url, depth + 1, visitedUrls, options);
                if (recursiveResult) {
                  console.log(`[AI Search] Found menu through recursive search: ${recursiveResult}`);
                  return recursiveResult;
                }
              }
            }
          } else {
            console.log(`[AI Search] ✗ URL not accessible: ${suggestion.url}`);
          }
        }
      } else {
        console.log(`[AI Search] Enhanced AI Search found no menu URLs for: ${currentUrl}`);
        
        // If AI found menu-related text but no URLs, try the basic method as backup
        if (menuSearchResult && menuSearchResult.debugInfo && 
            (menuSearchResult.debugInfo.foundMenuText?.length > 0 || 
             menuSearchResult.debugInfo.foundButtons?.length > 0 || 
             menuSearchResult.debugInfo.foundLinks?.length > 0)) {
          console.log(`[AI Search] AI found menu-related content but no URLs. Trying basic link extraction as backup...`);
          const basicLinks = await this.findMenuLinksOnPage(currentUrl, options);
          if (basicLinks && basicLinks.length > 0) {
            console.log(`[AI Search] Basic method found ${basicLinks.length} potential menu links`);
            for (const basicUrl of basicLinks) {
              if (!visitedUrls.has(basicUrl)) {
                const testContent = await this.fetchPageContentForAI(basicUrl, options);
                if (testContent) {
                  const isMenuResult = await this.checkIfPageIsMenuWithAI(testContent, basicUrl, apiKey);
                  if (isMenuResult && isMenuResult.isMenu && isMenuResult.confidence > 40) {
                    console.log(`[AI Search] ✓ Basic method found valid menu page: ${basicUrl} (confidence: ${isMenuResult.confidence}%)`);
                    return basicUrl;
                  }
                }
              }
            }
          }
        }
      }
      
      // If Enhanced AI Search didn't find dedicated menu pages, check if current page IS a menu
      console.log(`[AI Search] No dedicated menu pages found, checking if current page is a menu: ${currentUrl}`);
      const isMenuResult = await this.checkIfPageIsMenuWithAI(htmlContent, currentUrl, apiKey);
      
      if (isMenuResult && isMenuResult.isMenu && isMenuResult.confidence > 40) {
        console.log(`[AI Menu Detection] Using current page as menu: ${currentUrl} (confidence: ${isMenuResult.confidence}%)`);
        return currentUrl;
      } else if (isMenuResult) {
        console.log(`[AI Menu Detection] Current page is not a menu: ${currentUrl} (confidence: ${isMenuResult.confidence}%, reason: ${isMenuResult.reason})`);
      }
      
      // If AI found hidden/interactive menu on current page, double-check with deep analysis
      if (menuSearchResult && menuSearchResult.hasHiddenMenu) {
        console.log(`[AI Search] Checking for hidden menu content on current page with deep analysis`);
        const hiddenMenuCheck = await this.checkIfPageIsMenuWithAI(htmlContent, currentUrl, apiKey, true);
        if (hiddenMenuCheck && hiddenMenuCheck.isMenu && hiddenMenuCheck.confidence > 50) {
          console.log(`[AI Search] Confirmed hidden/interactive menu on: ${currentUrl}`);
          return currentUrl;
        }
      }
      
      return null;
      
    } catch (error) {
      console.error(`[AI Search] Error analyzing ${currentUrl}:`, error.message);
      return null;
    }
  }

  /**
   * Fetch page content for AI analysis using Playwright
   * @param {string} url - URL to fetch
   * @param {Object} options - Scraping options
   * @returns {Promise<string|null>} HTML content or null if failed
   */
  async fetchPageContentForAI(url, options = {}) {
    // Check if this is a PDF URL - PDFs cannot be loaded as HTML pages
    if (url.toLowerCase().endsWith('.pdf') || url.toLowerCase().includes('.pdf')) {
      console.log(`📄 PDF URL detected in fetchPageContentForAI, skipping HTML fetch: ${url}`);
      return null; // Return null for PDF URLs since they can't be fetched as HTML
    }

    let context = null;
    let page = null;
    
    try {
      await this.initBrowser();
      context = await this.browser.newContext({
        viewport: options.mobile ? { width: 375, height: 667 } : { width: 1920, height: 1080 },
        userAgent: options.mobile ? 
          'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1' :
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      });
      
      page = await context.newPage();
      
      // Block heavy resources for faster loading
      await page.route('**/*', (route) => {
        const resourceType = route.request().resourceType();
        if (['image', 'media', 'font'].includes(resourceType)) {
          route.abort();
        } else {
          route.continue();
        }
      });
      
      await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: options.timeout || 30000 
      });
      
      // Wait a bit for dynamic content
      await page.waitForTimeout(2000);
      
      // Get the HTML content
      const htmlContent = await page.content();
      return htmlContent;
      
    } catch (error) {
      console.error(`❌ Error fetching content from ${url}:`, error.message);
      return null;
    } finally {
      if (context) {
        await context.close();
      }
    }
  }

  /**
   * Try common menu paths with AI validation
   * @param {string} homepageUrl - Homepage URL
   * @param {Object} options - Scraping options
   * @returns {Promise<string|null>} Menu URL or null if not found
   */
  async tryCommonMenuPathsWithAI(homepageUrl, options = {}) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.log('[AI Common Paths] No API key, using basic method');
      return await this.findMenuLinksOnPage(homepageUrl, options).then(links => links[0] || null);
    }

    console.log(`[AI Common Paths] Testing common paths with AI validation for: ${homepageUrl}`);
    
    const commonPaths = [
      '/menu', '/menus', '/food-menu', '/restaurant-menu', '/our-menu',
      '/order', '/order-online', '/food', '/dining', '/food-and-drink',
      '/eat', '/kitchen', '/dishes', '/lunch', '/dinner', '/breakfast'
    ];
    
    try {
      const baseUrl = new URL(homepageUrl).origin;
      
      for (const path of commonPaths) {
        const url = `${baseUrl}${path}`;
        console.log(`[AI Common Paths] Testing: ${url}`);
        
        try {
          const content = await this.fetchPageContentForAI(url, options);
          if (!content) continue;
          
          const isMenuResult = await this.checkIfPageIsMenuWithAI(content, url, apiKey);
          
          if (isMenuResult && isMenuResult.isMenu && isMenuResult.confidence > 40) {
            console.log(`[AI Common Paths] ✓ Found menu at: ${url} (confidence: ${isMenuResult.confidence}%)`);
            return url;
          } else if (isMenuResult) {
            console.log(`[AI Common Paths] ✗ Not a menu: ${url} (confidence: ${isMenuResult.confidence}%)`);
          }
        } catch (error) {
          console.log(`[AI Common Paths] Error testing ${url}: ${error.message}`);
          continue;
        }
      }
      
      console.log(`[AI Common Paths] No menu found in common paths for: ${homepageUrl}`);
      return null;
      
    } catch (error) {
      console.error(`[AI Common Paths] Error: ${error.message}`);
      return null;
    }
  }

  /**
   * Use AI to find menu links with contextual analysis
   * @param {string} htmlContent - HTML content
   * @param {string} url - Current URL
   * @param {string} apiKey - Gemini API key
   * @returns {Promise<Object|null>} Menu discovery result
   */
  async findMenuWithContextualAI(htmlContent, url, apiKey) {
    try {
      // Get more comprehensive HTML for analysis
      const enhancedHtml = this.prepareEnhancedHtmlForGemini(htmlContent);
      const textContent = this.htmlToText(htmlContent);
      
      const prompt = `Analyze this restaurant website to find SPECIFIC menu page URLs. Focus on finding direct links to pages that contain actual food menus.

Website URL: ${url}

HTML Structure:
${enhancedHtml}

Text Content Sample:
${textContent.substring(0, 5000)}

FIND MENU LINKS - Look for these EXACT indicators:

1. OBVIOUS MENU BUTTONS/LINKS:
   *** HIGHEST PRIORITY: Look for <a>, <button>, or clickable elements with text containing:
   - "Menu" (exact word)
   - "Our Menu", "Food Menu", "See Menu", "View Menu"
   - "Order" combined with "Menu" or "Food"
   - Any button/link that literally says "MENU"

2. NAVIGATION MENU LINKS:
   - Check href attributes for: /menu, /food, /dining, /our-menu, /eat
   - Navigation bars, headers, main menus with menu-related text

3. PROMINENT ACTION BUTTONS:
   - "Order Now" that leads to menu pages
   - "Browse Menu", "See Our Menu" buttons
   - Call-to-action buttons with food/menu context

4. EXTRACT ACTUAL URLs:
   - Look for actual href attributes in the HTML
   - Convert relative URLs to full URLs using base: ${url}
   - Examples: "/menu" becomes "${url}/menu"
   - PDF MENUS: If you find PDF links (ending in .pdf), include them with HIGH priority - many restaurants use PDFs for menus
   - Look for menu PDFs like "menu.pdf", "food-menu.pdf", "dinner-menu.pdf" etc.

5. BUTTON/LINK ANALYSIS:
   - Pay special attention to <button> tags with "menu" text
   - Look at onclick handlers that might navigate to menu pages
   - Check data-* attributes that might contain menu URLs
   - Look for JavaScript navigation patterns like: window.location, href assignments
   - Check for React Router links or Vue Router links
   - PDF LINKS: Look for "Download Menu", "View Menu PDF", "Menu PDF" links

6. SPECIAL CASES - ALWAYS INCLUDE THESE:
   - If you see "View Menu" text anywhere, find the associated link/action
   - Check for menu links in navigation bars, headers, footers
   - Look for menu buttons in hero sections or main content areas
   - Search for any clickable element with menu-related text
   - PDF menu downloads or views

IGNORE:
- External ordering platforms (unless they're the ONLY menu option)  
- Social media links
- Contact/location pages
- General "About" pages

!!! CRITICAL: If you see ANY element (button, link, div) with the word "menu" in the visible text, that should be your TOP priority suggestion!

DEBUGGING - If you find "View Menu" or similar text but can't find a URL:
- Look more carefully at the surrounding HTML structure
- Check for data-href, data-url, or similar attributes
- Look for JavaScript patterns that might construct URLs
- Consider that the URL might be built dynamically

PDF HANDLING:
- If you find PDF menu links, include them with high priority - PDFs are common for restaurant menus
- Mark PDF links as type: "pdf" with confidence 80-90 (increased from previous 60-70)
- Look for: "View Menu PDF", "Download Menu", "Menu.pdf", "Dinner Menu.pdf" etc.
- PDF menus are often more complete than web menus

Return ONLY a JSON object with this structure:
{
  "hasHiddenMenu": false,
  "menuUrls": [
    {
      "url": "EXACT full URL found in HTML (e.g., ${url}/menu)",
      "confidence": 95,
      "reason": "Found button with text 'Menu' linking to /menu",
      "type": "direct|pdf|orderingsystem"
    }
  ],
  "contextClues": {
    "restaurantType": "identified type based on content",
    "menuKeywords": ["actual keywords found"],
    "hasOrderingSystem": false,
    "hasThirdPartyMenu": false,
    "hasPdfMenu": false
  },
  "debugInfo": {
    "foundMenuText": ["list of menu-related text found"],
    "foundButtons": ["list of button texts that contain menu"],
    "foundLinks": ["list of link texts that contain menu"]
  }
}

PRIORITY ORDER:
1. HTML pages with visible "Menu" buttons/links (confidence: 90-99, type: "direct")
2. PDF menu documents (confidence: 80-90, type: "pdf")
3. "Order" or "Food" HTML buttons (confidence: 70-85, type: "direct") 
4. Navigation menu HTML items (confidence: 60-75, type: "direct")
5. Other potential links (confidence: 30-50, type: "direct")

Return maximum 5 URLs, highest confidence first!`;

      console.log(`[Enhanced AI Search] Analyzing page structure for: ${url}`);
      const result = await callGeminiAPI(prompt, apiKey, 'enhanced menu search');
      
      if (!result.success) {
        console.warn(`[Enhanced AI Search] API call failed: ${result.error}`);
        return null;
      }
      
      // Extract JSON from response
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn(`[Enhanced AI Search] No valid JSON found in response for ${url}`);
        return null;
      }
      
      try {
        const parsedResult = JSON.parse(jsonMatch[0]);
        
        // Debug output
        if (parsedResult.debugInfo) {
          console.log(`[Enhanced AI Search Debug] Found menu text: ${JSON.stringify(parsedResult.debugInfo.foundMenuText)}`);
          console.log(`[Enhanced AI Search Debug] Found buttons: ${JSON.stringify(parsedResult.debugInfo.foundButtons)}`);
          console.log(`[Enhanced AI Search Debug] Found links: ${JSON.stringify(parsedResult.debugInfo.foundLinks)}`);
        }
        
        // Validate and normalize URLs
        if (parsedResult.menuUrls) {
          for (const menuUrl of parsedResult.menuUrls) {
            if (menuUrl.url && !menuUrl.url.startsWith('http')) {
              // Convert relative URLs to absolute
              try {
                const baseUrl = new URL(url);
                if (menuUrl.url.startsWith('/')) {
                  menuUrl.url = `${baseUrl.origin}${menuUrl.url}`;
                } else {
                  menuUrl.url = `${baseUrl.origin}/${menuUrl.url}`;
                }
              } catch (error) {
                console.warn(`[Enhanced AI Search] Could not normalize URL: ${menuUrl.url}`);
              }
            }
          }
        }
        
        console.log(`[Enhanced AI Search] Found ${parsedResult.menuUrls?.length || 0} potential menu URLs`);
        if (parsedResult.menuUrls && parsedResult.menuUrls.length > 0) {
          parsedResult.menuUrls.forEach((menuUrl, index) => {
            console.log(`[Enhanced AI Search] URL ${index + 1}: ${menuUrl.url} (confidence: ${menuUrl.confidence}%, reason: ${menuUrl.reason})`);
          });
        }
        
        return parsedResult;
        
      } catch (parseError) {
        console.error(`[Enhanced AI Search] JSON parse error: ${parseError.message}`);
        return null;
      }
      
    } catch (error) {
      console.error(`[Enhanced AI Search] Error: ${error.message}`);
      return null;
    }
  }

  /**
   * Check if a page is a menu using AI
   * @param {string} htmlContent - HTML content
   * @param {string} url - Page URL
   * @param {string} apiKey - Gemini API key
   * @param {boolean} deepAnalysis - Whether to perform deep analysis
   * @returns {Promise<Object|null>} Menu check result
   */
  async checkIfPageIsMenuWithAI(htmlContent, url, apiKey, deepAnalysis = false) {
    try {
      // Convert to text and get a larger sample for menu analysis
      const textContent = this.htmlToText(htmlContent);
      const sampleText = textContent.length > 20000 ? 
        textContent.substring(0, 20000) + '...[truncated]' : 
        textContent;
      
      let analysisInstructions = '';
      if (deepAnalysis) {
        analysisInstructions = `
DEEP ANALYSIS MODE - Also look for:
- Hidden or collapsed menu sections that need JavaScript to show
- Tab-based menu systems where content is loaded dynamically  
- Menu content that appears only after user interaction
- Embedded ordering widgets or iframes with menu content
- JSON-LD structured data with menu information`;
      }
      
      const prompt = `Analyze this webpage content and determine if it contains an actual restaurant menu with food items and prices.

URL: ${url}

Page Content:
${sampleText}

Look for these POSITIVE indicators of a MENU PAGE:
- ACTUAL food/drink item names with prices (e.g., "Caesar Salad $12.99")
- Clear menu categories like: appetizers, entrees, mains, desserts, drinks, etc.
- Multiple food items with prices or descriptions
- Menu-style formatting showing food items and prices
- Restaurant menu terminology with actual menu content${analysisInstructions}

MENU PAGE MUST HAVE:
- At least 3-5 actual food/drink items listed
- Clear indication this is a menu (not just food mentions)
- Menu structure with categories or organized food listings
- Prices OR detailed food descriptions

NOT A MENU PAGE if it has:
- ONLY contact info, hours, directions
- ONLY general restaurant description/about page  
- ONLY reviews, news, or blog posts
- ONLY reservation or event booking pages
- Just mentions of "menu" without actual menu content
- Navigation menus (website navigation, not food menu)
- Single food items or brief food mentions
- Just "View Menu" buttons without actual menu content

Be STRICT - only mark as menu page if it clearly contains actual menu items and food listings.
A homepage with just "View Our Menu" button is NOT a menu page.

Return ONLY a JSON object:
{
  "isMenu": true/false,
  "confidence": 0-100,
  "reason": "brief explanation focusing on what actual menu content was found",
  "menuItemsFound": 0-50
}`;

      const result = await callGeminiAPI(prompt, apiKey, 'menu page validation');
      
      if (!result.success) {
        console.warn(`[AI Menu Check] API failed for ${url}: ${result.error}`);
        return null;
      }
      
      // Extract JSON from response
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn(`[AI Menu Check] No valid JSON found in response for ${url}`);
        return null;
      }
      
      try {
        const parsedResult = JSON.parse(jsonMatch[0]);
        console.log(`[AI Menu Check] ${url} -> isMenu: ${parsedResult.isMenu}, confidence: ${parsedResult.confidence}%`);
        return parsedResult;
      } catch (parseError) {
        console.error(`[AI Menu Check] JSON parse error: ${parseError.message}`);
        return null;
      }
      
    } catch (error) {
      console.error(`[AI Menu Check] Error: ${error.message}`);
      return null;
    }
  }

  /**
   * Prepare HTML for Gemini analysis
   * @param {string} html - Raw HTML content
   * @returns {string} Enhanced HTML for AI analysis
   */
  prepareEnhancedHtmlForGemini(html) {
    // Remove scripts and styles but keep more structure
    let cleaned = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
    
    const importantElements = [];
    
    // Get ALL links first - don't filter yet, let AI decide!
    const linkPattern = /<a[^>]*href[^>]*>[\s\S]*?<\/a>/gi;
    const allLinks = cleaned.match(linkPattern) || [];
    importantElements.push(...allLinks);
    
    // Get ALL buttons and clickable elements
    const buttonPatterns = [
      /<button[^>]*>[\s\S]*?<\/button>/gi,
      /<input[^>]*type\s*=\s*["'](?:button|submit|image)["'][^>]*>/gi,
      /<div[^>]*(?:onclick|role\s*=\s*["']button["'])[^>]*>[\s\S]*?<\/div>/gi,
      /<span[^>]*(?:onclick|role\s*=\s*["']button["'])[^>]*>[\s\S]*?<\/span>/gi,
      /<div[^>]*class[^>]*(?:btn|button|click|menu-item|nav-item)[^>]*>[\s\S]*?<\/div>/gi,
      /<a[^>]*class[^>]*(?:btn|button|menu-btn|nav-btn)[^>]*>[\s\S]*?<\/a>/gi
    ];
    
    buttonPatterns.forEach(pattern => {
      const matches = cleaned.match(pattern) || [];
      importantElements.push(...matches);
    });
    
    // Navigation structures 
    const navPatterns = [
      /<nav[^>]*>[\s\S]*?<\/nav>/gi,
      /<header[^>]*>[\s\S]*?<\/header>/gi,
      /<footer[^>]*>[\s\S]*?<\/footer>/gi,
      /<div[^>]*class[^>]*(?:nav|menu|header|main-nav|primary-nav|navigation|topbar|menubar)[^>]*>[\s\S]*?<\/div>/gi,
      /<ul[^>]*class[^>]*(?:nav|menu|main-menu|primary-menu|navigation)[^>]*>[\s\S]*?<\/ul>/gi,
      /<ol[^>]*class[^>]*(?:nav|menu|main-menu|primary-menu|navigation)[^>]*>[\s\S]*?<\/ol>/gi
    ];
    
    navPatterns.forEach(pattern => {
      const matches = cleaned.match(pattern) || [];
      importantElements.push(...matches);
    });
    
    // Main content areas and sections
    const contentPatterns = [
      /<main[^>]*>[\s\S]*?<\/main>/gi,
      /<section[^>]*>[\s\S]*?<\/section>/gi,
      /<article[^>]*>[\s\S]*?<\/article>/gi,
      /<div[^>]*class[^>]*(?:content|main|hero|featured|banner|intro|home)[^>]*>[\s\S]*?<\/div>/gi,
      /<div[^>]*id[^>]*(?:content|main|hero|featured|banner|intro|home)[^>]*>[\s\S]*?<\/div>/gi
    ];
    
    contentPatterns.forEach(pattern => {
      const matches = cleaned.match(pattern) || [];
      importantElements.push(...matches);
    });
    
    // Remove duplicates and limit size
    const uniqueElements = [...new Set(importantElements)];
    let result = uniqueElements.join('\n').substring(0, 25000);
    
    if (result.length >= 25000) {
      result += '\n...[Content truncated for AI analysis]';
    }
    
    return result;
  }

  /**
   * Convert HTML to plain text
   * @param {string} html - HTML content
   * @returns {string} Plain text
   */
  htmlToText(html) {
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
  }
}

// Export singleton instance
const scraper = new PlaywrightScraper();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, closing browser...');
  await scraper.closeBrowser();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT, closing browser...');
  await scraper.closeBrowser();
  process.exit(0);
});

module.exports = scraper;
