/** Punto de entrada: valida el entorno, comprueba la BD y levanta el servidor. */
import { createApp } from "./app/app";
import { env } from "./lib/env";
import { logger } from "./lib/logger";
import { disconnectPrisma, prisma } from "./lib/prisma";
import { noiseReadingRepository } from "./repositories/noise-reading.repository";

async function main(): Promise<void> {
  await prisma.$connect();
  await noiseReadingRepository.ping();
  logger.info("conexión con la base de datos verificada");

  const app = createApp();
  const server = app.listen(env.PORT, env.HOST, () => {
    logger.info("API escuchando", { url: `http://${env.HOST}:${env.PORT}`, env: env.NODE_ENV });
  });

  registerGracefulShutdown(server);
}

function registerGracefulShutdown(server: import("node:http").Server): void {
  const shutdown = (signal: NodeJS.Signals) => {
    logger.info("apagando servidor", { signal });
    server.close(async () => {
      await disconnectPrisma();
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  logger.error("no se pudo iniciar la API", { error: error instanceof Error ? error.message : error });
  process.exit(1);
});
