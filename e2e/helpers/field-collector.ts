import { expect, type Page } from "@playwright/test";
import type { DraftForm } from "@/lib/form-editor/form-editor.schema";
import { prisma } from "@/server/db/client";
import { unpublishForm } from "@/server/form-publishing/form-publishing.service";
import { demoOrganizationId } from "./submissions-dashboard";
import { publishViaService, seedForm, uniqueName } from "./form-publishing";

export { login, textField, uniqueName } from "./form-publishing";

/** Crea y publica un formulario en la organización demo. */
export async function publishTestForm(
  draft: DraftForm,
  accessMode: "registered" | "public",
): Promise<{ id: string; slug: string }> {
  const id = await seedForm(uniqueName("Relleno"), draft);
  const { slug } = await publishViaService(id, accessMode);
  return { id, slug };
}

export async function unpublishTestForm(formId: string): Promise<void> {
  await unpublishForm(await demoOrganizationId(), formId);
}

export function submissionsOf(formId: string) {
  return prisma.submission.findMany({ where: { formId }, orderBy: { createdAt: "asc" } });
}

/**
 * El navegador solo ofrece geolocalización en contextos seguros y el entorno
 * de pruebas sirve la app por HTTP (http://web:3000): se simula la posición.
 */
export async function stubGeolocation(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (ok: (p: unknown) => void) =>
          ok({ coords: { latitude: 40.4168, longitude: -3.7038, accuracy: 10 }, timestamp: Date.now() }),
      },
    });
  });
}

/** Dibuja un trazo en el canvas de firma y espera a que se registre. */
export async function drawSignature(page: Page, fieldId: string): Promise<void> {
  const canvas = page.getByTestId(`signature-canvas-${fieldId}`);
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("El canvas de firma no es visible.");
  await page.mouse.move(box.x + 20, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 80, box.y + 60, { steps: 5 });
  await page.mouse.move(box.x + 140, box.y + 30, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByRole("button", { name: "Borrar firma" })).toBeEnabled();
}
