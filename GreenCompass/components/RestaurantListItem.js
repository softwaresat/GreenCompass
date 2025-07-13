import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

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
        <Text style={styles.name}>{restaurant.name}</Text>
        <Text style={styles.vicinity}>{restaurant.vicinity}</Text>
      </View>
      <View style={styles.arrow}>
        <Text style={styles.arrowText}>→</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  content: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  vicinity: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  arrow: {
    marginLeft: 10,
  },
  arrowText: {
    fontSize: 20,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
}); 