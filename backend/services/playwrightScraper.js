/**
 * Playwright Web Scraper Service
 * Optimized for reliable menu extraction with reasonable performance
 */

// Load environment variables
require('dotenv').config();

const { chromium } = require('playwright');
const axios = require('axios');
const { callGeminiAPI } = require('./geminiHelper');

/**
 * Browser Pool for parallel browser operations
 * Manages multiple browser instances for 2-4x faster processing
 */
class BrowserPool {
  constructor(maxBrowsers = 3) {
    this.browsers = [];
    this.maxBrowsers = maxBrowsers;
    this.currentIndex = 0;
    this.isInitialized = false;
  }

  async init() {
    if (this.isInitialized) return;
    
    console.log(`🏭 Initializing browser pool with ${this.maxBrowsers} browsers...`);
    
    const browserConfigs = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images',
        '--disable-web-security',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-default-apps',
        '--disable-popup-blocking',
        '--disable-translate',
        '--disable-gpu',
        '--max-old-space-size=2048', // Lower memory per browser
        '--disable-background-networking',
        '--disable-component-extensions-with-background-pages',
        '--disable-ipc-flooding-protection',
        '--renderer-process-limit=5' // Lower process limit per browser
      ]
    };

    try {
      const browserPromises = Array(this.maxBrowsers).fill().map(async (_, index) => {
        console.log(`🌐 Launching browser ${index + 1}/${this.maxBrowsers}...`);
        return await chromium.launch(browserConfigs);
      });

      this.browsers = await Promise.all(browserPromises);
      this.isInitialized = true;
      console.log(`✅ Browser pool initialized successfully with ${this.browsers.length} browsers`);
    } catch (error) {
      console.error(`❌ Failed to initialize browser pool: ${error.message}`);
      console.log(`🔧 Falling back to single browser mode`);
      // Fallback: at least try to create one browser
      this.browsers = [await chromium.launch(browserConfigs)];
      this.maxBrowsers = 1;
      this.isInitialized = true;
    }
  }

  getBrowser() {
    if (!this.isInitialized || this.browsers.length === 0) {
      throw new Error('Browser pool not initialized');
    }
    
    const browser = this.browsers[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.browsers.length;
    return browser;
  }

  async getBrowserSafe() {
    await this.init();
    return this.getBrowser();
  }

  getStats() {
    return {
      initialized: this.isInitialized,
      browserCount: this.browsers.length,
      maxBrowsers: this.maxBrowsers
    };
  }

  async closeAll() {
    console.log(`🔒 Closing ${this.browsers.length} browsers in pool...`);
    const closePromises = this.browsers.map(async (browser, index) => {
      try {
        console.log(`🔒 Closing browser ${index + 1}...`);
        await browser.close();
      } catch (error) {
        console.error(`❌ Error closing browser ${index + 1}: ${error.message}`);
      }
    });
    
    await Promise.all(closePromises);
    this.browsers = [];
    this.isInitialized = false;
    console.log(`✅ All browsers closed`);
  }
}

