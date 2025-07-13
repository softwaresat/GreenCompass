import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { analyzeRestaurantWebsite } from '../services/googleMapsService';
import LoadingIndicator from '../components/LoadingIndicator';
import MenuResults from '../components/MenuResults';

export default function AnalysisScreen() {
  const { name, id } = useLocalSearchParams();
  const [loading, setLoading] = useState(false);
  const [analysisStage, setAnalysisStage] = useState('idle');
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
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
      console.log('Starting website analysis for restaurant:', name, id);
      
      // Update progress: restaurant details
      setProgress(prev => ({ ...prev, restaurantDetails: true }));
      
      // The analyzeRestaurantWebsite function handles everything
      const analysisResults = await analyzeRestaurantWebsite(id);
      console.log('Website analysis results:', analysisResults);
      
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

      console.log('Final results compiled:', finalResults);
      setResults(finalResults);

    } catch (error) {
      console.error('Analysis error:', error);
      setError(error.message || 'An error occurred during analysis');
      setProgress(prev => ({ ...prev, complete: true }));
    } finally {
      setLoading(false);
    }
  };

  const handleRetryAnalysis = () => {
    handleAnalyzeMenu();
  };

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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Menu Analysis</Text>
        <Text style={styles.restaurantName}>{name}</Text>
      </View>

      <View style={styles.content}>
        {loading && (
          <LoadingIndicator 
            message={getProgressText()}
            progress={getProgressSteps()}
            stage={analysisStage}
          />
        )}

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>Analysis Failed</Text>
            <Text style={styles.errorMessage}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleRetryAnalysis}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
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
  restaurantName: {
    fontSize: 18,
    color: 'white',
    textAlign: 'center',
    marginTop: 5,
    opacity: 0.9,
  },
  content: {
    flex: 1,
  },
  errorContainer: {
    margin: 20,
    padding: 20,
    backgroundColor: '#ffebee',
    borderRadius: 8,
    borderColor: '#f44336',
    borderWidth: 1,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#d32f2f',
    marginBottom: 10,
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    marginBottom: 15,
    lineHeight: 22,
  },
  retryButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
    alignSelf: 'flex-start',
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 