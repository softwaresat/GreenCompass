
import axios from 'axios';

/**
 * Scrape restaurant menu from website
 * @param {string} websiteUrl - URL of the restaurant website
 * @returns {Promise<Object>} Scraped menu data
 */
export const scrapeRestaurantMenu = async (websiteUrl) => {
  try {
    const startTime = Date.now();
    const normalizedUrl = normalizeUrl(websiteUrl);
    
    console.log(`[Menu Scraping] Starting analysis for: ${normalizedUrl}`);
    
    // Step 1: Use AI to intelligently find the menu page
    console.log(`[Menu Scraping] Using AI-powered search to find menu...`);
    let menuPageUrl = await findMenuPageWithGemini(normalizedUrl);
    
    // Step 2: If AI didn't find a menu, try intelligent common paths with AI validation
    if (!menuPageUrl) {
      console.log(`[Menu Scraping] AI search failed, trying common paths with AI validation...`);
      const commonPathResult = await tryCommonMenuPathsWithAI(normalizedUrl);
      
      if (commonPathResult) {
        menuPageUrl = commonPathResult;
        console.log(`[Enhanced Common Paths] Found menu at: ${commonPathResult}`);
      }
    }
    
    // Step 3: If still no menu found, try one final attempt with basic fallback
    if (!menuPageUrl) {
      console.log(`[Menu Scraping] Enhanced methods failed, trying basic fallback as last resort...`);
      const basicFallbackResult = await tryCommonMenuPaths(normalizedUrl);
      
      if (basicFallbackResult) {
        menuPageUrl = basicFallbackResult;
        console.log(`[Basic Fallback] Found menu at: ${basicFallbackResult}`);
      }
    }
    
    // Step 4: If still no menu found, return appropriate response
    if (!menuPageUrl) {
      console.log(`[Menu Scraping] No menu found for: ${normalizedUrl}`);
      
      // Provide more specific error message based on what happened
      let errorMessage = 'No menu page could be found on this website.';
      let suggestions = [];
      
      // Try to determine why we failed
      const testFetch = await fetchPageContent(normalizedUrl);
      if (!testFetch) {
        errorMessage = 'Unable to access this website. It may be down, require authentication, or block automated access.';
        suggestions.push('Check if the website URL is correct');
        suggestions.push('Try accessing the website directly in a browser');
        suggestions.push('The site may be temporarily down');
      } else {
        errorMessage = 'The website is accessible but no menu page could be located.';
        suggestions.push('The site may not have an online menu');
        suggestions.push('The menu might be behind a login or paywall');
        suggestions.push('Try looking for a PDF menu or third-party ordering platform');
        
        // Check if we encountered PDF content during scraping
        if (testFetch && (testFetch.includes('%PDF-') || testFetch.includes('1.0 0.0 0.0 1.0') || testFetch.includes('Å/') || testFetch.includes('Ä'))) {
          errorMessage = 'This restaurant uses a PDF menu which cannot be automatically processed.';
          suggestions = [
            'PDF menus contain formatted documents that require special parsing',
            'Visit the restaurant website directly to view or download the PDF menu',
            'Look for "Menu PDF", "Download Menu", or "View Menu" buttons',
            'PDF menus often have better formatting but cannot be scraped automatically',
            'Consider using PDF-to-text services or manual menu entry for this restaurant'
          ];
        }
      }
      
      return {
        success: false,
        error: errorMessage,
        suggestions: suggestions,
        menuItems: [],
        method: 'menu-not-found',
        scrapingTime: Date.now() - startTime,
        url: normalizedUrl
      };
    }
    
    // Step 5: Extract menu items from the confirmed menu page
    console.log(`[Menu Scraping] Extracting menu items from: ${menuPageUrl}`);
    const menuData = await scrapeMenuPage(menuPageUrl);
    
    menuData.scrapingTime = Date.now() - startTime;
    console.log(`[Menu Scraping] Completed in ${menuData.scrapingTime}ms. Found ${menuData.menuItems?.length || 0} items.`);
    
    return menuData;
    
  } catch (error) {
    console.error(`[Menu Scraping] Fatal error: ${error.message}`);
    return {
      success: false,
      error: error.message,
      menuItems: [],
      method: 'failed'
    };
  }
};

/**
 * Use Gemini to intelligently find menu page with context clues
 * @param {string} currentUrl - Current URL to analyze
 * @param {number} depth - Current recursion depth
 * @param {Set} visitedUrls - Set of already visited URLs to prevent loops
 * @returns {Promise<string|null>} Menu page URL or null if not found
 */
