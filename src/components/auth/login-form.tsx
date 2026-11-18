"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { requestMagicLinkAction } from "@/server/auth/auth.actions";

const inputClassName =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [magicLinkPending, setMagicLinkPending] = useState(false);

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const result = await signIn("password", { email, password, redirect: false });

    setPending(false);

    if (!result || result.error) {
      setError("Email o contraseña incorrectos.");
      return;
    }

    router.push("/admin");
  }

  async function handleMagicLinkSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMagicLinkPending(true);

    const formData = new FormData();
    formData.set("email", email);
    await requestMagicLinkAction(undefined, formData);

    setMagicLinkPending(false);
    setMagicLinkSent(true);
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <form className="flex flex-col gap-4" onSubmit={handlePasswordSubmit}>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className={inputClassName}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className={inputClassName}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Entrando…" : "Entrar"}
        </Button>
      </form>

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <p className="text-sm text-muted-foreground">
          O inicia sesión sin contraseña, con un enlace que te enviamos por email.
        </p>
        {magicLinkSent ? (
          <p className="text-sm text-foreground">
            Si ese email tiene una cuenta, te hemos enviado un enlace para entrar. Revisa tu correo.
          </p>
        ) : (
          <form onSubmit={handleMagicLinkSubmit}>
            <Button type="submit" variant="outline" disabled={magicLinkPending || !email} className="w-full">
              {magicLinkPending ? "Enviando…" : "Enviarme un enlace mágico"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
