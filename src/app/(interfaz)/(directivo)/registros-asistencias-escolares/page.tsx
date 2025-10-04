"use client";
import React, { useEffect, useState } from "react";
import { T_Aulas, T_Estudiantes } from "@prisma/client";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";
import { EstadosAsistenciaEscolar } from "@/interfaces/shared/EstadosAsistenciaEstudiantes";
import { BaseAulasIDB } from "@/lib/utils/local/db/models/Aulas/AulasBase";
import { BaseEstudiantesIDB } from "@/lib/utils/local/db/models/Estudiantes/EstudiantesBaseIDB";
import {
  ErrorResponseAPIBase,
  MessageProperty,
} from "@/interfaces/shared/apis/types";
import Loader from "@/components/shared/loaders/Loader";

import { MESES } from "../../(responsable)/mis-estudiantes-relacionados/[Id_Estudiante]/asistencias-mensuales/types";
import { AsistenciaEscolarDeUnDia } from "@/interfaces/shared/AsistenciasEscolares";

import {
  EventosIDB,
  IEventoLocal,
} from "@/lib/utils/local/db/models/EventosLocal/EventosIDB";
import { AsistenciasEscolaresPorAulaParaDirectivosIDB } from "@/lib/utils/local/db/models/AsistenciasEscolares/Para Directivos/AsistenciasEscolaresPorAulaParaDirectivosIDB";
import FiltrosConsultaAsistencias from "@/components/asistencias-escolares/por-aula/FiltrosConsultaAsistencias";
import MensajesNotificacion from "@/components/asistencias-escolares/por-aula/MensajeNotificacion";
import TablaAsistenciasEscolares from "@/components/asistencias-escolares/por-aula/TablaAsistenciasEscolares";

export interface EstudianteConAsistencias {
  estudiante: T_Estudiantes;
  asistencias: Record<number, EstadosAsistenciaEscolar>;
  totales: {
    asistencias: number;
    tardanzas: number;
    faltas: number;
    inactivos: number;
  };
}

export interface DatosTablaAsistencias {
  aula: T_Aulas;
  mes: number;
  estudiantes: EstudianteConAsistencias[];
  diasDelMes: Array<{ dia: number; diaSemana: string }>;
  fechaConsulta: string;
}

