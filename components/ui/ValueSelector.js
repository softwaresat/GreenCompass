import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Colors from '../../constants/Colors';
import Spacing from '../../constants/Spacing';
import Typography from '../../constants/Typography';

export default function ValueSelector({ 
  value, 
  onValueChange, 
  options = [],
  style,
  label
}) {
  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.optionsContainer}>
        {options.map((option, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.option,
              value === option.value && styles.selectedOption
            ]}
            onPress={() => onValueChange(option.value)}
          >
            <Text style={[
              styles.optionText,
              value === option.value && styles.selectedOptionText
            ]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: Spacing.sm,
  },
  
  label: {
    ...Typography.h6,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  
  option: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.background.tertiary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border.medium,
  },
  
  selectedOption: {
    backgroundColor: Colors.primary[500],
    borderColor: Colors.primary[500],
  },
  
  optionText: {
    ...Typography.bodySmall,
    color: Colors.text.primary,
    fontWeight: Typography.fontWeight.medium,
  },
  
  selectedOptionText: {
    color: Colors.text.inverse,
    fontWeight: Typography.fontWeight.semibold,
  },
});
