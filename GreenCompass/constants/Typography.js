import { Platform } from 'react-native';

export const Typography = {
  // Font families
  fontFamily: {
    regular: Platform.OS === 'ios' ? 'System' : 'Roboto',
    medium: Platform.OS === 'ios' ? 'System' : 'Roboto-Medium',
    bold: Platform.OS === 'ios' ? 'System' : 'Roboto-Bold',
    light: Platform.OS === 'ios' ? 'System' : 'Roboto-Light',
  },
  
  // Font sizes
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    '5xl': 48,
  },
  
  // Line heights
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
  
  // Font weights
  fontWeight: {
    light: '300',
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },
  
  // Text styles
  h1: {
    fontSize: 36,
    fontWeight: '700',
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  
  h2: {
    fontSize: 30,
    fontWeight: '600',
    lineHeight: 36,
    letterSpacing: -0.25,
  },
  
  h3: {
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 32,
    letterSpacing: 0,
  },
  
  h4: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 28,
    letterSpacing: 0,
  },
  
  h5: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
    letterSpacing: 0,
  },
  
  h6: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
    letterSpacing: 0,
  },
  
  body: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    letterSpacing: 0,
  },
  
  bodySmall: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    letterSpacing: 0,
  },
  
  caption: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    letterSpacing: 0.5,
  },
  
  button: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
    letterSpacing: 0.5,
  },
  
  buttonSmall: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    letterSpacing: 0.5,
  },
};

export default Typography; 