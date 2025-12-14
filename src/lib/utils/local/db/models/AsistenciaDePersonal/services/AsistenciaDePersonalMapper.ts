/* eslint-disable @typescript-eslint/no-explicit-any */
import { RolesSistema } from "@/interfaces/shared/RolesSistema";
import { ActoresSistema } from "@/interfaces/shared/ActoresSistema";
import { ModoRegistro } from "@/interfaces/shared/ModoRegistro";
import { EstadosAsistenciaPersonal } from "@/interfaces/shared/EstadosAsistenciaPersonal";

import { TipoPersonal } from "../AsistenciaDePersonalTypes";
import {
  SEGUNDOS_TOLERANCIA_ENTRADA_PERSONAL,
  SEGUNDOS_TOLERANCIA_SALIDA_PERSONAL,
} from "@/constants/MINUTOS_TOLERANCIA_ASISTENCIA_PERSONAL";

// Interfaces for entry/exit records
export interface RegistroEntradaSalida {
  timestamp: number;
  desfaseSegundos: number;
  estado: EstadosAsistenciaPersonal;
}

/**
 * 🎯 RESPONSIBILITY: Conversions and mapping between different data types
 * - Mapping roles to staff types
 * - Mapping data between different formats
 * - Determination of attendance statuses
 * - Generation of field names and stores
 *
 * ✅ UPDATED: Full support for principals
 */
export class AsistenciaDePersonalMapper {
  /**
   * ✅ UPDATED: Converts a system role to the corresponding staff type
   * Includes support for principals
   */
  public obtenerTipoPersonalDesdeRolOActor(
    rol: RolesSistema | ActoresSistema
  ): TipoPersonal {
    switch (rol) {
      // ✅ NEW: Support for principals
      case RolesSistema.Directivo:
      case ActoresSistema.Directivo:
        return TipoPersonal.DIRECTIVO;

      case RolesSistema.ProfesorPrimaria:
      case ActoresSistema.ProforesorPrimaria:
        return TipoPersonal.PROFESOR_PRIMARIA;

      case RolesSistema.ProfesorSecundaria:
      case RolesSistema.Tutor:
      case ActoresSistema.ProfesorSecundaria:
        return TipoPersonal.PROFESOR_SECUNDARIA;

      case RolesSistema.Auxiliar:
      case ActoresSistema.Auxiliar:
        return TipoPersonal.AUXILIAR;

      case RolesSistema.PersonalAdministrativo:
      case ActoresSistema.PersonalAdministrativo:
        return TipoPersonal.PERSONAL_ADMINISTRATIVO;

      default:
        throw new Error(`Rol no válido o no soportado: ${rol}`);
    }
  }

  /**
   * ✅ UPDATED: Maps system role to actor (includes principals)
   */
  public obtenerActorDesdeRol(rol: RolesSistema): ActoresSistema {
    switch (rol) {
      // ✅ NEW: Support for principals
      case RolesSistema.Directivo:
        return ActoresSistema.Directivo;

      case RolesSistema.ProfesorPrimaria:
        return ActoresSistema.ProfesorPrimaria;

      case RolesSistema.ProfesorSecundaria:
      case RolesSistema.Tutor:
        return ActoresSistema.ProfesorSecundaria;

      case RolesSistema.Auxiliar:
        return ActoresSistema.Auxiliar;

      case RolesSistema.PersonalAdministrativo:
        return ActoresSistema.PersonalAdministrativo;

      default:
        throw new Error(`Rol no válido para asistencia personal: ${rol}`);
    }
  }

  public obtenerRolDesdeActor(actor: ActoresSistema): RolesSistema {
    switch (actor) {
      case ActoresSistema.Directivo:
        return RolesSistema.Directivo;
      case ActoresSistema.ProfesorPrimaria:
        return RolesSistema.ProfesorPrimaria;
      case ActoresSistema.ProfesorSecundaria:
        return RolesSistema.ProfesorSecundaria;
      case ActoresSistema.Auxiliar:
        return RolesSistema.Auxiliar;
      case ActoresSistema.PersonalAdministrativo:
        return RolesSistema.PersonalAdministrativo;
      default:
        throw new Error(`Actor no válido: ${actor}`);
    }
  }

