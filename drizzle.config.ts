import type { Config } from 'drizzle-kit';

export default {
  schema: './src/adapters/store/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  driver: 'expo',
} satisfies Config;
