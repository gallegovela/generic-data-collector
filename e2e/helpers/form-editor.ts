import { expect, type Page } from "@playwright/test";
import type { DraftForm } from "@/lib/form-editor/form-editor.schema";
import { findUserByEmail } from "@/server/auth/user.repository";
import { createForm, saveDraft } from "@/server/forms/form.service";

export const ADMIN_EMAIL = "admin@demo.formia.local";
const PASSWORD = "Demo1234!";

export async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/admin/);
}

/** Crea un formulario con el borrador dado en la organización demo. */
export async function seedForm(name: string, draft: DraftForm): Promise<string> {
  const admin = await findUserByEmail(ADMIN_EMAIL);
  if (!admin) throw new Error("Falta el usuario demo: ejecuta `npm run db:seed`.");
  const form = await createForm(admin.organizationId, { name });
  await saveDraft(admin.organizationId, form.id, { draft });
  return form.id;
}

export function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export async function fieldLabels(page: Page): Promise<string[]> {
  return page.getByTestId("field-select").locator("span.truncate").allTextContents();
}

export async function waitSaved(page: Page): Promise<void> {
  await expect(page.getByTestId("autosave-indicator")).toHaveText("Guardado", { timeout: 10_000 });
}

export function textField(id: string, label: string) {
  return { id, type: "text" as const, label, required: false, config: {} };
}
