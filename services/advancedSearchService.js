/**
 * Advanced Search Service for GreenCompass
 * Provides batch analysis for user-selected restaurants
 */

import axios from 'axios';
import { getNearbyRestaurants, getRestaurantDetails } from './googleMapsService';
import { scrapeRestaurantMenu } from './webScrapingService.js';

/**
 * Get nearby restaurants for user selection
 * @param {Object} location - User location { latitude, longitude }
 * @param {Object} filters - Basic filters
 * @returns {Promise<Object>} Nearby restaurants for selection
 */
export const getNearbyRestaurantsForSelection = async (location, filters = {}) => {
  try {
    const {
      minRating = 0,
      maxDistance = 15,
      radius = 24140 // 15 miles in meters
    } = filters;

    // Get nearby restaurants
    const allRestaurants = await getNearbyRestaurants(location, radius);
    
    // Apply basic filters
    const filteredRestaurants = allRestaurants
      .filter(restaurant => {
        if (restaurant.rating < minRating) return false;
        if (restaurant.distanceMiles > maxDistance) return false;
        return true;
      })
      .sort((a, b) => {
        // Sort by rating and distance
        const scoreA = (a.rating || 0) * 2 - (a.distanceMiles || 0) * 0.1;
        const scoreB = (b.rating || 0) * 2 - (b.distanceMiles || 0) * 0.1;
        return scoreB - scoreA;
      });

    return {
      success: true,
      restaurants: filteredRestaurants,
      totalFound: allRestaurants.length,
      message: `Found ${filteredRestaurants.length} restaurants nearby`
    };

  } catch (error) {
    console.error('Restaurant selection error:', error);
    return {
      success: false,
      error: error.message,
      restaurants: [],
      totalFound: 0
    };
  }
};

/**
 * Analyze selected restaurants for vegetarian options
 * @param {Array} selectedRestaurants - User-selected restaurants (max 5)
 * @param {Object} vegCriteria - Vegetarian criteria to check against
 * @param {Function} onProgress - Progress callback function
 * @returns {Promise<Object>} Analysis results
 */
export const analyzeSelectedRestaurants = async (selectedRestaurants, vegCriteria, onProgress = null) => {
  try {
    if (!selectedRestaurants || selectedRestaurants.length === 0) {
      return {
        success: false,
        error: 'No restaurants selected for analysis',
        results: []
      };
    }

    if (selectedRestaurants.length > 5) {
      return {
        success: false,
        error: 'Maximum 5 restaurants can be analyzed at once',
        results: []
      };
    }

    const results = [];
    const total = selectedRestaurants.length;
    let completed = 0;

    if (onProgress) {
      onProgress({ 
        stage: 'starting', 
        progress: 0, 
        message: `Starting analysis of ${total} restaurants...`,
        completed: 0,
        total
      });
    }

    // Process restaurants in parallel with controlled concurrency
    const analysisPromises = selectedRestaurants.map(async (restaurant, index) => {
      try {
        if (onProgress) {
          onProgress({
            stage: 'analyzing',
            progress: (completed / total) * 100,
            message: `Analyzing ${restaurant.name}...`,
            completed,
            total,
            currentRestaurant: restaurant.name
          });
        }

        const analysis = await performDetailedVegAnalysis(restaurant);
        completed++;

        if (onProgress) {
          onProgress({
            stage: 'analyzing',
            progress: (completed / total) * 100,
            message: `Completed ${restaurant.name}`,
            completed,
            total,
            currentRestaurant: restaurant.name
          });
        }

        return {
          restaurant,
          analysis,
          meetsVegCriteria: analysis ? meetsVegetarianCriteria(analysis, vegCriteria) : false
        };

      } catch (error) {
        completed++;
        console.warn(`Analysis failed for ${restaurant.name}:`, error.message);
        
        if (onProgress) {
          onProgress({
            stage: 'analyzing',
            progress: (completed / total) * 100,
            message: `Failed to analyze ${restaurant.name}`,
            completed,
            total,
            currentRestaurant: restaurant.name
          });
        }

        return {
          restaurant,
          analysis: null,
          meetsVegCriteria: false,
          error: error.message
        };
      }
    });

    const analysisResults = await Promise.all(analysisPromises);

    if (onProgress) {
      onProgress({
        stage: 'complete',
        progress: 100,
        message: 'Analysis complete!',
        completed: total,
        total
      });
    }

    // Filter results that meet vegetarian criteria
    const qualifyingRestaurants = analysisResults.filter(result => result.meetsVegCriteria);

    return {
      success: true,
      results: analysisResults,
      qualifyingRestaurants,
      summary: {
        totalAnalyzed: total,
        meetsCriteria: qualifyingRestaurants.length,
        criteria: vegCriteria
      }
    };

  } catch (error) {
    console.error('Batch analysis error:', error);
    return {
      success: false,
      error: error.message,
      results: []
    };
  }
};

