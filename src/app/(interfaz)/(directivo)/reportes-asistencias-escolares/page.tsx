// app/(sistema)/(directivos)/reportes-asistencia-escolares/page.tsx
"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import SelectorTipoReporteAsistenciasEscolares from "./_components/SelectorTipoReporteAsistenciasEscolares";
import SiasisSelect from "@/components/inputs/SiasisSelect";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";
import { NivelEducativoTextos } from "@/Assets/NivelEducativoTextos";
import getGradosDisponiblesPorNivel from "@/lib/getters/getGradosDisponiblesPorNivel";
import getSeccionesDisponiblesPorNivelYPorGrado from "@/lib/getters/getSeccionesDisponiblesPorGrado";
import {
  AulasSeleccionadasParaReporteAsistenciaEscolar,
  RangoTiempoReporteAsistenciasEscolares,
  TipoReporteAsistenciaEscolar,
  EstadoReporteAsistenciaEscolar,
} from "@/interfaces/shared/ReporteAsistenciaEscolar";
import codificarCombinacionParametrosParaReporteEscolar from "@/lib/helpers/encoders/reportes-asistencia-escolares/codificarCombinacionParametrosParaReporteEscolar";
import {
  ErrorResponseAPIBase,
  MessageProperty,
} from "@/interfaces/shared/apis/types";
import {
  IEstimacionTiempo,
  IReporteAsistenciaEscolarLocal,
  ReportesAsistenciaEscolarIDB,
} from "@/lib/utils/local/db/models/ReportesEscolares/ReportesAsistenciaEscolarIDB";
import GraficoReporteAsistencia from "./_components/GraficoReporteAsistenciaEscolar";
import { SystemErrorTypes } from "@/interfaces/shared/errors";
import { transformarDatosReporteAsistenciaEscolarParaGrafico } from "@/lib/helpers/transformers/reportes-asistencia-escolar/transformarDatosReporteAsistenciaEscolarParaGrafico";

const rangoTiempoSeleccionadoinicial: RangoTiempoReporteAsistenciasEscolares = {
  DesdeMes: 3,
  DesdeDia: null,
  HastaMes: 3,
  HastaDia: null,
};

const aulasSeleccionadasIniciales: AulasSeleccionadasParaReporteAsistenciaEscolar =
  {
    Nivel: NivelEducativo.SECUNDARIA,
    Grado: "",
    Seccion: "",
  };

