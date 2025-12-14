/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  AsistenciaMensualPersonalLocal,
  TipoPersonal,
  ModoRegistro,
  RegistroEntradaSalida,
  OperationResult,
  ValidacionResult,
} from "../AsistenciaDePersonalTypes";
import { Meses } from "@/interfaces/shared/Meses";
import IndexedDBConnection from "../../../IndexedDBConnection";
import { AsistenciaDePersonalMapper } from "./AsistenciaDePersonalMapper";
import { AsistenciaDateHelper } from "../../utils/AsistenciaDateHelper";

/**
 * 🎯 RESPONSIBILITY: CRUD operations with IndexedDB
 * - Save monthly records
 * - Get monthly records
 * - Delete records
 * - Check existence
 * - Query and filtering operations
 *
 * ✅ UPDATED: Supports both IDs (principals) and DNI (other roles)
 * ✅ NEW: Automatic timestamp on all saved/updated records
 */
export class AsistenciaDePersonalRepository {
  private mapper: AsistenciaDePersonalMapper;
  private dateHelper: AsistenciaDateHelper;

  constructor(
    mapper: AsistenciaDePersonalMapper,
    dateHelper: AsistenciaDateHelper
  ) {
    this.mapper = mapper;
    this.dateHelper = dateHelper;
  }

  /**
   * Saves a monthly attendance record using the real ID from the API
   * ✅ UPDATED: Supports idUsuario_Personal
   * ✅ NEW: Always includes the current Peruvian timestamp
   */
  public async guardarRegistroMensual(
    tipoPersonal: TipoPersonal,
    modoRegistro: ModoRegistro,
    datos: AsistenciaMensualPersonalLocal
  ): Promise<OperationResult> {
    try {
      await IndexedDBConnection.init();
      const storeName = this.mapper.getStoreName(tipoPersonal, modoRegistro);
      const store = await IndexedDBConnection.getStore(storeName, "readwrite");
      const idFieldName = this.mapper.getIdFieldName(tipoPersonal);
      const idField = this.mapper.getIdFieldForStore(
        tipoPersonal,
        modoRegistro
      );

      // ✅ NEW: ALWAYS get the current Peruvian timestamp
      const timestampPeruanoActual = this.dateHelper.obtenerTimestampPeruano();

      console.log(
        `💾 Guardando registro con timestamp peruano: ${timestampPeruanoActual} (${new Date(
          timestampPeruanoActual
        ).toLocaleString("es-PE")})`
      );

      return new Promise((resolve, reject) => {
        try {
          const registroToSave: any = {
            [idField]: datos.Id_Registro_Mensual,
            Mes: datos.mes,
            [idFieldName]: this.convertirIdentificadorParaDB(
              tipoPersonal,
              datos.idUsuario_Personal
            ),
            // ✅ NEW: ALWAYS include the current Peruvian timestamp
            ultima_fecha_actualizacion: timestampPeruanoActual,
          };

          if (modoRegistro === ModoRegistro.Entrada) {
            registroToSave.Entradas = datos.registros;
          } else {
            registroToSave.Salidas = datos.registros;
          }

          console.log(`💾 Objeto a guardar en ${storeName}:`, {
            ...registroToSave,
            // Only show a summary of records to avoid flooding the log
            [modoRegistro === ModoRegistro.Entrada
              ? "Entradas"
              : "Salidas"]: `${
              Object.keys(datos.registros).length
            } días registrados`,
          });

          const putRequest = store.put(registroToSave);

          putRequest.onsuccess = () => {
            console.log(
              `✅ Registro mensual guardado exitosamente en ${storeName} con timestamp ${timestampPeruanoActual}`
            );
            resolve({
              exitoso: true,
              mensaje: "Registro mensual guardado exitosamente",
              datos: datos.Id_Registro_Mensual,
            });
          };

          putRequest.onerror = (event) => {
            console.error(
              `❌ Error al guardar en ${storeName}:`,
              (event.target as IDBRequest).error
            );
            reject(
              new Error(
                `Error al guardar registro mensual: ${
                  (event.target as IDBRequest).error
                }`
              )
            );
          };
        } catch (error) {
          console.error(`❌ Error en preparación de guardado:`, error);
          reject(error);
        }
      });
    } catch (error) {
      console.error("Error en guardarRegistroMensual:", error);
      return {
        exitoso: false,
        mensaje: `Error al guardar registro mensual: ${
          error instanceof Error ? error.message : "Error desconocido"
        }`,
      };
    }
  }

