/**
 * Instancia única de Prisma Client conectada a Neon (PostgreSQL) mediante el
 * driver adapter `@prisma/adapter-pg`, usando la variable de entorno DB_URL.
 *
 * En desarrollo (`tsx watch`) el módulo se recarga en cada cambio, por eso la
 * instancia se guarda en `globalThis` para no abrir un pool nuevo en cada reload.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { env } from "./env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: env.DB_URL });
  return new PrismaClient({
    adapter,
    log: env.isProduction ? ["error"] : ["warn", "error"],
  });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (!env.isProduction) globalForPrisma.prisma = prisma;

/** Cierra el pool de conexiones (usado en el apagado ordenado del servidor). */
export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
