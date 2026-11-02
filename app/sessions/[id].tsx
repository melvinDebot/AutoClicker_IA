import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { deleteSession, handledUsersQuery, sessionSummaryQuery } from '@/adapters/store/repo';
import type { SessionUserRow } from '@/adapters/store/schema';
import { formatDateTime, formatDuration, parsePostResults, progressPct } from '@/engine/stats';
import { Avatar, Button, Card, ProgressBar, SectionHeader, StatusChip, STATUS_TILE, Text, Tile, useToast } from '@/ui/components';
import { Icon, type IconName } from '@/ui/Icon';
import { colors, HIT } from '@/ui/theme';

function userLine(u: SessionUserRow): { sub: string; liked: boolean; icon: IconName | null; color: string } {
  if (u.state === 'processing') return { sub: 'En cours…', liked: false, icon: null, color: colors.accentStrong };
  if (u.state === 'error') return { sub: 'Erreur, compte ignoré', liked: false, icon: 'alert', color: colors.dangerText };
  if (u.privacy === 'private') return { sub: 'Compte privé · ignoré', liked: false, icon: 'lock', color: colors.textFaint };
  const posts = parsePostResults(u.postsResultJson).filter((r) => r === 'liked').length;
  const simulated = parsePostResults(u.postsResultJson).filter((r) => r === 'skipped').length + (u.storyResult === 'skipped' ? 1 : 0);
  const parts = [
    u.storyResult === 'liked' ? 'Story likée' : u.storyResult === 'none' ? 'Pas de story' : u.storyResult === 'already' ? 'Story déjà likée' : null,
    posts ? `${posts} post${posts > 1 ? 's' : ''} liké${posts > 1 ? 's' : ''}` : null,
    simulated ? `${simulated} like${simulated > 1 ? 's' : ''} simulé${simulated > 1 ? 's' : ''} (essai à blanc)` : null,
  ].filter(Boolean);
  const liked = u.storyResult === 'liked' || posts > 0;
  return { sub: parts.join(' · ') || 'Rien à liker', liked, icon: 'check', color: colors.successText };
}

