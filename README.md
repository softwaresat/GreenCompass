# VeggieVision 🥬📱

A React Native mobile app that helps users find vegetarian options at nearby restaurants using location services, Google Maps integration, OCR menu analysis, and AI-powered ingredient detection.

## ✨ Features

### 🔍 **Restaurant Discovery**
- **Location-based Search**: Find restaurants near your current location using GPS
- **Google Places API Integration**: Get real restaurant data with photos, ratings, and reviews
- **Mock Data Support**: Test the app without API keys during development

### 📸 **Automated Menu Analysis**
- **Photo Fetching**: Automatically retrieves restaurant photos from Google Maps
- **OCR Text Extraction**: Uses Google Vision API to extract text from menu images
- **Smart Menu Parsing**: Identifies menu items, prices, and descriptions from extracted text
- **Multi-Image Analysis**: Processes multiple restaurant photos for comprehensive coverage

### 🤖 **AI-Powered Vegetarian Detection**
- **Google Gemini Integration**: Advanced AI analysis of menu items
- **Detailed Classification**: Identifies vegetarian, vegan, and non-vegetarian options
- **Confidence Scoring**: Provides reliability scores for each analysis
- **Reasoning Explanations**: Clear explanations for why items are classified as vegetarian or not
- **Ingredient Analysis**: Identifies non-vegetarian ingredients and potential allergens

### 📊 **Comprehensive Analysis**
- **Restaurant Ratings**: Overall vegetarian-friendliness scoring (1-10 scale)
- **Detailed Statistics**: Percentage of vegetarian options, category breakdowns
- **Recommendations**: AI-powered suggestions based on analysis
- **Progress Tracking**: Real-time analysis progress with visual indicators

### 🎨 **User Experience**
- **Clean Interface**: Modern, intuitive design with smooth navigation
- **Loading States**: Professional loading indicators with progress tracking
- **Error Handling**: Graceful error handling with retry options
- **Responsive Design**: Works seamlessly on different screen sizes

## 🏗️ Project Structure

```
VeggieVision/
├── app/
│   ├── _layout.js         # Main navigation layout
│   ├── index.js           # Home screen with main CTA button
│   ├── results.js         # Restaurant list screen
│   └── analysis.js        # Complete menu analysis screen
├── components/
│   ├── RestaurantListItem.js  # Individual restaurant item component
│   ├── LoadingIndicator.js    # Loading spinner component
│   └── MenuResults.js         # Comprehensive results display
├── services/
│   ├── googleMapsService.js   # Google Places API integration
│   ├── visionService.js       # Google Vision API OCR integration
│   └── llmService.js          # Google Gemini API LLM integration
├── .env                       # Environment variables (API keys)
└── .gitignore                 # Git ignore file (includes .env)
```

## 🚀 Installation & Setup

### 1. Clone and Install
```bash
git clone <repository-url>
cd VeggieVision
npm install
```

### 2. Configure API Keys
Create or update `.env` file with your API keys:
```env
# Google Maps API Key
EXPO_PUBLIC_MAPS_API_KEY=your_google_maps_api_key_here

# Google Cloud Vision API Key
EXPO_PUBLIC_VISION_API_KEY=your_vision_api_key_here

# Google Gemini API Key
EXPO_PUBLIC_GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Run the App
```bash
npm start
```

## 🔑 API Keys Setup

### Google Maps API
- **Service**: Google Places API (Nearby Search & Place Details)
- **Setup**: 
  1. Go to [Google Cloud Console](https://console.cloud.google.com/)
  2. Create a new project or select existing one
  3. Enable "Places API" and "Places API (New)"
  4. Create credentials (API Key)
  5. Restrict the key to Places API
  6. Add the key to your `.env` file

### Google Vision API
- **Service**: Google Cloud Vision API (Document Text Detection)
- **Setup**:
  1. In Google Cloud Console, enable "Cloud Vision API"
  2. Create service account or use existing API key
  3. Add the key to your `.env` file

### Google Gemini API
- **Service**: Google Gemini Pro (Text Generation)
- **Setup**:
  1. Go to [Google AI Studio](https://makersuite.google.com/)
  2. Create a new API key
  3. Add the key to your `.env` file

## 🔄 How It Works

### 1. **Restaurant Discovery**
- User taps "Find Vegetarian Options Nearby"
- App requests location permission
- Fetches nearby restaurants using Google Places API
- Displays list of restaurants with ratings and photos

### 2. **Menu Analysis Process**
- User selects a restaurant
- App automatically starts 4-stage analysis:
  1. **Photo Fetching**: Downloads restaurant photos from Google Maps
  2. **OCR Processing**: Extracts text from images using Google Vision API
  3. **Menu Parsing**: Identifies menu items from extracted text
  4. **AI Analysis**: Analyzes items for vegetarian compatibility using Gemini

### 3. **Results Display**
- Shows comprehensive analysis with statistics
- Displays vegetarian/vegan items with explanations
- Provides restaurant rating and recommendations
- Includes confidence scores and detailed reasoning

## 🎯 Current Features Status

### ✅ **Fully Implemented**
- [x] Google Maps integration with photo fetching
- [x] Google Vision API OCR for menu text extraction
- [x] Google Gemini AI for vegetarian analysis
- [x] Complete restaurant analysis workflow
- [x] Comprehensive results display
- [x] Progress tracking and error handling
- [x] Mock data for development without API keys

### 🔧 **Technical Implementation**
- [x] Automated photo retrieval from Google Places
- [x] Multi-image OCR processing
- [x] Advanced menu item parsing
- [x] AI-powered ingredient analysis
- [x] Confidence scoring and explanations
- [x] Restaurant rating algorithm
- [x] User-friendly progress indicators

## 🧪 Testing

### Without API Keys
The app works fully with mock data:
- Shows sample restaurants with photos
- Demonstrates OCR text extraction
- Provides AI analysis results
- Full UI/UX experience

### With API Keys
1. Add your API keys to `.env`
2. Ensure location services are enabled
3. Run the app in an area with nearby restaurants
4. Test the complete analysis workflow

## 🔮 Future Enhancements

### Planned Features
- **User Preferences**: Save dietary restrictions and preferences
- **Review System**: Rate restaurants and share experiences
- **Offline Mode**: Cache analysis results for offline access
- **Social Features**: Share vegetarian finds with friends
- **Ingredient Filters**: Filter by specific ingredients or allergens
- **Restaurant Profiles**: Detailed restaurant information and history

### Technical Improvements
- **Image Classification**: Better identification of menu vs. food photos
- **Multi-language Support**: OCR and analysis in multiple languages
- **Real-time Updates**: Live menu updates and availability
- **Performance Optimization**: Caching and background processing
- **Analytics**: Usage analytics and improvement insights

## 🏆 Key Achievements

- **Complete Automation**: No manual photo capture required
- **High Accuracy**: AI-powered analysis with confidence scoring
- **Professional UI**: Clean, modern interface with excellent UX
- **Comprehensive Analysis**: Detailed insights and recommendations
- **Production Ready**: Error handling, loading states, and fallbacks
- **Developer Friendly**: Mock data and extensive documentation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly with both mock and real data
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For issues and questions:
- Check the console logs for detailed error messages
- Verify your API keys are correctly configured
- Ensure location permissions are granted
- Try with mock data first to isolate API issues

## 🙏 Acknowledgments

- **Google Maps API** for restaurant data and photos
- **Google Vision API** for OCR capabilities
- **Google Gemini API** for AI analysis
- **Expo** for the excellent development framework
- **React Native** for cross-platform mobile development

---

**VeggieVision** - Making vegetarian dining choices easier with AI! 🌱✨ 