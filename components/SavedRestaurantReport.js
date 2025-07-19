import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Colors from '../constants/Colors';
import Spacing from '../constants/Spacing';
import Typography from '../constants/Typography';

export default function SavedRestaurantReport({ report, onRemove, onRegenerate }) {
  const router = useRouter();
  const { restaurant, analysis, vegCriteria, savedAt, meetsVegCriteria } = report;

  const getVegCriteriaColor = (criteria) => {
    switch (criteria) {
      case 'excellent': return Colors.success;
      case 'good': return Colors.primary[500];
      case 'fair': return Colors.warning;
      case 'poor': return Colors.accent.orange;
      default: return Colors.text.secondary;
    }
  };

  const getVegCriteriaIcon = (criteria) => {
    switch (criteria) {
      case 'excellent': return '🌟';
      case 'good': return '✅';
      case 'fair': return '⚠️';
      case 'poor': return '❌';
      default: return '❓';
    }
  };

  const formatSavedDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now - date;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const handlePress = () => {
    // Navigate to saved analysis view (no regeneration)
    router.push({
      pathname: '/saved-analysis',
      params: {
        reportId: report.id,
        restaurantId: restaurant.id,
        name: restaurant.name,
        vicinity: restaurant.vicinity,
      },
    });
  };

  return (
    <TouchableOpacity 
      style={[
        styles.container,
        meetsVegCriteria && styles.qualifyingContainer
      ]} 
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.restaurantInfo}>
            <Text style={styles.restaurantName} numberOfLines={1}>
              {restaurant.name}
            </Text>
            <Text style={styles.vicinity} numberOfLines={1}>
              {restaurant.vicinity}
            </Text>
            <Text style={styles.savedDate}>
              Saved {formatSavedDate(savedAt)}
            </Text>
          </View>
          
          <View style={styles.statusBadge}>
            <Text style={styles.statusIcon}>
              {meetsVegCriteria ? '✅' : '❌'}
            </Text>
          </View>
        </View>

        {/* Analysis Summary */}
        {analysis && (
          <View style={styles.analysisContainer}>
            <View style={styles.analysisHeader}>
              <View style={[
                styles.vegFriendlinessBadge,
                { backgroundColor: getVegCriteriaColor(analysis.vegFriendliness) }
              ]}>
                <Text style={styles.vegFriendlinessIcon}>
                  {getVegCriteriaIcon(analysis.vegFriendliness)}
                </Text>
                <Text style={styles.vegFriendlinessText}>
                  {analysis.vegFriendliness?.toUpperCase() || 'UNKNOWN'}
                </Text>
              </View>
              
              <Text style={styles.vegStatsText}>
                {analysis.vegetarianCount || 0} vegetarian options
              </Text>
            </View>

            <Text style={styles.criteriaText}>
              Analyzed for "{vegCriteria}" standard
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => onRegenerate(restaurant)}
          >
            <Text style={styles.actionButtonText}>🔄 Regenerate</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.removeButton]}
            onPress={() => onRemove(report.id)}
          >
            <Text style={[styles.actionButtonText, styles.removeButtonText]}>🗑️ Remove</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background.primary,
    borderRadius: 12,
    marginVertical: Spacing.xs,
    shadowColor: Colors.shadow.light,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  
  qualifyingContainer: {
    borderColor: Colors.success,
    borderWidth: 2,
  },
  
  content: {
    padding: Spacing.md,
  },
  
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  
  restaurantInfo: {
    flex: 1,
  },
  
  restaurantName: {
    ...Typography.h6,
    color: Colors.text.primary,
    marginBottom: 2,
  },
  
  vicinity: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
    marginBottom: 2,
  },
  
  savedDate: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    fontStyle: 'italic',
  },
  
  statusBadge: {
    marginLeft: Spacing.sm,
  },
  
  statusIcon: {
    fontSize: 24,
  },
  
  analysisContainer: {
    backgroundColor: Colors.background.secondary,
    borderRadius: 8,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  
  analysisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  
  vegFriendlinessBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 6,
    gap: Spacing.xs,
  },
  
  vegFriendlinessIcon: {
    fontSize: 14,
  },
  
  vegFriendlinessText: {
    ...Typography.caption,
    color: Colors.text.inverse,
    fontWeight: Typography.fontWeight.bold,
  },
  
  vegStatsText: {
    ...Typography.bodySmall,
    color: Colors.text.primary,
    fontWeight: Typography.fontWeight.semibold,
  },
  
  criteriaText: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    fontStyle: 'italic',
  },
  
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  
  actionButton: {
    flex: 1,
    backgroundColor: Colors.background.tertiary,
    borderRadius: 8,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  
  removeButton: {
    backgroundColor: Colors.error + '20',
    borderColor: Colors.error + '40',
  },
  
  actionButtonText: {
    ...Typography.bodySmall,
    color: Colors.text.primary,
    fontWeight: Typography.fontWeight.semibold,
  },
  
  removeButtonText: {
    color: Colors.error,
  },
});
