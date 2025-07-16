import axios from 'axios';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_MAPS_API_KEY;

/**
 * Haversine formula to calculate distance between two lat/lng points in miles
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 3958.8; // Radius of Earth in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Get nearby restaurants using Google Places API
 * @param {Object} location - Location object with latitude and longitude (user's location)
 * @param {number} radius - Search radius in meters
 * @returns {Promise<Array>} Array of restaurant objects
 */
export const getNearbyRestaurants = async (location, radius = 16093) => { // 10 miles in meters
  try {
    if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY === 'your_maps_api_key_here') {
      throw new Error('Google Maps API key not configured');
    }

    let allResults = [];
    let nextPageToken = null;
    let page = 0;
    do {
      let params = {
        key: GOOGLE_MAPS_API_KEY,
        location: `${location.latitude},${location.longitude}`,
        radius: radius,
        type: 'restaurant',
        fields: 'place_id,name,rating,price_level,vicinity,geometry'
      };
      if (nextPageToken) {
        params.pagetoken = nextPageToken;
      }
      const response = await axios.get(
        'https://maps.googleapis.com/maps/api/place/nearbysearch/json',
        { params }
      );
      if (response.data.status === 'OK') {
        const restaurants = response.data.results.map(place => {
          const lat = place.geometry?.location?.lat || 0;
          const lng = place.geometry?.location?.lng || 0;
          const distanceMiles = haversineDistance(location.latitude, location.longitude, lat, lng);
          return {
            id: place.place_id,
            name: place.name,
            rating: place.rating || 0,
            priceLevel: place.price_level || 0,
            vicinity: place.vicinity || '',
            latitude: lat,
            longitude: lng,
            distanceMiles: distanceMiles,
          };
        });
        allResults = allResults.concat(restaurants);
        nextPageToken = response.data.next_page_token;
        page++;
        if (nextPageToken && page < 3) {
          // Google requires a short delay before using next_page_token
          await new Promise(res => setTimeout(res, 2000));
        } else {
          nextPageToken = null;
        }
      } else {
        nextPageToken = null;
        if (allResults.length === 0) {
          throw new Error(`Google Places API error: ${response.data.status}`);
        }
      }
    } while (nextPageToken && allResults.length < 60);

    return allResults;
  } catch (error) {
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

    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/place/details/json',
      {
        params: {
          key: GOOGLE_MAPS_API_KEY,
          place_id: placeId,
          fields: 'place_id,name,rating,formatted_phone_number,formatted_address,website,opening_hours,price_level,types,geometry'
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
        isOpen: place.opening_hours?.open_now || false,
        latitude: place.geometry?.location?.lat || 0,
        longitude: place.geometry?.location?.lng || 0,
      };

      return details;
    } else {
      throw new Error(`Google Places API error: ${response.data.status}`);
    }
  } catch (error) {
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

    // Analyze menu and get enhanced items in a single step
    const { analyzeScrapedMenuForVegetarianOptions } = await import('./llmService');
    
    // Analyze menu for vegetarian options and enhance menu items in one call
    const analysisResults = await analyzeScrapedMenuForVegetarianOptions(
      menuData.menuItems,
      restaurantDetails.name
    );

    return {
      success: true,
      restaurantInfo: restaurantDetails,
      menuAnalysis: {
        vegetarianItems: analysisResults.vegetarianItems || [],
        summary: analysisResults.summary || "",
        confidence: analysisResults.confidence || 0,
        totalItems: analysisResults.totalItems || 0,
        overallRating: analysisResults.overallRating || "unknown",
        recommendations: analysisResults.recommendations || []
      },
      enhancedMenuItems: analysisResults.enhancedMenuItems || [],
      scrapingInfo: {
        url: restaurantDetails.website,
        itemsFound: menuData.menuItems.length,
        scrapingMethod: menuData.method || 'general'
      }
    };

  } catch (error) {
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

/**
 * Search for restaurants by text query using Google Places Text Search API
 * @param {string} query - The search query (name, address, etc.)
 * @param {Object} location - User's location { latitude, longitude }
 * @returns {Promise<Array>} Array of restaurant objects
 */
export const searchRestaurantsByText = async (query, location) => {
  try {
    if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY === 'your_maps_api_key_here') {
      throw new Error('Google Maps API key not configured');
    }
    const params = {
      key: GOOGLE_MAPS_API_KEY,
      query: query,
      location: `${location.latitude},${location.longitude}`,
      radius: 16093, // 10 miles
      type: 'restaurant',
    };
    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/place/textsearch/json',
      { params }
    );
    if (response.data.status === 'OK') {
      return response.data.results.map(place => {
        const lat = place.geometry?.location?.lat || 0;
        const lng = place.geometry?.location?.lng || 0;
        const distanceMiles = haversineDistance(location.latitude, location.longitude, lat, lng);
        return {
          id: place.place_id,
          name: place.name,
          rating: place.rating || 0,
          priceLevel: place.price_level || 0,
          vicinity: place.formatted_address || place.vicinity || '',
          latitude: lat,
          longitude: lng,
          distanceMiles: distanceMiles,
        };
      });
    } else {
      throw new Error(`Google Places Text Search error: ${response.data.status}`);
    }
  } catch (error) {
    return [];
  }
}; 