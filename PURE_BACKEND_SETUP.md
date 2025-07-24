# Pure Backend AI Menu Scraping Setup

## Overview
GreenCompass now uses a **pure backend approach** where all menu discovery and extraction happens on the server using AI-powered Playwright. This eliminates CORS issues and provides more intelligent menu finding.

## Key Features
- **AI-Powered Menu Discovery**: Uses Gemini AI to intelligently find menu pages
- **No CORS Proxies**: All web scraping happens server-side with Playwright
- **Smart Recursion**: AI can follow links and analyze multiple pages
- **PDF Detection**: Identifies PDF menus but prioritizes HTML alternatives
- **Contextual Analysis**: Understands restaurant context to find hidden menus

## Setup Instructions

### 1. Backend Configuration

1. **Install Dependencies**:
```bash
cd backend
npm install
npm run install-browser  # Install Playwright browsers
```

2. **Configure Environment**:
```bash
cp .env.example .env
```

3. **Required Environment Variables**:
```bash
# Essential for AI menu discovery
GEMINI_API_KEY=your_actual_gemini_api_key

# VM Network Configuration
VM_IP=your_vm_ip_address
HOST=0.0.0.0
PORT=3001

# Frontend URL (for CORS)
FRONTEND_URL=*
```

4. **Get Gemini API Key**:
   - Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
   - Create a new API key
   - Add it to your `.env` file

### 2. Frontend Configuration

Set the backend URL in your frontend environment:
```bash
EXPO_PUBLIC_BACKEND_URL=http://YOUR_VM_IP:3001
```

### 3. Start the System

1. **Start Backend**:
```bash
cd backend
npm start
```

2. **Start Frontend** (in separate terminal):
```bash
npm start
```

## How It Works

### AI Discovery Process
1. **Original URL Test**: Tests if the provided URL is already a menu page
2. **AI-Powered Search**: Uses Gemini to analyze page content and find menu links
3. **Link Validation**: Tests each discovered link with AI to confirm it's a menu
4. **Common Path Fallback**: Uses AI to validate common menu paths like `/menu`, `/food`
5. **Recursive Search**: Can follow high-confidence links to search deeper

### Request Flow
```
Frontend → Backend API → Playwright + AI → Menu Data → Frontend
```

### API Endpoints

#### Complete Menu Discovery (Recommended)
```
POST /api/scrape-menu-complete
{
  "url": "https://restaurant-website.com",
  "options": {
    "mobile": true,
    "timeout": 60000
  }
}
```

#### Legacy Direct Scraping
```
POST /api/scrape-playwright
{
  "url": "https://restaurant-website.com/menu",
  "options": {
    "mobile": true,
    "timeout": 45000
  }
}
```

## Benefits

### For Users
- **More Intelligent**: Finds menus that simple path-based approaches miss
- **More Reliable**: No dependency on external CORS proxies
- **Faster Processing**: Server-side scraping is more efficient
- **Better Success Rate**: AI can understand context and follow complex navigation

### For Developers
- **Simplified Frontend**: No complex CORS handling or proxy management
- **Centralized Logic**: All scraping logic is in one place
- **Better Error Handling**: Comprehensive error reporting from backend
- **Easier Debugging**: All logs are server-side and centralized

## Configuration Options

### Performance Settings
```bash
MAX_CONCURRENT_SCRAPES=10    # Concurrent scraping operations
RATE_LIMIT_REQUESTS=30       # Requests per minute per IP
DEFAULT_TIMEOUT=45000        # Default timeout in milliseconds
```

### AI Settings
```bash
GEMINI_API_KEY=...           # Required for AI menu discovery
```

### Network Settings
```bash
HOST=0.0.0.0                 # Listen on all interfaces
VM_IP=192.168.1.100         # Your VM's IP for network display
FRONTEND_URL=*              # CORS origin (* for development)
```

## Monitoring

### Health Check
```bash
curl http://YOUR_VM_IP:3001/health
```

### Statistics
```bash
curl http://YOUR_VM_IP:3001/api/stats
```

### API Documentation
```bash
curl http://YOUR_VM_IP:3001/api/docs
```

## Troubleshooting

### Common Issues

1. **"No menu found"**: 
   - Check if Gemini API key is configured
   - Verify the website is accessible
   - Check server logs for AI analysis details

2. **Connection refused**:
   - Ensure backend is running on correct port
   - Check firewall settings
   - Verify EXPO_PUBLIC_BACKEND_URL is correct

3. **Timeout errors**:
   - Increase timeout in request options
   - Some complex websites require more processing time
   - Check server resources

### Debug Mode
Set `NODE_ENV=development` in `.env` for verbose logging.

## Migration from Hybrid Approach

If you're migrating from the previous hybrid approach:

1. **Remove Old Dependencies**: The frontend no longer needs CORS proxy libraries
2. **Update API Calls**: Change from multiple discovery methods to single backend call
3. **Environment Variables**: Add `GEMINI_API_KEY` to backend and `EXPO_PUBLIC_BACKEND_URL` to frontend
4. **Test Thoroughly**: Verify that menu discovery works for your target restaurants
