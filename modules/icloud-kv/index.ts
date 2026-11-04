import { requireOptionalNativeModule } from 'expo';

export type CloudChange = { reason: 'server' | 'initialSync' | 'quota' | 'account' | 'unknown'; keys: string[] };

type ICloudKVNative = {
  isSignedIn(): boolean;
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  keys(): string[];
  synchronize(): boolean;
  addListener(event: 'onChange', listener: (e: CloudChange) => void): { remove(): void };
};

// Optional: absent in Expo Go, Jest and a dev build made before this module (the backup is then off).
const native = requireOptionalNativeModule<ICloudKVNative>('ICloudKV');

function mod(): ICloudKVNative {
  if (!native) throw new Error('Module natif ICloudKV absent : reconstruire le dev build (npx expo run:ios).');
  return native;
}

export const ICloudKV = {
  isAvailable: () => native !== null,
  isSignedIn: () => !!native && native.isSignedIn(),
  get: (key: string) => mod().get(key),
  set: (key: string, value: string) => mod().set(key, value),
  remove: (key: string) => mod().remove(key),
  keys: () => mod().keys(),
  synchronize: () => mod().synchronize(),
  onChange: (listener: (e: CloudChange) => void) => mod().addListener('onChange', listener),
};
