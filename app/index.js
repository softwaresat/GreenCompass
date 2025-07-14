import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Button from '../components/ui/Button';
import Colors from '../constants/Colors';
import Typography from '../constants/Typography';
import Spacing from '../constants/Spacing';

export default function HomeScreen() {
  const router = useRouter();

  const handleFindRestaurants = () => {
    router.push('/results');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary[600]} />
      
      <LinearGradient
        colors={[Colors.primary[600], Colors.primary[500]]}
        style={styles.background}
      >
        <View style={styles.content}>
          {/* Hero Section */}
          <View style={styles.heroSection}>
            <View style={styles.logoContainer}>
              <View style={styles.logoBackground}>
                <Text style={styles.logoText}>🧭</Text>
              </View>
            </View>
            
            <Text style={styles.title}>GreenCompass</Text>
            <Text style={styles.subtitle}>
              Discover vegetarian options at nearby restaurants with AI-powered menu analysis
            </Text>
          </View>

          {/* Features Section */}
          <View style={styles.featuresSection}>
            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>📍</Text>
              <Text style={styles.featureText}>Find restaurants near you</Text>
            </View>
            
            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>🌱</Text>
              <Text style={styles.featureText}>AI-powered vegetarian detection</Text>
            </View>
            
            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>📱</Text>
              <Text style={styles.featureText}>Real-time menu analysis</Text>
            </View>
          </View>

          {/* CTA Section */}
          <View style={styles.ctaSection}>
            <Button
              title="Find Vegetarian Options Nearby"
              onPress={handleFindRestaurants}
              variant="primary"
              size="large"
              style={styles.ctaButton}
            />
            
            <Text style={styles.ctaSubtext}>
              We'll analyze restaurant websites to find vegetarian and vegan options
            </Text>
          </View>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  
  background: {
    flex: 1,
  },
  
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.container.padding,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  
  heroSection: {
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  
  logoContainer: {
    marginBottom: Spacing.lg,
  },
  
  logoBackground: {
    width: 100,
    height: 100,
    backgroundColor: Colors.background.primary,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.shadow.dark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 8,
  },
  
  logoText: {
    fontSize: 48,
  },
  
  title: {
    ...Typography.h1,
    color: Colors.text.inverse,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  
  subtitle: {
    ...Typography.body,
    color: Colors.text.inverse,
    textAlign: 'center',
    opacity: 0.9,
    lineHeight: 24,
    paddingHorizontal: Spacing.md,
  },
  
  featuresSection: {
    marginVertical: Spacing.xl,
  },
  
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  
  featureIcon: {
    fontSize: 24,
    marginRight: Spacing.md,
    width: 32,
    textAlign: 'center',
  },
  
  featureText: {
    ...Typography.body,
    color: Colors.text.inverse,
    opacity: 0.9,
    flex: 1,
  },
  
  ctaSection: {
    alignItems: 'center',
  },
  
  ctaButton: {
    width: '100%',
    marginBottom: Spacing.md,
  },
  
  ctaSubtext: {
    ...Typography.bodySmall,
    color: Colors.text.inverse,
    textAlign: 'center',
    opacity: 0.8,
    lineHeight: 20,
  },
}); 