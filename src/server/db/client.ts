import { PrismaClient } from "@prisma/client";

// Singleton del cliente de Prisma. En desarrollo, `next dev` recarga
// los módulos en caliente; sin esta guarda se abriría una conexión
// nueva a la base de datos en cada recarga.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
