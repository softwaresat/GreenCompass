# 🍃 GreenCompass Backend

A robust Node.js backend server that provides AI-powered menu scraping using Playwright and worker threads for parallel processing.

## ✨ Features

- **🎭 Playwright Web Scraping**: Advanced browser automation for complex restaurant websites
- **🧠 AI Menu Discovery**: Intelligent identification of actual menu pages
- **⚡ Parallel Processing**: Multi-threaded submenu scraping with up to 4 workers
- **🤖 AI Integration**: Google Gemini for menu analysis and vegetarian detection
- **🛡️ Production Ready**: Rate limiting, CORS, error handling, and health monitoring

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- 1GB+ RAM recommended

### Installation & Setup

1. **Run the startup script:**
   ```bash
   cd backend
   ./start-server.sh
   ```

2. **Manual setup (alternative):**
   ```bash
   npm install
   npm run install-browser
   cp .env.example .env
   # Edit .env with your configuration
   npm start
   ```

### Verification
- **Health check**: http://localhost:3001/health
- **Configuration**: http://localhost:3001/api/config

## 📡 API Endpoints

### Menu Scraping (Parallel)
```http
POST /api/scrape-menu-parallel
Content-Type: application/json

{
  "url": "https://restaurant-website.com",
  "options": {
    "mobile": true,
    "timeout": 120000
  }
}
```

### Menu Scraping (Standard)
```http
POST /api/scrape-menu-complete
```

### Health & Configuration
```http
GET /health
GET /api/config
GET /api/docs
```

## ⚙️ Configuration

Configure via `.env`:
```bash
# Server
PORT=3001
NODE_ENV=production

# Worker Configuration
MAX_WORKERS=4
ENABLE_PARALLEL_SUBMENUS=true

# Performance
REQUEST_TIMEOUT=120000
RATE_LIMIT_REQUESTS=30

# AI API Keys
GEMINI_API_KEY=your_gemini_api_key
```

## 🏭 Architecture

- **Main Server**: Express.js with worker thread management
- **Worker Pool**: ScrapingWorkerPool for parallel submenu processing
- **AI Integration**: Google Gemini for menu discovery and analysis
- **Intelligent Scraping**: AI-powered menu page detection and content extraction

## 📱 Frontend Integration

Configure your frontend to use the backend:
```env
EXPO_PUBLIC_BACKEND_URL=http://localhost:3001
```

The frontend `webScrapingService.js` automatically uses parallel processing when available.

## 🔧 Development

```bash
npm run dev     # Development with auto-restart
npm test        # Run tests
DEBUG=true npm start  # Debug mode
```

---

**Backend Status**: Production ready with intelligent parallel processing! 🚀
