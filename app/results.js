import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoadingIndicator from '../components/LoadingIndicator';
import RestaurantAnalysisResult from '../components/RestaurantAnalysisResult';
import RestaurantListItem from '../components/RestaurantListItem';
import SelectableRestaurantItem from '../components/SelectableRestaurantItem';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Colors from '../constants/Colors';
import Spacing from '../constants/Spacing';
import Typography from '../constants/Typography';
import { analyzeSelectedRestaurants } from '../services/advancedSearchService';
import { getNearbyRestaurants, searchRestaurantsByText } from '../services/googleMapsService';

export default function ResultsScreen() {
  const router = useRouter();
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualAddress, setManualAddress] = useState('');
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [locationChoiceMade, setLocationChoiceMade] = useState(false);
  
  // Batch analysis state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedRestaurants, setSelectedRestaurants] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [vegCriteria, setVegCriteria] = useState('good'); // Default vegetarian criteria

  // Reset state when component mounts (screen is loaded/reopened)
  useEffect(() => {
    // This will run every time the component mounts
    const resetState = () => {
      setRestaurants([]);
      setLoading(false);
      setError(null);
      setShowManualInput(false);
      setManualAddress('');
      setManualLat('');
      setManualLng('');
      setSearch('');
      setSearchResults([]);
      setUserLocation(null);
      setLocationChoiceMade(false);
      setSelectionMode(false);
      setSelectedRestaurants([]);
      setIsAnalyzing(false);
      setAnalysisResults([]);
      setShowResults(false);
    };
    
    resetState();
    
    // Optional cleanup when component unmounts
    return () => {
      // Any cleanup if needed
    };
  }, []); // Empty dependency array means this runs once on mount

  useEffect(() => {
    if (locationChoiceMade && !showManualInput && restaurants.length === 0) {
      loadRestaurants();
    }
  }, [locationChoiceMade, showManualInput, restaurants.length]);

  const geocodeAddress = async (address) => {
    try {
      const geocodeResult = await Location.geocodeAsync(address);
      
      if (geocodeResult.length > 0) {
        const { latitude, longitude } = geocodeResult[0];
        return { latitude, longitude };
      } else {
        throw new Error('Address not found');
      }
    } catch (error) {
      throw new Error('Failed to find location for this address');
    }
  };

  const handleManualLocationSubmit = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let location;
      
      if (manualAddress.trim()) {
        // Use address input
        const coords = await geocodeAddress(manualAddress.trim());
        location = { coords };
      } else if (manualLat && manualLng) {
        // Use coordinate input
        const lat = parseFloat(manualLat);
        const lng = parseFloat(manualLng);
        
        if (isNaN(lat) || isNaN(lng)) {
          throw new Error('Invalid coordinates entered');
        }
        
        location = {
          coords: {
            latitude: lat,
            longitude: lng
          }
        };
      } else {
        throw new Error('Please enter either an address or coordinates');
      }
      
      // Proceed with restaurant search
      const nearbyRestaurants = await getNearbyRestaurants(location.coords);
      setRestaurants(nearbyRestaurants);
      setShowManualInput(false);
      setLocationChoiceMade(true); // <-- Only set to true after successful manual location
      setUserLocation(location.coords);
      setSearchResults([]); // Reset search results
      
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // When loading restaurants, save user location for text search
  const loadRestaurants = async () => {
    try {
      setLoading(true);
      setError(null);

      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        setError('Location permission denied. You can manually enter your location below.');
        setShowManualInput(true);
        setLocationChoiceMade(false); // Reset location choice
        setLoading(false);
        return;
      }

      // Check if location services are enabled
      const providerStatus = await Location.getProviderStatusAsync();
      
      if (!providerStatus.locationServicesEnabled) {
        setError('Location services are disabled. You can manually enter your location below.');
        setShowManualInput(true);
        setLocationChoiceMade(false); // Reset location choice
        setLoading(false);
        return;
      }

      // Get current location with timeout and better accuracy
      let location;
      
      try {
        // Add a timeout to the location request
        const locationPromise = Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        
        // Create a timeout promise
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Location request timed out')), 15000) // 15 seconds timeout
        );
        
        // Race the location request against the timeout
        location = await Promise.race([locationPromise, timeoutPromise]);
      } catch (locationError) {
        console.log('Location error:', locationError);
        
        // Try to get last known location as fallback
        try {
          location = await Location.getLastKnownPositionAsync({
            maxAge: 300000, // 5 minutes
            requiredAccuracy: 1000, // 1km accuracy
          });
          
          if (location) {
            console.log('Using last known location');
          }
        } catch (lastKnownError) {
          console.log('Last known location error:', lastKnownError);
        }
        
        // If all else fails, offer manual input
        if (!location) {
          setError('Unable to get your location automatically. Please enter your location manually below.');
          setShowManualInput(true);
          setLocationChoiceMade(false); // Reset location choice
          setLoading(false);
          return;
        }
      }

      // Proceed with restaurant search
      const nearbyRestaurants = await getNearbyRestaurants(location.coords);
      
      if (nearbyRestaurants && nearbyRestaurants.length > 0) {
        setRestaurants(nearbyRestaurants);
        setUserLocation(location.coords);
        setSearchResults([]); // Reset search results
      } else {
        setError('No restaurants found near your location. Try a different location.');
        setLocationChoiceMade(false); // Reset location choice if no restaurants found
      }
      
    } catch (error) {
      console.error('Failed to load restaurants:', error);
      setError(`Failed to load restaurants: ${error.message}`);
      setLocationChoiceMade(false); // Reset location choice on error
    } finally {
      setLoading(false);
    }
  };

  // Search logic
  useEffect(() => {
    const doSearch = async () => {
      const q = search.trim().toLowerCase();
      if (!q) {
        setSearchResults([]);
        return;
      }
      // Filter local results first
      const filtered = restaurants.filter(r =>
        (r.name && r.name.toLowerCase().includes(q)) ||
        (r.vicinity && r.vicinity.toLowerCase().includes(q))
      );
      if (filtered.length > 0) {
        setSearchResults(filtered);
      } else if (userLocation) {
        setLoading(true);
        const remoteResults = await searchRestaurantsByText(search, userLocation);
        setSearchResults(remoteResults);
        setLoading(false);
      } else {
        setSearchResults([]);
      }
    };
    doSearch();
  }, [search]);

  // Show searchResults if searching, otherwise all restaurants
  const filteredRestaurants = search ? searchResults : restaurants;

  // Toggle restaurant selection for batch analysis
  const toggleRestaurantSelection = (restaurant) => {
    setSelectedRestaurants(prev => {
      const isSelected = prev.some(r => r.id === restaurant.id);
      
      if (isSelected) {
        return prev.filter(r => r.id !== restaurant.id);
      } else {
        if (prev.length >= 5) {
          Alert.alert('Selection Limit', 'You can select up to 5 restaurants for batch analysis.');
          return prev;
        }
        return [...prev, restaurant];
      }
    });
  };

  // Start batch analysis
  const startBatchAnalysis = async () => {
    if (selectedRestaurants.length === 0) {
      Alert.alert('No Selection', 'Please select at least one restaurant to analyze.');
      return;
    }

    setIsAnalyzing(true);
    setShowResults(false);

    try {
      const results = await analyzeSelectedRestaurants(
        selectedRestaurants,
        vegCriteria,
        (progress) => {
          // Could show progress here if needed
        }
      );

      if (results.success) {
        setAnalysisResults(results.results);
        setShowResults(true);
        setSelectionMode(false);
        setSelectedRestaurants([]);
      } else {
        Alert.alert('Analysis Error', results.error || 'Failed to analyze restaurants');
      }
    } catch (error) {
      Alert.alert('Analysis Error', error.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Cancel selection mode
  const cancelSelectionMode = () => {
    setSelectionMode(false);
    setSelectedRestaurants([]);
    setShowResults(false);
  };

  const renderRestaurant = ({ item }) => {
    if (selectionMode) {
      return (
        <SelectableRestaurantItem
          restaurant={item}
          isSelected={selectedRestaurants.some(r => r.id === item.id)}
          onToggle={() => toggleRestaurantSelection(item)}
        />
      );
    }
    return <RestaurantListItem restaurant={item} />;
  };

  const renderAnalysisResult = ({ item }) => (
    <RestaurantAnalysisResult result={item} vegCriteria={vegCriteria} />
  );

  const renderManualLocationInput = () => (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.manualInputContainer}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Button
          title="← Back"
          onPress={() => {
            // Reset all manual input related state
            setLoading(false);
            setError(null);
            setManualAddress('');
            setManualLat('');
            setManualLng('');
            setShowManualInput(false);
            setLocationChoiceMade(false);
            setRestaurants([]);
            setUserLocation(null);
            setSearchResults([]);
          }}
          variant="text"
          style={styles.backButton}
        />
        <Card variant="elevated" style={styles.manualInputCard}>
          <View style={styles.manualInputHeader}>
            <Text style={styles.manualInputTitle}>Enter Your Location</Text>
            <Text style={styles.manualInputSubtitle}>
              Enter either an address or coordinates to find nearby restaurants
            </Text>
          </View>
          
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Address</Text>
            <TextInput
              style={styles.textInput}
              value={manualAddress}
              onChangeText={setManualAddress}
              placeholder="e.g., 123 Main St, San Francisco, CA"
              placeholderTextColor={Colors.text.muted}
            />
          </View>
          
          <View style={styles.orDivider}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>OR</Text>
            <View style={styles.orLine} />
          </View>
          
          <View style={styles.coordsSection}>
            <Text style={styles.inputLabel}>Coordinates</Text>
            <View style={styles.coordsRow}>
              <TextInput
                style={[styles.textInput, styles.coordInput]}
                value={manualLat}
                onChangeText={setManualLat}
                placeholder="Latitude"
                placeholderTextColor={Colors.text.muted}
                keyboardType="numeric"
              />
              <TextInput
                style={[styles.textInput, styles.coordInput]}
                value={manualLng}
                onChangeText={setManualLng}
                placeholder="Longitude"
                placeholderTextColor={Colors.text.muted}
                keyboardType="numeric"
              />
            </View>
          </View>
          
          <View style={styles.buttonRow}>
            <Button
              title={loading ? 'Searching...' : 'Find Restaurants'}
              onPress={handleManualLocationSubmit}
              disabled={loading}
              variant="primary"
              style={styles.submitButton}
            />
            
            <Button
              title="Try Auto-Location Again"
              onPress={() => {
                setLoading(true); // Set loading before attempting to load restaurants
                setError(null);
                setManualAddress('');
                setManualLat('');
                setManualLng('');
                setShowManualInput(false);
                loadRestaurants();
              }}
              variant="outline"
              style={styles.retryButton}
            />
          </View>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  if (!locationChoiceMade && !showManualInput) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.background.primary} />
        <View style={styles.locationChoiceContainer}>
          <Card variant="elevated" style={styles.locationChoiceCard}>
            <Text style={styles.locationChoiceTitle}>How would you like to search?</Text>
            <Button
              title="Use My Current Location"
              onPress={() => {
                setLocationChoiceMade(true);
                setShowManualInput(false);
                setLoading(true); // Set loading before location fetch
              }}
              variant="primary"
              style={styles.locationChoiceButton}
            />
            <Button
              title="Enter Location Manually"
              onPress={() => {
                // Reset all state before showing manual input
                setLoading(false);
                setError(null);
                setManualAddress('');
                setManualLat('');
                setManualLng('');
                setShowManualInput(true);
                setLocationChoiceMade(false);
                setRestaurants([]);
                setUserLocation(null);
                setSearchResults([]);
                // Do NOT setLocationChoiceMade(true) here
              }}
              variant="outline"
              style={styles.locationChoiceButton}
            />
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  if (loading && !showManualInput) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.background.primary} />
        <LoadingIndicator message="Finding nearby restaurants..." />
      </SafeAreaView>
    );
  }

  if (loading && showManualInput) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.background.primary} />
        <LoadingIndicator message="Searching for restaurants..." />
      </SafeAreaView>
    );
  }

  if (error && showManualInput && locationChoiceMade) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.background.primary} />
        <ScrollView contentContainerStyle={styles.topScrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.errorCardWrapper}>
            <Card variant="outlined" style={styles.errorCard}>
              <Text style={styles.errorTitle}>Location Required</Text>
              <Text style={styles.errorMessage}>{error}</Text>
            </Card>
          </View>
          <View style={styles.manualCardWrapper}>
            {renderManualLocationInput()}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.background.primary} />
        <View style={styles.errorContainer}>
          <Card variant="outlined" style={styles.errorCard}>
            <Text style={styles.errorTitle}>Oops!</Text>
            <Text style={styles.errorMessage}>{error}</Text>
            <Button
              title="Enter Location Manually"
              onPress={() => setShowManualInput(true)}
              variant="primary"
              style={styles.manualLocationButton}
            />
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  if (showManualInput) {
    return renderManualLocationInput();
  }
  // Only show the results page if locationChoiceMade is true and showManualInput is false
  if (locationChoiceMade && !showManualInput) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.background.primary} />
        <View style={styles.header}>
          <Button
            title="←"
            onPress={() => {
              // Reset all state variables to allow a new search
              setLocationChoiceMade(false);
              setShowManualInput(false);
              setRestaurants([]);
              setLoading(false);
              setError(null);
              setUserLocation(null);
              setSearchResults([]);
              // Reset batch analysis state
              setSelectionMode(false);
              setSelectedRestaurants([]);
              setShowResults(false);
              setAnalysisResults([]);
            }}
            variant="text"
            style={styles.headerBackButton}
          />
          <View style={styles.headerContent}>
            <Text style={styles.title}>Nearby Restaurants</Text>
            <Text style={styles.subtitle}>
              {restaurants.length} restaurants found
            </Text>
          </View>
          <Button
            title="📚"
            onPress={() => router.push('/saved-restaurants')}
            variant="text"
            style={styles.savedReportsButton}
          />
        </View>
        <View style={styles.searchBarContainer}>
          <TextInput
            style={styles.searchBar}
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name or address..."
            placeholderTextColor={Colors.text.muted}
            returnKeyType="search"
          />
          {!selectionMode && !showResults && (
            <Button
              title="Batch Analyze"
              onPress={() => setSelectionMode(true)}
              variant="outline"
              size="small"
              style={styles.batchAnalyzeButton}
            />
          )}
          {selectionMode && (
            <Button
              title="Cancel"
              onPress={cancelSelectionMode}
              variant="text"
              size="small"
              style={styles.cancelButton}
            />
          )}
          {showResults && (
            <Button
              title="← Back to List"
              onPress={() => {
                setShowResults(false);
                setAnalysisResults([]);
              }}
              variant="text"
              size="small"
              style={styles.backToListButton}
            />
          )}
        </View>

        {/* Selection Mode Header */}
        {selectionMode && (
          <View style={styles.selectionHeader}>
            <Text style={styles.selectionTitle}>
              Select restaurants to analyze ({selectedRestaurants.length}/5)
            </Text>
            <Text style={styles.selectionSubtitle}>
              Choose up to 5 restaurants for detailed vegetarian analysis
            </Text>
          </View>
        )}

        {/* Analysis Results Header */}
        {showResults && (
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsTitle}>
              Analysis Results ({analysisResults.length} restaurants)
            </Text>
            <Text style={styles.resultsSubtitle}>
              Analyzed for "{vegCriteria}" vegetarian standard
            </Text>
          </View>
        )}

        {/* Restaurant List or Analysis Results */}
        {showResults ? (
          <FlatList
            data={analysisResults}
            renderItem={renderAnalysisResult}
            keyExtractor={(item) => item.restaurant.id}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <FlatList
            data={filteredRestaurants}
            renderItem={renderRestaurant}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[
              styles.listContainer,
              selectionMode && selectedRestaurants.length > 0 && styles.listContainerWithButton
            ]}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Batch Analysis Button */}
        {selectionMode && selectedRestaurants.length > 0 && (
          <View style={styles.batchActionContainer}>
            <Button
              title={isAnalyzing ? 'Analyzing...' : `Analyze ${selectedRestaurants.length} Restaurant${selectedRestaurants.length === 1 ? '' : 's'}`}
              onPress={startBatchAnalysis}
              variant="primary"
              disabled={isAnalyzing}
              style={styles.batchActionButton}
            />
          </View>
        )}

        {/* Loading Overlay for Analysis */}
        {isAnalyzing && (
          <View style={styles.loadingOverlay}>
            <Card style={styles.loadingCard}>
              <LoadingIndicator size="large" />
              <Text style={styles.loadingText}>Analyzing restaurants...</Text>
              <Text style={styles.loadingSubtext}>
                This may take a few moments as we analyze each menu
              </Text>
            </Card>
          </View>
        )}
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
  },
  
  header: {
    backgroundColor: Colors.primary[500],
    paddingVertical: Spacing.header.paddingVertical,
    paddingHorizontal: Spacing.header.paddingHorizontal,
    shadowColor: Colors.shadow.medium,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 4,
    paddingTop: Platform.select({ ios: 12, android: 24, default: 0 }),
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  title: {
    ...Typography.h3,
    color: Colors.text.inverse,
    textAlign: 'center',
  },
  
  subtitle: {
    ...Typography.body,
    color: Colors.text.inverse,
    textAlign: 'center',
    marginTop: Spacing.xs,
    opacity: 0.9,
  },
  
  listContainer: {
    padding: Spacing.list.containerPadding,
  },
  
  listContainerWithButton: {
    paddingBottom: 100, // Space for floating button
  },
  
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.container.padding,
  },
  
  errorCard: {
    alignItems: 'center',
    padding: Spacing.lg,
  },
  
  errorTitle: {
    ...Typography.h4,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  
  errorMessage: {
    ...Typography.body,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: Spacing.lg,
  },
  
  manualLocationButton: {
    marginTop: Spacing.sm,
  },
  
  manualInputContainer: {
    // Removed flex: 1 and justifyContent: 'center'
    paddingHorizontal: Spacing.container.padding,
    paddingVertical: Spacing.sm,
  },
  
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
  },
  
  manualInputCard: {
    padding: Spacing.md,
    marginTop: Spacing.md, // Add margin to separate from error card
  },
  
  manualInputHeader: {
    marginBottom: Spacing.md,
  },
  
  manualInputTitle: {
    ...Typography.h4,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  
  manualInputSubtitle: {
    ...Typography.body,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  
  inputSection: {
    marginBottom: Spacing.md,
  },
  
  inputLabel: {
    ...Typography.h6,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  
  textInput: {
    borderWidth: 1,
    borderColor: Colors.border.medium,
    borderRadius: 8,
    padding: Spacing.input.paddingVertical,
    paddingHorizontal: Spacing.input.paddingHorizontal,
    fontSize: Typography.body.fontSize,
    backgroundColor: Colors.background.primary,
    color: Colors.text.primary,
  },
  
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.md,
  },
  
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border.medium,
  },
  
  orText: {
    marginHorizontal: Spacing.md,
    fontSize: Typography.bodySmall.fontSize,
    color: Colors.text.tertiary,
    fontWeight: Typography.fontWeight.semibold,
  },
  
  coordsSection: {
    marginBottom: Spacing.md,
  },
  
  coordsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  
  coordInput: {
    flex: 1,
  },
  
  buttonRow: {
    gap: Spacing.xs,
  },
  
  submitButton: {
    marginBottom: Spacing.xs,
  },
  
  retryButton: {
    // Styles handled by Button component
  },
  searchBarContainer: {
    paddingHorizontal: Spacing.container.padding,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.background.secondary,
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  searchBar: {
    flex: 1,
    backgroundColor: Colors.background.primary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    paddingVertical: 10,
    paddingHorizontal: 16,
    fontSize: Typography.body.fontSize,
    color: Colors.text.primary,
  },
  advancedSearchButton: {
    paddingHorizontal: Spacing.md,
  },
  errorCardWrapper: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.container.padding,
  },
  manualCardWrapper: {
    paddingHorizontal: Spacing.container.padding,
  },
  topScrollContent: {
    paddingBottom: Spacing.lg,
  },
  locationChoiceContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.container.padding,
  },
  locationChoiceCard: {
    padding: Spacing.lg,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  locationChoiceTitle: {
    ...Typography.h4,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  locationChoiceButton: {
    width: '100%',
    marginBottom: Spacing.md,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: Spacing.sm,
  },
  headerBackButton: {
    marginRight: Spacing.md,
    marginLeft: -8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  
  savedReportsButton: {
    marginLeft: Spacing.md,
    marginRight: -8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  
  // Batch analysis styles
  batchAnalyzeButton: {
    paddingHorizontal: Spacing.md,
  },
  
  cancelButton: {
    paddingHorizontal: Spacing.sm,
  },
  
  backToListButton: {
    paddingHorizontal: Spacing.sm,
  },
  
  selectionHeader: {
    backgroundColor: Colors.primary[50] || Colors.background.secondary,
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  
  selectionTitle: {
    ...Typography.h6,
    color: Colors.text.primary,
    fontWeight: Typography.fontWeight.bold,
  },
  
  selectionSubtitle: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
    marginTop: Spacing.xs,
  },
  
  resultsHeader: {
    backgroundColor: Colors.success + '20',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  
  resultsTitle: {
    ...Typography.h6,
    color: Colors.text.primary,
    fontWeight: Typography.fontWeight.bold,
  },
  
  resultsSubtitle: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
    marginTop: Spacing.xs,
  },
  
  batchActionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.background.primary,
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
    shadowColor: Colors.shadow.medium,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  
  batchActionButton: {
    width: '100%',
  },
  
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  
  loadingCard: {
    margin: Spacing.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    maxWidth: 300,
  },
  
  loadingText: {
    ...Typography.h6,
    color: Colors.text.primary,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
  
  loadingSubtext: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
}); 