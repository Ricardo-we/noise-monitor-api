/**
 * Acceso a datos de la tabla `noise_readings`.
 * Ninguna otra capa debe hablar con Prisma directamente.
 */
import { prisma } from "../lib/prisma";
import type { NoiseDomainData } from "../types/noise-reading";

export interface CreateNoiseReadingInput {
  timestamp: Date;
  latitude: number;
  longitude: number;
  studentId: string;
  authHash: string;
  domainData: NoiseDomainData;
}

export const noiseReadingRepository = {
  /** Inserta una lectura y devuelve la fila creada (incluye `reading_id`). */
  async create(input: CreateNoiseReadingInput) {
    return prisma.noiseReading.create({
      data: {
        timestamp: input.timestamp,
        latitude: input.latitude,
        longitude: input.longitude,
        studentId: input.studentId,
        authHash: input.authHash,
        domainData: input.domainData,
      },
      select: {
        readingId: true,
        studentId: true,
        domainData: true,
        createdAt: true,
      },
    });
  },

  /** Comprueba que la base de datos responde. */
  async ping(): Promise<void> {
    await prisma.$queryRaw`SELECT 1`;
  },
};
