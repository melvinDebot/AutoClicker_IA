import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { clearICloud, restoreFromICloud, setCloudEnabled, useCloudState } from '@/adapters/cloudBackup';
import { resetSettings, updateSettings, useSettings } from '@/adapters/settings';
import { seedDemoSessions } from '@/adapters/store/demoData';
import { likesToday, wipeAllData } from '@/adapters/store/repo';
import { lastInstagramWarning } from '@/adapters/store/sessionStore';
import { CAP_LIMITS, PACES, paceRange, settingsStatus, type SettingsStatus } from '@/engine/settings';
import { formatDateTime } from '@/engine/stats';
import type { AutoStop, Pace, PostsPerUser } from '@/engine/types';
import { RULES_VERSION, TEMPLATES_VERSION } from '@/recognition/rules';
import {
  Button,
  InfoRow,
  PageTitle,
  RadioGroup,
  SectionHeader,
  Segmented,
  SettingBlock,
  SettingHeader,
  Stepper,
  SwitchRow,
  Text,
  useToast,
} from '@/ui/components';
import { Icon, type IconName } from '@/ui/Icon';
import { colors } from '@/ui/theme';
import { VisionCheckNative } from '../../modules/vision-check';

const POSTS: { value: PostsPerUser; label: string }[] = [0, 1, 2, 3].map((n) => ({
  value: n as PostsPerUser,
  label: String(n),
}));

const PACE_OPTIONS: { value: Pace; label: string; sub: string }[] = (Object.keys(PACES) as Pace[]).map((p) => ({
  value: p,
  label: PACES[p].label,
  sub: paceRange(p),
}));

const STATUS_LOOK: Record<SettingsStatus['level'], { icon: IconName; color: string; bg: string; border: string }> = {
  prudent: { icon: 'checkCircle', color: colors.successText, bg: 'rgba(52,211,153,0.10)', border: 'rgba(52,211,153,0.30)' },
  risky: { icon: 'alert', color: colors.warning, bg: 'rgba(245,184,61,0.10)', border: 'rgba(245,184,61,0.35)' },
  blocked: { icon: 'alert', color: colors.dangerText, bg: 'rgba(255,90,110,0.10)', border: 'rgba(255,90,110,0.25)' },
};

/** iCloud backup: the sessions in progress come back after a reinstall or on another iPhone. */
function CloudBlock() {
  const c = useCloudState();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  if (!c.available) {
    return (
      <SettingBlock>
        <SettingHeader
          icon="refresh"
          tone="teal"
          title="Sauvegarde iCloud"
          description="Absente de cette version (Expo Go, ou dev build fait avant elle) : reconstruire le dev build pour l’activer."
        />
      </SettingBlock>
    );
  }

  const toggle = (on: boolean) => {
    if (on) {
      setCloudEnabled(true)
        .then(() => toast('Sauvegarde iCloud activée'))
        .catch((e: unknown) => Alert.alert('Sauvegarde iCloud', e instanceof Error ? e.message : String(e)));
      return;
    }
    Alert.alert(
      'Désactiver la sauvegarde iCloud ?',
      'La copie de vos sessions sur votre compte Apple sera supprimée. Les données de cet iPhone ne changent pas.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Désactiver',
          style: 'destructive',
          onPress: () => setCloudEnabled(false).catch((e: unknown) => Alert.alert('Sauvegarde iCloud', String(e))),
        },
      ],
    );
  };

  const restore = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const n = await restoreFromICloud();
      toast(n === 0 ? 'Rien de plus récent dans iCloud' : `${n} session${n > 1 ? 's' : ''} récupérée${n > 1 ? 's' : ''}`);
    } catch (e) {
      Alert.alert('Restauration impossible', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingBlock>
      <SwitchRow
        icon="refresh"
        tone="teal"
        title="Sauvegarde iCloud"
        description="Sessions et progression, réglages, likes du jour et dernier avertissement d’Instagram, sur votre compte Apple. Après une réinstallation ou sur un autre iPhone connecté au même compte, les sessions en cours reviennent et se reprennent."
        value={c.enabled}
        onChange={toggle}
      />
      {c.enabled ? (
        <>
          <InfoRow label="Compte iCloud" value={c.signedIn ? 'Connecté' : 'Non détecté sur cet iPhone'} />
          <InfoRow label="Dernière sauvegarde" value={c.lastBackupAt ? formatDateTime(c.lastBackupAt) : '—'} />
          <InfoRow label="Sessions sauvegardées" value={c.left > 0 ? `${c.saved} (${c.left} anciennes laissées de côté)` : String(c.saved)} />
          {c.error ? (
            <Text size={13} color={colors.warning} style={styles.lh}>
              {c.error}
            </Text>
          ) : null}
          <Button label={busy ? 'Restauration…' : 'Restaurer depuis iCloud'} variant="dark" size="sm" icon="refresh" onPress={restore} />
        </>
      ) : null}
    </SettingBlock>
  );
}