  /**
   * Gets the store name according to the staff type and registration mode
   */
  public getStoreName(
    tipoPersonal: TipoPersonal,
    modoRegistro: ModoRegistro
  ): string {
    const baseNames = {
      [TipoPersonal.DIRECTIVO]:
        modoRegistro === ModoRegistro.Entrada
          ? "control_entrada_directivos"
          : "control_salida_directivos",
      [TipoPersonal.PROFESOR_PRIMARIA]:
        modoRegistro === ModoRegistro.Entrada
          ? "control_entrada_profesores_primaria"
          : "control_salida_profesores_primaria",
      [TipoPersonal.PROFESOR_SECUNDARIA]:
        modoRegistro === ModoRegistro.Entrada
          ? "control_entrada_profesores_secundaria"
          : "control_salida_profesores_secundaria",
      [TipoPersonal.AUXILIAR]:
        modoRegistro === ModoRegistro.Entrada
          ? "control_entrada_auxiliar"
          : "control_salida_auxiliar",
      [TipoPersonal.PERSONAL_ADMINISTRATIVO]:
        modoRegistro === ModoRegistro.Entrada
          ? "control_entrada_personal_administrativo"
          : "control_salida_personal_administrativo",
    };

    return baseNames[tipoPersonal];
  }

  /**
   * Gets the name of the identification field according to the staff type
   */
  public getIdFieldName(tipoPersonal: TipoPersonal): string {
    const fieldNames = {
      [TipoPersonal.DIRECTIVO]: "Id_Directivo", // ✅ DIFFERENT: ID instead of DNI
      [TipoPersonal.PROFESOR_PRIMARIA]: "Id_Profesor_Primaria",
      [TipoPersonal.PROFESOR_SECUNDARIA]: "Id_Profesor_Secundaria",
      [TipoPersonal.AUXILIAR]: "Id_Auxiliar",
      [TipoPersonal.PERSONAL_ADMINISTRATIVO]: "Id_Personal_Administrativo",
    };

    return fieldNames[tipoPersonal];
  }

  /**
   * Gets the ID field name according to the staff type and registration mode
   */
  public getIdFieldForStore(
    tipoPersonal: TipoPersonal,
    modoRegistro: ModoRegistro
  ): string {
    const idFields = {
      [TipoPersonal.DIRECTIVO]:
        modoRegistro === ModoRegistro.Entrada
          ? "Id_C_E_M_P_Directivo"
          : "Id_C_S_M_P_Directivo",
      [TipoPersonal.PROFESOR_PRIMARIA]:
        modoRegistro === ModoRegistro.Entrada
          ? "Id_C_E_M_P_Profesores_Primaria"
          : "Id_C_S_M_P_Profesores_Primaria",
      [TipoPersonal.PROFESOR_SECUNDARIA]:
        modoRegistro === ModoRegistro.Entrada
          ? "Id_C_E_M_P_Profesores_Secundaria"
          : "Id_C_S_M_P_Profesores_Secundaria",
      [TipoPersonal.AUXILIAR]:
        modoRegistro === ModoRegistro.Entrada
          ? "Id_C_E_M_P_Auxiliar"
          : "Id_C_S_M_P_Auxiliar",
      [TipoPersonal.PERSONAL_ADMINISTRATIVO]:
        modoRegistro === ModoRegistro.Entrada
          ? "Id_C_E_M_P_Administrativo"
          : "Id_C_S_M_P_Administrativo",
    };

    return idFields[tipoPersonal];
  }

  /**
   * Gets the index name for searching by staff and month
   */
  public getIndexNameForPersonalMes(tipoPersonal: TipoPersonal): string {
    const indexNames = {
      [TipoPersonal.DIRECTIVO]: "por_directivo_mes", // ✅ DIFFERENT
      [TipoPersonal.PROFESOR_PRIMARIA]: "por_profesor_mes",
      [TipoPersonal.PROFESOR_SECUNDARIA]: "por_profesor_mes",
      [TipoPersonal.AUXILIAR]: "por_auxiliar_mes",
      [TipoPersonal.PERSONAL_ADMINISTRATIVO]: "por_administrativo_mes",
    };

    return indexNames[tipoPersonal];
  }

  /**
   * ✅ NEW: Determines if the staff type uses a numeric ID or DNI
   */
  public usaIdNumerico(tipoPersonal: TipoPersonal): boolean {
    return tipoPersonal === TipoPersonal.DIRECTIVO;
  }