const findMenuPageWithGemini = async (currentUrl, depth = 0, visitedUrls = new Set()) => {
  // Prevent infinite recursion and loops
  if (depth >= 3 || visitedUrls.has(currentUrl)) {
    console.log(`[AI Search] Stopping recursion for: ${currentUrl} (depth: ${depth}, visited: ${visitedUrls.has(currentUrl)})`);
    return null;
  }
  
  visitedUrls.add(currentUrl);
  console.log(`[AI Search] Analyzing (depth ${depth}): ${currentUrl}`);
  
  try {
    const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      console.warn('Gemini API key not configured, using non-AI fallback');
      return await findMenuPageFallback(currentUrl);
    }

    // Fetch the page content - if this fails, try fallback but still attempt AI on common paths
    const htmlContent = await fetchPageContent(currentUrl);
    if (!htmlContent) {
      console.log(`[AI Search] Could not fetch content from: ${currentUrl}`);
      console.log(`[AI Search] Will try common paths with AI validation instead`);
      return null; // Let main function handle with AI-enhanced common paths
    }
    
    // ALWAYS run enhanced AI search first to find dedicated menu pages
    console.log(`[AI Search] Running Enhanced AI Search to find dedicated menu pages...`);
    const menuSearchResult = await findMenuWithContextualAI(htmlContent, currentUrl, apiKey);
    
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
        
        // Check if the URL exists and is accessible
        const testContent = await fetchPageContent(suggestion.url);
        if (testContent) {
          // Handle PDF links differently
          if (suggestion.type === 'pdf' || suggestion.url.toLowerCase().endsWith('.pdf')) {
            console.log(`[AI Search] Found PDF menu link: ${suggestion.url}`);
            console.log(`[AI Search] PDF menus require special handling - skipping content validation`);
            
            // For PDF menus, we can't parse the content easily, so we'll accept it based on the URL/context
            if (suggestion.confidence > 60) {
              console.log(`[AI Search] ✓ Accepting PDF menu link: ${suggestion.url} (confidence: ${suggestion.confidence}%)`);
              console.log(`[AI Search] Note: PDF content cannot be processed by this scraper`);
              // Return null to continue looking for HTML alternatives, but log this as a backup
              console.log(`[AI Search] Continuing to look for HTML alternatives to PDF menu...`);
              continue;
            }
          } else {
            // Check if this is a menu page for HTML content
            console.log(`[AI Search] Testing if ${suggestion.url} is a menu page...`);
            const isMenuResult = await checkIfPageIsMenuWithAI(testContent, suggestion.url, apiKey);
            
            if (isMenuResult && isMenuResult.isMenu && isMenuResult.confidence > 40) {
              console.log(`[AI Search] ✓ Confirmed dedicated menu page: ${suggestion.url} (confidence: ${isMenuResult.confidence}%)`);
              return suggestion.url;
            } else if (isMenuResult) {
              console.log(`[AI Search] ✗ Not a menu page: ${suggestion.url} (confidence: ${isMenuResult.confidence}%, reason: ${isMenuResult.reason})`);
              
              // If this was a high-confidence suggestion that turned out not to be a menu,
              // and we haven't hit max depth, try to recursively search from this page
              if (suggestion.confidence > 70 && depth < 2) {
                console.log(`[AI Search] High-confidence suggestion failed, trying recursive search from: ${suggestion.url}`);
                const recursiveResult = await findMenuPageWithGemini(suggestion.url, depth + 1, visitedUrls);
                if (recursiveResult) {
                  console.log(`[AI Search] Found menu through recursive search: ${recursiveResult}`);
                  return recursiveResult;
                }
              }
            }
          }
        } else {
          console.log(`[AI Search] ✗ URL not accessible: ${suggestion.url}`);
        }
      }
    } else {
      console.log(`[AI Search] Enhanced AI Search found no menu URLs for: ${currentUrl}`);
    }
    
    // If Enhanced AI Search didn't find dedicated menu pages, check if current page IS a menu
    console.log(`[AI Search] No dedicated menu pages found, checking if current page is a menu: ${currentUrl}`);
    const isMenuResult = await checkIfPageIsMenuWithAI(htmlContent, currentUrl, apiKey);
    
    if (isMenuResult && isMenuResult.isMenu && isMenuResult.confidence > 40) {
      console.log(`[AI Menu Detection] Using current page as menu: ${currentUrl} (confidence: ${isMenuResult.confidence}%)`);
      return currentUrl;
    } else if (isMenuResult) {
      console.log(`[AI Menu Detection] Current page is not a menu: ${currentUrl} (confidence: ${isMenuResult.confidence}%, reason: ${isMenuResult.reason})`);
    }
    
    // If AI found hidden/interactive menu on current page, double-check with deep analysis
    if (menuSearchResult && menuSearchResult.hasHiddenMenu) {
      console.log(`[AI Search] Checking for hidden menu content on current page with deep analysis`);
      const hiddenMenuCheck = await checkIfPageIsMenuWithAI(htmlContent, currentUrl, apiKey, true);
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
};

/**
 * Write debug data to console for inspection (React Native compatible)
 * @param {string} filename - Name of the debug section
 * @param {Object} data - Data to write
 * @param {string} url - URL being analyzed
 */
const writeDebugFile = async (filename, data, url) => {
  try {
    const timestamp = new Date().toISOString();
    const sanitizedUrl = url.replace(/[^a-zA-Z0-9]/g, '_');
    
    const debugContent = `
=====================================
DEBUG: ${filename}
URL: ${url}
TIMESTAMP: ${timestamp}
SANITIZED_URL: ${sanitizedUrl}
=====================================

${typeof data === 'object' ? JSON.stringify(data, null, 2) : data}

=====================================
END DEBUG: ${filename}
=====================================
`;
    
    // In React Native, we'll log to console with clear separators
    console.log(`[Debug] === ${filename.toUpperCase()} START ===`);
    console.log(`[Debug] URL: ${url}`);
    console.log(`[Debug] Timestamp: ${timestamp}`);
    console.log(`[Debug] Data:`, typeof data === 'object' ? JSON.stringify(data, null, 2) : data);
    console.log(`[Debug] === ${filename.toUpperCase()} END ===`);
    
    // Also save to a global debug object that can be inspected
    if (typeof global !== 'undefined') {
      if (!global.__greenCompassDebug) {
        global.__greenCompassDebug = {};
      }
      
      const debugKey = `${timestamp}_${sanitizedUrl}_${filename}`;
      global.__greenCompassDebug[debugKey] = {
        url,
        timestamp,
        filename,
        data: typeof data === 'object' ? JSON.parse(JSON.stringify(data)) : data
      };
      
      // Keep only the last 10 debug entries to avoid memory issues
      const keys = Object.keys(global.__greenCompassDebug);
      if (keys.length > 10) {
        const oldestKeys = keys.sort().slice(0, keys.length - 10);
        oldestKeys.forEach(key => delete global.__greenCompassDebug[key]);
      }
    }
    
  } catch (error) {
    console.error(`[Debug] Failed to write debug data: ${error.message}`);
  }
};

/**
 * Use enhanced AI to find menu with comprehensive contextual analysis
 * @param {string} htmlContent - HTML content of the page
 * @param {string} url - Current URL
 * @param {string} apiKey - Gemini API key
 * @returns {Promise<Object|null>} Enhanced menu search result
 */
