import Link from "next/link";

/** Pantalla final de quien rellena sin sesión (modo público). Cubre: RF-COL-16, CA-COL-07 */
export default async function ThanksPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 data-testid="thanks" className="text-2xl font-semibold">
        ¡Gracias! Respuesta guardada
      </h1>
      <p className="text-muted-foreground">Hemos recibido tu respuesta.</p>
      <Link href={`/f/${slug}`} className="text-primary underline underline-offset-4">
        Rellenar otra vez
      </Link>
    </main>
  );
}