  /**
   * ✅ NEW: Validates the identifier format according to the staff type
   */
  public validarFormatoIdentificador(
    tipoPersonal: TipoPersonal,
    identificador: string
  ): boolean {
    if (this.usaIdNumerico(tipoPersonal)) {
      // For principals: must be a numeric ID (as a string)
      return /^[0-9]+$/.test(identificador);
    } else {
      // For others: must be an 8-digit DNI
      return /^\d{8}$/.test(identificador);
    }
  }

  /**
   * ✅ NEW: Gets the readable identifier type for error messages
   */
  public getTipoIdentificadorLegible(tipoPersonal: TipoPersonal): string {
    return this.usaIdNumerico(tipoPersonal) ? "ID" : "DNI";
  }

  /**
   * ✅ NEW: Maps the store name to TipoPersonal (useful for reverse operations)
   */
  public getPersonalTypeFromStoreName(storeName: string): TipoPersonal | null {
    const storeMapping: Record<string, TipoPersonal> = {
      control_entrada_mensual_directivos: TipoPersonal.DIRECTIVO,
      control_salida_mensual_directivos: TipoPersonal.DIRECTIVO,
      control_entrada_profesores_primaria: TipoPersonal.PROFESOR_PRIMARIA,
      control_salida_profesores_primaria: TipoPersonal.PROFESOR_PRIMARIA,
      control_entrada_profesores_secundaria: TipoPersonal.PROFESOR_SECUNDARIA,
      control_salida_profesores_secundaria: TipoPersonal.PROFESOR_SECUNDARIA,
      control_entrada_auxiliar: TipoPersonal.AUXILIAR,
      control_salida_auxiliar: TipoPersonal.AUXILIAR,
      control_entrada_personal_administrativo:
        TipoPersonal.PERSONAL_ADMINISTRATIVO,
      control_salida_personal_administrativo:
        TipoPersonal.PERSONAL_ADMINISTRATIVO,
    };

    return storeMapping[storeName] || null;
  }

  /**
   * ✅ NEW: Gets identifier from decoded JWT token
   * Handles different types of roles and their identifiers
   */
  public obtenerIdentificadorDesdeJWT(
    tokenDecodificado: any,
    rol: RolesSistema
  ): string {
    const tipoPersonal = this.obtenerTipoPersonalDesdeRolOActor(rol);

    switch (tipoPersonal) {
      case TipoPersonal.DIRECTIVO:
        // For principals: get the ID from the token
        return (
          tokenDecodificado.Id_Directivo?.toString() ||
          tokenDecodificado.id?.toString() ||
          tokenDecodificado.Id?.toString() ||
          ""
        );

      case TipoPersonal.PROFESOR_PRIMARIA:
        return (
          tokenDecodificado.Id_Profesor_Primaria || tokenDecodificado.dni || ""
        );

      case TipoPersonal.PROFESOR_SECUNDARIA:
        return (
          tokenDecodificado.Id_Profesor_Secundaria ||
          tokenDecodificado.dni ||
          ""
        );

      case TipoPersonal.AUXILIAR:
        return tokenDecodificado.Id_Auxiliar || tokenDecodificado.dni || "";

      case TipoPersonal.PERSONAL_ADMINISTRATIVO:
        return (
          tokenDecodificado.Id_Personal_Administrativo ||
          tokenDecodificado.dni ||
          ""
        );

      default:
        console.warn(
          `Tipo de personal no reconocido para JWT: ${tipoPersonal}`
        );
        return tokenDecodificado.dni || tokenDecodificado.id?.toString() || "";
    }
  }

  /**
   * ✅ NEW: Validates that the identifier extracted from the JWT is valid
   */
  public validarIdentificadorJWT(
    identificador: string,
    rol: RolesSistema
  ): {
    valido: boolean;
    razon: string;
    identificadorLimpio: string;
  } {
    const tipoPersonal = this.obtenerTipoPersonalDesdeRolOActor(rol);
    const identificadorLimpio = identificador.trim();

    if (!identificadorLimpio) {
      return {
        valido: false,
        razon: `${this.getTipoIdentificadorLegible(
          tipoPersonal
        )} cannot be empty`,
        identificadorLimpio: "",
      };
    }

    if (!this.validarFormatoIdentificador(tipoPersonal, identificadorLimpio)) {
      const tipoEsperado = this.getTipoIdentificadorLegible(tipoPersonal);
      const formatoEsperado = this.usaIdNumerico(tipoPersonal)
        ? "numeric ID"
        : "8-digit DNI";

      return {
        valido: false,
        razon: `${tipoEsperado} has an invalid format. Expected: ${formatoEsperado}`,
        identificadorLimpio,
      };
    }

    return {
      valido: true,
      razon: "Valid identifier",
      identificadorLimpio,
    };
  }