  /**
   * ✅ FIXED: Less restrictive verification - AT LEAST 1 day with data is enough
   */
  public async verificarDatosEnUltimosDiasEscolares(
    tipoPersonal: TipoPersonal,
    modoRegistro: ModoRegistro,
    idUsuario: string | number,
    mes: number,
    ultimosDiasEscolares: number[]
  ): Promise<{
    tieneDatosSuficientes: boolean;
    diasConDatos: number[];
    diasSinDatos: number[];
    porcentajeCobertura: number;
  }> {
    try {
      const registro = await this.obtenerRegistroMensual(
        tipoPersonal,
        modoRegistro,
        idUsuario,
        mes
      );

      if (!registro) {
        return {
          tieneDatosSuficientes: false,
          diasConDatos: [],
          diasSinDatos: ultimosDiasEscolares,
          porcentajeCobertura: 0,
        };
      }

      const diasConDatos: number[] = [];
      const diasSinDatos: number[] = [];

      ultimosDiasEscolares.forEach((dia) => {
        const claveDay = dia.toString();
        if (registro.registros[claveDay]) {
          diasConDatos.push(dia);
        } else {
          diasSinDatos.push(dia);
        }
      });

      const porcentajeCobertura =
        ultimosDiasEscolares.length > 0
          ? (diasConDatos.length / ultimosDiasEscolares.length) * 100
          : 0;

      // ✅ FIXED: Less restrictive criterion
      // If there is at least 40% coverage OR at least 2 days with data, it is sufficient
      let tieneDatosSuficientes =
        porcentajeCobertura >= 40 || diasConDatos.length >= 2;

      // ✅ NEW VALIDATION: Verify that the days without data are NOT the last consecutive ones
      if (
        diasSinDatos.length > 0 &&
        ultimosDiasEscolares.length >= diasSinDatos.length
      ) {
        const ultimosNDias = ultimosDiasEscolares.slice(-diasSinDatos.length);
        const sonLosUltimosConsecutivos =
          ultimosNDias.every((dia) => diasSinDatos.includes(dia)) &&
          diasSinDatos.every((dia) => ultimosNDias.includes(dia));

        if (sonLosUltimosConsecutivos) {
          tieneDatosSuficientes = false;
          console.log(
            `⚠️ Los días sin datos son los últimos ${
              diasSinDatos.length
            } días seguidos: ${diasSinDatos.join(
              ", "
            )} - indica falta de actualización`
          );
        }
      }

      console.log(`📊 Verificación días escolares - ${idUsuario}:`, {
        ultimosDiasEscolares,
        diasConDatos,
        diasSinDatos,
        porcentajeCobertura: `${porcentajeCobertura.toFixed(1)}%`,
        tieneDatosSuficientes,
        criterio: `≥40% cobertura O ≥2 días con datos`,
      });

      return {
        tieneDatosSuficientes,
        diasConDatos,
        diasSinDatos,
        porcentajeCobertura,
      };
    } catch (error) {
      console.error(
        "Error al verificar datos en últimos días escolares:",
        error
      );
      return {
        tieneDatosSuficientes: false,
        diasConDatos: [],
        diasSinDatos: ultimosDiasEscolares,
        porcentajeCobertura: 0,
      };
    }
  }

