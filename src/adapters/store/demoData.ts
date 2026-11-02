// FAKE DATA (development only): fictitious accounts from the prototype, used to
// show the Sessions screens before the engine exists (step 3).
import { RULES_VERSION } from '@/recognition/rules';
import { DEFAULT_SETTINGS, type Privacy, type SessionStatus, type StoryResult } from '@/engine/types';
import { db } from './db';
import { sessions, sessionUsers } from './schema';

const FIRST = ['lea', 'hugo', 'clara', 'malo', 'ines', 'theo', 'jade', 'nils', 'margot', 'sacha', 'romy', 'gabin'];
const SUFFIX = ['.vrt', '_studio', '.photo', '.mvt', '.ink', '.archi', '_draws', '.velo', '.cafe', '.films'];

type Demo = {
  id: string;
  account: string;
  status: SessionStatus;
  discovered: number;
  processed: number;
  minutesAgo: number;
  elapsedMs: number;
  endReason: string | null;
};

const DEMOS: Demo[] = [
  { id: 'demo-1', account: 'atelier.lumen', status: 'paused', discovered: 21, processed: 9, minutesAgo: 45, elapsedMs: 312_000, endReason: 'Arrêtée par vous' },
  { id: 'demo-2', account: 'ruelle.verte', status: 'done', discovered: 64, processed: 64, minutesAgo: 60 * 50, elapsedMs: 1_238_000, endReason: 'Fin de la liste' },
  { id: 'demo-3', account: 'studio.kova', status: 'interrupted', discovered: 7, processed: 3, minutesAgo: 60 * 74, elapsedMs: 41_000, endReason: 'Application passée en arrière-plan' },
];

export async function seedDemoSessions(now = Date.now()): Promise<void> {
  await db.transaction(async (tx) => {
    for (const d of DEMOS) {
      const created = now - d.minutesAgo * 60_000;
      await tx
        .insert(sessions)
        .values({
          id: d.id,
          targetAccount: d.account,
          createdAt: created,
          updatedAt: created + d.elapsedMs,
          status: d.status,
          endReason: d.endReason,
          windowIndex: Math.ceil(d.discovered / 7),
          elapsedMs: d.elapsedMs,
          discoveredCount: d.discovered,
          listEndReached: d.status === 'done',
          settingsJson: JSON.stringify(DEFAULT_SETTINGS),
          rulesVersion: RULES_VERSION,
        })
        .onConflictDoNothing();
      for (let i = 0; i < d.discovered; i++) {
        const username = `${FIRST[i % FIRST.length]}${SUFFIX[(i * 7) % SUFFIX.length]}${i >= FIRST.length ? i : ''}`;
        const handled = i < d.processed;
        const privacy: Privacy = !handled ? 'unknown' : i % 5 === 2 ? 'private' : 'public';
        const story: StoryResult | null = !handled ? null : privacy === 'private' ? 'skipped' : i % 3 === 0 ? 'none' : 'liked';
        await tx
          .insert(sessionUsers)
          .values({
            sessionId: d.id,
            username,
            firstSeenWindow: Math.floor(i / 7),
            discoveredAt: created + i * 20_000,
            state: handled ? 'done' : 'todo',
            privacy,
            storyResult: story,
            postsResultJson: handled && privacy === 'public' ? JSON.stringify(i % 4 === 1 ? ['liked', 'already'] : ['liked', 'liked']) : null,
            processedAt: handled ? created + i * 25_000 : null,
          })
          .onConflictDoNothing();
      }
    }
  });
}