/**
 * Perform detailed vegetarian analysis for a single restaurant
 * @param {Object} restaurant - Restaurant to analyze
 * @returns {Promise<Object>} Detailed analysis results
 */
const performDetailedVegAnalysis = async (restaurant) => {
  try {
    // Step 1: Get restaurant details with timeout
    const details = await Promise.race([
      getRestaurantDetails(restaurant.id),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Restaurant details timeout')), 8000)
      )
    ]);
    
    if (!details.website) {
      return {
        hasWebsite: false,
        vegFriendliness: 'unknown',
        vegetarianCount: 0,
        totalItems: 0,
        confidence: 0,
        summary: 'No website available for menu analysis',
        analysisMethod: 'no-website'
      };
    }

    // Step 2: Scrape menu with timeout
    const menuData = await Promise.race([
      scrapeRestaurantMenu(details.website),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Menu scraping timeout')), 60000)
      )
    ]);
    
    if (!menuData.success || !menuData.menuItems || menuData.menuItems.length === 0) {
      return {
        hasWebsite: true,
        vegFriendliness: 'unknown',
        vegetarianCount: 0,
        totalItems: 0,
        confidence: 0,
        summary: 'Unable to extract menu items from website',
        website: details.website,
        analysisMethod: 'scraping-failed'
      };
    }

    // Step 3: AI analysis with timeout
    const aiAnalysis = await Promise.race([
      performAIVegAnalysis(menuData.menuItems, restaurant.name),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('AI analysis timeout')), 12000)
      )
    ]);

    return {
      hasWebsite: true,
      vegFriendliness: aiAnalysis.vegFriendliness,
      vegetarianCount: aiAnalysis.vegetarianCount,
      vegetarianItems: aiAnalysis.vegetarianItems || [],
      totalItems: menuData.menuItems.length,
      confidence: aiAnalysis.confidence,
      summary: aiAnalysis.summary,
      website: details.website,
      analysisMethod: 'ai-analysis',
      scrapingInfo: {
        itemsFound: menuData.menuItems.length,
        method: menuData.method || 'general'
      }
    };

  } catch (error) {
    console.warn(`Detailed analysis failed for ${restaurant.name}:`, error.message);
    return {
      hasWebsite: false,
      vegFriendliness: 'unknown',
      vegetarianCount: 0,
      totalItems: 0,
      confidence: 0,
      summary: `Analysis failed: ${error.message}`,
      analysisMethod: 'failed'
    };
  }
};

/**
 * Perform AI-based vegetarian analysis
 * @param {Array} menuItems - Menu items to analyze
 * @param {string} restaurantName - Restaurant name
 * @returns {Promise<Object>} AI analysis results
 */
const performAIVegAnalysis = async (menuItems, restaurantName) => {
  try {
    const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      throw new Error('Gemini API key not configured');
    }

    // Create detailed prompt for batch analysis
    const prompt = createBatchAnalysisPrompt(menuItems, restaurantName);
    
    const response = await callGeminiForBatch(prompt, apiKey);
    
    if (!response.success) {
      throw new Error(response.error);
    }

    return parseBatchAnalysisResponse(response.content, menuItems);

  } catch (error) {
    console.warn('AI analysis failed:', error.message);
    // Fallback to keyword analysis
    return performKeywordVegAnalysis(menuItems, restaurantName);
  }
};

/**
 * Create detailed analysis prompt for batch processing
 * @param {Array} menuItems - Menu items
 * @param {string} restaurantName - Restaurant name
 * @returns {string} Analysis prompt
 */