  /**
   * Determines the attendance status based on the time offset
   */
  public determinarEstadoAsistencia(
    desfaseSegundos: number,
    modoRegistro: ModoRegistro
  ): EstadosAsistenciaPersonal {
    if (modoRegistro === ModoRegistro.Entrada) {
      // ✅ CHANGE: Only Early or Late
      if (desfaseSegundos <= SEGUNDOS_TOLERANCIA_ENTRADA_PERSONAL) {
        return EstadosAsistenciaPersonal.Temprano; // ✅ CHANGED
      } else {
        return EstadosAsistenciaPersonal.Tarde; // ✅ NO TOLERANCE
      }
    } else {
      // For exits, keep the existing logic or change as needed
      if (desfaseSegundos >= -SEGUNDOS_TOLERANCIA_SALIDA_PERSONAL) {
        return EstadosAsistenciaPersonal.Cumplido;
      }
      else {
        return EstadosAsistenciaPersonal.Salida_Anticipada;
      }
    }
  }

  /**
   * ✅ UPDATED: Processes JSON records handling NULL values for 404s
   */
  public procesarRegistrosJSON(
    registrosJSON: any,
    modoRegistro: ModoRegistro
  ): Record<string, RegistroEntradaSalida> {
    const registrosProcesados: Record<string, RegistroEntradaSalida> = {};

    // ✅ 404 HANDLING: If registrosJSON is null, return an empty object
    if (registrosJSON === null || registrosJSON === undefined) {
      console.log(
        `📝 Procesando registro NULL (404 de API) para ${modoRegistro}`
      );
      return registrosProcesados; // Empty but valid object
    }

    // ✅ VALIDATION: Ensure it is an object
    if (typeof registrosJSON !== "object") {
      console.warn(
        `⚠️ registrosJSON no es un objeto válido para ${modoRegistro}:`,
        registrosJSON
      );
      return registrosProcesados;
    }

    Object.entries(registrosJSON).forEach(
      ([dia, registroRaw]: [string, any]) => {
        if (registroRaw === null) {
          registrosProcesados[dia] = {
            timestamp: 0,
            desfaseSegundos: 0,
            estado: EstadosAsistenciaPersonal.Inactivo,
          };
          return;
        }

        if (registroRaw && typeof registroRaw === "object") {
          const timestamp = registroRaw.Timestamp;
          const desfaseSegundos = registroRaw.DesfaseSegundos;

          if (timestamp === null && desfaseSegundos === null) {
            registrosProcesados[dia] = {
              timestamp: 0,
              desfaseSegundos: 0,
              estado: EstadosAsistenciaPersonal.Falta,
            };
            return;
          }

          if (timestamp === null) {
            registrosProcesados[dia] = {
              timestamp: 0,
              desfaseSegundos: 0,
              estado: EstadosAsistenciaPersonal.Inactivo,
            };
            return;
          }

          if (desfaseSegundos === null) {
            registrosProcesados[dia] = {
              timestamp: timestamp || 0,
              desfaseSegundos: 0,
              estado: EstadosAsistenciaPersonal.Sin_Registro,
            };
            return;
          }

          const estado = this.determinarEstadoAsistencia(
            desfaseSegundos,
            modoRegistro
          );

          registrosProcesados[dia] = {
            timestamp: timestamp || 0,
            desfaseSegundos: desfaseSegundos || 0,
            estado,
          };
        }
      }
    );

    return registrosProcesados;
  }

  /**
   * Generates cache key (Redis compatible format)
   */
  public generarClaveCache(
    actor: ActoresSistema,
    modoRegistro: ModoRegistro,
    idUsuario: string | number,
    fecha: string
  ): string {
    return `${fecha}:${modoRegistro}:${actor}:${idUsuario}`;
  }

  // ========================================================================================
  // ✅ NEW METHODS FOR SMART FLOW
  // ========================================================================================

