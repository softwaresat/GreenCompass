import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Alert, Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LoadingIndicator from '../components/LoadingIndicator';
import MenuResults from '../components/MenuResults';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Spacing';
import { Typography } from '../constants/Typography';
import { analyzeRestaurantWebsite } from '../services/googleMapsService';
import savedReportsService from '../services/savedReportsService';

export default function AnalysisScreen() {
  const { name, id, vicinity, regenerate } = useLocalSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [analysisStage, setAnalysisStage] = useState('idle');
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [isSaved, setIsSaved] = useState(false);
  const [savingReport, setSavingReport] = useState(false);
  const [progress, setProgress] = useState({
    restaurantDetails: false,
    websiteScraping: false,
    menuAnalysis: false,
    complete: false
  });

  useEffect(() => {
    // Auto-start analysis when component mounts
    if (id && !loading && !results && !error) {
      handleAnalyzeMenu();
    }
  }, [id]);

  const handleAnalyzeMenu = async () => {
    try {
      setLoading(true);
      setError(null);
      setResults(null);
      setProgress({ 
        restaurantDetails: false, 
        websiteScraping: false, 
        menuAnalysis: false, 
        complete: false 
      });

      // Stage 1: Start website analysis
      setAnalysisStage('Getting restaurant details and website...');
      
      // Update progress: restaurant details
      setProgress(prev => ({ ...prev, restaurantDetails: true }));
      
      // The analyzeRestaurantWebsite function handles everything
      const analysisResults = await analyzeRestaurantWebsite(id);
      
      // Update progress based on what was actually analyzed
      setProgress({
        restaurantDetails: true,
        websiteScraping: analysisResults.success,
        menuAnalysis: analysisResults.success && analysisResults.menuAnalysis?.vegetarianItems?.length > 0,
        complete: true
      });

      // Check if analysis was successful
      if (!analysisResults.success) {
        setError(analysisResults.error || 'Failed to analyze restaurant website');
        return;
      }

      // Check if we have meaningful results
      const hasResults = analysisResults.menuAnalysis?.vegetarianItems?.length > 0;

      // Compile final results for the UI
      const finalResults = {
        restaurantName: name,
        restaurantId: id,
        restaurantInfo: analysisResults.restaurantInfo,
        
        // Website scraping results
        scrapingInfo: analysisResults.scrapingInfo,
        websiteUrl: analysisResults.restaurantInfo?.website,
        
        // Menu analysis results
        menuAnalysis: analysisResults.menuAnalysis,
        enhancedMenuItems: analysisResults.enhancedMenuItems || [],
        vegetarianItems: analysisResults.menuAnalysis?.vegetarianItems || [],
        
        // Overall assessment
        totalItems: analysisResults.menuAnalysis?.totalItems || 0,
        analysisDate: new Date().toISOString(),
        overallRating: analysisResults.menuAnalysis?.restaurantVegFriendliness || 'unknown',
        confidence: analysisResults.menuAnalysis?.confidence || 0,
        
        // Recommendations
        recommendations: analysisResults.menuAnalysis?.recommendations || [],
        
        // Legacy compatibility for MenuResults component
        menuItems: analysisResults.menuAnalysis?.vegetarianItems || [],
        veganItems: analysisResults.menuAnalysis?.vegetarianItems?.filter(item => item.isVegan) || [],
        reviewInsights: [], // Not used in website approach
        combinedAnalysis: {
          vegetarianItems: analysisResults.menuAnalysis?.vegetarianItems || [],
          summary: analysisResults.menuAnalysis?.summary || '',
          confidence: analysisResults.menuAnalysis?.confidence || 0,
          recommendations: analysisResults.menuAnalysis?.recommendations || []
        }
      };

      // Set success message based on results
      if (hasResults) {
        setAnalysisStage(`Found ${finalResults.vegetarianItems.length} vegetarian options!`);
      } else {
        setAnalysisStage('Analysis complete - Limited vegetarian options found');
      }

      setResults(finalResults);

    } catch (error) {
      setError(error.message || 'An error occurred during analysis');
      setProgress(prev => ({ ...prev, complete: true }));
    } finally {
      setLoading(false);
    }
  };

  const handleRetryAnalysis = () => {
    handleAnalyzeMenu();
  };

  const handleSaveReport = async () => {
    if (!results) return;
    
    try {
      setSavingReport(true);
      
      const reportData = {
        restaurant: {
          id: id,
          name: name,
          vicinity: vicinity || results.restaurantInfo?.vicinity || '',
          rating: results.restaurantInfo?.rating,
          priceLevel: results.restaurantInfo?.priceLevel,
          location: results.restaurantInfo?.location,
          website: results.restaurantInfo?.website,
        },
        analysis: {
          // Complete analysis results
          vegFriendliness: results.overallRating,
          vegetarianCount: results.vegetarianItems?.length || 0,
          totalItems: results.totalItems || 0,
          summary: results.menuAnalysis?.summary || '',
          confidence: results.confidence || 0,
          recommendations: results.recommendations || [],
          
          // Full vegetarian items data
          vegetarianItems: results.vegetarianItems || [],
          enhancedMenuItems: results.enhancedMenuItems || [],
          
          // Additional analysis data
          menuAnalysis: results.menuAnalysis,
          scrapingInfo: results.scrapingInfo,
          analysisDate: results.analysisDate,
        },
        vegCriteria: 'standard', // Could be made dynamic
        savedAt: new Date().toISOString(),
      };

      await savedReportsService.saveRestaurantReport(reportData);
      setIsSaved(true);
      
      Alert.alert(
        'Report Saved! 🎉',
        'This restaurant analysis has been bookmarked and will appear on your home screen. Tap the 📚 icon in the top-right of restaurant lists to quickly access all your saved reports.',
        [{ text: 'Got it!' }]
      );
    } catch (error) {
      console.error('Error saving report:', error);
      Alert.alert('Save Failed', 'Could not save the restaurant report. Please try again.');
    } finally {
      setSavingReport(false);
    }
  };

  const handleRemoveSavedReport = async () => {
    try {
      setSavingReport(true);
      await savedReportsService.removeSavedReportByRestaurant(id);
      setIsSaved(false);
      
      Alert.alert(
        'Report Removed',
        'This restaurant report has been removed from your bookmarks.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error removing report:', error);
      Alert.alert('Remove Failed', 'Could not remove the saved report. Please try again.');
    } finally {
      setSavingReport(false);
    }
  };

  // Check if report is already saved
  useEffect(() => {
    const checkSavedStatus = async () => {
      if (id) {
        try {
          const hasSaved = await savedReportsService.hasSavedReport(id);
          setIsSaved(hasSaved);
        } catch (error) {
          console.error('Error checking saved status:', error);
        }
      }
    };
    
    checkSavedStatus();
  }, [id, results]);

  const getProgressText = () => {
    if (progress.complete) {
      return loading ? 'Finalizing results...' : 'Analysis complete';
    }
    if (progress.menuAnalysis) {
      return 'Analyzing menu for vegetarian options...';
    }
    if (progress.websiteScraping) {
      return 'Scraping restaurant website for menu...';
    }
    if (progress.restaurantDetails) {
      return 'Getting restaurant details...';
    }
    return 'Starting analysis...';
  };

  const getProgressSteps = () => [
    { key: 'restaurantDetails', label: 'Restaurant Details', completed: progress.restaurantDetails },
    { key: 'websiteScraping', label: 'Website Scraping', completed: progress.websiteScraping },
    { key: 'menuAnalysis', label: 'Menu Analysis', completed: progress.menuAnalysis },
    { key: 'complete', label: 'Complete', completed: progress.complete }
  ];

  // Helper to open directions in maps
  const handleGetDirections = () => {
    if (!results || !results.restaurantInfo) return;
    const { latitude, longitude, name: placeName } = results.restaurantInfo;
    if (latitude && longitude) {
      const label = encodeURIComponent(placeName || 'Restaurant');
      const latLng = `${latitude},${longitude}`;
      let url = '';
      if (Platform.OS === 'ios') {
        url = `http://maps.apple.com/?ll=${latLng}&q=${label}`;
      } else {
        url = `https://www.google.com/maps/search/?api=1&query=${latLng}(${label})`;
      }
      Linking.openURL(url);
    }
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
      {/* Action Buttons */}
      {results && results.restaurantInfo && (
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
            style={[
              styles.actionButton,
              savingReport && styles.buttonDisabled
            ]}
            onPress={isSaved ? handleRemoveSavedReport : handleSaveReport}
            disabled={savingReport}
            activeOpacity={0.8}
          >
            <View style={styles.buttonContent}>
              <Text style={styles.buttonIcon}>
                {savingReport ? '⏳' : isSaved ? '✅' : '🔖'}
              </Text>
              <Text style={styles.buttonText}>
                {savingReport ? 'Saving...' : isSaved ? 'Saved!' : 'Save Report'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.content}>
        {loading && (
          <LoadingIndicator 
            message={getProgressText()}
            stage={analysisStage}
          />
        )}

        {error && (
          <View style={styles.errorContainer}>
            <Card variant="outlined" style={styles.errorCard}>
              <Text style={styles.errorTitle}>Analysis Failed</Text>
              <Text style={styles.errorMessage}>{error}</Text>
              <Button 
                title="Try Again" 
                onPress={handleRetryAnalysis}
                variant="primary"
                style={styles.retryButton}
              />
            </Card>
          </View>
        )}

        {results && !loading && (
          <MenuResults 
            results={results}
            onRetry={handleRetryAnalysis}
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
    top: 45, // Positioned higher in the header
    padding: 8,
    zIndex: 10, // Ensure it's visible above other elements
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
  
  content: {
    flex: 1,
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
    marginBottom: Spacing.lg,
    lineHeight: 22,
    textAlign: 'center',
  },
  
  retryButton: {
    marginTop: Spacing.sm,
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
  
  buttonDisabled: {
    opacity: 0.6,
    backgroundColor: Colors.background.tertiary,
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
}); 