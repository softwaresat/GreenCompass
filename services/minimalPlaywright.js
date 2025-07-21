/**
 * Lightweight Playwright configuration optimized for weak servers
 * Minimal resource usage while maintaining functionality
 */

import { chromium } from 'playwright';

// Global browser instance to reuse across requests
let browserInstance = null;
let browserPages = 0;
const MAX_CONCURRENT_PAGES = 2; // Limit concurrent pages

/**
 * Get or create a lightweight browser instance
 * @returns {Promise<Browser>} Shared browser instance
 */
const getBrowser = async () => {
  if (!browserInstance || !browserInstance.isConnected()) {
    console.log('[Playwright] Creating new lightweight browser instance...');
    
    browserInstance = await chromium.launch({
      headless: true,
      
      // MEMORY OPTIMIZATIONS
      args: [
        // Disable GPU and hardware acceleration
        '--disable-gpu',
        '--disable-gpu-sandbox',
        '--disable-software-rasterizer',
        
        // Reduce memory usage
        '--memory-pressure-off',
        '--max_old_space_size=512', // Limit to 512MB
        '--disable-dev-shm-usage', // Use /tmp instead of /dev/shm
        '--disable-extensions',
        '--disable-plugins',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        
        // Disable unnecessary features
        '--disable-web-security',
        '--disable-features=TranslateUI,BlinkGenPropertyTrees',
        '--disable-ipc-flooding-protection',
        '--disable-default-apps',
        '--disable-sync',
        '--disable-background-mode',
        
        // Single process mode (uses less memory)
        '--single-process',
        
        // Reduce cache
        '--disk-cache-size=1',
        '--media-cache-size=1',
        
        // No sandbox (reduces memory but less secure - only for controlled environments)
        '--no-sandbox'
      ],
      
      // Limit browser resources
      timeout: 30000,
      
      // Use minimal viewport
      viewport: { width: 1024, height: 768 }
    });
    
    // Handle browser crashes gracefully
    browserInstance.on('disconnected', () => {
      console.log('[Playwright] Browser disconnected, will recreate on next request');
      browserInstance = null;
      browserPages = 0;
    });
  }
  
  return browserInstance;
};

/**
 * Scrape with minimal resource usage
 * @param {string} url - URL to scrape
 * @param {Object} options - Scraping options
 * @returns {Promise<Object>} Scraping result
 */
