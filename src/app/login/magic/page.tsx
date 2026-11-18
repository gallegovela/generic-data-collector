"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

type VerificationState = "verifying" | "error";

function MagicLinkContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [state, setState] = useState<VerificationState>(token ? "verifying" : "error");

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    signIn("magic-link", { token, redirect: false }).then((result) => {
      if (cancelled) {
        return;
      }

      if (!result || result.error) {
        setState("error");
        return;
      }

      router.push("/admin");
    });

    return () => {
      cancelled = true;
    };
  }, [token, router]);

  if (state === "error") {
    return (
      <p className="text-sm text-destructive">
        El enlace no es válido o ha caducado. Vuelve a{" "}
        <a href="/login" className="underline">
          la página de inicio de sesión
        </a>{" "}
        y pide uno nuevo.
      </p>
    );
  }

  return <p className="text-sm text-muted-foreground">Verificando el enlace…</p>;
}

export default function MagicLinkPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-50 p-6 text-center dark:bg-black">
      <h1 className="text-2xl font-semibold tracking-tight">FormIA</h1>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Verificando el enlace…</p>}>
        <MagicLinkContent />
      </Suspense>
    </main>
  );
}