class PlaywrightScraper {
  constructor() {
    this.browser = null; // Legacy single browser (fallback)
    this.browserPool = new BrowserPool(3); // NEW: Multiple browsers for parallel operations
    this.maxConcurrentPages = 15;
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
          '--disable-renderer-backgrounding',
          // Performance optimizations
          '--disable-extensions',
          '--disable-plugins',
          '--disable-images', // Skip loading images for faster loading
          '--disable-web-security',
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-default-apps',
          '--disable-popup-blocking',
          '--disable-translate',
          '--disable-gpu',
          // Multithreading optimizations
          '--max-old-space-size=4096',
          '--disable-background-networking',
          '--disable-component-extensions-with-background-pages',
          '--disable-ipc-flooding-protection',
          '--renderer-process-limit=10'
        ]
      });
      
      console.log('✅ Playwright browser initialized with performance optimizations');
      return this.browser;
    } catch (error) {
      console.error('❌ Failed to initialize browser:', error.message);
      throw error;
    }
  }

  async findAndScrapeMenu(url, options = {}) {
    console.log(`🔍 Starting AI-powered intelligent menu discovery for: ${url}`);
    
    // Initialize browser pool in background (non-blocking)
    try {
      if (!this.browserPool.isInitialized) {
        console.log(`🏭 Initializing browser pool in background...`);
        this.browserPool.init().catch(error => {
          console.warn(`⚠️ Browser pool initialization failed: ${error.message}`);
        });
      }
    } catch (error) {
      console.warn(`⚠️ Browser pool initialization error: ${error.message}`);
    }
    
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
              
              // Check if this is a PDF - PDFs don't have sub-menus, so skip comprehensive scraping
              if (url.toLowerCase().endsWith('.pdf') || url.toLowerCase().includes('.pdf')) {
                console.log(`📄 PDF confirmed as menu - skipping sub-menu discovery since PDFs don't have sub-menus`);
                return {
                  ...originalResult,
                  menuPageUrl: url,
                  discoveryMethod: 'original-url-ai-validated-pdf-direct',
                  discoveryTime: Date.now() - discoveryStartTime,
                  aiValidation: {
                    confidence: isMenuResult.confidence,
                    reason: isMenuResult.reason
                  }
                };
              }
              
              // For non-PDF URLs, check for sub-menus on this validated menu page (unless skipped for parallel processing)
              if (options.skipSubMenus) {
                console.log(`🔄 Skipping internal submenu processing for parallel worker distribution`);
                return {
                  ...originalResult,
                  menuPageUrl: url,
                  discoveryMethod: 'original-url-ai-validated-no-submenus',
                  discoveryTime: Date.now() - discoveryStartTime,
                  aiValidation: {
                    confidence: isMenuResult.confidence,
                    reason: isMenuResult.reason
                  }
                };
              }
              
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
          
          // Check if this is a PDF - PDFs don't have sub-menus, so skip comprehensive scraping
          if (url.toLowerCase().endsWith('.pdf') || url.toLowerCase().includes('.pdf')) {
            console.log(`📄 PDF without AI validation - skipping sub-menu discovery since PDFs don't have sub-menus`);
            return {
              ...originalResult,
              menuPageUrl: url,
              discoveryMethod: 'original-url-unvalidated-pdf-direct',
              discoveryTime: Date.now() - discoveryStartTime
            };
          }
          
          // Without AI validation, we'll still return the result but with lower confidence (unless skipped for parallel processing)
          if (options.skipSubMenus) {
            console.log(`🔄 Skipping internal submenu processing (unvalidated) for parallel worker distribution`);
            return {
              ...originalResult,
              menuPageUrl: url,
              discoveryMethod: 'original-url-unvalidated-no-submenus',
              discoveryTime: Date.now() - discoveryStartTime
            };
          }
          
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
            
            // Check if this is a PDF - PDFs don't have sub-menus, so skip comprehensive scraping
            if (aiMenuUrl.toLowerCase().endsWith('.pdf') || aiMenuUrl.toLowerCase().includes('.pdf')) {
              console.log(`📄 PDF discovered - skipping sub-menu discovery since PDFs don't have sub-menus`);
              return {
                ...result,
                url: url, // Keep original URL
                menuPageUrl: aiMenuUrl,
                discoveryMethod: 'ai-discovery-pdf-direct',
                discoveryTime: Date.now() - discoveryStartTime
              };
            }
            
            // For non-PDF URLs, check for sub-menus on this discovered menu page (unless skipped for parallel processing)
            if (options.skipSubMenus) {
              console.log(`🔄 Skipping internal submenu processing (AI-discovered) for parallel worker distribution`);
              return {
                ...result,
                url: url, // Keep original URL
                menuPageUrl: aiMenuUrl,
                discoveryMethod: 'ai-discovery-no-submenus',
                discoveryTime: Date.now() - discoveryStartTime
              };
            }
            
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
          // Check if this is a PDF - PDFs don't have sub-menus, so skip comprehensive scraping
          if (aiCommonResult.toLowerCase().endsWith('.pdf') || aiCommonResult.toLowerCase().includes('.pdf')) {
            console.log(`📄 PDF found via common path - skipping sub-menu discovery since PDFs don't have sub-menus`);
            return {
              ...result,
              url: url, // Keep original URL
              menuPageUrl: aiCommonResult,
              discoveryMethod: 'ai-common-path-pdf-direct',
              discoveryTime: Date.now() - discoveryStartTime
            };
          }
          
          // For non-PDF URLs, check for sub-menus on this common path menu page
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
    
    // Check if this is a PDF URL - PDFs don't have sub-menus, skip comprehensive scraping
    if (menuPageUrl.toLowerCase().endsWith('.pdf') || menuPageUrl.toLowerCase().includes('.pdf')) {
      console.log(`📄 PDF URL detected in comprehensive scraping - PDFs don't have sub-menus, skipping comprehensive scraping`);
      console.log(`🔄 Delegating to direct PDF parsing instead of comprehensive scraping`);
      
      const pdfParser = require('./pdfParser');
      return await pdfParser.parsePDFMenu(menuPageUrl, options);
    }
    
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
        
        // Step 3: PARALLEL processing of sub-menu links! 🚀
        // Use workers if available, otherwise parallel promises
        if (global.scrapingPool?.executeParallel) {
          console.log(`🏭 PARALLEL sub-menu processing with ${global.scrapingPool.workers.length} workers for ${subMenuLinks.length} sub-menus`);
          
          // Filter out already visited URLs
          const urlsToProcess = subMenuLinks.filter(link => !visitedUrls.has(link.url));
          
          if (urlsToProcess.length > 0) {
            const parallelResults = await global.scrapingPool.executeParallel(urlsToProcess, {
              ...options,
              skipDiscovery: true
            });
            
            // Process worker results
            for (const subResult of parallelResults) {
              if (subResult.success && subResult.data && subResult.data.menuItems) {
                if (subResult.data.isActualMenu && subResult.data.menuConfidence > 60) {
                  console.log(`✅ Worker sub-menu contains actual items: ${subResult.data.menuItems.length} items from ${subResult.category || 'Unknown'} (confidence: ${subResult.data.menuConfidence}%)`);
                } else {
                  console.log(`📝 Worker sub-menu is likely navigation page: ${subResult.data.menuItems.length} extracted items (confidence: ${subResult.data.menuConfidence}%)`);
                }
                
                const categorizedItems = subResult.data.menuItems.map(item => ({
                  ...item,
                  subMenuCategory: subResult.category || 'Menu',
                  sourceUrl: subResult.url,
                  isFromActualMenu: subResult.data.isActualMenu,
                  menuConfidence: subResult.data.menuConfidence,
                  processedByWorker: true
                }));
                
                allMenuItems.push(...categorizedItems);
                allCategories.push(...(subResult.data.categories || []));
                if (subResult.category) {
                  allCategories.push(subResult.category);
                }
                
                subMenuUrls.push({
                  url: subResult.url,
                  category: subResult.category,
                  itemCount: subResult.data.menuItems.length,
                  processedByWorker: true
                });
                
                visitedUrls.add(subResult.url);
              } else {
                console.log(`⚠️ Worker sub-menu returned no items: ${subResult.url}`);
              }
            }
          }
        } else {
          // FALLBACK: Parallel promises if no worker pool
          console.log(`💫 PARALLEL sub-menu processing with promises for ${subMenuLinks.length} sub-menus`);
          
          const subMenuPromises = subMenuLinks
            .filter(link => !visitedUrls.has(link.url))
            .map(async (subMenuLink) => {
              try {
                console.log(`📄 Scraping sub-menu: ${subMenuLink.url} (${subMenuLink.category || 'Unknown Category'})`);
                const subMenuResult = await this.scrapeMenuDataWithMenuDetection(subMenuLink.url, { 
                  ...options, 
                  skipDiscovery: true,
                  expectedCategory: subMenuLink.category 
                });
                return { link: subMenuLink, result: subMenuResult };
              } catch (error) {
                console.error(`❌ Error scraping sub-menu ${subMenuLink.url}: ${error.message}`);
                return { link: subMenuLink, result: null, error };
              }
            });
          
          const subMenuResults = await Promise.allSettled(subMenuPromises);
          
          // Process parallel promise results
          for (const promiseResult of subMenuResults) {
            if (promiseResult.status === 'fulfilled' && promiseResult.value.result) {
              const { link: subMenuLink, result: subMenuResult } = promiseResult.value;
              
              if (subMenuResult.success && subMenuResult.menuItems && subMenuResult.menuItems.length > 0) {
                if (subMenuResult.isActualMenu && subMenuResult.menuConfidence > 60) {
                  console.log(`✅ Parallel sub-menu contains actual items: ${subMenuResult.menuItems.length} items from ${subMenuLink.category || 'Unknown'} (confidence: ${subMenuResult.menuConfidence}%)`);
                } else {
                  console.log(`📝 Parallel sub-menu is likely navigation page: ${subMenuResult.menuItems.length} extracted items (confidence: ${subMenuResult.menuConfidence}%)`);
                }
                
                const categorizedItems = subMenuResult.menuItems.map(item => ({
                  ...item,
                  subMenuCategory: subMenuLink.category || 'Menu',
                  sourceUrl: subMenuLink.url,
                  isFromActualMenu: subMenuResult.isActualMenu,
                  menuConfidence: subMenuResult.menuConfidence,
                  processedByParallel: true
                }));
                
                allMenuItems.push(...categorizedItems);
                allCategories.push(...(subMenuResult.categories || []));
                if (subMenuLink.category) {
                  allCategories.push(subMenuLink.category);
                }
                
                subMenuUrls.push({
                  url: subMenuLink.url,
                  category: subMenuLink.category,
                  itemCount: subMenuResult.menuItems.length,
                  processedByParallel: true
                });
                
                visitedUrls.add(subMenuLink.url);
              } else {
                console.log(`⚠️ Parallel sub-menu returned no items: ${subMenuLink.url}`);
              }
            }
          }
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
        const parsedResult = this.parseRobustJSON(jsonMatch[0]);
        
        if (!parsedResult) {
          console.warn(`[Sub-Menu Discovery] Failed to parse JSON response`);
          return await this.findSubMenuLinksBasic(menuPageUrl, options);
        }
        
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
   * Set up optimized browser context with resource blocking for faster page loads
   * @param {Object} browser - Playwright browser instance
   * @param {Object} options - Context options
   * @returns {Promise<Object>} Optimized browser context
   */
  async createOptimizedContext(browser, options = {}) {
    const context = await browser.newContext({
      viewport: options.mobile ? { width: 375, height: 667 } : { width: 1920, height: 1080 },
      userAgent: options.mobile ? 
        'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1' :
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      ...options
    });

    // OPTIMIZATION: Smart resource blocking for faster loading while preserving AI context! 🚀
    await context.route('**/*', (route) => {
      const resourceType = route.request().resourceType();
      const url = route.request().url();
      
      // Block large images and media files (photos, videos) - these slow down loading but don't help AI
      if (resourceType === 'image' && (
        url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png') || 
        url.includes('.gif') || url.includes('.webp') || url.includes('.svg')
      )) {
        route.abort();
      }
      // Block large media files (videos, audio)
      else if (resourceType === 'media') {
        route.abort();
      }
      // Block tracking and analytics scripts (but allow menu-related scripts)
      else if (resourceType === 'script' && (
        url.includes('google-analytics') || 
        url.includes('googletagmanager') ||
        url.includes('facebook.net') ||
        url.includes('hotjar') ||
        url.includes('mixpanel') ||
        url.includes('segment.com') ||
        url.includes('google.com/recaptcha') ||
        url.includes('doubleclick.net')
      )) {
        route.abort();
      }
      else {
        // ALLOW: Stylesheets (help AI understand layout), fonts (help AI understand hierarchy), 
        // menu-related scripts, documents, xhr, fetch requests
        route.continue();
      }
    });

    return context;
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
      context = await this.createOptimizedContext(this.browser, { mobile: options.mobile });
      
      page = await context.newPage();
      await page.goto(menuPageUrl, { 
        waitUntil: 'domcontentloaded',
        timeout: options.timeout || 30000 // Reduced to 30 seconds default
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
      context = await this.createOptimizedContext(this.browser, { mobile: options.mobile });
      
      page = await context.newPage();
      await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: options.timeout || 30000 // Reduced to 30 seconds default
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
      context = await this.createOptimizedContext(browser, { mobile: options.mobile });
      
      page = await context.newPage();
      page.setDefaultTimeout(30000); // Reduced to 30 seconds
      page.setDefaultNavigationTimeout(30000); // Reduced to 30 seconds
      
      console.log(`🌐 Navigating to: ${url}`);
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: 30000 // Reduced to 30 seconds
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
            const parsed = this.parseRobustJSON(jsonMatch[0]);
            
            if (parsed) {
              return {
                isMenu: !!parsed.isMenu,
                confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 50,
                reason: parsed.reason || 'AI analysis completed',
                itemsDetected: parsed.itemsDetected || 0,
                categoryMatch: !!parsed.categoryMatch
              };
            }
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
      context = await this.createOptimizedContext(browser, { mobile: options.mobile });
      
      page = await context.newPage();
      
      // Set reduced timeouts for faster failure detection
      page.setDefaultTimeout(30000); // Reduced to 30 seconds
      page.setDefaultNavigationTimeout(30000); // Reduced to 30 seconds
      
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
        timeout: 30000 // Reduced to 30 seconds
      });
      
      // Wait for selector if provided
      if (options.waitForSelector) {
        try {
          await page.waitForSelector(options.waitForSelector, { 
            timeout: 30000,
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
        // ADVANCED MULTI-STRATEGY MENU EXTRACTION SYSTEM 🚀
        const results = {
          menuItems: [],
          categories: [],
          restaurantInfo: {},
          rawText: '',
          extractionStrategy: 'unknown',
          confidence: 0
        };

        // Get page title and basic info
        results.restaurantInfo.name = document.title;
        results.restaurantInfo.url = window.location.href;

        // ========== STRATEGY 1: STRUCTURED DATA EXTRACTION ==========
        const extractFromStructuredData = () => {
          const items = [];
          
          // JSON-LD Schema.org data
          const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
          jsonLdScripts.forEach(script => {
            try {
              const data = JSON.parse(script.textContent);
              const extractFromSchema = (obj) => {
                if (obj['@type'] === 'MenuItem' || obj['@type'] === 'Product') {
                  items.push({
                    name: obj.name || '',
                    price: obj.offers?.price || obj.price || '',
                    description: obj.description || '',
                    category: obj.category || '',
                    fullText: JSON.stringify(obj),
                    strategy: 'json-ld'
                  });
                }
                // Recursively search nested objects
                if (typeof obj === 'object' && obj !== null) {
                  Object.values(obj).forEach(value => {
                    if (Array.isArray(value)) {
                      value.forEach(extractFromSchema);
                    } else if (typeof value === 'object') {
                      extractFromSchema(value);
                    }
                  });
                }
              };
              extractFromSchema(data);
            } catch (e) { /* Invalid JSON */ }
          });

          // Microdata extraction
          document.querySelectorAll('[itemscope][itemtype*="MenuItem"], [itemscope][itemtype*="Product"]').forEach(item => {
            const name = item.querySelector('[itemprop="name"]')?.textContent?.trim() || '';
            const price = item.querySelector('[itemprop="price"], [itemprop="lowPrice"], [itemprop="offers"] [itemprop="price"]')?.textContent?.trim() || '';
            const description = item.querySelector('[itemprop="description"]')?.textContent?.trim() || '';
            
            if (name) {
              items.push({
                name,
                price,
                description,
                fullText: item.textContent?.trim() || '',
                strategy: 'microdata'
              });
            }
          });

          return items;
        };

        // ========== STRATEGY 2: TABLE EXTRACTION ==========
        const extractFromTables = () => {
          const items = [];
          const tables = document.querySelectorAll('table');
          
          tables.forEach(table => {
            const rows = table.querySelectorAll('tr');
            if (rows.length < 2) return;

            rows.forEach((row, index) => {
              if (index === 0) return; // Skip header row
              
              const cells = row.querySelectorAll('td, th');
              if (cells.length >= 2) {
                const nameCell = cells[0]?.textContent?.trim() || '';
                const priceCell = cells[cells.length - 1]?.textContent?.trim() || '';
                const descCell = cells.length > 2 ? cells[1]?.textContent?.trim() : '';
                
                // Check if this looks like a menu item
                if (nameCell && (priceCell.match(/[$£€¥₹][\d,]+\.?\d*/) || descCell.length > 10)) {
                  items.push({
                    name: nameCell,
                    price: priceCell,
                    description: descCell,
                    fullText: row.textContent?.trim() || '',
                    strategy: 'table'
                  });
                }
              }
            });
          });

          return items;
        };

        // ========== STRATEGY 3: LIST EXTRACTION ==========
        const extractFromLists = () => {
          const items = [];
          const lists = document.querySelectorAll('ul, ol, dl');
          
          lists.forEach(list => {
            const listItems = list.querySelectorAll('li, dt');
            if (listItems.length < 3) return; // Skip small lists
            
            listItems.forEach(li => {
              const text = li.textContent?.trim() || '';
              if (text.length < 10) return;
              
              // Enhanced price detection
              const priceRegex = /(?:[$£€¥₹]\s*)?(?:\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d+(?:\.\d{2})?)(?:\s*[$£€¥₹])?/g;
              const prices = text.match(priceRegex) || [];
              
              if (prices.length > 0 || text.length > 20) {
                const lines = text.split(/[\n\r•·–—]/).map(l => l.trim()).filter(l => l.length > 0);
                const name = lines[0] || text.substring(0, 80);
                const price = prices[0] || '';
                const description = lines.slice(1).join(' ').substring(0, 200);
                
                items.push({
                  name,
                  price,
                  description,
                  fullText: text,
                  strategy: 'list'
                });
              }
            });
          });

          return items;
        };

        // ========== STRATEGY 4: CONTENT DENSITY ANALYSIS ==========
        const extractFromContentDensity = () => {
          const items = [];
          
          // Find areas with high menu-like content density
          const candidates = document.querySelectorAll('div, section, article, main');
          let bestContainer = null;
          let bestScore = 0;
          
          candidates.forEach(container => {
            const text = container.textContent || '';
            const priceMatches = (text.match(/[$£€¥₹][\d,]+\.?\d*/g) || []).length;
            const menuWords = (text.match(/\b(appetizer|entree|main|dessert|drink|special|combo|meal)\b/gi) || []).length;
            const textLength = text.length;
            
            if (textLength > 200 && textLength < 10000) {
              const score = (priceMatches * 10) + (menuWords * 5) + (textLength / 100);
              if (score > bestScore) {
                bestScore = score;
                bestContainer = container;
              }
            }
          });

          if (bestContainer) {
            // Enhanced extraction within the best container
            const menuSelectors = [
              '[class*="menu"] > *', '[class*="item"]', '[class*="dish"]', '[class*="food"]',
              '[class*="product"]', '.card', '.listing', 'article', '[role="listitem"]',
              'p:has([class*="price"]), div:has([class*="price"])'
            ];

            const elements = bestContainer.querySelectorAll(menuSelectors.join(','));
            const seenTexts = new Set();

            elements.forEach(element => {
              const text = element.textContent?.trim() || '';
              if (text.length < 15 || text.length > 500 || seenTexts.has(text)) return;
              seenTexts.add(text);

              // Advanced price extraction
              const priceRegex = /(?:[$£€¥₹]\s*)?(?:\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d+(?:\.\d{2})?)(?:\s*[$£€¥₹])?/g;
              const prices = text.match(priceRegex) || [];
              
              // Smart name/description separation
              const lines = text.split(/[\n\r•·–—]/).map(l => l.trim()).filter(l => l.length > 0);
              const name = lines[0]?.replace(/[$£€¥₹][\d,]+\.?\d*/g, '').trim() || '';
              const price = prices[0] || '';
              const description = lines.slice(1).join(' ').replace(/[$£€¥₹][\d,]+\.?\d*/g, '').trim();

              if (name.length > 2 && (price || description.length > 10)) {
                items.push({
                  name,
                  price,
                  description,
                  fullText: text,
                  strategy: 'content-density'
                });
              }
            });
          }

          return items;
        };

        // ========== STRATEGY 5: ORIGINAL EXTRACTION (COMPATIBILITY) ==========
        const extractFromOriginalMethod = () => {
          const items = [];
          
          // Original menu selectors (preserve all original logic)
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

          // Extract menu items using original logic
          const menuElements = document.querySelectorAll(menuSelectors.join(','));
          const seenItems = new Set();

          menuElements.forEach((element, index) => {
            const text = element.textContent?.trim();
            if (!text || text.length < 5 || seenItems.has(text)) return;
            
            // Look for price in element (original logic)
            let price = '';
            const priceElement = element.querySelector(priceSelectors.join(','));
            if (priceElement) {
              price = priceElement.textContent?.trim() || '';
            } else {
              // Look for price pattern in text
              const priceMatch = text.match(/[$£€¥₹][\d,]+\.?\d*/);
              if (priceMatch) price = priceMatch[0];
            }

            // Extract name (original logic)
            const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            const name = lines[0] || text.substring(0, 100);
            
            if (name.length > 2) {
              items.push({
                name: name,
                price: price,
                description: lines.slice(1).join(' ').substring(0, 200),
                fullText: text.substring(0, 300),
                strategy: 'original'
              });
              seenItems.add(text);
            }
          });

          return items;
        };

        // ========== STRATEGY 6: VISUAL HIERARCHY ANALYSIS ==========
        const extractFromVisualHierarchy = () => {
          const items = [];
          
          // Find elements with menu-like visual patterns
          const allElements = document.querySelectorAll('*');
          const menuLikeElements = [];

          allElements.forEach(el => {
            const style = window.getComputedStyle(el);
            const text = el.textContent?.trim() || '';
            
            // Check for menu-like visual patterns
            const hasPrice = /[$£€¥₹][\d,]+\.?\d*/.test(text);
            const isCard = style.border !== 'none' || style.boxShadow !== 'none';
            const isFlexItem = style.display === 'flex' || style.display === 'inline-flex';
            const hasGoodSize = text.length > 15 && text.length < 300;
            
            if (hasPrice && hasGoodSize && (isCard || isFlexItem)) {
              menuLikeElements.push(el);
            }
          });

          // Process menu-like elements
          menuLikeElements.forEach(el => {
            const text = el.textContent?.trim() || '';
            const priceMatch = text.match(/[$£€¥₹][\d,]+\.?\d*/);
            
            if (priceMatch) {
              const cleanText = text.replace(/[$£€¥₹][\d,]+\.?\d*/g, '').trim();
              const parts = cleanText.split(/[\n\r•·–—]/).map(p => p.trim()).filter(p => p.length > 0);
              
              items.push({
                name: parts[0] || cleanText.substring(0, 80),
                price: priceMatch[0],
                description: parts.slice(1).join(' ').substring(0, 200),
                fullText: text,
                strategy: 'visual-hierarchy'
              });
            }
          });

          return items;
        };

        // ========== STRATEGY 7: AGGRESSIVE TEXT MINING ==========
        const extractFromAggressiveTextMining = () => {
          const items = [];
          
          // Very liberal extraction for AI to filter later
          const allTextNodes = document.querySelectorAll('p, div, span, li, td, th, section, article');
          
          allTextNodes.forEach(node => {
            const text = node.textContent?.trim() || '';
            if (text.length < 10 || text.length > 800) return;
            
            // Look for any text with price-like patterns
            const priceRegex = /(?:[$£€¥₹€]\s*)?(?:\d{1,4}(?:[,.]\d{2,3})*(?:[,.]\d{2})?|\d+(?:[,.]\d{2})?)(?:\s*[$£€¥₹€])?/g;
            const prices = text.match(priceRegex) || [];
            
            // If has price OR is substantial text that could be a menu item
            if (prices.length > 0 || (text.length > 20 && text.length < 200)) {
              // Split by common separators
              const lines = text.split(/[\n\r•·–—\|\t]/).map(l => l.trim()).filter(l => l.length > 5);
              
              lines.forEach(line => {
                if (line.length > 8 && line.length < 300) {
                  const linePrice = line.match(priceRegex)?.[0] || '';
                  const cleanName = line.replace(priceRegex, '').trim();
                  
                  if (cleanName.length > 3) {
                    items.push({
                      name: cleanName.substring(0, 100),
                      price: linePrice,
                      description: '',
                      fullText: line,
                      strategy: 'aggressive-mining'
                    });
                  }
                }
              });
            }
          });

          return items;
        };

        // ========== EXECUTE ALL STRATEGIES ==========
        const strategies = [
          { name: 'structured-data', func: extractFromStructuredData },
          { name: 'tables', func: extractFromTables },
          { name: 'lists', func: extractFromLists },
          { name: 'content-density', func: extractFromContentDensity },
          { name: 'original', func: extractFromOriginalMethod },
          { name: 'visual-hierarchy', func: extractFromVisualHierarchy },
          { name: 'aggressive-mining', func: extractFromAggressiveTextMining }
        ];

        let allResults = [];
        let bestStrategy = 'none';
        let bestCount = 0;

        strategies.forEach(strategy => {
          try {
            const items = strategy.func();
            if (items.length > bestCount) {
              bestCount = items.length;
              bestStrategy = strategy.name;
            }
            allResults = allResults.concat(items.map(item => ({ ...item, strategy: strategy.name })));
          } catch (error) {
            console.log(`Strategy ${strategy.name} failed:`, error);
          }
        });

        // ========== MERGE AND DEDUPLICATE RESULTS ==========
        const finalItems = [];
        const seenNames = new Set();

        // Prioritize high-quality extractions but include everything for AI filtering
        const priorityOrder = ['structured-data', 'tables', 'content-density', 'original', 'lists', 'visual-hierarchy', 'aggressive-mining'];
        
        priorityOrder.forEach(strategyName => {
          allResults.filter(item => item.strategy === strategyName).forEach(item => {
            const normalizedName = item.name.toLowerCase().replace(/[^\w\s]/g, '').trim();
            // More liberal deduplication - only skip exact duplicates
            if (!seenNames.has(normalizedName) && item.name.length > 1) {
              seenNames.add(normalizedName);
              finalItems.push(item);
            }
          });
        });

        results.menuItems = finalItems.slice(0, 200); // Increased limit for AI filtering
        results.extractionStrategy = bestStrategy;
        results.confidence = Math.min(95, finalItems.length * 5);

        // Enhanced category extraction
        const categorySelectors = [
          'h1, h2, h3, h4, h5, h6',
          '[class*="category"]', '[class*="section"]', '[class*="heading"]',
          '[class*="menu-section"]', '.title', '.section-title',
          '[role="heading"]', '[aria-label*="section"]'
        ];

        const categories = new Set();
        document.querySelectorAll(categorySelectors.join(',')).forEach(element => {
          const text = element.textContent?.trim();
          if (text && text.length > 2 && text.length < 100 && 
              !text.match(/[$£€¥₹][\d,]+\.?\d*/) && // Not a price
              !text.toLowerCase().includes('copyright')) {
            categories.add(text);
          }
        });

        results.categories = Array.from(categories).slice(0, 25);
        results.rawText = document.body.innerText?.substring(0, 8000) || '';

        return results;
      });

      // Post-process and validate (already done in new system)
      const uniqueCategories = [...new Set(menuData.categories)].slice(0, 25);
      menuData.categories = uniqueCategories;

      console.log(`🚀 ADVANCED EXTRACTION: ${menuData.menuItems.length} items, ${menuData.categories.length} categories`);
      console.log(`📊 Best strategy: ${menuData.extractionStrategy} (confidence: ${menuData.confidence}%)`);
      
      if (menuData.menuItems.length > 0) {
        console.log(`✅ Sample items: ${menuData.menuItems.slice(0, 3).map(item => `"${item.name}" (${item.strategy})`).join(', ')}`);
      }
      
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
    console.log('🔒 Closing all browsers...');
    
    // Close browser pool first
    try {
      await this.browserPool.closeAll();
    } catch (error) {
      console.error('❌ Error closing browser pool:', error.message);
    }
    
    // Close legacy browser
    if (this.browser) {
      try {
        await this.browser.close();
        console.log('🔒 Legacy browser closed');
      } catch (error) {
        console.warn('⚠️ Legacy browser close error:', error.message);
      } finally {
        this.browser = null;
        this.activeScrapes.clear();
      }
    }
    
    console.log('✅ All browsers closed successfully');
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
      console.log(`[JSON Parser] Standard parse failed: ${error.message}`);
      
      try {
        // Clean common JSON issues including control characters
        let cleaned = jsonString
          // Remove trailing commas before closing brackets/braces
          .replace(/,(\s*[}\]])/g, '$1')
          // Fix common quote issues
          .replace(/'/g, '"')
          // Remove comments
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/\/\/.*$/gm, '')
          // Fix control characters in strings
          .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
          // Fix unescaped quotes within strings (basic attempt)
          .replace(/"([^"]*)"([^"]*)"([^"]*)":/g, '"$1$2$3":')
          // Escape backslashes that aren't already escaped
          .replace(/\\(?!["\\/bfnrt])/g, '\\\\')
          // Trim whitespace
          .trim();
        
        // Try parsing the cleaned version
        return JSON.parse(cleaned);
      } catch (cleanError) {
        console.log(`[JSON Parser] Cleaned parse failed: ${cleanError.message}`);
        
        try {
          // Extract just the JSON object/array part
          const jsonMatch = cleaned.match(/[\{\[][\s\S]*[\}\]]/);
          if (jsonMatch) {
            let extracted = jsonMatch[0];
            
            // Fix trailing commas in the extracted part
            extracted = extracted.replace(/,(\s*[}\]])/g, '$1');
            
            // Additional control character cleaning for extracted JSON
            extracted = extracted.replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ');
            
            return JSON.parse(extracted);
          }
        } catch (extractError) {
          console.log(`[JSON Parser] Extract parse failed: ${extractError.message}`);
        }
        
        // Last resort: try to fix specific control character issues
        try {
          let lastResort = jsonString
            .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ') // Remove all control characters
            .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
            .replace(/\\n/g, ' ') // Replace literal \n with space
            .replace(/\\t/g, ' ') // Replace literal \t with space
            .replace(/\\r/g, ' ') // Replace literal \r with space
            .replace(/\n/g, ' ') // Replace actual newlines with space
            .replace(/\t/g, ' ') // Replace actual tabs with space
            .replace(/\r/g, ' ') // Replace actual carriage returns with space
            .replace(/\s+/g, ' ') // Collapse multiple spaces
            .replace(/([{,]\s*)(\w+):/g, '$1"$2":')  // Quote unquoted keys
            .replace(/:\s*([^",\[\{\d][^",\[\}]*[^",\]\}])\s*([,\}])/g, ': "$1"$2')  // Quote unquoted string values
            .trim();
          
          // Extract JSON from the cleaned string
          const match = lastResort.match(/[\{\[][\s\S]*[\}\]]/);
          if (match) {
            return JSON.parse(match[0]);
          }
        } catch (lastResortError) {
          console.log(`[JSON Parser] Last resort parse failed: ${lastResortError.message}`);
        }
        
        console.error(`[JSON Parser] All parsing attempts failed for: ${jsonString.substring(0, 200)}...`);
        return null;
      }
    }
  }

  getStats() {
    const browserPoolStats = this.browserPool.getStats();
    
    return {
      activeScrapes: this.activeScrapes.size,
      maxConcurrent: this.maxConcurrentPages,
      browserActive: !!this.browser,
      browserPool: {
        initialized: browserPoolStats.initialized,
        browserCount: browserPoolStats.browserCount,
        maxBrowsers: browserPoolStats.maxBrowsers
      }
    };
  }



  /**
   * Get common menu URLs without testing them
   * @param {string} baseUrl - Base URL 
   * @returns {Array<string>} Array of common menu URLs to test
   */
  getCommonMenuUrls(baseUrl) {
    const commonPaths = [
      '/menu', '/menus', '/food', '/food-menu', '/dining',
      '/restaurant-menu', '/our-menu', '/lunch-menu', '/dinner-menu',
      '/takeout', '/delivery', '/order'
    ];
    
    try {
      const urlObj = new URL(baseUrl);
      return commonPaths.map(path => `${urlObj.origin}${path}`);
    } catch (error) {
      console.log(`Error generating common URLs: ${error.message}`);
      return [];
    }
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
        // OPTIMIZATION: Process AI-discovered URLs in parallel instead of sequentially! 🚀
        console.log(`[AI Search] ⚡ PARALLEL testing ${menuSearchResult.menuUrls.length} AI-discovered URLs...`);
        
        // Quick check for high-confidence PDFs first (no network call needed)
        for (const suggestion of menuSearchResult.menuUrls) {
          if ((suggestion.type === 'pdf' || suggestion.url.toLowerCase().endsWith('.pdf')) && suggestion.confidence > 80) {
            console.log(`[AI Search] ✓ High-confidence PDF menu found: ${suggestion.url} (confidence: ${suggestion.confidence}%)`);
            return suggestion.url;
          }
        }
        
        // Filter out already visited URLs and PDFs for parallel processing
        const urlsToTest = menuSearchResult.menuUrls.filter(suggestion => {
          if (visitedUrls.has(suggestion.url)) {
            console.log(`[AI Search] Skipping already visited: ${suggestion.url}`);
            return false;
          }
          // Don't include PDFs in parallel testing (handled above)
          if (suggestion.type === 'pdf' || suggestion.url.toLowerCase().endsWith('.pdf')) {
            return false;
          }
          return true;
        });
        
        if (urlsToTest.length > 0) {
          // PARALLEL CONTENT FETCHING: Use workers if available, otherwise parallel promises
          let contentResults = [];
          if (global.scrapingPool?.executeContentFetches) {
            console.log(`[AI Search] 🏭 Using worker pool for ${urlsToTest.length} URLs`);
            const workerResults = await global.scrapingPool.executeContentFetches(
              urlsToTest.map(s => s.url), 
              { ...options, timeout: 8000 }
            );
            contentResults = workerResults.map((result, index) => ({
              url: urlsToTest[index].url,
              suggestion: urlsToTest[index],
              content: result.success ? result.content : null,
              success: result.success
            }));
          } else {
            console.log(`[AI Search] 💫 Using parallel promises for ${urlsToTest.length} URLs`);
            const contentPromises = urlsToTest.map(async (suggestion) => {
              try {
                const content = await this.fetchPageContentForAI(suggestion.url, { ...options, timeout: 8000 });
                return { url: suggestion.url, suggestion, content, success: !!content };
              } catch (error) {
                return { url: suggestion.url, suggestion, content: null, success: false };
              }
            });
            contentResults = await Promise.allSettled(contentPromises);
            contentResults = contentResults.map(result => 
              result.status === 'fulfilled' ? result.value : { success: false }
            ).filter(r => r.success);
          }
          
          // PARALLEL AI VALIDATION: Process successful fetches in parallel
          const validationPromises = contentResults
            .filter(result => result.success && result.content)
            .map(async (result) => {
              try {
                console.log(`[AI Search] 🤖 AI validating: ${result.url} (confidence: ${result.suggestion.confidence}%)`);
                const isMenuResult = await this.checkIfPageIsMenuWithAI(result.content, result.url, apiKey);
                return { ...result, isMenuResult };
              } catch (error) {
                console.warn(`[AI Search] Validation error for ${result.url}: ${error.message}`);
                return { ...result, isMenuResult: null };
              }
            });
          
          const validationResults = await Promise.allSettled(validationPromises);
          
          // Find the best menu page from parallel results
          for (const result of validationResults) {
            if (result.status === 'fulfilled') {
              const { isMenuResult, url, suggestion } = result.value;
              if (isMenuResult && isMenuResult.isMenu && isMenuResult.confidence > 75) {
                console.log(`[AI Search] ✅ PARALLEL discovery success: ${url} (AI confidence: ${isMenuResult.confidence}%, original: ${suggestion.confidence}%)`);
                console.log(`[AI Search] Reason: ${isMenuResult.reason}`);
                return url;
              }
            }
          }
          
          console.log(`[AI Search] ❌ No valid menu pages found in parallel testing of ${urlsToTest.length} URLs`);
        }
        
      } else {
        console.log(`[AI Search] Enhanced AI Search found no menu URLs for: ${currentUrl}`);
        
        // If AI found menu-related text but no URLs, try the basic method as backup
        if (menuSearchResult && menuSearchResult.debugInfo && 
            (menuSearchResult.debugInfo.foundMenuText?.length > 0 || 
             menuSearchResult.debugInfo.foundButtons?.length > 0 || 
             menuSearchResult.debugInfo.foundLinks?.length > 0 ||
             menuSearchResult.debugInfo.foundClickableDivs?.length > 0)) {
          console.log(`[AI Search] AI found menu-related content but no URLs. Trying basic link extraction as backup...`);
          
          // Special case: If we found clickable divs with menu text, try common menu paths
          if (menuSearchResult.debugInfo.foundClickableDivs?.length > 0) {
            console.log(`[AI Search] Found clickable menu divs, trying common menu paths...`);
            const baseUrl = new URL(currentUrl);
            const commonPaths = ['/menu', '/food', '/our-menu', '/dining', '/eat'];
            
            for (const path of commonPaths) {
              const testUrl = `${baseUrl.origin}${path}`;
              if (!visitedUrls.has(testUrl)) {
                console.log(`[AI Search] Testing common path after finding menu div: ${testUrl}`);
                const testContent = await this.fetchPageContentForAI(testUrl, options);
                if (testContent) {
                  const isMenuResult = await this.checkIfPageIsMenuWithAI(testContent, testUrl, apiKey);
                  if (isMenuResult && isMenuResult.isMenu && isMenuResult.confidence > 40) {
                    console.log(`[AI Search] ✓ Found menu via common path after div detection: ${testUrl} (confidence: ${isMenuResult.confidence}%)`);
                    return testUrl;
                  }
                }
              }
            }
          }
          
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
   * Fetch page content for AI analysis using Playwright with Browser Pool
   * @param {string} url - URL to fetch
   * @param {Object} options - Scraping options
   * @param {Object} browserOverride - Optional specific browser to use
   * @returns {Promise<string|null>} HTML content or null if failed
   */
  async fetchPageContentForAI(url, options = {}, browserOverride = null) {
    // Check if this is a PDF URL - PDFs cannot be loaded as HTML pages
    if (url.toLowerCase().endsWith('.pdf') || url.toLowerCase().includes('.pdf')) {
      console.log(`📄 PDF URL detected in fetchPageContentForAI, skipping HTML fetch: ${url}`);
      return null; // Return null for PDF URLs since they can't be fetched as HTML
    }

    let context = null;
    let page = null;
    let browser = browserOverride;
    
    try {
      // Use browser pool for better parallel performance
      if (!browser) {
        try {
          browser = await this.browserPool.getBrowserSafe();
          console.log(`🌐 Using browser pool for: ${url}`);
        } catch (error) {
          console.log(`⚠️ Browser pool unavailable, falling back to legacy browser: ${error.message}`);
          await this.initBrowser();
          browser = this.browser;
        }
      }
      
      context = await browser.newContext({
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
        timeout: options.timeout || 20000 // Reduced timeout for faster parallel processing
      });
      
      // Reduced wait time for faster parallel processing
      await page.waitForTimeout(1500);
      
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
      
      const prompt = `Find menu links on this restaurant website.

Website URL: ${url}

HTML Content:
${enhancedHtml}

IMPORTANT: Prioritize navigation bar elements first! Navigation bars are the most likely place for menu links.

Find any links, buttons, or clickable elements that lead to the restaurant's menu. Look for:

PRIORITY 1 - NAVIGATION ELEMENTS:
- Links in navigation bars, headers, main menus
- Primary site navigation containing "menu", "food", "order", "dining"
- Top-level navigation items (usually most reliable)

PRIORITY 2 - OTHER ELEMENTS:
- Text containing "menu", "food", "order", "dining", "takeout", "delivery"
- PDF menu links
- Call-to-action buttons for ordering/menus
- Secondary navigation elements

Give higher confidence scores (80-95%) to links found in navigation elements.
Give lower confidence scores (60-80%) to links found elsewhere on the page.

Return a JSON object:
{
  "menuUrls": [
    {
      "url": "full URL",
      "confidence": 90,
      "reason": "Found in main navigation bar",
      "type": "navigation"
    }
  ]
}`;

      console.log(`[Enhanced AI Search] 🧭 Analyzing page structure with NAVIGATION PRIORITY for: ${url}`);
      
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
        const parsedResult = this.parseRobustJSON(jsonMatch[0]);
        
        if (!parsedResult) {
          console.warn(`[Enhanced AI Search] Failed to parse JSON response for ${url}`);
          return null;
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
            const isNavigation = menuUrl.type === 'navigation' || menuUrl.reason?.toLowerCase().includes('navigation') || menuUrl.reason?.toLowerCase().includes('nav');
            const navIcon = isNavigation ? '🧭 ' : '';
            const priorityTag = isNavigation ? ' [NAV PRIORITY]' : '';
            console.log(`[Enhanced AI Search] ${navIcon}URL ${index + 1}: ${menuUrl.url} (confidence: ${menuUrl.confidence}%, reason: ${menuUrl.reason})${priorityTag}`);
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
        const parsedResult = this.parseRobustJSON(jsonMatch[0]);
        
        if (!parsedResult) {
          console.warn(`[AI Menu Check] Failed to parse JSON response for ${url}`);
          return null;
        }
        
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
    
    // PRIORITY 1: NAVIGATION ELEMENTS (Most likely to contain menu links) 🚀
    const navigationElements = [];
    
    // Primary navigation sections
    const navPattern = /<nav[^>]*>[\s\S]*?<\/nav>/gi;
    const navSections = cleaned.match(navPattern) || [];
    navigationElements.push(...navSections);
    
    // Header sections (often contain main navigation)
    const headerPattern = /<header[^>]*>[\s\S]*?<\/header>/gi;
    const headerSections = cleaned.match(headerPattern) || [];
    navigationElements.push(...headerSections);
    
    // Elements with navigation-related classes/IDs
    const navClassPattern = /<[^>]*(?:class|id)="[^"]*(?:nav|menu|header|topbar|main-menu|primary-menu|site-nav)[^"]*"[^>]*>[\s\S]*?<\/[^>]+>/gi;
    const navClassElements = cleaned.match(navClassPattern) || [];
    navigationElements.push(...navClassElements);
    
    // Elements with navigation-related roles
    const navRolePattern = /<[^>]*role="(?:navigation|menubar|banner)"[^>]*>[\s\S]*?<\/[^>]+>/gi;
    const navRoleElements = cleaned.match(navRolePattern) || [];
    navigationElements.push(...navRoleElements);
    
    // Top-level ul elements (often used for main navigation)
    const topUlPattern = /<ul[^>]*(?:class|id)="[^"]*(?:nav|menu|main)[^"]*"[^>]*>[\s\S]*?<\/ul>/gi;
    const topUlElements = cleaned.match(topUlPattern) || [];
    navigationElements.push(...topUlElements);
    
    // PRIORITY 2: OTHER IMPORTANT ELEMENTS
    const otherElements = [];
    
    // Get ALL links (after navigation priority)
    const linkPattern = /<a[^>]*>[\s\S]*?<\/a>/gi;
    const allLinks = cleaned.match(linkPattern) || [];
    otherElements.push(...allLinks);
    
    // Get ALL buttons
    const buttonPattern = /<button[^>]*>[\s\S]*?<\/button>/gi;
    const allButtons = cleaned.match(buttonPattern) || [];
    otherElements.push(...allButtons);
    
    // Get clickable divs that contain "menu" text
    const menuDivPattern = /<div[^>]*>[\s\S]*?[Mm][Ee][Nn][Uu][\s\S]*?<\/div>/gi;
    const menuDivs = cleaned.match(menuDivPattern) || [];
    otherElements.push(...menuDivs);
    
    // Combine with NAVIGATION FIRST for AI priority
    const uniqueNavElements = [...new Set(navigationElements)];
    const uniqueOtherElements = [...new Set(otherElements)];
    
    // Navigation elements get priority in content sent to AI
    let result = '';
    if (uniqueNavElements.length > 0) {
      result += '<!-- PRIORITY: NAVIGATION ELEMENTS -->\n';
      result += uniqueNavElements.join('\n\n') + '\n\n';
      console.log(`🧭 Prioritizing ${uniqueNavElements.length} navigation elements for AI analysis`);
    }
    
    // Add other elements if space allows
    const remainingSpace = 25000 - result.length;
    if (remainingSpace > 1000 && uniqueOtherElements.length > 0) {
      result += '<!-- OTHER PAGE ELEMENTS -->\n';
      const otherContent = uniqueOtherElements.join('\n\n');
      result += otherContent.substring(0, remainingSpace - 200);
    }
    
    if (result.length >= 25000) {
      result = result.substring(0, 25000) + '\n...[Content truncated for AI analysis]';
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
