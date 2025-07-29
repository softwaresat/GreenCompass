/**
 * Express server for GreenCompass menu scraping
 * Optimized with multithreading and clustering support for maximum performance
 */

const cluster = require('cluster');
const numCPUs = require('os').cpus().length;
const compression = require('compression');
const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

const playwrightScraper = require('./services/playwrightScraper.js');
const { validateUrl, normalizeUrl, validateOptions } = require('./utils/validation.js');

// Multi-threading configuration
const ENABLE_CLUSTERING = process.env.ENABLE_CLUSTERING !== 'false';
const MAX_WORKERS = Math.min(numCPUs, 4); // Limit to 4 workers max for scraping

// Worker thread pool for CPU-intensive scraping tasks
class ScrapingWorkerPool {
  constructor() {
    this.workers = [];
    this.queue = [];
    this.maxWorkers = MAX_WORKERS;
    this.activeJobs = new Map();
    this.jobId = 0;
  }

  async init() {
    console.log(`🏭 Initializing worker pool with ${this.maxWorkers} workers...`);
    for (let i = 0; i < this.maxWorkers; i++) {
      this.createWorker();
    }
  }

  createWorker() {
    const worker = new Worker(__filename, {
      workerData: { isWorker: true }
    });

    worker.on('message', (result) => {
      const { jobId, data, error } = result;
      const job = this.activeJobs.get(jobId);
      if (job) {
        this.activeJobs.delete(jobId);
        if (error) {
          job.reject(new Error(error));
        } else {
          job.resolve(data);
        }
      }
    });

    worker.on('error', (error) => {
      console.error('🔥 Worker error:', error);
      this.replaceWorker(worker);
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        console.warn(`🔄 Worker exited with code ${code}, replacing...`);
        this.replaceWorker(worker);
      }
    });

    this.workers.push(worker);
    return worker;
  }

  replaceWorker(deadWorker) {
    const index = this.workers.indexOf(deadWorker);
    if (index !== -1) {
      this.workers.splice(index, 1);
      this.createWorker();
    }
  }

  async execute(url, options) {
    return new Promise((resolve, reject) => {
      const jobId = ++this.jobId;
      this.activeJobs.set(jobId, { resolve, reject });

      // Find least busy worker (simple round-robin)
      const worker = this.workers[jobId % this.workers.length];
      
      worker.postMessage({
        jobId,
        url,
        options
      });
    });
  }

  async shutdown() {
    console.log('🔒 Shutting down worker pool...');
    await Promise.all(this.workers.map(worker => worker.terminate()));
  }
}

// Initialize worker pool if not in worker thread
let scrapingPool = null;
if (isMainThread && !workerData?.isWorker) {
  scrapingPool = new ScrapingWorkerPool();
}

// Handle worker thread execution
if (!isMainThread && workerData?.isWorker) {
  // This code runs in worker threads
  parentPort.on('message', async ({ jobId, url, options }) => {
    try {
      console.log(`🔧 Worker processing job ${jobId} for: ${url}`);
      const result = await playwrightScraper.findAndScrapeMenu(url, options);
      parentPort.postMessage({ jobId, data: result });
    } catch (error) {
      console.error(`🔥 Worker job ${jobId} failed:`, error.message);
      parentPort.postMessage({ jobId, error: error.message });
    }
  });
  
  // Exit worker thread setup early
  return;
}

const app = express();

