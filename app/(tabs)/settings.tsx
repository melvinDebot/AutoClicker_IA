import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { resetSettings, updateSettings, useSettings } from '@/adapters/settings';
import { seedDemoSessions } from '@/adapters/store/demoData';
import { likesToday, wipeAllData } from '@/adapters/store/repo';
import { CAP_LIMITS } from '@/engine/settings';
import type { AutoStop, PostsPerUser } from '@/engine/types';
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
import { colors } from '@/ui/theme';
import { VisionCheckNative } from '../../modules/vision-check';

const POSTS: { value: PostsPerUser; label: string }[] = [0, 1, 2, 3].map((n) => ({
  value: n as PostsPerUser,
  label: String(n),
}));

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

  useFocusEffect(
    useCallback(() => {
      likesToday().then(setToday).catch(() => {});
    }, []),
  );

  const confirmWipe = () =>
    Alert.alert(
      'Tout effacer ?',
      'Sessions, progression, compteurs, réglages et données de la WebView (dont votre connexion Instagram) seront supprimés de cet iPhone.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Tout effacer',
          style: 'destructive',
          onPress: async () => {
            try {
              await wipeAllData();
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
            icon="timer"
            tone="yellow"
            title="Arrêt automatique"
            description="La session s’arrête et sauvegarde à l’échéance. Avec « Jamais », elle continue tant que le défilement fait apparaître de nouveaux comptes."
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
        <SettingBlock>
          <SettingHeader
            icon="shield"
            tone="gray"
            title="Plafonds de likes"
            description="La session s’arrête dès qu’un plafond est atteint (stories et posts confondus)."
          />
          <Stepper
            label="Par session"
            unit="likes"
            value={s.maxLikesPerSession}
            {...CAP_LIMITS.perSession}
            onChange={(v) => updateSettings({ maxLikesPerSession: v })}
          />
          <Stepper
            label="Par jour"
            unit="likes"
            value={s.maxLikesPerDay}
            {...CAP_LIMITS.perDay}
            onChange={(v) => updateSettings({ maxLikesPerDay: v })}
          />
          <InfoRow label="Likes aujourd’hui" value={`${today} / ${s.maxLikesPerDay}`} />
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

        <SectionHeader title="Données" />
        <SettingBlock>
          <Text size={13} color={colors.textMuted} style={styles.lh}>
            Tout reste sur cet iPhone : aucune capture ni donnée n’est envoyée à un serveur. Pour vous déconnecter
            d’Instagram, utilisez le menu d’Instagram dans la WebView.
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
