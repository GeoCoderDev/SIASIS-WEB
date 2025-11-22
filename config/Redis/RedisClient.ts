/* eslint-disable @typescript-eslint/no-explicit-any */
import { TipoAsistencia } from "@/interfaces/shared/AsistenciaRequests";
import { Redis } from "@upstash/redis";

export enum GruposIntanciasDeRedis {
  ParaAsistenciasDePersonal = "ParaAsistenciasDePersonal",
  ParaAsistenciasDeEstudiantesSecundaria = "ParaAsistenciasDeEstudiantesSecundaria",
  ParaAsistenciasDeEstudiantesPrimaria = "ParaAsistenciasDeEstudiantesPrimaria",
  ParaReportesDeAsistenciasEscolares = "ParaReportesDeAsistenciasEscolares",
}

// Initialization of Redis instances
const redisInstances: {
  [key in GruposIntanciasDeRedis]: Redis[];
} = {
  [GruposIntanciasDeRedis.ParaAsistenciasDePersonal]: [
    new Redis({
      url: process.env.RDP05_INS1_REDIS_BD_BASE_URL_API!,
      token: process.env.RDP05_INS1_REDIS_BD_TOKEN_FOR_API!,
    }),
    // You can add more instances for this type in the future
  ],
  [GruposIntanciasDeRedis.ParaAsistenciasDeEstudiantesSecundaria]: [
    new Redis({
      url: process.env.RDP05_INS2_REDIS_BD_BASE_URL_API!,
      token: process.env.RDP05_INS2_REDIS_BD_TOKEN_FOR_API!,
    }),
    // You can add more instances for this type in the future
  ],
  [GruposIntanciasDeRedis.ParaAsistenciasDeEstudiantesPrimaria]: [
    new Redis({
      url: process.env.RDP05_INS3_REDIS_BD_BASE_URL_API!,
      token: process.env.RDP05_INS3_REDIS_BD_TOKEN_FOR_API!,
    }),
    // You can add more instances for this type in the future
  ],
  [GruposIntanciasDeRedis.ParaReportesDeAsistenciasEscolares]: [
    new Redis({
      url: process.env.RDP05_INS1_REDIS_BD_BASE_URL_API!,
      token: process.env.RDP05_INS1_REDIS_BD_TOKEN_FOR_API!,
    }),
    // You can add more instances for this type in the future
  ],
};


// Function to get a random Redis instance
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

// Function to set a value in all Redis instances of a specific type
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

// Function to set a value in all Redis instances regardless of type
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

// 🆕 NEW FUNCTIONS ADDED WITHOUT BREAKING BACKWARDS COMPATIBILITY

// Function to get statistics from all instances
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

// Function to search in all instances of a type and combine results
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

// Function to verify consistency between instances
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

// Function compatible with your previous version, but enhanced to use the multiple instances system
export const redisClient = (grupoInstancias?: GruposIntanciasDeRedis) => {
  // We return an object with methods that handle operations across multiple instances
  return {
    get: async (key: string) => {
      // We always get from a random instance (of the specified type or any)
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
        // If a group is specified, first set null (with fast expiration) in all instances of that group
        await setInAllInstancesByType(grupoInstancias, key, null, 1);
        // Then we delete from a random instance of that group
        const redis = getRandomRedisClient(grupoInstancias);
        return await redis.del(key);
      } else {
        // If no type is specified, we set null in all instances
        await setInAllInstances(key, null, 1);
        // Then we delete from a random instance
        const redis = getRandomRedisClient();
        return await redis.del(key);
      }
    },

    // Keys method to search for keys matching a pattern
    keys: async (pattern: string) => {
      // The keys method always runs on a specific instance
      // It's not necessary to run it on all instances
      if (grupoInstancias !== undefined) {
        const redis = getRandomRedisClient(grupoInstancias);
        return await redis.keys(pattern);
      } else {
        // If no type is specified, we search in a random instance
        const redis = getRandomRedisClient();
        return await redis.keys(pattern);
      }
    },

    // 🆕 NEW METHODS ADDED

    // Check if a key exists
    exists: async (key: string) => {
      const redis = getRandomRedisClient(grupoInstancias);
      return await redis.exists(key);
    },

    // Get TTL of a key
    ttl: async (key: string) => {
      const redis = getRandomRedisClient(grupoInstancias);
      return await redis.ttl(key);
    },

    // Ping the instance
    ping: async () => {
      const redis = getRandomRedisClient(grupoInstancias);
      return await redis.ping();
    },

    // Exhaustive search in all instances of the type (useful for debugging)
    searchAll: async (pattern: string) => {
      if (grupoInstancias !== undefined) {
        return await searchInAllInstancesByType(grupoInstancias, pattern);
      } else {
        // If no type is specified, search in a random instance
        const redis = getRandomRedisClient();
        return await redis.keys(pattern);
      }
    },

    // Check consistency of a key between instances
    checkConsistency: async (key: string) => {
      if (grupoInstancias !== undefined) {
        return await checkConsistency(grupoInstancias, key);
      } else {
        throw new Error(
          "checkConsistency requiere especificar un grupo de instancias"
        );
      }
    },

    // Set value only in a specific instance (useful for testing)
    setSingle: async (key: string, value: any, expireIn?: number) => {
      const redis = getRandomRedisClient(grupoInstancias);
      if (expireIn !== undefined) {
        return await redis.set(key, value, { ex: expireIn });
      } else {
        return await redis.set(key, value);
      }
    },

    // Get statistics from instances
    getStats: async () => {
      return await getRedisStats();
    },

    // Method to get multiple keys at once
    mget: async (keys: string[]) => {
      const redis = getRandomRedisClient(grupoInstancias);
      return await redis.mget(...keys);
    },

    // Method to increment a numeric value
    incr: async (key: string) => {
      if (grupoInstancias !== undefined) {
        // For increment operations, we need to be more careful
        // We increment in one instance and then synchronize
        const redis = getRandomRedisClient(grupoInstancias);
        const result = await redis.incr(key);

        // Synchronize the new value in all instances
        await setInAllInstancesByType(grupoInstancias, key, result);
        return result;
      } else {
        const redis = getRandomRedisClient();
        return await redis.incr(key);
      }
    },
  };
};
