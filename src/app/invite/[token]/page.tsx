import { AcceptInvitationForm } from "@/components/auth/accept-invitation-form";

export default async function AcceptInvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 bg-zinc-50 p-6 dark:bg-black">
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">FormIA</h1>
        <p className="text-sm text-muted-foreground">
          Has sido invitado a unirte a una organización en FormIA. Crea tu contraseña para empezar.
        </p>
      </div>
      <AcceptInvitationForm token={token} />
    </main>
  );
}
