import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Colors from '../../constants/Colors';
import Typography from '../../constants/Typography';
import Spacing from '../../constants/Spacing';

const Button = ({ 
  title, 
  onPress, 
  variant = 'primary', 
  size = 'medium',
  disabled = false,
  loading = false,
  style,
  textStyle,
  children 
}) => {
  const buttonStyles = [
    styles.base,
    styles[variant],
    styles[size],
    disabled && styles.disabled,
    style,
  ];

  const textStyles = [
    styles.text,
    styles[`${variant}Text`],
    styles[`${size}Text`],
    disabled && styles.disabledText,
    textStyle,
  ];

  return (
    <TouchableOpacity
      style={buttonStyles}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator 
          size="small" 
          color={variant === 'primary' ? Colors.text.inverse : Colors.primary[500]} 
        />
      ) : (
        children || <Text style={textStyles}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    flexDirection: 'row',
  },
  
  // Variants
  primary: {
    backgroundColor: Colors.primary[500],
    shadowColor: Colors.shadow.medium,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 3,
  },
  
  secondary: {
    backgroundColor: Colors.background.primary,
    borderWidth: 1,
    borderColor: Colors.border.medium,
  },
  
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: Colors.primary[500],
  },
  
  ghost: {
    backgroundColor: 'transparent',
  },
  
  // Sizes
  small: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    minHeight: 36,
  },
  
  medium: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    minHeight: 44,
  },
  
  large: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    minHeight: 52,
  },
  
  // Text styles
  text: {
    ...Typography.button,
  },
  
  primaryText: {
    color: Colors.text.inverse,
  },
  
  secondaryText: {
    color: Colors.text.primary,
  },
  
  outlineText: {
    color: Colors.primary[500],
  },
  
  ghostText: {
    color: Colors.primary[500],
  },
  
  smallText: {
    ...Typography.buttonSmall,
  },
  
  mediumText: {
    ...Typography.button,
  },
  
  largeText: {
    fontSize: 18,
    fontWeight: '600',
  },
  
  // States
  disabled: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  
  disabledText: {
    opacity: 0.7,
  },
});

export default Button; 