const findMenuWithContextualAI = async (htmlContent, url, apiKey) => {
  try {
    // Get more comprehensive HTML for analysis
    const enhancedHtml = prepareEnhancedHtmlForGemini(htmlContent);
    const textContent = htmlToText(htmlContent);
    
    // Write debug files to inspect what's being sent to AI
    await writeDebugFile('enhanced-html', enhancedHtml, url);
    await writeDebugFile('text-content', textContent.substring(0, 5000), url);
    await writeDebugFile('original-html', htmlContent.substring(0, 10000) + '...[truncated]', url);
    
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
   - SPECIAL CASE: If you find PDF links (ending in .pdf), note them but prioritize HTML pages
   - Look for menu PDFs but mark them as "pdf" type with lower confidence

5. BUTTON/LINK ANALYSIS:
   - Pay special attention to <button> tags with "menu" text
   - Look at onclick handlers that might navigate to menu pages
   - Check data-* attributes that might contain menu URLs

IGNORE:
- External ordering platforms (unless they're the ONLY menu option)  
- Social media links
- Contact/location pages
- General "About" pages

!!! CRITICAL: If you see ANY element (button, link, div) with the word "menu" in the visible text, that should be your TOP priority suggestion!

PDF HANDLING:
- If you find PDF menu links, include them but mark as type: "pdf" with confidence 60-70
- Prefer HTML pages over PDF links when both are available
- Note: "View Menu PDF", "Download Menu", "Menu.pdf" links

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
  }
}

PRIORITY ORDER:
1. HTML pages with visible "Menu" buttons/links (confidence: 90-99, type: "direct")
2. "Order" or "Food" HTML buttons (confidence: 70-85, type: "direct") 
3. Navigation menu HTML items (confidence: 60-75, type: "direct")
4. PDF menu links (confidence: 60-70, type: "pdf")
5. Other potential links (confidence: 30-50, type: "direct")

Return maximum 5 URLs, highest confidence first!`;

    // Write debug file for the complete AI prompt
    await writeDebugFile('ai-prompt-menu-search', prompt, url);

    console.log(`[Enhanced AI Search] Analyzing page structure for: ${url}`);
    const result = await callGeminiAPI(prompt, apiKey);
    
    if (!result.success) {
      console.warn(`[Enhanced AI Search] API call failed: ${result.error}`);
      return null;
    }
    
    // Extract JSON from response
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn(`[Enhanced AI Search] No JSON found in response:`, result.content.substring(0, 200));
      return null;
    }
    
    try {
      const menuSearchResult = JSON.parse(jsonMatch[0]);
      
      // Write debug file for AI response
      await writeDebugFile('ai-response-menu-search', menuSearchResult, url);
      
      console.log(`[Enhanced AI Search] Found ${menuSearchResult.menuUrls?.length || 0} potential menu URLs`);
      console.log(`[Enhanced AI Search] Restaurant type: ${menuSearchResult.contextClues?.restaurantType || 'unknown'}`);
      console.log(`[Enhanced AI Search] Has ordering system: ${menuSearchResult.contextClues?.hasOrderingSystem || false}`);
      
      return menuSearchResult;
      
    } catch (parseError) {
      console.error(`[Enhanced AI Search] JSON parsing error:`, parseError.message);
      console.log(`[Enhanced AI Search] Raw response:`, jsonMatch[0].substring(0, 500));
      return null;
    }
    
  } catch (error) {
    console.error(`[Enhanced AI Search] Error: ${error.message}`);
    return null;
  }
};

/**
 * Prepare enhanced HTML for comprehensive AI analysis
 * @param {string} html - Full HTML content
 * @returns {string} Enhanced cleaned HTML for analysis
 */
const prepareEnhancedHtmlForGemini = (html) => {
  // Remove scripts and styles but keep more structure
  let cleaned = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
  
  const importantElements = [];
  
  // PRIORITY 1: Get ALL links first - don't filter yet, let AI decide!
  console.log('[HTML Prep] Extracting all links for AI analysis...');
  const linkPattern = /<a[^>]*href[^>]*>[\s\S]*?<\/a>/gi;
  const allLinks = cleaned.match(linkPattern) || [];
  console.log(`[HTML Prep] Found ${allLinks.length} total links`);
  
  // Add ALL links - let AI filter them
  importantElements.push(...allLinks);
  
  // PRIORITY 2: Get ALL buttons and clickable elements
  console.log('[HTML Prep] Extracting all buttons and clickable elements...');
  const buttonPatterns = [
    /<button[^>]*>[\s\S]*?<\/button>/gi,
    /<input[^>]*type\s*=\s*["'](?:button|submit|image)["'][^>]*>/gi,
    /<div[^>]*(?:onclick|role\s*=\s*["']button["'])[^>]*>[\s\S]*?<\/div>/gi,
    /<span[^>]*(?:onclick|role\s*=\s*["']button["'])[^>]*>[\s\S]*?<\/span>/gi,
    /<div[^>]*class[^>]*(?:btn|button|click|menu-item|nav-item)[^>]*>[\s\S]*?<\/div>/gi,
    /<a[^>]*class[^>]*(?:btn|button|menu-btn|nav-btn)[^>]*>[\s\S]*?<\/a>/gi
  ];
  
  let totalButtons = 0;
  buttonPatterns.forEach(pattern => {
    const matches = cleaned.match(pattern) || [];
    totalButtons += matches.length;
    importantElements.push(...matches);
  });
  console.log(`[HTML Prep] Found ${totalButtons} buttons/clickable elements`);
  
  // PRIORITY 3: Navigation structures 
  console.log('[HTML Prep] Extracting navigation structures...');
  const navPatterns = [
    /<nav[^>]*>[\s\S]*?<\/nav>/gi,
    /<header[^>]*>[\s\S]*?<\/header>/gi,
    /<footer[^>]*>[\s\S]*?<\/footer>/gi,
    /<div[^>]*class[^>]*(?:nav|menu|header|main-nav|primary-nav|navigation|topbar|menubar)[^>]*>[\s\S]*?<\/div>/gi,
    /<ul[^>]*class[^>]*(?:nav|menu|main-menu|primary-menu|navigation)[^>]*>[\s\S]*?<\/ul>/gi,
    /<ol[^>]*class[^>]*(?:nav|menu|main-menu|primary-menu|navigation)[^>]*>[\s\S]*?<\/ol>/gi
  ];
  
  let totalNavs = 0;
  navPatterns.forEach(pattern => {
    const matches = cleaned.match(pattern) || [];
    totalNavs += matches.length;
    importantElements.push(...matches);
  });
  console.log(`[HTML Prep] Found ${totalNavs} navigation structures`);
  
  // PRIORITY 4: Main content areas and sections
  console.log('[HTML Prep] Extracting main content areas...');
  const contentPatterns = [
    /<main[^>]*>[\s\S]*?<\/main>/gi,
    /<section[^>]*>[\s\S]*?<\/section>/gi,
    /<article[^>]*>[\s\S]*?<\/article>/gi,
    /<div[^>]*class[^>]*(?:content|main|hero|featured|banner|intro|home)[^>]*>[\s\S]*?<\/div>/gi,
    /<div[^>]*id[^>]*(?:content|main|hero|featured|banner|intro|home)[^>]*>[\s\S]*?<\/div>/gi
  ];
  
  let totalContent = 0;
  contentPatterns.forEach(pattern => {
    const matches = cleaned.match(pattern) || [];
    totalContent += matches.length;
    // Limit content sections to prevent overwhelming the AI
    importantElements.push(...matches.slice(0, 5));
  });
  console.log(`[HTML Prep] Found ${totalContent} main content areas`);
  
  // PRIORITY 5: Look for specific menu-related elements that might be missed
  console.log('[HTML Prep] Looking for menu-specific elements...');
  const menuSpecificPatterns = [
    /<[^>]*(?:data-menu|menu-toggle|menu-link|menu-item)[^>]*>[\s\S]*?<\/[^>]*>/gi,
    /<[^>]*title[^>]*=["'][^"']*menu[^"']*["'][^>]*>[\s\S]*?<\/[^>]*>/gi,
    /<[^>]*alt[^>]*=["'][^"']*menu[^"']*["'][^>]*>/gi
  ];
  
  let totalMenuSpecific = 0;
  menuSpecificPatterns.forEach(pattern => {
    const matches = cleaned.match(pattern) || [];
    totalMenuSpecific += matches.length;
    importantElements.push(...matches);
  });
  console.log(`[HTML Prep] Found ${totalMenuSpecific} menu-specific elements`);
  
  // Combine all elements
  let result = importantElements.join('\n\n');
  console.log(`[HTML Prep] Total extracted elements: ${importantElements.length}`);
  console.log(`[HTML Prep] Combined length: ${result.length} characters`);
  
  // If too long, prioritize by keeping the most relevant parts
  if (result.length > 40000) {
    console.log('[HTML Prep] Content too long, prioritizing...');
    
    // Keep all links and buttons (most important for menu finding)
    const prioritizedElements = [];
    
    // Add all links first
    prioritizedElements.push(...allLinks);
    
    // Add all buttons
    buttonPatterns.forEach(pattern => {
      const matches = cleaned.match(pattern) || [];
      prioritizedElements.push(...matches);
    });
    
    // Add navigation structures
    navPatterns.forEach(pattern => {
      const matches = cleaned.match(pattern) || [];
      prioritizedElements.push(...matches.slice(0, 3)); // Limit to top 3 per pattern
    });
    
    result = prioritizedElements.join('\n\n');
    
    if (result.length > 40000) {
      result = result.substring(0, 40000) + '\n<!-- truncated for length -->';
    }
  }
  
  console.log(`[HTML Prep] Final length: ${result.length} characters`);
  return result;
};

/**
 * Use AI to check if a page contains actual menu content
 * @param {string} htmlContent - HTML content of the page
 * @param {string} url - URL of the page
 * @param {string} apiKey - Gemini API key
 * @returns {Promise<Object|null>} Menu detection result
 */
/**
 * Use AI to check if a page contains actual menu content
 * @param {string} htmlContent - HTML content of the page
 * @param {string} url - URL of the page
 * @param {string} apiKey - Gemini API key
 * @param {boolean} deepAnalysis - Whether to do enhanced analysis for hidden content
 * @returns {Promise<Object|null>} Menu detection result
 */
const checkIfPageIsMenuWithAI = async (htmlContent, url, apiKey, deepAnalysis = false) => {
  try {
    // Convert to text and get a larger sample for menu analysis
    const textContent = htmlToText(htmlContent);
    const sampleText = textContent.length > 20000 ? 
      textContent.substring(0, 20000) + '...[truncated]' : 
      textContent;
    
    // Write debug files for menu checking
    await writeDebugFile('menu-check-text', sampleText, url);
    if (deepAnalysis) {
      await writeDebugFile('menu-check-html-deep', htmlContent.substring(0, 15000) + '...[truncated]', url);
    }
    
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
- Food/drink item names (even without prices)
- Categories like: appetizers, entrees, mains, desserts, drinks, etc.
- Any prices with currency symbols ($, €, £, etc.)
- Food descriptions or ingredients
- Menu-style formatting or lists
- Restaurant menu terminology${analysisInstructions}

MENU PAGE can include:
- Online ordering systems or menu displays
- PDF menu links or embedded menus
- Menu sections even if some prices are missing
- "Call for pricing" or "Market price" items
- Seasonal or rotating menu items

NOT A MENU PAGE only if:
- ONLY contact info, hours, directions (no food mentioned)
- ONLY general restaurant description/about page
- ONLY reviews, news, or blog posts
- ONLY reservation or event booking pages
- Clearly broken/404 page

Be INCLUSIVE - if there's any reasonable indication of menu content, mark it as a menu page.

Return ONLY a JSON object:
{
  "isMenu": true/false,
  "confidence": 0-100,
  "reason": "brief explanation focusing on what food/menu content was found",
  "menuItemsFound": 0-50
}`;

    // Write debug file for the menu check AI prompt
    await writeDebugFile('ai-prompt-menu-check', prompt, url);

    const result = await callGeminiAPI(prompt, apiKey);
    
    if (!result.success) {
      console.warn(`[AI Menu Check] API failed for ${url}: ${result.error}`);
      return null;
    }
    
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn(`[AI Menu Check] Invalid response format for ${url}:`, result.content.substring(0, 200));
      return null;
    }
    
    const menuResult = JSON.parse(jsonMatch[0]);
    console.log(`[AI Menu Check] ${url} - isMenu: ${menuResult.isMenu}, confidence: ${menuResult.confidence}%, reason: ${menuResult.reason}`);
    
    return menuResult;
    
  } catch (error) {
    console.error('Error checking if page is menu:', error);
    return null;
  }
};

