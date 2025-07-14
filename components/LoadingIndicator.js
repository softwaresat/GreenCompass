import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Colors from '../constants/Colors';
import Typography from '../constants/Typography';
import Spacing from '../constants/Spacing';

export default function LoadingIndicator({ 
  message = 'Loading...', 
  progress = null,
  stage = null 
}) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <ActivityIndicator size="large" color={Colors.primary[500]} />
        
        {stage && (
          <Text style={styles.stage}>{stage}</Text>
        )}
        
        <Text style={styles.message}>{message}</Text>
        
        {progress && (
          <View style={styles.progressContainer}>
            {progress.map((step, index) => (
              <View key={step.key} style={styles.progressStep}>
                <View style={[
                  styles.progressDot,
                  step.completed && styles.progressDotCompleted
                ]}>
                  {step.completed && (
                    <Text style={styles.progressCheck}>✓</Text>
                  )}
                </View>
                <Text style={[
                  styles.progressLabel,
                  step.completed && styles.progressLabelCompleted
                ]}>
                  {step.label}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background.secondary,
  },
  
  content: {
    alignItems: 'center',
    paddingHorizontal: Spacing.container.padding,
  },
  
  stage: {
    ...Typography.h5,
    color: Colors.text.primary,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  
  message: {
    ...Typography.body,
    color: Colors.text.secondary,
    marginTop: Spacing.lg,
    textAlign: 'center',
    lineHeight: 24,
  },
  
  progressContainer: {
    marginTop: Spacing.xl,
    width: '100%',
    maxWidth: 300,
  },
  
  progressStep: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  
  progressDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.border.medium,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  
  progressDotCompleted: {
    backgroundColor: Colors.primary[500],
  },
  
  progressCheck: {
    color: Colors.text.inverse,
    fontSize: 12,
    fontWeight: Typography.fontWeight.bold,
  },
  
  progressLabel: {
    ...Typography.bodySmall,
    color: Colors.text.tertiary,
    flex: 1,
  },
  
  progressLabelCompleted: {
    color: Colors.text.primary,
    fontWeight: Typography.fontWeight.medium,
  },
}); 