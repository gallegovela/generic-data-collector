import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { verifyWebhookSignature } from "@/lib/outputs/webhook-signature";
import { createOrganization } from "@/server/auth/organization.repository";
import { prisma } from "@/server/db/client";
import { InMemoryStorageAdapter } from "@/server/storage/in-memory-storage-adapter";
import { setStorageAdapterForTests } from "@/server/storage/storage-adapter";
import { uploadFile } from "@/server/storage/storage.service";
import { createSubmission } from "@/server/submissions/submission.service";
import {
  buildNoisePng,
  createDestinationFixture,
  createFormFixture,
  createSubmissionWithTheme,
  deleteOutputsData,
  uniqueRecipient,
} from "../../../prisma/fixtures/outputs.fixtures";
import { listDeliveries, processDueDeliveries, retryDelivery } from "./delivery.service";

// Requiere PostgreSQL, Mailpit (MAILPIT_API_URL, por defecto http://mailpit:8025) y un
// servidor HTTP local. Las pruebas llaman a processDueDeliveries con un `now` controlado.
// Cubre: CA-OUT-01, CA-OUT-03, CA-OUT-07, CA-OUT-08, CA-OUT-09, CA-OUT-11, RF-OUT-13, RNF-OUT-05, RNF-OUT-06

const MAILPIT = process.env.MAILPIT_API_URL ?? "http://mailpit:8025";
const SECRET = "whsec_test_secret";

type Received = { headers: IncomingMessage["headers"]; body: string };

