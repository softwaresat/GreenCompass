# GreenCompass 🧭🌱

A React Native mobile app that helps users find vegetarian options at nearby restaurants using AI-powered web scraping and intelligent menu analysis.

## ✨ Features

- **🔍 Restaurant Discovery**: Find nearby restaurants using Google Places API
- **🤖 AI Web Scraping**: Intelligent menu extraction from restaurant websites
- **🧠 Smart Analysis**: AI-powered vegetarian option detection with confidence scoring
- **📊 Detailed Reports**: Comprehensive analysis with statistics and recommendations
- **💾 Save & Share**: Save analysis reports and regenerate when needed
- **⚡ Parallel Processing**: Fast multi-threaded menu scraping for large restaurants

## 🏗️ Project Structure

```
GreenCompass/
├── app/                     # React Native screens
│   ├── index.js            # Home screen
│   ├── results.js          # Restaurant search results
│   ├── analysis.js         # Menu analysis display
│   ├── saved-restaurants.js # Saved restaurants
│   └── saved-analysis.js   # Saved analysis reports
├── backend/                 # Node.js backend server
│   ├── server.js           # Express server with worker threads
│   └── services/           # Playwright scraper & AI services
├── services/               # Frontend services
│   ├── webScrapingService.js    # Backend API integration
│   ├── googleMapsService.js     # Google Places API
│   ├── llmService.js           # AI analysis (Gemini)
│   └── advancedSearchService.js # Batch processing
└── components/             # React Native components
```

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
cd backend && npm install && cd ..
```

### 2. Configure Environment
Create `.env` with your API keys:
```env
EXPO_PUBLIC_MAPS_API_KEY=your_google_maps_api_key
EXPO_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
EXPO_PUBLIC_BACKEND_URL=http://localhost:3001
```

### 3. Start Backend Server
```bash
cd backend
./start-server.sh
```

### 4. Start Mobile App
```bash
npm start
```

## 🔑 API Keys Required

- **Google Places API**: Restaurant data and locations
- **Google Gemini API**: AI menu analysis

Get these from [Google Cloud Console](https://console.cloud.google.com/) and [Google AI Studio](https://makersuite.google.com/).

## 🤖 How It Works

1. **Find Restaurants**: Uses Google Places API to find nearby restaurants
2. **Web Scraping**: Backend uses Playwright to intelligently scrape restaurant menus
3. **AI Analysis**: Google Gemini analyzes menu items for vegetarian compatibility
4. **Smart Results**: Displays vegetarian options with confidence scores and explanations

## 🏆 Key Features

- **Intelligent Menu Discovery**: AI finds actual menu pages on restaurant websites
- **Parallel Processing**: Distributes submenu scraping across 4 worker threads
- **Comprehensive Analysis**: Detailed vegetarian analysis with reasoning
- **Persistent Storage**: Save and regenerate analysis reports
- **Error Handling**: Graceful fallbacks and retry mechanisms

## 🛠️ Tech Stack

- **Frontend**: React Native (Expo)
- **Backend**: Node.js + Express + Worker Threads
- **Web Scraping**: Playwright with AI-powered page discovery
- **AI**: Google Gemini for menu analysis
- **APIs**: Google Places API for restaurant data

---

**GreenCompass** - Making vegetarian dining choices easier with AI! 🌱✨