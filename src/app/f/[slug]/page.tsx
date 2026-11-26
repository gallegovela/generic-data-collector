import { notFound, redirect } from "next/navigation";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "@/lib/errors";
import { getCurrentUser } from "@/server/auth/session";
import {
  getFormForFilling,
  type FormLookup,
} from "@/server/form-publishing/form-publishing.service";

export const dynamic = "force-dynamic";

function Message({ children, testId }: { children: string; testId?: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center justify-center p-6 text-center">
      <p data-testid={testId} className="text-lg text-muted-foreground">
        {children}
      </p>
    </main>
  );
}

/**
 * Enlace estable de un formulario publicado. El relleno real lo aporta
 * `field-collector`; aquí hay un marcador.
 *
 * Cubre: RF-PUB-04, RF-PUB-06, RF-PUB-10, CA-PUB-02, CA-PUB-04, CA-PUB-06
 */
export default async function FillFormPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let lookup: FormLookup;
  try {
    lookup = await getFormForFilling(slug, await getCurrentUser());
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    if (error instanceof UnauthorizedError) redirect("/login");
    if (error instanceof ForbiddenError) {
      return (
        <Message testId="access-forbidden">
          No tienes acceso a este formulario. Entra con una cuenta de la organización que lo ha
          publicado.
        </Message>
      );
    }
    throw error;
  }

  if (lookup.state === "closed") {
    return <Message testId="form-closed">Este formulario ya no acepta respuestas</Message>;
  }

  return (
    <main className="mx-auto max-w-md p-6 text-center">
      <h1 className="text-2xl font-semibold">{lookup.form.schema.title}</h1>
      {/* TODO(field-collector): sustituir este marcador por la pantalla de relleno */}
      <p data-testid="fill-placeholder" className="mt-4 text-muted-foreground">
        Rellenado disponible próximamente
      </p>
    </main>
  );
}
