/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/global/store";
import { Calendar, Search, Loader2, User } from "lucide-react";
import { EstadosAsistenciaPersonal } from "@/interfaces/shared/EstadosAsistenciaPersonal";
import { Meses, mesesTextos } from "@/interfaces/shared/Meses";
import { RolesSistema } from "@/interfaces/shared/RolesSistema";
import getDiasEscolaresPorMes from "@/lib/helpers/functions/date/getDiasEsolaresPorMes";
import { segundosAMinutos } from "@/lib/helpers/functions/time/segundosAMinutos";
import {
  ErrorResponseAPIBase,
  MessageProperty,
} from "@/interfaces/shared/apis/types";
import { AsistenciaDePersonalIDB } from "@/lib/utils/local/db/models/AsistenciaDePersonal/AsistenciaDePersonalIDB";
import { convertirAFormato12Horas } from "@/lib/helpers/formatters/fechas-hora/formatearAFormato12Horas";
import { ENTORNO } from "@/constants/ENTORNO";
import { Entorno } from "@/interfaces/shared/Entornos";
import {
  EventosIDB,
  IEventoLocal,
} from "@/lib/utils/local/db/models/eventos/EventosIDB";
import { RegistroEntradaSalida } from "@/interfaces/shared/AsistenciaRequests";
import { AsistenciaMensualPersonalLocal } from "@/lib/utils/local/db/models/AsistenciaDePersonal/AsistenciaDePersonalTypes";
import userStorage from "@/lib/utils/local/db/models/UserStorage";
import * as ExcelJS from "exceljs";

// Importar componentes reutilizables

import LeyendaEstadosAsistencia from "@/components/asistencia-personal/registros-asistencia-personal/LeyendaEstadosAsistencia";
import MensajesEstadoAsistencia from "@/components/asistencia-personal/registros-asistencia-personal/MensajesEstadoAsistencia";
import TablaRegistrosAsistencia from "@/components/asistencia-personal/registros-asistencia-personal/TablaRegistrosAsistencias";
import InfoUsuarioAsistencia from "@/components/asistencia-personal/registros-asistencia-personal/InfoUsuarioAsistencia";
import { DatosAsistenciaHoyIDB } from "@/lib/utils/local/db/models/DatosAsistenciaHoy/DatosAsistenciaHoyIDB";
import { GenericUser } from "@/interfaces/shared/GenericUser";

// 🔧 CONSTANTE DE CONFIGURACIÓN PARA DESARROLLO
const CONSIDERAR_DIAS_NO_ESCOLARES = false; // false = solo días laborales, true = incluir sábados y domingos

interface RegistroDia {
  fecha: string;
  entradaProgramada: string;
  entradaReal: string;
  diferenciaEntrada: string;
  estadoEntrada: EstadosAsistenciaPersonal;
  salidaProgramada: string;
  salidaReal: string;
  diferenciaSalida: string;
  estadoSalida: EstadosAsistenciaPersonal;
  esEvento: boolean;
  nombreEvento?: string;
  esDiaNoEscolar?: boolean;
}

