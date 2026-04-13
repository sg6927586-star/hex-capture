import React, { useState, useEffect } from 'react';
import { Platform, View, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useFonts, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { Manrope_400Regular, Manrope_700Bold } from '@expo-google-fonts/manrope';
import { COLORS, FONTS } from './theme';
import { supabase } from './supabase';

import AuthScreen from './screens/AuthScreen';
import HudScreen from './screens/HudScreen';
import MapScreen from './screens/MapScreen';
import LogsScreen from './screens/LogsScreen';

const Tab = createBottomTabNavigator();

const TabIcon = ({ label, icon, focused }) => (
  <View style={ti.wrap}>
    <Text style={[ti.icon, focused && ti.iconActive]}>{icon}</Text>
    <Text style={[ti.label, focused && ti.labelActive]}>{label}</Text>
    {focused && <View style={ti.dot} />}
  </View>
);

const ti = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingTop: 6 },
  icon: { fontSize: 20, color: COLORS.onSurfaceMuted, marginBottom: 2 },
  iconActive: { color: COLORS.primary },
  label: { fontFamily: FONTS.headBold, fontSize: 9, color: COLORS.onSurfaceMuted, letterSpacing: 1.5 },
  labelActive: { color: COLORS.primary },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.primary, marginTop: 4 },
});

export default function App() {
  const [fontsLoaded] = useFonts({ SpaceGrotesk_700Bold, Manrope_400Regular, Manrope_700Bold });
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthReady(true);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!fontsLoaded || !authReady) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: COLORS.primary, fontWeight: '700', fontSize: 16, letterSpacing: 2 }}>
          LOADING…
        </Text>
      </View>
    );
  }

  // NOT LOGGED IN → show auth screen
  if (!session) {
    return <AuthScreen />;
  }

  // LOGGED IN → show the app
  return (
    <NavigationContainer>
      <Tab.Navigator
        initialRouteName="Map"
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: COLORS.surface,
            borderTopWidth: 1,
            borderTopColor: COLORS.surfaceContainerLow,
            height: Platform.OS === 'ios' ? 88 : 68,
            paddingBottom: Platform.OS === 'ios' ? 24 : 8,
            elevation: 0,
          },
          tabBarShowLabel: false,
        }}
      >
        <Tab.Screen name="Profile" component={HudScreen}
          options={{ tabBarIcon: ({ focused }) => <TabIcon label="PROFILE" icon="◉" focused={focused} /> }}
        />
        <Tab.Screen name="Map" component={MapScreen}
          options={{ tabBarIcon: ({ focused }) => <TabIcon label="MAP" icon="◎" focused={focused} /> }}
        />
        <Tab.Screen name="Logs" component={LogsScreen}
          options={{ tabBarIcon: ({ focused }) => <TabIcon label="RUNS" icon="▤" focused={focused} /> }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}