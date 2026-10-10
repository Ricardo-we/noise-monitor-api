import { Router } from "express";
import { getRecords } from "../controllers/records.controller";
import { validateQuery } from "../middlewares/validate";
import { recordsQuerySchema } from "../schemas/records.schema";

export const recordsRouter = Router();

recordsRouter.get("/", validateQuery(recordsQuerySchema), getRecords);
