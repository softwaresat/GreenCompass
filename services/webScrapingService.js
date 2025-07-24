/**
 * Pure Backend Web Scraping Service
 * All menu discovery and extraction happens on the server using AI-powered Playwright
 */

import axios from 'axios';

/**
 * Scrape restaurant menu from website using pure backend approach
 * @param {string} websiteUrl - URL of the restaurant website
 * @returns {Promise<Object>} Scraped menu data
 */
export const scrapeRestaurantMenu = async (websiteUrl) => {
  try {
    const startTime = Date.now();
    const normalizedUrl = normalizeUrl(websiteUrl);
    
    console.log(`[Pure Backend] Starting AI-powered menu scraping for: ${normalizedUrl}`);
    
    // Use the new backend endpoint that does complete AI-powered discovery and scraping
    const serverUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3001';
    
    // Fix the URL format - ensure it has http:// protocol
    const backendUrl = serverUrl.startsWith('http') ? serverUrl : `http://${serverUrl}`;
    
    console.log(`[Pure Backend] Sending request to: ${backendUrl}/api/scrape-menu-complete`);
    console.log(`[Pure Backend] Request payload:`, {
      url: normalizedUrl,
      options: {
        mobile: true,
        timeout: 60000,
        waitForSelector: null
      }
    });
    
    const response = await axios.post(`${backendUrl}/api/scrape-menu-complete`, {
      url: normalizedUrl,
      options: {
        mobile: true,
        timeout: 60000 // Allow more time for AI processing
        // Don't send waitForSelector: null, just omit it
      }
    }, {
      timeout: 90000, // 90 seconds total timeout for AI processing
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.data && response.data.success) {
      const menuData = response.data;
      console.log(`[Pure Backend] Success: ${menuData.menuItems?.length || 0} items found`);
      console.log(`[Pure Backend] Menu discovered at: ${menuData.menuPageUrl || 'original URL'}`);
      console.log(`[Pure Backend] Discovery method: ${menuData.discoveryMethod || 'unknown'}`);
      console.log(`[Pure Backend] Processing time: ${menuData.extractionTime || 0}ms`);
      
      return {
        success: true,
        menuItems: menuData.menuItems || [],
        categories: menuData.categories || [],
        restaurantInfo: menuData.restaurantInfo || {},
        method: 'pure-backend-ai',
        scrapingTime: Date.now() - startTime,
        extractionTime: menuData.extractionTime || 0,
        discoveryTime: menuData.discoveryTime || 0,
        discoveryMethod: menuData.discoveryMethod || 'unknown',
        menuPageUrl: menuData.menuPageUrl,
        url: normalizedUrl
      };
    } else {
      const errorMessage = response.data?.error || 'Backend scraping failed';
      console.error(`[Pure Backend] Server error: ${errorMessage}`);
      
      return {
        success: false,
        error: errorMessage,
        menuItems: [],
        method: 'pure-backend-ai-failed',
        scrapingTime: Date.now() - startTime,
        url: normalizedUrl
      };
    }
    
  } catch (error) {
    console.error(`[Pure Backend] Network/Server error: ${error.message}`);
    
    // Log more details about the error
    if (error.response) {
      console.error(`[Pure Backend] Response status: ${error.response.status}`);
      console.error(`[Pure Backend] Response data:`, error.response.data);
    }
    
    // Provide helpful error messages based on error type
    let userFriendlyError = 'Failed to connect to the scraping server.';
    let suggestions = [];
    
    if (error.response?.status === 400) {
      const responseError = error.response.data?.error || 'Bad request';
      userFriendlyError = `Invalid request: ${responseError}`;
      suggestions = [
        'Check that you entered a valid website URL',
        'Make sure the URL starts with http:// or https://',
        'Verify the website URL is accessible'
      ];
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      userFriendlyError = 'Could not connect to the menu scraping server. Please ensure the backend is running.';
      suggestions = [
        'Check that the backend server is running on the correct port',
        'Verify the EXPO_PUBLIC_BACKEND_URL environment variable is set correctly',
        'Make sure there are no firewall restrictions blocking the connection'
      ];
    } else if (error.code === 'TIMEOUT' || error.message.includes('timeout')) {
      userFriendlyError = 'The menu scraping request timed out. This website may be slow to respond or have complex content.';
      suggestions = [
        'Try again as the website may be temporarily slow',
        'Some websites require more time for AI processing',
        'Check if the website is accessible and not blocking automated requests'
      ];
    } else if (error.response?.status === 429) {
      userFriendlyError = 'Too many requests. Please wait a moment before trying again.';
      suggestions = [
        'Wait 60 seconds before making another request',
        'The rate limit helps ensure reliable service for all users'
      ];
    } else if (error.response?.status >= 500) {
      userFriendlyError = 'Server error occurred during menu scraping.';
      suggestions = [
        'Try again in a few moments',
        'Check the backend server logs for more details',
        'Some websites may not be compatible with automated scraping'
      ];
    }
    
    return {
      success: false,
      error: userFriendlyError,
      suggestions: suggestions,
      menuItems: [],
      method: 'pure-backend-error',
      scrapingTime: Date.now() - startTime,
      url: websiteUrl,
      networkError: true,
      originalError: error.message
    };
  }
};

/**
 * Normalize URL for consistent processing
 * @param {string} url - URL to normalize
 * @returns {string} Normalized URL
 */
const normalizeUrl = (url) => {
  try {
    // Add https:// if no protocol is specified
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    // Create URL object to validate and normalize
    const urlObj = new URL(url);
    
    // Remove trailing slash
    if (urlObj.pathname.endsWith('/') && urlObj.pathname.length > 1) {
      urlObj.pathname = urlObj.pathname.slice(0, -1);
    }
    
    // Remove common tracking parameters
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'];
    trackingParams.forEach(param => {
      urlObj.searchParams.delete(param);
    });
    
    return urlObj.toString();
  } catch (error) {
    console.error('URL normalization error:', error.message);
    return url; // Return original URL if normalization fails
  }
};

// Export individual functions that might be needed
export { normalizeUrl };
