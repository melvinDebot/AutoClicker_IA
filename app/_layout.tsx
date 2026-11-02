// Subpath imports: only the five weights used are bundled.
import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import migrations from '../drizzle/migrations';
import { db } from '@/adapters/store/db';
import { Text, ToastProvider } from '@/ui/components';
import { colors } from '@/ui/theme';

SystemUI.setBackgroundColorAsync(colors.bg).catch(() => {});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  const { success, error } = useMigrations(db, migrations);

  if (error) {
    return (
      <View style={styles.center}>
        <Text weight="bold">Base de données inaccessible</Text>
        <Text size={13} color={colors.textMuted}>
          {error.message}
        </Text>
      </View>
    );
  }
  if (!fontsLoaded || !success) return <View style={styles.fill} />;

  return (
    <SafeAreaProvider>
      <ToastProvider>
        {/* The app is drawn dark by hand; the system appearance stays light so Instagram renders light in the WebView. */}
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="sessions/[id]" options={{ presentation: 'modal', contentStyle: { backgroundColor: colors.sheet } }} />
        </Stack>
      </ToastProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 6, padding: 24 },
});
