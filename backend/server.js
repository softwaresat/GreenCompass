/**
 * Express server for GreenCompass menu scraping
 * Optimized for reliable performance with reasonable resource usage
 */

const compression = require('compression');
const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const { RateLimiterMemory } = require('rate-limiter-flexible');

const playwrightScraper = require('./services/playwrightScraper.js');
const { validateUrl, normalizeUrl, validateOptions } = require('./utils/validation.js');

const app = express();

// Server configuration
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// Rate limiting - increased for better server
const rateLimiter = new RateLimiterMemory({
  keyFunction: (req) => req.ip,
  points: 30, // 30 requests
  duration: 60, // per 60 seconds by IP
  blockDuration: 60, // block for 60 seconds if limit exceeded
});

// Middleware setup
app.use(compression());
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const originalSend = res.send;
  
  res.send = function(data) {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    originalSend.call(this, data);
  };
  
  next();
});

// Rate limiting middleware
const rateLimitMiddleware = async (req, res, next) => {
  try {
    await rateLimiter.consume(req.ip);
    next();
  } catch (rejRes) {
    const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
    res.set('Retry-After', String(secs));
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: secs
    });
  }
};

// Apply rate limiting to API routes
app.use('/api', rateLimitMiddleware);

// URL validation middleware
const urlValidationMiddleware = (req, res, next) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({
      success: false,
      error: 'URL is required'
    });
  }
  
  if (!validateUrl(url)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid URL format or blocked URL'
    });
  }
  
  // Normalize the URL
  req.body.url = normalizeUrl(url);
  next();
};