/**
 * Try common menu paths with AI validation (enhanced fallback)
 * @param {string} homepageUrl - Homepage URL
 * @returns {Promise<string|null>} Menu URL or null
 */
const tryCommonMenuPathsWithAI = async (homepageUrl) => {
  const baseUrl = new URL(homepageUrl);
  const commonPaths = ['/menu', '/food', '/our-menu', '/dining', '/menus'];
  
  console.log(`[AI Enhanced Common Paths] Testing common paths for: ${homepageUrl}`);
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  const hasAI = apiKey && apiKey !== 'your_gemini_api_key_here';
  
  // Check paths one by one (not in parallel to be gentler on servers)
  for (const path of commonPaths) {
    try {
      const url = new URL(path, baseUrl).href;
      console.log(`[AI Enhanced Common Paths] Checking: ${url}`);
      
      const content = await fetchPageContent(url);
      
      // If we can't fetch the content, the page doesn't exist or is inaccessible
      if (!content || content.trim() === '') {
        console.log(`[AI Enhanced Common Paths] No content found at: ${url}`);
        continue;
      }
      
      // If we have AI, use it to validate this is actually a menu page
      if (hasAI) {
        console.log(`[AI Enhanced Common Paths] Using AI to validate: ${url}`);
        const isMenuResult = await checkIfPageIsMenuWithAI(content, url, apiKey);
        
        if (isMenuResult && isMenuResult.isMenu && isMenuResult.confidence > 40) {
          console.log(`[AI Enhanced Common Paths] ✓ AI confirmed menu at: ${url} (confidence: ${isMenuResult.confidence}%)`);
          return url;
        } else if (isMenuResult) {
          console.log(`[AI Enhanced Common Paths] ✗ AI rejected: ${url} (confidence: ${isMenuResult.confidence}%, reason: ${isMenuResult.reason})`);
          continue; // Try next path
        } else {
          console.log(`[AI Enhanced Common Paths] AI validation failed for: ${url}`);
          // Fall back to basic validation for this URL
        }
      }
      
      // Fallback: Quick check for basic menu indicators (when AI fails or not available)
      console.log(`[AI Enhanced Common Paths] Using basic validation for: ${url}`);
      const hasMenuIndicators = ['$', '€', '£', 'price', '.99', '.95'].some(indicator => 
        content.includes(indicator)
      );
      
      if (hasMenuIndicators) {
        console.log(`[AI Enhanced Common Paths] ✓ Basic validation found menu indicators at: ${url}`);
        return url;
      } else {
        console.log(`[AI Enhanced Common Paths] ✗ No menu indicators found at: ${url}`);
      }
    } catch (error) {
      console.log(`[AI Enhanced Common Paths] Error checking ${baseUrl.origin}${path}: ${error.message}`);
      // Continue to next path if this one fails
      continue;
    }
  }
  
  console.log(`[AI Enhanced Common Paths] No valid menu found in common paths for: ${homepageUrl}`);
  return null;
};

