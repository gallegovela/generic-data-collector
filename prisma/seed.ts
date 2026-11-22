// Datos de ejemplo de tenancy-auth: la organización de demostración y
// su admin/collector con credenciales fijas (ver
// specs/tenancy-auth/design.md#datos-de-ejemplo-seed). El seed
// completo con formularios y respuestas lo añade demo-seed.
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/server/auth/auth.service";

const prisma = new PrismaClient();

const ORGANIZATION_NAME = "Constructora Demo";
const DEMO_PASSWORD = "Demo1234!";

async function main() {
  const organization = await prisma.organization.upsert({
    where: { id: "demo-org" },
    update: {},
    create: { id: "demo-org", name: ORGANIZATION_NAME },
  });

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  await prisma.user.upsert({
    where: { email: "admin@demo.formia.local" },
    update: {},
    create: {
      email: "admin@demo.formia.local",
      name: "Admin Demo",
      role: "admin",
      status: "active",
      passwordHash,
      organizationId: organization.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "collector@demo.formia.local" },
    update: {},
    create: {
      email: "collector@demo.formia.local",
      name: "Collector Demo",
      role: "collector",
      status: "active",
      passwordHash,
      organizationId: organization.id,
    },
  });

  console.log(`Seed completado: organización "${ORGANIZATION_NAME}" con admin y collector de ejemplo.`);
}

main()
  .catch((error) => {
    console.error("Error al ejecutar el seed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
