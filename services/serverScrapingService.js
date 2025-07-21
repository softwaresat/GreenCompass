/**
 * Server-Only Scraping Service
 * Always uses the Playwright backend server for menu scraping
 */

const API_BASE = 'http://localhost:3001/api';

class ServerScrapingService {
  constructor() {
    this.isServerAvailable = false;
    this.lastHealthCheck = 0;
    this.healthCheckInterval = 30000; // 30 seconds
  }

  /**
   * Check if the backend server is available
   */
  async checkServerHealth() {
    const now = Date.now();
    
    // Skip if we checked recently
    if (now - this.lastHealthCheck < this.healthCheckInterval && this.isServerAvailable) {
      return this.isServerAvailable;
    }

    try {
      const response = await fetch(`${API_BASE}/health`, {
        method: 'GET',
        timeout: 5000
      });
      
      this.isServerAvailable = response.ok;
      this.lastHealthCheck = now;
      
      if (this.isServerAvailable) {
        console.log('✅ Backend server is available');
      } else {
        console.warn('⚠️ Backend server health check failed');
      }
      
      return this.isServerAvailable;
    } catch (error) {
      console.error('❌ Backend server is not available:', error.message);
      this.isServerAvailable = false;
      this.lastHealthCheck = now;
      return false;
    }
  }

  /**
   * Scrape menu data using the backend server
   */
  async scrapeMenuData(url, options = {}) {
    console.log(`🚀 Starting server-side scraping for: ${url}`);
    
    // Check server availability first
    const serverAvailable = await this.checkServerHealth();
    if (!serverAvailable) {
      throw new Error('Backend server is not available. Please ensure the server is running on port 3001.');
    }

    try {
      const requestBody = {
        url: url,
        options: {
          waitForSelector: options.waitForSelector,
          mobile: options.mobile || false,
          timeout: options.timeout || 45000
        }
      };

      console.log('📡 Sending request to backend server...');
      const response = await fetch(`${API_BASE}/scrape-playwright`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        timeout: 60000 // 1 minute timeout
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server responded with ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        console.log(`✅ Server scraping successful - extracted ${result.menuItems?.length || 0} items`);
        return {
          success: true,
          source: 'server',
          ...result
        };
      } else {
        console.error('❌ Server scraping failed:', result.error);
        throw new Error(result.error || 'Server scraping failed');
      }

    } catch (error) {
      console.error('❌ Server scraping error:', error.message);
      throw error;
    }
  }

  /**
   * Get server statistics
   */
  async getServerStats() {
    try {
      const response = await fetch(`${API_BASE}/stats`, {
        method: 'GET',
        timeout: 5000
      });
      
      if (response.ok) {
        return await response.json();
      } else {
        return null;
      }
    } catch (error) {
      console.warn('Could not fetch server stats:', error.message);
      return null;
    }
  }

  /**
   * Analyze multiple restaurants
   */
  async analyzeRestaurants(restaurants, progressCallback) {
    const results = [];
    const total = restaurants.length;
    
    console.log(`🔍 Analyzing ${total} restaurants using server...`);
    
    for (let i = 0; i < total; i++) {
      const restaurant = restaurants[i];
      
      try {
        // Update progress
        if (progressCallback) {
          progressCallback({
            current: i + 1,
            total: total,
            restaurant: restaurant.name,
            status: 'analyzing'
          });
        }
        
        console.log(`📊 Analyzing ${restaurant.name} (${i + 1}/${total})`);
        
        const menuData = await this.scrapeMenuData(restaurant.website, {
          mobile: true,
          waitForSelector: restaurant.menuSelector
        });
        
        results.push({
          restaurant: restaurant,
          menuData: menuData,
          success: true,
          analyzedAt: new Date().toISOString()
        });
        
        // Brief delay between requests to be respectful
        if (i < total - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (error) {
        console.error(`❌ Failed to analyze ${restaurant.name}:`, error.message);
        
        results.push({
          restaurant: restaurant,
          menuData: null,
          success: false,
          error: error.message,
          analyzedAt: new Date().toISOString()
        });
      }
    }
    
    // Final progress update
    if (progressCallback) {
      progressCallback({
        current: total,
        total: total,
        status: 'complete'
      });
    }
    
    const successful = results.filter(r => r.success).length;
    console.log(`✅ Analysis complete: ${successful}/${total} restaurants analyzed successfully`);
    
    return results;
  }
}

// Export singleton instance
export const serverScrapingService = new ServerScrapingService();
export default serverScrapingService;
