"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SettingsNav({ sections }: { sections: ReadonlyArray<{ href: string; label: string }> }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Secciones de ajustes" className="flex gap-4 border-b border-border text-sm">
      {sections.map((section) => {
        const active = pathname.startsWith(section.href);
        return (
          <Link
            key={section.href}
            href={section.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 px-1 pb-2 ${
              active ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:underline"
            }`}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