const MisAsistencias = () => {
  const [selectedMes, setSelectedMes] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingEventos, setLoadingEventos] = useState(false);
  const [loadingUserData, setLoadingUserData] = useState(true);
  const [exportandoExcel, setExportandoExcel] = useState(false);
  const [data, setData] = useState<AsistenciaMensualPersonalLocal | null>(null);
  const [eventos, setEventos] = useState<IEventoLocal[]>([]);
  const [registros, setRegistros] = useState<RegistroDia[]>([]);
  const [error, setError] = useState<ErrorResponseAPIBase | null>(null);
  const [successMessage, setSuccessMessage] = useState("");

  // 🆕 Estado para datos del usuario logueado
  const [misDatos, setMisDatos] = useState<GenericUser | null>(null);

  // ✅ Usar useSelector para obtener fecha de Redux reactivamente
  const fechaHoraRedux = useSelector(
    (state: RootState) => state.others.fechaHoraActualReal.fechaHora
  );

  // ✅ Función helper para obtener fecha Redux con manejo de errores
  const obtenerFechaRedux = () => {
    if (!fechaHoraRedux) {
      return null;
    }

    try {
      const fechaObj = new Date(fechaHoraRedux);
      if (isNaN(fechaObj.getTime())) {
        console.error("❌ Fecha inválida desde Redux:", fechaHoraRedux);
        return null;
      }

      return {
        fechaActual: fechaObj,
        mesActual: fechaObj.getMonth() + 1,
        diaActual: fechaObj.getDate(),
        añoActual: fechaObj.getFullYear(),
        timestamp: fechaObj.getTime(),
        esHoy: true,
      };
    } catch (error) {
      console.error("❌ Error al procesar fecha de Redux:", error);
      return null;
    }
  };

  const fechaRedux = obtenerFechaRedux();
  const mesActual = fechaRedux?.mesActual || new Date().getMonth() + 1;
  const diaActual = fechaRedux?.diaActual || new Date().getDate();
  const añoActual = fechaRedux?.añoActual || new Date().getFullYear();

  // ✅ Roles disponibles (para el mapeo de nombres)
  const roles = [
    { value: RolesSistema.Directivo, label: "Directivo" },
    { value: RolesSistema.ProfesorPrimaria, label: "Profesor de Primaria" },
    { value: RolesSistema.ProfesorSecundaria, label: "Profesor de Secundaria" },
    { value: RolesSistema.Auxiliar, label: "Auxiliar" },
    {
      value: RolesSistema.PersonalAdministrativo,
      label: "Personal Administrativo",
    },
  ];

  // Instancia del orquestador
  const [asistenciaPersonalIDB] = useState(
    () =>
      new AsistenciaDePersonalIDB(
        "API01",
        setLoading,
        (error: ErrorResponseAPIBase | null) => {
          if (error) {
            setError({
              success: false,
              message: error.message,
            });
          } else {
            setError(null);
          }
        },
        (message: MessageProperty | null) => {
          if (message) {
            setSuccessMessage(message.message);
            setTimeout(() => setSuccessMessage(""), 3000);
          } else {
            setSuccessMessage("");
          }
        }
      )
  );

  // 🆕 useEffect para obtener datos del usuario logueado al montar el componente
  useEffect(() => {
    const obtenerMisDatos = async () => {
      try {
        setLoadingUserData(true);
        console.log("🔍 Obteniendo datos del usuario logueado...");

        const [nombres, apellidos, rol, userData] = await Promise.all([
          userStorage.getNombres(),
          userStorage.getApellidos(),
          userStorage.getRol(),
          userStorage.getUserData(),
        ]);

        if (!nombres || !apellidos || !rol) {
          throw new Error(
            "No se pudieron obtener los datos básicos del usuario"
          );
        }

        const datosIDB = new DatosAsistenciaHoyIDB();
        const handler = await datosIDB.getHandler();

        if (!handler) {
          console.warn("⚠️ No se pudo obtener handler para obtener mi DNI");
          return;
        }

        const miDNI = (handler as any).getMiDNI();
        if (!miDNI) {
          console.warn("⚠️ No se pudo obtener mi DNI para sincronizar marcado");
          return;
        }

        // Construir objeto de datos del usuario
        const datosUsuario: GenericUser = {
          Nombres: nombres,
          Apellidos: apellidos,
          Rol: rol,
          ID_O_DNI_Usuario: miDNI,
          Google_Drive_Foto_ID: userData?.Google_Drive_Foto_ID || null,
        };

        setMisDatos(datosUsuario);
        console.log("✅ Datos del usuario obtenidos:", datosUsuario);
      } catch (error) {
        console.error("❌ Error al obtener datos del usuario:", error);
        setError({
          success: false,
          message:
            "No se pudieron cargar los datos del usuario. Por favor, inicia sesión nuevamente.",
        });
      } finally {
        setLoadingUserData(false);
      }
    };

    obtenerMisDatos();
  }, []);

  // 🆕 useEffect para limpiar resultados cuando cambie el mes
  useEffect(() => {
    if (data || registros.length > 0) {
      limpiarResultados();
    }
  }, [selectedMes]);

  // Función para obtener meses disponibles (hasta mayo o mes actual)
  const getMesesDisponibles = () => {
    const mesesDisponibles: { value: string; label: string }[] = [];
    const limiteMaximo = mesActual;

    for (let mes = 3; mes <= limiteMaximo; mes++) {
      // Empezar desde marzo (3)
      mesesDisponibles.push({
        value: mes.toString(),
        label: mesesTextos[mes as Meses],
      });
    }

    return mesesDisponibles;
  };

  // Función para verificar si una fecha debe mostrarse (no futura)
  const esFechaValida = (fecha: string): boolean => {
    const fechaObj = new Date(fecha + "T00:00:00");
    const fechaHoy = new Date(añoActual, mesActual - 1, diaActual);
    return fechaObj <= fechaHoy;
  };

  // 🔧 🆕 FUNCIÓN MODIFICADA: Verificar si un día es evento (PRIORIDAD ABSOLUTA)
  const esEvento = (
    fecha: string,
    eventosParaUsar: IEventoLocal[] = eventos
  ): { esEvento: boolean; nombreEvento?: string } => {
    const evento = eventosParaUsar.find((e) => {
      const fechaInicio = new Date(e.Fecha_Inicio + "T00:00:00");
      const fechaFin = new Date(e.Fecha_Conclusion + "T00:00:00");
      const fechaConsulta = new Date(fecha + "T00:00:00");
      return fechaConsulta >= fechaInicio && fechaConsulta <= fechaFin;
    });

    const resultado = {
      esEvento: !!evento,
      nombreEvento: evento?.Nombre,
    };

    // 🆕 LOG para debugging de eventos encontrados
    if (resultado.esEvento) {
      console.log(
        `🎉 EVENTO DETECTADO para ${fecha}: ${resultado.nombreEvento}`
      );
    }

    return resultado;
  };

  // Función para mapear estados del enum a strings para la UI
  const mapearEstadoParaUI = (estado: EstadosAsistenciaPersonal): string => {
    const mapeoEstados: Record<EstadosAsistenciaPersonal, string> = {
      [EstadosAsistenciaPersonal.Temprano]: "Temprano",
      [EstadosAsistenciaPersonal.En_Tiempo]: "En tiempo",
      [EstadosAsistenciaPersonal.Cumplido]: "Cumplido",
      [EstadosAsistenciaPersonal.Salida_Anticipada]: "Salida anticipada",
      [EstadosAsistenciaPersonal.Tarde]: "Tarde",
      [EstadosAsistenciaPersonal.Falta]: "Falta",
      [EstadosAsistenciaPersonal.Sin_Registro]: "Sin registro",
      [EstadosAsistenciaPersonal.No_Registrado]: "No registrado",
      [EstadosAsistenciaPersonal.Inactivo]: "Inactivo",
      [EstadosAsistenciaPersonal.Evento]: "Evento",
      [EstadosAsistenciaPersonal.Otro]: "Otro",
    };

    return mapeoEstados[estado] || estado;
  };

  // 🕐 Función para calcular la hora programada con formato 12 horas
  const calcularHoraProgramada = (
    timestamp: number,
    desfaseSegundos: number
  ): string => {
    if (timestamp === 0 || timestamp === null) return "N/A";

    const timestampProgramado = timestamp - desfaseSegundos * 1000;
    const timestampPeru = timestampProgramado + 5 * 60 * 60 * 1000;
    const fechaProgramadaPeru = new Date(timestampPeru);

    const tiempo24Horas = fechaProgramadaPeru.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    return convertirAFormato12Horas(tiempo24Horas, false);
  };

  // 🕐 Función para formatear hora con formato 12 horas
  const formatearHora = (timestamp: number): string => {
    if (timestamp === 0 || timestamp === null) return "No registrado";

    const timestampPeru = timestamp + 5 * 60 * 60 * 1000;
    const fechaPeru = new Date(timestampPeru);

    const tiempo24Horas = fechaPeru.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    return convertirAFormato12Horas(tiempo24Horas, false);
  };

  // Función para verificar si una fecha es día laboral (lunes a viernes)
  const esDiaLaboral = (fecha: string): boolean => {
    const fechaObj = new Date(fecha + "T00:00:00");
    const diaSemana = fechaObj.getDay();
    return diaSemana >= 1 && diaSemana <= 5;
  };

  // 📅 Función para generar todas las fechas del mes según configuración
  const obtenerFechasDelMes = (mes: number, año: number): string[] => {
    if (CONSIDERAR_DIAS_NO_ESCOLARES && ENTORNO === Entorno.LOCAL) {
      const fechas: string[] = [];
      const ultimoDiaDelMes = new Date(año, mes, 0).getDate();

      for (let dia = 1; dia <= ultimoDiaDelMes; dia++) {
        const fecha = `${año}-${mes.toString().padStart(2, "0")}-${dia
          .toString()
          .padStart(2, "0")}`;
        fechas.push(fecha);
      }

      return fechas;
    } else {
      return getDiasEscolaresPorMes(mes, año);
    }
  };

  // 🆕 Función para obtener mis asistencias combinadas (usa el método del orquestador)
  const obtenerMisAsistenciasCombinadas = async (
    mes: number
  ): Promise<Record<
    string,
    { entrada?: RegistroEntradaSalida; salida?: RegistroEntradaSalida }
  > | null> => {
    try {
      if (!misDatos?.Rol) {
        throw new Error("No se pudo obtener el rol del usuario");
      }

      const resultado =
        await asistenciaPersonalIDB.consultarMiAsistenciaMensual(
          misDatos.Rol,
          mes
        );

      if (!resultado.encontrado) {
        return null;
      }

      const registrosCombinados: Record<
        string,
        { entrada?: RegistroEntradaSalida; salida?: RegistroEntradaSalida }
      > = {};
      const año = new Date().getFullYear();

      // Procesar entradas
      if (resultado.entrada) {
        Object.entries(resultado.entrada.registros).forEach(
          ([dia, registro]) => {
            const fechaCompleta = `${año}-${mes
              .toString()
              .padStart(2, "0")}-${dia.padStart(2, "0")}`;
            const esLaboral = esDiaLaboral(fechaCompleta);
            const debeIncluir = CONSIDERAR_DIAS_NO_ESCOLARES || esLaboral;

            if (debeIncluir) {
              if (!registrosCombinados[dia]) {
                registrosCombinados[dia] = {};
              }
              registrosCombinados[dia].entrada = registro;
            }
          }
        );
      }

      // Procesar salidas
      if (resultado.salida) {
        Object.entries(resultado.salida.registros).forEach(
          ([dia, registro]) => {
            const fechaCompleta = `${año}-${mes
              .toString()
              .padStart(2, "0")}-${dia.padStart(2, "0")}`;
            const esLaboral = esDiaLaboral(fechaCompleta);
            const debeIncluir = CONSIDERAR_DIAS_NO_ESCOLARES || esLaboral;

            if (debeIncluir) {
              if (!registrosCombinados[dia]) {
                registrosCombinados[dia] = {};
              }
              registrosCombinados[dia].salida = registro;
            }
          }
        );
      }

      return Object.keys(registrosCombinados).length > 0
        ? registrosCombinados
        : null;
    } catch (error) {
      console.error("Error al obtener mis asistencias combinadas:", error);
      return null;
    }
  };

  // 🆕 FUNCIÓN MODIFICADA: Procesar mis datos con eventos prioritarios
  const procesarMisDatos = async (
    mes: number,
    eventosDelMes: IEventoLocal[]
  ) => {
    try {
      const registrosCombinados = await obtenerMisAsistenciasCombinadas(mes);
      const año = new Date().getFullYear();
      const todasLasFechas = obtenerFechasDelMes(mes, año);
      const fechasFiltradas = todasLasFechas.filter((fecha) =>
        esFechaValida(fecha)
      );

      console.log(
        `📊 Procesando mis datos: ${fechasFiltradas.length} fechas para mes ${mes}`
      );
      console.log(
        `🎯 Eventos recibidos para procesamiento: ${eventosDelMes.length}`
      );

      const registrosResultado: RegistroDia[] = fechasFiltradas.map((fecha) => {
        const fechaObj = new Date(fecha + "T00:00:00");
        const dia = fechaObj.getDate().toString();
        const eventoInfo = esEvento(fecha, eventosDelMes); // 🆕 Usar eventos pasados como parámetro
        const esLaboral = esDiaLaboral(fecha);

        // 🆕 ✅ PRIORIDAD ABSOLUTA: Si es evento, retornar registro especial SIN IMPORTAR SI HAY ASISTENCIAS
        if (eventoInfo.esEvento) {
          console.log(
            `🎉 SOBREPONIENDO EVENTO "${eventoInfo.nombreEvento}" sobre cualquier asistencia para ${fecha}`
          );
          return {
            fecha,
            entradaProgramada: "Evento",
            entradaReal: "Evento",
            diferenciaEntrada: "N/A",
            estadoEntrada: EstadosAsistenciaPersonal.Evento,
            salidaProgramada: "Evento",
            salidaReal: "Evento",
            diferenciaSalida: "N/A",
            estadoSalida: EstadosAsistenciaPersonal.Evento,
            esEvento: true,
            nombreEvento: eventoInfo.nombreEvento,
            esDiaNoEscolar: !esLaboral,
          };
        }

        // Solo procesar asistencias normales si NO hay evento
        // Si no hay registros combinados
        if (!registrosCombinados || !registrosCombinados[dia]) {
          return {
            fecha,
            entradaProgramada: "N/A",
            entradaReal: "No se tomó asistencia",
            diferenciaEntrada: "N/A",
            estadoEntrada: EstadosAsistenciaPersonal.Sin_Registro,
            salidaProgramada: "N/A",
            salidaReal: "No se tomó asistencia",
            diferenciaSalida: "N/A",
            estadoSalida: EstadosAsistenciaPersonal.Sin_Registro,
            esEvento: false,
            esDiaNoEscolar: !esLaboral,
          };
        }

        const registroDia = registrosCombinados[dia];

        // Procesar información de entrada (lógica idéntica)
        let entradaProgramada = "N/A";
        let entradaReal = "No registrado";
        let diferenciaEntrada = "N/A";
        let estadoEntrada = EstadosAsistenciaPersonal.No_Registrado;

        if (registroDia.entrada) {
          if (registroDia.entrada === null) {
            entradaReal = "Inactivo";
            estadoEntrada = EstadosAsistenciaPersonal.Inactivo;
          } else if (
            (registroDia.entrada.timestamp === null ||
              registroDia.entrada.timestamp === 0) &&
            (registroDia.entrada.desfaseSegundos === null ||
              registroDia.entrada.desfaseSegundos === 0)
          ) {
            entradaReal = "Falta";
            estadoEntrada = EstadosAsistenciaPersonal.Falta;
          } else if (registroDia.entrada.timestamp > 0) {
            estadoEntrada = registroDia.entrada.estado;
            entradaProgramada = calcularHoraProgramada(
              registroDia.entrada.timestamp,
              registroDia.entrada.desfaseSegundos
            );
            entradaReal = formatearHora(registroDia.entrada.timestamp);
            const desfaseMinutos = segundosAMinutos(
              registroDia.entrada.desfaseSegundos
            );
            diferenciaEntrada = `${
              desfaseMinutos >= 0 ? "+" : ""
            }${desfaseMinutos} min`;
          } else {
            estadoEntrada = registroDia.entrada.estado;
            entradaReal = mapearEstadoParaUI(estadoEntrada);
          }
        }

        // Procesar información de salida (lógica idéntica)
        let salidaProgramada = "N/A";
        let salidaReal = "No registrado";
        let diferenciaSalida = "N/A";
        let estadoSalida = EstadosAsistenciaPersonal.No_Registrado;

        if (registroDia.salida) {
          if (registroDia.salida === null) {
            salidaReal = "Inactivo";
            estadoSalida = EstadosAsistenciaPersonal.Inactivo;
          } else if (
            (registroDia.salida.timestamp === null ||
              registroDia.salida.timestamp === 0) &&
            (registroDia.salida.desfaseSegundos === null ||
              registroDia.salida.desfaseSegundos === 0)
          ) {
            salidaReal = "Falta";
            estadoSalida = EstadosAsistenciaPersonal.Falta;
          } else if (registroDia.salida.timestamp > 0) {
            estadoSalida = registroDia.salida.estado;
            salidaProgramada = calcularHoraProgramada(
              registroDia.salida.timestamp,
              registroDia.salida.desfaseSegundos
            );
            salidaReal = formatearHora(registroDia.salida.timestamp);
            const desfaseMinutos = segundosAMinutos(
              registroDia.salida.desfaseSegundos
            );
            diferenciaSalida = `${
              desfaseMinutos >= 0 ? "+" : ""
            }${desfaseMinutos} min`;
          } else {
            estadoSalida = registroDia.salida.estado;
            salidaReal = mapearEstadoParaUI(estadoSalida);
          }
        }

        return {
          fecha,
          entradaProgramada,
          entradaReal,
          diferenciaEntrada,
          estadoEntrada,
          salidaProgramada,
          salidaReal,
          diferenciaSalida,
          estadoSalida,
          esEvento: false,
          esDiaNoEscolar: !esLaboral,
        };
      });

      // 🆕 LOG de eventos encontrados en el procesamiento final
      const eventosEncontrados = registrosResultado.filter((r) => r.esEvento);
      console.log(
        `🎯 EVENTOS PROCESADOS: ${eventosEncontrados.length} de ${registrosResultado.length} días`
      );
      eventosEncontrados.forEach((evento) => {
        console.log(`   📅 ${evento.fecha}: ${evento.nombreEvento}`);
      });

      setRegistros(registrosResultado);
    } catch (error) {
      console.error("Error al procesar mis datos:", error);
      setError({
        success: false,
        message: "Error al procesar mis datos de asistencia",
      });
    }
  };

  // Función para obtener eventos
  const obtenerEventos = async (mes: number): Promise<IEventoLocal[]> => {
    try {
      console.log(`🔍 Obteniendo eventos para mes ${mes}...`);
      const eventosIDB = new EventosIDB("API01", setLoadingEventos);
      const eventosDelMes = await eventosIDB.getEventosPorMes(mes);
      console.log(`✅ Eventos obtenidos: ${eventosDelMes.length}`);
      eventosDelMes.forEach((evento) => {
        console.log(
          `   🎉 ${evento.Nombre}: ${evento.Fecha_Inicio} a ${evento.Fecha_Conclusion}`
        );
      });
      setEventos(eventosDelMes);
      return eventosDelMes; // 🆕 Retornar los eventos obtenidos
    } catch (error) {
      console.error("Error obteniendo eventos:", error);
      return []; // 🆕 Retornar array vacío en caso de error
    }
  };

  // ✅ 🆕 Función de búsqueda simplificada (solo necesita el mes) - MODIFICADA
  const buscarMisAsistencias = async () => {
    if (!selectedMes || !misDatos?.Rol) {
      setError({
        success: false,
        message: "Por favor selecciona un mes para consultar",
      });
      return;
    }

    setError(null);
    setSuccessMessage("");
    setLoading(true);

    try {
      // 🆕 ✅ PRIMERO obtener eventos para que estén disponibles al procesar
      console.log(`🔍 Paso 1: Obteniendo eventos para mes ${selectedMes}...`);
      const eventosDelMes = await obtenerEventos(parseInt(selectedMes));
      console.log(
        `✅ Paso 1 completado: ${eventosDelMes.length} eventos obtenidos`
      );

      console.log(
        `🔍 Paso 2: Consultando mis asistencias para mes ${selectedMes}...`
      );

      const resultado =
        await asistenciaPersonalIDB.consultarMiAsistenciaMensual(
          misDatos.Rol,
          parseInt(selectedMes)
        );

      if (resultado.encontrado) {
        let datosParaMostrar: AsistenciaMensualPersonalLocal;

        if (resultado.entrada) {
          datosParaMostrar = resultado.entrada;
        } else if (resultado.salida) {
          datosParaMostrar = resultado.salida;
        } else {
          throw new Error("No se pudieron procesar mis datos obtenidos");
        }

        setData(datosParaMostrar);
        setSuccessMessage(
          resultado.mensaje || "Mis asistencias obtenidas exitosamente"
        );

        console.log(
          `🔍 Paso 3: Procesando datos con ${eventosDelMes.length} eventos...`
        );
        // ✅ Procesar datos pasando directamente los eventos obtenidos
        await procesarMisDatos(parseInt(selectedMes), eventosDelMes);
        console.log(`✅ Paso 3 completado: Datos procesados con eventos`);
      } else {
        setError({
          success: false,
          message:
            resultado.mensaje ||
            "No se encontraron mis registros de asistencia",
        });
        setData(null);
        setRegistros([]);
      }
    } catch (error) {
      console.error("Error al buscar mis asistencias:", error);
      setError({
        success: false,
        message: "Error al obtener mis datos de asistencia",
      });
      setData(null);
      setRegistros([]);
    } finally {
      setLoading(false);
    }
  };

  // 📊 FUNCIÓN DE EXPORTACIÓN A EXCEL PROFESIONAL PARA MIS ASISTENCIAS
  const exportarMisAsistenciasAExcel = async (): Promise<void> => {
    if (!data || !misDatos || registros.length === 0) {
      setError({
        success: false,
        message: "No hay datos para exportar. Realiza una búsqueda primero.",
      });
      return;
    }

    setExportandoExcel(true);

    try {
      // Crear el workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Mis Registros de Asistencia", {
        pageSetup: {
          paperSize: 9, // A4
          orientation: "landscape",
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
          margins: {
            left: 0.5,
            right: 0.5,
            top: 0.75,
            bottom: 0.75,
            header: 0.3,
            footer: 0.3,
          },
        },
      });

      // Configurar columnas con anchos apropiados
      worksheet.columns = [
        { key: "fecha", width: 12 },
        { key: "entradaProgramada", width: 14 },
        { key: "entradaReal", width: 14 },
        { key: "diferenciaEntrada", width: 12 },
        { key: "estadoEntrada", width: 16 },
        { key: "salidaProgramada", width: 14 },
        { key: "salidaReal", width: 14 },
        { key: "diferenciaSalida", width: 12 },
        { key: "estadoSalida", width: 16 },
      ];

      // === SECCIÓN DE ENCABEZADO INSTITUCIONAL ===

      // Título principal
      worksheet.mergeCells("A1:I1");
      const tituloCell = worksheet.getCell("A1");
      tituloCell.value = "I.E. 20935 ASUNCIÓN 8 - IMPERIAL, CAÑETE";
      tituloCell.style = {
        font: { size: 16, bold: true, color: { argb: "FFFFFF" } },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "059669" }, // Verde para "Mis Asistencias"
        },
        alignment: { horizontal: "center", vertical: "middle" },
        border: {
          top: { style: "medium", color: { argb: "000000" } },
          left: { style: "medium", color: { argb: "000000" } },
          bottom: { style: "medium", color: { argb: "000000" } },
          right: { style: "medium", color: { argb: "000000" } },
        },
      };
      worksheet.getRow(1).height = 25;

      // Aplicar bordes a todas las celdas del título
      for (let col = 1; col <= 9; col++) {
        const cell = worksheet.getCell(1, col);
        cell.style = {
          ...cell.style,
          border: {
            top: { style: "medium", color: { argb: "000000" } },
            left: { style: "medium", color: { argb: "000000" } },
            bottom: { style: "medium", color: { argb: "000000" } },
            right: { style: "medium", color: { argb: "000000" } },
          },
        };
      }

      // Subtítulo
      worksheet.mergeCells("A2:I2");
      const subtituloCell = worksheet.getCell("A2");
      subtituloCell.value = "MIS REGISTROS MENSUALES DE ASISTENCIA";
      subtituloCell.style = {
        font: { size: 14, bold: true, color: { argb: "FFFFFF" } },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "10B981" }, // Verde más claro
        },
        alignment: { horizontal: "center", vertical: "middle" },
        border: {
          top: { style: "medium", color: { argb: "000000" } },
          left: { style: "medium", color: { argb: "000000" } },
          bottom: { style: "medium", color: { argb: "000000" } },
          right: { style: "medium", color: { argb: "000000" } },
        },
      };
      worksheet.getRow(2).height = 20;

      // Aplicar bordes a todas las celdas del subtítulo
      for (let col = 1; col <= 9; col++) {
        const cell = worksheet.getCell(2, col);
        cell.style = {
          ...cell.style,
          border: {
            top: { style: "medium", color: { argb: "000000" } },
            left: { style: "medium", color: { argb: "000000" } },
            bottom: { style: "medium", color: { argb: "000000" } },
            right: { style: "medium", color: { argb: "000000" } },
          },
        };
      }

      // === SECCIÓN DE INFORMACIÓN DEL USUARIO ===

      // Espacio
      worksheet.getRow(3).height = 5;

      // Obtener rol legible
      const rolLegible =
        roles.find((r) => r.value === misDatos.Rol)?.label || misDatos.Rol;

      // Función helper para aplicar bordes a celdas combinadas
      const aplicarBordesACeldasCombinadas = (rango: string, estilo: any) => {
        const celdaInicial = worksheet.getCell(rango.split(":")[0]);
        celdaInicial.style = estilo;

        // Obtener todas las celdas en el rango
        const startCol = Number(worksheet.getCell(rango.split(":")[0]).col);
        const endCol = Number(worksheet.getCell(rango.split(":")[1]).col);
        const row = Number(worksheet.getCell(rango.split(":")[0]).row);

        for (let col = startCol; col <= endCol; col++) {
          const cell = worksheet.getCell(row, col);
          cell.style = { ...cell.style, border: estilo.border };
        }
      };

      // Información del usuario en formato tabla
      let filaActual = 4;

      // Fila 1: NOMBRE COMPLETO y DNI
      worksheet.mergeCells(`A${filaActual}:C${filaActual}`);
      worksheet.mergeCells(`D${filaActual}:F${filaActual}`);
      worksheet.mergeCells(`G${filaActual}:H${filaActual}`);

      const nombreLabelCell = worksheet.getCell(`A${filaActual}`);
      nombreLabelCell.value = "NOMBRE COMPLETO:";
      aplicarBordesACeldasCombinadas(`A${filaActual}:C${filaActual}`, {
        font: { bold: true, size: 10 },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "E5E7EB" },
        },
        alignment: { horizontal: "left", vertical: "middle", indent: 1 },
        border: {
          top: { style: "thin", color: { argb: "000000" } },
          left: { style: "thin", color: { argb: "000000" } },
          bottom: { style: "thin", color: { argb: "000000" } },
          right: { style: "thin", color: { argb: "000000" } },
        },
      });

      const nombreValueCell = worksheet.getCell(`D${filaActual}`);
      nombreValueCell.value = `${misDatos.Nombres} ${misDatos.Apellidos}`;
      aplicarBordesACeldasCombinadas(`D${filaActual}:F${filaActual}`, {
        font: { size: 10 },
        alignment: { horizontal: "left", vertical: "middle", indent: 1 },
        border: {
          top: { style: "thin", color: { argb: "000000" } },
          left: { style: "thin", color: { argb: "000000" } },
          bottom: { style: "thin", color: { argb: "000000" } },
          right: { style: "thin", color: { argb: "000000" } },
        },
      });

      const dniLabelCell = worksheet.getCell(`G${filaActual}`);
      dniLabelCell.value = "DNI:";
      aplicarBordesACeldasCombinadas(`G${filaActual}:H${filaActual}`, {
        font: { bold: true, size: 10 },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "E5E7EB" },
        },
        alignment: { horizontal: "left", vertical: "middle", indent: 1 },
        border: {
          top: { style: "thin", color: { argb: "000000" } },
          left: { style: "thin", color: { argb: "000000" } },
          bottom: { style: "thin", color: { argb: "000000" } },
          right: { style: "thin", color: { argb: "000000" } },
        },
      });

      const dniValueCell = worksheet.getCell(`I${filaActual}`);
      dniValueCell.value = misDatos.ID_O_DNI_Usuario;
      dniValueCell.style = {
        font: { size: 10 },
        alignment: { horizontal: "left", vertical: "middle", indent: 1 },
        border: {
          top: { style: "thin", color: { argb: "000000" } },
          left: { style: "thin", color: { argb: "000000" } },
          bottom: { style: "thin", color: { argb: "000000" } },
          right: { style: "thin", color: { argb: "000000" } },
        },
      };

      filaActual++;

      // Fila 2: ROL y MES
      worksheet.mergeCells(`A${filaActual}:C${filaActual}`);
      worksheet.mergeCells(`D${filaActual}:F${filaActual}`);
      worksheet.mergeCells(`G${filaActual}:H${filaActual}`);

      const rolLabelCell = worksheet.getCell(`A${filaActual}`);
      rolLabelCell.value = "ROL:";
      aplicarBordesACeldasCombinadas(`A${filaActual}:C${filaActual}`, {
        font: { bold: true, size: 10 },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "E5E7EB" },
        },
        alignment: { horizontal: "left", vertical: "middle", indent: 1 },
        border: {
          top: { style: "thin", color: { argb: "000000" } },
          left: { style: "thin", color: { argb: "000000" } },
          bottom: { style: "thin", color: { argb: "000000" } },
          right: { style: "thin", color: { argb: "000000" } },
        },
      });

      const rolValueCell = worksheet.getCell(`D${filaActual}`);
      rolValueCell.value = rolLegible;
      aplicarBordesACeldasCombinadas(`D${filaActual}:F${filaActual}`, {
        font: { size: 10 },
        alignment: { horizontal: "left", vertical: "middle", indent: 1 },
        border: {
          top: { style: "thin", color: { argb: "000000" } },
          left: { style: "thin", color: { argb: "000000" } },
          bottom: { style: "thin", color: { argb: "000000" } },
          right: { style: "thin", color: { argb: "000000" } },
        },
      });

      const mesLabelCell = worksheet.getCell(`G${filaActual}`);
      mesLabelCell.value = "MES:";
      aplicarBordesACeldasCombinadas(`G${filaActual}:H${filaActual}`, {
        font: { bold: true, size: 10 },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "E5E7EB" },
        },
        alignment: { horizontal: "left", vertical: "middle", indent: 1 },
        border: {
          top: { style: "thin", color: { argb: "000000" } },
          left: { style: "thin", color: { argb: "000000" } },
          bottom: { style: "thin", color: { argb: "000000" } },
          right: { style: "thin", color: { argb: "000000" } },
        },
      });

      const mesValueCell = worksheet.getCell(`I${filaActual}`);
      mesValueCell.value = mesesTextos[parseInt(selectedMes) as Meses];
      mesValueCell.style = {
        font: { size: 10 },
        alignment: { horizontal: "left", vertical: "middle", indent: 1 },
        border: {
          top: { style: "thin", color: { argb: "000000" } },
          left: { style: "thin", color: { argb: "000000" } },
          bottom: { style: "thin", color: { argb: "000000" } },
          right: { style: "thin", color: { argb: "000000" } },
        },
      };

      filaActual++;

      // Fila 3: TOTAL REGISTROS y FECHA GENERACIÓN
      worksheet.mergeCells(`A${filaActual}:C${filaActual}`);
      worksheet.mergeCells(`D${filaActual}:F${filaActual}`);
      worksheet.mergeCells(`G${filaActual}:H${filaActual}`);

      const totalLabelCell = worksheet.getCell(`A${filaActual}`);
      totalLabelCell.value = "TOTAL REGISTROS:";
      aplicarBordesACeldasCombinadas(`A${filaActual}:C${filaActual}`, {
        font: { bold: true, size: 10 },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "E5E7EB" },
        },
        alignment: { horizontal: "left", vertical: "middle", indent: 1 },
        border: {
          top: { style: "thin", color: { argb: "000000" } },
          left: { style: "thin", color: { argb: "000000" } },
          bottom: { style: "thin", color: { argb: "000000" } },
          right: { style: "thin", color: { argb: "000000" } },
        },
      });

      const totalValueCell = worksheet.getCell(`D${filaActual}`);
      totalValueCell.value = registros.length.toString();
      aplicarBordesACeldasCombinadas(`D${filaActual}:F${filaActual}`, {
        font: { size: 10 },
        alignment: { horizontal: "left", vertical: "middle", indent: 1 },
        border: {
          top: { style: "thin", color: { argb: "000000" } },
          left: { style: "thin", color: { argb: "000000" } },
          bottom: { style: "thin", color: { argb: "000000" } },
          right: { style: "thin", color: { argb: "000000" } },
        },
      });

      const fechaGenLabelCell = worksheet.getCell(`G${filaActual}`);
      fechaGenLabelCell.value = "FECHA GENERACIÓN:";
      aplicarBordesACeldasCombinadas(`G${filaActual}:H${filaActual}`, {
        font: { bold: true, size: 10 },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "E5E7EB" },
        },
        alignment: { horizontal: "left", vertical: "middle", indent: 1 },
        border: {
          top: { style: "thin", color: { argb: "000000" } },
          left: { style: "thin", color: { argb: "000000" } },
          bottom: { style: "thin", color: { argb: "000000" } },
          right: { style: "thin", color: { argb: "000000" } },
        },
      });

      const fechaGenValueCell = worksheet.getCell(`I${filaActual}`);
      fechaGenValueCell.value = new Date().toLocaleDateString("es-ES");
      fechaGenValueCell.style = {
        font: { size: 10 },
        alignment: { horizontal: "left", vertical: "middle", indent: 1 },
        border: {
          top: { style: "thin", color: { argb: "000000" } },
          left: { style: "thin", color: { argb: "000000" } },
          bottom: { style: "thin", color: { argb: "000000" } },
          right: { style: "thin", color: { argb: "000000" } },
        },
      };

      // Espacio antes de la tabla
      filaActual += 2;

      // === SECCIÓN DE ENCABEZADOS DE LA TABLA ===

      const encabezados = [
        "FECHA",
        "ENTRADA\nPROGRAMADA",
        "ENTRADA\nREAL",
        "DIFERENCIA\nENTRADA",
        "ESTADO\nENTRADA",
        "SALIDA\nPROGRAMADA",
        "SALIDA\nREAL",
        "DIFERENCIA\nSALIDA",
        "ESTADO\nSALIDA",
      ];

      const filaEncabezados = filaActual;
      encabezados.forEach((encabezado, index) => {
        const cell = worksheet.getCell(filaEncabezados, index + 1);
        cell.value = encabezado;
        cell.style = {
          font: { bold: true, size: 9, color: { argb: "FFFFFF" } },
          fill: {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "374151" },
          },
          alignment: {
            horizontal: "center",
            vertical: "middle",
            wrapText: true,
          },
          border: {
            top: { style: "medium", color: { argb: "000000" } },
            left: { style: "thin", color: { argb: "000000" } },
            bottom: { style: "medium", color: { argb: "000000" } },
            right: { style: "thin", color: { argb: "000000" } },
          },
        };
      });

      worksheet.getRow(filaEncabezados).height = 30;

      // === SECCIÓN DE DATOS ===

      let filaData = filaEncabezados + 1;

      // Mapeo de estados a colores para Excel
      const COLORES_ESTADOS_EXCEL = {
        [EstadosAsistenciaPersonal.En_Tiempo]: {
          background: "D4F7D4",
          font: "047857",
          nombre: "En tiempo",
        },
        [EstadosAsistenciaPersonal.Temprano]: {
          background: "BFDBFE",
          font: "1E40AF",
          nombre: "Temprano",
        },
        [EstadosAsistenciaPersonal.Tarde]: {
          background: "FED7BA",
          font: "C2410C",
          nombre: "Tarde",
        },
        [EstadosAsistenciaPersonal.Cumplido]: {
          background: "D4F7D4",
          font: "047857",
          nombre: "Cumplido",
        },
        [EstadosAsistenciaPersonal.Salida_Anticipada]: {
          background: "FEF3C7",
          font: "A16207",
          nombre: "Salida anticipada",
        },
        [EstadosAsistenciaPersonal.Falta]: {
          background: "FECACA",
          font: "DC2626",
          nombre: "Falta",
        },
        [EstadosAsistenciaPersonal.No_Registrado]: {
          background: "F3F4F6",
          font: "6B7280",
          nombre: "No registrado",
        },
        [EstadosAsistenciaPersonal.Sin_Registro]: {
          background: "F3F4F6",
          font: "6B7280",
          nombre: "Sin registro",
        },
        [EstadosAsistenciaPersonal.Inactivo]: {
          background: "E5E7EB",
          font: "4B5563",
          nombre: "Inactivo",
        },
        [EstadosAsistenciaPersonal.Evento]: {
          background: "DDD6FE",
          font: "7C3AED",
          nombre: "Evento",
        },
        [EstadosAsistenciaPersonal.Otro]: {
          background: "F3F4F6",
          font: "6B7280",
          nombre: "Otro",
        },
      };

      registros.forEach((registro, index) => {
        const fila = worksheet.getRow(filaData);

        // Determinar color de fondo de la fila
        let colorFondo = index % 2 === 0 ? "FFFFFF" : "F9FAFB";

        // Colores especiales
        if (registro.esEvento) {
          colorFondo = "DDD6FE"; // violeta claro para eventos
        } else if (registro.esDiaNoEscolar && !registro.esEvento) {
          colorFondo = "EBF8FF"; // azul claro para fines de semana
        }

        // Fecha
        const fechaCell = fila.getCell(1);
        let textoFecha = new Date(
          registro.fecha + "T00:00:00"
        ).toLocaleDateString("es-ES", {
          weekday: "short",
          day: "2-digit",
          month: "2-digit",
        });

        if (registro.esEvento) {
          textoFecha += `\n🎉 ${registro.nombreEvento}`;
        } else if (registro.esDiaNoEscolar) {
          textoFecha += "\n📅 Fin de semana";
        }

        fechaCell.value = textoFecha;
        fechaCell.style = {
          font: { size: 8 },
          fill: {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: colorFondo },
          },
          alignment: {
            horizontal: "center",
            vertical: "middle",
            wrapText: true,
          },
          border: {
            top: { style: "thin", color: { argb: "000000" } },
            left: { style: "thin", color: { argb: "000000" } },
            bottom: { style: "thin", color: { argb: "000000" } },
            right: { style: "thin", color: { argb: "000000" } },
          },
        };

        // Función para aplicar estilo estándar a celdas
        const aplicarEstiloEstandar = (celda: any, valor: string) => {
          celda.value = valor;
          celda.style = {
            font: { size: 8 },
            fill: {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: colorFondo },
            },
            alignment: { horizontal: "center", vertical: "middle" },
            border: {
              top: { style: "thin", color: { argb: "000000" } },
              left: { style: "thin", color: { argb: "000000" } },
              bottom: { style: "thin", color: { argb: "000000" } },
              right: { style: "thin", color: { argb: "000000" } },
            },
          };
        };

        // Aplicar datos con estilo estándar
        aplicarEstiloEstandar(fila.getCell(2), registro.entradaProgramada);
        aplicarEstiloEstandar(fila.getCell(3), registro.entradaReal);
        aplicarEstiloEstandar(fila.getCell(4), registro.diferenciaEntrada);
        aplicarEstiloEstandar(fila.getCell(6), registro.salidaProgramada);
        aplicarEstiloEstandar(fila.getCell(7), registro.salidaReal);
        aplicarEstiloEstandar(fila.getCell(8), registro.diferenciaSalida);

        // Estado Entrada (con color específico)
        const estadoEntradaCell = fila.getCell(5);
        const colorEstadoEntrada =
          COLORES_ESTADOS_EXCEL[registro.estadoEntrada];
        estadoEntradaCell.value = colorEstadoEntrada.nombre;
        estadoEntradaCell.style = {
          font: {
            size: 8,
            bold: true,
            color: { argb: colorEstadoEntrada.font },
          },
          fill: {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: colorEstadoEntrada.background },
          },
          alignment: { horizontal: "center", vertical: "middle" },
          border: {
            top: { style: "thin", color: { argb: "000000" } },
            left: { style: "thin", color: { argb: "000000" } },
            bottom: { style: "thin", color: { argb: "000000" } },
            right: { style: "thin", color: { argb: "000000" } },
          },
        };

        // Estado Salida (con color específico)
        const estadoSalidaCell = fila.getCell(9);
        const colorEstadoSalida = COLORES_ESTADOS_EXCEL[registro.estadoSalida];
        estadoSalidaCell.value = colorEstadoSalida.nombre;
        estadoSalidaCell.style = {
          font: {
            size: 8,
            bold: true,
            color: { argb: colorEstadoSalida.font },
          },
          fill: {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: colorEstadoSalida.background },
          },
          alignment: { horizontal: "center", vertical: "middle" },
          border: {
            top: { style: "thin", color: { argb: "000000" } },
            left: { style: "thin", color: { argb: "000000" } },
            bottom: { style: "thin", color: { argb: "000000" } },
            right: { style: "thin", color: { argb: "000000" } },
          },
        };

        fila.height = 20;
        filaData++;
      });

      // === SECCIÓN DE RESUMEN ESTADÍSTICO ===

      filaData += 1;

      // Calcular estadísticas
      const totalAsistencias = registros.filter(
        (r) =>
          r.estadoEntrada === EstadosAsistenciaPersonal.En_Tiempo ||
          r.estadoEntrada === EstadosAsistenciaPersonal.Temprano
      ).length;

      const totalTardanzas = registros.filter(
        (r) => r.estadoEntrada === EstadosAsistenciaPersonal.Tarde
      ).length;

      const totalFaltas = registros.filter(
        (r) => r.estadoEntrada === EstadosAsistenciaPersonal.Falta
      ).length;

      const totalEventos = registros.filter((r) => r.esEvento).length;

      // Título del resumen
      worksheet.mergeCells(`A${filaData}:I${filaData}`);
      const resumenTituloCell = worksheet.getCell(`A${filaData}`);
      resumenTituloCell.value = "RESUMEN ESTADÍSTICO";
      resumenTituloCell.style = {
        font: { size: 12, bold: true, color: { argb: "FFFFFF" } },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "059669" }, // Verde consistente con el tema
        },
        alignment: { horizontal: "center", vertical: "middle" },
        border: {
          top: { style: "medium", color: { argb: "000000" } },
          left: { style: "medium", color: { argb: "000000" } },
          bottom: { style: "medium", color: { argb: "000000" } },
          right: { style: "medium", color: { argb: "000000" } },
        },
      };
      worksheet.getRow(filaData).height = 20;

      // Aplicar bordes a todas las celdas del rango combinado del título
      for (let col = 1; col <= 9; col++) {
        const cell = worksheet.getCell(filaData, col);
        cell.style = {
          ...cell.style,
          border: {
            top: { style: "medium", color: { argb: "000000" } },
            left: { style: "medium", color: { argb: "000000" } },
            bottom: { style: "medium", color: { argb: "000000" } },
            right: { style: "medium", color: { argb: "000000" } },
          },
        };
      }
      filaData++;

      // Datos del resumen en tabla
      const datosResumen = [
        {
          concepto: "Total Asistencias:",
          valor: totalAsistencias,
          color: "D4F7D4",
        },
        {
          concepto: "Total Tardanzas:",
          valor: totalTardanzas,
          color: "FED7BA",
        },
        { concepto: "Total Faltas:", valor: totalFaltas, color: "FECACA" },
        { concepto: "Días de Evento:", valor: totalEventos, color: "DDD6FE" },
      ];

      datosResumen.forEach((dato) => {
        // Combinar celdas primero
        worksheet.mergeCells(`A${filaData}:G${filaData}`);
        worksheet.mergeCells(`H${filaData}:I${filaData}`);

        const conceptoCell = worksheet.getCell(`A${filaData}`);
        conceptoCell.value = dato.concepto;
        aplicarBordesACeldasCombinadas(`A${filaData}:G${filaData}`, {
          font: { bold: true, size: 10 },
          fill: {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "F3F4F6" },
          },
          alignment: { horizontal: "left", vertical: "middle", indent: 1 },
          border: {
            top: { style: "thin", color: { argb: "000000" } },
            left: { style: "thin", color: { argb: "000000" } },
            bottom: { style: "thin", color: { argb: "000000" } },
            right: { style: "thin", color: { argb: "000000" } },
          },
        });

        const valorCell = worksheet.getCell(`H${filaData}`);
        valorCell.value = dato.valor;
        aplicarBordesACeldasCombinadas(`H${filaData}:I${filaData}`, {
          font: { bold: true, size: 10 },
          fill: {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: dato.color },
          },
          alignment: { horizontal: "center", vertical: "middle" },
          border: {
            top: { style: "thin", color: { argb: "000000" } },
            left: { style: "thin", color: { argb: "000000" } },
            bottom: { style: "thin", color: { argb: "000000" } },
            right: { style: "thin", color: { argb: "000000" } },
          },
        });

        filaData++;
      });

      // Información de generación
      filaData += 1;
      worksheet.mergeCells(`A${filaData}:I${filaData}`);
      const infoGenCell = worksheet.getCell(`A${filaData}`);
      infoGenCell.value = `Documento generado automáticamente el ${new Date().toLocaleString(
        "es-ES"
      )} | Sistema SIASIS - I.E. 20935 Asunción 8`;
      infoGenCell.style = {
        font: { size: 8, italic: true },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "F9FAFB" },
        },
        alignment: { horizontal: "center", vertical: "middle" },
        border: {
          top: { style: "thin", color: { argb: "000000" } },
          left: { style: "thin", color: { argb: "000000" } },
          bottom: { style: "thin", color: { argb: "000000" } },
          right: { style: "thin", color: { argb: "000000" } },
        },
      };

      // Aplicar bordes a todas las celdas del rango combinado de la información de generación
      for (let col = 1; col <= 9; col++) {
        const cell = worksheet.getCell(filaData, col);
        cell.style = {
          ...cell.style,
          border: {
            top: { style: "thin", color: { argb: "000000" } },
            left: { style: "thin", color: { argb: "000000" } },
            bottom: { style: "thin", color: { argb: "000000" } },
            right: { style: "thin", color: { argb: "000000" } },
          },
        };
      }

      // === GENERAR Y GUARDAR ARCHIVO CON DIÁLOGO ===

      const nombreFinal = `Mis_Asistencias_${misDatos.Nombres.replace(
        /\s+/g,
        "_"
      )}_${
        mesesTextos[parseInt(selectedMes) as Meses]
      }_${new Date().getFullYear()}`;

      // Generar buffer
      const buffer = await workbook.xlsx.writeBuffer();

      // 🔍 DEBUG: Logs detallados para diagnosticar
      console.log("🔍 === INICIANDO PROCESO DE GUARDADO ===");
      console.log(
        "- API showSaveFilePicker disponible:",
        "showSaveFilePicker" in window
      );
      console.log("- Protocolo actual:", window.location.protocol);
      console.log("- Hostname actual:", window.location.hostname);
      console.log("- Es contexto seguro:", window.isSecureContext);
      console.log("- Tamaño del buffer:", buffer.byteLength, "bytes");

      // ✅ VERIFICACIÓN EXPLÍCITA: Solo usar File System Access API si está realmente disponible
      const tieneFileSystemAPI = "showSaveFilePicker" in window;

      if (tieneFileSystemAPI) {
        console.log("🚀 === INTENTANDO FILE SYSTEM ACCESS API ===");

        try {
          console.log("📂 Mostrando diálogo de guardar...");

          // Usar la nueva API de File System Access
          const fileHandle = await (window as any).showSaveFilePicker({
            suggestedName: `${nombreFinal}.xlsx`,
            types: [
              {
                description: "Archivos Excel",
                accept: {
                  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
                    [".xlsx"],
                },
              },
            ],
          });

          console.log("✅ Usuario seleccionó ubicación:", fileHandle.name);
          console.log("💾 Escribiendo archivo...");

          const writable = await fileHandle.createWritable();
          await writable.write(buffer);
          await writable.close();

          console.log("🎉 === ARCHIVO GUARDADO EXITOSAMENTE ===");
          setSuccessMessage("✅ Mis asistencias exportadas exitosamente");
        } catch (error: any) {
          console.log("❌ === ERROR EN FILE SYSTEM ACCESS API ===");
          console.log("- Tipo de error:", error.name);
          console.log("- Mensaje:", error.message);
          console.log("- Error completo:", error);

          if (error.name === "AbortError") {
            console.log("👤 Usuario canceló el diálogo de guardar");
            setSuccessMessage("❌ Operación cancelada por el usuario");
          } else {
            console.log("🔄 Fallback a descarga tradicional...");
            downloadTraditional(buffer, nombreFinal);
          }
        }
      } else {
        console.log("⚠️ === FILE SYSTEM ACCESS API NO DISPONIBLE ===");
        console.log("🔄 Usando descarga tradicional...");
        downloadTraditional(buffer, nombreFinal);
      }

      // Limpiar mensaje después de 4 segundos
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (error) {
      console.error("❌ Error al exportar mis asistencias:", error);
      setError({
        success: false,
        message: "Error al generar el archivo Excel. Inténtalo nuevamente.",
      });
    } finally {
      setExportandoExcel(false);
    }
  };

  // Función helper para descarga tradicional
  const downloadTraditional = (buffer: ArrayBuffer, nombreFinal: string) => {
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${nombreFinal}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    setSuccessMessage("✅ Mis asistencias exportadas exitosamente");
  };
  // ✅ Función auxiliar para limpiar resultados
  const limpiarResultados = () => {
    setData(null);
    setRegistros([]);
    setError(null);
    setSuccessMessage("");
  };

  // ✅ Función de limpieza cuando cambia el mes
  const handleMesChange = (mes: string) => {
    setSelectedMes(mes);
    limpiarResultados();
  };

  // ✅ Manejar Enter en los campos
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (
      e.key === "Enter" &&
      mesEstaSeleccionado &&
      !loading &&
      !loadingEventos &&
      !loadingUserData
    ) {
      buscarMisAsistencias();
    }
  };

  // ✅ Estados de validación
  const mesEstaSeleccionado = !!selectedMes;
  const datosUsuarioDisponibles = !!misDatos && !loadingUserData;
  const puedeConsultar = mesEstaSeleccionado && datosUsuarioDisponibles;

  // 🆕 Crear usuario ficticio para el componente InfoUsuarioAsistencia
  const usuarioParaInfo: GenericUser | null = misDatos
    ? ({
        Nombres: misDatos.Nombres,
        Apellidos: misDatos.Apellidos,
        DNI_Directivo: misDatos.ID_O_DNI_Usuario,
        ID_O_DNI_Usuario: misDatos.ID_O_DNI_Usuario || "N/A",
        Google_Drive_Foto_ID: misDatos.Google_Drive_Foto_ID,
      } as GenericUser)
    : null;

  // Si está cargando datos del usuario, mostrar loading
  if (loadingUserData) {
    return (
      <div className="min-h-full min-w-full -bg-gray-50 sxs-only:p-2 xs-only:p-3 sm-only:p-4 md-only:p-4 lg-only:p-6 xl-only:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 sxs-only:p-3 xs-only:p-3 sm-only:p-4 md-only:p-4 lg-only:p-4 xl-only:p-5">
            <div className="flex items-center justify-center space-x-3">
              <Loader2 className="animate-spin w-6 h-6 text-blue-500" />
              <p className="text-gray-600 font-medium">
                Cargando datos del usuario...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Si no se pudieron cargar los datos del usuario, mostrar error
  if (!misDatos) {
    return (
      <div className="min-h-full min-w-full -bg-gray-50 sxs-only:p-2 xs-only:p-3 sm-only:p-4 md-only:p-4 lg-only:p-6 xl-only:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 sxs-only:p-3 xs-only:p-3 sm-only:p-4 md-only:p-4 lg-only:p-4 xl-only:p-5">
            <div className="text-center">
              <User className="w-12 h-12 text-red-500 mx-auto mb-3" />
              <p className="text-red-700 font-medium mb-2">
                No se pudieron cargar los datos del usuario
              </p>
              <p className="text-gray-600 text-sm">
                Por favor, cierra sesión e inicia sesión nuevamente.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full min-w-full -bg-gray-50 sxs-only:p-2 xs-only:p-3 sm-only:p-4 md-only:p-4 lg-only:p-6 xl-only:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center sxs-only:space-x-2 xs-only:space-x-2 sm-only:space-x-3 md-only:space-x-4 lg-only:space-x-4 xl-only:space-x-4 mb-1">
            <div className="sxs-only:w-7 sxs-only:h-7 xs-only:w-8 xs-only:h-8 sm-only:w-8 sm-only:h-8 md-only:w-9 md-only:h-9 lg-only:w-10 lg-only:h-10 xl-only:w-10 xl-only:h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <User className="sxs-only:w-3 sxs-only:h-3 xs-only:w-4 xs-only:h-4 sm-only:w-4 sm-only:h-4 md-only:w-5 md-only:h-5 lg-only:w-6 lg-only:h-6 xl-only:w-6 xl-only:h-6 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="sxs-only:text-lg xs-only:text-lg sm-only:text-xl md-only:text-xl lg-only:text-2xl xl-only:text-2xl font-bold text-gray-900">
                Mis Registros de Asistencia
              </h1>
              <p className="text-gray-600 sxs-only:text-xs xs-only:text-xs sm-only:text-xs md-only:text-xs lg-only:text-sm xl-only:text-sm">
                Consulta tus registros mensuales de entrada y salida
              </p>
            </div>
          </div>
        </div>

        {/* Formulario de búsqueda simplificado */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 sxs-only:p-3 xs-only:p-3 sm-only:p-4 md-only:p-4 lg-only:p-4 xl-only:p-5 mb-4">
          <div className="space-y-4">
            {/* Solo selector de mes y botón de búsqueda */}
            <div className="grid sxs-only:grid-cols-1 xs-only:grid-cols-1 sm-only:grid-cols-2 md-only:grid-cols-3 lg-only:grid-cols-4 xl-only:grid-cols-4 sxs-only:gap-3 xs-only:gap-3 sm-only:gap-3 md-only:gap-3 lg-only:gap-4 xl-only:gap-4">
              {/* Información del usuario logueado */}
              <div className="sxs-only:col-span-1 xs-only:col-span-1 sm-only:col-span-1 md-only:col-span-1 lg-only:col-span-2 xl-only:col-span-2">
                <label className="block sxs-only:text-xs xs-only:text-xs sm-only:text-xs md-only:text-xs lg-only:text-xs xl-only:text-sm font-semibold text-gray-700 mb-1">
                  Usuario
                </label>
                <div className="flex items-center space-x-3 sxs-only:px-3 sxs-only:py-2.5 xs-only:px-3 xs-only:py-2.5 sm-only:px-3 sm-only:py-2.5 md-only:px-3 md-only:py-2.5 lg-only:px-3 lg-only:py-2.5 xl-only:px-3 xl-only:py-2.5 bg-gray-50 border-2 border-gray-200 rounded-lg sxs-only:min-h-[2.75rem] xs-only:min-h-[2.75rem] sm-only:min-h-[3rem] md-only:min-h-[3rem] lg-only:min-h-[3rem] xl-only:min-h-[3rem]">
                  {misDatos.Google_Drive_Foto_ID ? (
                    <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold">
                      {misDatos.Nombres?.charAt(0)}
                      {misDatos.Apellidos?.charAt(0)}
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold">
                      {misDatos.Nombres?.charAt(0)}
                      {misDatos.Apellidos?.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate sxs-only:text-sm xs-only:text-sm sm-only:text-sm md-only:text-sm lg-only:text-sm xl-only:text-sm">
                      {misDatos.Nombres} {misDatos.Apellidos}
                    </p>
                    <p className="text-gray-500 truncate sxs-only:text-xs xs-only:text-xs sm-only:text-xs md-only:text-xs lg-only:text-xs xl-only:text-xs">
                      {roles.find((r) => r.value === misDatos.Rol)?.label ||
                        misDatos.Rol}
                    </p>
                  </div>
                </div>
              </div>

              {/* Selector de Mes */}
              <div className="sxs-only:col-span-1 xs-only:col-span-1 sm-only:col-span-1 md-only:col-span-1 lg-only:col-span-1 xl-only:col-span-1">
                <label className="block sxs-only:text-xs xs-only:text-xs sm-only:text-xs md-only:text-xs lg-only:text-xs xl-only:text-sm font-semibold text-gray-700 mb-1">
                  Mes a Consultar
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 z-10" />
                  <select
                    value={selectedMes}
                    onChange={(e) => handleMesChange(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={loading || loadingEventos}
                    className={`w-full pl-9 pr-3 sxs-only:py-2.5 xs-only:py-2.5 sm-only:py-2.5 md-only:py-2.5 lg-only:py-2.5 xl-only:py-2.5 border-2 rounded-lg transition-all duration-200 sxs-only:text-sm xs-only:text-sm sm-only:text-sm md-only:text-sm lg-only:text-sm xl-only:text-sm bg-white sxs-only:min-h-[2.75rem] xs-only:min-h-[2.75rem] sm-only:min-h-[3rem] md-only:min-h-[3rem] lg-only:min-h-[3rem] xl-only:min-h-[3rem] shadow-sm appearance-none ${
                      loading || loadingEventos
                        ? "border-gray-200 bg-gray-50 cursor-not-allowed opacity-60"
                        : "border-gray-200 hover:border-green-300 focus:outline-none focus:ring-2 focus:ring-green-100 focus:border-green-500"
                    }`}
                  >
                    <option value="">Seleccionar mes</option>
                    {getMesesDisponibles().map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Botón de búsqueda */}
              <div className="sxs-only:col-span-1 xs-only:col-span-1 sm-only:col-span-1 md-only:col-span-1 lg-only:col-span-1 xl-only:col-span-1">
                <label className="block sxs-only:text-xs xs-only:text-xs sm-only:text-xs md-only:text-xs lg-only:text-xs xl-only:text-sm font-semibold text-gray-700 mb-1">
                  &nbsp;
                </label>
                <button
                  type="button"
                  onClick={buscarMisAsistencias}
                  disabled={!puedeConsultar || loading || loadingEventos}
                  className={`w-full sxs-only:px-3 sxs-only:py-2.5 xs-only:px-3 xs-only:py-2.5 sm-only:px-4 sm-only:py-2.5 md-only:px-4 md-only:py-2.5 lg-only:px-4 lg-only:py-2.5 xl-only:px-4 xl-only:py-2.5 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center sxs-only:text-sm xs-only:text-sm sm-only:text-sm md-only:text-sm lg-only:text-sm xl-only:text-sm sxs-only:min-h-[2.75rem] xs-only:min-h-[2.75rem] sm-only:min-h-[3rem] md-only:min-h-[3rem] lg-only:min-h-[3rem] xl-only:min-h-[3rem] shadow-sm ${
                    !puedeConsultar || loading || loadingEventos
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed border-2 border-gray-200"
                      : "bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 border-2 border-green-500"
                  }`}
                >
                  {loading || loadingEventos ? (
                    <>
                      <Loader2 className="animate-spin w-4 h-4 mr-2 flex-shrink-0" />
                      <span className="truncate">Consultando...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2 flex-shrink-0" />
                      <span className="truncate">Consultar</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Mensajes de estado usando componente reutilizable */}
            <MensajesEstadoAsistencia
              loading={loading}
              loadingEventos={loadingEventos}
              exportandoExcel={exportandoExcel}
              error={error}
              successMessage={successMessage}
              considerarDiasNoEscolares={CONSIDERAR_DIAS_NO_ESCOLARES}
            />
          </div>
        </div>

        {/* Información del usuario usando componente reutilizable */}
        {data && !loading && !loadingEventos && usuarioParaInfo && (
          <InfoUsuarioAsistencia
            usuario={usuarioParaInfo}
            rolSeleccionado={misDatos.Rol}
            rolesDisponibles={roles}
            mes={data.mes}
            totalRegistros={registros.length}
            exportandoExcel={exportandoExcel}
            onExportarExcel={exportarMisAsistenciasAExcel}
            puedeExportar={!!data && registros.length > 0}
            mostrarMensajeDias={true}
            considerarDiasNoEscolares={CONSIDERAR_DIAS_NO_ESCOLARES}
          />
        )}

        {/* Tabla de registros usando componente reutilizable */}
        <TablaRegistrosAsistencia
          registros={registros}
          loading={loading}
          loadingEventos={loadingEventos}
          mapearEstadoParaUI={mapearEstadoParaUI}
        />

        {/* Leyenda explicativa usando componente reutilizable */}
        <LeyendaEstadosAsistencia
          registros={registros}
          loading={loading}
          loadingEventos={loadingEventos}
          mapearEstadoParaUI={mapearEstadoParaUI}
          considerarDiasNoEscolares={CONSIDERAR_DIAS_NO_ESCOLARES}
        />
      </div>
    </div>
  );
};

export default MisAsistencias;
