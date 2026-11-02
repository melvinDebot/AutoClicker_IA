import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { sessionSummaryQuery } from '@/adapters/store/repo';
import { formatDuration } from '@/engine/stats';
import { Button, Stat, Text, Tile } from '../components';
import { colors } from '../theme';
import { Sheet } from './Sheet';
import type { Phase } from './useRunner';

type Summary = Extract<Phase, { name: 'summary' }>;

export function SummarySheet({ phase, onClose, onResume }: { phase: Summary; onClose: () => void; onResume: () => void }) {
  const { data } = useLiveQuery(sessionSummaryQuery(phase.sessionId), [phase.sessionId]);
  const s = data[0];
  const done = phase.outcome.status === 'done';
  const time = new Date(phase.savedAt);
  const hhmm = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
  return (
    <Sheet visible title={done ? 'Session terminée' : 'Session en pause'} onClose={onClose}>
      <View style={styles.top} accessible accessibilityLabel={`${done ? 'Terminée' : 'En pause'} : ${phase.outcome.reason}`}>
        <Tile icon={done ? 'check' : 'pause'} tone={done ? 'violet' : 'yellow'} size={64} />
        <Text weight="extrabold" size={22}>
          {done ? 'Terminée' : 'En pause'}
        </Text>
        <Text size={14.5} color={colors.textMuted} style={styles.center}>
          Session @{phase.targetAccount} · {phase.outcome.reason}
        </Text>
      </View>
      <View style={styles.grid}>
        <View style={styles.row}>
          <Stat value={s?.processed ?? 0} label={`Comptes traités · ${s?.discoveredCount ?? 0} détectés`} />
          <Stat value={s?.privateCount ?? 0} label="Privés ignorés" />
        </View>
        <View style={styles.row}>
          <Stat value={s?.likesStory ?? 0} label="Stories likées" />
          <Stat value={s?.likesPost ?? 0} label="Posts likés" />
        </View>
      </View>
      {phase.dryRun ? (
        <Text size={13} color={colors.successText} style={styles.center}>
          Essai à blanc : aucun j’aime n’a été envoyé.
        </Text>
      ) : null}
      <Text size={13} color={colors.textFaint} style={styles.center}>
        Sauvegardée à {hhmm} · durée {formatDuration(s?.elapsedMs ?? 0)}
      </Text>
      {!done ? <Button label="Reprendre" icon="play" iconFill onPress={onResume} /> : null}
      <Button
        label="Voir la session"
        variant="success"
        onPress={() => {
          onClose();
          router.push({ pathname: '/sessions/[id]', params: { id: phase.sessionId } });
        }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  top: { alignItems: 'center', gap: 8, paddingTop: 4 },
  center: { textAlign: 'center' },
  grid: { gap: 10 },
  row: { flexDirection: 'row', gap: 10 },
});
