import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Server } from "node:http";

type Repository = typeof import("../src/repositories/noise-reading.repository.js").noiseReadingRepository;
let server: Server;
let apiUrl: string;
let repository: Repository;
let originalList: Repository["list"];
let disconnect: () => Promise<void>;
let calls = 0;

before(async () => {
  process.env.DB_URL = "postgresql://test:test@127.0.0.1:5432/test";
  process.env.NODE_ENV = "test";
  const { createApp } = await import("../src/app/app.js");
  repository = (await import("../src/repositories/noise-reading.repository.js")).noiseReadingRepository;
  disconnect = (await import("../src/lib/prisma.js")).disconnectPrisma;
  originalList = repository.list;
  repository.list = async () => { calls++; return { rows: [], total: 0 }; };
  server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  assert(address && typeof address !== "string");
  apiUrl = `http://127.0.0.1:${address.port}/api/records`;
});

after(async () => {
  if (repository) repository.list = originalList;
  if (server) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (disconnect) await disconnect();
});

for (const query of [
  "page=0", "page=-1", "page=1.5", "page=abc", "page=", "page=1e2",
  "limit=0", "limit=101", "limit=2.5", "limit=Infinity", "limit=",
  "page=1&page=2", "limit=10&limit=20", "page[x]=1", "sort=timestamp",
  "page=9007199254740992", "page=2147483647&limit=100",
]) {
  test(`GET records rechaza ${query} antes de consultar la BD`, async () => {
    const beforeCalls = calls;
    const response = await fetch(`${apiUrl}?${query}`);
    assert.equal(response.status, 400);
    const body = await response.json() as { error: { code: string; message: string; details: unknown[] } };
    assert.equal(body.error.code, "VALIDATION_ERROR");
    assert.equal(body.error.message, "Los parámetros de consulta no son válidos");
    assert(body.error.details.length > 0);
    assert.equal(calls, beforeCalls);
  });
}

test("GET records devuelve error 503 de conexión; no lo disfraza de página vacía", async () => {
  repository.list = async () => { throw Object.assign(new Error("test connection failure"), { code: "P1001" }); };
  const response = await fetch(apiUrl);
  assert.equal(response.status, 503);
  const body = await response.json() as { error: { code: string }; data?: unknown };
  assert.equal(body.error.code, "DB_UNAVAILABLE");
  assert.equal(body.data, undefined);
});