/**
 * Try common menu paths first (fast & free)
 * @param {string} homepageUrl - Homepage URL
 * @returns {Promise<string|null>} Menu URL or null
 */
const tryCommonMenuPaths = async (homepageUrl) => {
  const baseUrl = new URL(homepageUrl);
  const commonPaths = ['/menu', '/food', '/our-menu', '/dining', '/menus'];
  
  // Check paths one by one (not in parallel to be gentler on servers)
  for (const path of commonPaths) {
    try {
      const url = new URL(path, baseUrl).href;
      console.log(`[Common Path] Checking: ${url}`);
      
      const content = await fetchPageContent(url);
      
      // If we can't fetch the content, the page doesn't exist or is inaccessible
      if (!content || content.trim() === '') {
        console.log(`[Common Path] No content found at: ${url}`);
        continue;
      }
      
      // Quick check for basic menu indicators
      const hasMenuIndicators = ['$', '€', '£', 'price', '.99', '.95'].some(indicator => 
        content.includes(indicator)
      );
      
      if (hasMenuIndicators) {
        console.log(`[Common Path] Found potential menu at: ${url}`);
        return url;
      } else {
        console.log(`[Common Path] No menu indicators found at: ${url}`);
      }
    } catch (error) {
      console.log(`[Common Path] Error checking ${baseUrl.origin}${path}: ${error.message}`);
      // Continue to next path if this one fails
      continue;
    }
  }
  
  console.log(`[Common Path] No valid menu found in common paths for: ${homepageUrl}`);
  return null;
};

/**
 * Prepare HTML for Gemini to minimize tokens
 * @param {string} html - Full HTML
 * @returns {string} Cleaned HTML
 */
const prepareHtmlForGemini = (html) => {
  // Remove scripts, styles, comments
  let cleaned = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
  
  // Extract navigation and menu-related elements
  const importantElements = [];
  
  // Get nav, header, and menu-related elements
  const navPattern = /<(nav|header|div[^>]*class[^>]*menu[^>]*)>[\s\S]*?<\/\1>/gi;
  const navMatches = cleaned.match(navPattern);
  if (navMatches) importantElements.push(...navMatches.slice(0, 3));
  
  // Get all links and buttons
  const linkPattern = /<(a|button)[^>]*>[\s\S]*?<\/\1>/gi;
  const linkMatches = cleaned.match(linkPattern);
  if (linkMatches) {
    // Filter for menu-related links
    const menuLinks = linkMatches.filter(link => 
      /menu|food|dining|order|eat/i.test(link)
    ).slice(0, 20);
    importantElements.push(...menuLinks);
  }
  
  // Include any hidden divs that might contain menus
  const hiddenPattern = /<div[^>]*(?:style[^>]*display\s*:\s*none|class[^>]*hidden)[^>]*>[\s\S]{0,500}<\/div>/gi;
  const hiddenMatches = cleaned.match(hiddenPattern);
  if (hiddenMatches) importantElements.push(...hiddenMatches.slice(0, 5));
  
  // Combine and limit size
  let result = importantElements.join('\n\n');
  if (result.length > 15000) {
    result = result.substring(0, 15000) + '\n<!-- truncated -->';
  }
  
  return result;
};

/**
 * Fallback menu finding without AI
 * @param {string} homepageUrl - Homepage URL
 * @returns {Promise<string>} Menu URL
 */
const findMenuPageFallback = async (homepageUrl) => {
  try {
    const htmlContent = await fetchPageContent(homepageUrl);
    if (!htmlContent) return homepageUrl;
    
    const baseUrl = new URL(homepageUrl);
    const menuLinks = extractMenuLinks(htmlContent, baseUrl);
    
    // Test each link
    for (const link of menuLinks.slice(0, 5)) {
      if (await isValidMenuPage(link)) {
        return link;
      }
    }
    
    return homepageUrl;
  } catch (error) {
    return homepageUrl;
  }
};

/**
 * Extract menu links from homepage content (from your original code)
 * @param {string} htmlContent - HTML content
 * @param {URL} baseUrl - Base URL for resolving relative links
 * @returns {Array<string>} Array of potential menu page URLs
 */
