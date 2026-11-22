-- CreateTable
CREATE TABLE "submissions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "formTitle" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "formVersionSnapshot" JSONB NOT NULL,
    "answers" JSONB NOT NULL,
    "submittedByName" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "submissions_organizationId_formId_capturedAt_idx" ON "submissions"("organizationId", "formId", "capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "submissions_organizationId_clientId_key" ON "submissions"("organizationId", "clientId");

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
