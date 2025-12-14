/* eslint-disable @typescript-eslint/no-explicit-any */
import { TipoAsistencia } from "@/interfaces/shared/AsistenciaRequests";
import { Redis } from "@upstash/redis";

export enum GruposIntanciasDeRedis {
  ParaAsistenciasDePersonal = "ParaAsistenciasDePersonal",
  ParaAsistenciasDeEstudiantesSecundaria = "ParaAsistenciasDeEstudiantesSecundaria",
  ParaAsistenciasDeEstudiantesPrimaria = "ParaAsistenciasDeEstudiantesPrimaria",
  ParaReportesDeAsistenciasEscolares = "ParaReportesDeAsistenciasEscolares",
}

// Inicialización de las instancias de Redis
const redisInstances: {
  [key in GruposIntanciasDeRedis]: Redis[];
} = {
  [GruposIntanciasDeRedis.ParaAsistenciasDePersonal]: [
    new Redis({
      url: process.env.RDP05_INS1_REDIS_BD_BASE_URL_API!,
      token: process.env.RDP05_INS1_REDIS_BD_TOKEN_FOR_API!,
    }),
    // Aquí puedes agregar más instancias para este tipo en el futuro
  ],
  [GruposIntanciasDeRedis.ParaAsistenciasDeEstudiantesSecundaria]: [
    new Redis({
      url: process.env.RDP05_INS2_REDIS_BD_BASE_URL_API!,
      token: process.env.RDP05_INS2_REDIS_BD_TOKEN_FOR_API!,
    }),
    // Aquí puedes agregar más instancias para este tipo en el futuro
  ],
  [GruposIntanciasDeRedis.ParaAsistenciasDeEstudiantesPrimaria]: [
    new Redis({
      url: process.env.RDP05_INS3_REDIS_BD_BASE_URL_API!,
      token: process.env.RDP05_INS3_REDIS_BD_TOKEN_FOR_API!,
    }),
    // Aquí puedes agregar más instancias para este tipo en el futuro
  ],
  [GruposIntanciasDeRedis.ParaReportesDeAsistenciasEscolares]: [
    new Redis({
      url: process.env.RDP05_INS1_REDIS_BD_BASE_URL_API!,
      token: process.env.RDP05_INS1_REDIS_BD_TOKEN_FOR_API!,
    }),
    // Aquí puedes agregar más instancias para este tipo en el futuro
  ],
};


// Función para obtener una instancia aleatoria de Redis
export const getRandomRedisClient = (
  grupoInstancias?: GruposIntanciasDeRedis
): Redis => {
  if (grupoInstancias !== undefined) {
    const instances = redisInstances[grupoInstancias];
    if (!instances || instances.length === 0) {
      throw new Error(
        `No hay instancias disponibles para el grupo de instancias: ${grupoInstancias}`
      );
    }

    const randomIndex = Math.floor(Math.random() * instances.length);
    return instances[randomIndex];
  } else {
    // Si no se especifica tipo, elegimos aleatoriamente entre todas las instancias
    const allInstances = Object.values(redisInstances).flat();
    if (allInstances.length === 0) {
      throw new Error("No hay instancias de Redis disponibles");
    }

    const randomIndex = Math.floor(Math.random() * allInstances.length);
    return allInstances[randomIndex];
  }
};

// Función para establecer un valor en todas las instancias de Redis de un tipo específico
export const setInAllInstancesByType = async (
  grupoInstancias: GruposIntanciasDeRedis,
  key: string,
  value: any,
  expireIn?: number
): Promise<void> => {
  const instances = redisInstances[grupoInstancias];

  const setPromises = instances.map(async (redis) => {
    if (expireIn !== undefined) {
      await redis.set(key, value, { ex: expireIn });
    } else {
      await redis.set(key, value);
    }
  });

  await Promise.all(setPromises);
};