export const scrapeWithMinimalPlaywright = async (url, options = {}) => {
  // Check if we're at page limit
  if (browserPages >= MAX_CONCURRENT_PAGES) {
    console.log('[Playwright] Too many concurrent pages, queuing request...');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  const browser = await getBrowser();
  let page = null;
  
  try {
    browserPages++;
    console.log(`[Playwright] Creating page ${browserPages}/${MAX_CONCURRENT_PAGES} for: ${url}`);
    
    page = await browser.newPage({
      // Minimal viewport to save memory
      viewport: { width: 1024, height: 768 },
      
      // Disable images and unnecessary content
      javaScriptEnabled: true, // Keep JS for menu detection
      ignoreHTTPSErrors: true
    });
    
    // Block heavy resources to save bandwidth and memory
    await page.route('**/*', (route) => {
      const resourceType = route.request().resourceType();
      
      // Block images, fonts, media to save memory and bandwidth
      if (['image', 'font', 'media', 'websocket', 'manifest'].includes(resourceType)) {
        route.abort();
        return;
      }
      
      // Block ads and tracking
      const url = route.request().url();
      if (url.includes('google-analytics') || 
          url.includes('googletagmanager') ||
          url.includes('facebook.com') ||
          url.includes('doubleclick') ||
          url.includes('/ads/') ||
          url.includes('analytics')) {
        route.abort();
        return;
      }
      
      route.continue();
    });
    
    // Very conservative timeouts
    await page.goto(url, {
      waitUntil: 'domcontentloaded', // Don't wait for all resources
      timeout: options.timeout || 15000 // Short timeout
    });
    
    // Wait briefly for any dynamic content
    await page.waitForTimeout(2000);
    
    // Look for menu content efficiently
    const menuData = await extractMenuDataEfficiently(page, url);
    
    return {
      success: true,
      ...menuData,
      method: 'minimal-playwright'
    };
    
  } catch (error) {
    console.error(`[Playwright] Error scraping ${url}: ${error.message}`);
    return {
      success: false,
      error: `Minimal Playwright failed: ${error.message}`,
      menuItems: [],
      method: 'minimal-playwright-failed'
    };
    
  } finally {
    if (page) {
      await page.close().catch(() => {}); // Ignore close errors
      browserPages--;
      console.log(`[Playwright] Closed page, remaining: ${browserPages}`);
    }
  }
};

/**
 * Efficient menu data extraction with minimal DOM queries
 * @param {Page} page - Playwright page instance
 * @param {string} url - Source URL
 * @returns {Promise<Object>} Extracted menu data
 */
const extractMenuDataEfficiently = async (page, url) => {
  try {
    // Single query to get all relevant content
    const menuContent = await page.evaluate(() => {
      // Helper function to extract text content
      const getText = (element) => {
        if (!element) return '';
        return element.innerText || element.textContent || '';
      };
      
      // Look for menu containers
      const menuSelectors = [
        '[class*="menu"]',
        '[id*="menu"]',
        '[class*="food"]',
        '[id*="food"]',
        '.menu-item',
        '.food-item',
        '[data-menu]'
      ];
      
      let menuItems = [];
      let foundMenuContent = false;
      
      // Try each selector
      for (const selector of menuSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          foundMenuContent = true;
          
          elements.forEach(element => {
            const text = getText(element);
            if (text && text.length > 10) { // Only meaningful content
              // Look for price patterns
              const priceMatch = text.match(/[\$\£\€][\d,]+\.?\d*/);
              const hasPrice = !!priceMatch;
              
              // Extract potential item name (first meaningful line)
              const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
              const itemName = lines[0] || '';
              
              if (itemName && itemName.length > 3 && itemName.length < 100) {
                menuItems.push({
                  name: itemName,
                  price: hasPrice ? priceMatch[0] : '',
                  description: lines.slice(1, 3).join(' '), // Limited description
                  category: '',
                  element: element.tagName,
                  selector: selector
                });
              }
            }
          });
        }
      }
      
      // If no specific menu elements, try general content
      if (!foundMenuContent) {
        const bodyText = getText(document.body);
        const priceMatches = bodyText.match(/[^\n]*[\$\£\€][\d,]+\.?\d*[^\n]*/g) || [];
        
        priceMatches.slice(0, 20).forEach(match => { // Limit to 20 items
          const cleanMatch = match.trim();
          if (cleanMatch.length > 10 && cleanMatch.length < 200) {
            const priceMatch = cleanMatch.match(/([\$\£\€][\d,]+\.?\d*)/);
            const itemName = cleanMatch.replace(priceMatch?.[0] || '', '').trim();
            
            if (itemName && itemName.length > 3) {
              menuItems.push({
                name: itemName,
                price: priceMatch?.[0] || '',
                description: '',
                category: '',
                element: 'body',
                selector: 'price-pattern'
              });
            }
          }
        });
      }
      
      return {
        menuItems: menuItems.slice(0, 50), // Limit results
        title: document.title || '',
        hasMenuStructure: foundMenuContent,
        totalElements: menuItems.length
      };
    });
    
    console.log(`[Playwright] Extracted ${menuContent.menuItems.length} menu items efficiently`);
    
    return {
      menuItems: menuContent.menuItems,
      totalItems: menuContent.menuItems.length,
      itemsWithPrices: menuContent.menuItems.filter(item => item.price).length,
      hasMenuStructure: menuContent.hasMenuStructure,
      url: url
    };
    
  } catch (error) {
    console.error(`[Playwright] Menu extraction error: ${error.message}`);
    return {
      menuItems: [],
      totalItems: 0,
      itemsWithPrices: 0,
      error: error.message,
      url: url
    };
  }
};

/**
 * Clean up resources periodically
 */
const cleanupResources = async () => {
  if (browserInstance && browserPages === 0) {
    console.log('[Playwright] Cleaning up idle browser instance...');
    try {
      await browserInstance.close();
      browserInstance = null;
    } catch (error) {
      console.warn('[Playwright] Cleanup error:', error.message);
      browserInstance = null;
    }
  }
};

// Cleanup every 5 minutes when idle
setInterval(cleanupResources, 5 * 60 * 1000);

/**
 * Health check for minimal Playwright service
 * @returns {Promise<Object>} Health status
 */
export const getPlaywrightHealth = async () => {
  try {
    const browser = await getBrowser();
    const isHealthy = browser && browser.isConnected();
    
    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      browserConnected: isHealthy,
      activePagesCount: browserPages,
      maxConcurrentPages: MAX_CONCURRENT_PAGES,
      memoryUsage: process.memoryUsage()
    };
  } catch (error) {
    return {
      status: 'error',
      error: error.message,
      activePagesCount: browserPages
    };
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Playwright] Graceful shutdown...');
  if (browserInstance) {
    await browserInstance.close().catch(() => {});
  }
  process.exit(0);
});
