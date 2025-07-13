import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function Layout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: '#4CAF50',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen 
          name="index" 
          options={{ 
            title: 'GreenCompass',
            headerShown: true 
          }} 
        />
        <Stack.Screen 
          name="results" 
          options={{ 
            title: 'Nearby Restaurants',
            headerShown: true 
          }} 
        />
        <Stack.Screen 
          name="analysis" 
          options={{ 
            title: 'Menu Analysis',
            headerShown: true 
          }} 
        />
      </Stack>
    </>
  );
} 