import Link from "next/link";

/** Pantalla final tras descartar, sin sesión. Cubre: RF-COL-15 */
export default async function CancelledPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 data-testid="cancelled" className="text-2xl font-semibold">
        Respuesta descartada
      </h1>
      <p className="text-muted-foreground">No se ha guardado nada.</p>
      <Link href={`/f/${slug}`} className="text-primary underline underline-offset-4">
        Empezar de nuevo
      </Link>
    </main>
  );
}
