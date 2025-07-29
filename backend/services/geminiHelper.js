/**
 * AI Helper for PDF parsing
 * Shared AI utilities for menu parsing
 */

const axios = require('axios');

/**
 * Call Gemini API with retry logic
 * @param {string} prompt - The prompt to send to Gemini
 * @param {string} apiKey - Gemini API key
 * @param {string} context - Optional context for logging (e.g., 'PDF parsing', 'menu detection')
 * @returns {Promise<Object>} API response
 */
async function callGeminiAPI(prompt, apiKey, context = 'analysis') {
  // Common request body for all API calls
  const requestBody = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }]
  };
  
  // Common request config - much longer timeout for all operations
  const requestConfig = {
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: context.includes('PDF') ? 120000 : 60000, // 2min for PDF parsing, 1min for others
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
  
  // Try each model in sequence
  for (const model of models) {
    try {
      console.info(`[Gemini] Trying ${model.name} for ${context}...`);
      
      const response = await axios.post(model.url, requestBody, requestConfig);
      
      if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        return {
          success: true,
          model: model.name,
          content: response.data.candidates[0].content.parts[0].text
        };
      }
    } catch (error) {
      console.error(`[Gemini] ${model.name} error:`, error.message);
      
      // If this is the last model, return the error
      if (model.name === models[models.length - 1].name) {
        return {
          success: false,
          error: error.message
        };
      }
    }
  }
  
  return {
    success: false,
    error: 'Failed to get response from any Gemini model'
  };
}

module.exports = {
  callGeminiAPI
};
