import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import Colors from '../constants/Colors';
import Typography from '../constants/Typography';
import Spacing from '../constants/Spacing';

export default function RestaurantListItem({ restaurant }) {
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

  return (
    <TouchableOpacity style={styles.container} onPress={handlePress} activeOpacity={0.8}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.name}>{restaurant.name}</Text>
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
        
        <Text style={styles.vicinity}>{restaurant.vicinity}</Text>
        
        {restaurant.priceLevel && (
          <View style={styles.priceContainer}>
            <Text style={styles.priceText}>
              {'💰'.repeat(restaurant.priceLevel)}
            </Text>
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
    padding: Spacing.card.padding,
    marginBottom: Spacing.list.itemSpacing,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: Colors.shadow.light,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  
  content: {
    flex: 1,
  },
  
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  
  name: {
    ...Typography.h6,
    color: Colors.text.primary,
    flex: 1,
    marginRight: Spacing.sm,
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
  
  vicinity: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
    lineHeight: 20,
    marginBottom: Spacing.xs,
  },
  
  priceContainer: {
    marginTop: Spacing.xs,
  },
  
  priceText: {
    ...Typography.caption,
    color: Colors.text.tertiary,
  },
  
  arrow: {
    marginLeft: Spacing.sm,
  },
  
  arrowText: {
    fontSize: 20,
    color: Colors.primary[500],
    fontWeight: Typography.fontWeight.bold,
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
    marginLeft: 4,
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
    marginLeft: 4,
  },
  distanceBadgeText: {
    ...Typography.caption,
    color: Colors.text.primary,
    fontWeight: Typography.fontWeight.medium,
  },
}); 