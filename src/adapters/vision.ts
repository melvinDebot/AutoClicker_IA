// Real VisionPort (native module) and Clock.
import type { Clock, VisionPort } from '@/engine/ports';
import { VisionCheckNative } from '../../modules/vision-check';

export function createVisionPort(getViewTag: () => number | null): VisionPort {
  return {
    available: () => VisionCheckNative.hasAnalysis(),
    snapshot: () => VisionCheckNative.snapshot(getViewTag()),
    release: (s) => VisionCheckNative.release(s.uri),
    ocr: (s, region) => VisionCheckNative.ocr(s, region),
    colors: (s, region, annulus) => VisionCheckNative.colorStats(s, region, annulus ?? false),
  };
}

export const realClock: Clock = {
  now: () => Date.now(),
  sleep: (ms, signal) =>
    new Promise<void>((resolve) => {
      const t = setTimeout(resolve, ms);
      signal?.addEventListener('abort', () => {
        clearTimeout(t);
        resolve();
      });
    }),
};
