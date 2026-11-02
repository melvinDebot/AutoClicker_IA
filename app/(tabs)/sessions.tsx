import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { sessionSummariesQuery, type SessionSummary } from '@/adapters/store/repo';
import { formatDateTime, progressPct } from '@/engine/stats';
import {
  Button,
  PageTitle,
  ProgressBar,
  SectionHeader,
  Stat,
  StatusChip,
  STATUS_LABEL,
  STATUS_TILE,
  Text,
  Tile,
} from '@/ui/components';
import { Icon } from '@/ui/Icon';
import { colors } from '@/ui/theme';

function SessionCard({ s }: { s: SessionSummary }) {
  const pct = progressPct(s.processed, s.discoveredCount);
  const likes = s.likesStory + s.likesPost;
  const tile = STATUS_TILE[s.status];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Session @${s.targetAccount}, ${STATUS_LABEL[s.status]}, ${s.processed} traités sur ${s.discoveredCount} détectés, ${likes} likes`}
      onPress={() => router.push({ pathname: '/sessions/[id]', params: { id: s.id } })}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.row}>
        <Tile icon={tile.icon} tone={tile.tone} iconFill={tile.fill} />
        <View style={styles.cardText}>
          <Text weight="bold" numberOfLines={1}>
            Session @{s.targetAccount}
          </Text>
          <Text size={13} color={colors.textMuted} numberOfLines={1} tabular>
            {formatDateTime(s.createdAt)} · {s.processed} traités · {s.discoveredCount} détectés
          </Text>
        </View>
        <Icon name="chevron" size={18} color={colors.chevron} />
      </View>
      <View style={[styles.row, styles.gap10]}>
        <StatusChip status={s.status} />
        <View style={styles.inline}>
          <Icon name="heart" size={15} color={colors.danger} fill />
          <Text size={13} color={colors.textSoft} tabular>
            {likes}
          </Text>
        </View>
        <View style={styles.flex}>
          <ProgressBar pct={pct} />
        </View>
        <Text size={12.5} color={colors.textMuted} tabular>
          {pct} %
        </Text>
      </View>
    </Pressable>
  );
}

export default function SessionsScreen() {
  const { data } = useLiveQuery(sessionSummariesQuery());
  const totals = data.reduce(
    (acc, s) => ({ story: acc.story + s.likesStory, post: acc.post + s.likesPost }),
    { story: 0, post: 0 },
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <FlatList
        data={data}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        ListHeaderComponent={
          <View>
            <PageTitle
              title="Sessions"
              subtitle={data.length ? `${data.length} session${data.length > 1 ? 's' : ''} sur cet iPhone` : 'Historique des lancements'}
            />
            {data.length ? (
              <>
                <View style={styles.stats}>
                  <Stat value={data.length} label="Sessions" icon="layers" tone="violet" />
                  <Stat value={totals.story} label="Stories likées" icon="heart" tone="pink" iconFill />
                  <Stat value={totals.post} label="Posts likés" icon="grid" tone="lavender" />
                </View>
                <SectionHeader title="Toutes les sessions" />
              </>
            ) : null}
          </View>
        }
        renderItem={({ item }) => <SessionCard s={item} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Tile icon="layers" tone="violet" size={64} />
            <Text weight="extrabold" size={20}>
              Aucune session
            </Text>
            <Text size={14.5} color={colors.textMuted} style={styles.center}>
              Chaque lancement crée une session, par exemple « Session @atelier.lumen ».
            </Text>
            <Button label="Aller à l’accueil" size="sm" onPress={() => router.navigate('/')} style={styles.emptyBtn} />
          </View>
        }
        ListFooterComponent={
          data.length ? (
            <Text size={12.5} color={colors.textFaint} style={styles.foot}>
              La progression est sauvegardée après chaque compte, sur l’appareil. Touchez une session pour voir les comptes
              traités ou la reprendre.
            </Text>
          ) : undefined
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  stats: { flexDirection: 'row', gap: 10, marginTop: 18 },
  sep: { height: 10 },
  card: {
    gap: 12,
    padding: 14,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardPressed: { backgroundColor: colors.cardPressed },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  gap10: { gap: 10 },
  cardText: { flex: 1, minWidth: 0, gap: 2 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  empty: { alignItems: 'center', gap: 10, paddingTop: 60, paddingHorizontal: 20 },
  emptyBtn: { alignSelf: 'center', paddingHorizontal: 22, marginTop: 6 },
  foot: { marginTop: 16, marginHorizontal: 6, lineHeight: 19 },
});
