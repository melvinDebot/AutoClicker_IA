import { requireOptionalNativeModule } from 'expo';

export type Snapshot = { uri: string; width: number; height: number; scale: number };

type VisionCheckNative = {
  snapshot(viewTag: number | null): Promise<Snapshot>;
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
  snapshot: (viewTag: number | null) => mod().snapshot(viewTag),
  release: (uri: string) => mod().release(uri),
  releaseAll: () => mod().releaseAll(),
  clearWebsiteData: () => mod().clearWebsiteData(),
};
