/**
 * Hybrid scraping service that tries fast client-side methods first,
 * then falls back to Playwright backend for difficult sites
 */

import { scrapeRestaurantMenu } from './webScrapingService.js';

const BACKEND_API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3001';

/**
 * Enhanced scraping with Playwright fallback
 * @param {string} websiteUrl - Restaurant website URL
 * @param {boolean} forcePlaywright - Skip fast method and use Playwright directly
 * @returns {Promise<Object>} Scraped menu data
 */
export const scrapeRestaurantMenuHybrid = async (websiteUrl, forcePlaywright = false) => {
  const startTime = Date.now();
  
  try {
    console.log(`[Hybrid Scraping] Starting for: ${websiteUrl}`);
    
    // Step 1: Try fast client-side method first (unless forced to use Playwright)
    if (!forcePlaywright) {
      console.log(`[Hybrid Scraping] Trying fast client-side method...`);
      const fastResult = await scrapeRestaurantMenu(websiteUrl);
      
      // If fast method succeeded with good results, return it
      if (fastResult.success && fastResult.menuItems && fastResult.menuItems.length >= 5) {
        console.log(`[Hybrid Scraping] Fast method succeeded: ${fastResult.menuItems.length} items in ${Date.now() - startTime}ms`);
        return {
          ...fastResult,
          method: 'fast-client-side',
          totalTime: Date.now() - startTime,
          playwrightUsed: false
        };
      }
      
      // Check if we should try Playwright based on the failure reason
      const shouldTryPlaywright = shouldFallbackToPlaywright(fastResult);
      
      if (!shouldTryPlaywright) {
        console.log(`[Hybrid Scraping] Fast method failed but Playwright fallback not recommended`);
        return {
          ...fastResult,
          method: 'fast-client-side-only',
          totalTime: Date.now() - startTime,
          playwrightUsed: false
        };
      }
      
      console.log(`[Hybrid Scraping] Fast method insufficient, trying Playwright fallback...`);
      console.log(`[Hybrid Scraping] Fast result: ${fastResult.menuItems?.length || 0} items, error: ${fastResult.error}`);
    } else {
      console.log(`[Hybrid Scraping] Forced to use Playwright directly`);
    }
    
    // Step 2: Try Playwright backend for difficult sites
    const playwrightResult = await scrapeWithPlaywrightBackend(websiteUrl);
    
    if (playwrightResult.success) {
      console.log(`[Hybrid Scraping] Playwright succeeded: ${playwrightResult.menuItems?.length || 0} items in ${Date.now() - startTime}ms total`);
      return {
        ...playwrightResult,
        method: 'playwright-backend',
        totalTime: Date.now() - startTime,
        playwrightUsed: true
      };
    }
    
    // Step 3: If both methods failed, return the better result
    const fastResult = forcePlaywright ? null : await scrapeRestaurantMenu(websiteUrl);
    const betterResult = chooseBetterResult(fastResult, playwrightResult);
    
    console.log(`[Hybrid Scraping] Both methods failed, returning better result`);
    return {
      ...betterResult,
      method: 'hybrid-both-failed',
      totalTime: Date.now() - startTime,
      playwrightUsed: true
    };
    
  } catch (error) {
    console.error(`[Hybrid Scraping] Fatal error: ${error.message}`);
    return {
      success: false,
      error: `Hybrid scraping failed: ${error.message}`,
      menuItems: [],
      method: 'hybrid-error',
      totalTime: Date.now() - startTime,
      playwrightUsed: false
    };
  }
};

/**
 * Determine if we should try Playwright based on fast method failure
 * @param {Object} fastResult - Result from fast scraping method
 * @returns {boolean} Whether to try Playwright
 */
