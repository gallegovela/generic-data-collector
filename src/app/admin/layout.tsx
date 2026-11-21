import type { ReactNode } from "react";
import { requireAdminPage } from "@/server/auth/session";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireAdminPage();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <span className="font-semibold">FormIA</span>
        <nav className="flex items-center gap-4 text-sm">
          <a href="/admin" className="hover:underline">
            Panel
          </a>
          <a href="/admin/forms" className="hover:underline">
            Formularios
          </a>
          <a href="/admin/users" className="hover:underline">
            Usuarios
          </a>
          <span className="text-muted-foreground">{user.name}</span>
        </nav>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
