import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { Icon, type IconName } from '@/ui/Icon';
import { colors, fonts } from '@/ui/theme';

const tabIcon =
  (name: IconName) =>
  ({ color }: { color: ColorValue }) => <Icon name={name} color={color} />;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: {
          backgroundColor: 'rgba(22,21,31,0.96)',
          borderTopColor: 'rgba(255,255,255,0.06)',
        },
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11.5 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Accueil', tabBarIcon: tabIcon('home') }} />
      <Tabs.Screen name="sessions" options={{ title: 'Sessions', tabBarIcon: tabIcon('layers') }} />
      <Tabs.Screen name="settings" options={{ title: 'Réglages', tabBarIcon: tabIcon('sliders') }} />
    </Tabs>
  );
}