const shouldFallbackToPlaywright = (fastResult) => {
  if (!fastResult) return true;
  
  // Try Playwright for these scenarios:
  const playwrightIndicators = [
    // Bot protection detected
    fastResult.error && fastResult.error.includes('Just a moment'),
    fastResult.error && fastResult.error.includes('JavaScript'),
    fastResult.error && fastResult.error.includes('cookies'),
    
    // PDF menus detected
    fastResult.error && fastResult.error.includes('PDF'),
    
    // Site accessible but no menu found (might be SPA)
    fastResult.error && fastResult.error.includes('accessible but no menu'),
    
    // Very few items found (might need JS rendering)
    fastResult.success && fastResult.menuItems && fastResult.menuItems.length < 3,
    
    // Menu detection failed entirely
    fastResult.method === 'menu-not-found'
  ];
  
  const shouldTry = playwrightIndicators.some(indicator => indicator);
  
  console.log(`[Hybrid Decision] Should try Playwright: ${shouldTry}`);
  console.log(`[Hybrid Decision] Indicators: ${playwrightIndicators.map((indicator, i) => indicator ? i : null).filter(x => x !== null)}`);
  
  return shouldTry;
};

/**
 * Call Playwright backend service
 * @param {string} websiteUrl - Restaurant website URL
 * @returns {Promise<Object>} Playwright scraping result
 */
const scrapeWithPlaywrightBackend = async (websiteUrl) => {
  try {
    console.log(`[Playwright Backend] Calling backend for: ${websiteUrl}`);
    
    const response = await fetch(`${BACKEND_API_URL}/api/scrape-playwright`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.EXPO_PUBLIC_API_KEY || 'mobile-app'}`
      },
      body: JSON.stringify({
        url: websiteUrl,
        options: {
          waitForSelector: '[menu], [food], .menu, .food-menu',
          timeout: 30000,
          blockResources: ['image', 'font', 'media'], // Speed optimization
          mobileViewport: true
        }
      }),
      timeout: 45000 // Give Playwright time to work
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Backend responded with ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    
    console.log(`[Playwright Backend] Response: success=${result.success}, items=${result.menuItems?.length || 0}`);
    
    return result;
    
  } catch (error) {
    console.error(`[Playwright Backend] Error: ${error.message}`);
    return {
      success: false,
      error: `Playwright backend failed: ${error.message}`,
      menuItems: [],
      method: 'playwright-backend-failed'
    };
  }
};

/**
 * Choose the better result between fast and Playwright methods
 * @param {Object} fastResult - Fast method result
 * @param {Object} playwrightResult - Playwright method result
 * @returns {Object} Better result
 */
const chooseBetterResult = (fastResult, playwrightResult) => {
  if (!fastResult) return playwrightResult;
  if (!playwrightResult) return fastResult;
  
  // Prefer successful results
  if (fastResult.success && !playwrightResult.success) return fastResult;
  if (!fastResult.success && playwrightResult.success) return playwrightResult;
  
  // If both successful, prefer more items
  if (fastResult.success && playwrightResult.success) {
    const fastItems = fastResult.menuItems?.length || 0;
    const playwrightItems = playwrightResult.menuItems?.length || 0;
    return fastItems >= playwrightItems ? fastResult : playwrightResult;
  }
  
  // If both failed, prefer the one with more information
  const fastItemCount = fastResult.menuItems?.length || 0;
  const playwrightItemCount = playwrightResult.menuItems?.length || 0;
  
  return fastItemCount >= playwrightItemCount ? fastResult : playwrightResult;
};

/**
 * Check if Playwright backend is available
 * @returns {Promise<boolean>} Whether backend is responsive
 */
export const isPlaywrightBackendAvailable = async () => {
  try {
    const response = await fetch(`${BACKEND_API_URL}/health`, {
      method: 'GET',
      timeout: 5000
    });
    
    const isAvailable = response.ok;
    console.log(`[Playwright Backend] Health check: ${isAvailable ? 'OK' : 'Failed'}`);
    return isAvailable;
    
  } catch (error) {
    console.warn(`[Playwright Backend] Health check failed: ${error.message}`);
    return false;
  }
};

/**
 * Get backend performance stats
 * @returns {Promise<Object>} Backend performance information
 */
export const getPlaywrightBackendStats = async () => {
  try {
    const response = await fetch(`${BACKEND_API_URL}/api/stats`, {
      method: 'GET',
      timeout: 5000
    });
    
    if (response.ok) {
      return await response.json();
    }
    
    return null;
    
  } catch (error) {
    console.warn(`[Playwright Backend] Stats check failed: ${error.message}`);
    return null;
  }
};
