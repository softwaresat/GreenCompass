# 🍃 GreenCompass Backen## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- 1GB+ RAM recommended
- Network access between VM and frontend

### VM/Network Setup

1. **Find your VM's IP address:**
   ```bash
   hostname -I
   # Example output: 192.168.1.100
   ```

2. **Configure frontend environment:**
   ```bash
   # In your frontend project, set:
   EXPO_PUBLIC_BACKEND_URL=http://192.168.1.100:3001
   ```

### Installation

A robust backend server for the GreenCompass mobile app that provides menu scraping capabilities using Playwright. This se## 📱 Mobile App Integration

The server works seamlessly with the GreenCompass mobile app through the updated `webScrapingService.js`:

```javascript
import { scrapeRestaurantMenu } from './webScrapingService';

// Scrape a restaurant menu (automatically uses server backend)
const result = await scrapeRestaurantMenu('https://restaurant.com');
```ized for reliable performance and can handle multiple concurrent requests efficiently.

## ✨ Features

- **Playwright-powered scraping** - Advanced browser automation for complex websites
- **RESTful API** - Clean endpoints for menu data extraction  
- **Performance optimized** - Handles up to 10 concurrent scrapes
- **Rate limiting** - 30 requests per minute per IP
- **Security hardened** - CORS, helmet, input validation
- **Health monitoring** - Built-in health checks and stats
- **Error handling** - Comprehensive error reporting
- **Resource management** - Automatic cleanup and memory management

## � Quick Start

### Prerequisites
- Node.js 18+ 
- 1GB+ RAM recommended
- Basic HTTP/HTTPS network access

### Installation

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Run the startup script:**
   ```bash
   ./start-server.sh
   ```
   
   The script will automatically:
   - Install dependencies
   - Set up Playwright browser
   - Create configuration file
   - Display network access URLs
   - Start the server

3. **Manual installation (alternative):**
   ```bash
   npm install
   npm run install-browser
   cp .env.example .env
   # Edit .env and set VM_IP=your_vm_ip_address
   npm start
   ```

### Verification

- **Local access:** http://localhost:3001/health
- **Network access:** http://YOUR_VM_IP:3001/health
- **API endpoint:** http://YOUR_VM_IP:3001/api/scrape-playwright

## 📡 API Reference

### Scrape Menu Data
```http
POST /api/scrape-playwright
Content-Type: application/json

{
  "url": "https://restaurant-website.com",
  "options": {
    "waitForSelector": ".menu-item",
    "mobile": false,
    "timeout": 45000
  }
}
```

**Response:**
```json
{
  "success": true,
  "url": "https://restaurant-website.com",
  "menuItems": [
    {
      "name": "Veggie Burger",
      "price": "$12.99",
      "description": "Plant-based patty with fresh vegetables"
    }
  ],
  "categories": ["Mains", "Appetizers"],
  "restaurantInfo": {
    "name": "Green Eats Restaurant"
  },
  "extractionTime": 3500
}
```

### Health Check
```http
GET /health
```

### Server Statistics  
```http
GET /api/stats
```

## ⚙️ Configuration

Copy `.env.example` to `.env` and customize:

```bash
# Server Configuration
PORT=3001
NODE_ENV=production
HOST=0.0.0.0

# Network Configuration (replace with your VM's IP)
VM_IP=192.168.1.100

# Performance Settings
MAX_CONCURRENT_PAGES=10
REQUEST_TIMEOUT=45000

# Rate Limiting  
RATE_LIMIT_REQUESTS=30
RATE_LIMIT_WINDOW=60

# Security
FRONTEND_URL=*
API_KEY=your_secret_key
```

### Frontend Configuration

In your React Native/Expo project, set the backend URL:

```bash
# .env or app.json
EXPO_PUBLIC_BACKEND_URL=http://192.168.1.100:3001
```

Or in your app code:
```javascript
// If not set via environment, you can hardcode it
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://192.168.1.100:3001';
```

## � Performance Tuning

### Server Requirements
- **CPU:** Single core sufficient, multi-core preferred
- **Memory:** 1GB+ recommended for optimal performance
- **Storage:** ~200MB for Playwright browser
- **Network:** Stable internet connection

### Optimization Settings
- **Concurrent scrapes:** Up to 10 simultaneous requests
- **Request timeout:** 45 seconds per scrape
- **Rate limiting:** 30 requests per minute per IP
- **Resource blocking:** Minimal blocking for better accuracy

## 🛠️ Development

### Local Development
```bash
npm run dev  # Auto-restart on changes
```

### Testing
```bash
npm test           # Run all tests
npm run test:api   # API endpoint tests  
npm run test:scraper # Scraping functionality tests
```

### Debugging
```bash
DEBUG=true npm start
```

## � Mobile App Integration

The server works seamlessly with the GreenCompass mobile app through the `serverScrapingService.js` client:

```javascript
import serverScrapingService from './serverScrapingService';

// Scrape a restaurant menu
const result = await serverScrapingService.scrapeMenuData(
  'https://restaurant.com',
  { mobile: true }
);
```
