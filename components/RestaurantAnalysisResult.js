import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Colors from '../constants/Colors';
import Spacing from '../constants/Spacing';
import Typography from '../constants/Typography';

export default function RestaurantAnalysisResult({ result, vegCriteria }) {
  const router = useRouter();
  const { restaurant, analysis, meetsVegCriteria, error } = result;

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

  const getStatusIcon = (meets, hasError) => {
    if (hasError) return '❌';
    return meets ? '✅' : '❌';
  };

  const getStatusText = (meets, hasError, criteria) => {
    if (hasError) return 'Analysis Failed';
    return meets ? `Meets "${criteria}" criteria` : `Below "${criteria}" standard`;
  };

  const handlePress = () => {
    if (analysis && analysis.analysisMethod !== 'failed') {
      router.push({
        pathname: '/analysis',
        params: {
          name: restaurant.name,
          id: restaurant.id,
          vicinity: restaurant.vicinity,
        },
      });
    }
  };

  return (
    <TouchableOpacity 
      style={[
        styles.container,
        meetsVegCriteria && styles.qualifyingContainer
      ]} 
      onPress={handlePress} 
      activeOpacity={0.8}
      disabled={!!error}
    >
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.restaurantInfo}>
            <Text style={styles.restaurantName}>{restaurant.name}</Text>
            <Text style={styles.vicinity}>{restaurant.vicinity}</Text>
          </View>
          
          <View style={styles.statusBadge}>
            <Text style={styles.statusIcon}>
              {getStatusIcon(meetsVegCriteria, !!error)}
            </Text>
          </View>
        </View>

        {/* Status */}
        <View style={styles.statusContainer}>
          <Text style={[
            styles.statusText,
            { color: meetsVegCriteria ? Colors.success : Colors.text.secondary }
          ]}>
            {getStatusText(meetsVegCriteria, !!error, vegCriteria)}
          </Text>
        </View>

        {/* Analysis Results */}
        {analysis && !error && (
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
                  {analysis.vegFriendliness.toUpperCase()}
                </Text>
              </View>
              
              <View style={styles.vegStats}>
                <Text style={styles.vegStatsText}>
                  {analysis.vegetarianCount || 0} vegetarian options
                </Text>
                {analysis.confidence > 0 && (
                  <Text style={styles.confidenceText}>
                    {Math.round(analysis.confidence * 100)}% confident
                  </Text>
                )}
              </View>
            </View>

            {analysis.summary && (
              <Text style={styles.summary} numberOfLines={3}>
                {analysis.summary}
              </Text>
            )}

            {/* Additional Info */}
            <View style={styles.additionalInfo}>
              {analysis.hasWebsite && analysis.website && (
                <View style={styles.websiteIndicator}>
                  <Text style={styles.websiteText}>🌐 Website analyzed</Text>
                </View>
              )}
              
              {analysis.analysisMethod && (
                <View style={styles.methodIndicator}>
                  <Text style={styles.methodText}>
                    Method: {analysis.analysisMethod === 'ai-analysis' ? 'AI Analysis' : 
                             analysis.analysisMethod === 'keyword' ? 'Keyword Detection' :
                             analysis.analysisMethod}
                  </Text>
                </View>
              )}
            </View>

            {/* Vegetarian Items Preview */}
            {analysis.vegetarianItems && analysis.vegetarianItems.length > 0 && (
              <View style={styles.itemsPreview}>
                <Text style={styles.itemsPreviewTitle}>Sample Vegetarian Items:</Text>
                {analysis.vegetarianItems.slice(0, 3).map((item, index) => (
                  <Text key={index} style={styles.itemName}>
                    • {item.name} {item.isVegan ? '🌱' : ''}
                  </Text>
                ))}
                {analysis.vegetarianItems.length > 3 && (
                  <Text style={styles.moreItems}>
                    +{analysis.vegetarianItems.length - 3} more items
                  </Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* Error Display */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Analysis failed: {error}</Text>
          </View>
        )}

        {/* Restaurant Details */}
        <View style={styles.restaurantDetails}>
          {restaurant.rating && (
            <View style={styles.detailBadge}>
              <Text style={styles.detailText}>⭐ {restaurant.rating}</Text>
            </View>
          )}
          
          {restaurant.distanceMiles && (
            <View style={styles.detailBadge}>
              <Text style={styles.detailText}>{restaurant.distanceMiles.toFixed(1)} mi</Text>
            </View>
          )}
          
          {restaurant.priceLevel && (
            <View style={styles.detailBadge}>
              <Text style={styles.detailText}>{'💰'.repeat(restaurant.priceLevel)}</Text>
            </View>
          )}
        </View>
      </View>

      {!error && (
        <View style={styles.arrow}>
          <Text style={styles.arrowText}>→</Text>
        </View>
      )}
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
  },
  
  statusBadge: {
    marginLeft: Spacing.sm,
  },
  
  statusIcon: {
    fontSize: 24,
  },
  
  statusContainer: {
    marginBottom: Spacing.sm,
  },
  
  statusText: {
    ...Typography.bodySmall,
    fontWeight: Typography.fontWeight.semibold,
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
    marginBottom: Spacing.sm,
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
  
  summary: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
    lineHeight: 18,
    marginBottom: Spacing.sm,
  },
  
  additionalInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  
  websiteIndicator: {
    backgroundColor: Colors.background.tertiary,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: 4,
  },
  
  websiteText: {
    ...Typography.caption,
    color: Colors.text.tertiary,
  },
  
  methodIndicator: {
    backgroundColor: Colors.background.tertiary,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: 4,
  },
  
  methodText: {
    ...Typography.caption,
    color: Colors.text.tertiary,
  },
  
  itemsPreview: {
    marginTop: Spacing.xs,
  },
  
  itemsPreviewTitle: {
    ...Typography.bodySmall,
    color: Colors.text.primary,
    fontWeight: Typography.fontWeight.semibold,
    marginBottom: Spacing.xs,
  },
  
  itemName: {
    ...Typography.caption,
    color: Colors.text.secondary,
    marginBottom: 2,
  },
  
  moreItems: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    fontStyle: 'italic',
    marginTop: Spacing.xs,
  },
  
  errorContainer: {
    backgroundColor: Colors.error + '20',
    borderRadius: 4,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  
  errorText: {
    ...Typography.bodySmall,
    color: Colors.error,
  },
  
  restaurantDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  
  detailBadge: {
    backgroundColor: Colors.background.tertiary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  
  detailText: {
    ...Typography.caption,
    color: Colors.text.primary,
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
