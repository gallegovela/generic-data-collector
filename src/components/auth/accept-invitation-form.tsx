"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { acceptInvitationAction } from "@/server/auth/user.actions";

const inputClassName =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function AcceptInvitationForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const formData = new FormData();
    formData.set("password", password);

    const result = await acceptInvitationAction(token, undefined, formData);

    if (result.error || !result.email) {
      setError(result.error ?? "No se ha podido completar la invitación.");
      setPending(false);
      return;
    }

    const signInResult = await signIn("password", { email: result.email, password, redirect: false });

    setPending(false);

    if (!signInResult || signInResult.error) {
      router.push("/login");
      return;
    }

    router.push("/admin");
  }

  return (
    <form className="flex w-full max-w-sm flex-col gap-4" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          Crea tu contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className={inputClassName}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creando cuenta…" : "Aceptar invitación"}
      </Button>
    </form>
  );
}
