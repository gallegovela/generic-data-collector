-- AlterTable
ALTER TABLE "submissions" ADD COLUMN     "formVersionId" TEXT,
ADD COLUMN     "formVersionNumber" INTEGER,
ADD COLUMN     "submittedByUserId" TEXT;

-- CreateIndex
CREATE INDEX "submissions_organizationId_formId_formVersionNumber_idx" ON "submissions"("organizationId", "formId", "formVersionNumber");