// Función para establecer un valor en todas las instancias de Redis sin importar el tipo
export const setInAllInstances = async (
  key: string,
  value: any,
  expireIn?: number
): Promise<void> => {
  const allPromises: Promise<any>[] = [];

  Object.values(redisInstances).forEach((instances) => {
    instances.forEach(async (redis) => {
      if (expireIn !== undefined) {
        allPromises.push(redis.set(key, value, { ex: expireIn }));
      } else {
        allPromises.push(redis.set(key, value));
      }
    });
  });

  await Promise.all(allPromises);
};

// 🆕 NUEVAS FUNCIONES AGREGADAS SIN ROMPER RETROCOMPATIBILIDAD

// Función para obtener estadísticas de todas las instancias
export const getRedisStats = async (): Promise<{
  [key in TipoAsistencia]: { totalInstances: number; activeInstances: number };
}> => {
  const stats = {} as {
    [key in TipoAsistencia]: {
      totalInstances: number;
      activeInstances: number;
    };
  };

  for (const [tipo, instances] of Object.entries(redisInstances) as [
    TipoAsistencia,
    Redis[]
  ][]) {
    const activeChecks = await Promise.allSettled(
      instances.map(async (redis) => {
        try {
          await redis.ping();
          return true;
        } catch {
          return false;
        }
      })
    );

    const activeCount = activeChecks.filter(
      (check) => check.status === "fulfilled" && check.value === true
    ).length;

    stats[tipo] = {
      totalInstances: instances.length,
      activeInstances: activeCount,
    };
  }

  return stats;
};

// Función para realizar búsquedas en todas las instancias de un tipo y combinar resultados
export const searchInAllInstancesByType = async (
  grupoInstancias: GruposIntanciasDeRedis,
  pattern: string
): Promise<string[]> => {
  const instances = redisInstances[grupoInstancias];

  const searchPromises = instances.map(async (redis) => {
    try {
      return await redis.keys(pattern);
    } catch (error) {
      console.warn(`Error searching in Redis instance:`, error);
      return [];
    }
  });

  const results = await Promise.allSettled(searchPromises);
  const allKeys = new Set<string>();

  results.forEach((result) => {
    if (result.status === "fulfilled" && Array.isArray(result.value)) {
      result.value.forEach((key) => allKeys.add(key));
    }
  });

  return Array.from(allKeys);
};

// Función para verificar consistencia entre instancias
export const checkConsistency = async (
  grupoInstancias: GruposIntanciasDeRedis,
  key: string
): Promise<{ isConsistent: boolean; values: any[]; instances: number }> => {
  const instances = redisInstances[grupoInstancias];

  const getPromises = instances.map(async (redis, index) => {
    try {
      const value = await redis.get(key);
      return { index, value, success: true };
    } catch (error) {
      return { index, value: null, success: false, error };
    }
  });

  const results = await Promise.allSettled(getPromises);
  const values: any[] = [];
  let successfulReads = 0;

  results.forEach((result) => {
    if (result.status === "fulfilled" && result.value.success) {
      values.push(result.value.value);
      successfulReads++;
    }
  });

  // Verificar si todos los valores son iguales
  const firstValue = values[0];
  const isConsistent = values.every(
    (value) => JSON.stringify(value) === JSON.stringify(firstValue)
  );

  return {
    isConsistent,
    values,
    instances: successfulReads,
  };
};

