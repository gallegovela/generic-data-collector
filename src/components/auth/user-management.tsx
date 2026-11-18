"use client";

import type { Role, UserStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { deactivateUserAction, inviteUserAction } from "@/server/auth/user.actions";

export type ManagedUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
};

const inputClassName =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function UserManagement({
  users,
  currentUserId,
}: {
  users: ManagedUser[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("collector");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [invitePending, setInvitePending] = useState(false);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInviteError(null);
    setInvitePending(true);

    const formData = new FormData();
    formData.set("email", email);
    formData.set("role", role);

    const result = await inviteUserAction(undefined, formData);

    setInvitePending(false);

    if (result.error) {
      setInviteError(result.error);
      return;
    }

    setEmail("");
    router.refresh();
  }

  async function handleDeactivate(userId: string) {
    setDeactivatingId(userId);

    const formData = new FormData();
    formData.set("userId", userId);
    await deactivateUserAction(undefined, formData);

    setDeactivatingId(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-8">
      <form className="flex flex-wrap items-end gap-3" onSubmit={handleInvite}>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="invite-email" className="text-sm font-medium">
            Email a invitar
          </label>
          <input
            id="invite-email"
            type="email"
            required
            className={inputClassName}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="invite-role" className="text-sm font-medium">
            Rol
          </label>
          <select
            id="invite-role"
            className={inputClassName}
            value={role}
            onChange={(event) => setRole(event.target.value as Role)}
          >
            <option value="collector">Recolector</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
        <Button type="submit" disabled={invitePending}>
          {invitePending ? "Invitando…" : "Invitar"}
        </Button>
      </form>
      {inviteError ? <p className="text-sm text-destructive">{inviteError}</p> : null}

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="py-2">Email</th>
            <th className="py-2">Nombre</th>
            <th className="py-2">Rol</th>
            <th className="py-2">Estado</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-b border-border">
              <td className="py-2">{user.email}</td>
              <td className="py-2">{user.name}</td>
              <td className="py-2">{user.role === "admin" ? "Administrador" : "Recolector"}</td>
              <td className="py-2">{user.status === "active" ? "Activo" : "Inactivo"}</td>
              <td className="py-2 text-right">
                {user.status === "active" && user.id !== currentUserId ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={deactivatingId === user.id}
                    onClick={() => handleDeactivate(user.id)}
                  >
                    {deactivatingId === user.id ? "Desactivando…" : "Desactivar"}
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