/** Verdict on the settings, at the top: likes per day and pace, prudent or risky. */
function StatusCard({ status, dryRun }: { status: SettingsStatus; dryRun: boolean }) {
  const look = STATUS_LOOK[status.level];
  return (
    <View style={[styles.status, { backgroundColor: look.bg, borderColor: look.border }]} accessible accessibilityRole="text">
      <View style={styles.statusHead}>
        <Icon name={look.icon} size={18} color={look.color} />
        <Text weight="bold" size={15} color={look.color}>
          {status.title}
        </Text>
      </View>
      <Text size={13} color={colors.textSoft} style={styles.lh}>
        {status.text}
      </Text>
      {dryRun ? (
        <Text size={12.5} color={colors.textMuted} style={styles.lh}>
          Essai à blanc activé : aucun j’aime n’est envoyé pour l’instant.
        </Text>
      ) : null}
    </View>
  );
}

const STOPS: { value: AutoStop; label: string }[] = [
  { value: 0, label: 'Jamais' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 h' },
];

export default function SettingsScreen() {
  const s = useSettings();
  const toast = useToast();
  const [today, setToday] = useState(0);
  const [warnedAt, setWarnedAt] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      likesToday().then(setToday).catch(() => {});
      lastInstagramWarning().then(setWarnedAt).catch(() => {});
    }, []),
  );
  const status = settingsStatus(s, warnedAt, Date.now());

  const confirmWipe = () =>
    Alert.alert(
      'Tout effacer ?',
      'Sessions, progression, compteurs, réglages et données de la WebView (dont votre connexion Instagram) seront supprimés de cet iPhone, ainsi que la sauvegarde iCloud.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Tout effacer',
          style: 'destructive',
          onPress: async () => {
            try {
              await wipeAllData();
              await clearICloud();
              resetSettings();
              if (VisionCheckNative.isAvailable()) {
                await VisionCheckNative.releaseAll();
                await VisionCheckNative.clearWebsiteData();
              }
              setToday(0);
              toast('Données effacées');
            } catch (e) {
              Alert.alert('Effacement incomplet', e instanceof Error ? e.message : String(e));
            }
          },
        },
      ],
    );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <PageTitle title="Réglages" />

        <StatusCard status={status} dryRun={s.dryRun} />

        <View style={styles.warning} accessible accessibilityRole="text">
          <Text weight="bold" size={14} color={colors.dangerText}>
            Conditions d’utilisation d’Instagram
          </Text>
          <Text size={13} color={colors.textSoft} style={styles.lh}>
            Les likes automatisés sont contraires aux conditions d’utilisation d’Instagram et peuvent entraîner la
            restriction du compte.
          </Text>
        </View>

        <SectionHeader title="Sur chaque compte" />
        <SettingBlock>
          <SwitchRow
            icon="heart"
            tone="pink"
            iconFill
            title="Liker la story"
            description="Ouvre la story en cours et envoie un j’aime."
            value={s.likeStory}
            onChange={(v) => updateSettings({ likeStory: v })}
          />
          <SwitchRow
            icon="heart"
            tone="lavender"
            title="Story si aucun post"
            description="Like la story des comptes sans publication, même quand « Liker la story » est désactivé."
            value={s.storyIfNoPosts}
            onChange={(v) => updateSettings({ storyIfNoPosts: v })}
          />
        </SettingBlock>
        <SettingBlock>
          <SettingHeader
            icon="grid"
            tone="lavender"
            title="Liker les derniers posts"
            description="Touche le bouton J’aime des publications les plus récentes. Un post déjà liké n’est jamais touché."
          />
          <Segmented
            label="Nombre de posts à liker"
            value={s.postsPerUser}
            options={POSTS}
            onChange={(v) => updateSettings({ postsPerUser: v })}
          />
          <Text size={12.5} color={colors.textFaint}>
            Les comptes privés sont ignorés.
          </Text>
        </SettingBlock>

        <SectionHeader title="Session" />
        <SettingBlock>
          <SettingHeader
            icon="shield"
            tone="gray"
            title="Likes par jour"
            description="Quota du jour, toutes sessions confondues (stories et posts) : une session continue jusqu’à l’atteindre, quel que soit le nombre de comptes, puis s’arrête. Le compteur repart de zéro chaque jour."
          />
          <Stepper
            label="Likes par jour"
            unit="likes"
            value={s.maxLikesPerDay}
            {...CAP_LIMITS.perDay}
            onChange={(v) => updateSettings({ maxLikesPerDay: v })}
          />
          <InfoRow label="Likes aujourd’hui" value={`${today} / ${s.maxLikesPerDay}`} />
          <InfoRow label="Dernier avertissement d’Instagram" value={warnedAt ? formatDateTime(warnedAt) : 'Aucun'} />
        </SettingBlock>
        <SettingBlock>
          <SettingHeader
            icon="pause"
            tone="teal"
            title="Rythme"
            description="Pause tirée au hasard entre deux comptes, plus une courte pause sur chaque post ou story avant le j’aime. Plus c’est lent, moins Instagram voit d’actions par heure."
          />
          <RadioGroup label="Rythme" value={s.pace} options={PACE_OPTIONS} onChange={(v) => updateSettings({ pace: v })} />
        </SettingBlock>
        <SettingBlock>
          <SettingHeader
            icon="timer"
            tone="yellow"
            title="Arrêt automatique"
            description="La session s’arrête et sauvegarde à l’échéance, même avant le quota du jour. Avec « Jamais », elle continue jusqu’au quota ou à la fin de la liste."
          />
          <RadioGroup
            label="Arrêt automatique"
            value={s.autoStopMin}
            options={STOPS}
            onChange={(v) => updateSettings({ autoStopMin: v })}
          />
        </SettingBlock>
        <SettingBlock>
          <SettingHeader
            icon="db"
            tone="teal"
            title="Sauvegarde automatique"
            description="Toujours active : après chaque compte et chaque défilement, sur l’appareil. C’est ce qui permet une reprise exacte."
          />
        </SettingBlock>

        <SectionHeader title="Sécurité" />
        <SettingBlock>
          <SwitchRow
            icon="eye"
            tone="violet"
            title="Essai à blanc"
            description="Repère et surligne ce que l’app toucherait, sans rien toucher. Désactivez-le pour agir réellement."
            value={s.dryRun}
            onChange={(v) => updateSettings({ dryRun: v })}
          />
        </SettingBlock>

        <SectionHeader title="Repérage" />
        <SettingBlock>
          <SettingHeader
            icon="cpu"
            tone="violet"
            title="Règles et gabarits"
            description="Repérage dans la page puis confirmation sur la capture (OCR et icônes, sur l’iPhone). Aucune IA dans la boucle."
          />
          <InfoRow label="Version des règles" value={RULES_VERSION} />
          <InfoRow label="Version des gabarits" value={TEMPLATES_VERSION} />
        </SettingBlock>

        <SectionHeader title="Compte Apple" />
        <CloudBlock />

        <SectionHeader title="Données" />
        <SettingBlock>
          <Text size={13} color={colors.textMuted} style={styles.lh}>
            Aucune capture ne quitte cet iPhone. Seule la sauvegarde iCloud, si elle est activée, copie les sessions
            sur votre compte Apple ; rien n’est envoyé à un autre serveur. La connexion Instagram n’est pas
            sauvegardée : après une réinstallation, reconnectez-vous dans la WebView.
          </Text>
          <Button label="Tout effacer" variant="danger" size="sm" icon="trash" onPress={confirmWipe} />
        </SettingBlock>

        {__DEV__ ? (
          <>
            <SectionHeader title="Développement" />
            <SettingBlock>
              <Text size={13} color={colors.textMuted}>
                Données factices pour tester les écrans Sessions avant le moteur (étape 3).
              </Text>
              <Button
                label="Insérer des sessions factices"
                variant="dark"
                size="sm"
                onPress={() =>
                  seedDemoSessions()
                    .then(() => toast('Sessions factices ajoutées'))
                    .catch((e: unknown) => Alert.alert('Erreur', String(e)))
                }
              />
            </SettingBlock>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  lh: { lineHeight: 19 },
  status: { marginTop: 16, padding: 14, gap: 6, borderRadius: 16, borderWidth: 1 },
  statusHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  warning: {
    marginTop: 16,
    padding: 14,
    gap: 4,
    borderRadius: 16,
    backgroundColor: 'rgba(255,90,110,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,90,110,0.25)',
  },
});