// Server configuration
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// Rate limiting - optimized for multithreaded server
const rateLimiter = new RateLimiterMemory({
  keyFunction: (req) => req.ip,
  points: 50, // Increased for multithreaded server
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

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const originalSend = res.send;
  
  res.send = function(data) {
    const duration = Date.now() - start;
    const workerId = cluster.isWorker ? `W${cluster.worker.id}` : 'M';
    console.log(`[${workerId}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
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

// Health check endpoint with multithreading info
app.get('/health', (req, res) => {
  const stats = playwrightScraper.getStats();
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    server: 'GreenCompass Backend (Multithreaded)',
    version: '2.0.0',
    cluster: {
      isMaster: cluster.isMaster,
      isWorker: cluster.isWorker,
      workerId: cluster.worker?.id || null,
      totalWorkers: Object.keys(cluster.workers || {}).length
    },
    scraper: {
      activeScrapes: stats.activeScrapes,
      maxConcurrent: stats.maxConcurrent,
      browserActive: stats.browserActive
    },
    workerPool: {
      enabled: !!scrapingPool,
      workers: scrapingPool?.workers?.length || 0,
      activeJobs: scrapingPool?.activeJobs?.size || 0
    },
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpus: numCPUs
  });
});

// Complete menu discovery and scraping endpoint (with worker pool)
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

    const scrapingOptions = {
      waitForSelector: optionsValidation.sanitized.waitForSelector,
      mobile: optionsValidation.sanitized.mobile || options.mobile || false,
      timeout: optionsValidation.sanitized.timeout || options.timeout || 120000,
      includeDiscovery: true
    };

    // Use worker pool for CPU-intensive scraping if available
    let result;
    if (scrapingPool && scrapingPool.workers.length > 0) {
      console.log(`🏭 Delegating to worker pool (${scrapingPool.workers.length} workers available)`);
      result = await scrapingPool.execute(url, scrapingOptions);
    } else {
      console.log(`🔧 Processing on main thread (worker pool not available)`);
      result = await playwrightScraper.findAndScrapeMenu(url, scrapingOptions);
    }
    
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

    const scrapingOptions = {
      waitForSelector: optionsValidation.sanitized.waitForSelector,
      mobile: optionsValidation.sanitized.mobile || options.mobile || false,
      timeout: optionsValidation.sanitized.timeout || options.timeout || 120000,
      skipDiscovery: true
    };

    // Use worker pool for CPU-intensive scraping if available
    let result;
    if (scrapingPool && scrapingPool.workers.length > 0) {
      console.log(`🏭 Delegating direct scraping to worker pool`);
      result = await scrapingPool.execute(url, scrapingOptions);
    } else {
      console.log(`🔧 Processing direct scraping on main thread`);
      result = await playwrightScraper.scrapeMenuData(url, scrapingOptions);
    }
    
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

// API documentation endpoint
app.get('/api/docs', (req, res) => {
  res.json({
    title: 'GreenCompass Backend API (Multithreaded)',
    version: '2.0.0',
    description: 'High-performance menu scraping API with worker threads and clustering',
    performance: {
      clustering: ENABLE_CLUSTERING,
      workerThreads: MAX_WORKERS,
      concurrentScrapes: 10,
      rateLimit: '50 requests/minute'
    },
    endpoints: {
      'GET /health': 'Health check with multithreading statistics',
      'GET /api/docs': 'This documentation',
      'POST /api/scrape-menu-complete': 'Complete menu discovery and scraping (recommended)',
      'POST /api/scrape-playwright': 'Direct menu scraping from specific URL'
    }
  });
});

// Start server with clustering and worker pool support
const startServer = async () => {
  // Initialize worker pool for scraping tasks
  if (scrapingPool) {
    try {
      await scrapingPool.init();
      console.log(`✅ Worker pool initialized with ${scrapingPool.workers.length} workers`);
    } catch (error) {
      console.warn(`⚠️ Worker pool initialization failed: ${error.message}`);
      console.log(`🔧 Continuing with main thread processing only`);
    }
  }

  const server = app.listen(PORT, HOST, () => {
    const vmIP = process.env.VM_IP || 'YOUR_VM_IP';
    const workerId = cluster.isWorker ? ` (Worker ${cluster.worker.id})` : '';
    
    console.log(`🚀 GreenCompass Backend Server Started${workerId}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📍 Local: http://localhost:${PORT}`);
    console.log(`🌐 Network: http://${vmIP}:${PORT}`);
    console.log(`🔍 Health: http://${vmIP}:${PORT}/health`);
    console.log(`📖 Docs: http://${vmIP}:${PORT}/api/docs`);
    console.log(`🎯 Complete API: POST http://${vmIP}:${PORT}/api/scrape-menu-complete`);
    console.log(`🔧 Direct API: POST http://${vmIP}:${PORT}/api/scrape-playwright`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🔗 Frontend Configuration:`);
    console.log(`   EXPO_PUBLIC_BACKEND_URL=http://${vmIP}:${PORT}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`⚡ Performance Settings:`);
    console.log(`   Rate limit: 50 requests/minute`);
    console.log(`   Max concurrent: 10 scrapes`);
    console.log(`   Timeout: 2 minutes default`);
    console.log(`   Worker threads: ${scrapingPool?.workers?.length || 0}`);
    console.log(`   Clustering: ${ENABLE_CLUSTERING ? 'Enabled' : 'Disabled'}`);
    console.log(`   CPU cores: ${numCPUs}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  });

  // Set server timeout to 5 minutes to allow for long-running operations
  server.timeout = 300000; // 5 minutes

  return server;
};

// Clustering setup
if (ENABLE_CLUSTERING && cluster.isMaster) {
  console.log(`🏭 Master process ${process.pid} is running`);
  console.log(`🔄 Starting ${numCPUs} worker processes...`);

  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`💥 Worker ${worker.process.pid} died with code ${code} and signal ${signal}`);
    console.log('🔄 Starting a new worker...');
    cluster.fork();
  });

  cluster.on('online', (worker) => {
    console.log(`✅ Worker ${worker.process.pid} is online`);
  });

} else {
  // Worker process or single-threaded mode
  startServer().then(server => {
    // Graceful shutdown
    const gracefulShutdown = async (signal) => {
      console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
      
      server.close(async () => {
        console.log('📡 HTTP server closed');
        
        try {
          // Shutdown worker pool
          if (scrapingPool) {
            await scrapingPool.shutdown();
            console.log('🏭 Worker pool shut down');
          }
          
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
  });
}

module.exports = app;
