-- CreateEnum
CREATE TYPE "StoredFileKind" AS ENUM ('photo', 'signature', 'document');

-- CreateTable
CREATE TABLE "stored_files" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "kind" "StoredFileKind" NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "submissionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stored_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stored_files_key_key" ON "stored_files"("key");

-- CreateIndex
CREATE INDEX "stored_files_organizationId_submissionId_idx" ON "stored_files"("organizationId", "submissionId");

-- CreateIndex
CREATE INDEX "stored_files_submissionId_createdAt_idx" ON "stored_files"("submissionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "stored_files_organizationId_uploadId_key" ON "stored_files"("organizationId", "uploadId");

-- AddForeignKey
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
