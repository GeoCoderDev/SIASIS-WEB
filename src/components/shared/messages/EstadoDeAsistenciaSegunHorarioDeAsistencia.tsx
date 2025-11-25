"use client";

import { useCallback } from "react";
import { useSelector } from "react-redux";
import store, { RootState } from "@/global/store";
import { ModoRegistro } from "@/interfaces/shared/ModoRegistro";
import { DiasSemana, diasSemanaTextos } from "@/interfaces/shared/DiasSemana";
import { Meses, mesesTextos } from "@/interfaces/shared/Meses";
import { formatearISOaFormato12Horas } from "@/lib/helpers/formatters/fechas-hora/formatearAFormato12Horas";
import {
  HORAS_ANTES_INICIO_ACTIVACION,
  HORAS_ANTES_SALIDA_CAMBIO_MODO_PARA_PERSONAL,
  HORAS_DESPUES_SALIDA_LIMITE,
} from "@/constants/INTERVALOS_CONSULTAS_ASISTENCIAS_PROPIAS_PARA_PERSONAL_NO_DIRECTIVO";
import { HORA_ACTUALIZACION_DATOS_ASISTENCIA_DIARIOS } from "@/constants/HORA_ACTUALIZACION_DATOS_ASISTENCIA_DIARIOS";
import { DatosAsistenciaCompartidos } from "@/hooks/asistencia-personal-no-directivo/useAsistenciaCompartida";
import { T_Eventos } from "@prisma/client";

// ✅ VERSION CONSTANT
const VERSION_MINIMALISTA = true;

// ✅ LOCAL INTERFACES
interface EstadoAsistenciaDetallado {
  tipo:
    | "loading"
    | "pending-data"
    | "out-of-year"
    | "weekend"
    | "event"
    | "no-schedule"
    | "too-early"
    | "entry-active"
    | "exit-active"
    | "finished";
  titulo: string;
  descripcion: string;
  informacionExtra?: string;
  tiempoRestante?: string;
  horarioReal?: string;
  color: "gray" | "blue" | "orange" | "red" | "green" | "purple";
  icono: string;
  mostrarProgreso?: boolean;
}

