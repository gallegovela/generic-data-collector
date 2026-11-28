import Link from "next/link";
import { notFound } from "next/navigation";
import { DeliveryHistory } from "@/components/outputs/delivery-history";
import { DestinationsPanel } from "@/components/outputs/destinations-panel";
import { NotFoundError } from "@/lib/errors";
import { requireAdminPage } from "@/server/auth/session";
import { listDeliveries } from "@/server/outputs/delivery.service";
import { getDestinations } from "@/server/outputs/destination.service";

export const dynamic = "force-dynamic";

/** Destinos del formulario: email con PDF y webhook. Cubre: RF-OUT-01, RF-OUT-07, RF-OUT-10, CA-OUT-09 */
export default async function DestinationsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdminPage();
  const { id } = await params;

  let destinations;
  let deliveries;
  try {
    destinations = await getDestinations(user.organizationId, id);
    deliveries = await listDeliveries(user.organizationId, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  return (
    <div className="space-y-4">
      <Link href={`/admin/forms/${id}/submissions`} className="text-sm underline">
        ← Volver a las respuestas
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Destinos</h1>
      <DestinationsPanel formId={id} destinations={destinations} />
      <h2 className="text-lg font-medium">Historial de envíos</h2>
      <DeliveryHistory formId={id} deliveries={deliveries} />
    </div>
  );
}
