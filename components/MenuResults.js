import { FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import Colors from '../constants/Colors';
import Spacing from '../constants/Spacing';
import Typography from '../constants/Typography';
import Button from './ui/Button';
import Card from './ui/Card';

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
    enhancedMenuItems = [],
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
    
    // Calculate real displayed item count instead of using totalItems
    const displayedTotalItems = vegetarianCount;

    return (
      <Card variant="elevated" style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Restaurant Summary</Text>
        
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{displayedTotalItems}</Text>
            <Text style={styles.statLabel}>Veg Items</Text>
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
          <Text style={[styles.ratingText, { color: getRatingColor(overallRating && overallRating.toLowerCase() !== 'unknown' ? overallRating : calculateVegFriendliness()) }]}>
            {overallRating && overallRating.toLowerCase() !== 'unknown' ? overallRating : calculateVegFriendliness()}
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

    // Group items by category
    const groupedItems = groupItemsByCategory(vegetarianItems);
    
    return (
      <Card variant="default" style={styles.itemsContainer}>
        
        {Object.keys(groupedItems).map((category) => (
          <View key={category} style={styles.categorySection}>
            <View style={styles.categoryHeader}>
              <Text style={styles.categoryTitle}>{formatCategoryName(category)}</Text>
              <Text style={styles.itemCount}>{groupedItems[category].length} items</Text>
            </View>
            
            <FlatList
              data={groupedItems[category]}
              keyExtractor={(item, index) => `${item.name}-${index}`}
              renderItem={renderVegetarianItem}
              showsVerticalScrollIndicator={false}
              scrollEnabled={false}
            />
          </View>
        ))}
      </Card>
    );
  };

  // Group items by their category
  const groupItemsByCategory = (items) => {
    const grouped = {};
    
    items.forEach(item => {
      // Normalize category to lowercase and handle missing categories
      const category = (item.category || 'other').toLowerCase();
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(item);
    });
    
    // Sort categories in a logical meal order
    const orderedGrouped = {};
    const categoryOrder = [
      'appetizer', 'starter', 'side', 
      'main', 'entree', 
      'dessert', 'beverage', 
      'breakfast', 'lunch', 'dinner', 'brunch',
      'other'
    ];
    
    // First add categories in our preferred order
    categoryOrder.forEach(cat => {
      if (grouped[cat] && grouped[cat].length > 0) {
        orderedGrouped[cat] = grouped[cat];
        delete grouped[cat];
      }
    });
    
    // Then add any remaining categories alphabetically
    Object.keys(grouped).sort().forEach(cat => {
      orderedGrouped[cat] = grouped[cat];
    });
    
    return orderedGrouped;
  };
  
  // Format category name for display
  const formatCategoryName = (category) => {
    const categoryMap = {
      'main': 'Main Dishes',
      'appetizer': 'Appetizers',
      'starter': 'Starters',
      'side': 'Side Dishes',
      'dessert': 'Desserts',
      'beverage': 'Beverages',
      'entree': 'Entrées',
      'other': 'Other Items',
      'breakfast': 'Breakfast',
      'lunch': 'Lunch',
      'dinner': 'Dinner',
      'brunch': 'Brunch',
      'snack': 'Snacks',
      'salad': 'Salads',
      'soup': 'Soups',
      'sandwich': 'Sandwiches',
      'pizza': 'Pizza',
      'pasta': 'Pasta',
      'rice': 'Rice Dishes',
      'noodle': 'Noodle Dishes',
      'curry': 'Curries',
      'burger': 'Burgers',
      'wrap': 'Wraps',
      'bread': 'Breads',
      'pastry': 'Pastries',
      'cake': 'Cakes',
      'ice cream': 'Ice Cream',
      'coffee': 'Coffee',
      'tea': 'Tea',
      'smoothie': 'Smoothies',
      'juice': 'Juices',
      'cocktail': 'Cocktails',
      'special': 'Specials',
      'combo': 'Combo Meals',
    };
    
    // If the category is in our map, use that
    if (categoryMap[category?.toLowerCase()]) {
      return categoryMap[category.toLowerCase()];
    }
    
    // Default: capitalize first letter of each word
    return category.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const renderVegetarianItem = ({ item }) => {
    // Find matching enhanced item (if available)
    const enhancedItem = enhancedMenuItems.find(enhancedItem => 
      enhancedItem.name.toLowerCase() === item.name.toLowerCase()
    );
    
    // Use enhanced name if available
    const displayName = enhancedItem?.name || item.name;
    
    return (
      <View style={styles.menuItem}>
        <View style={styles.itemHeader}>
          <Text style={styles.itemName}>{displayName}</Text>
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
  };

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
  
  // Calculate veg-friendliness rating based on menu composition and quality of options
  const calculateVegFriendliness = () => {
    if (!vegetarianItems || vegetarianItems.length === 0) {
      return 'very poor';
    }
    
    // Use the actual number of items in the API response as our denominator
    // If totalItems is unreliable or 0, default to vegetarianItems.length
    const realTotalItems = (totalItems && totalItems > vegetarianItems.length) ? totalItems : vegetarianItems.length;
    
    const vegPercent = (vegetarianItems.length / realTotalItems) * 100;
    const veganCount = vegetarianItems.filter(item => item.isVegan).length;
    const veganPercent = (veganCount / realTotalItems) * 100;
    
    // Count meaningful vegetarian options (not just beverages and desserts)
    const mainDishes = vegetarianItems.filter(item => 
      item.category && 
      ['main', 'entree', 'lunch', 'dinner', 'pasta', 'pizza', 'curry', 'rice', 'sandwich', 'burger'].includes(item.category.toLowerCase())
    ).length;
    
    const appetizerDishes = vegetarianItems.filter(item => 
      item.category && 
      ['appetizer', 'starter', 'side', 'salad', 'soup'].includes(item.category.toLowerCase())
    ).length;
    
    const onlyBeveragesAndDesserts = mainDishes === 0 && appetizerDishes === 0;
    
    // More stringent rating thresholds that consider meaningful meal options
    if (mainDishes >= 5 && vegPercent >= 40 && veganPercent >= 20) {
      return 'excellent';
    } else if (mainDishes >= 3 && vegPercent >= 30 && veganPercent >= 10) {
      return 'good';
    } else if ((mainDishes >= 2 || appetizerDishes >= 3) && vegPercent >= 20) {
      return 'fair';
    } else if (mainDishes >= 1 || appetizerDishes >= 2) {
      return 'poor';
    } else if (onlyBeveragesAndDesserts) {
      return 'very poor'; // Only beverages and desserts available
    } else {
      return 'very poor';
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {renderSummaryCard()}
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
    backgroundColor: Colors.background.secondary, // Restoring gray background
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: 8,
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
  
  categorySection: {
    marginBottom: Spacing.lg,
    backgroundColor: Colors.background.primary,
    borderRadius: 8,
    padding: Spacing.sm,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  
  categoryTitle: {
    ...Typography.subtitle,
    color: Colors.primary[700],
    fontWeight: Typography.fontWeight.bold,
  },
  
  itemCount: {
    ...Typography.caption,
    color: Colors.text.tertiary,
  },
}); 