// Health check endpoint
app.get('/health', (req, res) => {
  const stats = playwrightScraper.getStats();
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    server: 'GreenCompass Backend',
    version: '1.0.0',
    scraper: {
      activeScrapes: stats.activeScrapes,
      maxConcurrent: stats.maxConcurrent,
      browserActive: stats.browserActive
    },
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// API documentation endpoint
app.get('/api/docs', (req, res) => {
  res.json({
    title: 'GreenCompass Backend API',
    version: '1.0.0',
    description: 'Menu scraping API using Playwright for reliable extraction',
    endpoints: {
      'POST /api/scrape-menu-complete': {
        description: 'Complete menu discovery and scraping - finds menu page intelligently then scrapes it',
        body: {
          url: 'string (required) - Restaurant website URL (homepage is fine)',
          options: {
            waitForSelector: 'string (optional) - CSS selector to wait for',
            mobile: 'boolean (optional) - Use mobile viewport',
            timeout: 'number (optional) - Request timeout in ms (1000-60000)'
          }
        },
        response: {
          success: 'boolean',
          url: 'string - Original URL',
          menuPageUrl: 'string - Discovered menu page URL',
          menuItems: 'array of objects with name, price, description',
          categories: 'array of strings',
          restaurantInfo: 'object with name, url',
          extractionTime: 'number (milliseconds)',
          discoveryMethod: 'string - How the menu was found'
        },
        example: {
          request: {
            url: 'https://restaurant-example.com',
            options: {
              mobile: true,
              timeout: 45000
            }
          },
          response: {
            success: true,
            url: 'https://restaurant-example.com',
            menuPageUrl: 'https://restaurant-example.com/menu',
            menuItems: [
              {
                name: 'Veggie Burger',
                price: '$12.99',
                description: 'Plant-based patty with fresh vegetables'
              }
            ],
            categories: ['Mains', 'Appetizers'],
            restaurantInfo: {
              name: 'Green Eats Restaurant'
            },
            extractionTime: 3500,
            discoveryMethod: 'common-paths'
          }
        }
      },
      'POST /api/parse-pdf-menu': {
        description: 'Parse restaurant menu from a PDF file',
        body: {
          url: 'string (required) - Direct URL to PDF menu file',
          options: {
            timeout: 'number (optional) - Request timeout in ms (1000-60000)'
          }
        },
        response: {
          success: 'boolean',
          url: 'string - PDF URL',
          menuItems: 'array of objects with name, price, description, category',
          categories: 'array of strings',
          restaurantInfo: 'object with name, phone, website if found',
          extractionTime: 'number (milliseconds)',
          discoveryMethod: 'pdf-parsing',
          rawText: 'string - Sample of extracted text for debugging'
        },
        example: {
          request: {
            url: 'https://restaurant-example.com/menu.pdf',
            options: {
              timeout: 30000
            }
          },
          response: {
            success: true,
            url: 'https://restaurant-example.com/menu.pdf',
            menuItems: [
              {
                name: 'Caesar Salad',
                price: '$8.95',
                description: 'Romaine lettuce with parmesan and croutons',
                category: 'appetizer'
              }
            ],
            categories: ['appetizer', 'main', 'dessert'],
            restaurantInfo: {
              name: 'Bistro Example',
              phone: '555-123-4567'
            },
            extractionTime: 2500,
            discoveryMethod: 'pdf-parsing'
          }
        }
      },
      'POST /api/scrape-playwright': {
        description: 'Direct menu scraping from a specific URL (legacy endpoint)',
        body: {
          url: 'string (required) - Direct menu page URL',
          options: {
            waitForSelector: 'string (optional) - CSS selector to wait for',
            mobile: 'boolean (optional) - Use mobile viewport',
            timeout: 'number (optional) - Request timeout in ms (1000-60000)'
          }
        },
        response: {
          success: 'boolean',
          url: 'string',
          menuItems: 'array of objects with name, price, description',
          categories: 'array of strings',
          restaurantInfo: 'object with name, url',
          extractionTime: 'number (milliseconds)'
        },
        example: {
          request: {
            url: 'https://restaurant-example.com/menu',
            options: {
              mobile: true,
              timeout: 30000
            }
          },
          response: {
            success: true,
            url: 'https://restaurant-example.com/menu',
            menuItems: [
              {
                name: 'Veggie Burger',
                price: '$12.99',
                description: 'Plant-based patty with fresh vegetables'
              }
            ],
            categories: ['Mains', 'Appetizers'],
            restaurantInfo: {
              name: 'Green Eats Restaurant'
            },
            extractionTime: 3500
          }
        }
      },
      'GET /health': {
        description: 'Server health check and status',
        response: {
          status: 'string',
          timestamp: 'string',
          server: 'string',
          version: 'string',
          scraper: 'object with scraper statistics',
          uptime: 'number',
          memory: 'object'
        }
      },
      'GET /api/stats': {
        description: 'Server performance statistics',
        response: {
          timestamp: 'string',
          activeScrapes: 'number',
          maxConcurrent: 'number',
          browserActive: 'boolean',
          uptime: 'number',
          memory: 'object'
        }
      }
    },
    rateLimit: {
      requests: 30,
      window: '60 seconds',
      blockDuration: '60 seconds'
    }
  });
});

// Server statistics endpoint
app.get('/api/stats', (req, res) => {
  const stats = playwrightScraper.getStats();
  res.json({
    timestamp: new Date().toISOString(),
    ...stats,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    nodeVersion: process.version,
    platform: process.platform
  });
});

// PDF menu parsing endpoint
app.post('/api/parse-pdf-menu', urlValidationMiddleware, async (req, res) => {
  const { url, options = {} } = req.body;
  
  try {
    console.log(`📄 PDF menu parsing request received for: ${url}`);
    
    // Validate that this is actually a PDF URL
    if (!url.toLowerCase().includes('.pdf')) {
      return res.status(400).json({
        success: false,
        error: 'URL does not appear to be a PDF file',
        url: url
      });
    }
    
    const pdfParser = require('./services/pdfParser');
    const result = await pdfParser.parsePDFMenu(url, options);
    
    if (result.success) {
      console.log(`✅ PDF parsing completed successfully: ${result.menuItems?.length || 0} items`);
    } else {
      console.log(`❌ PDF parsing failed: ${result.error}`);
    }
    
    res.json(result);
    
  } catch (error) {
    console.error(`💥 PDF parsing error for ${url}:`, error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      url: url,
      timestamp: new Date().toISOString()
    });
  }
});

// Complete menu discovery and scraping endpoint
app.post('/api/scrape-menu-complete', urlValidationMiddleware, async (req, res) => {
  const { url, options = {} } = req.body;
  
  try {
    console.log(`🎯 Complete menu scraping request received for: ${url}`);
    
    // Validate options
    const optionsValidation = validateOptions(options);
    if (!optionsValidation.valid) {
      return res.status(400).json({
        success: false,
        error: optionsValidation.error,
        url: url
      });
    }
    
    const result = await playwrightScraper.findAndScrapeMenu(url, {
      waitForSelector: optionsValidation.sanitized.waitForSelector,
      mobile: optionsValidation.sanitized.mobile || options.mobile || false,
      timeout: optionsValidation.sanitized.timeout || options.timeout || 45000,
      includeDiscovery: true
    });
    
    if (result.success) {
      console.log(`✅ Complete scraping completed successfully: ${result.menuItems?.length || 0} items`);
      console.log(`📍 Menu found at: ${result.menuPageUrl || 'original URL'}`);
    } else {
      console.log(`❌ Complete scraping failed: ${result.error}`);
    }
    
    res.json(result);
    
  } catch (error) {
    console.error(`💥 Complete scraping error for ${url}:`, error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      url: url,
      timestamp: new Date().toISOString()
    });
  }
});