export default function SessionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const { data: rows } = useLiveQuery(sessionSummaryQuery(id), [id]);
  const { data: users } = useLiveQuery(handledUsersQuery(id), [id]);
  const s = rows[0];

  const confirmDelete = () =>
    Alert.alert('Supprimer la session ?', 'Les comptes traités et la progression de cette session seront effacés.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          await deleteSession(id);
          toast('Session supprimée');
          router.back();
        },
      },
    ]);

  // Opens the followers list of the account on the Home tab; the user launches again
  // (scan, summary, countdown) and the engine skips the accounts already handled.
  const resume = () => {
    router.back();
    router.navigate({ pathname: '/', params: { resume: id } });
  };

  const header = (
    <View style={styles.sheetHead}>
      <View style={styles.grab} />
      <View style={styles.headRow}>
        <View style={styles.side} />
        <Text weight="bold" size={17} style={styles.headTitle} accessibilityRole="header">
          Session
        </Text>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={[styles.side, styles.close]}>
          <Text weight="bold" color={colors.accent}>
            Fermer
          </Text>
        </Pressable>
      </View>
    </View>
  );

  if (!s) {
    return (
      <View style={styles.screen}>
        {header}
        <Text color={colors.textMuted} style={styles.pad}>
          Session introuvable.
        </Text>
      </View>
    );
  }

  const pct = progressPct(s.processed, s.discoveredCount);
  const tile = STATUS_TILE[s.status];
  const remaining = s.discoveredCount - s.processed;
  const dryRun = (() => {
    try {
      return JSON.parse(s.settingsJson).dryRun !== false;
    } catch {
      return true;
    }
  })();
  const canResume = s.status === 'paused' || s.status === 'interrupted';

  return (
    <View style={styles.screen}>
      {header}
      <FlatList
        data={users}
        keyExtractor={(u) => u.username}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View>
            <View style={styles.titleRow}>
              <Tile icon={tile.icon} tone={tile.tone} size={52} iconFill={tile.fill} />
              <View style={styles.titleText}>
                <Text weight="extrabold" size={19} numberOfLines={1}>
                  Session @{s.targetAccount}
                </Text>
                <View style={styles.inlineWrap}>
                  <StatusChip status={s.status} />
                  {dryRun ? (
                    <View style={styles.dry}>
                      <Text weight="bold" size={12} color={colors.warning}>
                        Essai à blanc
                      </Text>
                    </View>
                  ) : null}
                  <Text size={13} color={colors.textMuted} tabular>
                    {formatDateTime(s.createdAt)} · {formatDuration(s.elapsedMs)}
                  </Text>
                </View>
              </View>
            </View>
            <Card style={styles.statsCard}>
              <View style={styles.between}>
                <Text weight="bold" size={14.5} tabular>
                  {s.processed} traités · {s.discoveredCount} détectés
                </Text>
                <Text size={14.5} color={colors.textMuted} tabular>
                  {pct} %
                </Text>
              </View>
              <ProgressBar pct={pct} label={`Progression : ${pct} % des comptes détectés`} />
              <View style={styles.inlineWrap}>
                <Metric icon="heart" pink value={`${s.likesStory} stories`} />
                <Metric icon="heart" pink value={`${s.likesPost} posts`} />
                <Metric icon="lock" value={`${s.privateCount} privés`} />
              </View>
            </Card>
            {s.endReason ? (
              <Text size={13} color={colors.textMuted} style={styles.note}>
                {s.endReason}
                {s.listEndReached ? '' : ' · le nombre total d’abonnés n’est pas connu à l’avance.'}
              </Text>
            ) : null}
            {canResume ? (
              <Button label="Reprendre la session" icon="play" iconFill onPress={resume} style={styles.mt14} />
            ) : null}
            <SectionHeader title="Comptes traités" />
            {users.length === 0 ? (
              <Text size={14} color={colors.textMuted} style={styles.pad4}>
                Aucun compte traité pour l’instant.
              </Text>
            ) : null}
          </View>
        }
        renderItem={({ item: u, index }) => {
          const l = userLine(u);
          return (
            <View
              style={[styles.accRow, index === 0 && styles.accFirst, index === users.length - 1 && styles.accLast]}
              accessible
              accessibilityLabel={`${u.username}, ${l.sub}`}
            >
              <Avatar username={u.username} size={40} />
              <View style={styles.titleText}>
                <Text weight="bold" size={15} numberOfLines={1}>
                  {u.username}
                </Text>
                <View style={styles.inline}>
                  {l.liked ? <Icon name="heart" size={14} color={colors.danger} fill /> : null}
                  <Text size={13} color={colors.textMuted}>
                    {l.sub}
                  </Text>
                </View>
              </View>
              {l.icon ? <Icon name={l.icon} size={20} color={l.color} /> : null}
            </View>
          );
        }}
        ListFooterComponent={
          <View>
            {remaining > 0 && s.status !== 'done' ? (
              <Text size={13} color={colors.textFaint} style={styles.note}>
                {remaining} compte{remaining > 1 ? 's' : ''} détecté{remaining > 1 ? 's' : ''} reste
                {remaining > 1 ? 'nt' : ''} à traiter. D’autres apparaîtront en faisant défiler la liste.
              </Text>
            ) : null}
            <Button label="Supprimer la session" variant="danger" size="sm" onPress={confirmDelete} style={styles.mt18} />
          </View>
        }
      />
    </View>
  );
}

function Metric({ icon, value, pink }: { icon: IconName; value: string; pink?: boolean }) {
  return (
    <View style={styles.inline}>
      <Icon name={icon} size={15} color={pink ? colors.danger : colors.textSoft} fill={pink} />
      <Text size={13.5} color={colors.textSoft} tabular>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.sheet },
  pad: { padding: 16 },
  pad4: { marginHorizontal: 4 },
  sheetHead: { paddingHorizontal: 16 },
  grab: { width: 38, height: 5, borderRadius: 3, backgroundColor: colors.switchOff, alignSelf: 'center', marginTop: 8 },
  headRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 6, paddingBottom: 4 },
  side: { minWidth: 70, minHeight: HIT, justifyContent: 'center' },
  close: { alignItems: 'flex-end' },
  headTitle: { flex: 1, textAlign: 'center' },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 12 },
  titleText: { flex: 1, minWidth: 0, gap: 4 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  inlineWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', columnGap: 16 },
  statsCard: { padding: 14, marginTop: 14, gap: 10 },
  between: { flexDirection: 'row', justifyContent: 'space-between' },
  note: { marginTop: 10, marginHorizontal: 4, lineHeight: 19 },
  mt14: { marginTop: 14 },
  dry: { height: 26, paddingHorizontal: 10, borderRadius: 999, justifyContent: 'center', backgroundColor: 'rgba(245,184,61,0.15)' },
  mt18: { marginTop: 18 },
  accRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  accFirst: { borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  accLast: { borderBottomLeftRadius: 20, borderBottomRightRadius: 20, borderBottomWidth: 0 },
});
