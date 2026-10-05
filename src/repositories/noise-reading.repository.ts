/**
 * Acceso a datos de la tabla `noise_readings`.
 * Ninguna otra capa debe hablar con Prisma directamente.
 */
import { prisma } from "../lib/prisma";
import { env } from "../lib/env";
import { NearbyReadingError } from "../lib/http-error";
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
  /** HU-08: verifica cercanía y guarda en una misma transacción. */
  async create(input: CreateNoiseReadingInput) {
    return prisma.$transaction(async (tx) => {
      // Todas las inserciones de un día comparten el bloqueo, incluso entre
      // distintas instancias de la API. Se libera al confirmar o revertir.
      // Debe ser una consulta separada: la búsqueda posterior necesita ver
      // las filas que se confirmaron mientras esperábamos el bloqueo.
      await tx.$queryRaw`
        SELECT 1 AS locked FROM pg_advisory_xact_lock(
          5008,
          (${input.timestamp}::timestamptz AT TIME ZONE ${env.MEASUREMENT_TIME_ZONE})::date
            - DATE '1970-01-01'
        )
      `;

      const nearby = await tx.$queryRaw<Array<{ reading_id: string }>>`
        SELECT reading_id FROM public.noise_readings
        WHERE timestamp >= (
          (${input.timestamp}::timestamptz AT TIME ZONE ${env.MEASUREMENT_TIME_ZONE})::date::timestamp
            AT TIME ZONE ${env.MEASUREMENT_TIME_ZONE}
        )
          AND timestamp < (
            ((${input.timestamp}::timestamptz AT TIME ZONE ${env.MEASUREMENT_TIME_ZONE})::date + 1)::timestamp
              AT TIME ZONE ${env.MEASUREMENT_TIME_ZONE}
          )
          AND latitude BETWEEN -90 AND 90
          AND longitude BETWEEN -180 AND 180
          AND 2 * 6371008.8 * ASIN(SQRT(LEAST(1.0, GREATEST(0.0,
            POWER(SIN(RADIANS(latitude - ${input.latitude}::double precision) / 2), 2)
            + COS(RADIANS(${input.latitude}::double precision)) * COS(RADIANS(latitude))
              * POWER(SIN(RADIANS(longitude - ${input.longitude}::double precision) / 2), 2)
          )))) <= 50.0
        LIMIT 1
      `;

      if (nearby.length > 0) throw new NearbyReadingError();

      return tx.noiseReading.create({
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
    }, { isolationLevel: "ReadCommitted" });
  },

  /** Comprueba que la base de datos responde. */
  async ping(): Promise<void> {
    await prisma.$queryRaw`SELECT 1`;
  },
};
