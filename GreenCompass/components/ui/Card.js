import React from 'react';
import { View, StyleSheet } from 'react-native';
import Colors from '../../constants/Colors';
import Spacing from '../../constants/Spacing';

const Card = ({ 
  children, 
  variant = 'default',
  style,
  ...props 
}) => {
  const cardStyles = [
    styles.base,
    styles[variant],
    style,
  ];

  return (
    <View style={cardStyles} {...props}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: Colors.background.primary,
    borderRadius: 12,
    padding: 16,
  },
  
  default: {
    shadowColor: Colors.shadow.light,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  
  elevated: {
    shadowColor: Colors.shadow.medium,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  
  outlined: {
    borderWidth: 1,
    borderColor: Colors.border.medium,
  },
  
  flat: {
    backgroundColor: Colors.background.secondary,
  },
});

export default Card; 