/** Índice de rutas: todo lo público de la API cuelga de `/api`. */
import { Router } from "express";
import { saveAudioRecordRouter } from "./save-audio-record.route";

export const apiRouter = Router();

apiRouter.use("/save-audio-record", saveAudioRecordRouter);