// Legacy scraping endpoint (direct URL scraping only)
app.post('/api/scrape-playwright', urlValidationMiddleware, async (req, res) => {
  const { url, options = {} } = req.body;
  
  try {
    console.log(`🎯 Direct scraping request received for: ${url}`);
    
    // Validate options
    const optionsValidation = validateOptions(options);
    if (!optionsValidation.valid) {
      return res.status(400).json({
        success: false,
        error: optionsValidation.error,
        url: url
      });
    }
    
    const result = await playwrightScraper.scrapeMenuData(url, {
      waitForSelector: optionsValidation.sanitized.waitForSelector,
      mobile: optionsValidation.sanitized.mobile || options.mobile || false,
      timeout: optionsValidation.sanitized.timeout || options.timeout || 45000
    });
    
    if (result.success) {
      console.log(`✅ Direct scraping completed successfully: ${result.menuItems?.length || 0} items`);
    } else {
      console.log(`❌ Direct scraping failed: ${result.error}`);
    }
    
    res.json(result);
    
  } catch (error) {
    console.error(`💥 Direct scraping error for ${url}:`, error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      url: url,
      timestamp: new Date().toISOString()
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('🚨 Server Error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    message: `${req.method} ${req.originalUrl} is not a valid endpoint`,
    availableEndpoints: [
      'GET /health',
      'GET /api/docs',
      'GET /api/stats',
      'POST /api/scrape-menu-complete',
      'POST /api/parse-pdf-menu',
      'POST /api/scrape-playwright'
    ],
    timestamp: new Date().toISOString()
  });
});

// Start server
const server = app.listen(PORT, HOST, () => {
  const vmIP = process.env.VM_IP || 'YOUR_VM_IP';
  
  console.log('🚀 GreenCompass Backend Server Started');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📍 Local: http://localhost:${PORT}`);
  console.log(`🌐 Network: http://${vmIP}:${PORT}`);
  console.log(`🔍 Health: http://${vmIP}:${PORT}/health`);
  console.log(`📊 Stats: http://${vmIP}:${PORT}/api/stats`);
  console.log(`📖 Docs: http://${vmIP}:${PORT}/api/docs`);
  console.log(`🎯 Complete API: POST http://${vmIP}:${PORT}/api/scrape-menu-complete`);
  console.log(`� PDF Parser API: POST http://${vmIP}:${PORT}/api/parse-pdf-menu`);
  console.log(`�🔧 Direct API: POST http://${vmIP}:${PORT}/api/scrape-playwright`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🔗 Frontend Configuration:`);
  console.log(`   EXPO_PUBLIC_BACKEND_URL=http://${vmIP}:${PORT}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`💾 Performance Settings:`);
  console.log(`   Rate limit: 30 requests/minute`);
  console.log(`   Max concurrent: 10 scrapes`);
  console.log(`   Timeout: 45 seconds default`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
  
  server.close(async () => {
    console.log('📡 HTTP server closed');
    
    try {
      await playwrightScraper.closeBrowser();
      console.log('🌐 Browser closed');
      console.log('✅ Graceful shutdown complete');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error.message);
      process.exit(1);
    }
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    console.log('⏰ Force closing after timeout...');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;