const ReportesAsistenciasEscolares = () => {
  const [tipoReporteSeleccionado, setTipoReporteSeleccionado] =
    useState<TipoReporteAsistenciaEscolar>(
      TipoReporteAsistenciaEscolar.POR_DIA
    );

  const [rangoTiempoSeleccionado, setRangoTiempoSeleccionado] =
    useState<RangoTiempoReporteAsistenciasEscolares>(
      rangoTiempoSeleccionadoinicial
    );

  const [aulasSeleccionadas, setAulasSeleccionadas] =
    useState<AulasSeleccionadasParaReporteAsistenciaEscolar>(
      aulasSeleccionadasIniciales
    );

  const [seccionesDisponibles, setSeccionesDisponibles] = useState<string[]>(
    []
  );

  const [seccionesCargando, setSeccionesCargando] = useState<boolean>(false);
  const [excedeLimiteDias, setExcedeLimiteDias] = useState<boolean>(false);

  // Estados para el modelo de reportes
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<ErrorResponseAPIBase | null>(null);
  const [successMessage, setSuccessMessage] = useState<MessageProperty | null>(
    null
  );

  // Estados para el proceso de generación del reporte
  const [reporteEnProceso, setReporteEnProceso] =
    useState<IReporteAsistenciaEscolarLocal | null>(null);
  const [estimacionTiempo, setEstimacionTiempo] =
    useState<IEstimacionTiempo | null>(null);
  const [tiempoTranscurrido, setTiempoTranscurrido] = useState<number>(0);
  const [tiempoRestante, setTiempoRestante] = useState<number>(0);

  // Estado para el reporte finalizado
  const [reporteFinalizado, setReporteFinalizado] =
    useState<IReporteAsistenciaEscolarLocal | null>(null);

  // Instancia del modelo (singleton)
  const modeloReportes = useRef<ReportesAsistenciaEscolarIDB | null>(null);
  const intervaloContadorRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Inicializar el modelo una sola vez
    modeloReportes.current = new ReportesAsistenciaEscolarIDB(
      "API01",
      setIsLoading,
      setError,
      setSuccessMessage
    );
  }, []);

  // Limpiar intervalo al desmontar
  useEffect(() => {
    return () => {
      if (intervaloContadorRef.current) {
        clearInterval(intervaloContadorRef.current);
      }
    };
  }, []);

  const handleChangeAulasSeleccionadas = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const { name, value } = event.target;

    if (
      name === "Nivel" &&
      value == NivelEducativo.SECUNDARIA &&
      aulasSeleccionadas.Grado == 6
    ) {
      setAulasSeleccionadas((prev) => ({
        ...prev,
        Grado: "",
      }));
    }

    if (name === "Nivel" && aulasSeleccionadas.Grado === "T") {
      setAulasSeleccionadas((prev) => ({
        ...prev,
        Grado: "",
      }));
    }

    if (name === "Nivel" && aulasSeleccionadas.Seccion !== "A") {
      setAulasSeleccionadas((prev) => ({
        ...prev,
        Seccion: "",
      }));
    }

    if (
      name === "Grado" &&
      (aulasSeleccionadas.Seccion === "T" || aulasSeleccionadas.Seccion !== "A")
    ) {
      setAulasSeleccionadas((prev) => ({
        ...prev,
        Seccion: "",
      }));
    }

    setAulasSeleccionadas((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  useEffect(() => {
    if (aulasSeleccionadas.Grado === "T") {
      setSeccionesDisponibles([]);
      setAulasSeleccionadas((prev) => ({
        ...prev,
        Seccion: "T",
      }));
      return;
    }

    if (aulasSeleccionadas.Grado === "") {
      setSeccionesDisponibles([]);

      setAulasSeleccionadas((prev) => ({
        ...prev,
        Seccion: "",
      }));
      return;
    }

    const obtenerSecciones = async () => {
      setSeccionesCargando(true);
      const secciones = await getSeccionesDisponiblesPorNivelYPorGrado(
        aulasSeleccionadas.Nivel,
        aulasSeleccionadas.Grado as number
      );
      setSeccionesDisponibles(secciones);
      setSeccionesCargando(false);
    };

    obtenerSecciones();
  }, [aulasSeleccionadas.Grado, aulasSeleccionadas.Nivel]);

  const handleExcedeLimite = (excede: boolean) => {
    setExcedeLimiteDias(excede);
  };

  const botonDeshabilitado =
    !aulasSeleccionadas.Grado ||
    !aulasSeleccionadas.Seccion ||
    seccionesCargando ||
    excedeLimiteDias ||
    reporteEnProceso !== null;

  /**
   * Maneja la generación del reporte
   */
  const handleGenerarReporte = async () => {
    if (!modeloReportes.current) return;

    // Limpiar reporte anterior
    setReporteFinalizado(null);

    try {
      // Generar la combinación de parámetros
      const combinacionParametros =
        codificarCombinacionParametrosParaReporteEscolar({
          aulasSeleccionadas: aulasSeleccionadas,
          rangoTiempo: rangoTiempoSeleccionado,
          tipoReporte: tipoReporteSeleccionado,
        });

      console.log("Generando reporte con combinación:", combinacionParametros);

      // Estimar el tiempo de generación
      const estimacion = modeloReportes.current.estimarTiempoGeneracion(
        combinacionParametros
      );
      setEstimacionTiempo(estimacion);
      setTiempoRestante(estimacion.tiempoEstimadoTotalSegundos);
      setTiempoTranscurrido(0);

      // Crear o verificar el reporte
      const reporte = await modeloReportes.current.crearReporte(
        combinacionParametros
      );

      if (!reporte) {
        console.error("No se pudo crear el reporte");
        return;
      }

      setReporteEnProceso(reporte);

      // Si ya está disponible, no hacer polling
      if (
        reporte.Estado_Reporte === EstadoReporteAsistenciaEscolar.DISPONIBLE
      ) {
        console.log("Reporte ya disponible:", reporte);
        setReporteEnProceso(null);
        setReporteFinalizado(reporte);
        setTiempoTranscurrido(0);
        setTiempoRestante(0);
        return;
      }

      // Iniciar el temporizador de cuenta regresiva
      intervaloContadorRef.current = setInterval(() => {
        setTiempoTranscurrido((prev) => prev + 1);
        setTiempoRestante((prev) => Math.max(0, prev - 1));
      }, 1000);

      // Iniciar polling
      const reporteFinal =
        await modeloReportes.current.pollingReporteAsistenciaEscolar(
          combinacionParametros,
          (reporteActualizado, tiempoActual) => {
            console.log(
              `Polling actualización: Estado=${reporteActualizado.Estado_Reporte}, Tiempo=${tiempoActual}s`
            );

            // Si el reporte sigue pendiente después del tiempo estimado,
            // agregar más tiempo estimado
            if (
              reporteActualizado.Estado_Reporte ===
                EstadoReporteAsistenciaEscolar.PENDIENTE &&
              tiempoRestante <= 0
            ) {
              const tiempoAdicional =
                modeloReportes.current!.INTERVALO_POLLING_SEGUNDOS;
              setTiempoRestante(tiempoAdicional);
              setEstimacionTiempo((prev) =>
                prev
                  ? {
                      ...prev,
                      tiempoEstimadoTotalSegundos:
                        prev.tiempoEstimadoTotalSegundos + tiempoAdicional,
                    }
                  : null
              );
            }

            setReporteEnProceso(reporteActualizado);
          }
        );

      // Limpiar el intervalo
      if (intervaloContadorRef.current) {
        clearInterval(intervaloContadorRef.current);
        intervaloContadorRef.current = null;
      }

      if (reporteFinal) {
        console.log("Reporte final:", reporteFinal);
        setReporteEnProceso(null);
        setTiempoTranscurrido(0);
        setTiempoRestante(0);

        if (
          reporteFinal.Estado_Reporte ===
          EstadoReporteAsistenciaEscolar.DISPONIBLE
        ) {
          setReporteFinalizado(reporteFinal);
          setSuccessMessage({
            message: "¡Reporte generado exitosamente!",
          });
        } else if (
          reporteFinal.Estado_Reporte === EstadoReporteAsistenciaEscolar.ERROR
        ) {
          setError({
            success: false,
            message:
              "Hubo un error al generar el reporte. Por favor, intenta de nuevo.",
            errorType: SystemErrorTypes.UNKNOWN_ERROR,
          });
        }
      }
    } catch (error) {
      console.error("Error al generar reporte:", error);

      // Limpiar el intervalo si hay error
      if (intervaloContadorRef.current) {
        clearInterval(intervaloContadorRef.current);
        intervaloContadorRef.current = null;
      }

      setReporteEnProceso(null);
      setTiempoTranscurrido(0);
      setTiempoRestante(0);
    }
  };

  /**
   * Formatea segundos a formato legible (Xm Ys)
   */
  const formatearTiempo = (segundos: number): string => {
    const minutos = Math.floor(segundos / 60);
    const segs = segundos % 60;
    return `${minutos}m ${segs}s`;
  };

  /**
   * Prepara los datos del gráfico
   */
  const datosGrafico = useMemo(() => {
    if (!reporteFinalizado?.datos) return null;

    try {
      return transformarDatosReporteAsistenciaEscolarParaGrafico(
        reporteFinalizado.datos,
        tipoReporteSeleccionado
      );
    } catch (error) {
      console.error("Error al transformar datos para gráfico:", error);
      return null;
    }
  }, [reporteFinalizado, tipoReporteSeleccionado]);

  return (
    <div className="w-full h-max -bg-gris-claro px-4">
      <div className="max-w-[1600px] mx-auto">
        {/* Título */}
        <h2 className="font-bold text-2xl sm:text-3xl md:text-4xl text-negro mb-6 md:mb-8">
          REPORTES DE ASISTENCIA ESCOLAR
        </h2>

        {/* Mensajes de error o éxito */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <p className="font-bold">Error:</p>
            <p>{error.message}</p>
          </div>
        )}

        {successMessage && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            <p>{successMessage.message}</p>
          </div>
        )}

        {/* Layout principal - Responsive */}
        <div className="grid grid-cols-1 lg-only:grid-cols-[auto_1fr] xl-only:grid-cols-[auto_1fr] gap-4 md:gap-6">
          {/* Sección de filtros - Izquierda */}
          <div className="flex flex-col gap-4 md:gap-6">
            {/* Contenedor para el selector de tipo y los filtros de nivel/grado/sección */}
            <div className="flex flex-col sm-only:flex-row md-only:flex-row lg-only:flex-col xl-only:flex-col gap-4">
              {/* Selector de tipo de reporte */}
              <div className="w-full sm-only:w-auto md-only:w-auto">
                <SelectorTipoReporteAsistenciasEscolares
                  nivelEducativoSeleccionado={aulasSeleccionadas.Nivel}
                  rangoTiempoSeleccionado={rangoTiempoSeleccionado}
                  setRangoTiempoSeleccionado={setRangoTiempoSeleccionado}
                  tipoReporteSeleccionado={tipoReporteSeleccionado}
                  setTipoReporteSeleccionado={setTipoReporteSeleccionado}
                  onExcedeLimite={handleExcedeLimite}
                />
              </div>

              {/* Selectores de Nivel, Grado y Sección - Escalados al 90% */}
              <div
                className="flex flex-col 
                sxs-only:gap-4 xs-only:gap-4 
                sm-only:gap-3.5 md-only:gap-3.5 lg-only:gap-3.5 xl-only:gap-3.5
                sm-only:flex-1 md-only:flex-1 
                sm-only:min-w-[200px] md-only:min-w-[200px]
                lg-only:min-w-0 xl-only:min-w-0"
              >
                {/* Nivel Educativo */}
                <div className="w-full">
                  <label
                    className="block font-bold text-negro 
                    sxs-only:text-sm sxs-only:mb-2
                    xs-only:text-sm xs-only:mb-2
                    sm-only:text-[0.765rem] sm-only:mb-1.5
                    md-only:text-[0.765rem] md-only:mb-1.5
                    lg-only:text-[0.765rem] lg-only:mb-1.5
                    xl-only:text-[0.765rem] xl-only:mb-1.5"
                  >
                    Nivel Educativo:
                  </label>
                  <SiasisSelect
                    name="Nivel"
                    value={aulasSeleccionadas.Nivel}
                    onChange={handleChangeAulasSeleccionadas}
                    className="w-full
                      sxs-only:text-sm
                      xs-only:text-sm
                      sm-only:text-[0.765rem] sm-only:py-[0.225rem]
                      md-only:text-[0.765rem] md-only:py-[0.225rem]
                      lg-only:text-[0.765rem] lg-only:py-[0.225rem]
                      xl-only:text-[0.765rem] xl-only:py-[0.225rem]"
                  >
                    {Object.values(NivelEducativo).map((nivel) => (
                      <option
                        key={nivel}
                        value={nivel}
                        className="
                          sxs-only:text-sm
                          xs-only:text-sm
                          sm-only:text-[0.72rem]
                          md-only:text-[0.72rem]
                          lg-only:text-[0.72rem]
                          xl-only:text-[0.72rem]"
                      >
                        {NivelEducativoTextos[nivel]}
                      </option>
                    ))}
                  </SiasisSelect>
                </div>

                {/* Grado */}
                <div className="w-full">
                  <label
                    className="block font-bold text-negro 
                    sxs-only:text-sm sxs-only:mb-2
                    xs-only:text-sm xs-only:mb-2
                    sm-only:text-[0.765rem] sm-only:mb-1.5
                    md-only:text-[0.765rem] md-only:mb-1.5
                    lg-only:text-[0.765rem] lg-only:mb-1.5
                    xl-only:text-[0.765rem] xl-only:mb-1.5"
                  >
                    Grado:
                  </label>
                  <SiasisSelect
                    name="Grado"
                    value={aulasSeleccionadas.Grado || ""}
                    onChange={handleChangeAulasSeleccionadas}
                    placeholder="Seleccione un grado"
                    className="w-full
                      sxs-only:text-sm
                      xs-only:text-sm
                      sm-only:text-[0.765rem] sm-only:py-[0.225rem]
                      md-only:text-[0.765rem] md-only:py-[0.225rem]
                      lg-only:text-[0.765rem] lg-only:py-[0.225rem]
                      xl-only:text-[0.765rem] xl-only:py-[0.225rem]"
                  >
                    <option
                      value="T"
                      className="
                        sxs-only:text-sm
                        xs-only:text-sm
                        sm-only:text-[0.72rem]
                        md-only:text-[0.72rem]
                        lg-only:text-[0.72rem]
                        xl-only:text-[0.72rem]"
                    >
                      Todos
                    </option>
                    {getGradosDisponiblesPorNivel(aulasSeleccionadas.Nivel).map(
                      (grado, index) => (
                        <option
                          key={index}
                          value={grado}
                          className="
                            sxs-only:text-sm
                            xs-only:text-sm
                            sm-only:text-[0.72rem]
                            md-only:text-[0.72rem]
                            lg-only:text-[0.72rem]
                            xl-only:text-[0.72rem]"
                        >
                          {grado}°
                        </option>
                      )
                    )}
                  </SiasisSelect>
                </div>

                {/* Sección */}
                <div className="w-full">
                  <label
                    className="block font-bold text-negro 
                    sxs-only:text-sm sxs-only:mb-2
                    xs-only:text-sm xs-only:mb-2
                    sm-only:text-[0.765rem] sm-only:mb-1.5
                    md-only:text-[0.765rem] md-only:mb-1.5
                    lg-only:text-[0.765rem] lg-only:mb-1.5
                    xl-only:text-[0.765rem] xl-only:mb-1.5"
                  >
                    Sección:
                  </label>
                  <SiasisSelect
                    className={`w-full
                      sxs-only:text-sm
                      xs-only:text-sm
                      sm-only:text-[0.765rem] sm-only:py-[0.225rem]
                      md-only:text-[0.765rem] md-only:py-[0.225rem]
                      lg-only:text-[0.765rem] lg-only:py-[0.225rem]
                      xl-only:text-[0.765rem] xl-only:py-[0.225rem]
                      ${seccionesCargando ? "cursor-wait opacity-70" : ""}`}
                    name="Seccion"
                    selectAttributes={{
                      disabled:
                        aulasSeleccionadas.Grado === "" || seccionesCargando,
                    }}
                    value={aulasSeleccionadas.Seccion || ""}
                    onChange={handleChangeAulasSeleccionadas}
                    placeholder={
                      seccionesCargando
                        ? "Cargando secciones..."
                        : aulasSeleccionadas.Grado === ""
                        ? "Seleccione un grado primero"
                        : "Seleccione una sección"
                    }
                  >
                    {!seccionesCargando &&
                      (seccionesDisponibles.length > 1 ||
                        aulasSeleccionadas.Grado === "T") && (
                        <option
                          value="T"
                          className="
                            sxs-only:text-sm
                            xs-only:text-sm
                            sm-only:text-[0.72rem]
                            md-only:text-[0.72rem]
                            lg-only:text-[0.72rem]
                            xl-only:text-[0.72rem]"
                        >
                          Todas
                        </option>
                      )}

                    {seccionesDisponibles.map((seccion) => (
                      <option
                        key={seccion}
                        value={seccion}
                        className="
                          sxs-only:text-sm
                          xs-only:text-sm
                          sm-only:text-[0.72rem]
                          md-only:text-[0.72rem]
                          lg-only:text-[0.72rem]
                          xl-only:text-[0.72rem]"
                      >
                        Sección {seccion}
                      </option>
                    ))}
                  </SiasisSelect>

                  {/* Indicador de carga - Escalado */}
                  {seccionesCargando && (
                    <div
                      className="flex items-center text-gris-oscuro
                      sxs-only:gap-2 xs-only:gap-2
                      sm-only:gap-1.5 md-only:gap-1.5 lg-only:gap-1.5 xl-only:gap-1.5
                      sxs-only:mt-2 xs-only:mt-2
                      sm-only:mt-1.5 md-only:mt-1.5 lg-only:mt-1.5 xl-only:mt-1.5
                      sxs-only:text-sm xs-only:text-sm
                      sm-only:text-[0.72rem] md-only:text-[0.72rem] lg-only:text-[0.72rem] xl-only:text-[0.72rem]"
                    >
                      <div
                        className="border-2 border-color-interfaz border-t-transparent rounded-full animate-spin
                        sxs-only:w-4 sxs-only:h-4
                        xs-only:w-4 xs-only:h-4
                        sm-only:w-3.5 sm-only:h-3.5
                        md-only:w-3.5 md-only:h-3.5
                        lg-only:w-3.5 lg-only:h-3.5
                        xl-only:w-3.5 xl-only:h-3.5"
                      ></div>
                      <span>Cargando secciones...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Área de reporte - Derecha */}
          <div className="bg-white rounded-lg shadow-lg border-2 border-azul-principal p-4 md:p-6 lg-only:p-8 flex items-center justify-center min-h-[400px] lg-only:min-h-[500px]">
            {/* Mostrar gráfico si hay datos */}
            {reporteFinalizado && datosGrafico ? (
              <div className="w-full h-full min-h-[400px] lg-only:min-h-[500px]">
                <GraficoReporteAsistencia
                  datos={datosGrafico}
                  tipoReporte={tipoReporteSeleccionado}
                />
              </div>
            ) : reporteEnProceso ? (
              // Mostrar estado de progreso con cuenta regresiva animada
              <div className="text-center space-y-4">
                <div className="animate-pulse">
                  <div className="w-16 h-16 border-4 border-azul-principal border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <h3 className="text-xl font-bold text-azul-principal mb-2">
                    Generando Reporte...
                  </h3>
                  <p className="text-sm text-gris-oscuro">
                    Estado: {reporteEnProceso.Estado_Reporte}
                  </p>
                </div>

                {estimacionTiempo && (
                  <div className="mt-4 space-y-2">
                    {/* Tiempo transcurrido */}
                    <div className="bg-azul-claro bg-opacity-20 rounded-lg p-3">
                      <p className="text-sm text-gris-oscuro mb-1">
                        Tiempo transcurrido:
                      </p>
                      <p className="text-2xl font-bold text-azul-principal tabular-nums">
                        {formatearTiempo(tiempoTranscurrido)}
                      </p>
                    </div>

                    {/* Tiempo restante con animación */}
                    <div className="bg-verde-claro bg-opacity-20 rounded-lg p-3">
                      <p className="text-sm text-gris-oscuro mb-1">
                        Tiempo restante estimado:
                      </p>
                      <p
                        className="text-2xl font-bold text-verde-principal tabular-nums transition-all duration-300"
                        key={tiempoRestante}
                      >
                        {formatearTiempo(tiempoRestante)}
                      </p>
                    </div>

                    {/* Descripción */}
                    <p className="text-xs text-gris-intermedio mt-2 italic">
                      {estimacionTiempo.descripcion}
                    </p>

                    {/* Barra de progreso */}
                    <div className="w-full bg-gris-claro rounded-full h-2 overflow-hidden mt-4">
                      <div
                        className="bg-azul-principal h-full transition-all duration-1000 ease-linear"
                        style={{
                          width: `${Math.min(
                            100,
                            (tiempoTranscurrido /
                              estimacionTiempo.tiempoEstimadoTotalSegundos) *
                              100
                          )}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // Mostrar botón de generar
              <div className="text-center space-y-4">
                <button
                  onClick={handleGenerarReporte}
                  disabled={botonDeshabilitado || isLoading}
                  className="bg-azul-principal text-white px-8 py-3 rounded-md font-semibold text-base md:text-lg transition-all shadow-md hover:opacity-90 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? "Procesando..." : "Generar Reporte"}
                </button>

                {estimacionTiempo && !reporteEnProceso && (
                  <p className="text-sm text-azul-principal italic">
                    Tiempo Estimado:
                    <br />
                    <span className="font-medium">
                      {formatearTiempo(
                        estimacionTiempo.tiempoEstimadoTotalSegundos
                      )}
                    </span>
                  </p>
                )}

                {/* Mensaje de ayuda si falta seleccionar */}
                {(!aulasSeleccionadas.Grado || !aulasSeleccionadas.Seccion) &&
                  !seccionesCargando && (
                    <p className="text-xs text-gris-intermedio mt-4">
                      {!aulasSeleccionadas.Grado
                        ? "Seleccione un grado para continuar"
                        : "Seleccione una sección para continuar"}
                    </p>
                  )}

                {/* Mensaje si se excede el límite de días */}
                {excedeLimiteDias && (
                  <p className="text-xs text-rojo-principal mt-4 font-medium">
                    El rango de días seleccionado excede el límite permitido
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportesAsistenciasEscolares;
