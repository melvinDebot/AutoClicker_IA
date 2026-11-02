import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { Icon, type IconName } from '@/ui/Icon';
import { colors, fonts, TAB_BAR_STYLE } from '@/ui/theme';

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
        tabBarStyle: TAB_BAR_STYLE,
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11.5 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Accueil', tabBarIcon: tabIcon('home') }} />
      <Tabs.Screen name="sessions" options={{ title: 'Sessions', tabBarIcon: tabIcon('layers') }} />
      <Tabs.Screen name="settings" options={{ title: 'Réglages', tabBarIcon: tabIcon('sliders') }} />
    </Tabs>
  );
}
