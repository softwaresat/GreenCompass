import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList } from 'react-native';

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
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Website Analysis Summary</Text>
        
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{totalItems}</Text>
            <Text style={styles.statLabel}>Items Found</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#4CAF50' }]}>{vegetarianCount}</Text>
            <Text style={styles.statLabel}>Vegetarian</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#2196F3' }]}>{veganCount}</Text>
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
      </View>
    );
  };

  const renderScrapingInfo = () => (
    <View style={styles.infoCard}>
      <Text style={styles.infoTitle}>Website Analysis Details</Text>
      <Text style={styles.infoText}>Website: {websiteUrl || 'Not available'}</Text>
      <Text style={styles.infoText}>Items Found: {scrapingInfo?.itemsFound || 0}</Text>
      <Text style={styles.infoText}>Scraping Method: {scrapingInfo?.scrapingMethod || 'Unknown'}</Text>
    </View>
  );

  const renderVegetarianItems = () => {
    if (vegetarianItems.length === 0) {
      return (
        <View style={styles.noItemsContainer}>
          <Text style={styles.noItemsText}>No vegetarian items found on the website menu.</Text>
          <Text style={styles.noItemsSubtext}>
            This could mean the restaurant has no vegetarian options, or the website menu couldn't be properly analyzed.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={onRetryAnalysis}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.itemsContainer}>
        <Text style={styles.itemsTitle}>Vegetarian Options Found:</Text>
        <FlatList
          data={vegetarianItems}
          keyExtractor={(item, index) => `${item.name}-${index}`}
          renderItem={renderVegetarianItem}
          showsVerticalScrollIndicator={false}
        />
      </View>
    );
  };

  const renderVegetarianItem = ({ item }) => (
    <View style={styles.menuItem}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemName}>{item.name}</Text>
        {item.isVegan && <Text style={styles.veganBadge}>VEGAN</Text>}
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
      case 'excellent': return '#4CAF50';
      case 'good': return '#8BC34A';
      case 'fair': return '#FFC107';
      case 'poor': return '#FF9800';
      case 'very poor': return '#F44336';
      default: return '#757575';
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
    backgroundColor: '#f5f5f5',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: '#fff',
    margin: 15,
    padding: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  ratingLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  confidenceLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  confidenceText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  summaryContainer: {
    marginTop: 10,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  summaryText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  infoCard: {
    backgroundColor: '#fff',
    margin: 15,
    marginTop: 0,
    padding: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  noItemsContainer: {
    backgroundColor: '#fff',
    margin: 15,
    marginTop: 0,
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  noItemsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 10,
  },
  noItemsSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  itemsContainer: {
    backgroundColor: '#fff',
    margin: 15,
    marginTop: 0,
    padding: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  itemsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  menuItem: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  veganBadge: {
    backgroundColor: '#2196F3',
    color: '#fff',
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    fontWeight: 'bold',
  },
  itemDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
    lineHeight: 18,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 5,
  },
  itemConfidence: {
    fontSize: 12,
    color: '#999',
  },
}); 