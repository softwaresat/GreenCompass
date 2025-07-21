/**
 * Express middleware for logging, error handling, and security
 */

/**
 * Simple request logger optimized for low overhead
 */
export const requestLogger = (req, res, next) => {
  const start = Date.now();
  const timestamp = new Date().toISOString();
  
  // Log request
  console.log(`[${timestamp}] ${req.method} ${req.url} - ${req.ip}`);
  
  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const statusEmoji = status >= 500 ? '❌' : status >= 400 ? '⚠️' : '✅';
    
    console.log(`[${new Date().toISOString()}] ${statusEmoji} ${req.method} ${req.url} - ${status} - ${duration}ms`);
  });
  
  next();
};

/**
 * Global error handler
 */
export const errorHandler = (err, req, res, next) => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ❌ Error:`, err.message);
  console.error(`[${timestamp}] Stack:`, err.stack);
  
  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  res.status(err.statusCode || 500).json({
    success: false,
    error: isDevelopment ? err.message : 'Internal server error',
    timestamp,
    ...(isDevelopment && { stack: err.stack })
  });
};

/**
 * Basic security headers middleware
 */
export const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Remove server information
  res.removeHeader('X-Powered-By');
  
  next();
};
