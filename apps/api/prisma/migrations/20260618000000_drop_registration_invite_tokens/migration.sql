-- DropForeignKey
ALTER TABLE "registration_invite_tokens" DROP CONSTRAINT "registration_invite_tokens_created_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "registration_invite_tokens" DROP CONSTRAINT "registration_invite_tokens_used_by_user_id_fkey";

-- DropTable
DROP TABLE "registration_invite_tokens";
