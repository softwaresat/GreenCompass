import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Spacing';
import { Typography } from '../constants/Typography';
import savedReportsService from '../services/savedReportsService';

export default function SavedRestaurantsScreen() {
  const router = useRouter();
  const [savedReports, setSavedReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadSavedReports = useCallback(async () => {
    try {
      const reports = await savedReportsService.getSavedReports();
      setSavedReports(reports);
    } catch (error) {
      console.error('Error loading saved reports:', error);
      Alert.alert('Error', 'Failed to load saved restaurants');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSavedReports();
  }, [loadSavedReports]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSavedReports();
    setRefreshing(false);
  }, [loadSavedReports]);

  const handleRestaurantPress = (report) => {
    // Navigate to analysis screen with saved data
    router.push({
      pathname: '/saved-analysis',
      params: {
        reportId: report.id,
        restaurantId: report.restaurantId,
        name: report.restaurant.name,
        vicinity: report.restaurant.vicinity || '',
      },
    });
  };

  const handleRemoveReport = async (report) => {
    Alert.alert(
      'Remove Saved Report',
      `Remove "${report.restaurant.name}" from your saved restaurants?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await savedReportsService.removeSavedReport(report.id);
              await loadSavedReports(); // Refresh the list
            } catch (error) {
              console.error('Error removing report:', error);
              Alert.alert('Error', 'Failed to remove saved restaurant');
            }
          },
        },
      ]
    );
  };

  const handleRegenerateReport = async (report) => {
    Alert.alert(
      'Regenerate Analysis',
      `Get fresh analysis data for "${report.restaurant.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Regenerate',
          onPress: () => {
            // Navigate to analysis screen to regenerate
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


  const renderRestaurantItem = ({ item: report }) => (
    <View style={styles.reportCard}>
      <TouchableOpacity
        style={styles.reportHeader}
        onPress={() => handleRestaurantPress(report)}
      >
        <View style={styles.restaurantInfo}>
          <Text style={styles.restaurantName}>{report.restaurant.name}</Text>
          <Text style={styles.restaurantVicinity}>{report.restaurant.vicinity}</Text>
          <View style={styles.analysisInfo}>
          </View>
          <Text style={styles.savedDate}>
            Saved {new Date(report.savedAt).toLocaleDateString()}
          </Text>
        </View>
        <View style={styles.arrowContainer}>
          <Text style={styles.arrow}>›</Text>
        </View>
      </TouchableOpacity>
      
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.regenerateButton]}
          onPress={() => handleRegenerateReport(report)}
        >
          <Text style={styles.regenerateButtonText}>🔄 Regenerate</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.removeButton]}
          onPress={() => handleRemoveReport(report)}
        >
          <Text style={styles.removeButtonText}>🗑️ Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.background.primary} />
        
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => router.back()}
            activeOpacity={0.7} // Add feedback when pressed
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.title}>Saved Restaurants</Text>
          </View>
        </View>
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary[500]} />
          <Text style={styles.loadingText}>Loading saved restaurants...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background.primary} />
      
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
          activeOpacity={0.7} // Add feedback when pressed
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Saved Restaurants</Text>
        </View>
      </View>

      {savedReports.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>📚</Text>
          <Text style={styles.emptyTitle}>No Saved Restaurants</Text>
          <Text style={styles.emptyDescription}>
            When you analyze and save restaurants, they'll appear here with all their analysis data ready to view.
          </Text>
          <TouchableOpacity
            style={styles.searchButton}
            onPress={() => router.push('/')}
          >
            <Text style={styles.searchButtonText}>Start Searching</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={savedReports}
          keyExtractor={(item) => item.id}
          renderItem={renderRestaurantItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Colors.primary[500]]}
            />
          }
        />
      )}
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
    paddingTop: 60, // Reduced padding for better back button positioning
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 80, // Adjusted height
    justifyContent: 'center', // Center the header content
  },
  
  title: {
    ...Typography.body,
    color: Colors.text.inverse,
    textAlign: 'center',
    fontWeight: Typography.fontWeight.bold,
    fontSize: 16,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  loadingText: {
    ...Typography.body,
    color: Colors.text.secondary,
    marginTop: Spacing.md,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    ...Typography.h2,
    color: Colors.text.primary,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  emptyDescription: {
    ...Typography.body,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 24,
  },
  searchButton: {
    backgroundColor: Colors.primary[500],
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 12,
    elevation: 2,
  },
  searchButtonText: {
    ...Typography.body,
    color: Colors.text.inverse,
    fontWeight: Typography.fontWeight.bold,
  },
  listContainer: {
    padding: Spacing.lg,
  },
  reportCard: {
    backgroundColor: Colors.background.secondary,
    borderRadius: 12,
    marginBottom: Spacing.md,
    elevation: 2,
    shadowColor: Colors.shadow.light,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  restaurantInfo: {
    flex: 1,
  },
  restaurantName: {
    ...Typography.h3,
    color: Colors.text.primary,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.xs,
  },
  restaurantVicinity: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
    marginBottom: Spacing.sm,
  },
  analysisInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
    gap: Spacing.md,
  },
  vegRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 16,
    gap: Spacing.xs,
  },
  vegRatingEmoji: {
    fontSize: 12,
  },
  vegRatingText: {
    ...Typography.bodySmall,
    color: Colors.text.inverse,
    fontWeight: Typography.fontWeight.bold,
    fontSize: 10,
  },
  vegetarianCount: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
  },
  savedDate: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
    fontSize: 11,
  },
  arrowContainer: {
    marginLeft: Spacing.md,
  },
  arrow: {
    ...Typography.h2,
    color: Colors.text.tertiary,
    fontWeight: Typography.fontWeight.light,
  },
  actionButtons: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  actionButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  regenerateButton: {
    borderRightWidth: 1,
    borderRightColor: Colors.border.light,
  },
  regenerateButtonText: {
    ...Typography.bodySmall,
    color: Colors.primary[600],
    fontWeight: Typography.fontWeight.medium,
  },
  removeButton: {},
  removeButtonText: {
    ...Typography.bodySmall,
    color: Colors.error,
    fontWeight: Typography.fontWeight.medium,
  },
});