  /**
   * Gets the monthly attendance record for a specific staff member
   * ✅ UPDATED: Uses idUsuario_Personal
   * ✅ IMPROVED: Better logging for debugging
   */
  public async obtenerRegistroMensual(
    tipoPersonal: TipoPersonal,
    modoRegistro: ModoRegistro,
    idUsuario_Personal: string | number,
    mes: number,
    id_registro_mensual?: number
  ): Promise<AsistenciaMensualPersonalLocal | null> {
    try {
      await IndexedDBConnection.init();
      const storeName = this.mapper.getStoreName(tipoPersonal, modoRegistro);
      const store = await IndexedDBConnection.getStore(storeName, "readonly");

      // If the record ID is provided, search directly
      if (id_registro_mensual) {
        const request = store.get(id_registro_mensual);

        return new Promise((resolve, reject) => {
          try {
            request.onsuccess = async () => {
              if (request.result) {
                const registroMensual: AsistenciaMensualPersonalLocal =
                  this.mapearRegistroMensualDesdeStore(
                    request.result,
                    tipoPersonal,
                    modoRegistro
                  );
                console.log(
                  `📖 Registro encontrado por ID: ${id_registro_mensual}, última actualización: ${new Date(
                    registroMensual.ultima_fecha_actualizacion
                  ).toLocaleString("es-PE")}`
                );

                resolve(registroMensual);
              } else {
                console.log(
                  `📖 No se encontró registro con ID: ${id_registro_mensual}`
                );
                resolve(null);
              }
            };

            request.onerror = (event) => {
              reject(
                new Error(
                  `Error al obtener registro mensual por ID: ${
                    (event.target as IDBRequest).error
                  }`
                )
              );
            };
          } catch (error) {
            reject(error);
          }
        });
      }

      // ✅ VALIDATE values before using in index
      this.validarValoresParaIndice(idUsuario_Personal, mes, tipoPersonal);

      const indexName = this.mapper.getIndexNameForPersonalMes(tipoPersonal);

      return new Promise((resolve, reject) => {
        try {
          const index = store.index(indexName);

          // ✅ CONVERT identifier to the correct type
          const identificadorConvertido = this.convertirIdentificadorParaDB(
            tipoPersonal,
            idUsuario_Personal
          );
          const keyValue = [identificadorConvertido, mes];

          console.log(`🔍 Buscando en índice: ${indexName}`, {
            tipoPersonal,
            identificadorOriginal: idUsuario_Personal,
            identificadorConvertido,
            mes,
            keyValue,
          });

          const request = index.get(keyValue);

          request.onsuccess = () => {
            if (request.result) {
              const registroMensual: AsistenciaMensualPersonalLocal =
                this.mapearRegistroMensualDesdeStore(
                  request.result,
                  tipoPersonal,
                  modoRegistro
                );

              console.log(
                `📖 Registro encontrado para ${tipoPersonal} - ${idUsuario_Personal} - mes ${mes}, última actualización: ${new Date(
                  registroMensual.ultima_fecha_actualizacion
                ).toLocaleString("es-PE")}`
              );
              resolve(registroMensual);
            } else {
              console.log(
                `📊 No se encontró registro para: ${tipoPersonal} - ${idUsuario_Personal} - mes ${mes}`
              );
              resolve(null);
            }
          };

          request.onerror = (event) => {
            const error = (event.target as IDBRequest).error;
            console.error(`❌ Error en índice ${indexName}:`, error);
            reject(
              new Error(
                `Error al obtener registro mensual por índice: ${error}`
              )
            );
          };
        } catch (error) {
          console.error(`❌ Error al preparar consulta:`, error);
          reject(error);
        }
      });
    } catch (error) {
      console.error("Error en obtenerRegistroMensual:", error);
      return null;
    }
  }

  /**
   * ✅ NEW: Converts the identifier to the correct type according to the staff member
   */
  private convertirIdentificadorParaDB(
    tipoPersonal: TipoPersonal,
    idUsuario: string | number
  ): string | number {
    if (
      tipoPersonal === TipoPersonal.DIRECTIVO &&
      typeof idUsuario === "string"
    ) {
      // For principals: convert to number (Id_Directivo is INT in the DB)
      const id = parseInt(idUsuario, 10);
      if (isNaN(id)) {
        throw new Error(`ID de directivo inválido: ${idUsuario}`);
      }
      return id;
    } else {
      // For other roles: keep as string (DNI)
      return idUsuario;
    }
  }

