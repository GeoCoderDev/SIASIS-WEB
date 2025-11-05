"use client";

import { useEffect, useState } from "react";
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
} from "@/interfaces/shared/ReporteAsistenciaEscolar";
import codificarCombinacionParametrosParaReporteEscolar from "@/lib/helpers/encoders/reportes-asistencia-escolares/codificarCombinacionParametrosParaReporteEscolar";

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

  // Nuevo estado para saber si se excede el límite de días
  const [excedeLimiteDias, setExcedeLimiteDias] = useState<boolean>(false);

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

    console.log(
      codificarCombinacionParametrosParaReporteEscolar({
        aulasSeleccionadas: aulasSeleccionadas,
        rangoTiempo: rangoTiempoSeleccionado,
        tipoReporte: tipoReporteSeleccionado,
      })
    );
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

  // Callback para recibir notificación si se excede el límite
  const handleExcedeLimite = (excede: boolean) => {
    setExcedeLimiteDias(excede);
  };

  // Determinar si el botón debe estar deshabilitado
  const botonDeshabilitado =
    !aulasSeleccionadas.Grado ||
    !aulasSeleccionadas.Seccion ||
    seccionesCargando ||
    excedeLimiteDias;

  return (
    <div className="w-full h-max -bg-gris-claro px-4">
      <div className="max-w-[1600px] mx-auto">
        {/* Título */}
        <h2 className="font-bold text-2xl sm:text-3xl md:text-4xl text-negro mb-6 md:mb-8">
          REPORTES DE ASISTENCIA ESCOLAR
        </h2>

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
          <div className="bg-white rounded-lg shadow-lg border-2 border-azul-principal p-8 md:p-12 lg-only:p-16 flex items-center justify-center min-h-[400px] lg-only:min-h-[500px]">
            <div className="text-center space-y-4">
              <button
                onClick={() => {
                  console.log("Generando reporte con:", {
                    tipoReporte: tipoReporteSeleccionado,
                    rangoTiempo: rangoTiempoSeleccionado,
                    aulas: aulasSeleccionadas,
                  });
                }}
                disabled={botonDeshabilitado}
                className="bg-azul-principal text-white px-8 py-3 rounded-md font-semibold text-base md:text-lg transition-all shadow-md hover:opacity-90 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Generar Reporte
              </button>

              <p className="text-sm text-azul-principal italic">
                Tiempo Aproximado:
                <br />
                <span className="font-medium">2 minutos y 35 segundos</span>
              </p>

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
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportesAsistenciasEscolares;
