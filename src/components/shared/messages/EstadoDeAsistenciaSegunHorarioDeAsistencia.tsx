"use client";

import { useCallback } from "react";
import { useSelector } from "react-redux";
import store, { RootState } from "@/global/store";
import { ModoRegistro } from "@/interfaces/shared/ModoRegistroPersonal";
import { DiasSemana, diasSemanaTextos } from "@/interfaces/shared/DiasSemana";
import { Meses, mesesTextos } from "@/interfaces/shared/Meses";
import { formatearISOaFormato12Horas } from "@/lib/helpers/formatters/fechas-hora/formatearAFormato12Horas";
import {
  HORAS_ANTES_INICIO_ACTIVACION,
  HORAS_ANTES_SALIDA_CAMBIO_MODO,
  HORAS_DESPUES_SALIDA_LIMITE,
} from "@/constants/INTERVALOS_CONSULTAS_ASISTENCIAS_PROPIAS_PARA_PERSONAL_NO_DIRECTIVO";
import { HORA_ACTUALIZACION_DATOS_ASISTENCIA_DIARIOS } from "@/constants/HORA_ACTUALIZACION_DATOS_ASISTENCIA_DIARIOS";
import { DatosAsistenciaCompartidos } from "@/hooks/asistencia-personal-no-directivo/useAsistenciaCompartida";
import { T_Eventos } from "@prisma/client";

// ✅ CONSTANTE DE VERSIÓN
const VERSION_MINIMALISTA = true;

// ✅ INTERFACES LOCALES
interface EstadoAsistenciaDetallado {
  tipo:
    | "cargando"
    | "datos-pendientes"
    | "fuera-año"
    | "fin-semana"
    | "evento"
    | "sin-horario"
    | "muy-temprano"
    | "entrada-activa"
    | "salida-activa"
    | "finalizado";
  titulo: string;
  descripcion: string;
  informacionExtra?: string;
  tiempoRestante?: string;
  horarioReal?: string;
  color: "gris" | "azul" | "naranja" | "rojo" | "verde" | "morado";
  icono: string;
  mostrarProgreso?: boolean;
}

// ✅ SELECTOR OPTIMIZADO
const selectHoraMinutoActual = (state: RootState) => {
  const fechaHora = state.others.fechaHoraActualReal.fechaHora;
  if (!fechaHora) return null;

  const fecha = new Date(fechaHora);

  return {
    fecha,
    hora: fecha.getHours(),
    minuto: fecha.getMinutes(),
    diaSemana: fecha.getDay(),
    diaMes: fecha.getDate(),
    mes: fecha.getMonth() + 1,
    año: fecha.getFullYear(),
  };
};

