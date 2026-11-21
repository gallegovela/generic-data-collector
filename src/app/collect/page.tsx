import { getCurrentUser } from "@/server/auth/session";

// Placeholder de la app de recogida: el contenido real lo añade
// field-collector.
export default async function CollectPage() {
  const user = await getCurrentUser();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 p-6 text-center dark:bg-black">
      <h1 className="text-2xl font-semibold tracking-tight">FormIA</h1>
      <p className="max-w-md text-muted-foreground">
        Hola{user ? `, ${user.name}` : ""}. Aquí podrás rellenar los formularios asignados a tu
        organización. Esta parte llega con el módulo field-collector.
      </p>
    </main>
  );
}
