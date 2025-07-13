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

    console.log('🤖 Gemini API: Starting vegetarian analysis of scraped menu...');
    console.log(`🏪 Gemini API: Restaurant: ${restaurantName}`);
    console.log(`📝 Gemini API: Analyzing ${menuItems.length} menu items`);

    if (!menuItems || menuItems.length === 0) {
      return {
        vegetarianItems: [],
        summary: "No menu items found to analyze for vegetarian options.",
        confidence: 0.0,
        totalItems: 0,
        overallRating: 'unknown'
      };
    }

    // Create a focused prompt for vegetarian analysis of scraped menu
    const prompt = createScrapedMenuAnalysisPrompt(menuItems, restaurantName);
    
    console.log('🤖 Gemini API: Calling API for scraped menu analysis...');
    const analysisResult = await callGeminiAPI(prompt, apiKey);
    
    if (analysisResult.success) {
      console.log('✅ Gemini API: Scraped menu analysis completed successfully');
      return parseScrapedMenuAnalysis(analysisResult.content, menuItems);
    } else {
      throw new Error(`Gemini API error: ${analysisResult.error}`);
    }
  } catch (error) {
    console.error('🚨 Error in scraped menu analysis:', error);
    throw error;
  }
};

/**
 * Call Gemini API with retry logic
 * @param {string} prompt - The prompt to send to Gemini
 * @param {string} apiKey - Gemini API key
 * @returns {Promise<Object>} API response
 */
const callGeminiAPI = async (prompt, apiKey) => {
  try {
    console.log('🤖 Attempting Gemini API call...');
    
    // Try gemini-2.5-flash first (as requested)
    let response;
    try {
      response = await axios.post(
        `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 30000, // 30 second timeout
        }
      );
      console.log('✅ Gemini 2.5 Flash API call successful');
    } catch (primaryError) {
      console.log('⚠️ Gemini 2.5 Flash failed, trying 1.5 Flash...', primaryError.message);
      
      try {
        // Fallback to gemini-1.5-flash
        response = await axios.post(
          `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
          {
            contents: [{
              parts: [{
                text: prompt
              }]
            }]
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
            timeout: 30000,
          }
        );
        console.log('✅ Gemini 1.5 Flash API call successful');
      } catch (secondaryError) {
        console.log('⚠️ Gemini 1.5 Flash failed, trying 1.5 Pro...', secondaryError.message);
        
        // Final fallback to gemini-1.5-pro
        response = await axios.post(
          `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent?key=${apiKey}`,
          {
            contents: [{
              parts: [{
                text: prompt
              }]
            }]
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
            timeout: 30000,
          }
        );
        console.log('✅ Gemini 1.5 Pro API call successful');
      }
    }

    if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      return {
        success: true,
        content: response.data.candidates[0].content.parts[0].text
      };
    } else {
      throw new Error('Invalid response format from Gemini API');
    }
  } catch (error) {
    console.error('❌ Gemini API call failed:', error);
    
    // Provide more specific error messages
    if (error.code === 'NETWORK_ERROR' || error.message.includes('Network Error')) {
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
};

/**
 * Create a focused prompt for scraped menu analysis
 * @param {Array} menuItems - Array of scraped menu items
 * @param {string} restaurantName - Name of the restaurant
 * @returns {string} Formatted prompt for Gemini API
 */
const createScrapedMenuAnalysisPrompt = (menuItems, restaurantName) => {
  const itemsText = menuItems.map((item, index) => 
    `${index + 1}. ${item.name}: ${item.description || 'No description'} ${item.price ? `(${item.price})` : ''}`
  ).join('\n');

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
      "description": "Brief description if available",
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
 * Parse scraped menu analysis response
 * @param {string} content - Raw response from Gemini API
 * @param {Array} menuItems - Array of scraped menu items
 * @returns {Object} Parsed analysis results
 */
const parseScrapedMenuAnalysis = (content, menuItems) => {
  try {
    console.log('🔍 Gemini API: Parsing scraped menu analysis response...');
    console.log(`📄 Gemini API: Response length: ${content.length} characters`);
    
    // Clean up the response - remove markdown code blocks if present
    let cleanedContent = content.replace(/```json\s*|\s*```/g, '').trim();
    
    // Try to find JSON in the response
    const jsonStart = cleanedContent.indexOf('{');
    const jsonEnd = cleanedContent.lastIndexOf('}') + 1;
    
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      cleanedContent = cleanedContent.substring(jsonStart, jsonEnd);
    }
    
    console.log(`🔍 Gemini API: Attempting to parse JSON response...`);
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
    
    console.log(`✅ Gemini API: Successfully parsed ${normalized.vegetarianItems.length} vegetarian items`);
    console.log(`📊 Gemini API: Overall confidence: ${(normalized.confidence * 100).toFixed(1)}%`);
    
    return normalized;
    
  } catch (parseError) {
    console.error('❌ Gemini API: Failed to parse scraped menu analysis response as JSON:', parseError.message);
    console.log('📝 Gemini API: Raw response content:', content.substring(0, 500));
    
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