-- CreateEnum
CREATE TYPE "DestinationKind" AS ENUM ('email', 'webhook');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('pending', 'sending', 'sent', 'failed');

-- CreateTable
CREATE TABLE "destinations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "kind" "DestinationKind" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "emailTo" TEXT[],
    "webhookUrl" TEXT,
    "webhookSecret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "destinations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliveries" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "kind" "DestinationKind" NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL,
    "lastError" TEXT,
    "lastStatusCode" INTEGER,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_attempts" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "statusCode" INTEGER,
    "error" TEXT,

    CONSTRAINT "delivery_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "destinations_organizationId_formId_idx" ON "destinations"("organizationId", "formId");

-- CreateIndex
CREATE UNIQUE INDEX "destinations_formId_kind_key" ON "destinations"("formId", "kind");

-- CreateIndex
CREATE INDEX "deliveries_status_nextAttemptAt_idx" ON "deliveries"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "deliveries_organizationId_formId_createdAt_idx" ON "deliveries"("organizationId", "formId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "deliveries_destinationId_submissionId_key" ON "deliveries"("destinationId", "submissionId");

-- CreateIndex
CREATE INDEX "delivery_attempts_deliveryId_number_idx" ON "delivery_attempts"("deliveryId", "number");

-- CreateIndex
CREATE INDEX "delivery_attempts_organizationId_idx" ON "delivery_attempts"("organizationId");
