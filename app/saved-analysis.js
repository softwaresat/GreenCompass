import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
    Alert,
    Linking,
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import LoadingIndicator from '../components/LoadingIndicator';
import MenuResults from '../components/MenuResults';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Spacing';
import { Typography } from '../constants/Typography';
import savedReportsService from '../services/savedReportsService';

export default function SavedAnalysisScreen() {
  const router = useRouter();
  const { reportId, restaurantId, name, vicinity } = useLocalSearchParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadSavedReport();
  }, [reportId]);

  const loadSavedReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const savedReport = await savedReportsService.getSavedReportByRestaurant(restaurantId);
      if (savedReport) {
        setReport(savedReport);
      } else {
        setError('This saved report could not be loaded.');
      }
    } catch (error) {
      console.error('Error loading saved report:', error);
      setError('Failed to load saved analysis data.');
    } finally {
      setLoading(false);
    }
  };

  const handleGetDirections = () => {
    if (!report || !report.restaurant) return;
    
    // Try to use location from saved data
    const location = report.restaurant.location || report.analysis?.scrapingInfo?.location;
    
    if (location && location.latitude && location.longitude) {
      const label = encodeURIComponent(report.restaurant.name || 'Restaurant');
      const latLng = `${location.latitude},${location.longitude}`;
      let url = '';
      if (Platform.OS === 'ios') {
        url = `http://maps.apple.com/?ll=${latLng}&q=${label}`;
      } else {
        url = `https://www.google.com/maps/search/?api=1&query=${latLng}(${label})`;
      }
      Linking.openURL(url);
    } else {
      // Fallback to text-based search
      const query = encodeURIComponent(`${report.restaurant.name} ${report.restaurant.vicinity || ''}`);
      const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
      Linking.openURL(url);
    }
  };

  const handleRegenerateAnalysis = () => {
    Alert.alert(
      'Regenerate Analysis',
      'This will get fresh analysis data and may overwrite your saved report. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Regenerate',
          onPress: () => {
            router.replace({
              pathname: '/analysis',
              params: { id: restaurantId, name, vicinity },
            });
          },
        },
      ]
    );
  };

  const handleRetryLoad = () => {
    loadSavedReport();
  };

  // Convert saved report data to match the format expected by MenuResults
  const convertToMenuResults = (savedReport) => {
    if (!savedReport || !savedReport.analysis) return null;

    return {
      restaurantName: savedReport.restaurant.name,
      restaurantId: savedReport.restaurantId,
      restaurantInfo: {
        name: savedReport.restaurant.name,
        vicinity: savedReport.restaurant.vicinity,
        rating: savedReport.restaurant.rating,
        priceLevel: savedReport.restaurant.priceLevel,
        location: savedReport.restaurant.location,
        website: savedReport.restaurant.website,
        latitude: savedReport.restaurant.location?.latitude,
        longitude: savedReport.restaurant.location?.longitude,
      },
      
      // Menu analysis results
      menuAnalysis: savedReport.analysis.menuAnalysis || {
        summary: savedReport.analysis.summary,
        vegetarianItems: savedReport.analysis.vegetarianItems || [],
        restaurantVegFriendliness: savedReport.analysis.vegFriendliness,
        totalItems: savedReport.analysis.totalItems || 0,
        confidence: savedReport.analysis.confidence || 0,
        recommendations: savedReport.analysis.recommendations || [],
      },
      
      enhancedMenuItems: savedReport.analysis.enhancedMenuItems || [],
      vegetarianItems: savedReport.analysis.vegetarianItems || [],
      
      // Overall assessment
      totalItems: savedReport.analysis.totalItems || 0,
      analysisDate: savedReport.analysis.analysisDate || savedReport.savedAt,
      overallRating: savedReport.analysis.vegFriendliness,
      confidence: savedReport.analysis.confidence || 0,
      
      // Recommendations
      recommendations: savedReport.analysis.recommendations || [],
      
      // Additional info
      scrapingInfo: savedReport.analysis.scrapingInfo,
      websiteUrl: savedReport.restaurant.website,
    };
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background.primary} />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Menu Analysis</Text>
          <Text style={styles.restaurantName} numberOfLines={1} ellipsizeMode="tail">
            {name}
          </Text>
        </View>
      </View>

      {/* Action Buttons - only show when we have a valid report */}
      {report && (
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleGetDirections}
            activeOpacity={0.8}
          >
            <View style={styles.buttonContent}>
              <Text style={styles.buttonIcon}>🧭</Text>
              <Text style={styles.buttonText}>Get Directions</Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleRegenerateAnalysis}
            activeOpacity={0.8}
          >
            <View style={styles.buttonContent}>
              <Text style={styles.buttonIcon}>🔄</Text>
              <Text style={styles.buttonText}>Regenerate</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.content}>
        {loading && (
          <LoadingIndicator 
            message="Loading saved analysis..."
            stage="Retrieving saved data..."
          />
        )}

        {error && (
          <View style={styles.errorContainer}>
            <Card variant="outlined" style={styles.errorCard}>
              <Text style={styles.errorTitle}>Failed to Load</Text>
              <Text style={styles.errorMessage}>{error}</Text>
              <Button 
                title="Try Again" 
                onPress={handleRetryLoad}
                variant="primary"
                style={styles.retryButton}
              />
            </Card>
          </View>
        )}

        {report && !loading && (
          <MenuResults 
            results={convertToMenuResults(report)}
            onRetry={handleRegenerateAnalysis}
            savedData={true}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
  },
  
  header: {
    backgroundColor: Colors.primary[500],
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    shadowColor: Colors.shadow.medium,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 4,
    paddingTop: 60, // Extra padding for camera cutout clearance
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 70,
  },
  
  title: {
    ...Typography.body,
    color: Colors.text.inverse,
    textAlign: 'center',
    fontWeight: Typography.fontWeight.bold,
    fontSize: 16,
  },
  
  restaurantName: {
    ...Typography.bodySmall,
    color: Colors.text.inverse,
    textAlign: 'center',
    opacity: 0.9,
    marginTop: 2,
  },

  backButton: {
    position: 'absolute',
    left: 16,
    top: 70, // Position it properly within the header area
    padding: 8,
  },
  
  backButtonText: {
    fontSize: 22,
    color: Colors.text.inverse,
    fontWeight: 'bold',
  },
  
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  
  actionButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  
  actionButton: {
    flex: 1,
    maxWidth: 160,
    height: 48,
    backgroundColor: Colors.success,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.shadow.medium,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  
  buttonIcon: {
    fontSize: 18,
  },
  
  buttonText: {
    ...Typography.bodySmall,
    color: Colors.text.inverse,
    fontWeight: Typography.fontWeight.bold,
  },
  
  content: {
    flex: 1,
  },
  
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  
  errorCard: {
    padding: Spacing.lg,
  },
  
  errorTitle: {
    ...Typography.h3,
    color: Colors.error,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  
  errorMessage: {
    ...Typography.body,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    lineHeight: 24,
  },
  
  retryButton: {
    alignSelf: 'center',
  },
});
