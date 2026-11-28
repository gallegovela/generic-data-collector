import { redirect } from "next/navigation";
import { SETTINGS_SECTIONS } from "@/lib/admin-settings/settings-sections";

export default function SettingsIndexPage() {
  redirect(SETTINGS_SECTIONS[0].href);
}
