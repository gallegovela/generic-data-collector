import { connection, NextResponse } from "next/server";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "@/lib/errors";
import { getCurrentUser } from "@/server/auth/session";
import { getFormForFilling } from "@/server/form-publishing/form-publishing.service";

const HEADERS = { "Cache-Control": "no-store" };

/**
 * Definición de un formulario publicado para rellenarlo, con control de
 * acceso por modo. Incluye `consent` y `organizationName`; no devuelve
 * `organizationId` ni `declaredBy*`.
 *
 * Cubre: RF-PUB-15, RF-PUB-04, RF-PUB-09, RF-PUB-10, CA-PUB-04, CA-PUB-06
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  await connection();
  const { slug } = await params;

  try {
    const user = await getCurrentUser();
    const lookup = await getFormForFilling(slug, user);
    if (lookup.state === "closed") {
      return NextResponse.json(
        { error: "closed", message: "Este formulario ya no acepta respuestas." },
        { status: 410, headers: HEADERS },
      );
    }
    const { organizationId: _organizationId, ...view } = lookup.form;
    void _organizationId;
    return NextResponse.json(view, { status: 200, headers: HEADERS });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "login-required" }, { status: 401, headers: HEADERS });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: "forbidden" }, { status: 403, headers: HEADERS });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: "not-found" }, { status: 404, headers: HEADERS });
    }
    throw error;
  }
}