// Función compatible con tu versión anterior, pero mejorada para usar el sistema de instancias múltiples
export const redisClient = (grupoInstancias?: GruposIntanciasDeRedis) => {
  // Devolvemos un objeto con métodos que manejan las operaciones en múltiples instancias
  return {
    get: async (key: string) => {
      // Siempre obtenemos de una instancia aleatoria (del tipo especificado o de cualquiera)
      const redis = getRandomRedisClient(grupoInstancias);
      return await redis.get(key);
    },

    set: async (key: string, value: any, expireIn?: number) => {
      try {
        if (grupoInstancias !== undefined) {
          await setInAllInstancesByType(grupoInstancias, key, value, expireIn);
        } else {
          await setInAllInstances(key, value, expireIn);
        }
        return "OK"; // Devuelve "OK" para mantener compatibilidad
      } catch (error) {
        console.error("Error en operación SET:", error);
        throw error;
      }
    },

    del: async (key: string) => {
      if (grupoInstancias !== undefined) {
        // Si se especifica un grupo, primero establecemos null (con expiración rápida) en todas las instancias de ese grupo
        await setInAllInstancesByType(grupoInstancias, key, null, 1);
        // Luego eliminamos de una instancia aleatoria de ese grupo
        const redis = getRandomRedisClient(grupoInstancias);
        return await redis.del(key);
      } else {
        // Si no se especifica tipo, establecemos null en todas las instancias
        await setInAllInstances(key, null, 1);
        // Luego eliminamos de una instancia aleatoria
        const redis = getRandomRedisClient();
        return await redis.del(key);
      }
    },

    // Método keys para buscar claves según un patrón
    keys: async (pattern: string) => {
      // El método keys se ejecuta siempre en una instancia específica
      // No es necesario ejecutarlo en todas las instancias
      if (grupoInstancias !== undefined) {
        const redis = getRandomRedisClient(grupoInstancias);
        return await redis.keys(pattern);
      } else {
        // Si no se especifica tipo, buscamos en una instancia aleatoria
        const redis = getRandomRedisClient();
        return await redis.keys(pattern);
      }
    },

    // 🆕 MÉTODOS NUEVOS AGREGADOS

    // Verificar si una clave existe
    exists: async (key: string) => {
      const redis = getRandomRedisClient(grupoInstancias);
      return await redis.exists(key);
    },

    // Obtener TTL de una clave
    ttl: async (key: string) => {
      const redis = getRandomRedisClient(grupoInstancias);
      return await redis.ttl(key);
    },

    // Ping a la instancia
    ping: async () => {
      const redis = getRandomRedisClient(grupoInstancias);
      return await redis.ping();
    },

    // Búsqueda exhaustiva en todas las instancias del tipo (útil para debugging)
    searchAll: async (pattern: string) => {
      if (grupoInstancias !== undefined) {
        return await searchInAllInstancesByType(grupoInstancias, pattern);
      } else {
        // Si no se especifica tipo, buscar en una instancia aleatoria
        const redis = getRandomRedisClient();
        return await redis.keys(pattern);
      }
    },

    // Verificar consistencia de una clave entre instancias
    checkConsistency: async (key: string) => {
      if (grupoInstancias !== undefined) {
        return await checkConsistency(grupoInstancias, key);
      } else {
        throw new Error(
          "checkConsistency requiere especificar un grupo de instancias"
        );
      }
    },

    // Establecer valor solo en una instancia específica (útil para testing)
    setSingle: async (key: string, value: any, expireIn?: number) => {
      const redis = getRandomRedisClient(grupoInstancias);
      if (expireIn !== undefined) {
        return await redis.set(key, value, { ex: expireIn });
      } else {
        return await redis.set(key, value);
      }
    },

    // Obtener estadísticas de las instancias
    getStats: async () => {
      return await getRedisStats();
    },

    // Método para obtener múltiples claves de una vez
    mget: async (keys: string[]) => {
      const redis = getRandomRedisClient(grupoInstancias);
      return await redis.mget(...keys);
    },

    // Método para incrementar un valor numérico
    incr: async (key: string) => {
      if (grupoInstancias !== undefined) {
        // Para operaciones de incremento, necesitamos ser más cuidadosos
        // Incrementamos en una instancia y luego sincronizamos
        const redis = getRandomRedisClient(grupoInstancias);
        const result = await redis.incr(key);

        // Sincronizar el nuevo valor en todas las instancias
        await setInAllInstancesByType(grupoInstancias, key, result);
        return result;
      } else {
        const redis = getRandomRedisClient();
        return await redis.incr(key);
      }
    },
  };
};
