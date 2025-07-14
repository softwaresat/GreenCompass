import React from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList } from 'react-native';
import Button from './ui/Button';
import Card from './ui/Card';
import Colors from '../constants/Colors';
import Typography from '../constants/Typography';
import Spacing from '../constants/Spacing';

export default function MenuResults({ results, onRetryAnalysis }) {
  if (!results) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>No results available</Text>
      </View>
    );
  }

  const { 
    restaurantName, 
    menuAnalysis,
    scrapingInfo,
    websiteUrl,
    overallRating,
    confidence
  } = results;

  const vegetarianItems = menuAnalysis?.vegetarianItems || [];
  const totalItems = menuAnalysis?.totalItems || 0;
  const summary = menuAnalysis?.summary || '';

  const renderSummaryCard = () => {
    const vegetarianCount = vegetarianItems.length;
    const veganCount = vegetarianItems.filter(item => item.isVegan).length;

    return (
      <Card variant="elevated" style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Website Analysis Summary</Text>
        
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{totalItems}</Text>
            <Text style={styles.statLabel}>Items Found</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: Colors.primary[500] }]}>{vegetarianCount}</Text>
            <Text style={styles.statLabel}>Vegetarian</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: Colors.accent.blue }]}>{veganCount}</Text>
            <Text style={styles.statLabel}>Vegan</Text>
          </View>
        </View>

        <View style={styles.ratingContainer}>
          <Text style={styles.ratingLabel}>Veg-Friendliness:</Text>
          <Text style={[styles.ratingText, { color: getRatingColor(overallRating) }]}>
            {overallRating || 'Unknown'}
          </Text>
        </View>

        <View style={styles.confidenceContainer}>
          <Text style={styles.confidenceLabel}>Analysis Confidence:</Text>
          <Text style={styles.confidenceText}>{Math.round((confidence || 0) * 100)}%</Text>
        </View>

        {summary && (
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryLabel}>Summary:</Text>
            <Text style={styles.summaryText}>{summary}</Text>
          </View>
        )}
      </Card>
    );
  };

  const renderScrapingInfo = () => (
    <Card variant="default" style={styles.infoCard}>
      <Text style={styles.infoTitle}>Website Analysis Details</Text>
      <Text style={styles.infoText}>Website: {websiteUrl || 'Not available'}</Text>
      <Text style={styles.infoText}>Items Found: {scrapingInfo?.itemsFound || 0}</Text>
      <Text style={styles.infoText}>Scraping Method: {scrapingInfo?.scrapingMethod || 'Unknown'}</Text>
    </Card>
  );

  const renderVegetarianItems = () => {
    if (vegetarianItems.length === 0) {
      return (
        <Card variant="outlined" style={styles.noItemsContainer}>
          <Text style={styles.noItemsText}>No vegetarian items found on the website menu.</Text>
          <Text style={styles.noItemsSubtext}>
            This could mean the restaurant has no vegetarian options, or the website menu couldn't be properly analyzed.
          </Text>
          <Button 
            title="Try Again" 
            onPress={onRetryAnalysis}
            variant="primary"
            style={styles.retryButton}
          />
        </Card>
      );
    }

    return (
      <Card variant="default" style={styles.itemsContainer}>
        <Text style={styles.itemsTitle}>Vegetarian Options Found:</Text>
        <FlatList
          data={vegetarianItems}
          keyExtractor={(item, index) => `${item.name}-${index}`}
          renderItem={renderVegetarianItem}
          showsVerticalScrollIndicator={false}
          scrollEnabled={false}
        />
      </Card>
    );
  };

  const renderVegetarianItem = ({ item }) => (
    <View style={styles.menuItem}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemName}>{item.name}</Text>
        {item.isVegan && (
          <View style={styles.veganBadge}>
            <Text style={styles.veganBadgeText}>VEGAN</Text>
          </View>
        )}
      </View>
      
      {item.description && (
        <Text style={styles.itemDescription}>{item.description}</Text>
      )}
      
      {item.price && (
        <Text style={styles.itemPrice}>{item.price}</Text>
      )}
      
      {item.confidence !== undefined && (
        <Text style={styles.itemConfidence}>
          Confidence: {Math.round(item.confidence * 100)}%
        </Text>
      )}
    </View>
  );

  const getRatingColor = (rating) => {
    switch (rating?.toLowerCase()) {
      case 'excellent': return Colors.success;
      case 'good': return Colors.primary[500];
      case 'fair': return Colors.warning;
      case 'poor': return Colors.accent.orange;
      case 'very poor': return Colors.error;
      default: return Colors.text.tertiary;
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {renderSummaryCard()}
      {renderScrapingInfo()}
      {renderVegetarianItems()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
  },
  
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background.secondary,
  },
  
  errorText: {
    ...Typography.body,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  
  summaryCard: {
    margin: Spacing.card.margin,
    padding: Spacing.lg,
  },
  
  summaryTitle: {
    ...Typography.h4,
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },
  
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Spacing.lg,
  },
  
  statItem: {
    alignItems: 'center',
  },
  
  statNumber: {
    fontSize: 28,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
  },
  
  statLabel: {
    ...Typography.caption,
    color: Colors.text.secondary,
    marginTop: Spacing.xs,
  },
  
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  
  ratingLabel: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
    marginRight: Spacing.sm,
  },
  
  ratingText: {
    ...Typography.h6,
    fontWeight: Typography.fontWeight.bold,
  },
  
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  
  confidenceLabel: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
    marginRight: Spacing.sm,
  },
  
  confidenceText: {
    ...Typography.h6,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
  },
  
  summaryContainer: {
    marginTop: Spacing.md,
  },
  
  summaryLabel: {
    ...Typography.h6,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  
  summaryText: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  
  infoCard: {
    margin: Spacing.card.margin,
    marginTop: 0,
    padding: Spacing.md,
  },
  
  infoTitle: {
    ...Typography.h6,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  
  infoText: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
  },
  
  noItemsContainer: {
    margin: Spacing.card.margin,
    marginTop: 0,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  
  noItemsText: {
    ...Typography.body,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  
  noItemsSubtext: {
    ...Typography.bodySmall,
    color: Colors.text.tertiary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  
  retryButton: {
    marginTop: Spacing.sm,
  },
  
  itemsContainer: {
    margin: Spacing.card.margin,
    marginTop: 0,
    padding: Spacing.md,
  },
  
  itemsTitle: {
    ...Typography.h6,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  
  menuItem: {
    backgroundColor: Colors.background.secondary,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary[500],
  },
  
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  
  itemName: {
    ...Typography.h6,
    color: Colors.text.primary,
    flex: 1,
  },
  
  veganBadge: {
    backgroundColor: Colors.accent.blue,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  
  veganBadgeText: {
    ...Typography.caption,
    color: Colors.text.inverse,
    fontWeight: Typography.fontWeight.bold,
  },
  
  itemDescription: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
    lineHeight: 18,
  },
  
  itemPrice: {
    ...Typography.h6,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary[500],
    marginBottom: Spacing.xs,
  },
  
  itemConfidence: {
    ...Typography.caption,
    color: Colors.text.tertiary,
  },
}); 