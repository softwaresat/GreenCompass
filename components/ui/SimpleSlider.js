import { useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Colors from '../../constants/Colors';
import Spacing from '../../constants/Spacing';
import Typography from '../../constants/Typography';

export default function SimpleSlider({ 
  value, 
  onValueChange, 
  minimumValue = 0, 
  maximumValue = 100, 
  step = 1,
  style,
  minimumLabel,
  maximumLabel 
}) {
  const trackRef = useRef(null);
  const range = maximumValue - minimumValue;
  const normalizedValue = ((value - minimumValue) / range) * 100;

  const handleLayout = (event) => {
    if (trackRef.current) {
      trackRef.current.measure((x, y, width, height, pageX, pageY) => {
        trackRef.current.layout = { x: pageX, y: pageY, width, height };
      });
    }
  };

  const handlePress = (event) => {
    const { locationX } = event.nativeEvent;
    
    // Use a default width if measure hasn't completed yet
    let trackWidth = 300;
    if (trackRef.current && trackRef.current.layout) {
      trackWidth = trackRef.current.layout.width;
    }
    
    const percentage = Math.max(0, Math.min(1, locationX / trackWidth));
    const newValue = minimumValue + (range * percentage);
    const steppedValue = Math.round(newValue / step) * step;
    const clampedValue = Math.max(minimumValue, Math.min(maximumValue, steppedValue));
    onValueChange(clampedValue);
  };

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        ref={trackRef}
        style={styles.track}
        onPress={handlePress}
        onLayout={handleLayout}
        activeOpacity={0.8}
      >
        <View style={styles.trackBackground} />
        <View 
          style={[
            styles.trackFill, 
            { width: `${Math.max(0, Math.min(100, normalizedValue))}%` }
          ]} 
        />
        <View 
          style={[
            styles.thumb, 
            { left: `${Math.max(0, Math.min(100, normalizedValue))}%` }
          ]} 
        />
      </TouchableOpacity>
      
      {(minimumLabel || maximumLabel) && (
        <View style={styles.labels}>
          <Text style={styles.label}>{minimumLabel || minimumValue}</Text>
          <Text style={styles.label}>{maximumLabel || maximumValue}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: Spacing.sm,
  },
  
  track: {
    height: 40,
    justifyContent: 'center',
    position: 'relative',
  },
  
  trackBackground: {
    height: 6,
    backgroundColor: Colors.border.medium,
    borderRadius: 3,
  },
  
  trackFill: {
    position: 'absolute',
    height: 6,
    backgroundColor: Colors.primary[500],
    borderRadius: 3,
  },
  
  thumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    backgroundColor: Colors.primary[500],
    borderRadius: 10,
    marginLeft: -10,
    marginTop: -7,
    shadowColor: Colors.shadow.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  
  label: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
  },
});