  /**
   * ✅ FIXED: Validate values before using in indexes
   */
  private validarValoresParaIndice(
    idUsuario: string | number,
    mes: number,
    tipoPersonal: TipoPersonal
  ): void {
    if (!idUsuario || String(idUsuario).trim() === "") {
      throw new Error(`ID/DNI no puede estar vacío para ${tipoPersonal}`);
    }

    if (!mes || mes < 1 || mes > 12) {
      throw new Error(`Mes inválido: ${mes}. Debe estar entre 1 y 12`);
    }

    // Validate specific format
    if (
      !this.mapper.validarFormatoIdentificador(tipoPersonal, String(idUsuario))
    ) {
      const tipoEsperado =
        this.mapper.getTipoIdentificadorLegible(tipoPersonal);
      throw new Error(
        `Formato de ${tipoEsperado} inválido para ${tipoPersonal}: ${idUsuario}`
      );
    }
  }

  /**
   * Deletes local monthly records
   * ✅ UPDATED: Uses id
   */
  public async eliminarRegistroMensual(
    tipoPersonal: TipoPersonal,
    modoRegistro: ModoRegistro,
    idUsuario: string | number,
    mes: number
  ): Promise<OperationResult> {
    try {
      await IndexedDBConnection.init();
      const storeName = this.mapper.getStoreName(tipoPersonal, modoRegistro);
      const store = await IndexedDBConnection.getStore(storeName, "readwrite");
      const indexName = this.mapper.getIndexNameForPersonalMes(tipoPersonal);

      return new Promise((resolve, reject) => {
        try {
          const index = store.index(indexName);
          const keyValue = [idUsuario, mes];
          const request = index.get(keyValue);

          request.onsuccess = () => {
            if (request.result) {
              const idField = this.mapper.getIdFieldForStore(
                tipoPersonal,
                modoRegistro
              );
              const id = request.result[idField];

              const deleteRequest = store.delete(id);
              deleteRequest.onsuccess = () => {
                console.log(
                  `🗑️ Registro eliminado: ${storeName} - ${idUsuario} - mes ${mes}`
                );
                resolve({
                  exitoso: true,
                  mensaje: "Registro mensual eliminado exitosamente",
                });
              };
              deleteRequest.onerror = (event) => {
                reject(
                  new Error(
                    `Error al eliminar registro: ${
                      (event.target as IDBRequest).error
                    }`
                  )
                );
              };
            } else {
              resolve({
                exitoso: true,
                mensaje: "No había registro que eliminar",
              });
            }
          };

          request.onerror = (event) => {
            reject(
              new Error(
                `Error al buscar registro para eliminar: ${
                  (event.target as IDBRequest).error
                }`
              )
            );
          };
        } catch (error) {
          reject(error);
        }
      });
    } catch (error) {
      console.error("Error al eliminar registro mensual:", error);
      return {
        exitoso: false,
        mensaje: `Error al eliminar registro: ${
          error instanceof Error ? error.message : "Error desconocido"
        }`,
      };
    }
  }

  /**
   * Checks if a monthly record exists for a specific staff member
   * ✅ UPDATED: Uses id
   */
  public async verificarExistenciaRegistroMensual(
    tipoPersonal: TipoPersonal,
    modoRegistro: ModoRegistro,
    id: string,
    mes: number
  ): Promise<number | null> {
    try {
      await IndexedDBConnection.init();
      const storeName = this.mapper.getStoreName(tipoPersonal, modoRegistro);
      const store = await IndexedDBConnection.getStore(storeName, "readonly");
      const indexName = this.mapper.getIndexNameForPersonalMes(tipoPersonal);
      const idField = this.mapper.getIdFieldForStore(
        tipoPersonal,
        modoRegistro
      );

      return new Promise((resolve, reject) => {
        try {
          const index = store.index(indexName);
          const keyValue = [id, mes];
          const request = index.get(keyValue);

          request.onsuccess = () => {
            if (request.result) {
              resolve(request.result[idField]);
            } else {
              resolve(null);
            }
          };

          request.onerror = (event) => {
            reject(
              new Error(
                `Error al verificar existencia: ${
                  (event.target as IDBRequest).error
                }`
              )
            );
          };
        } catch (error) {
          reject(error);
        }
      });
    } catch (error) {
      console.error(
        "Error al verificar existencia de registro mensual:",
        error
      );
      return null;
    }
  }

