import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Server } from "node:http";

type NoiseReadingRepository = typeof import("../src/repositories/noise-reading.repository.js").noiseReadingRepository;
let server: Server;
let apiUrl: string;
let repository: NoiseReadingRepository;
let originalPing: NoiseReadingRepository["ping"];
let disconnectPrisma: () => Promise<void>;

before(async () => {
  process.env.DB_URL = "postgresql://test:test@127.0.0.1:5432/test";
  process.env.NODE_ENV = "test";

  const [{ createApp }, repositoryModule, prismaModule] = await Promise.all([
    import("../src/app/app.js"),
    import("../src/repositories/noise-reading.repository.js"),
    import("../src/lib/prisma.js"),
  ]);
  repository = repositoryModule.noiseReadingRepository;
  originalPing = repository.ping;
  disconnectPrisma = prismaModule.disconnectPrisma;
  repository.ping = async () => {};

  server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  assert(address && typeof address !== "string");
  apiUrl = `http://127.0.0.1:${address.port}/api/health-check`;
});

after(async () => {
  repository.ping = originalPing;
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
  if (disconnectPrisma) await disconnectPrisma();
});

test("200 cuando la base de datos responde", async () => {
  const response = await fetch(apiUrl);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok", database: "ok" });
});

test("503 cuando la base de datos no responde", async () => {
  repository.ping = async () => {
    throw new Error("database unavailable");
  };

  const response = await fetch(apiUrl);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: "error", database: "unavailable" });
});