const createBatchAnalysisPrompt = (menuItems, restaurantName) => {
  // Limit to 40 items to prevent token overflow
  const limitedItems = menuItems.slice(0, 40);
  
  const itemsText = limitedItems.map((item, index) => {
    const name = item.name || `Item ${index + 1}`;
    const desc = item.description ? ` - ${item.description.slice(0, 100)}` : '';
    const price = item.price ? ` (${item.price})` : '';
    return `${index + 1}. ${name}${desc}${price}`;
  }).join('\n');

  return `Detailed vegetarian analysis for "${restaurantName}". Identify ALL vegetarian items (no meat, fish, poultry, seafood).

MENU ITEMS:
${itemsText}

Analyze and respond with JSON:
{
  "vegetarianItems": [
    {
      "name": "Item name",
      "isVegan": true/false,
      "confidence": 0.9
    }
  ],
  "vegetarianCount": number,
  "vegFriendliness": "excellent|good|fair|poor",
  "confidence": 0.8,
  "summary": "Detailed summary of vegetarian options"
}

Categories:
- excellent: 40%+ vegetarian, 5+ main dishes
- good: 30%+ vegetarian, 3+ main dishes  
- fair: 20%+ vegetarian, 2+ main dishes
- poor: <20% vegetarian or 1 main dish

Be thorough - include salads, sides, beverages, desserts that are vegetarian.`;
};

/**
 * Call Gemini API for batch analysis
 * @param {string} prompt - Analysis prompt
 * @param {string} apiKey - API key
 * @returns {Promise<Object>} API response
 */
const callGeminiForBatch = async (prompt, apiKey) => {
  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
      {
        contents: [{
          parts: [{ text: prompt }]
        }]
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );

    if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      return {
        success: true,
        content: response.data.candidates[0].content.parts[0].text
      };
    }

    throw new Error('Invalid API response');

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Parse batch analysis response
 * @param {string} content - API response content
 * @param {Array} originalItems - Original menu items
 * @returns {Object} Parsed analysis
 */
const parseBatchAnalysisResponse = (content, originalItems) => {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in response');

    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      vegetarianItems: parsed.vegetarianItems || [],
      vegetarianCount: parsed.vegetarianCount || 0,
      vegFriendliness: parsed.vegFriendliness || 'unknown',
      confidence: parsed.confidence || 0.5,
      summary: parsed.summary || 'AI analysis completed'
    };

  } catch (error) {
    console.warn('Failed to parse batch analysis:', error.message);
    return performKeywordVegAnalysis(originalItems, 'Unknown Restaurant');
  }
};

/**
 * Fallback keyword-based analysis
 * @param {Array} menuItems - Menu items
 * @param {string} restaurantName - Restaurant name
 * @returns {Object} Keyword analysis results
 */
const performKeywordVegAnalysis = (menuItems, restaurantName) => {
  const vegetarianKeywords = [
    'vegetarian', 'vegan', 'plant-based', 'veggie', 'tofu', 'tempeh',
    'quinoa', 'chickpea', 'lentil', 'bean', 'mushroom', 'avocado',
    'spinach', 'kale', 'cauliflower', 'portobello', 'falafel', 'hummus'
  ];

  const meatKeywords = [
    'chicken', 'beef', 'pork', 'fish', 'salmon', 'tuna', 'shrimp',
    'lobster', 'crab', 'bacon', 'sausage', 'ham', 'turkey', 'duck'
  ];

  const vegetarianItems = [];
  
  menuItems.forEach(item => {
    const itemText = `${item.name} ${item.description || ''}`.toLowerCase();
    
    const hasVegKeywords = vegetarianKeywords.some(keyword => itemText.includes(keyword));
    const hasMeatKeywords = meatKeywords.some(keyword => itemText.includes(keyword));
    
    if (hasVegKeywords && !hasMeatKeywords) {
      vegetarianItems.push({
        name: item.name,
        isVegan: itemText.includes('vegan'),
        confidence: hasVegKeywords ? 0.7 : 0.5
      });
    }
  });

  const vegCount = vegetarianItems.length;
  const totalItems = menuItems.length;
  const vegRatio = totalItems > 0 ? vegCount / totalItems : 0;
  
  let vegFriendliness;
  if (vegRatio >= 0.4) vegFriendliness = 'excellent';
  else if (vegRatio >= 0.3) vegFriendliness = 'good';
  else if (vegRatio >= 0.2) vegFriendliness = 'fair';
  else vegFriendliness = 'poor';

  return {
    vegetarianItems,
    vegetarianCount: vegCount,
    vegFriendliness,
    confidence: 0.6,
    summary: `Found ${vegCount} likely vegetarian items out of ${totalItems} total (keyword analysis)`
  };
};

