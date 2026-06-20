import { adminPermissionScopeSchema } from '@synqit/shared';

import { hashPassword } from '../src/auth/crypto';
import { authStore } from '../src/auth/store';

const main = async (): Promise<void> => {
  const email = process.argv[2];
  const password = process.argv[3];
  if (!email || !password) {
    console.error(
      'Usage: node --import tsx --env-file=.env scripts/create-admin.ts <email> <password>',
    );
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  const user =
    (await authStore.findUserByEmail(email)) ??
    (await authStore.createUser({ email, passwordHash }));
  if (!user) {
    throw new Error('Could not create user');
  }

  await authStore.upsertPasswordIdentity({ userId: user.id, email: user.email, passwordHash });
  await authStore.setUserRoleById(user.id, 'admin');
  await authStore.replaceUserAdminPermissionsByUserId(
    user.id,
    adminPermissionScopeSchema.options.map((scope) => ({ scope, level: 'write' as const })),
  );

  console.log(`✅ Super admin ready: ${email}`);
  process.exit(0);
};

main().catch((error) => {
  console.error('Failed to create admin:', error);
  process.exit(1);
});