const extractMenuLinks = (htmlContent, baseUrl) => {
  const menuLinks = [];
  const menuKeywords = [
    'menu', 'food', 'eat', 'drink', 'coffee', 'tea', 'order', 'takeout', 'delivery'
  ];
  
  const linkPattern = /<a[^>]*href=["\']([^"\']*)["\'][^>]*>([^<]*)<\/a>/gi;
  let match;
  
  while ((match = linkPattern.exec(htmlContent)) !== null) {
    const href = match[1];
    const linkText = match[2].toLowerCase();
    
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
  
  return menuLinks;
};

/**
 * Quick check if URL contains menu content
 * @param {string} url - URL to check
 * @param {boolean} quickCheck - Do a faster check
 * @returns {Promise<boolean>} True if valid menu page
 */
const isValidMenuPage = async (url, quickCheck = false) => {
  try {
    const content = await fetchPageContent(url);
    if (!content) return false;
    
    // Quick check for menu indicators
    const menuIndicators = ['$', '€', '£', 'price', 'menu', '.99', '.95'];
    const indicatorCount = menuIndicators.filter(indicator => 
      content.includes(indicator)
    ).length;
    
    return indicatorCount >= 2;
  } catch (error) {
    return false;
  }
};

const scrapeMenuPage = async (url) => {
  try {
    // Use the server-side Playwright scraper instead of client-side scraping
    console.log(`[Server Scraping] Sending request to backend for: ${url}`);
    
    const serverUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3001';
    const response = await axios.post(`${serverUrl}/api/scrape-playwright`, {
      url: url,
      options: {
        mobile: true,
        timeout: 45000
      }
    }, {
      timeout: 60000, // 1 minute total timeout
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.data && response.data.success) {
      console.log(`[Server Scraping] Success: ${response.data.menuItems?.length || 0} items found`);
      return {
        success: true,
        menuItems: response.data.menuItems || [],
        categories: response.data.categories || [],
        restaurantInfo: response.data.restaurantInfo || {},
        method: 'server-playwright',
        extractionTime: response.data.extractionTime || 0,
        url: url
      };
    } else {
      throw new Error(response.data?.error || 'Server scraping failed');
    }
    
  } catch (error) {
    console.error(`[Server Scraping] Error for ${url}:`, error.message);
    
    // If server is unavailable, return appropriate error
    if (error.code === 'ECONNREFUSED' || error.message.includes('ECONNREFUSED')) {
      return {
        success: false,
        error: 'Backend server is not running. Please start the server with: cd backend && ./start-server.sh',
        menuItems: [],
        method: 'server-unavailable'
      };
    }
    
    return {
      success: false,
      error: error.message,
      menuItems: [],
      method: 'server-scraping-failed'
    };
  }
};

/**
 * Test basic connectivity to a URL
 * @param {string} url - URL to test
 * @returns {Promise<Object>} Test result with status and details
 */
const testConnectivity = async (url) => {
  try {
    console.log(`[Connectivity Test] Testing: ${url}`);
    
    // Try a simple HEAD request first via proxy
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    
    const response = await axios.head(proxyUrl, {
      timeout: 10000,
      validateStatus: () => true // Accept any status code
    });
    
    console.log(`[Connectivity Test] Response status: ${response.status}`);
    
    return {
      accessible: response.status < 500,
      status: response.status,
      url: url
    };
    
  } catch (error) {
    console.warn(`[Connectivity Test] Failed: ${error.message}`);
    return {
      accessible: false,
      error: error.message,
      url: url
    };
  }
};

/**
 * Fetch page content (using CORS proxy for all platforms)
 * @param {string} url - URL to fetch
 * @returns {Promise<string>} HTML content
 */
const fetchPageContent = async (url) => {
  try {
    // Try HTTPS first if HTTP was provided
    let urlsToTry = [url];
    if (url.startsWith('http://')) {
      const httpsUrl = url.replace('http://', 'https://');
      urlsToTry = [httpsUrl, url]; // Try HTTPS first, then HTTP
      console.log(`[Fetch] Trying HTTPS first for: ${url}`);
    }
    
    // Multiple CORS proxy services to try
    const proxyServices = [
      {
        name: 'allorigins',
        getUrl: (targetUrl) => `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`,
        extractContent: (response) => response.data?.contents,
        extractStatus: (response) => response.data?.status?.http_code
      },
      {
        name: 'corsproxy.io',
        getUrl: (targetUrl) => `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
        extractContent: (response) => response.data,
        extractStatus: (response) => response.status
      },
      {
        name: 'cors-anywhere-herokuapp',
        getUrl: (targetUrl) => `https://cors-anywhere.herokuapp.com/${targetUrl}`,
        extractContent: (response) => response.data,
        extractStatus: (response) => response.status
      }
    ];
    
    for (const tryUrl of urlsToTry) {
      for (const proxy of proxyServices) {
        try {
          console.log(`[Fetch] Attempting to fetch via ${proxy.name}: ${tryUrl}`);
          const proxyUrl = proxy.getUrl(tryUrl);
          
          const response = await axios.get(proxyUrl, {
            timeout: 20000, // Increased timeout
            headers: { 
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.5',
              'Accept-Encoding': 'gzip, deflate',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            },
            validateStatus: (status) => status < 500 // Accept 4xx responses but not 5xx
          });
          
          // Check if the proxy service returned an error or empty content
          if (!response.data) {
            console.error(`[Fetch] No response data via ${proxy.name} for: ${tryUrl}`);
            continue; // Try next proxy
          }
          
          const statusCode = proxy.extractStatus(response) || response.status;
          const content = proxy.extractContent(response);
          
          // Check if the original request failed (for proxies that return status info)
          if (statusCode >= 500) {
            console.error(`[Fetch] HTTP ${statusCode} via ${proxy.name} for: ${tryUrl}`);
            continue; // Try next proxy for 5xx errors
          }
          
          if (statusCode >= 400) {
            console.warn(`[Fetch] HTTP ${statusCode} via ${proxy.name} for: ${tryUrl}`);
            // For 4xx errors, still try to get content if available
          }
          
          // Additional check for empty or invalid content
          if (!content || content.trim() === '') {
            console.warn(`[Fetch] Empty content via ${proxy.name} for: ${tryUrl}`);
            continue; // Try next proxy
          }
          
          // Check for bot protection or JavaScript challenge pages
          const contentStr = typeof content === 'string' ? content : String(content);
          const isBotProtection = (
            contentStr.includes('Just a moment...') ||
            contentStr.includes('Enable JavaScript and cookies to continue') ||
            contentStr.includes('Checking your browser') ||
            contentStr.includes('Please wait while we verify') ||
            contentStr.includes('DDoS protection by Cloudflare') ||
            contentStr.includes('Access denied') ||
            contentStr.includes('You are being redirected') ||
            contentStr.includes('Please enable cookies') ||
            contentStr.includes('This process is automatic') ||
            (contentStr.length < 500 && contentStr.includes('JavaScript'))
          );
          
          if (isBotProtection) {
            console.warn(`[Fetch] Bot protection detected via ${proxy.name} for: ${tryUrl}`);
            console.warn(`[Fetch] Content preview: ${contentStr.substring(0, 200)}...`);
            continue; // Try next proxy
          }
          
          // Check for PDF content or other binary data
          const isPdfOrBinary = (
            contentStr.includes('%PDF-') ||
            contentStr.includes('1.0 0.0 0.0 1.0') ||
            contentStr.includes('Å/') ||
            contentStr.includes('Ä') ||
            (contentStr.includes('0.0 0.0') && contentStr.includes('1.0 0.0') && contentStr.length > 1000) ||
            contentStr.startsWith('%PDF') ||
            // Check for common PDF internal structures
            (contentStr.includes('obj') && contentStr.includes('endobj') && contentStr.includes('stream'))
          );
          
          if (isPdfOrBinary) {
            console.warn(`[Fetch] PDF or binary content detected via ${proxy.name} for: ${tryUrl}`);
            console.warn(`[Fetch] Content preview: ${contentStr.substring(0, 200)}...`);
            
            // If this appears to be a PDF menu, we should try to find the actual menu page instead
            if (tryUrl.toLowerCase().includes('menu') || tryUrl.toLowerCase().includes('food')) {
              console.log(`[Fetch] PDF appears to be a menu document, marking as inaccessible for HTML parsing`);
            }
            
            continue; // Try next proxy or skip this URL
          }
          
          // Check for obvious error pages (be conservative - only block clearly broken pages)
          const isObviousError = (
            // Explicit error messages
            (contentStr.includes('Page not found') || contentStr.includes('404') || 
             contentStr.includes('Not Found') || contentStr.includes('Error 404') ||
             contentStr.includes('404 - Page Not Found') || contentStr.includes('404 Error')) &&
            // AND very short content (both conditions must be true)
            contentStr.length < 200
          ) || (
            // OR extremely short content that's clearly not a real page
            contentStr.length < 50
          );
          
          if (isObviousError) {
            console.warn(`[Fetch] Appears to be error page via ${proxy.name} for: ${tryUrl} (length: ${contentStr.length})`);
            continue; // Try next proxy
          }
          
          console.log(`[Fetch] Successfully fetched content via ${proxy.name} from: ${tryUrl} (${contentStr.length} chars)`);
          return contentStr;
          
        } catch (proxyError) {
          console.warn(`[Fetch] Failed to fetch via ${proxy.name} for ${tryUrl}: ${proxyError.message}`);
          // Continue to next proxy
          continue;
        }
      }
    }
    
    // If we get here, all proxies failed for all URLs
    console.error(`[Fetch] All proxy attempts failed for: ${url}`);
    return null;
    
  } catch (error) {
    console.error(`[Fetch] Fatal error for ${url}: ${error.message}`);
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
  
  // Clean up the URL
  url = url.trim();
  
  // Add protocol if missing
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    // Default to HTTPS for better compatibility
    url = 'https://' + url;
  }
  
  // Handle www prefix consistently
  try {
    const urlObj = new URL(url);
    
    // Remove trailing slash
    if (urlObj.pathname === '/') {
      urlObj.pathname = '';
    }
    
    const normalized = urlObj.toString().replace(/\/$/, '');
    console.log(`[URL Normalize] ${url} -> ${normalized}`);
    return normalized;
    
  } catch (error) {
    console.warn(`[URL Normalize] Invalid URL: ${url}, using as-is`);
    return url.replace(/\/$/, '');
  }
};

/**
 * Parse menu items from HTML content
 * @param {string} htmlContent - HTML content
 * @param {string} url - Source URL
 * @returns {Object} Parsed menu data
 */
const parseMenuFromHtml = async (htmlContent, url) => {
  try {
    // Convert HTML to text and extract menu-like content
    const textContent = htmlToText(htmlContent);
    
    console.log(`[Menu Parsing] Starting extraction from: ${url}`);
    console.log(`[Menu Parsing] Text content length: ${textContent.length} characters`);
    
    // Extract menu items using various strategies
    const menuItems = [];
    
    // Strategy 1: Look for structured menu patterns
    const structuredItems = extractStructuredMenuItems(textContent);
    menuItems.push(...structuredItems);
    console.log(`[Menu Parsing] Strategy 1 (structured): found ${structuredItems.length} items`);
    
    // Strategy 2: Look for price patterns
    const pricePatterns = extractItemsWithPrices(textContent);
    menuItems.push(...pricePatterns);
    console.log(`[Menu Parsing] Strategy 2 (price patterns): found ${pricePatterns.length} items`);
    
    // Strategy 3: Look for food-related terms (only if we have some priced items)
    if (pricePatterns.length > 0) {
      const foodItems = extractFoodItems(textContent);
      menuItems.push(...foodItems);
      console.log(`[Menu Parsing] Strategy 3 (food items): found ${foodItems.length} items`);
    }
    
    // Remove duplicates and clean up
    const uniqueItems = removeDuplicateItems(menuItems);
    const cleanedItems = uniqueItems.map(item => cleanMenuItem(item));
    
    // Quality check: Make sure we found enough menu-like content
    const itemsWithPrices = cleanedItems.filter(item => item.price && item.price.trim() !== '');
    const totalItems = cleanedItems.length;
    
    console.log(`[Menu Parsing] Traditional methods result: ${totalItems} total items, ${itemsWithPrices.length} with prices`);
    
    // If traditional methods found sufficient items, return them
    if (totalItems >= 5 && (itemsWithPrices.length > 0 || totalItems >= 15)) {
      console.log(`[Menu Parsing] Traditional extraction successful`);
      return {
        success: true,
        menuItems: cleanedItems,
        totalItems: cleanedItems.length,
        itemsWithPrices: itemsWithPrices.length,
        method: 'traditional-scraping',
        url: url
      };
    }
    
    // Traditional methods failed - try AI extraction
    console.log(`[Menu Parsing] Traditional methods insufficient, trying AI extraction...`);
    const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      console.warn(`[Menu Parsing] No API key available for AI extraction`);
      return {
        success: false,
        error: 'Insufficient menu content found using traditional methods and no AI key available',
        menuItems: cleanedItems, // Return what we found
        method: 'insufficient-content',
        url: url
      };
    }
    
    const aiExtractedItems = await extractMenuItemsWithAI(textContent, url, apiKey);
    
    if (aiExtractedItems && aiExtractedItems.length > 0) {
      console.log(`[Menu Parsing] AI extraction successful: found ${aiExtractedItems.length} items`);
      
      // Combine traditional and AI results, preferring AI for completeness
      const combinedItems = [...cleanedItems, ...aiExtractedItems];
      const finalItems = removeDuplicateItems(combinedItems).map(item => cleanMenuItem(item));
      const finalItemsWithPrices = finalItems.filter(item => item.price && item.price.trim() !== '');
      
      return {
        success: true,
        menuItems: finalItems,
        totalItems: finalItems.length,
        itemsWithPrices: finalItemsWithPrices.length,
        method: 'ai-enhanced-scraping',
        url: url
      };
    }
    
    // Both traditional and AI methods failed
    console.log(`[Menu Parsing] Both traditional and AI methods failed`);
    return {
      success: false,
      error: 'Could not extract sufficient menu content using traditional or AI methods',
      menuItems: cleanedItems, // Return what we found
      method: 'extraction-failed',
      url: url
    };
    
  } catch (error) {
    console.error(`[Menu Parsing] Error: ${error.message}`);
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
    { symbols: ['$'], keywords: ['usd', 'dollar', 'united states', 'america', 'usa'], currency: '$' },
    { symbols: ['€'], keywords: ['eur', 'euro', 'germany', 'france', 'italy', 'spain', 'portugal'], currency: '€' },
    { symbols: ['£'], keywords: ['gbp', 'pound', 'sterling', 'united kingdom', 'britain', 'uk'], currency: '£' },
    { symbols: ['¥'], keywords: ['jpy', 'yen', 'japan', 'japanese'], currency: '¥' },
    { symbols: ['₹'], keywords: ['inr', 'rupee', 'india', 'indian'], currency: '₹' },
    { symbols: ['₽'], keywords: ['rub', 'ruble', 'russia', 'russian'], currency: '₽' },
    { symbols: ['₩'], keywords: ['krw', 'won', 'korea', 'korean'], currency: '₩' },
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
    /([^.\n]+?)[\s\.]*([\$\£\€\¥\₹\₽\₩\₪\₫\₡\₦\₨\₱\¢\₵][\d,]+\.?\d*)/g,
    /([^.\n]+?)[\s\.]*([\d,]+\.?\d*[\$\£\€\¥\₹\₽\₩\₪\₫\₡\₦\₨\₱\¢\₵])/g,
    /([^.\n]+?)[\s\.]*(\d+\.\d{2})/g,
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
 * Extract menu items using AI when traditional methods fail
 * @param {string} textContent - Plain text content of the page
 * @param {string} url - Source URL
 * @param {string} apiKey - Gemini API key
 * @returns {Promise<Array>} Array of menu items extracted by AI
 */
const extractMenuItemsWithAI = async (textContent, url, apiKey) => {
  try {
    // Use a larger sample for AI extraction
    const sampleText = textContent.length > 30000 ? 
      textContent.substring(0, 30000) + '...[truncated for length]' : 
      textContent;
    
    // Write debug file for AI extraction
    await writeDebugFile('ai-extraction-input', sampleText, url);
    
    const prompt = `Extract menu items from this restaurant webpage content. Focus on finding actual food and drink items with their details.

URL: ${url}

Page Content:
${sampleText}

INSTRUCTIONS:
1. Extract ONLY actual food/drink items (not categories, descriptions, or other text)
2. Look for patterns like: "Item Name ... Price" or "Item Name - Description - Price"
3. Include items even if they don't have prices (mark price as empty)
4. Categorize items appropriately (appetizers, mains, desserts, drinks, etc.)
5. Extract item descriptions/ingredients when available
6. Handle various price formats ($12.99, 12.99, $12, etc.)

Return ONLY a JSON array of menu items in this exact format:
[
  {
    "name": "Menu item name",
    "price": "$12.99" or "",
    "category": "appetizers|mains|desserts|drinks|sides|etc",
    "description": "Brief description or ingredients if available"
  }
]

IMPORTANT: 
- Return an empty array [] if no clear menu items are found
- Do NOT include section headers, restaurant info, or general text
- Focus on actual orderable items
- If unsure about price, leave it empty rather than guessing
- Limit to maximum 50 items to avoid overwhelming output`;

    // Write debug file for the AI extraction prompt
    await writeDebugFile('ai-prompt-extraction', prompt, url);

    console.log(`[AI Extraction] Sending ${sampleText.length} characters to AI for menu extraction`);
    const result = await callGeminiAPI(prompt, apiKey);
    
    if (!result.success) {
      console.warn(`[AI Extraction] API call failed: ${result.error}`);
      return [];
    }
    
    // Extract JSON array from response
    const jsonMatch = result.content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.warn(`[AI Extraction] No JSON array found in response:`, result.content.substring(0, 200));
      return [];
    }
    
    try {
      const menuItems = JSON.parse(jsonMatch[0]);
      
      if (!Array.isArray(menuItems)) {
        console.warn(`[AI Extraction] Response is not an array:`, typeof menuItems);
        return [];
      }
      
      // Validate and clean the extracted items
      const validItems = menuItems.filter(item => 
        item && 
        typeof item === 'object' && 
        item.name && 
        item.name.trim().length > 2 &&
        item.name.trim().length < 200
      ).map(item => ({
        name: item.name.trim(),
        price: item.price ? item.price.trim() : '',
        category: item.category || 'General',
        description: item.description ? item.description.trim() : ''
      }));
      
      console.log(`[AI Extraction] Successfully extracted ${validItems.length} valid items from AI response`);
      return validItems;
      
    } catch (parseError) {
      console.error(`[AI Extraction] JSON parsing error:`, parseError.message);
      console.log(`[AI Extraction] Raw response:`, jsonMatch[0].substring(0, 500));
      return [];
    }
    
  } catch (error) {
    console.error(`[AI Extraction] Error: ${error.message}`);
    return [];
  }
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
 * Call Gemini API with retry logic and model fallbacks
 * @param {string} prompt - The prompt to send to Gemini
 * @param {string} apiKey - Gemini API key
 * @returns {Promise<Object>} API response
 */
const callGeminiAPI = async (prompt, apiKey) => {
  // Common request body for all API calls
  const requestBody = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }]
  };
  
  // Common request config
  const requestConfig = {
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: 15000, // 15 second timeout
  };
  
  // Models to try in order of preference
  const models = [
    {
      name: 'gemini-2.5-flash',
      url: `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`
    },
    {
      name: 'gemini-1.5-flash',
      url: `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`
    }
  ];
  
  // Create a custom axios instance for better timeout control
  const axiosInstance = axios.create({
    timeout: requestConfig.timeout,
  });
  
  // Try each model in sequence
  for (const model of models) {
    try {
      console.info(`[Gemini] Trying ${model.name}...`);
      
      // Create a timeout promise to handle the case where axios doesn't respect its timeout
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Request to ${model.name} timed out after ${requestConfig.timeout/1000}s`)), 
        requestConfig.timeout + 5000) // Add 5s buffer to the axios timeout
      );
      
      // Race the axios request against our manual timeout
      const response = await Promise.race([
        axiosInstance.post(model.url, requestBody, requestConfig),
        timeoutPromise
      ]);
      
      console.info(`[Gemini] ${model.name} response received`);
      
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.info(`[Gemini] Model used: ${model.name}`);
      }
      
      if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        return {
          success: true,
          model: model.name,
          content: response.data.candidates[0].content.parts[0].text
        };
      } else if (response.data?.error) {
        // Handle Google API specific errors
        const googleError = response.data.error;
        console.error(`[Gemini] ${model.name} Google API error:`, 
                     `Code: ${googleError.code}`,
                     `Message: ${googleError.message}`,
                     `Status: ${googleError.status}`);
                     
        // If we get certain errors, no need to try other models
        if (googleError.code === 400 || 
            googleError.message?.includes('Too many tokens')) {
          return {
            success: false,
            error: `API error: ${googleError.message} (input may be too large)`
          };
        }
        // Continue to next model for other error types
      } else {
        console.warn(`[Gemini] ${model.name} returned invalid format:`, JSON.stringify(response.data).substring(0, 500));
        // Continue to the next model
      }
    } catch (error) {
      const isTimeout = error.code === 'ECONNABORTED' || 
                        error.message.includes('timeout') ||
                        error.message.includes('timed out');
      
      const isNetworkError = error.message.includes('Network Error') || 
                            !error.response;
      
      // Log more detailed error information
      console.error(`[Gemini] ${model.name} error:`, 
                   `Message: ${error.message}`, 
                   `Type: ${isTimeout ? 'Timeout' : isNetworkError ? 'Network Error' : 'API Error'}`,
                   `Status: ${error.response?.status || 'N/A'}`,
                   `Response data: ${JSON.stringify(error?.response?.data || 'No response data').substring(0, 500)}`);
      
      // If we've tried all models and still getting network errors
      if (model.name === models[models.length - 1].name) {
        if (isTimeout) {
          return {
            success: false,
            error: 'Request timed out. This might be due to poor network conditions or server load. Please try again later.'
          };
        } else if (isNetworkError) {
          return {
            success: false,
            error: 'Network connection failed. Please check your internet connection and try again.'
          };
        } else if (error.response?.status === 401) {
          return {
            success: false,
            error: 'Invalid API key. Please check your Gemini API key configuration.'
          };
        } else if (error.response?.status === 429) {
          return {
            success: false,
            error: 'API rate limit exceeded. Please wait a moment and try again.'
          };
        } else {
          return {
            success: false,
            error: `Gemini API error: ${error.message}`
          };
        }
      }
      // Otherwise continue to the next model
    }
  }
  
  // If we've exhausted all models without a successful response
  return {
    success: false,
    error: 'Failed to get a valid response from any Gemini model'
  };
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

module.exports = {
  scrapeRestaurantMenu,
  testConnectivity
};



