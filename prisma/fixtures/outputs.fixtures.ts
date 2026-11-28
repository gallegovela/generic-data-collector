import { randomBytes, randomUUID } from "node:crypto";
import { crc32, deflateSync } from "node:zlib";
import type { Destination, DestinationKind, Form, Prisma } from "@prisma/client";
import type { FormVersion } from "../../src/lib/form-schema";
import { prisma } from "../../src/server/db/client";
import { buildDailyReportFormVersion } from "./submissions-dashboard.fixtures";

/** Datos de prueba de outputs (#35). */

export function createFormFixture(organizationId: string, name = "Parte (outputs test)"): Promise<Form> {
  return prisma.form.create({
    data: { organizationId, name, draftSchema: buildDailyReportFormVersion() as Prisma.InputJsonValue },
  });
}

export function createDestinationFixture(
  organizationId: string,
  formId: string,
  kind: DestinationKind,
  data: { emailTo?: string[]; webhookUrl?: string; webhookSecret?: string; enabled?: boolean } = {},
): Promise<Destination> {
  return prisma.destination.create({
    data: {
      organizationId,
      formId,
      kind,
      enabled: data.enabled ?? true,
      emailTo: data.emailTo ?? [],
      webhookUrl: data.webhookUrl ?? null,
      webhookSecret: data.webhookSecret ?? null,
    },
  });
}

/** Esquema del parte diario con `theme.logoKey` (para el PDF con logo). */
export function createSubmissionWithTheme(logoKey: string | undefined): FormVersion {
  return {
    ...buildDailyReportFormVersion(),
    theme: { primaryColor: "#0f766e", secondaryColor: "#475569", ...(logoKey ? { logoKey } : {}) },
  };
}

export function uniqueRecipient(): string {
  return `dest-${randomUUID()}@example.test`;
}

/** Borra todo lo creado por las pruebas de una organización. */
export async function deleteOutputsData(organizationIds: string[]): Promise<void> {
  const where = { organizationId: { in: organizationIds } };
  await prisma.deliveryAttempt.deleteMany({ where });
  await prisma.delivery.deleteMany({ where });
  await prisma.destination.deleteMany({ where });
  await prisma.submission.deleteMany({ where });
  await prisma.storedFile.deleteMany({ where });
  await prisma.form.deleteMany({ where });
  await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } });
}

/** PNG RGB válido con píxeles aleatorios (no comprime): sirve para probar el tope de tamaño del PDF. */
export function buildNoisePng(width: number, height: number): Uint8Array {
  const chunk = (type: string, data: Buffer): Buffer => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // profundidad
  header[9] = 2; // RGB
  const rows: Buffer[] = [];
  for (let y = 0; y < height; y++) rows.push(Buffer.concat([Buffer.from([0]), randomBytes(width * 3)]));
  return new Uint8Array(
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", header),
      chunk("IDAT", deflateSync(Buffer.concat(rows))),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
}
