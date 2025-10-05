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

import MensajesNotificacion from "@/components/asistencias-escolares/por-aula/MensajeNotificacion";
import TablaAsistenciasEscolares from "@/components/asistencias-escolares/por-aula/TablaAsistenciasEscolares";
import FiltrosConsultaAsistenciasEscolares from "@/components/asistencias-escolares/por-aula/FiltrosConsultaAsistenciasEscolares";

// Constante para controlar mensajes de éxito
const MOSTRAR_MENSAJES_EXITO = false;

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
  const [nivelTemporal, setNivelTemporal] = useState<NivelEducativo | "">("");
  const [gradoTemporal, setGradoTemporal] = useState<number | "">("");
  const [seccionTemporal, setSeccionTemporal] = useState<string>("");
  const [mesTemporal, setMesTemporal] = useState<number>(
    new Date().getMonth() + 1
  );

  const [nivelSeleccionado, setNivelSeleccionado] = useState<
    NivelEducativo | ""
  >("");
  const [gradoSeleccionado, setGradoSeleccionado] = useState<number | "">("");
  const [seccionSeleccionada, setSeccionSeleccionada] = useState<string>("");
  const [mesSeleccionado, setMesSeleccionado] = useState<number>(
    new Date().getMonth() + 1
  );

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

  const [aulasIDB] = useState(() => new BaseAulasIDB());
  const [estudiantesIDB] = useState(() => new BaseEstudiantesIDB());
  const [asistenciasIDB] = useState(
    () =>
      new AsistenciasEscolaresPorAulaParaDirectivosIDB(
        setIsLoading,
        setError,
        MOSTRAR_MENSAJES_EXITO ? setSuccessMessage : undefined
      )
  );

  useEffect(() => {
    if (nivelTemporal) {
      cargarGradosDisponibles(nivelTemporal);
    } else {
      setGradosDisponibles([]);
      setGradoTemporal("");
    }
  }, [nivelTemporal]);

  useEffect(() => {
    if (nivelTemporal && gradoTemporal) {
      cargarSeccionesDisponibles(nivelTemporal, gradoTemporal);
    } else {
      setSeccionesDisponibles([]);
      setSeccionTemporal("");
    }
  }, [nivelTemporal, gradoTemporal]);

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

  const obtenerEventos = async (mes: number): Promise<IEventoLocal[]> => {
    try {
      console.log(`Obteniendo eventos para mes ${mes}...`);
      const eventosIDB = new EventosIDB("API01");
      const eventosDelMes = await eventosIDB.getEventosPorMes(mes);
      console.log(`Eventos obtenidos: ${eventosDelMes.length}`);
      eventosDelMes.forEach((evento) => {
        console.log(
          `   ${evento.Nombre}: ${evento.Fecha_Inicio} a ${evento.Fecha_Conclusion}`
        );
      });
      setEventos(eventosDelMes);
      return eventosDelMes;
    } catch (error) {
      console.error("Error obteniendo eventos:", error);
      return [];
    }
  };

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
        `EVENTO DETECTADO para ${fechaConsulta}: ${resultado.nombreEvento}`
      );
    }

    return resultado;
  };

  const procesarAsistenciasEstudiantes = (
    estudiantes: T_Estudiantes[],
    asistenciasRaw: Record<
      string,
      Record<number, AsistenciaEscolarDeUnDia | null>
    >,
    nivel: NivelEducativo,
    eventosDelMes: IEventoLocal[],
    mes: number // ← AÑADE ESTE PARÁMETRO
  ): EstudianteConAsistencias[] => {
    const TOLERANCIA_SEGUNDOS_PRIMARIA = 900;
    const TOLERANCIA_SEGUNDOS_SECUNDARIA = 300;

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

        const diasEscolares = obtenerDiasDelMes(mes); // ← USA EL PARÁMETRO mes
        const diasEscolaresSet = new Set(diasEscolares.map((d) => d.dia));

        for (let dia = 1; dia <= 31; dia++) {
          if (!diasEscolaresSet.has(dia)) {
            continue;
          }

          const eventoInfo = esEvento(año, mes, dia, eventosDelMes); // ← USA EL PARÁMETRO mes
          if (eventoInfo.esEvento) {
            asistenciasProcesadas[dia] = EstadosAsistenciaEscolar.Evento;
            continue;
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

  const handleConsultar = async () => {
    setIsLoading(true);
    setError(null);
    if (MOSTRAR_MENSAJES_EXITO) {
      setSuccessMessage(null);
    }

    setNivelSeleccionado(nivelTemporal);
    setGradoSeleccionado(gradoTemporal);
    setSeccionSeleccionada(seccionTemporal);
    setMesSeleccionado(mesTemporal);

    try {
      const todasLasAulas = await aulasIDB.getTodasLasAulas();
      const aula = todasLasAulas.find(
        (aula) =>
          aula.Nivel === nivelTemporal &&
          aula.Grado === gradoTemporal &&
          aula.Seccion === seccionTemporal
      );

      if (!aula) {
        setIsLoading(false);
        setError({
          success: false,
          message: "No se encontró el aula seleccionada",
        });
        return;
      }

      setAulaSeleccionada(aula);
      await cargarAsistenciasDirectamente(aula, mesTemporal);
    } catch (error) {
      console.error("Error en handleConsultar:", error);
      setError({
        success: false,
        message: "Error al consultar los datos",
      });
      setIsLoading(false);
    }
  };

  const cargarAsistenciasDirectamente = async (aula: T_Aulas, mes: number) => {
    try {
      console.log(`Obteniendo eventos para mes ${mes}...`);
      const eventosDelMes = await obtenerEventos(mes);
      console.log(`Eventos obtenidos: ${eventosDelMes.length}`);

      const todosEstudiantes = await estudiantesIDB.getTodosLosEstudiantes(
        false
      );
      const estudiantesAula = todosEstudiantes.filter(
        (estudiante) => estudiante.Id_Aula === aula.Id_Aula && estudiante.Estado
      );

      if (estudiantesAula.length === 0) {
        setDatosTabla(null);
        setError({
          success: false,
          message: "No se encontraron estudiantes activos en esta aula",
        });
        setIsLoading(false);
        return;
      }

      const resultado = await asistenciasIDB.consultarAsistenciasMensualesAula(
        aula.Id_Aula,
        mes
      );

      if (resultado.success && resultado.data) {
        const estudiantesConAsistencias = procesarAsistenciasEstudiantes(
          estudiantesAula,
          resultado.data.Asistencias_Escolares,
          aula.Nivel as NivelEducativo,
          eventosDelMes,
          mes // ← PASA EL PARÁMETRO mes
        );

        const diasDelMes = obtenerDiasDelMes(mes);

        setDatosTabla({
          aula: aula,
          mes: mes,
          estudiantes: estudiantesConAsistencias,
          diasDelMes,
          fechaConsulta: new Date().toLocaleString(),
        });

        setError(null);

        if (MOSTRAR_MENSAJES_EXITO) {
          setSuccessMessage({
            message: `Asistencias cargadas exitosamente: ${estudiantesConAsistencias.length} estudiantes`,
          });
        }
      } else if (resultado.requiereEspera && resultado.data) {
        const estudiantesConAsistencias = procesarAsistenciasEstudiantes(
          estudiantesAula,
          resultado.data.Asistencias_Escolares,
          aula.Nivel as NivelEducativo,
          eventosDelMes,
          mes // ← PASA EL PARÁMETRO mes
        );

        const diasDelMes = obtenerDiasDelMes(mes);

        setDatosTabla({
          aula: aula,
          mes: mes,
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
    } finally {
      setIsLoading(false);
    }
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
      <div className="bg-white border-b border-gray-200 p-4 flex-shrink-0 w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          REGISTROS DE ASISTENCIA ESCOLAR
        </h1>

        <FiltrosConsultaAsistenciasEscolares
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
          isLoading={isLoading || loadingEventos}
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

      <MensajesNotificacion
        error={error}
        successMessage={MOSTRAR_MENSAJES_EXITO ? successMessage : null}
        onCloseError={() => setError(null)}
        onCloseSuccess={() => setSuccessMessage(null)}
      />

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
