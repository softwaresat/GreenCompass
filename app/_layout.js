import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Colors from '../constants/Colors';

export default function Layout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          headerStyle: {
            backgroundColor: Colors.primary[500],
          },
          headerTintColor: Colors.text.inverse,
          headerTitleStyle: {
            fontWeight: '600',
          },
          headerShadowVisible: false,
          contentStyle: {
            backgroundColor: Colors.background.secondary,
          },
        }}
      >
        <Stack.Screen 
          name="index" 
          options={{ 
            title: 'GreenCompass',
          }} 
        />
        <Stack.Screen 
          name="results" 
          options={{ 
            title: 'Nearby Restaurants',
          }} 
        />
        <Stack.Screen 
          name="analysis" 
          options={{ 
            title: 'Menu Analysis',
          }} 
        />
        <Stack.Screen 
          name="saved-restaurants" 
          options={{ 
            title: 'Saved Restaurants',
          }} 
        />
        <Stack.Screen 
          name="saved-analysis" 
          options={{ 
            title: 'Saved Analysis',
          }} 
        />
      </Stack>
    </>
  );
} 