describe("delivery (integración)", () => {
  const storage = new InMemoryStorageAdapter();
  const received: Received[] = [];
  let status = 200;
  let server: Server;
  let hookUrl = "";
  let orgA: { id: string };
  let orgB: { id: string };

  beforeAll(async () => {
    setStorageAdapterForTests(storage);
    server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => chunks.push(c));
      req.on("end", () => {
        received.push({ headers: req.headers, body: Buffer.concat(chunks).toString("utf8") });
        res.statusCode = status;
        res.end();
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    hookUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/hook`;
    orgA = await createOrganization({ name: "Org A (delivery.integration test)" });
    orgB = await createOrganization({ name: "Org B (delivery.integration test)" });
  });

  afterAll(async () => {
    setStorageAdapterForTests(null);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await deleteOutputsData([orgA.id, orgB.id]);
  });

  beforeEach(() => {
    received.length = 0;
    status = 200;
  });
  afterEach(() => vi.restoreAllMocks());

  async function newForm() {
    return (await createFormFixture(orgA.id)).id;
  }

  async function post(formId: string, over: { clientId?: string; logoKey?: string; answers?: Record<string, unknown> } = {}) {
    return createSubmission({
      organizationId: orgA.id,
      actor: { kind: "anonymous" },
      form: {
        id: formId,
        title: "Parte diario de obra",
        versionId: "v1",
        versionNumber: 1,
        schema: createSubmissionWithTheme(over.logoKey),
      },
      clientId: over.clientId ?? randomUUID(),
      answers: over.answers ?? { site: "Obra Secreta 77", has_incidents: false },
      capturedAt: new Date(),
    });
  }

  async function mailpitMessages(to: string): Promise<Array<{ ID: string }>> {
    const response = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`);
    return ((await response.json()) as { messages: Array<{ ID: string }> }).messages;
  }

  async function waitForMail(to: string): Promise<Array<{ ID: string }>> {
    for (let i = 0; i < 40; i++) {
      const messages = await mailpitMessages(to);
      if (messages.length > 0) return messages;
      await new Promise((r) => setTimeout(r, 250));
    }
    return [];
  }

  /** Procesa lo vencido hasta que no quede nada; `at` es el reloj de la prueba. */
  async function drain(at: Date): Promise<void> {
    await settle();
    for (let i = 0; i < 5; i++) if ((await processDueDeliveries(at)) === 0) break;
  }

  /**
   * `createSubmission` lanza el primer envío en segundo plano: se espera a que
   * termine (ni `sending` ni `pending` ya vencido) antes de comprobar nada.
   */
  async function settle(): Promise<void> {
    for (let i = 0; i < 100; i++) {
      const busy = await prisma.delivery.count({
        where: {
          organizationId: orgA.id,
          OR: [{ status: "sending" }, { status: "pending", nextAttemptAt: { lte: new Date() } }],
        },
      });
      if (busy === 0) return;
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  /** Agota las rondas de reintento avanzando el reloj más que la mayor espera (2 h). */
  async function exhaust(): Promise<void> {
    await settle();
    for (let round = 1; round <= 6; round++) {
      await processDueDeliveries(new Date(Date.now() + round * 3 * 3_600_000));
    }
  }

  it("CA-OUT-01: llega un email con un PDF adjunto que incluye el logo de la organización", async () => {
    const logo = await uploadFile(orgA.id, { kind: "photo", uploadId: randomUUID(), bytes: buildNoisePng(16, 16) });
    const to = uniqueRecipient();
    const formId = await newForm();
    await createDestinationFixture(orgA.id, formId, "email", { emailTo: [to] });
    await post(formId, { logoKey: logo.file.key });
    await drain(new Date(Date.now() + 1000));

    const messages = await waitForMail(to);
    expect(messages).toHaveLength(1);
    const detail = (await (await fetch(`${MAILPIT}/api/v1/message/${messages[0].ID}`)).json()) as {
      Attachments: Array<{ PartID: string; FileName: string; ContentType: string; Size: number }>;
      Text: string;
    };
    expect(detail.Attachments).toHaveLength(1);
    const [attachment] = detail.Attachments;
    expect(attachment.ContentType).toBe("application/pdf");
    expect(attachment.FileName).toMatch(/\.pdf$/);
    expect(attachment.Size).toBeGreaterThan(0);
    expect(detail.Text).not.toContain("Obra Secreta 77");
    const pdf = Buffer.from(
      await (await fetch(`${MAILPIT}/api/v1/message/${messages[0].ID}/part/${attachment.PartID}`)).arrayBuffer(),
    );
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.toString("latin1")).toMatch(/\/Subtype\s*\/Image/);
  });

  it("CA-OUT-03: un webhook que responde 500 registra 5 intentos y la respuesta queda guardada", async () => {
    status = 500;
    const formId = await newForm();
    await createDestinationFixture(orgA.id, formId, "webhook", { webhookUrl: hookUrl, webhookSecret: SECRET });
    const { submission } = await post(formId);
    await exhaust();

    const delivery = await prisma.delivery.findFirstOrThrow({ where: { formId } });
    expect(delivery.status).toBe("failed");
    expect(delivery.attempts).toBe(5);
    expect(delivery.lastError).toBe("HTTP_500");
    const attempts = await prisma.deliveryAttempt.findMany({ where: { deliveryId: delivery.id } });
    expect(attempts).toHaveLength(5);
    expect(attempts.every((a) => !a.ok && a.statusCode === 500)).toBe(true);
    expect(await prisma.submission.count({ where: { id: submission.id } })).toBe(1);
  });

  it("CA-OUT-07: el POST lleva la firma verificable con el secreto del destino y fotos como claves", async () => {
    const formId = await newForm();
    await createDestinationFixture(orgA.id, formId, "webhook", { webhookUrl: hookUrl, webhookSecret: SECRET });
    await post(formId, { answers: { site: "Obra", has_incidents: true, photos: [{ key: `org/${orgA.id}/photo/${randomUUID()}.jpg` }] } });
    await drain(new Date(Date.now() + 1000));

    expect(received).toHaveLength(1);
    const { headers, body } = received[0];
    const timestamp = Number(headers["x-formia-timestamp"]);
    const signature = String(headers["x-formia-signature"]);
    expect(headers["x-formia-event"]).toBe("submission.created");
    expect(verifyWebhookSignature(SECRET, timestamp, body, signature)).toBe(true);
    expect(verifyWebhookSignature("otro-secreto", timestamp, body, signature)).toBe(false);
    const json = JSON.parse(body) as { submission: { answers: { photos: Array<{ key: string }> } }; form: { title: string } };
    expect(json.submission.answers.photos[0].key).toMatch(/^org\//);
    expect(body).not.toContain("http");
    expect(json.form.title).toBe("Parte diario de obra");
  });

  it("CA-OUT-08: la misma respuesta recibida dos veces envía un solo email y un solo POST", async () => {
    const to = uniqueRecipient();
    const formId = await newForm();
    await createDestinationFixture(orgA.id, formId, "email", { emailTo: [to] });
    await createDestinationFixture(orgA.id, formId, "webhook", { webhookUrl: hookUrl, webhookSecret: SECRET });
    const clientId = randomUUID();
    const first = await post(formId, { clientId });
    await drain(new Date(Date.now() + 1000));
    const second = await post(formId, { clientId });
    await drain(new Date(Date.now() + 1000));

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(await prisma.delivery.count({ where: { formId } })).toBe(2);
    expect(received).toHaveLength(1);
    expect(await waitForMail(to)).toHaveLength(1);
  });

  it("CA-OUT-11: el reenvío manual reinicia attempts a 0 y los intentos siguen numerados 1..6", async () => {
    status = 500;
    const formId = await newForm();
    await createDestinationFixture(orgA.id, formId, "webhook", { webhookUrl: hookUrl, webhookSecret: SECRET });
    await post(formId);
    await exhaust();
    const delivery = await prisma.delivery.findFirstOrThrow({ where: { formId } });
    expect(delivery.status).toBe("failed");

    status = 200;
    await retryDelivery(orgA.id, formId, delivery.id);
    // retryDelivery lanza el envío sin esperarlo: se espera a que termine.
    await drain(new Date(Date.now() + 1000));
    const after = await prisma.delivery.findUniqueOrThrow({ where: { id: delivery.id } });
    expect(after.status).toBe("sent");
    expect(after.attempts).toBe(1);
    const numbers = (await prisma.deliveryAttempt.findMany({ where: { deliveryId: delivery.id }, orderBy: { number: "asc" } })).map(
      (a) => a.number,
    );
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6]);

    await expect(retryDelivery(orgA.id, formId, delivery.id)).rejects.toBeInstanceOf(ConflictError);
    await expect(retryDelivery(orgB.id, formId, delivery.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("CA-OUT-09: listDeliveries y retryDelivery con la organización B sobre datos de A lanzan NotFoundError", async () => {
    const formId = await newForm();
    await createDestinationFixture(orgA.id, formId, "webhook", { webhookUrl: hookUrl, webhookSecret: SECRET });
    status = 500;
    await post(formId);
    await drain(new Date(Date.now() + 1000));
    const [view] = await listDeliveries(orgA.id, formId);
    expect(view.kind).toBe("webhook");
    await expect(listDeliveries(orgB.id, formId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(retryDelivery(orgB.id, formId, view.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("RF-OUT-13: con el webhook a un puerto cerrado la respuesta se guarda igualmente", async () => {
    const formId = await newForm();
    await createDestinationFixture(orgA.id, formId, "webhook", { webhookUrl: "http://127.0.0.1:9/hook", webhookSecret: SECRET });
    const result = await post(formId);
    expect(result.created).toBe(true);
    expect(await prisma.submission.count({ where: { id: result.submission.id } })).toBe(1);
    await drain(new Date(Date.now() + 1000));
    const delivery = await prisma.delivery.findFirstOrThrow({ where: { formId } });
    expect(delivery.lastError).toBe("NETWORK");
  });

  it("RNF-OUT-05: los logs de un ciclo completo no contienen destinatario, URL, secreto ni respuestas", async () => {
    const lines: string[] = [];
    for (const method of ["log", "error", "warn", "info"] as const) {
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => void lines.push(args.map(String).join(" ")));
    }
    const to = uniqueRecipient();
    const formId = await newForm();
    await createDestinationFixture(orgA.id, formId, "email", { emailTo: [to] });
    await createDestinationFixture(orgA.id, formId, "webhook", { webhookUrl: hookUrl, webhookSecret: SECRET });
    await post(formId);
    await drain(new Date(Date.now() + 1000));

    expect(lines.length).toBeGreaterThan(0);
    const all = lines.join("\n");
    for (const forbidden of [to, hookUrl, SECRET, "Obra Secreta 77"]) expect(all).not.toContain(forbidden);
  });

  it("RNF-OUT-06: recoge los pendientes vencidos y los atascados en sending; ignora futuros, sent y failed", async () => {
    const formId = await newForm();
    const destination = await createDestinationFixture(orgA.id, formId, "webhook", { webhookUrl: hookUrl, webhookSecret: SECRET });
    const { submission } = await post(formId); // sin envíos pendientes propios: ya hay destino, se procesan abajo
    await drain(new Date(Date.now() + 1000));
    await prisma.delivery.deleteMany({ where: { formId } });
    received.length = 0;

    const base = {
      organizationId: orgA.id,
      destinationId: destination.id,
      formId,
      kind: "webhook" as const,
    };
    const now = new Date();
    const mk = (suffix: string, data: Record<string, unknown>) =>
      prisma.delivery.create({ data: { ...base, submissionId: `${submission.id}-${suffix}`, nextAttemptAt: now, ...data } });
    const due = await mk("due", { status: "pending" });
    const future = await mk("future", { status: "pending", nextAttemptAt: new Date(now.getTime() + 3_600_000) });
    const sent = await mk("sent", { status: "sent" });
    const failed = await mk("failed", { status: "failed" });
    const stuck = await mk("stuck", { status: "sending" });
    await prisma.$executeRaw`UPDATE deliveries SET "updatedAt" = ${new Date(now.getTime() - 600_000)} WHERE id = ${stuck.id}`;

    await processDueDeliveries(new Date(now.getTime() + 1000));

    const statusOf = async (id: string) => (await prisma.delivery.findUniqueOrThrow({ where: { id } })).status;
    // Las respuestas de estos envíos no existen: lo recogido termina en failed (SUBMISSION_GONE).
    expect(await statusOf(due.id)).toBe("failed");
    expect(await statusOf(stuck.id)).toBe("failed");
    expect(await statusOf(future.id)).toBe("pending");
    expect(await statusOf(sent.id)).toBe("sent");
    expect(await statusOf(failed.id)).toBe("failed");
    expect(await prisma.deliveryAttempt.count({ where: { deliveryId: { in: [future.id, sent.id, failed.id] } } })).toBe(0);
    expect(await prisma.deliveryAttempt.count({ where: { deliveryId: { in: [due.id, stuck.id] } } })).toBe(2);
  });
});
