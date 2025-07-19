import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Colors from '../constants/Colors';
import Spacing from '../constants/Spacing';
import Typography from '../constants/Typography';

export default function AdvancedRestaurantListItem({ restaurant }) {
  const router = useRouter();

  const handlePress = () => {
    router.push({
      pathname: '/analysis',
      params: {
        name: restaurant.name,
        id: restaurant.id,
        vicinity: restaurant.vicinity,
      },
    });
  };

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

  return (
    <TouchableOpacity style={styles.container} onPress={handlePress} activeOpacity={0.8}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.name} numberOfLines={1}>{restaurant.name}</Text>
          <View style={styles.badgesRow}>
            {restaurant.rating ? (
              <View style={styles.ratingBadge}>
                <Text style={styles.ratingBadgeText}>⭐ {restaurant.rating}</Text>
              </View>
            ) : null}
            {restaurant.distanceMiles && restaurant.distanceMiles > 0 ? (
              <View style={styles.distanceBadge}>
                <Text style={styles.distanceBadgeText}>{restaurant.distanceMiles.toFixed(1)} mi</Text>
              </View>
            ) : null}
          </View>
        </View>
        
        <Text style={styles.vicinity} numberOfLines={1}>{restaurant.vicinity}</Text>
        
        {restaurant.priceLevel && (
          <View style={styles.priceContainer}>
            <Text style={styles.priceText}>
              {'💰'.repeat(restaurant.priceLevel)}
            </Text>
          </View>
        )}

        {/* Vegetarian Analysis Results */}
        {restaurant.vegAnalysis && (
          <View style={styles.vegAnalysisContainer}>
            <View style={styles.vegAnalysisHeader}>
              <View style={[
                styles.vegFriendlinessBadge,
                { backgroundColor: getVegCriteriaColor(restaurant.vegAnalysis.vegFriendliness) }
              ]}>
                <Text style={styles.vegFriendlinessIcon}>
                  {getVegCriteriaIcon(restaurant.vegAnalysis.vegFriendliness)}
                </Text>
                <Text style={styles.vegFriendlinessText}>
                  {restaurant.vegAnalysis.vegFriendliness.toUpperCase()}
                </Text>
              </View>
              
              <View style={styles.vegStats}>
                <Text style={styles.vegStatsText}>
                  {restaurant.vegAnalysis.vegetarianCount} vegetarian options
                </Text>
                {restaurant.vegAnalysis.confidence > 0 && (
                  <Text style={styles.confidenceText}>
                    {Math.round(restaurant.vegAnalysis.confidence * 100)}% confident
                  </Text>
                )}
              </View>
            </View>

            {restaurant.vegAnalysis.summary && (
              <Text style={styles.vegSummary} numberOfLines={2}>
                {restaurant.vegAnalysis.summary}
              </Text>
            )}

            {restaurant.vegAnalysis.website && (
              <View style={styles.websiteIndicator}>
                <Text style={styles.websiteText}>🌐 Has website menu</Text>
              </View>
            )}
          </View>
        )}
      </View>
      
      <View style={styles.arrow}>
        <Text style={styles.arrowText}>→</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background.primary,
    borderRadius: 12,
    shadowColor: Colors.shadow.light,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 3,
    marginVertical: Spacing.xs,
    overflow: 'hidden',
  },
  
  content: {
    flex: 1,
    padding: Spacing.md,
  },
  
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  
  name: {
    ...Typography.h6,
    color: Colors.text.primary,
    flex: 1,
    marginRight: Spacing.sm,
  },
  
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  
  ratingBadge: {
    backgroundColor: Colors.accent.yellow,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  
  ratingBadgeText: {
    ...Typography.caption,
    color: Colors.text.primary,
    fontWeight: Typography.fontWeight.semibold,
  },
  
  distanceBadge: {
    backgroundColor: Colors.background.tertiary,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  
  distanceBadgeText: {
    ...Typography.caption,
    color: Colors.text.primary,
    fontWeight: Typography.fontWeight.medium,
  },
  
  vicinity: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
    lineHeight: 20,
    marginBottom: Spacing.xs,
  },
  
  priceContainer: {
    marginBottom: Spacing.sm,
  },
  
  priceText: {
    ...Typography.caption,
    color: Colors.text.tertiary,
  },

  vegAnalysisContainer: {
    backgroundColor: Colors.background.secondary,
    borderRadius: 8,
    padding: Spacing.sm,
    marginTop: Spacing.xs,
  },

  vegAnalysisHeader: {
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

  vegStats: {
    alignItems: 'flex-end',
  },

  vegStatsText: {
    ...Typography.bodySmall,
    color: Colors.text.primary,
    fontWeight: Typography.fontWeight.semibold,
  },

  confidenceText: {
    ...Typography.caption,
    color: Colors.text.secondary,
  },

  vegSummary: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
    lineHeight: 18,
    marginTop: Spacing.xs,
  },

  websiteIndicator: {
    marginTop: Spacing.xs,
    alignSelf: 'flex-start',
  },

  websiteText: {
    ...Typography.caption,
    color: Colors.text.tertiary,
  },
  
  arrow: {
    position: 'absolute',
    right: Spacing.md,
    top: '50%',
    marginTop: -10,
  },
  
  arrowText: {
    fontSize: 20,
    color: Colors.primary[500],
    fontWeight: Typography.fontWeight.bold,
  },
});