/**
 * Check if restaurant meets vegetarian criteria
 * @param {Object} analysis - Analysis results
 * @param {string} minCriteria - Minimum criteria level
 * @returns {boolean} Whether restaurant meets criteria
 */
const meetsVegetarianCriteria = (analysis, minCriteria) => {
  if (!analysis || analysis.vegFriendliness === 'unknown') return false;

  const criteriaOrder = ['poor', 'fair', 'good', 'excellent'];
  const minIndex = criteriaOrder.indexOf(minCriteria);
  const actualIndex = criteriaOrder.indexOf(analysis.vegFriendliness);

  return actualIndex >= minIndex;
};

/**
 * Efficiently analyze multiple restaurants for vegetarian options
 * @param {Array} restaurants - Array of restaurant objects
 * @param {string} minCriteria - Minimum vegetarian criteria level
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Array>} Array of restaurants with analysis
 */
const batchAnalyzeRestaurants = async (restaurants, minCriteria, onProgress = null) => {
  const results = [];
  const batchSize = 5; // Process 5 restaurants concurrently for speed
  const maxConcurrent = 3; // Limit to avoid rate limiting
  
  let completed = 0;
  const total = restaurants.length;

  // Process restaurants in batches
  for (let i = 0; i < restaurants.length; i += batchSize) {
    const batch = restaurants.slice(i, i + batchSize);
    
    // Limit concurrent requests
    const batchPromises = batch.slice(0, maxConcurrent).map(async (restaurant) => {
      try {
        const analysis = await quickVegAnalysis(restaurant);
        completed++;
        
        if (onProgress) {
          onProgress({ current: completed, total, restaurant: restaurant.name });
        }
        
        return {
          ...restaurant,
          vegAnalysis: analysis
        };
      } catch (error) {
        completed++;
        console.warn(`Analysis failed for ${restaurant.name}:`, error.message);
        
        if (onProgress) {
          onProgress({ current: completed, total, restaurant: restaurant.name });
        }
        
        return {
          ...restaurant,
          vegAnalysis: null
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Small delay to prevent overwhelming APIs
    if (i + batchSize < restaurants.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return results;
};

/**
 * Perform quick vegetarian analysis without full enhancement
 * @param {Object} restaurant - Restaurant object
 * @returns {Promise<Object>} Basic vegetarian analysis
 */
const quickVegAnalysis = async (restaurant) => {
  try {
    // Get restaurant details to check for website
    const details = await getRestaurantDetails(restaurant.id);
    
    if (!details.website) {
      return {
        hasWebsite: false,
        vegFriendliness: 'unknown',
        vegetarianCount: 0,
        totalItems: 0,
        confidence: 0,
        summary: 'No website available for analysis'
      };
    }

    // Quick menu scraping
    const menuData = await scrapeRestaurantMenu(details.website);
    
    if (!menuData.success || menuData.menuItems.length === 0) {
      return {
        hasWebsite: true,
        vegFriendliness: 'unknown',
        vegetarianCount: 0,
        totalItems: 0,
        confidence: 0,
        summary: 'Unable to extract menu from website'
      };
    }

    // Quick AI analysis (streamlined version)
    const analysis = await quickAIAnalysis(menuData.menuItems, restaurant.name);
    
    return {
      hasWebsite: true,
      vegFriendliness: analysis.vegFriendliness,
      vegetarianCount: analysis.vegetarianCount,
      totalItems: analysis.totalItems,
      confidence: analysis.confidence,
      summary: analysis.summary,
      website: details.website
    };

  } catch (error) {
    console.warn(`Quick analysis failed for ${restaurant.name}:`, error.message);
    return {
      hasWebsite: false,
      vegFriendliness: 'unknown',
      vegetarianCount: 0,
      totalItems: 0,
      confidence: 0,
      summary: 'Analysis failed'
    };
  }
};

/**
 * Quick AI analysis focused on vegetarian detection only
 * @param {Array} menuItems - Menu items to analyze
 * @param {string} restaurantName - Restaurant name
 * @returns {Promise<Object>} Quick analysis results
 */
const quickAIAnalysis = async (menuItems, restaurantName) => {
  try {
    const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      throw new Error('Gemini API key not configured');
    }

    // Create a streamlined prompt for quick analysis
    const prompt = createQuickAnalysisPrompt(menuItems, restaurantName);
    
    const response = await callGeminiQuick(prompt, apiKey);
    
    if (!response.success) {
      throw new Error(response.error);
    }

    return parseQuickAnalysis(response.content, menuItems.length);

  } catch (error) {
    console.warn('Quick AI analysis failed:', error.message);
    return {
      vegFriendliness: 'unknown',
      vegetarianCount: 0,
      totalItems: menuItems.length,
      confidence: 0,
      summary: 'AI analysis unavailable'
    };
  }
};

/**
 * Create a streamlined prompt for quick analysis
 * @param {Array} menuItems - Menu items
 * @param {string} restaurantName - Restaurant name
 * @returns {string} Analysis prompt
 */
const createQuickAnalysisPrompt = (menuItems, restaurantName) => {
  // Limit items to prevent token overflow
  const limitedItems = menuItems.slice(0, 50);
  
  const itemsText = limitedItems.map((item, index) => {
    const name = item.name || `Item ${index + 1}`;
    const desc = item.description ? ` - ${item.description.slice(0, 50)}` : '';
    return `${index + 1}. ${name}${desc}`;
  }).join('\n');

  return `Quick vegetarian analysis for "${restaurantName}". Count vegetarian items only (no meat, fish, poultry).

MENU ITEMS:
${itemsText}

Respond with JSON only:
{
  "vegetarianCount": number,
  "vegFriendliness": "excellent|good|fair|poor",
  "confidence": 0.8,
  "summary": "Brief summary"
}

Be conservative - only count clearly vegetarian items.`;
};

/**
 * Quick Gemini API call with minimal processing
 * @param {string} prompt - Analysis prompt
 * @param {string} apiKey - API key
 * @returns {Promise<Object>} API response
 */
const callGeminiQuick = async (prompt, apiKey) => {
  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
      {
        contents: [{
          parts: [{ text: prompt }]
        }]
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000 // Shorter timeout for speed
      }
    );

    if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      return {
        success: true,
        content: response.data.candidates[0].content.parts[0].text
      };
    }

    throw new Error('Invalid API response');

  } catch (error) {
    console.warn('Quick Gemini call failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Parse quick analysis response
 * @param {string} content - API response content
 * @param {number} totalItems - Total menu items
 * @returns {Object} Parsed analysis
 */
const parseQuickAnalysis = (content, totalItems) => {
  try {
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in response');

    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      vegFriendliness: parsed.vegFriendliness || 'unknown',
      vegetarianCount: parsed.vegetarianCount || 0,
      totalItems: totalItems,
      confidence: parsed.confidence || 0.5,
      summary: parsed.summary || 'Quick analysis completed'
    };

  } catch (error) {
    console.warn('Failed to parse quick analysis:', error.message);
    return {
      vegFriendliness: 'unknown',
      vegetarianCount: 0,
      totalItems: totalItems,
      confidence: 0,
      summary: 'Analysis parsing failed'
    };
  }
};

/**
 * Check if restaurant meets vegetarian criteria
 * @param {Object} analysis - Vegetarian analysis
 * @param {string} minCriteria - Minimum criteria level
 * @returns {boolean} Whether restaurant meets criteria
 */
const meetsVegCriteria = (analysis, minCriteria) => {
  if (!analysis || analysis.vegFriendliness === 'unknown') return false;

  const criteriaOrder = ['poor', 'fair', 'good', 'excellent'];
  const minIndex = criteriaOrder.indexOf(minCriteria);
  const actualIndex = criteriaOrder.indexOf(analysis.vegFriendliness);

  return actualIndex >= minIndex;
};

/**
 * Calculate vegetarian score for sorting
 * @param {Object} analysis - Vegetarian analysis
 * @returns {number} Score for sorting
 */
const calculateVegScore = (analysis) => {
  if (!analysis) return 0;

  const criteriaScores = {
    'excellent': 4,
    'good': 3,
    'fair': 2,
    'poor': 1,
    'unknown': 0
  };

  const baseScore = criteriaScores[analysis.vegFriendliness] || 0;
  const confidenceBonus = (analysis.confidence || 0) * 2;
  const itemRatio = analysis.totalItems > 0 ? (analysis.vegetarianCount / analysis.totalItems) : 0;

  return baseScore + confidenceBonus + itemRatio;
};
