/** Construcción de la aplicación Express (sin listen: facilita los tests). */
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { env } from "../lib/env";
import { errorHandler } from "./middlewares/error-handler";
import { notFoundHandler } from "./middlewares/not-found";
import { requestLogger } from "./middlewares/request-logger";
import { apiRouter } from "./routes";

export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(express.json({ limit: "64kb" }));
  app.use(cors({ origin: resolveCorsOrigin(), credentials: false }));
  app.use(requestLogger);

  app.use("/api", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

function resolveCorsOrigin(): true | string[] {
  const { corsOrigins } = env;
  if (corsOrigins.includes("*")) return true;
  return corsOrigins;
}
