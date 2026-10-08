/** GET /api/health-check */
import { Router } from "express";
import { healthCheck } from "../controllers/health-check.controller";

export const healthCheckRouter = Router();

healthCheckRouter.get("/", healthCheck);
