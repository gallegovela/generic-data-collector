-- CreateEnum
CREATE TYPE "UsageKind" AS ENUM ('impression', 'submission');

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxImpressionsPerHour" INTEGER,
    "maxSubmissionsPerHour" INTEGER,
    "maxFileBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_counters" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "kind" "UsageKind" NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "usage_counters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plans_name_key" ON "plans"("name");

-- CreateIndex
CREATE INDEX "usage_counters_windowStart_idx" ON "usage_counters"("windowStart");

-- CreateIndex
CREATE UNIQUE INDEX "usage_counters_organizationId_formId_kind_windowStart_key" ON "usage_counters"("organizationId", "formId", "kind", "windowStart");

-- AddForeignKey
ALTER TABLE "usage_counters" ADD CONSTRAINT "usage_counters_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Plan genérico (valores generosos: no restringen la demo)
INSERT INTO "plans" ("id", "name", "maxImpressionsPerHour", "maxSubmissionsPerHour", "maxFileBytes", "createdAt", "updatedAt")
VALUES ('plan-generic', 'Genérico', 10000, 1000, 10485760, now(), now());

-- Organization.planId: nulo, relleno, obligatorio y FK
ALTER TABLE "organizations" ADD COLUMN "planId" TEXT;
UPDATE "organizations" SET "planId" = 'plan-generic';
ALTER TABLE "organizations" ALTER COLUMN "planId" SET NOT NULL;
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
