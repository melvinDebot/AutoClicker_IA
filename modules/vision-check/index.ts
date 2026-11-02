import { requireOptionalNativeModule } from 'expo';

export type Snapshot = { uri: string; width: number; height: number; scale: number };
export type Region = { x: number; y: number; w: number; h: number };
export type NativeTextBlock = { text: string; confidence: number; box: Region };
export type ColorStats = {
  red: number;
  saturated: number;
  grey: number;
  dark: number;
  light: number;
  meanLuma: number;
  samples: number;
};

type VisionCheckNative = {
  snapshot(viewTag: number | null): Promise<Snapshot>;
  ocr(uri: string, scale: number, region: Region | null): Promise<NativeTextBlock[]>;
  colorStats(uri: string, scale: number, region: Region, annulus: boolean): Promise<ColorStats>;
  matchIcon(uri: string, scale: number, region: Region, templates: string[]): Promise<{ template: string; distance: number }[]>;
  cropToFile(uri: string, scale: number, region: Region): Promise<string>;
  release(uri: string): Promise<void>;
  releaseAll(): Promise<void>;
  clearWebsiteData(): Promise<void>;
};

// Optional so that Jest and an outdated dev build fail with a clear message instead of crashing at import.
const native = requireOptionalNativeModule<VisionCheckNative>('VisionCheck');

function mod(): VisionCheckNative {
  if (!native) throw new Error('Module natif VisionCheck absent : reconstruire le dev build (npx expo run:ios).');
  return native;
}

export const VisionCheckNative = {
  isAvailable: () => native !== null,
  /** True when the installed build already has the step 2 functions. */
  hasAnalysis: () => !!native && typeof (native as Partial<VisionCheckNative>).ocr === 'function',
  snapshot: (viewTag: number | null) => mod().snapshot(viewTag),
  ocr: (s: Snapshot, region?: Region) => mod().ocr(s.uri, s.scale, region ?? null),
  colorStats: (s: Snapshot, region: Region, annulus = false) => mod().colorStats(s.uri, s.scale, region, annulus),
  matchIcon: (s: Snapshot, region: Region, templates: string[]) => mod().matchIcon(s.uri, s.scale, region, templates),
  cropToFile: (s: Snapshot, region: Region) => mod().cropToFile(s.uri, s.scale, region),
  release: (uri: string) => mod().release(uri),
  releaseAll: () => mod().releaseAll(),
  clearWebsiteData: () => mod().clearWebsiteData(),
};