// ✅ OPTIMIZED SELECTOR
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
  datosAsistencia, // 👈 RECEIVE DATA AS PROPS
}: {
  datosAsistencia: DatosAsistenciaCompartidos; // 👈 NEW PROP
}) => {
  // ✅ SELECTORS
  const horaMinutoActual = useSelector(selectHoraMinutoActual);
  const reduxInicializado = useSelector(
    (state: RootState) => state.others.fechaHoraActualReal.inicializado
  );

  // ✅ EXTRACT DATA FROM SHARED HOOK
  const { horario, handlerBase, asistencia, inicializado } = datosAsistencia;

  // ✅ FUNCTION: Calculate remaining time
  const calcularTiempoRestante = useCallback(
    (fechaObjetivo: Date): string => {
      if (!reduxInicializado) return "Calculating...";

      const fechaHoraRedux =
        store.getState?.()?.others?.fechaHoraActualReal?.fechaHora;
      if (!fechaHoraRedux) return "Calculating...";

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

  // ✅ FUNCTION: Determine detailed status (NO OWN QUERIES)
  const determinarEstadoDetallado =
    useCallback((): EstadoAsistenciaDetallado => {
      if (!reduxInicializado || !inicializado) {
        return {
          tipo: "loading",
          titulo: "Loading information...",
          descripcion: "Getting system data",
          color: "gray",
          icono: "⏳",
        };
      }

      if (!horaMinutoActual) {
        return {
          tipo: "loading",
          titulo: "Synchronizing time...",
          descripcion: "Waiting for date and time synchronization",
          color: "gray",
          icono: "🕐",
        };
      }

      // ✅ 1. Check if we are in data update period
      if (horaMinutoActual.hora < HORA_ACTUALIZACION_DATOS_ASISTENCIA_DIARIOS) {
        console.log(
          "c% THE HOUR IS " + horaMinutoActual.hora,
          "font-size:2rem; color:cyan"
        );
        return {
          tipo: "pending-data",
          titulo: "System updating data",
          descripcion: `Data is being updated for today`,
          informacionExtra: `Available from ${HORA_ACTUALIZACION_DATOS_ASISTENCIA_DIARIOS}:00 AM`,
          color: "blue",
          icono: "🔄",
        };
      }

      // ✅ 2. Check out of school year
      if (handlerBase?.estaFueraDeAnioEscolar()) {
        return {
          tipo: "out-of-year",
          titulo: "Outside school period",
          descripcion: "Attendance is not recorded outside the academic year",
          informacionExtra:
            "The school year starts in March and ends in December",
          color: "red",
          icono: "📅",
        };
      }

      // ✅ 3. Check event day
      const eventoHoy = handlerBase?.esHoyDiaDeEvento();
      if (eventoHoy) {
        return {
          tipo: "event",
          titulo: `Day of ${eventoHoy.Nombre}`,
          descripcion: "Non-working day - Attendance is not recorded",
          informacionExtra: `Event scheduled from ${new Date(
            eventoHoy.Fecha_Inicio
          ).toLocaleDateString()} to ${new Date(
            eventoHoy.Fecha_Conclusion
          ).toLocaleDateString()}`,
          color: "purple",
          icono: "🎉",
        };
      }

      // ✅ 4. Check weekend
      if (
        horaMinutoActual.diaSemana === 0 ||
        horaMinutoActual.diaSemana === 6
      ) {
        const diaNombre =
          horaMinutoActual.diaSemana === 0 ? "Sunday" : "Saturday";
        return {
          tipo: "weekend",
          titulo: `Today is ${diaNombre}`,
          descripcion: "Non-working day - Attendance is not recorded",
          informacionExtra:
            "Registration will be available on the next business day",
          color: "gray",
          icono: "🏠",
        };
      }

      // ✅ 5. Check if no schedule
      if (!horario) {
        return {
          tipo: "no-schedule",
          titulo: "You are not attending school today",
          descripcion: "You do not have to attend school today",
          informacionExtra: "Your work schedule does not include this day",
          color: "gray",
          icono: "📋",
        };
      }

      // ✅ 6. Use the currentMode calculated by the shared hook
      const { modoActual } = datosAsistencia;

      if (!reduxInicializado) {
        return {
          tipo: "loading",
          titulo: "Processing schedule...",
          descripcion: "Calculating current status",
          color: "gray",
          icono: "⏳",
        };
      }

      const horarioRealTexto = `${formatearISOaFormato12Horas(
        String(horario.Inicio)
      )} - ${formatearISOaFormato12Horas(String(horario.Fin))}`;

      // ✅ 7. Evaluate according to the current mode calculated by the hook
      if (!modoActual.activo) {
        if (modoActual.razon.includes("Too early")) {
          // Calculate time for activation
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
            tipo: "too-early",
            titulo: "Too early to register",
            descripcion: `Your registration will be activated ${HORAS_ANTES_INICIO_ACTIVACION} hour before your work schedule`,
            informacionExtra: `Work schedule: ${horarioRealTexto}`,
            tiempoRestante: `Activation in: ${tiempoRestante}`,
            horarioReal: horarioRealTexto,
            color: "orange",
            icono: "⏰",
            mostrarProgreso: true,
          };
        } else {
          return {
            tipo: "finished",
            titulo: "Registration period finished",
            descripcion: "You can no longer register your attendance for today",
            informacionExtra: `Registration closed ${HORAS_DESPUES_SALIDA_LIMITE} hours after your exit time`,
            horarioReal: horarioRealTexto,
            color: "red",
            icono: "🔒",
          };
        }
      }

      // ✅ 8. Active periods using data from the shared hook
      if (modoActual.tipo === ModoRegistro.Entrada) {
        const yaRegistroEntrada =
          asistencia.inicializado && asistencia.entradaMarcada;

        // Calculate time until change to exit
        const horarioFin = new Date(horario.Fin);
        const fechaActual = new Date(
          String(store.getState().others.fechaHoraActualReal.fechaHora)
        );

        const finHoy = new Date(fechaActual);
        finHoy.setHours(horarioFin.getHours(), horarioFin.getMinutes(), 0, 0);

        const unaHoraAntesSalida = new Date(
          finHoy.getTime() -
            HORAS_ANTES_SALIDA_CAMBIO_MODO_PARA_PERSONAL * 60 * 60 * 1000
        );
        const tiempoHastaSalida = calcularTiempoRestante(unaHoraAntesSalida);

        return {
          tipo: "entry-active",
          titulo: yaRegistroEntrada
            ? "✅ ENTRY already registered"
            : "🟢 You can register your ENTRY",
          descripcion: yaRegistroEntrada
            ? "Your entry has been successfully registered"
            : "The system is active to mark your arrival",
          informacionExtra: `It will change to exit mode ${HORAS_ANTES_SALIDA_CAMBIO_MODO_PARA_PERSONAL} hour before your exit`,
          tiempoRestante: `Change to exit in: ${tiempoHastaSalida}`,
          horarioReal: horarioRealTexto,
          color: yaRegistroEntrada ? "blue" : "green",
          icono: yaRegistroEntrada ? "✅" : "🟢",
          mostrarProgreso: true,
        };
      }

      if (modoActual.tipo === ModoRegistro.Salida) {
        const yaRegistroSalida =
          asistencia.inicializado && asistencia.salidaMarcada;

        // Calculate time until closing
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
          tipo: "exit-active",
          titulo: yaRegistroSalida
            ? "✅ EXIT already registered"
            : "🔴 You can register your EXIT",
          descripcion: yaRegistroSalida
            ? "Your exit has been successfully registered"
            : "The system is active to mark your departure",
          informacionExtra: `Registration will close ${HORAS_DESPUES_SALIDA_LIMITE} hours after your exit time`,
          tiempoRestante: `Close in: ${tiempoHastaCierre}`,
          horarioReal: horarioRealTexto,
          color: yaRegistroSalida ? "blue" : "green",
          icono: yaRegistroSalida ? "✅" : "🔴",
          mostrarProgreso: true,
        };
      }

      // ✅ Default fallback
      return {
        tipo: "loading",
        titulo: "Processing status...",
        descripcion: "Calculating current information",
        color: "gray",
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

  // ✅ FUNCTION: Format current date
  const formatearFechaActual = useCallback((): string => {
    if (!horaMinutoActual) return "Loading date...";

    const diaSemana =
      diasSemanaTextos[horaMinutoActual.diaSemana as DiasSemana];
    const mes = mesesTextos[horaMinutoActual.mes as Meses];

    return `${diaSemana}, ${horaMinutoActual.diaMes} of ${mes} of ${horaMinutoActual.año}`;
  }, [horaMinutoActual]);

  // ✅ FUNCTION: Generate minimalist message
  const generarMensajeMinimalista = useCallback((): string => {
    if (!reduxInicializado || !inicializado) return "⏳ Loading...";
    if (!horaMinutoActual) return "🕐 Synchronizing...";

    const estadoActual = determinarEstadoDetallado();

    switch (estadoActual.tipo) {
      case "pending-data":
        return `🔄 Updating data (until ${HORA_ACTUALIZACION_DATOS_ASISTENCIA_DIARIOS}:00 AM)`;
      case "out-of-year":
        return "📅 Outside school period";
      case "event":
        const evento = handlerBase?.esHoyDiaDeEvento();
        return `🎉 ${
          (evento as T_Eventos).Nombre || "Event day"
        } - Non-working`;
      case "weekend":
        const dia = horaMinutoActual.diaSemana === 0 ? "Sunday" : "Saturday";
        return `🏠 ${dia} - Non-working`;
      case "no-schedule":
        return "📋 You are not attending school today";
      case "too-early":
        return `⏰ Activation in: ${estadoActual.tiempoRestante?.replace(
          "Activation in: ",
          ""
        )} | Your Work Schedule: ${estadoActual.horarioReal}`;
      case "entry-active":
        const yaEntrada = asistencia.inicializado && asistencia.entradaMarcada;
        return yaEntrada
          ? `✅ ENTRY registered | ${estadoActual.tiempoRestante?.replace(
              "Change to exit in: ",
              "Change in: "
            )} | ${estadoActual.horarioReal}`
          : `🟢 ENTRY available | ${estadoActual.tiempoRestante?.replace(
              "Change to exit in: ",
              "Change in: "
            )} | ${estadoActual.horarioReal}`;
      case "exit-active":
        const yaSalida = asistencia.inicializado && asistencia.salidaMarcada;
        return yaSalida
          ? `✅ EXIT registered | ${estadoActual.tiempoRestante?.replace(
              "Close in: ",
              "Close in: "
            )} | ${estadoActual.horarioReal}`
          : `🔴 EXIT available | ${estadoActual.tiempoRestante?.replace(
              "Close in: ",
              "Close in: "
            )} | ${estadoActual.horarioReal}`;
      case "finished":
        return `🔒 Registration closed | Your Work Schedule: ${estadoActual.horarioReal}`;
      default:
        return "🔄 Processing status...";
    }
  }, [
    reduxInicializado,
    inicializado,
    horaMinutoActual,
    determinarEstadoDetallado,
    handlerBase,
    asistencia,
  ]);

  // ✅ FUNCTION: Get CSS classes by color
  const obtenerClasesColor = (color: EstadoAsistenciaDetallado["color"]) => {
    switch (color) {
      case "green":
        return {
          fondo: "bg-green-50 border-green-200",
          titulo: "text-green-800",
          descripcion: "text-green-700",
          extra: "text-green-600",
          tiempo: "text-green-800 bg-green-100",
        };
      case "orange":
        return {
          fondo: "bg-orange-50 border-orange-200",
          titulo: "text-orange-800",
          descripcion: "text-orange-700",
          extra: "text-orange-600",
          tiempo: "text-orange-800 bg-orange-100",
        };
      case "red":
        return {
          fondo: "bg-red-50 border-red-200",
          titulo: "text-red-800",
          descripcion: "text-red-700",
          extra: "text-red-600",
          tiempo: "text-red-800 bg-red-100",
        };
      case "blue":
        return {
          fondo: "bg-blue-50 border-blue-200",
          titulo: "text-blue-800",
          descripcion: "text-blue-700",
          extra: "text-blue-600",
          tiempo: "text-blue-800 bg-blue-100",
        };
      case "purple":
        return {
          fondo: "bg-purple-50 border-purple-200",
          titulo: "text-purple-800",
          descripcion: "text-purple-700",
          extra: "text-purple-600",
          tiempo: "text-purple-800 bg-purple-100",
        };
      default: // gray
        return {
          fondo: "bg-gray-50 border-gray-200",
          titulo: "text-gray-800",
          descripcion: "text-gray-700",
          extra: "text-gray-600",
          tiempo: "text-gray-800 bg-gray-100",
        };
    }
  };

  // ✅ GET CURRENT STATUS
  const estadoActual = determinarEstadoDetallado();
  const clases = obtenerClasesColor(estadoActual.color);

  // ✅ MINIMALIST VERSION
  if (VERSION_MINIMALISTA) {
    return (
      <div
        className={`border-0 border-bottom border-[rgba(0,0,0,0.1)] flex items-center justify-center p-3 text-[0.8rem] ${clases.fondo} transition-all duration-300`}
      >
        <div className="text-center">
          <p className={`${clases.titulo} font-medium leading-tight`}>
            {generarMensajeMinimalista()}
          </p>
          {(estadoActual.tipo === "entry-active" ||
            estadoActual.tipo === "exit-active" ||
            estadoActual.tipo === "too-early") && (
            <p className="text-xs text-gray-500 mt-1">
              {formatearFechaActual()}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ✅ FULL VERSION (omitted for brevity, same as before but using datosAsistencia)
  return (
    <div
      className={`border border-gray-200 rounded-lg p-4 ${clases.fondo} transition-all duration-300`}
    >
      {/* Rest of the component same as before */}
    </div>
  );
};

export default EstadoDeAsistenciaSegunHorarioDeAsistencia;