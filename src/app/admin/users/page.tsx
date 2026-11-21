import { UserManagement } from "@/components/auth/user-management";
import { requireSession } from "@/server/auth/session";
import { listUsers } from "@/server/auth/user.service";

export default async function AdminUsersPage() {
  const currentUser = await requireSession({ role: "admin" });
  const users = await listUsers(currentUser.organizationId);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Usuarios</h1>
      <UserManagement users={users} currentUserId={currentUser.id} />
    </div>
  );
}
