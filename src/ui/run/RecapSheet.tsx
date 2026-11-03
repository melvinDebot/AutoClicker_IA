import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { updateSettings, useSettings } from '@/adapters/settings';
import { CAP_LIMITS, cooldownUntil, PACES, paceRange } from '@/engine/settings';
import { formatDateTime, likesText } from '@/engine/stats';
import { Button, Stepper, Text } from '../components';
import { Icon, type IconName } from '../Icon';
import { colors } from '../theme';
import { Sheet } from './Sheet';
import type { Phase } from './useRunner';

type Recap = Extract<Phase, { name: 'recap' }>;

function Line({ icon, label, value, tone }: { icon: IconName; label: string; value: string; tone?: 'danger' | 'ok' }) {
  const c = tone === 'danger' ? colors.dangerText : tone === 'ok' ? colors.successText : colors.text;
  return (
    <View style={styles.line} accessible accessibilityLabel={`${label} : ${value}`}>
      <Icon name={icon} size={18} color={colors.textMuted} />
      <Text size={14.5} color={colors.textMuted} style={styles.flex}>
        {label}
      </Text>
      <Text weight="bold" size={14.5} color={c} tabular style={styles.value}>
        {value}
      </Text>
    </View>
  );
}

/** Explicit validation before any run (target, story, posts, likes target, pace, dry run). */
export function RecapSheet({ phase, onConfirm, onCancel }: { phase: Recap; onConfirm: (resume: boolean) => void; onCancel: () => void }) {
  // Live settings: the likes target can be changed right here before launching.
  const s = useSettings();
  const r = phase.resumable;
  const blockedUntil = s.dryRun ? null : cooldownUntil(phase.lastWarning, Date.now());
  const realBlocked = !s.dryRun && (!phase.visionReady || blockedUntil !== null);
  return (
    <Sheet visible title="Récapitulatif" onClose={onCancel}>
      <View style={styles.card}>
        <Line icon="user" label="Compte cible" value={`@${phase.targetAccount}`} />
        <Line icon="heart" label="Liker la story" value={s.likeStory ? 'Oui' : s.storyIfNoPosts ? 'Si aucun post' : 'Non'} />
        <Line icon="grid" label="Posts par compte" value={String(s.postsPerUser)} />
        <Stepper
          label="Likes à envoyer"
          unit="likes"
          value={s.maxLikesPerSession}
          {...CAP_LIMITS.perSession}
          onChange={(v) => updateSettings({ maxLikesPerSession: v })}
        />
        <Line icon="shield" label="Plafond du jour" value={`${phase.today} / ${s.maxLikesPerDay} likes`} />
        <Line icon="pause" label="Rythme" value={`${PACES[s.pace].label} · ${PACES[s.pace].between[0] / 1000}–${PACES[s.pace].between[1] / 1000} s`} />
        <Line icon="timer" label="Arrêt automatique" value={s.autoStopMin ? `${s.autoStopMin} min` : 'Jamais'} />
        <Line icon="eye" label="Essai à blanc" value={s.dryRun ? 'Activé' : 'Désactivé'} tone={s.dryRun ? 'ok' : 'danger'} />
      </View>

      {s.dryRun ? (
        <Text size={13} color={colors.textMuted} style={styles.note}>
          Essai à blanc : l’app ouvre les profils et les stories, puis surligne les cœurs qu’elle toucherait, sans envoyer aucun j’aime.
        </Text>
      ) : (
        <View style={styles.warn}>
          <Text weight="bold" size={13.5} color={colors.dangerText}>
            Exécution réelle
          </Text>
          <Text size={13} color={colors.textSoft} style={styles.lh}>
            Les j’aime seront envoyés depuis votre compte. Arrêt immédiat au moindre avertissement d’Instagram.
          </Text>
        </View>
      )}
      {blockedUntil !== null && phase.lastWarning !== null ? (
        <Text size={13} color={colors.dangerText} style={styles.note}>
          Instagram a limité le compte le {formatDateTime(phase.lastWarning)} : aucun vrai like avant le {formatDateTime(blockedUntil)}.
          Activez l’essai à blanc ou revenez plus tard.
        </Text>
      ) : realBlocked ? (
        <Text size={13} color={colors.dangerText} style={styles.note}>
          Le module de vision de ce build est trop ancien : reconstruisez l’app ou activez l’essai à blanc.
        </Text>
      ) : null}

      <Text size={13} color={colors.textFaint} style={styles.note}>
        La session s’arrête après {likesText(s.maxLikesPerSession, s.dryRun)}, quel que soit le nombre de comptes ({phase.visibleRows}{' '}
        visibles au départ, d’autres s’ajoutent en défilant). Pause de {paceRange(s.pace)}.
      </Text>

      {r ? (
        <>
          <Text size={13.5} color={colors.textSoft} style={styles.note}>
            Session du {formatDateTime(r.createdAt)} en pause ({r.discoveredCount} comptes détectés). La reprise saute les comptes déjà
            traités sans rouvrir leur profil.
          </Text>
          <Button label="Reprendre la session" icon="play" iconFill onPress={() => onConfirm(true)} disabled={realBlocked} />
          <Button label="Nouvelle session" variant="dark" onPress={() => onConfirm(false)} disabled={realBlocked} />
        </>
      ) : (
        <Button label="Valider et lancer" icon="play" iconFill onPress={() => onConfirm(false)} disabled={realBlocked} />
      )}
      <Button
        label="Modifier les réglages"
        variant="ghost"
        size="sm"
        onPress={() => {
          onCancel();
          router.navigate('/settings');
        }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  lh: { lineHeight: 19 },
  value: { maxWidth: '55%', textAlign: 'right' },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  note: { marginHorizontal: 4, lineHeight: 19 },
  warn: { padding: 12, borderRadius: 14, backgroundColor: colors.dangerBg, gap: 2 },
});
