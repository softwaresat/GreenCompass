import axios from 'axios';

/**
 * LLM Service for Vegetarian Menu Analysis
 * This service integrates with Google Gemini API to analyze scraped menu items
 * and identify vegetarian options using AI
 */

/**
 * Analyzes scraped menu items to identify vegetarian-friendly options
 * @param {Array} menuItems - Array of scraped menu items
 * @param {string} restaurantName - Name of the restaurant for context
 * @returns {Promise<Object>} Analysis results with vegetarian options
 */
export const analyzeScrapedMenuForVegetarianOptions = async (menuItems, restaurantName) => {
  try {
    const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      throw new Error('Gemini API key not configured');
    }

    if (!menuItems || menuItems.length === 0) {
      return {
        vegetarianItems: [],
        summary: "No menu items found to analyze for vegetarian options.",
        confidence: 0.0,
        totalItems: 0,
        overallRating: 'unknown',
        enhancedMenuItems: [] // Added for enhanced items
      };
    }

    // First, analyze menu items for vegetarian options
    // Create a focused prompt for vegetarian analysis of scraped menu (no batching)
    const prompt = createScrapedMenuAnalysisPrompt(menuItems, restaurantName);
    const analysisResult = await callGeminiAPI(prompt, apiKey);
    
    let vegetarianAnalysis = null;
    if (analysisResult.success) {
      vegetarianAnalysis = parseScrapedMenuAnalysis(analysisResult.content, menuItems);
    } else {
      throw new Error(`Gemini API error: ${analysisResult.error}`);
    }
    
    // Now, try to enhance only the vegetarian items (non-blocking for overall function)
    let enhancedItems = [...menuItems]; // Default to original items
    try {
      // Only enhance vegetarian items identified by the analysis
      const vegetarianItemsToEnhance = vegetarianAnalysis.vegetarianItems || [];
      
      if (vegetarianItemsToEnhance.length === 0) {
        console.log(`[WebScraping] No vegetarian items found to enhance`);
        return {
          ...vegetarianAnalysis,
          enhancedMenuItems: menuItems
        };
      }
      
      console.log(`[WebScraping] Enhancing ${vegetarianItemsToEnhance.length} vegetarian items from "${restaurantName}" with AI...`);
      
      // Use batching for enhancement to avoid token limits
      const batchSize = 25; // Larger batch size for efficiency while still maintaining reliability
      const batches = splitIntoBatches(vegetarianItemsToEnhance, batchSize);
      console.log(`[DEBUG] Split ${vegetarianItemsToEnhance.length} vegetarian items into ${batches.length} batches of up to ${batchSize} items each`);
      
      // Map of original vegetarian items by name for quick lookup
      const vegetarianItemMap = new Map();
      vegetarianItemsToEnhance.forEach(item => {
        vegetarianItemMap.set(item.name.toLowerCase(), item);
      });
      
      // Process each batch separately
      const enhancedVegetarianItems = [];
      let successfulBatches = 0;
      
      for (let i = 0; i < batches.length; i++) {
        const currentBatch = batches[i];
        console.log(`[DEBUG] Processing batch ${i+1}/${batches.length} with ${currentBatch.length} vegetarian items`);
        
        // Create a prompt for this batch
        const batchPrompt = createMenuEnhancementPrompt(currentBatch, restaurantName || 'Restaurant');
        console.log(`[DEBUG] Batch ${i+1} prompt length: ${batchPrompt.length} characters`);
        
        // Try to enhance this batch with a single retry
        let batchResult = null;
        let retryCount = 0;
        const maxRetries = 1; // Just one retry per batch
        
        while (retryCount <= maxRetries && !batchResult?.success) {
          if (retryCount > 0) {
            console.log(`[Gemini] Retry for batch ${i+1}...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          batchResult = await callGeminiAPI(batchPrompt, apiKey);
          retryCount++;
        }
        
        if (batchResult?.success) {
          console.info(`[Gemini] Batch ${i+1} enhancement successful using ${batchResult.model || 'API'}`);
          const enhancedBatchItems = parseEnhancedMenuItems(batchResult.content, currentBatch);
          enhancedVegetarianItems.push(...enhancedBatchItems);
          successfulBatches++;
        } else {
          console.warn(`[Gemini] Batch ${i+1} enhancement failed:`, batchResult?.error || 'Unknown error');
          // If a batch fails, use the original items for that batch
          enhancedVegetarianItems.push(...currentBatch);
        }
        
        // Small delay between batches to avoid rate limiting
        if (i < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      console.log(`[DEBUG] Enhancement complete. ${successfulBatches}/${batches.length} batches processed successfully`);
      
      if (successfulBatches > 0) {
        // Create a copy of all menu items, we'll only update the vegetarian ones
        const resultItems = [...menuItems];
        
        // Apply enhancements only to vegetarian items
        enhancedVegetarianItems.forEach(enhancedItem => {
          // Skip items that don't have a name or originalName
          if (!enhancedItem.name && !enhancedItem.originalName) return;
          
          // Match by original name first (more reliable)
          const matchKey = enhancedItem.originalName || enhancedItem.name;
          
          // Find the matching original item
          const matchIndex = resultItems.findIndex(item => 
            item.name.toLowerCase() === matchKey.toLowerCase()
          );
          
          if (matchIndex !== -1) {
            // Update the item with enhanced info
            if (enhancedItem.name && enhancedItem.name !== enhancedItem.originalName) {
              resultItems[matchIndex].name = enhancedItem.name;
            }
            
            if (enhancedItem.category) {
              resultItems[matchIndex].category = enhancedItem.category;
            }
          }
        });
        
        enhancedItems = resultItems;
        
      } else {
        console.warn('[Gemini] All enhancement batches failed. Using original items.');
      }
    } catch (enhancementError) {
      console.error('[Gemini] Error in menu enhancement:', enhancementError.message);
      // If enhancement fails, we still continue with original items
    }
    
    // Return both the vegetarian analysis and enhanced items
    return {
      ...vegetarianAnalysis,
      enhancedMenuItems: enhancedItems
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Enhances vegetarian menu items with more descriptive content using Gemini API
 * @param {Array} menuItems - Array of menu items (only vegetarian items will be enhanced)
 * @param {string} restaurantName - Name of the restaurant for context
 * @param {boolean} onlyVegetarian - Whether to enhance only items marked as vegetarian (if false, enhances all items)
 * @returns {Promise<Array>} Enhanced menu items
 */
export const enhanceMenuItems = async (menuItems, restaurantName, onlyVegetarian = true) => {
  try {
    console.log(`[WebScraping] Enhancing ${menuItems.length} scraped items from "${restaurantName}" with AI...`);
    
    // Add debug logging for menu items
    console.log(`[DEBUG] First menu item name: "${menuItems[0]?.name || 'none'}", restaurant name: "${restaurantName || 'none'}"`);
    
    const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      console.warn('[Gemini] API key not configured, skipping enhancement');
      return menuItems;
    }

    if (!menuItems || menuItems.length === 0) {
      console.warn('[Gemini] No menu items to enhance');
      return menuItems;
    }

    // Create a prompt for menu item enhancement
    const prompt = createMenuEnhancementPrompt(menuItems, restaurantName || 'Restaurant');
    
    // Add debug for prompt length
    console.log(`[DEBUG] Enhancement prompt length: ${prompt.length} characters`);
    
    // Try up to 3 times with increasing delays
    let enhancementResult;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      enhancementResult = await callGeminiAPI(prompt, apiKey);
      
      if (enhancementResult.success) {
        console.info(`[Gemini] Enhancement successful using ${enhancementResult.model || 'API'}`);
        break; // Exit loop if successful
      }
      
      console.warn(`[Gemini] Enhancement attempt ${retryCount + 1} failed:`, enhancementResult.error);
      retryCount++;
      
      if (retryCount < maxRetries) {
        // Wait before retrying (increasing delay for each retry)
        const delayMs = 1000 * Math.pow(2, retryCount); // Exponential backoff: 2s, 4s, 8s...
        console.info(`[Gemini] Retrying in ${delayMs/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    if (enhancementResult?.success) {
      return parseEnhancedMenuItems(enhancementResult.content, menuItems);
    } else {
      console.warn('[Gemini] Menu enhancement failed after retries. Using original items.');
      // If enhancement fails, return original items
      return menuItems;
    }
  } catch (error) {
    console.error('[Gemini] Error in enhanceMenuItems:', error.message);
    // If any error occurs, return original items
    return menuItems;
  }
};

/**
 * Helper to split an array into batches
 * @param {Array} arr - The array to split
 * @param {number} batchSize - The size of each batch
 * @returns {Array<Array>} Array of batches
 */
const splitIntoBatches = (arr, batchSize) => {
  const batches = [];
  for (let i = 0; i < arr.length; i += batchSize) {
    batches.push(arr.slice(i, i + batchSize));
  }
  return batches;
};

/**
 * Helper to aggregate results from multiple Gemini API responses
 * @param {Array<Object>} batchResults - Array of parsed batch results
 * @returns {Object} Aggregated result
 */
const aggregateBatchResults = (batchResults) => {
  const allVegetarianItems = batchResults.flatMap(r => r.vegetarianItems || []);
  const allRecommendations = batchResults.flatMap(r => r.recommendations || []);
  const summaries = batchResults.map(r => r.summary).filter(Boolean);
  const confidences = batchResults.map(r => r.confidence).filter(c => typeof c === 'number');
  const totalItems = batchResults.reduce((sum, r) => sum + (r.totalItems || 0), 0);
  // Use the 'worst' friendliness (limited < fair < good < excellent)
  const friendlinessOrder = ['limited', 'fair', 'good', 'excellent'];
  let friendliness = 'unknown';
  for (const r of batchResults) {
    if (r.restaurantVegFriendliness && friendlinessOrder.includes(r.restaurantVegFriendliness)) {
      if (
        friendliness === 'unknown' ||
        friendlinessOrder.indexOf(r.restaurantVegFriendliness) < friendlinessOrder.indexOf(friendliness)
      ) {
        friendliness = r.restaurantVegFriendliness;
      }
    }
  }
  return {
    vegetarianItems: allVegetarianItems,
    summary: summaries.join(' '),
    restaurantVegFriendliness: friendliness,
    totalItems,
    confidence: confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0.5,
    recommendations: Array.from(new Set(allRecommendations)),
  };
};

/**
 * Call Gemini API with retry logic
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
    timeout: 15000, // Increased to 15 second timeout for menu enhancement
  };
  
  // Models to try in order of preference
  const models = [
    {
      name: 'gemini-2.0-flash-lite',
      url: `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`
    },
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
 * Create a focused prompt for scraped menu analysis
 * @param {Array} menuItems - Array of scraped menu items
 * @param {string} restaurantName - Name of the restaurant
 * @returns {string} Formatted prompt for Gemini API
 */
const createScrapedMenuAnalysisPrompt = (menuItems, restaurantName) => {
  const itemsText = menuItems.map((item, index) => {
    // Shorten description to 100 characters max
    let desc = (item.description || 'No description').trim();
    if (desc.length > 100) desc = desc.slice(0, 100) + '...';
    return `${index + 1}. ${item.name}: ${desc}`;
  }).join('\n');

  return `You are a multilingual vegetarian dining expert analyzing a restaurant menu. The menu items may be in any language (English, Spanish, French, Italian, German, Portuguese, Japanese, Chinese, etc.). Please analyze the following menu items from "${restaurantName}" and identify vegetarian-friendly options.

MENU ITEMS:
${itemsText}

ANALYSIS REQUIREMENTS:
1. MULTILINGUAL SUPPORT: Work with menu items in their original language - translate and understand items in any language
2. Identify ALL items that are vegetarian (no meat, poultry, fish, or seafood)
3. Include items that can be easily modified to be vegetarian (mention modification needed)
4. Look for explicit vegetarian markings in any language (V, VEG, vegetarian symbols, "vegetariano", "végétarien", "vegetarisch", etc.)
5. Consider side dishes, appetizers, salads, desserts, and beverages that are vegetarian
6. For dessert places: analyze pastries, cakes, ice cream, coffee drinks, etc. for vegetarian ingredients
7. Be inclusive - when in doubt about an item, include it with a note about potential ingredients to check
8. Provide item names in their original language but add English translations in parentheses if needed

RESPONSE FORMAT (JSON):
{
  "vegetarianItems": [
    {
      "name": "Item Name",
      "description": "Brief description if available, if not available, create a description based on your knowledge of your item with a disclaimer",
      "price": "Price if listed",
      "category": "appetizer|main|side|dessert|beverage",
      "confidence": 0.95,
      "notes": "Any modifications needed or uncertainty about ingredients",
      "isVegan": true/false,
      "explicitlyMarked": true/false
    }
  ],
  "summary": "Brief summary of vegetarian options available",
  "restaurantVegFriendliness": "excellent|good|fair|limited",
  "totalItems": 12,
  "confidence": 0.85,
  "recommendations": ["Specific recommendations for vegetarians"]
}

IMPORTANT: 
- Focus on being helpful to vegetarians
- When uncertain about ingredients, include the item but note the uncertainty
- Look for common vegetarian dishes: salads, pasta (check for meat), pizza (veggie options), rice dishes, etc.
- Consider items like french fries, onion rings, etc. that are often vegetarian
- Include beverages and desserts that are vegetarian

Please respond ONLY with valid JSON.`;
};

/**
 * Creates a prompt for enhancing menu items with Gemini
 * @param {Array} menuItems - Array of scraped menu items
 * @param {string} restaurantName - Name of the restaurant
 * @returns {string} Formatted prompt for Gemini API
 */
const createMenuEnhancementPrompt = (menuItems, restaurantName) => {
  // Check if menuItems is array and has items
  if (!Array.isArray(menuItems)) {
    console.error('[Gemini] createMenuEnhancementPrompt received non-array menuItems:', typeof menuItems);
    return ''; // Return empty string to trigger failure path
  }
  
  if (menuItems.length === 0) {
    console.error('[Gemini] createMenuEnhancementPrompt received empty menuItems array');
    return ''; // Return empty string to trigger failure path
  }
  
  // Create a simplified version of menu items with just names to reduce payload size
  const simplifiedItems = menuItems.map(item => {
    if (!item || typeof item !== 'object') {
      console.error('[Gemini] Invalid menu item:', item);
      return { name: 'Unknown Item' }; // Provide a default
    }
    return { name: item.name || 'Unknown Item' };
  });
  
  console.log(`[DEBUG] Creating prompt with ${simplifiedItems.length} items and restaurant name "${restaurantName || 'Unknown Restaurant'}"`);
  
  // Calculate prompt size for logging
  const itemsJson = JSON.stringify(simplifiedItems, null, 2);
  console.log(`[DEBUG] Items JSON size: ${itemsJson.length} characters`);
  
  // Even more simplified prompt to minimize token usage
  return `For vegetarian menu items from "${restaurantName || 'Restaurant'}", enhance these items:
${itemsJson}

Return valid JSON with fixed item names and categories (appetizer, entree, side, dessert, beverage, other), remove any unnecessary symbols and correct words:
{"items":[{"originalName":"exact original","name":"fixed name","category":"category"}]}`;
};

/**
 * Parse enhanced menu items response
 * @param {string} content - Raw response from Gemini API
 * @param {Array} originalItems - Original scraped menu items
 * @returns {Array} Enhanced menu items
 */
const parseEnhancedMenuItems = (content, originalItems) => {
  try {
    console.log(`[DEBUG] parseEnhancedMenuItems received content of length: ${content?.length || 0}`);
    
    if (!content || typeof content !== 'string') {
      console.warn('[Gemini] Empty or invalid content received');
      return originalItems;
    }
    
    // Clean up the response - remove markdown code blocks if present
    let cleanedContent = content.replace(/```json\s*|\s*```/g, '').trim();
    
    // Try to find JSON in the response
    const jsonStart = cleanedContent.indexOf('{');
    const jsonEnd = cleanedContent.lastIndexOf('}') + 1;
    
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      cleanedContent = cleanedContent.substring(jsonStart, jsonEnd);
      console.log(`[DEBUG] JSON extracted from positions ${jsonStart} to ${jsonEnd}`);
    } else {
      console.warn('[Gemini] No valid JSON structure found in response');
      console.log(`[DEBUG] Content preview: "${cleanedContent.substring(0, 100)}..."`);
      return originalItems;
    }
    
    let parsed;
    try {
      parsed = JSON.parse(cleanedContent);
      console.log(`[DEBUG] Successfully parsed JSON with keys: ${Object.keys(parsed).join(', ')}`);
    } catch (jsonError) {
      console.error('[Gemini] JSON parse error:', jsonError.message);
      console.debug('[Gemini] Content that failed to parse:', cleanedContent.substring(0, 100) + '...');
      return originalItems;
    }
    
    // Support multiple possible response formats
    const enhancedItems = parsed.enhancedItems || parsed.enhancements || 
                          (parsed.items ? parsed.items : []);
    
    console.log(`[DEBUG] Found ${enhancedItems.length} enhanced items in response`);
    
    if (!Array.isArray(enhancedItems) || enhancedItems.length === 0) {
      console.warn('[Gemini] No enhanced items found in parsed response');
      return originalItems;
    }
    
    // Just return the enhanced items since we'll map them to originals later
    return enhancedItems;
  } catch (error) {
    console.error('[Gemini] Error parsing enhanced menu items:', error.message);
    // If parsing failed, return original
    return originalItems;
  }
};

/**
 * Parse scraped menu analysis response
 * @param {string} content - Raw response from Gemini API
 * @param {Array} menuItems - Array of scraped menu items
 * @returns {Object} Parsed analysis results
 */
const parseScrapedMenuAnalysis = (content, menuItems) => {
  try {
    
    // Clean up the response - remove markdown code blocks if present
    let cleanedContent = content.replace(/```json\s*|\s*```/g, '').trim();
    
    // Try to find JSON in the response
    const jsonStart = cleanedContent.indexOf('{');
    const jsonEnd = cleanedContent.lastIndexOf('}') + 1;
    
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      cleanedContent = cleanedContent.substring(jsonStart, jsonEnd);
    }
    
    
    const parsed = JSON.parse(cleanedContent);
    
    // Validate and normalize the response
    const normalized = {
      vegetarianItems: Array.isArray(parsed.vegetarianItems) ? parsed.vegetarianItems.map(item => ({
        name: item.name || 'Unknown Item',
        description: item.description || '',
        price: item.price || '',
        category: item.category || 'main',
        confidence: typeof item.confidence === 'number' ? item.confidence : 0.7,
        notes: item.notes || '',
        isVegan: !!item.isVegan,
        explicitlyMarked: !!item.explicitlyMarked
      })) : [],
      summary: parsed.summary || 'Scraped menu analysis completed.',
      restaurantVegFriendliness: parsed.restaurantVegFriendliness || 'fair',
      totalItems: parsed.totalItems || parsed.vegetarianItems?.length || 0,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : []
    };
    
    
    return normalized;
    
  } catch (parseError) {
    
    
    // Manual extraction fallback
    return {
      vegetarianItems: [],
      summary: 'Failed to parse analysis results. Please check API configuration.',
      restaurantVegFriendliness: 'unknown',
      totalItems: menuItems.length,
      confidence: 0.0,
      recommendations: []
    };
  }
};