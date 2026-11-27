-- AlterTable
ALTER TABLE "form_versions" ADD COLUMN     "consent" JSONB;

-- AlterTable
ALTER TABLE "submissions" ADD COLUMN     "consent" JSONB;