const EstadoDeAsistenciaSegunHorarioDeAsistencia = ({
  datosAsistencia, // 👈 RECIBIR DATOS COMO PROPS
}: {
  datosAsistencia: DatosAsistenciaCompartidos; // 👈 NUEVA PROP
}) => {
  // ✅ SELECTORES
  const horaMinutoActual = useSelector(selectHoraMinutoActual);
  const reduxInicializado = useSelector(
    (state: RootState) => state.others.fechaHoraActualReal.inicializado
  );

  // ✅ EXTRAER DATOS DEL HOOK COMPARTIDO
  const { horario, handlerBase, asistencia, inicializado } = datosAsistencia;

  // ✅ FUNCIÓN: Calcular tiempo restante
  const calcularTiempoRestante = useCallback(
    (fechaObjetivo: Date): string => {
      if (!reduxInicializado) return "Calculando...";

      const fechaHoraRedux =
        store.getState?.()?.others?.fechaHoraActualReal?.fechaHora;
      if (!fechaHoraRedux) return "Calculando...";

      const fechaActual = new Date(fechaHoraRedux);

      const diff =
        fechaObjetivo.getTime() - fechaActual.getTime() + 5 * 60 * 60 * 1000;
      if (diff <= 0) return "00:00:00";

      const horas = Math.floor(diff / (1000 * 60 * 60));
      const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const segundos = Math.floor((diff % (1000 * 60)) / 1000);

      return `${horas.toString().padStart(2, "0")}:${minutos
        .toString()
        .padStart(2, "0")}:${segundos.toString().padStart(2, "0")}`;
    },
    [reduxInicializado]
  );

  // ✅ FUNCIÓN: Determinar estado detallado (SIN CONSULTAS PROPIAS)
  const determinarEstadoDetallado =
    useCallback((): EstadoAsistenciaDetallado => {
      if (!reduxInicializado || !inicializado) {
        return {
          tipo: "cargando",
          titulo: "Cargando información...",
          descripcion: "Obteniendo datos del sistema",
          color: "gris",
          icono: "⏳",
        };
      }

      if (!horaMinutoActual) {
        return {
          tipo: "cargando",
          titulo: "Sincronizando hora...",
          descripcion: "Esperando sincronización de fecha y hora",
          color: "gris",
          icono: "🕐",
        };
      }

      // ✅ 1. Verificar si estamos en período de actualización de datos
      if (horaMinutoActual.hora < HORA_ACTUALIZACION_DATOS_ASISTENCIA_DIARIOS) {
        console.log(
          "c% LA HORA ES " + horaMinutoActual.hora,
          "font-size:2rem; color:cyan"
        );
        return {
          tipo: "datos-pendientes",
          titulo: "Sistema actualizando datos",
          descripcion: `Los datos se están actualizando para el día de hoy`,
          informacionExtra: `Disponible a partir de las ${HORA_ACTUALIZACION_DATOS_ASISTENCIA_DIARIOS}:00 AM`,
          color: "azul",
          icono: "🔄",
        };
      }

      // ✅ 2. Verificar fuera del año escolar
      if (handlerBase?.estaFueraDeAnioEscolar()) {
        return {
          tipo: "fuera-año",
          titulo: "Fuera del período escolar",
          descripcion: "No se registra asistencia fuera del año académico",
          informacionExtra:
            "El año escolar inicia en marzo y finaliza en diciembre",
          color: "rojo",
          icono: "📅",
        };
      }

      // ✅ 3. Verificar día de evento
      const eventoHoy = handlerBase?.esHoyDiaDeEvento();
      if (eventoHoy) {
        return {
          tipo: "evento",
          titulo: `Día de ${eventoHoy.Nombre}`,
          descripcion: "Día no laboral - No se registra asistencia",
          informacionExtra: `Evento programado del ${new Date(
            eventoHoy.Fecha_Inicio
          ).toLocaleDateString()} al ${new Date(
            eventoHoy.Fecha_Conclusion
          ).toLocaleDateString()}`,
          color: "morado",
          icono: "🎉",
        };
      }

      // ✅ 4. Verificar fin de semana
      if (
        horaMinutoActual.diaSemana === 0 ||
        horaMinutoActual.diaSemana === 6
      ) {
        const diaNombre =
          horaMinutoActual.diaSemana === 0 ? "domingo" : "sábado";
        return {
          tipo: "fin-semana",
          titulo: `Hoy es ${diaNombre}`,
          descripcion: "Día no laboral - No se registra asistencia",
          informacionExtra:
            "El registro estará disponible el próximo día hábil",
          color: "gris",
          icono: "🏠",
        };
      }

      // ✅ 5. Verificar si no hay horario
      if (!horario) {
        return {
          tipo: "sin-horario",
          titulo: "No tienes horario hoy",
          descripcion: "No debes asistir al colegio el día de hoy",
          informacionExtra: "Tu horario laboral no incluye este día",
          color: "gris",
          icono: "📋",
        };
      }

      // ✅ 6. Usar el modoActual calculado por el hook compartido
      const { modoActual } = datosAsistencia;

      if (!reduxInicializado) {
        return {
          tipo: "cargando",
          titulo: "Procesando horario...",
          descripcion: "Calculando estado actual",
          color: "gris",
          icono: "⏳",
        };
      }

      const horarioRealTexto = `${formatearISOaFormato12Horas(
        String(horario.Inicio)
      )} - ${formatearISOaFormato12Horas(String(horario.Fin))}`;

      // ✅ 7. Evaluar según el modo actual calculado por el hook
      if (!modoActual.activo) {
        if (modoActual.razon.includes("Muy temprano")) {
          // Calcular tiempo para activación
          const horarioInicio = new Date(horario.Inicio);
          const fechaActual = new Date(
            String(store.getState().others.fechaHoraActualReal.fechaHora)
          );

          const inicioHoy = new Date(fechaActual);
          inicioHoy.setHours(
            horarioInicio.getHours(),
            horarioInicio.getMinutes(),
            0,
            0
          );

          const unaHoraAntesInicio = new Date(
            inicioHoy.getTime() - HORAS_ANTES_INICIO_ACTIVACION * 60 * 60 * 1000
          );
          const tiempoRestante = calcularTiempoRestante(unaHoraAntesInicio);

          return {
            tipo: "muy-temprano",
            titulo: "Muy temprano para registrar",
            descripcion: `Tu registro se activará ${HORAS_ANTES_INICIO_ACTIVACION} hora antes de tu horario laboral`,
            informacionExtra: `Horario laboral: ${horarioRealTexto}`,
            tiempoRestante: `Activación en: ${tiempoRestante}`,
            horarioReal: horarioRealTexto,
            color: "naranja",
            icono: "⏰",
            mostrarProgreso: true,
          };
        } else {
          return {
            tipo: "finalizado",
            titulo: "Período de registro finalizado",
            descripcion: "Ya no puedes registrar tu asistencia de hoy",
            informacionExtra: `El registro cerró ${HORAS_DESPUES_SALIDA_LIMITE} horas después de tu horario de salida`,
            horarioReal: horarioRealTexto,
            color: "rojo",
            icono: "🔒",
          };
        }
      }

      // ✅ 8. Períodos activos usando datos del hook compartido
      if (modoActual.tipo === ModoRegistro.Entrada) {
        const yaRegistroEntrada =
          asistencia.inicializado && asistencia.entradaMarcada;

        // Calcular tiempo hasta cambio a salida
        const horarioFin = new Date(horario.Fin);
        const fechaActual = new Date(
          String(store.getState().others.fechaHoraActualReal.fechaHora)
        );

        const finHoy = new Date(fechaActual);
        finHoy.setHours(horarioFin.getHours(), horarioFin.getMinutes(), 0, 0);

        const unaHoraAntesSalida = new Date(
          finHoy.getTime() - HORAS_ANTES_SALIDA_CAMBIO_MODO * 60 * 60 * 1000
        );
        const tiempoHastaSalida = calcularTiempoRestante(unaHoraAntesSalida);

        return {
          tipo: "entrada-activa",
          titulo: yaRegistroEntrada
            ? "✅ ENTRADA ya registrada"
            : "🟢 Puedes registrar tu ENTRADA",
          descripcion: yaRegistroEntrada
            ? "Tu entrada ha sido registrada exitosamente"
            : "El sistema está activo para marcar tu llegada",
          informacionExtra: `Cambiará a modo salida ${HORAS_ANTES_SALIDA_CAMBIO_MODO} hora antes de tu salida`,
          tiempoRestante: `Cambio a salida en: ${tiempoHastaSalida}`,
          horarioReal: horarioRealTexto,
          color: yaRegistroEntrada ? "azul" : "verde",
          icono: yaRegistroEntrada ? "✅" : "🟢",
          mostrarProgreso: true,
        };
      }

      if (modoActual.tipo === ModoRegistro.Salida) {
        const yaRegistroSalida =
          asistencia.inicializado && asistencia.salidaMarcada;

        // Calcular tiempo hasta cierre
        const horarioFin = new Date(horario.Fin);
        const fechaActual = new Date(
          String(store.getState().others.fechaHoraActualReal.fechaHora)
        );

        const finHoy = new Date(fechaActual);
        finHoy.setHours(horarioFin.getHours(), horarioFin.getMinutes(), 0, 0);

        const dosHorasDespuesSalida = new Date(
          finHoy.getTime() + HORAS_DESPUES_SALIDA_LIMITE * 60 * 60 * 1000
        );
        const tiempoHastaCierre = calcularTiempoRestante(dosHorasDespuesSalida);

        return {
          tipo: "salida-activa",
          titulo: yaRegistroSalida
            ? "✅ SALIDA ya registrada"
            : "🔴 Puedes registrar tu SALIDA",
          descripcion: yaRegistroSalida
            ? "Tu salida ha sido registrada exitosamente"
            : "El sistema está activo para marcar tu salida",
          informacionExtra: `El registro se cerrará ${HORAS_DESPUES_SALIDA_LIMITE} horas después de tu horario de salida`,
          tiempoRestante: `Cierre en: ${tiempoHastaCierre}`,
          horarioReal: horarioRealTexto,
          color: yaRegistroSalida ? "azul" : "verde",
          icono: yaRegistroSalida ? "✅" : "🔴",
          mostrarProgreso: true,
        };
      }

      // ✅ Default fallback
      return {
        tipo: "cargando",
        titulo: "Procesando estado...",
        descripcion: "Calculando información actual",
        color: "gris",
        icono: "🔄",
      };
    }, [
      reduxInicializado,
      inicializado,
      horaMinutoActual,
      handlerBase,
      horario,
      datosAsistencia,
      asistencia,
      calcularTiempoRestante,
    ]);

  // ✅ FUNCIÓN: Formatear fecha actual
  const formatearFechaActual = useCallback((): string => {
    if (!horaMinutoActual) return "Cargando fecha...";

    const diaSemana =
      diasSemanaTextos[horaMinutoActual.diaSemana as DiasSemana];
    const mes = mesesTextos[horaMinutoActual.mes as Meses];

    return `${diaSemana}, ${horaMinutoActual.diaMes} de ${mes} de ${horaMinutoActual.año}`;
  }, [horaMinutoActual]);

  // ✅ FUNCIÓN: Generar mensaje minimalista
  const generarMensajeMinimalista = useCallback((): string => {
    if (!reduxInicializado || !inicializado) return "⏳ Cargando...";
    if (!horaMinutoActual) return "🕐 Sincronizando...";

    const estadoActual = determinarEstadoDetallado();

    switch (estadoActual.tipo) {
      case "datos-pendientes":
        return `🔄 Actualizando datos (hasta ${HORA_ACTUALIZACION_DATOS_ASISTENCIA_DIARIOS}:00 AM)`;
      case "fuera-año":
        return "📅 Fuera del período escolar";
      case "evento":
        const evento = handlerBase?.esHoyDiaDeEvento();
        return `🎉 ${
          (evento as T_Eventos).Nombre || "Día de evento"
        } - No laboral`;
      case "fin-semana":
        const dia = horaMinutoActual.diaSemana === 0 ? "Domingo" : "Sábado";
        return `🏠 ${dia} - No laboral`;
      case "sin-horario":
        return "📋 No tienes horario hoy";
      case "muy-temprano":
        return `⏰ Activación en: ${estadoActual.tiempoRestante?.replace(
          "Activación en: ",
          ""
        )} | Horario: ${estadoActual.horarioReal}`;
      case "entrada-activa":
        const yaEntrada = asistencia.inicializado && asistencia.entradaMarcada;
        return yaEntrada
          ? `✅ ENTRADA registrada | ${estadoActual.tiempoRestante?.replace(
              "Cambio a salida en: ",
              "Cambio en: "
            )} | ${estadoActual.horarioReal}`
          : `🟢 ENTRADA disponible | ${estadoActual.tiempoRestante?.replace(
              "Cambio a salida en: ",
              "Cambio en: "
            )} | ${estadoActual.horarioReal}`;
      case "salida-activa":
        const yaSalida = asistencia.inicializado && asistencia.salidaMarcada;
        return yaSalida
          ? `✅ SALIDA registrada | ${estadoActual.tiempoRestante?.replace(
              "Cierre en: ",
              "Cierre en: "
            )} | ${estadoActual.horarioReal}`
          : `🔴 SALIDA disponible | ${estadoActual.tiempoRestante?.replace(
              "Cierre en: ",
              "Cierre en: "
            )} | ${estadoActual.horarioReal}`;
      case "finalizado":
        return `🔒 Registro cerrado | Horario: ${estadoActual.horarioReal}`;
      default:
        return "🔄 Procesando estado...";
    }
  }, [
    reduxInicializado,
    inicializado,
    horaMinutoActual,
    determinarEstadoDetallado,
    handlerBase,
    asistencia,
  ]);

  // ✅ FUNCIÓN: Obtener clases CSS por color
  const obtenerClasesColor = (color: EstadoAsistenciaDetallado["color"]) => {
    switch (color) {
      case "verde":
        return {
          fondo: "bg-green-50 border-green-200",
          titulo: "text-green-800",
          descripcion: "text-green-700",
          extra: "text-green-600",
          tiempo: "text-green-800 bg-green-100",
        };
      case "naranja":
        return {
          fondo: "bg-orange-50 border-orange-200",
          titulo: "text-orange-800",
          descripcion: "text-orange-700",
          extra: "text-orange-600",
          tiempo: "text-orange-800 bg-orange-100",
        };
      case "rojo":
        return {
          fondo: "bg-red-50 border-red-200",
          titulo: "text-red-800",
          descripcion: "text-red-700",
          extra: "text-red-600",
          tiempo: "text-red-800 bg-red-100",
        };
      case "azul":
        return {
          fondo: "bg-blue-50 border-blue-200",
          titulo: "text-blue-800",
          descripcion: "text-blue-700",
          extra: "text-blue-600",
          tiempo: "text-blue-800 bg-blue-100",
        };
      case "morado":
        return {
          fondo: "bg-purple-50 border-purple-200",
          titulo: "text-purple-800",
          descripcion: "text-purple-700",
          extra: "text-purple-600",
          tiempo: "text-purple-800 bg-purple-100",
        };
      default: // gris
        return {
          fondo: "bg-gray-50 border-gray-200",
          titulo: "text-gray-800",
          descripcion: "text-gray-700",
          extra: "text-gray-600",
          tiempo: "text-gray-800 bg-gray-100",
        };
    }
  };

  // ✅ OBTENER ESTADO ACTUAL
  const estadoActual = determinarEstadoDetallado();
  const clases = obtenerClasesColor(estadoActual.color);

  // ✅ VERSIÓN MINIMALISTA
  if (VERSION_MINIMALISTA) {
    return (
      <div
        className={`border-0 border-bottom border-[rgba(0,0,0,0.1)] flex items-center justify-center p-3 text-[0.8rem] ${clases.fondo} transition-all duration-300`}
      >
        <div className="text-center">
          <p className={`${clases.titulo} font-medium leading-tight`}>
            {generarMensajeMinimalista()}
          </p>
          {(estadoActual.tipo === "entrada-activa" ||
            estadoActual.tipo === "salida-activa" ||
            estadoActual.tipo === "muy-temprano") && (
            <p className="text-xs text-gray-500 mt-1">
              {formatearFechaActual()}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ✅ VERSIÓN COMPLETA (omitida por brevedad, es igual que antes pero usando datosAsistencia)
  return (
    <div
      className={`border border-gray-200 rounded-lg p-4 ${clases.fondo} transition-all duration-300`}
    >
      {/* Resto del componente igual que antes */}
    </div>
  );
};

export default EstadoDeAsistenciaSegunHorarioDeAsistencia;
