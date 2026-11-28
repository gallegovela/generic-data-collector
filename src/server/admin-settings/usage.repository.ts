import { randomUUID } from "node:crypto";
import { Prisma, type UsageKind } from "@prisma/client";
import { prisma } from "@/server/db/client";

// Contadores sin IP ni datos personales (RNF-SET-03). Todo filtra por organizationId.

type CounterKey = { organizationId: string; formId: string; kind: UsageKind; windowStart: Date };

/**
 * Incremento atómico en una sola sentencia. Devuelve el contador tras
 * incrementar, o null si el límite ya estaba alcanzado.
 * Cubre: RF-SET-09
 */
export async function incrementUsage(input: CounterKey & { limit: number | null }): Promise<number | null> {
  const { organizationId, formId, kind, windowStart, limit } = input;
  const guard = limit === null ? Prisma.empty : Prisma.sql`WHERE "usage_counters"."count" < ${limit}`;
  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    INSERT INTO "usage_counters" ("id","organizationId","formId","kind","windowStart","count")
    VALUES (${randomUUID()}, ${organizationId}, ${formId}, ${kind}::"UsageKind", ${windowStart}, 1)
    ON CONFLICT ("organizationId","formId","kind","windowStart")
    DO UPDATE SET "count" = "usage_counters"."count" + 1
    ${guard}
    RETURNING "count"`;
  return rows.length > 0 ? rows[0].count : null;
}

export async function decrementUsage(input: CounterKey): Promise<void> {
  const { organizationId, formId, kind, windowStart } = input;
  await prisma.$executeRaw`
    UPDATE "usage_counters" SET "count" = GREATEST("count" - 1, 0)
    WHERE "organizationId" = ${organizationId} AND "formId" = ${formId}
      AND "kind" = ${kind}::"UsageKind" AND "windowStart" = ${windowStart}`;
}

export async function getUsageCount(input: CounterKey): Promise<number> {
  const row = await prisma.usageCounter.findUnique({
    where: { organizationId_formId_kind_windowStart: input },
    select: { count: true },
  });
  return row?.count ?? 0;
}
