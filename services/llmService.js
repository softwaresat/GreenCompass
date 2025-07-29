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

    // First, analyze menu items for vegetarian options with batching
    console.log(`[WebScraping] Analyzing ${menuItems.length} menu items from "${restaurantName}" for vegetarian options...`);
    
    // Log sample menu items for debugging problematic restaurants
    console.log(`[DEBUG] Sample menu items from "${restaurantName}":`);
    menuItems.slice(0, 5).forEach((item, i) => {
      const nameLength = item.name?.length || 0;
      const descLength = item.description?.length || 0;
      console.log(`  ${i+1}. "${item.name?.substring(0, 40) || 'No name'}${nameLength > 40 ? '...' : ''}" (name: ${nameLength} chars, desc: ${descLength} chars)`);
    });
    
    // Let AI determine if this is a fully vegetarian restaurant first
    console.log(`[DEBUG] Checking if "${restaurantName}" is a fully vegetarian restaurant using AI...`);
    const vegetarianCheck = await checkIfVegetarianRestaurantAI(restaurantName, menuItems, apiKey);
    
    if (vegetarianCheck.isVegetarianRestaurant) {
      console.log(`[DEBUG] AI determined "${restaurantName}" is a fully vegetarian restaurant - using optimized analysis`);
      const vegRestaurantResult = await analyzeFullyVegetarianRestaurant(menuItems, restaurantName, apiKey);
      if (vegRestaurantResult) {
        return {
          ...vegRestaurantResult,
          enhancedMenuItems: menuItems // No need to enhance, just return original items
        };
      }
      console.warn(`[DEBUG] Vegetarian restaurant optimization failed, falling back to standard analysis`);
    } else {
      console.log(`[DEBUG] AI determined "${restaurantName}" is NOT a fully vegetarian restaurant (${vegetarianCheck.confidence} confidence)`);
    }
    
    // Use optimized batching for initial analysis to improve performance
    const analysisBatchSize = 30; // Increased batch size for better performance while avoiding timeouts
    const analysisBatches = splitIntoBatches(menuItems, analysisBatchSize);
    console.log(`[DEBUG] Split ${menuItems.length} menu items into ${analysisBatches.length} batches of up to ${analysisBatchSize} items each for analysis`);
    
    const analysisResults = [];
    let successfulAnalysisBatches = 0;
    
    // OPTIMIZED: Process analysis batches in parallel (3x faster!)
    console.log(`⚡ Starting PARALLEL AI analysis of ${analysisBatches.length} batches...`);
    
    // Create parallel processing function for each batch
    const processAnalysisBatch = async (batch, batchIndex) => {
      console.log(`[DEBUG] Parallel batch ${batchIndex+1}/${analysisBatches.length} with ${batch.length} menu items`);
      
      const batchPrompt = createScrapedMenuAnalysisPrompt(batch, restaurantName);
      console.log(`[DEBUG] Parallel batch ${batchIndex+1} prompt length: ${batchPrompt.length} characters`);
      
      // Try to analyze this batch with retry logic
      let batchResult = null;
      let retryCount = 0;
      const maxRetries = 2;
      
      while (retryCount <= maxRetries && !batchResult?.success) {
        if (retryCount > 0) {
          console.log(`[Gemini] Parallel batch ${batchIndex+1} retry ${retryCount}...`);
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
        
        batchResult = await callGeminiAPI(batchPrompt, apiKey);
        retryCount++;
      }
      
      if (batchResult?.success) {
        console.info(`[Gemini] ✅ Parallel batch ${batchIndex+1} successful using ${batchResult.model || 'API'}`);
        const batchAnalysis = parseScrapedMenuAnalysis(batchResult.content, batch);
        return { success: true, analysis: batchAnalysis, batchIndex };
      } else {
        console.error(`[Gemini] ❌ Parallel batch ${batchIndex+1} failed:`, batchResult?.error || 'Unknown error');
        console.error(`[DEBUG] Failed batch contained ${batch.length} items:`);
        batch.slice(0, 3).forEach((item, idx) => {
          console.error(`  ${idx+1}. ${item.name?.substring(0, 50) || 'No name'}...`);
        });
        
        return {
          success: false,
          analysis: {
            vegetarianItems: [],
            summary: `Analysis failed for batch ${batchIndex+1}`,
            restaurantVegFriendliness: 'unknown',
            totalItems: batch.length,
            confidence: 0.0,
            recommendations: []
          },
          batchIndex
        };
      }
    };
    
    // Process batches in parallel groups to respect rate limits
    const parallelBatchSize = Math.min(3, analysisBatches.length); // Process up to 3 batches simultaneously
    const batchGroups = [];
    
    for (let i = 0; i < analysisBatches.length; i += parallelBatchSize) {
      const group = analysisBatches.slice(i, i + parallelBatchSize);
      batchGroups.push(group);
    }
    
    console.log(`🏭 Processing ${analysisBatches.length} batches in ${batchGroups.length} parallel groups of up to ${parallelBatchSize}`);
    
    const allResults = [];
    
    for (let groupIndex = 0; groupIndex < batchGroups.length; groupIndex++) {
      const group = batchGroups[groupIndex];
      console.log(`⚡ Processing parallel group ${groupIndex + 1}/${batchGroups.length} with ${group.length} batches...`);
      
      // Process this group of batches in parallel
      const groupPromises = group.map((batch, batchIndexInGroup) => {
        const globalBatchIndex = groupIndex * parallelBatchSize + batchIndexInGroup;
        return processAnalysisBatch(batch, globalBatchIndex);
      });
      
      const groupResults = await Promise.allSettled(groupPromises);
      
      // Process results from this group
      groupResults.forEach((result, batchIndexInGroup) => {
        const globalBatchIndex = groupIndex * parallelBatchSize + batchIndexInGroup;
        
        if (result.status === 'fulfilled') {
          const batchResult = result.value;
          analysisResults[globalBatchIndex] = batchResult.analysis;
          if (batchResult.success) {
            successfulAnalysisBatches++;
          }
        } else {
          console.error(`[Gemini] ❌ Parallel group ${groupIndex + 1} batch ${batchIndexInGroup + 1} promise failed:`, result.reason?.message);
          analysisResults[globalBatchIndex] = {
            vegetarianItems: [],
            summary: `Analysis failed for batch ${globalBatchIndex + 1} (promise rejected)`,
            restaurantVegFriendliness: 'unknown',
            totalItems: group[batchIndexInGroup]?.length || 0,
            confidence: 0.0,
            recommendations: []
          };
        }
      });
      
      // Add delay between groups to respect rate limits
      if (groupIndex < batchGroups.length - 1) {
        console.log(`⏱️ Pausing 1.5s between parallel groups to respect rate limits...`);
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }
    
    console.log(`[DEBUG] Analysis complete. ${successfulAnalysisBatches}/${analysisBatches.length} analysis batches processed successfully`);
    
    // Aggregate all analysis results and collect extracted categories
    let vegetarianAnalysis = null;
    const allExtractedCategories = [];
    if (successfulAnalysisBatches > 0) {
      vegetarianAnalysis = aggregateBatchResults(analysisResults);
      console.log(`[DEBUG] Aggregated analysis: ${vegetarianAnalysis.vegetarianItems.length} vegetarian items, ${vegetarianAnalysis.restaurantVegFriendliness} friendliness`);
    } else {
      console.warn(`[Gemini] All analysis batches failed for "${restaurantName}". Attempting fallback analysis...`);
      
      // First, try to see if this might actually be a vegetarian restaurant that we missed
      console.log(`[DEBUG] Attempting AI-powered vegetarian restaurant fallback for "${restaurantName}"`);
      const fallbackVegCheck = await checkIfVegetarianRestaurantAI(restaurantName, menuItems, apiKey);
      if (fallbackVegCheck.isVegetarianRestaurant && fallbackVegCheck.confidence > 0.7) {
        console.log(`[Gemini] AI fallback confirmed vegetarian restaurant with ${fallbackVegCheck.confidence} confidence`);
        const vegFallbackResult = await analyzeFullyVegetarianRestaurant(menuItems, restaurantName, apiKey);
        if (vegFallbackResult) {
          console.log(`[Gemini] Vegetarian restaurant fallback succeeded!`);
          vegetarianAnalysis = vegFallbackResult;
        }
      } else {
        // Last resort: try analyzing just the first few items with a very simple prompt
        const fallbackItems = menuItems.slice(0, 10); // Just first 10 items
        const fallbackPrompt = `Analyze these ${fallbackItems.length} menu items from "${restaurantName}". Return only items that are 100% vegetarian (no meat, fish, poultry):
${fallbackItems.map((item, i) => `${i+1}. ${item.name}`).join('\n')}

Return JSON: {"vegetarianItems":[{"name":"item name","category":"main"}],"restaurantVegFriendliness":"limited","totalItems":${menuItems.length},"confidence":0.3}`;
        
        const fallbackResult = await callGeminiAPI(fallbackPrompt, apiKey);
        if (fallbackResult?.success) {
          console.log(`[Gemini] Final fallback analysis succeeded`);
          vegetarianAnalysis = parseScrapedMenuAnalysis(fallbackResult.content, fallbackItems);
          vegetarianAnalysis.totalItems = menuItems.length; // Correct the total
        } else {
          throw new Error(`All analysis attempts failed for "${restaurantName}" - unable to identify vegetarian options`);
        }
      }
    }
    
    // Return the vegetarian analysis directly without enhancement
    // Enhancement adds complexity without significant value for users
    console.log(`[WebScraping] Analysis complete for "${restaurantName}": Found ${vegetarianAnalysis.vegetarianItems.length} vegetarian items`);
    
    return {
      ...vegetarianAnalysis,
      summary: '', // Remove redundant summary
      enhancedMenuItems: menuItems // Just return original items
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
 * Use AI to determine if a restaurant is fully vegetarian
 * @param {string} restaurantName - Name of the restaurant
 * @param {Array} menuItems - Array of menu items
 * @param {string} apiKey - Gemini API key
 * @returns {Promise<Object>} Object with isVegetarianRestaurant boolean and confidence
 */
const checkIfVegetarianRestaurantAI = async (restaurantName, menuItems, apiKey) => {
  try {
    // Take a sample of menu items to avoid large prompts - limit to 5 items
    const sampleSize = Math.min(5, menuItems.length);
    const sampleItems = menuItems.slice(0, sampleSize).map((item, index) => {
      const cleanName = (item.name || 'Unknown Item').replace(/[^\w\s\-.,()$€£¥₹₩¢]/g, ' ').trim();
      const cleanDesc = (item.description || '').replace(/[^\w\s\-.,()$€£¥₹₩¢]/g, ' ').trim().substring(0, 60);
      return `${index + 1}. ${cleanName}${cleanDesc ? ': ' + cleanDesc : ''}`;
    }).join('\n');

    const prompt = `Analyze "${restaurantName}" to determine if it's a fully vegetarian restaurant.

RESTAURANT NAME: "${restaurantName}"

SAMPLE MENU ITEMS (${sampleSize} of ${menuItems.length} total):
${sampleItems}

Please determine if this is a FULLY VEGETARIAN restaurant (where ALL menu items are vegetarian) by analyzing:
1. Restaurant name patterns
2. Menu item patterns 
3. Absence of meat/fish/poultry items
4. Overall restaurant concept

A fully vegetarian restaurant would:
- Have NO meat, poultry, fish, or seafood items
- May focus on plant-based, vegetarian, or vegan cuisine
- All items should be vegetarian-friendly

Respond with JSON only:
{
  "isVegetarianRestaurant": true/false,
  "confidence": 0.95,
  "reasoning": "Brief explanation of the decision",
  "evidenceForVegetarian": ["evidence supporting vegetarian restaurant"],
  "evidenceAgainstVegetarian": ["evidence against vegetarian restaurant"]
}`;

    console.log(`[DEBUG] AI vegetarian check prompt length: ${prompt.length} characters`);
    
    const result = await callGeminiAPI(prompt, apiKey);
    
    if (result?.success) {
      try {
        let cleanedContent = result.content.replace(/```json\s*|\s*```/g, '').trim();
        const jsonStart = cleanedContent.indexOf('{');
        const jsonEnd = cleanedContent.lastIndexOf('}') + 1;
        
        if (jsonStart >= 0 && jsonEnd > jsonStart) {
          cleanedContent = cleanedContent.substring(jsonStart, jsonEnd);
        }
        
        const parsed = JSON.parse(cleanedContent);
        
        console.log(`[DEBUG] AI vegetarian check result: ${parsed.isVegetarianRestaurant ? 'YES' : 'NO'} (${parsed.confidence} confidence)`);
        console.log(`[DEBUG] AI reasoning: ${parsed.reasoning}`);
        
        return {
          isVegetarianRestaurant: !!parsed.isVegetarianRestaurant,
          confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
          reasoning: parsed.reasoning || 'No reasoning provided',
          evidenceFor: Array.isArray(parsed.evidenceForVegetarian) ? parsed.evidenceForVegetarian : [],
          evidenceAgainst: Array.isArray(parsed.evidenceAgainstVegetarian) ? parsed.evidenceAgainstVegetarian : []
        };
      } catch (parseError) {
        console.error('[DEBUG] Failed to parse AI vegetarian check response:', parseError.message);
        return { isVegetarianRestaurant: false, confidence: 0.0, reasoning: 'Parse error' };
      }
    } else {
      console.warn('[DEBUG] AI vegetarian check failed:', result?.error || 'Unknown error');
      return { isVegetarianRestaurant: false, confidence: 0.0, reasoning: 'AI check failed' };
    }
  } catch (error) {
    console.error('[DEBUG] Error in AI vegetarian check:', error.message);
    return { isVegetarianRestaurant: false, confidence: 0.0, reasoning: 'Error occurred' };
  }
};

/**
 * Check if a restaurant is likely to be fully vegetarian based on name and menu patterns
/**
 * Optimized analysis for fully vegetarian restaurants
 * @param {Array} menuItems - Array of menu items
 * @param {string} restaurantName - Name of the restaurant
 * @param {string} apiKey - Gemini API key
 * @returns {Promise<Object>} Analysis results
 */
const analyzeFullyVegetarianRestaurant = async (menuItems, restaurantName, apiKey) => {
  try {
    console.log(`[DEBUG] Analyzing fully vegetarian restaurant "${restaurantName}" with ${menuItems.length} items`);
    
    // For fully vegetarian restaurants, we don't need to filter items - just categorize them
    const prompt = createVegetarianRestaurantPrompt(menuItems, restaurantName);
    console.log(`[DEBUG] Vegetarian restaurant prompt length: ${prompt.length} characters`);
    
    let result = null;
    let retryCount = 0;
    const maxRetries = 2;
    
    while (retryCount <= maxRetries && !result?.success) {
      if (retryCount > 0) {
        console.log(`[Gemini] Vegetarian restaurant analysis retry ${retryCount}...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      result = await callGeminiAPI(prompt, apiKey);
      retryCount++;
    }
    
    if (result?.success) {
      console.log(`[Gemini] Vegetarian restaurant analysis successful`);
      const analysis = parseVegetarianRestaurantAnalysis(result.content, menuItems);
      
      // Mark all items as vegetarian since this is a vegetarian restaurant
      analysis.vegetarianItems = menuItems.map(item => ({
        name: item.name || 'Unknown Item',
        description: item.description || '',
        price: item.price || '',
        category: categorizeMenuItem(item.name || '', item.description || ''),
        confidence: 0.95, // High confidence since it's a vegetarian restaurant
        notes: 'From fully vegetarian restaurant',
        isVegan: false, // We'd need separate analysis for vegan
        explicitlyMarked: false
      }));
      
      analysis.totalItems = menuItems.length;
      analysis.restaurantVegFriendliness = 'excellent';
      analysis.confidence = 0.95;
      analysis.summary = `This is a fully vegetarian restaurant with ${menuItems.length} vegetarian options available.`;
      
      return analysis;
    } else {
      console.warn(`[Gemini] Vegetarian restaurant analysis failed, falling back to standard analysis`);
      // Fall back to treating it as a regular restaurant
      return null;
    }
  } catch (error) {
    console.error('[Gemini] Error in analyzeFullyVegetarianRestaurant:', error.message);
    return null;
  }
};

/**
 * Create a simplified prompt for fully vegetarian restaurants
 * @param {Array} menuItems - Array of menu items
 * @param {string} restaurantName - Name of the restaurant
 * @returns {string} Formatted prompt
 */
const createVegetarianRestaurantPrompt = (menuItems, restaurantName) => {
  // Just take a sample of items to categorize, not all - limit to 5 items
  const sampleItems = menuItems.slice(0, 5).map((item, index) => {
    const cleanName = (item.name || 'Unknown Item').replace(/[^\w\s\-.,()$€£¥₹₩¢]/g, ' ').trim();
    return `${index + 1}. ${cleanName}`;
  }).join('\n');

  return `This is "${restaurantName}", a fully vegetarian restaurant. Please categorize these menu items:

MENU ITEMS (sample):
${sampleItems}

Since this is a vegetarian restaurant, all items are vegetarian. Please just categorize them properly:

{
  "categories": {
    "appetizers": ["item names"],
    "mains": ["item names"], 
    "sides": ["item names"],
    "desserts": ["item names"],
    "beverages": ["item names"]
  },
  "restaurantVegFriendliness": "excellent",
  "confidence": 0.95,
  "isVeganFriendly": true/false,
  "recommendations": ["Quick recommendations for vegetarians"]
}

Response in JSON only.`;
};

/**
 * Parse vegetarian restaurant analysis response
 * @param {string} content - Raw response from Gemini API
 * @param {Array} menuItems - Original menu items
 * @returns {Object} Parsed analysis results
 */
const parseVegetarianRestaurantAnalysis = (content, menuItems) => {
  try {
    let cleanedContent = content.replace(/```json\s*|\s*```/g, '').trim();
    
    const jsonStart = cleanedContent.indexOf('{');
    const jsonEnd = cleanedContent.lastIndexOf('}') + 1;
    
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      cleanedContent = cleanedContent.substring(jsonStart, jsonEnd);
    }
    
    const parsed = JSON.parse(cleanedContent);
    
    return {
      vegetarianItems: [], // Will be filled by calling function
      summary: '',
      restaurantVegFriendliness: parsed.restaurantVegFriendliness || 'excellent',
      totalItems: menuItems.length,
      confidence: parsed.confidence || 0.95,
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [
        'This is a fully vegetarian restaurant - all menu items are vegetarian-friendly!'
      ]
    };
  } catch (error) {
    console.error('[Gemini] Error parsing vegetarian restaurant analysis:', error.message);
    return {
      vegetarianItems: [],
      summary: '',
      restaurantVegFriendliness: 'excellent',
      totalItems: menuItems.length,
      confidence: 0.95,
      recommendations: ['Fully vegetarian restaurant with many options available.']
    };
  }
};

/**
 * Simple helper to categorize menu items based on name/description
 * @param {string} name - Item name
 * @param {string} description - Item description
 * @returns {string} Category
 */
const categorizeMenuItem = (name, description) => {
  const text = `${name} ${description}`.toLowerCase();
  
  if (text.includes('appetizer') || text.includes('starter') || text.includes('app') || 
      text.includes('dip') || text.includes('wings') || text.includes('bite')) {
    return 'appetizer';
  }
  
  if (text.includes('dessert') || text.includes('cake') || text.includes('ice cream') || 
      text.includes('pie') || text.includes('cookie') || text.includes('sweet')) {
    return 'dessert';
  }
  
  if (text.includes('drink') || text.includes('juice') || text.includes('coffee') || 
      text.includes('tea') || text.includes('soda') || text.includes('beverage')) {
    return 'beverage';
  }
  
  if (text.includes('side') || text.includes('fries') || text.includes('rice') || 
      text.includes('bread') || text.includes('chips')) {
    return 'side';
  }
  
  return 'main'; // Default to main course
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
  const confidences = batchResults.map(r => r.confidence).filter(c => typeof c === 'number');
  const totalItems = batchResults.reduce((sum, r) => sum + (r.totalItems || 0), 0);
  
  // Calculate average confidence
  const avgConfidence = confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0.5;
  
  // Determine overall vegetarian friendliness based on percentage and count
  const vegetarianCount = allVegetarianItems.length;
  const vegetarianPercentage = totalItems > 0 ? (vegetarianCount / totalItems) * 100 : 0;
  
  let overallFriendliness = 'limited';
  if (vegetarianPercentage >= 40 && vegetarianCount >= 5) {
    overallFriendliness = 'excellent';
  } else if (vegetarianPercentage >= 30 && vegetarianCount >= 3) {
    overallFriendliness = 'good';
  } else if (vegetarianPercentage >= 20 && vegetarianCount >= 2) {
    overallFriendliness = 'fair';
  }
  
  // If any batch reported a higher friendliness, consider it (be optimistic)
  const friendlinessOrder = ['limited', 'fair', 'good', 'excellent'];
  for (const r of batchResults) {
    if (r.restaurantVegFriendliness && friendlinessOrder.includes(r.restaurantVegFriendliness)) {
      const currentIndex = friendlinessOrder.indexOf(overallFriendliness);
      const batchIndex = friendlinessOrder.indexOf(r.restaurantVegFriendliness);
      if (batchIndex > currentIndex) {
        overallFriendliness = r.restaurantVegFriendliness;
      }
    }
  }
  
  return {
    vegetarianItems: allVegetarianItems,
    summary: '', // Remove redundant summary
    restaurantVegFriendliness: overallFriendliness,
    totalItems,
    confidence: avgConfidence,
    recommendations: Array.from(new Set(allRecommendations)), // Remove duplicates
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
    // Shorten description to 80 characters max for more conservative approach
    let desc = (item.description || 'No description').trim();
    if (desc.length > 80) desc = desc.slice(0, 80) + '...';
    
    // Clean the item name and description to avoid issues (preserve currency symbols)
    const cleanName = (item.name || 'Unknown Item').replace(/[^\w\s\-.,()$€£¥₹₩¢]/g, ' ').trim();
    const cleanDesc = desc.replace(/[^\w\s\-.,()$€£¥₹₩¢]/g, ' ').trim();
    
    return `${index + 1}. ${cleanName}: ${cleanDesc}`;
  }).join('\n');

  // Log some debug info about prompt size
  console.log(`[DEBUG] Creating analysis prompt for ${menuItems.length} items, estimated size: ${itemsText.length + 2000} characters`);

  return `You are a multilingual vegetarian dining expert analyzing a restaurant menu. The menu items may be in any language (English, Spanish, French, Italian, German, Portuguese, Japanese, Chinese, etc.). Please analyze the following menu items from "${restaurantName}" and identify vegetarian-friendly options.

MENU ITEMS:
${itemsText}

CRITICAL: VEGETARIAN DEFINITION - Items that contain ANY of the following are NOT VEGETARIAN:
❌ MEAT: beef, pork, lamb, veal, ham, bacon, sausage, pepperoni, salami, chorizo, prosciutto, etc.
❌ POULTRY: chicken, turkey, duck, goose, etc.
❌ FISH: salmon, tuna, cod, tilapia, bass, etc.
❌ SEAFOOD: shrimp, crab, lobster, scallops, mussels, clams, oysters, etc.
❌ BROTHS: chicken broth, beef broth, fish stock, bone broth, etc.
❌ HIDDEN ANIMAL PRODUCTS: gelatin, rennet, anchovies (in sauces), etc.

STRICT ANALYSIS REQUIREMENTS:
1. MULTILINGUAL SUPPORT: Work with menu items in their original language - translate and understand items in any language
2. Identify ONLY items that are 100% vegetarian (contain NO meat, poultry, fish, seafood, or animal broths)
3. EXCLUDE ANY ITEM with meat/fish/poultry in the name or description, even if it might seem "mostly vegetarian"
4. EXCLUDE MENU SECTIONS: Do not include generic menu section headers like "Dinner Menu", "Kids Menu", "Private Events", "Appetizers", "Mains", etc.
5. ONLY INCLUDE ACTUAL FOOD ITEMS: Include only specific dishes, beverages, or food items that can be ordered
6. Include items that can be easily modified to be vegetarian ONLY if the base item is vegetarian (mention modification needed)
7. Look for explicit vegetarian markings in any language (V, VEG, vegetarian symbols, "vegetariano", "végétarien", "vegetarisch", etc.)
8. Consider side dishes, appetizers, salads, desserts, and beverages that are vegetarian
9. For dessert places: analyze pastries, cakes, ice cream, coffee drinks, etc. for vegetarian ingredients
10. When in doubt about an item containing animal products, EXCLUDE it rather than include it
11. Provide item names in their original language but add English translations in parentheses if needed

EXAMPLES OF WHAT TO EXCLUDE:
- "Ahi Tuna Bowl" → EXCLUDE (contains tuna)
- "Nashville Hot Chicken Bowl" → EXCLUDE (contains chicken)
- "Caesar Salad" → EXCLUDE if it contains anchovies or chicken
- "Beef and Vegetable Stir Fry" → EXCLUDE (contains beef)
- "Chicken Noodle Soup" → EXCLUDE (contains chicken)
- "Dinner Menu" → EXCLUDE (menu section, not a food item)
- "Kids Menu" → EXCLUDE (menu section, not a food item)
- "Private Events" → EXCLUDE (menu section, not a food item)
- "Appetizers" → EXCLUDE (menu category, not a specific food item)

IMPORTANT FORMATTING INSTRUCTIONS:
- NORMALIZE menu item names: Convert from ALL CAPS to proper title case (e.g., "CAESAR SALAD" → "Caesar Salad")
- Clean up excessive capitalization and make names readable
- Preserve original language but make formatting consistent and professional
- Fix obvious typos or formatting issues in item names

RESPONSE FORMAT (JSON):
{
  "vegetarianItems": [
    {
      "name": "Properly Formatted Item Name", 
      "description": "Brief description if available, if not available, create a description based on your knowledge of your item with a disclaimer",
      "price": "Price if listed",
      "category": "appetizer|main|side|dessert|beverage",
      "confidence": 0.95,
      "notes": "Any modifications needed or uncertainty about ingredients",
      "isVegan": true/false,
      "explicitlyMarked": true/false
    }
  ],
  "restaurantVegFriendliness": "excellent|good|fair|limited",
  "totalItems": 12,
  "confidence": 0.85,
  "recommendations": ["Specific recommendations for vegetarians"]
}

IMPORTANT: 
- BE EXTREMELY STRICT: If an item has ANY animal protein in the name or description, DO NOT include it
- Focus on being accurate for vegetarians - better to miss a vegetarian item than to include a non-vegetarian one
- When uncertain about ingredients, EXCLUDE the item rather than include it
- Look for common vegetarian dishes: salads (without meat), pasta (without meat/seafood), pizza (veggie options), rice dishes (without meat), etc.
- Include beverages and desserts that are clearly vegetarian

Please respond ONLY with valid JSON.`;
};

/**
 * Creates a prompt for enhancing menu items with Gemini
 * @param {Array} menuItems - Array of scraped menu items
 * @returns {string} Formatted prompt for Gemini API
 */
const createMenuEnhancementPrompt = (menuItems) => {
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
  
  console.log(`[DEBUG] Creating prompt with ${simplifiedItems.length} items`);
  
  // Calculate prompt size for logging
  const itemsJson = JSON.stringify(simplifiedItems, null, 2);
  console.log(`[DEBUG] Items JSON size: ${itemsJson.length} characters`);
  
  // Even more simplified prompt to minimize token usage
  return `Enhance these vegetarian menu items:
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
    
    // Define non-vegetarian terms to filter out (case-insensitive)
    const nonVegetarianTerms = [
      // Meat
      'beef', 'pork', 'lamb', 'veal', 'ham', 'bacon', 'sausage', 'pepperoni', 'salami', 
      'chorizo', 'prosciutto', 'pancetta', 'brisket', 'steak', 'burger', 'meatball',
      // Poultry
      'chicken', 'turkey', 'duck', 'goose', 'poultry', 'wing', 'drumstick',
      // Fish & Seafood
      'tuna', 'salmon', 'cod', 'tilapia', 'bass', 'trout', 'halibut', 'mahi', 'ahi',
      'shrimp', 'crab', 'lobster', 'scallop', 'mussel', 'clam', 'oyster', 'calamari',
      'fish', 'seafood', 'anchovy', 'sardine', 'mackerel',
      // Other animal products
      'bone broth', 'chicken broth', 'beef broth', 'fish stock'
    ];
    
    // Define generic menu section terms to filter out (not actual food items)
    const menuSectionTerms = [
      // Menu sections
      'menu', 'dinner menu', 'lunch menu', 'breakfast menu', 'brunch menu', 'kids menu', 'children menu',
      'appetizers', 'mains', 'entrees', 'desserts', 'beverages', 'drinks', 'sides', 'salads',
      'private events', 'catering', 'party menu', 'group menu', 'banquet menu',
      'specials', 'chef specials', 'daily specials', 'seasonal menu',
      'wine list', 'beer list', 'cocktails', 'bar menu',
      // Common placeholders
      'no description provided', 'description not available', 'see menu', 'varies',
      'ask server', 'market price', 'seasonal'
    ];
    
    // Filter out items that contain non-vegetarian terms OR are generic menu sections
    const filteredVegetarianItems = Array.isArray(parsed.vegetarianItems) 
      ? parsed.vegetarianItems.filter(item => {
          const itemName = (item.name || '').toLowerCase().trim();
          const itemDescription = (item.description || '').toLowerCase();
          const combinedText = `${itemName} ${itemDescription}`;
          
          // Check if any non-vegetarian term appears in the item name or description
          const containsNonVegTerm = nonVegetarianTerms.some(term => 
            combinedText.includes(term.toLowerCase())
          );
          
          if (containsNonVegTerm) {
            console.warn(`[VEGETARIAN FILTER] Excluded "${item.name}" - contains non-vegetarian ingredients`);
            return false;
          }
          
          // Check if this is a generic menu section rather than an actual food item
          const isMenuSection = menuSectionTerms.some(term => 
            itemName === term.toLowerCase() || itemName.includes(term.toLowerCase())
          );
          
          if (isMenuSection) {
            console.warn(`[MENU SECTION FILTER] Excluded "${item.name}" - generic menu section, not a food item`);
            return false;
          }
          
          // Filter out items that are too short (likely not real menu items)
          if (itemName.length < 3) {
            console.warn(`[LENGTH FILTER] Excluded "${item.name}" - too short to be a real menu item`);
            return false;
          }
          
          return true;
        })
      : [];
    
    // Validate and normalize the response
    const normalized = {
      vegetarianItems: filteredVegetarianItems.map(item => ({
        name: item.name || 'Unknown Item',
        description: item.description || '',
        price: item.price || '',
        category: item.category || 'main',
        confidence: typeof item.confidence === 'number' ? item.confidence : 0.7,
        notes: item.notes || '',
        isVegan: !!item.isVegan,
        explicitlyMarked: !!item.explicitlyMarked
      })),
      // No longer requesting summary from LLM, just set a placeholder
      summary: '',
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
      summary: '',
      restaurantVegFriendliness: 'unknown',
      totalItems: menuItems.length,
      confidence: 0.0,
      recommendations: []
    };
  }
};