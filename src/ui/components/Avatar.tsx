import { StyleSheet, View } from 'react-native';

import { Text } from './Text';

// Pastel pairs from the prototype. No profile photo is ever stored: initials only.
const PAIRS = [
  ['#DCE6FB', '#1F3F99'],
  ['#FBE3D3', '#8A3A0C'],
  ['#DFF1E4', '#1D5C33'],
  ['#EDE3F7', '#5B2C86'],
  ['#F6E7B8', '#6B4A00'],
  ['#E3E6E9', '#363C43'],
] as const;

export function initialsOf(username: string): string {
  const parts = username.replace(/^@/, '').split(/[\s._]+/).filter(Boolean);
  return (((parts[0] ?? '?').charAt(0) + (parts[1] ?? '').charAt(0)) || '?').toUpperCase();
}

function pairFor(username: string) {
  let h = 0;
  for (let i = 0; i < username.length; i++) h = (h * 31 + username.charCodeAt(i)) >>> 0;
  return PAIRS[h % PAIRS.length] ?? PAIRS[0];
}

export function Avatar({ username, size = 40 }: { username: string; size?: number }) {
  const [bg, fg] = pairFor(username);
  return (
    <View
      style={[styles.av, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}
      accessible={false}
    >
      <Text weight="bold" size={Math.round(size * 0.32)} color={fg}>
        {initialsOf(username)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  av: { alignItems: 'center', justifyContent: 'center' },
});
