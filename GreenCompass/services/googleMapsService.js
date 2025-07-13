import axios from 'axios';
import { Platform } from 'react-native';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_MAPS_API_KEY;

/**
 * Get nearby restaurants using Google Places API
 * @param {Object} location - Location object with latitude and longitude
 * @param {number} radius - Search radius in meters
 * @returns {Promise<Array>} Array of restaurant objects
 */
export const getNearbyRestaurants = async (location, radius = 5000) => {
  try {
    if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY === 'your_maps_api_key_here') {
      throw new Error('Google Maps API key not configured');
    }

    console.log('🔍 Fetching nearby restaurants...');
    console.log(`📍 Location: ${location.latitude}, ${location.longitude}`);
    console.log(`🎯 Radius: ${radius}m`);

    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/place/nearbysearch/json',
      {
        params: {
          key: GOOGLE_MAPS_API_KEY,
          location: `${location.latitude},${location.longitude}`,
          radius: radius,
          type: 'restaurant',
          fields: 'place_id,name,rating,price_level,vicinity,geometry'
        }
      }
    );

    if (response.data.status === 'OK') {
      const restaurants = response.data.results.map(place => ({
        id: place.place_id,
        name: place.name,
        rating: place.rating || 0,
        priceLevel: place.price_level || 0,
        vicinity: place.vicinity || '',
        latitude: place.geometry?.location?.lat || 0,
        longitude: place.geometry?.location?.lng || 0,
      }));

      console.log(`✅ Found ${restaurants.length} restaurants`);
      return restaurants;
    } else {
      throw new Error(`Google Places API error: ${response.data.status}`);
    }
  } catch (error) {
    console.error('❌ Error fetching restaurants:', error);
    throw error;
  }
};

/**
 * Get detailed restaurant information including website URL
 * @param {string} placeId - Google Places ID
 * @returns {Promise<Object>} Restaurant details with website URL
 */
export const getRestaurantDetails = async (placeId) => {
  try {
    if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY === 'your_maps_api_key_here') {
      throw new Error('Google Maps API key not configured');
    }

    console.log('🔍 Fetching restaurant details...');
    console.log(`🆔 Place ID: ${placeId}`);

    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/place/details/json',
      {
        params: {
          key: GOOGLE_MAPS_API_KEY,
          place_id: placeId,
          fields: 'place_id,name,rating,formatted_phone_number,formatted_address,website,opening_hours,price_level,types'
        }
      }
    );

    if (response.data.status === 'OK') {
      const place = response.data.result;
      const details = {
        id: place.place_id,
        name: place.name,
        rating: place.rating || 0,
        phone: place.formatted_phone_number || '',
        address: place.formatted_address || '',
        website: place.website || '',
        priceLevel: place.price_level || 0,
        types: place.types || [],
        openingHours: place.opening_hours?.weekday_text || [],
        isOpen: place.opening_hours?.open_now || false
      };

      console.log(`✅ Retrieved details for: ${details.name}`);
      console.log(`🌐 Website: ${details.website || 'No website available'}`);
      
      return details;
    } else {
      throw new Error(`Google Places API error: ${response.data.status}`);
    }
  } catch (error) {
    console.error('❌ Error fetching restaurant details:', error);
    throw error;
  }
};

/**
 * Scrape restaurant website to extract menu information and analyze for vegetarian options
 * @param {string} placeId - The Google Places ID for the restaurant
 * @returns {Promise<Object>} Analysis results from website scraping
 */
export const analyzeRestaurantWebsite = async (placeId) => {
  try {
    // Get restaurant details including website URL
    const restaurantDetails = await getRestaurantDetails(placeId);
    
    console.log(`🔍 Starting website analysis for ${restaurantDetails.name}...`);

    // Check if website is available
    if (!restaurantDetails.website) {
      return {
        success: false,
        error: 'Restaurant website not available',
        restaurantInfo: restaurantDetails,
        menuAnalysis: {
          vegetarianItems: [],
          summary: "Restaurant website not available for menu analysis.",
          confidence: 0.0,
          totalItems: 0
        }
      };
    }

    // Scrape the website for menu data
    console.log(`🌐 Scraping website: ${restaurantDetails.website}`);
    const { scrapeRestaurantMenu } = await import('./webScrapingService');
    const menuData = await scrapeRestaurantMenu(restaurantDetails.website);

    if (!menuData.success) {
      return {
        success: false,
        error: 'Failed to scrape menu from website',
        restaurantInfo: restaurantDetails,
        menuAnalysis: {
          vegetarianItems: [],
          summary: "Could not extract menu information from restaurant website.",
          confidence: 0.0,
          totalItems: 0
        }
      };
    }

    // Analyze scraped menu for vegetarian options
    console.log(`🤖 Analyzing scraped menu with ${menuData.menuItems.length} items...`);
    const { analyzeScrapedMenuForVegetarianOptions } = await import('./llmService');
    const menuAnalysis = await analyzeScrapedMenuForVegetarianOptions(
      menuData.menuItems,
      restaurantDetails.name
    );

    console.log('✅ Website analysis completed successfully');
    
    return {
      success: true,
      restaurantInfo: restaurantDetails,
      menuAnalysis: menuAnalysis,
      scrapingInfo: {
        url: restaurantDetails.website,
        itemsFound: menuData.menuItems.length,
        scrapingMethod: menuData.method || 'general'
      }
    };

  } catch (error) {
    console.error('🚨 Error in website analysis:', error);
    return {
      success: false,
      error: error.message,
      restaurantInfo: null,
      menuAnalysis: {
        vegetarianItems: [],
        summary: "Error occurred during website analysis.",
        confidence: 0.0,
        totalItems: 0
      }
    };
  }
}; 