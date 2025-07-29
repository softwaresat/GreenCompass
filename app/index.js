import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, RefreshControl, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import SavedRestaurantReport from '../components/SavedRestaurantReport';
import Button from '../components/ui/Button';
import Colors from '../constants/Colors';
import Spacing from '../constants/Spacing';
import Typography from '../constants/Typography';
import savedReportsService from '../services/savedReportsService';

export default function HomeScreen() {
  const router = useRouter();
  const [savedReports, setSavedReports] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadSavedReports = async () => {
    try {
      const reports = await savedReportsService.getSavedReports();
      setSavedReports(reports);
    } catch (error) {
      console.error('Error loading saved reports:', error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadSavedReports();
    setIsRefreshing(false);
  };

  const handleRemoveSavedReport = async (reportId) => {
    try {
      Alert.alert(
        'Remove Saved Report',
        'Are you sure you want to remove this saved restaurant report?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              await savedReportsService.removeSavedReport(reportId);
              await loadSavedReports();
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error removing saved report:', error);
    }
  };

  const handleRegenerateSavedReport = async (report) => {
    Alert.alert(
      'Regenerate Analysis',
      `Get fresh analysis data for "${report.restaurant.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Regenerate',
          onPress: () => {
                    router.push({
          pathname: '/analysis',
          params: {
            id: report.restaurantId,
            name: report.restaurant.name,
            vicinity: report.restaurant.vicinity || '',
            regenerate: 'true', // Flag to auto-save after regeneration
          },
            });
          },
        },
      ]
    );
  };

  const handleFindRestaurants = () => {
    router.push('/results');
  };

  // Load saved reports when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadSavedReports();
    }, [])
  );

  const renderSavedReport = ({ item }) => (
    <SavedRestaurantReport
      report={item}
      onRemove={handleRemoveSavedReport}
      onRegenerate={handleRegenerateSavedReport}
    />
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary[600]} />
      
      <ScrollView
        style={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.text.inverse}
            title="Pull to refresh saved reports"
            titleColor={Colors.text.inverse}
          />
        }
      >
        <LinearGradient
          colors={[Colors.primary[600], Colors.primary[500]]}
          style={styles.gradientBackground}
        >
          <View style={styles.content}>
            {/* Hero Section */}
            <View style={styles.heroSection}>
              <View style={styles.logoContainer}>
                <View style={styles.logoBackground}>
                  <Text style={styles.logoText}>🌱</Text>
                </View>
              </View>
              
              <Text style={styles.title}>GreenCompass</Text>
              <Text style={styles.subtitle}>
                Find vegetarian-friendly restaurants near you
              </Text>
            </View>

            {/* CTA Section */}
            <View style={styles.ctaSection}>
              <Button
                title="Find Restaurants"
                onPress={handleFindRestaurants}
                style={styles.ctaButton}
                textStyle={styles.ctaButtonText}
              />
              
              <Text style={styles.ctaSubtext}>
                Find restaurants, analyze menus, and discover vegetarian options with our intelligent search
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* Features Section */}
        <View style={styles.featuresSection}>
          <Text style={styles.featuresTitle}>Features</Text>
          
          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>🗺️</Text>
            <Text style={styles.featureText}>Find restaurants near you</Text>
          </View>
          
          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>🌱</Text>
            <Text style={styles.featureText}>AI-powered vegetarian detection</Text>
          </View>
          
          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>📱</Text>
            <Text style={styles.featureText}>Real-time menu analysis</Text>
          </View>

          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>🔖</Text>
            <Text style={styles.featureText}>Save & bookmark favorite findings</Text>
          </View>

          {/* Add access to saved restaurants if user has any */}
          {savedReports.length > 0 && (
            <View style={styles.savedAccessSection}>
              <Button
                title={`📚 View Saved Restaurants (${savedReports.length})`}
                onPress={() => router.push('/saved-restaurants')}
                style={styles.savedAccessButton}
                textStyle={styles.savedAccessButtonText}
              />
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  
  scrollContainer: {
    flex: 1,
  },
  
  gradientBackground: {
    minHeight: '60%',
  },
  
  content: {
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.container.padding,
    paddingTop: 60, // Extra top padding for camera cutout clearance
    paddingBottom: Spacing.lg,
    minHeight: 400,
  },
  
  heroSection: {
    alignItems: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
  },
  
  logoContainer: {
    marginBottom: Spacing.lg,
  },
  
  logoBackground: {
    width: 80,
    height: 80,
    backgroundColor: Colors.background.primary,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.shadow.dark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  
  logoText: {
    fontSize: 36,
  },
  
  title: {
    ...Typography.h1,
    color: Colors.text.inverse,
    textAlign: 'center',
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.sm,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  
  subtitle: {
    ...Typography.body,
    color: Colors.text.inverse,
    textAlign: 'center',
    opacity: 0.9,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  
  ctaSection: {
    alignItems: 'center',
  },
  
  ctaButton: {
    backgroundColor: Colors.background.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderRadius: 12,
    shadowColor: Colors.shadow.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    marginBottom: Spacing.md,
  },
  
  ctaButtonText: {
    ...Typography.h3,
    color: Colors.primary[600],
    fontWeight: Typography.fontWeight.bold,
  },
  
  ctaSubtext: {
    ...Typography.bodySmall,
    color: Colors.text.inverse,
    textAlign: 'center',
    opacity: 0.8,
    maxWidth: 300,
    lineHeight: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  
  // Features Section
  featuresSection: {
    backgroundColor: Colors.background.primary,
    paddingHorizontal: Spacing.container.padding,
    paddingVertical: Spacing.xl,
  },
  
  featuresTitle: {
    ...Typography.h3,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  
  featureIcon: {
    fontSize: 20,
    marginRight: Spacing.md,
    width: 28,
    textAlign: 'center',
  },
  
  featureText: {
    ...Typography.body,
    color: Colors.text.primary,
    flex: 1,
  },

  savedAccessSection: {
    marginTop: Spacing.lg,
    alignItems: 'center',
  },

  savedAccessButton: {
    backgroundColor: Colors.accent.orange,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: 8,
  },

  savedAccessButtonText: {
    color: Colors.text.inverse,
    fontWeight: Typography.fontWeight.medium,
  },
});
