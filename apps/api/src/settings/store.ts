import { prisma } from '../db/prisma';

/**
 * Operator-editable runtime settings: one JSON document per key, read on demand.
 * Small by design. Anything with a schema of its own (users, events) has its own
 * table; this is for switches an admin flips without a deploy.
 */
export const settingsStore = {
  async get(key: string): Promise<unknown> {
    const row = await prisma.app_settings.findUnique({ where: { key } });
    return row ? row.value_json : null;
  },

  async set(params: {
    key: string;
    value: unknown;
    updatedByUserId: string | null;
  }): Promise<void> {
    const now = new Date();
    await prisma.$executeRaw`
      INSERT INTO app_settings (key, value_json, updated_at, updated_by_user_id)
      VALUES (${params.key}, ${JSON.stringify(params.value)}::jsonb, ${now}, ${params.updatedByUserId})
      ON CONFLICT (key) DO UPDATE SET
        value_json = EXCLUDED.value_json,
        updated_at = EXCLUDED.updated_at,
        updated_by_user_id = EXCLUDED.updated_by_user_id
    `;
  },
};
