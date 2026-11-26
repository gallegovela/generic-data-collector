-- CreateEnum
CREATE TYPE "FormAccessMode" AS ENUM ('registered', 'public');

-- AlterTable
ALTER TABLE "forms" ADD COLUMN     "accessMode" "FormAccessMode" NOT NULL DEFAULT 'registered',
ADD COLUMN     "publishedVersion" INTEGER,
ADD COLUMN     "slug" TEXT;

-- CreateTable
CREATE TABLE "form_versions" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "schema" JSONB NOT NULL,
    "publishedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "form_versions_organizationId_formId_idx" ON "form_versions"("organizationId", "formId");

-- CreateIndex
CREATE UNIQUE INDEX "form_versions_formId_version_key" ON "form_versions"("formId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "forms_slug_key" ON "forms"("slug");

-- AddForeignKey
ALTER TABLE "form_versions" ADD CONSTRAINT "form_versions_formId_fkey" FOREIGN KEY ("formId") REFERENCES "forms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
