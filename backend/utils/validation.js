/**
 * Validation utilities for the backend API
 */

/**
 * Validate URL format and security
 */
const validateUrl = (url) => {
  if (!url || typeof url !== 'string') {
    return false;
  }
  
  try {
    const urlObj = new URL(url);
    
    // Only allow HTTP/HTTPS
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return false;
    }
    
    // Block localhost and private IPs for security (unless in development)
    if (process.env.NODE_ENV === 'production') {
      const hostname = urlObj.hostname.toLowerCase();
      
      // Block localhost
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return false;
      }
      
      // Block private IP ranges
      const privateRanges = [
        /^10\./,
        /^192\.168\./,
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./
      ];
      
      if (privateRanges.some(range => range.test(hostname))) {
        return false;
      }
    }
    
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Sanitize and normalize URL
 */
const normalizeUrl = (url) => {
  try {
    const urlObj = new URL(url);
    
    // Remove trailing slash
    if (urlObj.pathname.endsWith('/') && urlObj.pathname.length > 1) {
      urlObj.pathname = urlObj.pathname.slice(0, -1);
    }
    
    // Remove common tracking parameters
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'gclid'];
    trackingParams.forEach(param => {
      urlObj.searchParams.delete(param);
    });
    
    return urlObj.toString();
  } catch (error) {
    return url; // Return original if parsing fails
  }
};

/**
 * Validate scraping options
 */
const validateOptions = (options) => {
  if (!options || typeof options !== 'object') {
    return { valid: true, sanitized: {} };
  }
  
  const sanitized = {};
  
  // Validate timeout
  if (options.timeout !== undefined) {
    const timeout = parseInt(options.timeout);
    if (isNaN(timeout) || timeout < 1000 || timeout > 120000) {
      return { valid: false, error: 'Timeout must be between 1000 and 120000 milliseconds' };
    }
    sanitized.timeout = timeout;
  }
  
  // Validate waitForSelector
  if (options.waitForSelector !== undefined) {
    if (typeof options.waitForSelector !== 'string' || options.waitForSelector.length > 200) {
      return { valid: false, error: 'waitForSelector must be a string under 200 characters' };
    }
    sanitized.waitForSelector = options.waitForSelector;
  }
  
  // Validate blockResources
  if (options.blockResources !== undefined) {
    if (!Array.isArray(options.blockResources)) {
      return { valid: false, error: 'blockResources must be an array' };
    }
    
    const validTypes = ['image', 'font', 'media', 'websocket', 'manifest', 'stylesheet', 'script'];
    const invalidTypes = options.blockResources.filter(type => !validTypes.includes(type));
    
    if (invalidTypes.length > 0) {
      return { valid: false, error: `Invalid resource types: ${invalidTypes.join(', ')}` };
    }
    
    sanitized.blockResources = options.blockResources;
  }
  
  // Validate mobileViewport
  if (options.mobileViewport !== undefined) {
    sanitized.mobileViewport = Boolean(options.mobileViewport);
  }
  
  return { valid: true, sanitized };
};

module.exports = {
  validateUrl,
  normalizeUrl,
  validateOptions
};