  /**
   * Checks if a daily record already exists for a specific staff member
   * ✅ FIXED: Applies validations and conversions
   */
  public async verificarSiExisteRegistroDiario(
    tipoPersonal: TipoPersonal,
    modoRegistro: ModoRegistro,
    id: string,
    mes: number,
    dia: number
  ): Promise<boolean> {
    try {
      await IndexedDBConnection.init();
      const storeName = this.mapper.getStoreName(tipoPersonal, modoRegistro);
      const store = await IndexedDBConnection.getStore(storeName, "readonly");

      // ✅ ADD: Validate values before using in index
      this.validarValoresParaIndice(id, mes, tipoPersonal);

      const indexName = this.mapper.getIndexNameForPersonalMes(tipoPersonal);

      return new Promise((resolve, reject) => {
        try {
          const index = store.index(indexName);

          // ✅ ADD: Convert identifier to the correct type
          const identificadorConvertido = this.convertirIdentificadorParaDB(
            tipoPersonal,
            id
          );
          const keyValue = [identificadorConvertido, mes];

          console.log(
            `🔍 verificarSiExisteRegistroDiario - Índice: ${indexName}`,
            {
              tipoPersonal,
              identificadorOriginal: id,
              identificadorConvertido,
              mes,
              dia,
              keyValue,
            }
          );

          const request = index.get(keyValue);

          request.onsuccess = () => {
            if (request.result) {
              const registrosDias =
                modoRegistro === ModoRegistro.Entrada
                  ? request.result.Entradas
                  : request.result.Salidas;

              if (registrosDias && registrosDias[dia.toString()]) {
                resolve(true);
                return;
              }
            }
            resolve(false);
          };

          request.onerror = (event) => {
            const error = (event.target as IDBRequest).error;
            console.error(
              `❌ Error en verificarSiExisteRegistroDiario:`,
              error
            );
            reject(
              new Error(
                `Error al verificar existencia de registro diario: ${error}`
              )
            );
          };
        } catch (error) {
          console.error(
            `❌ Error al preparar consulta en verificarSiExisteRegistroDiario:`,
            error
          );
          reject(error);
        }
      });
    } catch (error) {
      console.error("Error al verificar existencia de registro diario:", error);
      return false;
    }
  }

  /**
   * Gets all monthly records for a specific staff type and month
   * ✅ IMPROVED: Better logging and timestamp handling
   */
  public async obtenerTodosRegistrosMensuales(
    tipoPersonal: TipoPersonal,
    modoRegistro: ModoRegistro,
    mes: Meses
  ): Promise<AsistenciaMensualPersonalLocal[]> {
    try {
      await IndexedDBConnection.init();
      const storeName = this.mapper.getStoreName(tipoPersonal, modoRegistro);
      const store = await IndexedDBConnection.getStore(storeName, "readonly");
      const idFieldName = this.mapper.getIdFieldName(tipoPersonal);
      const idField = this.mapper.getIdFieldForStore(
        tipoPersonal,
        modoRegistro
      );

      return new Promise((resolve, reject) => {
        try {
          const index = store.index("por_mes");
          const request = index.getAll(mes);

          request.onsuccess = () => {
            if (request.result && request.result.length > 0) {
              const registrosMensuales: AsistenciaMensualPersonalLocal[] =
                request.result.map((item) => {
                  // ✅ NEW: Preserve original timestamp or use current timestamp if it does not exist
                  const timestampOriginal = item.ultima_fecha_actualizacion;
                  const timestampFinal =
                    timestampOriginal ||
                    this.dateHelper.obtenerTimestampPeruano();

                  if (!timestampOriginal) {
                    console.warn(
                      `⚠️ Registro sin timestamp encontrado, usando timestamp actual: ${timestampFinal}`
                    );
                  }

                  return {
                    Id_Registro_Mensual: item[idField],
                    mes: item.Mes,
                    idUsuario_Personal: item[idFieldName],
                    registros:
                      modoRegistro === ModoRegistro.Entrada
                        ? item.Entradas
                        : item.Salidas,
                    ultima_fecha_actualizacion: timestampFinal,
                  };
                });

              console.log(
                `📊 Se obtuvieron ${registrosMensuales.length} registros mensuales para ${tipoPersonal} - mes ${mes}`
              );
              resolve(registrosMensuales);
            } else {
              console.log(
                `📊 No se encontraron registros mensuales para ${tipoPersonal} - mes ${mes}`
              );
              resolve([]);
            }
          };

          request.onerror = (event) => {
            reject(
              new Error(
                `Error al obtener registros mensuales: ${
                  (event.target as IDBRequest).error
                }`
              )
            );
          };
        } catch (error) {
          reject(error);
        }
      });
    } catch (error) {
      console.error("Error en obtenerTodosRegistrosMensuales:", error);
      return [];
    }
  }

