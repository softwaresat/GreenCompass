/**
 * Lightweight Express server for GreenCompass menu scraping
 * Optimized for weak servers with minimal resource usage
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { RateLimiterMemory } from 'rate-limiter-flexible';

import { scrapeWithMinimalPlaywright, getPlaywrightHealth } from './services/playwrightScraper.js';
import { validateUrl } from './utils/validation.js';
import { errorHandler, requestLogger } from './middleware/index.js';

const app = express();
// Server configuration
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0'; // Listen on all interfaces for VM access

// Rate limiting - increased for better server
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 30, // limit each IP to 30 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health' // Skip rate limiting for health checks
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for API
  crossOriginEmbedderPolicy: false
}));
app.use(compression());
app.use(cors({
  origin: [
    'http://localhost:8081', // Expo dev
    'http://localhost:19006', // Expo web
    'exp://localhost:19000', // Expo app
    process.env.FRONTEND_URL || '*'
  ],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(requestLogger);

// Apply rate limiting
app.use(async (req, res, next) => {
  try {
    await rateLimiter.consume(req.ip);
    next();
  } catch (rejRes) {
    res.status(429).json({
      success: false,
      error: 'Too many requests, please try again later',
      retryAfter: rejRes.msBeforeNext
    });
  }
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const playwrightHealth = await getPlaywrightHealth();
    const memUsage = process.memoryUsage();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
        total: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB',
        external: Math.round(memUsage.external / 1024 / 1024) + ' MB'
      },
      playwright: playwrightHealth,
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Main scraping endpoint
app.post('/api/scrape-playwright', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { url, options = {} } = req.body;
    
    // Validate input
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required',
        usage: 'POST /api/scrape-playwright with { "url": "https://restaurant.com" }'
      });
    }
    
    if (!validateUrl(url)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL format',
        provided: url
      });
    }
    
    console.log(`[API] Scraping request for: ${url}`);
    console.log(`[API] Options:`, JSON.stringify(options, null, 2));
    
    // Perform scraping with timeout
    const timeoutMs = options.timeout || 45000; // 45 second default
    const scrapePromise = scrapeWithMinimalPlaywright(url, options);
    
    const result = await Promise.race([
      scrapePromise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
      )
    ]);
    
    const duration = Date.now() - startTime;
    console.log(`[API] Scraping completed in ${duration}ms`);
    
    // Add metadata to response
    result.serverInfo = {
      processingTime: duration,
      timestamp: new Date().toISOString(),
      serverVersion: '1.0.0',
      method: 'minimal-playwright'
    };
    
    res.json(result);
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[API] Scraping failed after ${duration}ms:`, error.message);
    
    res.status(500).json({
      success: false,
      error: error.message === 'Request timeout' 
        ? 'The request took too long to process. The website may be slow or unresponsive.'
        : 'Failed to scrape the website. The site may be down or blocking automated access.',
      details: error.message,
      processingTime: duration,
      timestamp: new Date().toISOString()
    });
  }
});

// Performance stats endpoint
app.get('/api/stats', async (req, res) => {
  try {
    const memUsage = process.memoryUsage();
    const playwrightHealth = await getPlaywrightHealth();
    
    res.json({
      server: {
        uptime: process.uptime(),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid
      },
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024)
      },
      playwright: playwrightHealth,
      rateLimiting: {
        pointsPerMinute: 10,
        windowSizeSeconds: 60
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get server stats',
      details: error.message
    });
  }
});

// API documentation endpoint
app.get('/api/docs', (req, res) => {
  res.json({
    name: 'GreenCompass Menu Scraping API',
    version: '1.0.0',
    description: 'Lightweight Playwright-based menu scraping service optimized for weak servers',
    endpoints: {
      'GET /health': 'Health check with system information',
      'GET /api/stats': 'Server performance statistics',
      'POST /api/scrape-playwright': {
        description: 'Scrape restaurant menu using Playwright',
        body: {
          url: 'string (required) - Restaurant website URL',
          options: {
            timeout: 'number (optional) - Request timeout in ms (default: 45000)',
            waitForSelector: 'string (optional) - CSS selector to wait for',
            blockResources: 'array (optional) - Resource types to block',
            mobileViewport: 'boolean (optional) - Use mobile viewport'
          }
        },
        example: {
          url: 'https://restaurant.com',
          options: {
            timeout: 30000,
            waitForSelector: '.menu',
            blockResources: ['image', 'font'],
            mobileViewport: true
          }
        }
      }
    },
    rateLimiting: {
      requests: 10,
      windowSeconds: 60,
      message: 'Rate limited to prevent server overload'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    available: [
      'GET /health',
      'GET /api/stats',
      'GET /api/docs',
      'POST /api/scrape-playwright'
    ]
  });
});

// Error handler (must be last)
app.use(errorHandler);

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`[Server] Received ${signal}, starting graceful shutdown...`);
  
  server.close(() => {
    console.log('[Server] HTTP server closed');
    process.exit(0);
  });
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.log('[Server] Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server] Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit in production, just log
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

// Start server
const server = app.listen(PORT, HOST, () => {
  const vmIP = process.env.VM_IP || 'YOUR_VM_IP';
  
  console.log('🚀 GreenCompass Backend Server Started');
  console.log(`📍 Local: http://localhost:${PORT}`);
  console.log(`🌐 Network: http://${vmIP}:${PORT}`);
  console.log(`🔍 Health: http://${vmIP}:${PORT}/health`);
  console.log(`📊 Stats: http://${vmIP}:${PORT}/api/stats`);
  console.log(`📖 Docs: http://${vmIP}:${PORT}/api/docs`);
  console.log(`🎯 Main API: POST http://${vmIP}:${PORT}/api/scrape-playwright`);
  console.log(`🔗 Frontend should use: http://${vmIP}:${PORT}/api`);
  console.log(`💡 Configure EXPO_PUBLIC_BACKEND_URL=http://${vmIP}:${PORT}`);
  console.log(`💾 Memory optimization: Enabled`);
  console.log(`🛡️  Rate limiting: 10 requests/minute per IP`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

export default app;
