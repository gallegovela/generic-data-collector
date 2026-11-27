import type { ReactNode } from "react";
import { SettingsNav } from "@/components/admin-settings/settings-nav";
import { SETTINGS_SECTIONS } from "@/lib/admin-settings/settings-sections";
import { requireAdminPage } from "@/server/auth/session";

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  await requireAdminPage();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Ajustes</h1>
      <SettingsNav sections={SETTINGS_SECTIONS} />
      {children}
    </div>
  );
}