  /**
   * Updates an existing record by adding a new day
   * ✅ UPDATED: Uses id and guarantees updated timestamp
   */
  public async actualizarRegistroExistente(
    tipoPersonal: TipoPersonal,
    modoRegistro: ModoRegistro,
    id: string,
    mes: number,
    dia: number,
    registro: RegistroEntradaSalida,
    idRegistroExistente: number
  ): Promise<OperationResult> {
    try {
      console.log(
        `🔄 Actualizando registro existente para ${tipoPersonal} - ${id} - mes ${mes} - día ${dia}`
      );

      const registroActual = await this.obtenerRegistroMensual(
        tipoPersonal,
        modoRegistro,
        id,
        mes,
        idRegistroExistente
      );

      if (registroActual) {
        // Update the specific day's record
        registroActual.registros[dia.toString()] = registro;

        // ✅ NEW: ALWAYS update the timestamp when the record is modified
        registroActual.ultima_fecha_actualizacion =
          this.dateHelper.obtenerTimestampPeruano();

        console.log(
          `🔄 Actualizando timestamp a: ${
            registroActual.ultima_fecha_actualizacion
          } (${new Date(
            registroActual.ultima_fecha_actualizacion
          ).toLocaleString("es-PE")})`
        );

        return await this.guardarRegistroMensual(
          tipoPersonal,
          modoRegistro,
          registroActual
        );
      }

      return {
        exitoso: false,
        mensaje: "No se encontró el registro a actualizar",
      };
    } catch (error) {
      console.error("Error en actualizarRegistroExistente:", error);
      return {
        exitoso: false,
        mensaje: `Error al actualizar registro: ${
          error instanceof Error ? error.message : "Error desconocido"
        }`,
      };
    }
  }

  /**
   * Maps a record obtained from the store to the AsistenciaMensualPersonalLocal interface
   * ✅ UPDATED: Uses idUsuario_Personal and handles timestamp correctly
   */
  private mapearRegistroMensualDesdeStore(
    registroStore: any,
    tipoPersonal: TipoPersonal,
    modoRegistro: ModoRegistro
  ): AsistenciaMensualPersonalLocal {
    const idField = this.mapper.getIdFieldForStore(tipoPersonal, modoRegistro);
    const idPersonalField = this.mapper.getIdFieldName(tipoPersonal);

    // ✅ NEW: Robust timestamp handling
    const timestampOriginal = registroStore.ultima_fecha_actualizacion;
    const timestampFinal =
      timestampOriginal || this.dateHelper.obtenerTimestampPeruano();

    if (!timestampOriginal) {
      console.warn(
        `⚠️ Registro sin timestamp encontrado al mapear, usando timestamp actual: ${timestampFinal}`
      );
    }

    return {
      Id_Registro_Mensual: registroStore[idField],
      mes: registroStore.Mes,
      idUsuario_Personal: registroStore[idPersonalField],
      registros:
        modoRegistro === ModoRegistro.Entrada
          ? registroStore.Entradas
          : registroStore.Salidas,
      ultima_fecha_actualizacion: timestampFinal,
    };
  }

