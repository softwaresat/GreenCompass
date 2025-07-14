import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Alert, TextInput, KeyboardAvoidingView, Platform, StatusBar, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { getNearbyRestaurants, searchRestaurantsByText } from '../services/googleMapsService';
import RestaurantListItem from '../components/RestaurantListItem';
import LoadingIndicator from '../components/LoadingIndicator';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Colors from '../constants/Colors';
import Typography from '../constants/Typography';
import Spacing from '../constants/Spacing';

export default function ResultsScreen() {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualAddress, setManualAddress] = useState('');
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [locationChoiceMade, setLocationChoiceMade] = useState(false);

  useEffect(() => {
    if (locationChoiceMade && !showManualInput && restaurants.length === 0) {
      loadRestaurants();
    }
  }, [locationChoiceMade, showManualInput]);

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
        setLoading(false);
        return;
      }

      // Check if location services are enabled
      const providerStatus = await Location.getProviderStatusAsync();
      
      if (!providerStatus.locationServicesEnabled) {
        setError('Location services are disabled. You can manually enter your location below.');
        setShowManualInput(true);
        setLoading(false);
        return;
      }

      // Get current location with timeout and better accuracy
      let location;
      
      try {
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          timeout: 10000, // 10 seconds timeout
        });
      } catch (locationError) {
        
        // Try to get last known location as fallback
        try {
          location = await Location.getLastKnownPositionAsync({
            maxAge: 300000, // 5 minutes
            requiredAccuracy: 1000, // 1km accuracy
          });
          
          if (location) {
          }
        } catch (lastKnownError) {
        }
        
        // If all else fails, offer manual input
        if (!location) {
          setError('Unable to get your location automatically. Please enter your location manually below.');
          setShowManualInput(true);
          setLoading(false);
          return;
        }
      }

      // Proceed with restaurant search
      const nearbyRestaurants = await getNearbyRestaurants(location.coords);
      setRestaurants(nearbyRestaurants);
      setUserLocation(location.coords);
      setSearchResults([]); // Reset search results
      
    } catch (error) {
      setError(`Failed to load restaurants: ${error.message}`);
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

  const renderRestaurant = ({ item }) => (
    <RestaurantListItem restaurant={item} />
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
            setLoading(false);
            setError(null);
            setManualAddress('');
            setManualLat('');
            setManualLng('');
            setShowManualInput(false);
            setLocationChoiceMade(false);
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
                setLoading(false);
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
              }}
              variant="primary"
              style={styles.locationChoiceButton}
            />
            <Button
              title="Enter Location Manually"
              onPress={() => {
                setLoading(false);
                setError(null);
                setManualAddress('');
                setManualLat('');
                setManualLng('');
                setShowManualInput(true);
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
              setLocationChoiceMade(false);
              setShowManualInput(false);
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
        </View>
        <FlatList
          data={filteredRestaurants}
          renderItem={renderRestaurant}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
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
  },
  searchBar: {
    backgroundColor: Colors.background.primary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    paddingVertical: 10,
    paddingHorizontal: 16,
    fontSize: Typography.body.fontSize,
    color: Colors.text.primary,
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
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
}); 