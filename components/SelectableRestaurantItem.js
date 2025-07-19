import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Colors from '../constants/Colors';
import Spacing from '../constants/Spacing';
import Typography from '../constants/Typography';

export default function SelectableRestaurantItem({ restaurant, isSelected, onToggle }) {
  return (
    <TouchableOpacity 
      style={[
        styles.container,
        isSelected && styles.selectedContainer
      ]} 
      onPress={onToggle} 
      activeOpacity={0.8}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.name} numberOfLines={1}>{restaurant.name}</Text>
          <View style={styles.checkbox}>
            {isSelected ? (
              <Text style={styles.checkmark}>✓</Text>
            ) : (
              <View style={styles.emptyCheckbox} />
            )}
          </View>
        </View>
        
        <Text style={styles.vicinity} numberOfLines={1}>{restaurant.vicinity}</Text>
        
        <View style={styles.details}>
          {restaurant.rating ? (
            <View style={styles.ratingContainer}>
              <Text style={styles.ratingText}>⭐ {restaurant.rating}</Text>
            </View>
          ) : null}
          
          {restaurant.distanceMiles && restaurant.distanceMiles > 0 ? (
            <View style={styles.distanceContainer}>
              <Text style={styles.distanceText}>{restaurant.distanceMiles.toFixed(1)} mi</Text>
            </View>
          ) : null}
          
          {restaurant.priceLevel && (
            <View style={styles.priceContainer}>
              <Text style={styles.priceText}>
                {'💰'.repeat(restaurant.priceLevel)}
              </Text>
            </View>
          )}
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
    borderWidth: 2,
    borderColor: 'transparent',
  },
  
  selectedContainer: {
    borderColor: Colors.primary[500],
    backgroundColor: Colors.primary[50] || Colors.background.primary,
  },
  
  content: {
    padding: Spacing.md,
  },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  
  name: {
    ...Typography.h6,
    color: Colors.text.primary,
    flex: 1,
    marginRight: Spacing.sm,
  },
  
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary[500],
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  checkmark: {
    color: Colors.text.inverse,
    fontSize: 16,
    fontWeight: Typography.fontWeight.bold,
  },
  
  emptyCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.background.primary,
    borderWidth: 2,
    borderColor: Colors.border.medium,
  },
  
  vicinity: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
    marginBottom: Spacing.sm,
  },
  
  details: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  
  ratingContainer: {
    backgroundColor: Colors.accent.yellow,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  
  ratingText: {
    ...Typography.caption,
    color: Colors.text.primary,
    fontWeight: Typography.fontWeight.semibold,
  },
  
  distanceContainer: {
    backgroundColor: Colors.background.tertiary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  
  distanceText: {
    ...Typography.caption,
    color: Colors.text.primary,
    fontWeight: Typography.fontWeight.medium,
  },
  
  priceContainer: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  
  priceText: {
    ...Typography.caption,
    color: Colors.text.tertiary,
  },
});
