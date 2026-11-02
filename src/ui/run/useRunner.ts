// UI flow of a run: scan → summary (validation) → 3 s countdown → locked run → result.
// Never resumes directly: after a pause or a return to the app, everything starts again from the scan.
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { getSettings } from '@/adapters/settings';
import { likesToday } from '@/adapters/store/repo';
import { createSession, findResumable, sqliteStore, updateSessionSettings } from '@/adapters/store/sessionStore';
import type { SessionRow } from '@/adapters/store/schema';
import { createVisionPort, realClock } from '@/adapters/vision';
import { Engine } from '@/engine/engine';
import type { Highlight, PagePort, Progress, RunOutcome, ScanCheck } from '@/engine/ports';
import type { Settings } from '@/engine/types';

const KEEP_AWAKE_TAG = 'autoclicker-run';

export type Plan = {
  sessionId: string;
  targetAccount: string;
  settings: Settings;
  previousElapsedMs: number;
  resumed: boolean;
};

export type Phase =
  | { name: 'idle' }
  | { name: 'scanning'; checks: ScanCheck[] }
  | { name: 'scan_failed'; checks: ScanCheck[]; message: string }
  | {
      name: 'recap';
      checks: ScanCheck[];
      targetAccount: string;
      visibleRows: number;
      resumable: SessionRow | null;
      today: number;
      settings: Settings;
      visionReady: boolean;
    }
  | { name: 'countdown'; n: number; plan: Plan }
  | { name: 'locked'; plan: Plan; startedAt: number }
  | { name: 'summary'; sessionId: string; targetAccount: string; outcome: RunOutcome; savedAt: number; dryRun: boolean };

export function useRunner(deps: { page: PagePort; getViewTag: () => number | null; onLockChange: (locked: boolean) => void }) {
  const [phase, setPhase] = useState<Phase>({ name: 'idle' });
  const [progress, setProgress] = useState<Progress | null>(null);
  const ctrl = useRef<AbortController | null>(null);
  const countdown = useRef<ReturnType<typeof setInterval> | null>(null);

  const vision = useMemo(() => createVisionPort(deps.getViewTag), [deps.getViewTag]);
  const engine = useMemo(
    () => new Engine({ page: deps.page, vision, store: sqliteStore, clock: realClock }),
    [deps.page, vision],
  );

  const scan = useCallback(async () => {
    setPhase({
      name: 'scanning',
      checks: [
        { label: 'Recherche d’une liste d’abonnés', ok: false },
        { label: 'Comptes visibles', ok: false },
        { label: 'Bouton retour', ok: false },
      ],
    });
    const fail = (message: string, checks: ScanCheck[] = []) => setPhase({ name: 'scan_failed', checks, message });
    let r: Awaited<ReturnType<Engine['scan']>>;
    let resumable: SessionRow | null;
    let today: number;
    try {
      [r] = await Promise.all([engine.scan(), realClock.sleep(900)]);
      if (!r.ok) return fail(r.message, r.checks);
      [resumable, today] = await Promise.all([findResumable(r.targetAccount), likesToday()]);
    } catch (e) {
      // Any unexpected error ends the scan with a readable message instead of a spinner forever.
      return fail(`Erreur pendant l’analyse : ${e instanceof Error ? e.message : String(e)}`);
    }
    setPhase({
      name: 'recap',
      checks: r.checks,
      targetAccount: r.targetAccount,
      visibleRows: r.visibleRows,
      resumable,
      today,
      settings: getSettings(),
      visionReady: vision.available(),
    });
  }, [engine, vision]);

  const cancel = useCallback(() => {
    if (countdown.current) clearInterval(countdown.current);
    countdown.current = null;
    setPhase({ name: 'idle' });
  }, []);

  const startRun = useCallback(
    async (plan: Plan) => {
      const controller = new AbortController();
      ctrl.current = controller;
      setProgress(null);
      const startedAt = Date.now();
      setPhase({ name: 'locked', plan, startedAt });
      deps.onLockChange(true);
      await activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
      let outcome: RunOutcome;
      try {
        outcome = await engine.run({
          sessionId: plan.sessionId,
          targetAccount: plan.targetAccount,
          settings: plan.settings,
          previousElapsedMs: plan.previousElapsedMs,
          signal: controller.signal,
          onProgress: setProgress,
        });
      } finally {
        deactivateKeepAwake(KEEP_AWAKE_TAG);
        deps.onLockChange(false);
        ctrl.current = null;
      }
      setPhase({
        name: 'summary',
        sessionId: plan.sessionId,
        targetAccount: plan.targetAccount,
        outcome,
        savedAt: Date.now(),
        dryRun: plan.settings.dryRun,
      });
    },
    [deps, engine],
  );

  /** Validation of the summary: creates or resumes the session, then the 3 s countdown. */
  const confirm = useCallback(
    async (resume: boolean) => {
      if (phase.name !== 'recap') return;
      const settings = getSettings();
      let plan: Plan;
      if (resume && phase.resumable) {
        await updateSessionSettings(phase.resumable.id, settings);
        plan = {
          sessionId: phase.resumable.id,
          targetAccount: phase.targetAccount,
          settings,
          previousElapsedMs: phase.resumable.elapsedMs,
          resumed: true,
        };
      } else {
        plan = { sessionId: await createSession(phase.targetAccount, settings), targetAccount: phase.targetAccount, settings, previousElapsedMs: 0, resumed: false };
      }
      let n = 3;
      setPhase({ name: 'countdown', n, plan });
      countdown.current = setInterval(() => {
        n -= 1;
        if (n > 0) {
          setPhase({ name: 'countdown', n, plan });
          return;
        }
        if (countdown.current) clearInterval(countdown.current);
        countdown.current = null;
        void startRun(plan);
      }, 1000);
    },
    [phase, startRun],
  );

  const stop = useCallback((reason: 'manual' | 'background' = 'manual') => ctrl.current?.abort(reason), []);

  // iOS suspends JavaScript and the WebView in the background: pause and save at once.
  // Back in the app, nothing restarts on its own (scan + validation again).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') return;
      if (ctrl.current) stop('background');
      if (countdown.current) cancel();
    });
    return () => sub.remove();
  }, [stop, cancel]);

  useEffect(
    () => () => {
      if (countdown.current) clearInterval(countdown.current);
      ctrl.current?.abort('background');
    },
    [],
  );

  return { phase, progress, scan, cancel, confirm, stop, close: () => setPhase({ name: 'idle' }) };
}

export type HighlightState = Highlight;