  /**
   * ✅ NEW: Determines if a role can use the smart flow
   */
  public puedeUsarFlujoInteligente(rol: RolesSistema): boolean {
    try {
      // Try to map the role to see if it is valid
      this.obtenerTipoPersonalDesdeRolOActor(rol);
      return true;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      return false;
    }
  }

  /**
   * ✅ NEW: Gets role-specific configuration for optimizations
   */
  public obtenerConfiguracionOptimizacion(rol: RolesSistema): {
    puedeUsarCache: boolean;
    requiereValidacionExtra: boolean;
    soportaHorarios: boolean;
    tipoIdentificador: "ID" | "DNI";
  } {
    const tipoPersonal = this.obtenerTipoPersonalDesdeRolOActor(rol);

    return {
      puedeUsarCache: true, // All roles can use cache
      requiereValidacionExtra: tipoPersonal === TipoPersonal.DIRECTIVO, // Principals require extra validation
      soportaHorarios: true, // All support schedule logic
      tipoIdentificador: this.usaIdNumerico(tipoPersonal) ? "ID" : "DNI",
    };
  }

  /**
   * ✅ NEW: Maps raw API data to internal format with mandatory timestamp
   */
  public mapearDesdeAPIConTimestamp(
    datosAPI: any,
    ultimaFechaActualizacion: number
  ): {
    entrada: any | null;
    salida: any | null;
  } {
    try {
      const registroBase = {
        Id_Registro_Mensual: datosAPI.Id_Registro_Mensual_Entrada || Date.now(),
        Mes: datosAPI.Mes,
        idUsuario_Personal: datosAPI.idUsuario_Usuario,
        ultima_fecha_actualizacion: ultimaFechaActualizacion, // ✅ MANDATORY
      };

      const entrada =
        datosAPI.Entradas !== undefined
          ? {
              ...registroBase,
              Id_Registro_Mensual: datosAPI.Id_Registro_Mensual_Entrada,
              Entradas: datosAPI.Entradas, // Can be null for 404s
            }
          : null;

      const salida =
        datosAPI.Salidas !== undefined
          ? {
              ...registroBase,
              Id_Registro_Mensual: datosAPI.Id_Registro_Mensual_Salida,
              Salidas: datosAPI.Salidas, // Can be null for 404s
            }
          : null;

      return { entrada, salida };
    } catch (error) {
      console.error("Error al mapear datos de API:", error);
      return { entrada: null, salida: null };
    }
  }

  /**
   * ✅ NEW: Validates data consistency before saving
   */
  public validarConsistenciaDatos(
    datosEntrada: any,
    datosSalida: any
  ): {
    valido: boolean;
    errores: string[];
    advertencias: string[];
  } {
    const errores: string[] = [];
    const advertencias: string[] = [];

    // Validate that both records have the same user
    if (datosEntrada && datosSalida) {
      if (datosEntrada.idUsuario_Personal !== datosSalida.idUsuario_Personal) {
        errores.push("The ID/DNI does not match between entry and exit");
      }

      if (datosEntrada.Mes !== datosSalida.Mes) {
        errores.push("The month does not match between entry and exit");
      }

      // Validate timestamps
      if (!datosEntrada.ultima_fecha_actualizacion) {
        errores.push("Missing timestamp in entry data");
      }

      if (!datosSalida.ultima_fecha_actualizacion) {
        errores.push("Missing timestamp in exit data");
      }

      // Warn about timestamp differences
      const diferenciaTimestamp = Math.abs(
        (datosEntrada.ultima_fecha_actualizacion || 0) -
          (datosSalida.ultima_fecha_actualizacion || 0)
      );

      if (diferenciaTimestamp > 60000) {
        // More than 1 minute difference
        advertencias.push(
          "Entry and exit timestamps differ significantly"
        );
      }
    }

    // Validate individual records
    [datosEntrada, datosSalida].forEach((datos, index) => {
      if (datos) {
        const tipo = index === 0 ? "entrada" : "salida";

        if (!datos.idUsuario_Personal) {
          errores.push(`Missing ID/DNI in ${tipo} data`);
        }

        if (!datos.Mes || datos.Mes < 1 || datos.Mes > 12) {
          errores.push(`Invalid month in ${tipo} data: ${datos.Mes}`);
        }

        if (!datos.ultima_fecha_actualizacion) {
          errores.push(`Missing mandatory timestamp in ${tipo} data`);
        }
      }
    });

    return {
      valido: errores.length === 0,
      errores,
      advertencias,
    };
  }
}