  /**
   * Deletes a specific day from a monthly record
   * ✅ UPDATED: Uses id and updates timestamp on modification
   */
  public async eliminarDiaDeRegistroMensual(
    tipoPersonal: TipoPersonal,
    modoRegistro: ModoRegistro,
    idUsuario: string | number,
    mes: number,
    dia: number
  ): Promise<OperationResult> {
    try {
      console.log(
        `🗑️ Eliminando día ${dia} del registro mensual para ${tipoPersonal} - ${idUsuario} - mes ${mes}`
      );

      // Get the current monthly record
      const registroMensual = await this.obtenerRegistroMensual(
        tipoPersonal,
        modoRegistro,
        idUsuario,
        mes
      );

      if (!registroMensual) {
        return {
          exitoso: false,
          mensaje: `No se encontró registro mensual para ID/DNI: ${idUsuario}, mes: ${mes}`,
        };
      }

      // Check if the specific day exists
      const claveDay = dia.toString();
      if (!registroMensual.registros[claveDay]) {
        return {
          exitoso: false,
          mensaje: `No se encontró registro para el día ${dia} en el mes ${mes}`,
        };
      }

      // Delete the specific day
      delete registroMensual.registros[claveDay];
      console.log(`🗑️ Día ${dia} eliminado del registro mensual`);

      // Decide whether to keep or delete the entire monthly record
      if (Object.keys(registroMensual.registros).length === 0) {
        // If there are no more days left, delete the entire monthly record
        console.log(`📱 Eliminando registro mensual completo (sin más días)`);
        return await this.eliminarRegistroMensual(
          tipoPersonal,
          modoRegistro,
          idUsuario,
          mes
        );
      } else {
        // If there are more days left, update the record
        console.log(
          `📱 Actualizando registro mensual (quedan ${
            Object.keys(registroMensual.registros).length
          } días)`
        );

        // ✅ NEW: Update timestamp when modifying the record
        registroMensual.ultima_fecha_actualizacion =
          this.dateHelper.obtenerTimestampPeruano();
        console.log(
          `🔄 Actualizando timestamp tras eliminación de día: ${registroMensual.ultima_fecha_actualizacion}`
        );

        return await this.guardarRegistroMensual(
          tipoPersonal,
          modoRegistro,
          registroMensual
        );
      }
    } catch (error) {
      console.error("Error al eliminar día del registro mensual:", error);
      return {
        exitoso: false,
        mensaje: `Error al eliminar día: ${
          error instanceof Error ? error.message : "Error desconocido"
        }`,
      };
    }
  }

  /**
   * Validates the structure of a record before saving it
   * ✅ UPDATED: Improved validation for idUsuario_Personal and timestamp
   */
  public validarEstructuraAntesSalvar(
    datos: AsistenciaMensualPersonalLocal,
    tipoPersonal?: TipoPersonal
  ): ValidacionResult {
    const errores: string[] = [];

    if (typeof datos.Id_Registro_Mensual !== "number") {
      errores.push("Id_Registro_Mensual must be a number");
    }

    if (typeof datos.mes !== "number" || datos.mes < 1 || datos.mes > 12) {
      errores.push("The month must be a number between 1 and 12");
    }

    // ✅ IMPROVED VALIDATION: Support for ID (principals) and DNI (others)
    if (
      typeof datos.idUsuario_Personal !== "string" ||
      datos.idUsuario_Personal.trim().length === 0
    ) {
      errores.push("idUsuario_Personal must be a non-empty string");
    } else {
      // Specific validation according to the staff type
      if (tipoPersonal === TipoPersonal.DIRECTIVO) {
        // For principals: can be any valid string (usually numbers)
        if (!/^[a-zA-Z0-9]+$/.test(datos.idUsuario_Personal)) {
          errores.push(
            "idUsuario_Personal for principals must contain only alphanumeric characters"
          );
        }
      } else {
        // For other roles: must be an 8-digit DNI
        if (!/^\d{8}$/.test(datos.idUsuario_Personal)) {
          errores.push(
            "idUsuario_Personal for non-principal staff must be an 8-digit DNI"
          );
        }
      }
    }

    // ✅ NEW VALIDATION: Verify timestamp
    if (typeof datos.ultima_fecha_actualizacion !== "number") {
      errores.push("ultima_fecha_actualizacion must be a number (timestamp)");
    } else if (datos.ultima_fecha_actualizacion <= 0) {
      errores.push(
        "ultima_fecha_actualizacion must be a valid timestamp greater than 0"
      );
    }

    if (!datos.registros || typeof datos.registros !== "object") {
      errores.push("registros must be an object");
    } else {
      // Validate each individual record
      for (const [dia, registro] of Object.entries(datos.registros)) {
        if (isNaN(parseInt(dia))) {
          errores.push(`The day '${dia}' must be a number`);
        }

        if (!registro || typeof registro !== "object") {
          errores.push(`The record for day ${dia} must be an object`);
          continue;
        }

        if (typeof registro.timestamp !== "number") {
          errores.push(`The timestamp for day ${dia} must be a number`);
        }

        if (typeof registro.desfaseSegundos !== "number") {
          errores.push(`The desfaseSegundos for day ${dia} must be a number`);
        }

        if (typeof registro.estado !== "string") {
          errores.push(`The estado for day ${dia} must be a string`);
        }
      }
    }

    return {
      valido: errores.length === 0,
      errores,
    };
  }