const RegistrosAsistenciasEscolares = () => {
  // Estados temporales (antes de consultar)
  const [nivelTemporal, setNivelTemporal] = useState<NivelEducativo | "">("");
  const [gradoTemporal, setGradoTemporal] = useState<number | "">("");
  const [seccionTemporal, setSeccionTemporal] = useState<string>("");
  const [mesTemporal, setMesTemporal] = useState<number>(
    new Date().getMonth() + 1
  );

  // Estados confirmados (después de consultar)
  const [nivelSeleccionado, setNivelSeleccionado] = useState<
    NivelEducativo | ""
  >("");
  const [gradoSeleccionado, setGradoSeleccionado] = useState<number | "">("");
  const [seccionSeleccionada, setSeccionSeleccionada] = useState<string>("");
  const [mesSeleccionado, setMesSeleccionado] = useState<number>(
    new Date().getMonth() + 1
  );

  // Estados de UI
  const [gradosDisponibles, setGradosDisponibles] = useState<number[]>([]);
  const [seccionesDisponibles, setSeccionesDisponibles] = useState<string[]>(
    []
  );
  const [aulaSeleccionada, setAulaSeleccionada] = useState<T_Aulas | null>(
    null
  );
  const [datosTabla, setDatosTabla] = useState<DatosTablaAsistencias | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [loadingEventos, setLoadingEventos] = useState(false);
  const [eventos, setEventos] = useState<IEventoLocal[]>([]);
  const [error, setError] = useState<ErrorResponseAPIBase | null>(null);
  const [successMessage, setSuccessMessage] = useState<MessageProperty | null>(
    null
  );

  // Instancias de modelos
  const [aulasIDB] = useState(() => new BaseAulasIDB());
  const [estudiantesIDB] = useState(() => new BaseEstudiantesIDB());
  const [asistenciasIDB] = useState(
    () =>
      new AsistenciasEscolaresPorAulaParaDirectivosIDB(
        setIsLoading,
        setError,
        setSuccessMessage
      )
  );

  // Cargar grados cuando cambia el nivel
  useEffect(() => {
    if (nivelTemporal) {
      cargarGradosDisponibles(nivelTemporal);
    } else {
      setGradosDisponibles([]);
      setGradoTemporal("");
    }
  }, [nivelTemporal]);

  // Cargar secciones cuando cambia el grado
  useEffect(() => {
    if (nivelTemporal && gradoTemporal) {
      cargarSeccionesDisponibles(nivelTemporal, gradoTemporal);
    } else {
      setSeccionesDisponibles([]);
      setSeccionTemporal("");
    }
  }, [nivelTemporal, gradoTemporal]);

  // Cargar aula cuando cambian los filtros seleccionados
  useEffect(() => {
    if (nivelSeleccionado && gradoSeleccionado && seccionSeleccionada) {
      cargarAulaSeleccionada();
    } else {
      setAulaSeleccionada(null);
      setDatosTabla(null);
    }
  }, [nivelSeleccionado, gradoSeleccionado, seccionSeleccionada]);

  // Cargar asistencias cuando cambia el aula o mes
  useEffect(() => {
    if (aulaSeleccionada && mesSeleccionado) {
      cargarAsistenciasAula();
    } else {
      setDatosTabla(null);
    }
  }, [aulaSeleccionada, mesSeleccionado]);

  const cargarGradosDisponibles = async (nivel: NivelEducativo) => {
    try {
      const todasLasAulas = await aulasIDB.getTodasLasAulas();
      const aulasDelNivel = todasLasAulas.filter(
        (aula) => aula.Nivel === nivel
      );
      const gradosUnicos = [
        ...new Set(aulasDelNivel.map((aula) => aula.Grado)),
      ].sort();
      setGradosDisponibles(gradosUnicos);
    } catch (error) {
      console.error("Error cargando grados:", error);
    }
  };

  const cargarSeccionesDisponibles = async (
    nivel: NivelEducativo,
    grado: number
  ) => {
    try {
      const todasLasAulas = await aulasIDB.getTodasLasAulas();
      const aulasDelGrado = todasLasAulas.filter(
        (aula) => aula.Nivel === nivel && aula.Grado === grado
      );
      const seccionesUnicas = [
        ...new Set(aulasDelGrado.map((aula) => aula.Seccion)),
      ].sort();
      setSeccionesDisponibles(seccionesUnicas);
    } catch (error) {
      console.error("Error cargando secciones:", error);
    }
  };

  const cargarAulaSeleccionada = async () => {
    try {
      const todasLasAulas = await aulasIDB.getTodasLasAulas();
      const aula = todasLasAulas.find(
        (aula) =>
          aula.Nivel === nivelSeleccionado &&
          aula.Grado === gradoSeleccionado &&
          aula.Seccion === seccionSeleccionada
      );
      setAulaSeleccionada(aula || null);
    } catch (error) {
      console.error("Error cargando aula:", error);
    }
  };

  // Función para obtener eventos del mes
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
      return eventosDelMes;
    } catch (error) {
      console.error("Error obteniendo eventos:", error);
      return [];
    }
  };

  // Función para verificar si una fecha es un evento
  const esEvento = (
    año: number,
    mes: number,
    dia: number,
    eventosParaUsar: IEventoLocal[] = eventos
  ): { esEvento: boolean; nombreEvento?: string } => {
    const fechaConsulta = `${año}-${mes.toString().padStart(2, "0")}-${dia
      .toString()
      .padStart(2, "0")}`;

    const evento = eventosParaUsar.find((e) => {
      const fechaInicio = new Date(e.Fecha_Inicio + "T00:00:00");
      const fechaFin = new Date(e.Fecha_Conclusion + "T00:00:00");
      const fechaConsultaObj = new Date(fechaConsulta + "T00:00:00");
      return fechaConsultaObj >= fechaInicio && fechaConsultaObj <= fechaFin;
    });

    const resultado = {
      esEvento: !!evento,
      nombreEvento: evento?.Nombre,
    };

    if (resultado.esEvento) {
      console.log(
        `🎉 EVENTO DETECTADO para ${fechaConsulta}: ${resultado.nombreEvento}`
      );
    }

    return resultado;
  };

  const cargarAsistenciasAula = async () => {
    if (!aulaSeleccionada) return;

    try {
      // 1. Primero obtener eventos del mes
      console.log(`🔍 Obteniendo eventos para mes ${mesSeleccionado}...`);
      const eventosDelMes = await obtenerEventos(mesSeleccionado);
      console.log(`✅ Eventos obtenidos: ${eventosDelMes.length}`);

      // 2. Obtener estudiantes del aula
      const todosEstudiantes = await estudiantesIDB.getTodosLosEstudiantes(
        false
      );
      const estudiantesAula = todosEstudiantes.filter(
        (estudiante) =>
          estudiante.Id_Aula === aulaSeleccionada.Id_Aula && estudiante.Estado
      );

      if (estudiantesAula.length === 0) {
        setDatosTabla(null);
        setError({
          success: false,
          message: "No se encontraron estudiantes activos en esta aula",
        });
        return;
      }

      // 3. Obtener asistencias
      const resultado = await asistenciasIDB.consultarAsistenciasMensualesAula(
        aulaSeleccionada.Id_Aula,
        mesSeleccionado
      );

      if (resultado.success && resultado.data) {
        const estudiantesConAsistencias = procesarAsistenciasEstudiantes(
          estudiantesAula,
          resultado.data.Asistencias_Escolares,
          aulaSeleccionada.Nivel as NivelEducativo,
          eventosDelMes
        );

        const diasDelMes = obtenerDiasDelMes(mesSeleccionado);

        setDatosTabla({
          aula: aulaSeleccionada,
          mes: mesSeleccionado,
          estudiantes: estudiantesConAsistencias,
          diasDelMes,
          fechaConsulta: new Date().toLocaleString(),
        });

        setError(null);
      } else if (resultado.requiereEspera && resultado.data) {
        const estudiantesConAsistencias = procesarAsistenciasEstudiantes(
          estudiantesAula,
          resultado.data.Asistencias_Escolares,
          aulaSeleccionada.Nivel as NivelEducativo,
          eventosDelMes
        );

        const diasDelMes = obtenerDiasDelMes(mesSeleccionado);

        setDatosTabla({
          aula: aulaSeleccionada,
          mes: mesSeleccionado,
          estudiantes: estudiantesConAsistencias,
          diasDelMes,
          fechaConsulta: new Date().toLocaleString(),
        });

        setError(null);
      } else {
        setDatosTabla(null);
        if (!resultado.requiereEspera) {
          setError({
            success: false,
            message:
              resultado.message || "No se pudieron cargar las asistencias",
          });
        }
      }
    } catch (error) {
      console.error("Error cargando asistencias:", error);
      setError({
        success: false,
        message: "Error inesperado al cargar las asistencias",
      });
    }
  };

  const procesarAsistenciasEstudiantes = (
    estudiantes: T_Estudiantes[],
    asistenciasRaw: Record<
      string,
      Record<number, AsistenciaEscolarDeUnDia | null>
    >,
    nivel: NivelEducativo,
    eventosDelMes: IEventoLocal[]
  ): EstudianteConAsistencias[] => {
    const TOLERANCIA_SEGUNDOS_PRIMARIA = 900; // 15 minutos
    const TOLERANCIA_SEGUNDOS_SECUNDARIA = 300; // 5 minutos

    const toleranciaSegundos =
      nivel === NivelEducativo.PRIMARIA
        ? TOLERANCIA_SEGUNDOS_PRIMARIA
        : TOLERANCIA_SEGUNDOS_SECUNDARIA;

    const año = new Date().getFullYear();

    return estudiantes
      .map((estudiante) => {
        const asistenciasEstudiante =
          asistenciasRaw[estudiante.Id_Estudiante] || {};
        const asistenciasProcesadas: Record<number, EstadosAsistenciaEscolar> =
          {};

        const totales = {
          asistencias: 0,
          tardanzas: 0,
          faltas: 0,
          inactivos: 0,
        };

        const diasEscolares = obtenerDiasDelMes(mesSeleccionado);
        const diasEscolaresSet = new Set(diasEscolares.map((d) => d.dia));

        for (let dia = 1; dia <= 31; dia++) {
          if (!diasEscolaresSet.has(dia)) {
            continue;
          }

          // ✅ PRIORIDAD ABSOLUTA: Verificar si es evento PRIMERO
          const eventoInfo = esEvento(año, mesSeleccionado, dia, eventosDelMes);
          if (eventoInfo.esEvento) {
            asistenciasProcesadas[dia] = EstadosAsistenciaEscolar.Evento;
            continue; // Saltar procesamiento de asistencias
          }

          const asistenciaDia = asistenciasEstudiante[dia];

          if (asistenciaDia === undefined) {
            continue;
          }

          if (asistenciaDia === null) {
            asistenciasProcesadas[dia] = EstadosAsistenciaEscolar.Inactivo;
            totales.inactivos++;
            continue;
          }

          const registroEntrada = asistenciaDia.E;
          if (!registroEntrada || registroEntrada.DesfaseSegundos === null) {
            asistenciasProcesadas[dia] = EstadosAsistenciaEscolar.Falta;
            totales.faltas++;
            continue;
          }

          if (registroEntrada.DesfaseSegundos <= toleranciaSegundos) {
            asistenciasProcesadas[dia] = EstadosAsistenciaEscolar.Temprano;
            totales.asistencias++;
          } else {
            asistenciasProcesadas[dia] = EstadosAsistenciaEscolar.Tarde;
            totales.tardanzas++;
          }
        }

        return {
          estudiante,
          asistencias: asistenciasProcesadas,
          totales,
        };
      })
      .sort((a, b) =>
        `${a.estudiante.Apellidos} ${a.estudiante.Nombres}`.localeCompare(
          `${b.estudiante.Apellidos} ${b.estudiante.Nombres}`
        )
      );
  };

  const obtenerDiasDelMes = (
    mes: number
  ): Array<{ dia: number; diaSemana: string }> => {
    const año = new Date().getFullYear();
    const diasEnMes = new Date(año, mes, 0).getDate();
    const diasEscolares: Array<{ dia: number; diaSemana: string }> = [];
    const diasSemanaTextos = ["D", "L", "M", "M", "J", "V", "S"];

    for (let dia = 1; dia <= diasEnMes; dia++) {
      const fecha = new Date(año, mes - 1, dia);
      const diaSemana = fecha.getDay();

      if (diaSemana >= 1 && diaSemana <= 5) {
        diasEscolares.push({
          dia: dia,
          diaSemana: diasSemanaTextos[diaSemana],
        });
      }
    }

    return diasEscolares;
  };

  const obtenerMesesDisponibles = () => {
    const mesActual = new Date().getMonth() + 1;
    return MESES.filter((mes) => mes.value >= 3 && mes.value <= mesActual);
  };

  const handleConsultar = () => {
    setNivelSeleccionado(nivelTemporal);
    setGradoSeleccionado(gradoTemporal);
    setSeccionSeleccionada(seccionTemporal);
    setMesSeleccionado(mesTemporal);
  };

  const limpiarFiltros = () => {
    setNivelTemporal("");
    setGradoTemporal("");
    setSeccionTemporal("");
    setMesTemporal(new Date().getMonth() + 1);
    setNivelSeleccionado("");
    setGradoSeleccionado("");
    setSeccionSeleccionada("");
    setMesSeleccionado(new Date().getMonth() + 1);
    setDatosTabla(null);
    setError(null);
    setSuccessMessage(null);
  };

  return (
    <div className="w-full h-full bg-gray-50 flex flex-col overflow-hidden">
      {/* Header - Siempre visible */}
      <div className="bg-white border-b border-gray-200 p-4 flex-shrink-0 w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          REGISTROS DE ASISTENCIA ESCOLAR
        </h1>

        <FiltrosConsultaAsistencias
          nivelTemporal={nivelTemporal}
          setNivelTemporal={setNivelTemporal}
          gradoTemporal={gradoTemporal}
          setGradoTemporal={setGradoTemporal}
          seccionTemporal={seccionTemporal}
          setSeccionTemporal={setSeccionTemporal}
          mesTemporal={mesTemporal}
          setMesTemporal={setMesTemporal}
          gradosDisponibles={gradosDisponibles}
          seccionesDisponibles={seccionesDisponibles}
          mesesDisponibles={obtenerMesesDisponibles()}
          onConsultar={handleConsultar}
          onLimpiar={limpiarFiltros}
        />

        {aulaSeleccionada && (
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg w-full mt-3">
            <div
              className="w-4 h-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: aulaSeleccionada.Color }}
            ></div>
            <span className="font-medium">
              {aulaSeleccionada.Nivel === NivelEducativo.PRIMARIA
                ? "Primaria"
                : "Secundaria"}{" "}
              - {aulaSeleccionada.Grado}° "{aulaSeleccionada.Seccion}"
            </span>
            {datosTabla && (
              <span className="text-gray-600">
                • {datosTabla.estudiantes.length} estudiantes
              </span>
            )}
          </div>
        )}
      </div>

      {/* Mensajes */}
      <MensajesNotificacion
        error={error}
        successMessage={successMessage}
        onCloseError={() => setError(null)}
        onCloseSuccess={() => setSuccessMessage(null)}
      />

      {/* Contenido principal */}
      <div className="flex-1 p-4 overflow-hidden w-full">
        <div className="h-full w-full overflow-auto">
          {isLoading ? (
            <div className="h-full flex items-center justify-center bg-white rounded-lg shadow-sm">
              <div className="text-center">
                <Loader className="w-8 h-8 mx-auto mb-4" />
                <p className="text-gray-600">Cargando datos de asistencia...</p>
              </div>
            </div>
          ) : !datosTabla ? (
            <div className="h-full bg-white rounded-lg shadow-sm p-8 flex items-center justify-center">
              <div className="text-center">
                <div className="text-gray-400 mb-4">
                  <svg
                    className="w-16 h-16 mx-auto"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Seleccione un aula y presione "Consultar"
                </h3>
                <p className="text-gray-600">
                  Use los filtros para seleccionar nivel, grado, sección y mes,
                  luego haga clic en "Consultar"
                </p>
              </div>
            </div>
          ) : (
            <TablaAsistenciasEscolares datos={datosTabla} />
          )}
        </div>
      </div>
    </div>
  );
};

export default RegistrosAsistenciasEscolares;
