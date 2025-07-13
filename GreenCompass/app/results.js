import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Alert, SafeAreaView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import * as Location from 'expo-location';
import { getNearbyRestaurants } from '../services/googleMapsService';
import RestaurantListItem from '../components/RestaurantListItem';
import LoadingIndicator from '../components/LoadingIndicator';

export default function ResultsScreen() {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualAddress, setManualAddress] = useState('');
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');

  useEffect(() => {
    loadRestaurants();
  }, []);

  const geocodeAddress = async (address) => {
    try {
      console.log('🌍 Geocoding address:', address);
      const geocodeResult = await Location.geocodeAsync(address);
      
      if (geocodeResult.length > 0) {
        const { latitude, longitude } = geocodeResult[0];
        console.log('✅ Geocoded successfully:', { latitude, longitude });
        return { latitude, longitude };
      } else {
        throw new Error('Address not found');
      }
    } catch (error) {
      console.error('❌ Geocoding failed:', error);
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
      
      console.log('📍 Using manual location:', location.coords);
      
      // Proceed with restaurant search
      const nearbyRestaurants = await getNearbyRestaurants(location.coords);
      setRestaurants(nearbyRestaurants);
      setShowManualInput(false);
      
    } catch (error) {
      console.error('❌ Manual location error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadRestaurants = async () => {
    try {
      setLoading(true);
      setError(null);

      // Request location permission
      console.log('📍 Requesting location permission...');
      const { status } = await Location.requestForegroundPermissionsAsync();
      console.log('📍 Permission status:', status);
      
      if (status !== 'granted') {
        setError('Location permission denied. You can manually enter your location below.');
        setShowManualInput(true);
        setLoading(false);
        return;
      }

      // Check if location services are enabled
      const providerStatus = await Location.getProviderStatusAsync();
      console.log('📍 Location services enabled:', providerStatus.locationServicesEnabled);
      
      if (!providerStatus.locationServicesEnabled) {
        setError('Location services are disabled. You can manually enter your location below.');
        setShowManualInput(true);
        setLoading(false);
        return;
      }

      // Get current location with timeout and better accuracy
      console.log('📍 Getting current location...');
      let location;
      
      try {
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          timeout: 10000, // 10 seconds timeout
        });
        console.log('📍 Location obtained:', location.coords);
      } catch (locationError) {
        console.warn('📍 Failed to get current location, trying last known location:', locationError);
        
        // Try to get last known location as fallback
        try {
          location = await Location.getLastKnownPositionAsync({
            maxAge: 300000, // 5 minutes
            requiredAccuracy: 1000, // 1km accuracy
          });
          
          if (location) {
            console.log('📍 Using last known location:', location.coords);
          }
        } catch (lastKnownError) {
          console.error('📍 Failed to get last known location:', lastKnownError);
        }
        
        // If all else fails, offer manual input
        if (!location) {
          console.log('📍 All location methods failed, offering manual input');
          setError('Unable to get your location automatically. Please enter your location manually below.');
          setShowManualInput(true);
          setLoading(false);
          return;
        }
      }

      // Proceed with restaurant search
      const nearbyRestaurants = await getNearbyRestaurants(location.coords);
      setRestaurants(nearbyRestaurants);
      
    } catch (error) {
      console.error('❌ Error loading restaurants:', error);
      setError(`Failed to load restaurants: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const renderRestaurant = ({ item }) => (
    <RestaurantListItem restaurant={item} />
  );

  const renderManualLocationInput = () => (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.manualInputContainer}
    >
      <View style={styles.manualInputCard}>
        <Text style={styles.manualInputTitle}>Enter Your Location</Text>
        <Text style={styles.manualInputSubtitle}>
          Enter either an address or coordinates to find nearby restaurants
        </Text>
        
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Address (e.g., "123 Main St, San Francisco, CA")</Text>
          <TextInput
            style={styles.textInput}
            value={manualAddress}
            onChangeText={setManualAddress}
            placeholder="Enter your address"
            placeholderTextColor="#999"
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
              placeholderTextColor="#999"
              keyboardType="numeric"
            />
            <TextInput
              style={[styles.textInput, styles.coordInput]}
              value={manualLng}
              onChangeText={setManualLng}
              placeholder="Longitude"
              placeholderTextColor="#999"
              keyboardType="numeric"
            />
          </View>
        </View>
        
        <View style={styles.buttonRow}>
          <TouchableOpacity 
            style={styles.submitButton} 
            onPress={handleManualLocationSubmit}
            disabled={loading}
          >
            <Text style={styles.submitButtonText}>
              {loading ? 'Searching...' : 'Find Restaurants'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={() => {
              setShowManualInput(false);
              loadRestaurants();
            }}
          >
            <Text style={styles.retryButtonText}>Try Auto-Location Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );

  if (loading && !showManualInput) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingIndicator message="Finding nearby restaurants..." />
      </SafeAreaView>
    );
  }

  if (error && showManualInput) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Location Required</Text>
          <Text style={styles.errorMessage}>{error}</Text>
        </View>
        {renderManualLocationInput()}
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Oops!</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity 
            style={styles.manualLocationButton} 
            onPress={() => setShowManualInput(true)}
          >
            <Text style={styles.manualLocationButtonText}>Enter Location Manually</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Nearby Restaurants</Text>
        <Text style={styles.subtitle}>
          {restaurants.length} restaurants found
        </Text>
      </View>

      <FlatList
        data={restaurants}
        renderItem={renderRestaurant}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#4CAF50',
    padding: 20,
    paddingTop: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'white',
    textAlign: 'center',
    marginTop: 5,
    opacity: 0.9,
  },
  listContainer: {
    padding: 10,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 10,
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  manualLocationButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  manualLocationButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  manualInputContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  manualInputCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  manualInputTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  manualInputSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  inputSection: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ddd',
  },
  orText: {
    marginHorizontal: 15,
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  coordsSection: {
    marginBottom: 20,
  },
  coordsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  coordInput: {
    flex: 1,
  },
  buttonRow: {
    gap: 10,
  },
  submitButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  retryButton: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
}); 