  /**
   * ✅ NEW: Method to bulk update timestamps of old records
   * Useful for migrating records that did not have the ultima_fecha_actualizacion field
   */
  public async actualizarTimestampsRegistrosAntiguos(
    tipoPersonal: TipoPersonal,
    modoRegistro: ModoRegistro,
    mes?: number
  ): Promise<OperationResult> {
    try {
      console.log(
        `🔄 Iniciando actualización masiva de timestamps para ${tipoPersonal} - ${modoRegistro}${
          mes ? ` - mes ${mes}` : ""
        }`
      );

      await IndexedDBConnection.init();
      const storeName = this.mapper.getStoreName(tipoPersonal, modoRegistro);
      const store = await IndexedDBConnection.getStore(storeName, "readwrite");

      let registrosActualizados = 0;
      const timestampActual = this.dateHelper.obtenerTimestampPeruano();

      return new Promise((resolve, reject) => {
        try {
          const request = mes
            ? store.index("por_mes").getAll(mes)
            : store.getAll();

          request.onsuccess = () => {
            const registros = request.result;

            if (!registros || registros.length === 0) {
              resolve({
                exitoso: true,
                mensaje: `No records found to update in ${storeName}`,
                datos: 0,
              });
              return;
            }

            const actualizaciones: Promise<void>[] = [];

            registros.forEach((registro) => {
              // Only update if it does not have a timestamp or it is invalid
              if (
                !registro.ultima_fecha_actualizacion ||
                registro.ultima_fecha_actualizacion <= 0
              ) {
                registro.ultima_fecha_actualizacion = timestampActual;

                const actualizacion = new Promise<void>(
                  (resolveUpdate, rejectUpdate) => {
                    const updateRequest = store.put(registro);
                    updateRequest.onsuccess = () => {
                      registrosActualizados++;
                      resolveUpdate();
                    };
                    updateRequest.onerror = () =>
                      rejectUpdate(updateRequest.error);
                  }
                );

                actualizaciones.push(actualizacion);
              }
            });

            if (actualizaciones.length === 0) {
              resolve({
                exitoso: true,
                mensaje: `All records in ${storeName} already have valid timestamps`,
                datos: 0,
              });
              return;
            }

            Promise.all(actualizaciones)
              .then(() => {
                console.log(
                  `✅ Actualización masiva completada: ${registrosActualizados} registros actualizados en ${storeName}`
                );
                resolve({
                  exitoso: true,
                  mensaje: `${registrosActualizados} records were updated with timestamps`,
                  datos: registrosActualizados,
                });
              })
              .catch((error) => {
                console.error(`❌ Error en actualización masiva:`, error);
                reject(new Error(`Error updating timestamps: ${error}`));
              });
          };

          request.onerror = (event) => {
            reject(
              new Error(
                `Error getting records for update: ${
                  (event.target as IDBRequest).error
                }`
              )
            );
          };
        } catch (error) {
          reject(error);
        }
      });
    } catch (error) {
      console.error("Error en actualizarTimestampsRegistrosAntiguos:", error);
      return {
        exitoso: false,
        mensaje: `Error updating timestamps: ${
          error instanceof Error ? error.message : "Error desconocido"
        }`,
      };
    }
  }
}
