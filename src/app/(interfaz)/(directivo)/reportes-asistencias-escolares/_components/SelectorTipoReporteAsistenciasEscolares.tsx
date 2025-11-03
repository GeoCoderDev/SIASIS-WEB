import SiasisSelect from "@/components/inputs/SiasisSelect";
import SiasisSwitch from "@/components/inputs/SiasisSwitch";
import useFechaReduxActual from "@/hooks/system-time/useFechaReduxActual";
import { getDiasDisponiblesPorMes } from "@/lib/getters/getDiasDisponiblesPorMes";
import { getMesesDisponibles } from "@/lib/getters/getMesesDisponibles";
import React, { Dispatch, SetStateAction, useMemo, useEffect } from "react";

export type TipoReporteAsistenciasEscolares = "POR DIAS" | "POR MESES";

export interface SelectorTipoReporteAsistenciasEscolaresProps {
  tipoReporteSeleccionado: TipoReporteAsistenciasEscolares;
  setTipoReporteSeleccionado: (tipo: TipoReporteAsistenciasEscolares) => void;
  rangoTiempoSeleccionado: RangoTiempoReporteAsistenciasEscolares;
  setRangoTiempoSeleccionado: Dispatch<
    SetStateAction<RangoTiempoReporteAsistenciasEscolares>
  >;
}

export interface RangoTiempoReporteAsistenciasEscolares {
  DesdeMes: number;
  DesdeDia: number | null;

  HastaMes: number;
  HastaDia: number | null;
}

const SelectorTipoReporteAsistenciasEscolares = ({
  tipoReporteSeleccionado,
  setTipoReporteSeleccionado,
  rangoTiempoSeleccionado,
  setRangoTiempoSeleccionado,
}: SelectorTipoReporteAsistenciasEscolaresProps) => {
  const { mesActual, diaActual, horaActual } = useFechaReduxActual();

  const mesesDisponibles = getMesesDisponibles(
    mesActual,
    tipoReporteSeleccionado === "POR DIAS"
  );

  const diasDisponiblesDesdeMes = getDiasDisponiblesPorMes(
    rangoTiempoSeleccionado.DesdeMes,
    diaActual,
    horaActual
  );
  const diasDisponiblesHastaMes = getDiasDisponiblesPorMes(
    rangoTiempoSeleccionado.HastaMes,
    diaActual,
    horaActual
  );

  // Función para contar días hábiles (lunes a viernes) entre dos fechas
  const contarDiasHabiles = (
    mesDesde: number,
    diaDesde: number,
    mesHasta: number,
    diaHasta: number
  ): number => {
    // Año escolar típico en Perú (marzo a diciembre)
    const añoActual = new Date().getFullYear();
    const fechaDesde = new Date(añoActual, mesDesde - 1, diaDesde);
    const fechaHasta = new Date(añoActual, mesHasta - 1, diaHasta);

    let diasHabiles = 0;
    const fechaTemp = new Date(fechaDesde);

    while (fechaTemp <= fechaHasta) {
      const diaSemana = fechaTemp.getDay();
      // 1-5 son lunes a viernes
      if (diaSemana >= 1 && diaSemana <= 5) {
        diasHabiles++;
      }
      fechaTemp.setDate(fechaTemp.getDate() + 1);
    }

    return diasHabiles;
  };

  // Filtrar meses disponibles para "Hasta" según el mes "Desde"
  const mesesDisponiblesHasta = useMemo(() => {
    return mesesDisponibles.filter(
      (mes) => Number(mes.value) >= Number(rangoTiempoSeleccionado.DesdeMes)
    );
  }, [mesesDisponibles, rangoTiempoSeleccionado.DesdeMes]);

  // Filtrar días disponibles para "Hasta" según restricciones
  const diasDisponiblesHastaFiltrados = useMemo(() => {
    if (tipoReporteSeleccionado === "POR MESES") {
      return diasDisponiblesHastaMes;
    }

    // Si el mes "Hasta" es igual al mes "Desde", filtrar días
    if (rangoTiempoSeleccionado.HastaMes === rangoTiempoSeleccionado.DesdeMes) {
      return diasDisponiblesHastaMes.filter(
        (dia) => dia.numeroDiaDelMes >= (rangoTiempoSeleccionado.DesdeDia || 1)
      );
    }

    // Si los meses son diferentes, verificar el límite de 20 días hábiles
    return diasDisponiblesHastaMes.filter((dia) => {
      const diasHabiles = contarDiasHabiles(
        rangoTiempoSeleccionado.DesdeMes,
        rangoTiempoSeleccionado.DesdeDia || 1,
        rangoTiempoSeleccionado.HastaMes,
        dia.numeroDiaDelMes
      );
      return diasHabiles <= 20;
    });
  }, [
    tipoReporteSeleccionado,
    diasDisponiblesHastaMes,
    rangoTiempoSeleccionado.DesdeMes,
    rangoTiempoSeleccionado.DesdeDia,
    rangoTiempoSeleccionado.HastaMes,
  ]);

  // Validar y ajustar automáticamente si la selección excede los límites
  useEffect(() => {
    let necesitaActualizacion = false;
    let nuevoEstado = { ...rangoTiempoSeleccionado };

    // 1. Validar que "Hasta" no sea anterior a "Desde" (meses)
    if (nuevoEstado.HastaMes < nuevoEstado.DesdeMes) {
      nuevoEstado.HastaMes = nuevoEstado.DesdeMes;
      nuevoEstado.HastaDia = nuevoEstado.DesdeDia;
      necesitaActualizacion = true;
    }

    // 2. Si son el mismo mes, validar días
    if (
      tipoReporteSeleccionado === "POR DIAS" &&
      nuevoEstado.HastaMes === nuevoEstado.DesdeMes &&
      nuevoEstado.HastaDia &&
      nuevoEstado.DesdeDia &&
      nuevoEstado.HastaDia < nuevoEstado.DesdeDia
    ) {
      nuevoEstado.HastaDia = nuevoEstado.DesdeDia;
      necesitaActualizacion = true;
    }

    // 3. Validar límite de 20 días hábiles
    if (
      tipoReporteSeleccionado === "POR DIAS" &&
      nuevoEstado.DesdeDia &&
      nuevoEstado.HastaDia
    ) {
      const diasHabiles = contarDiasHabiles(
        nuevoEstado.DesdeMes,
        nuevoEstado.DesdeDia,
        nuevoEstado.HastaMes,
        nuevoEstado.HastaDia
      );

      // Si excede 20 días hábiles, ajustar automáticamente
      if (diasHabiles > 20 && diasDisponiblesHastaFiltrados.length > 0) {
        const ultimoDiaValido =
          diasDisponiblesHastaFiltrados[
            diasDisponiblesHastaFiltrados.length - 1
          ].numeroDiaDelMes;
        if (nuevoEstado.HastaDia !== ultimoDiaValido) {
          nuevoEstado.HastaDia = ultimoDiaValido;
          necesitaActualizacion = true;
        }
      }
    }

    // Solo actualizar si realmente hay cambios
    if (necesitaActualizacion) {
      setRangoTiempoSeleccionado(nuevoEstado);
    }
  }, [
    tipoReporteSeleccionado,
    rangoTiempoSeleccionado.DesdeMes,
    rangoTiempoSeleccionado.DesdeDia,
    rangoTiempoSeleccionado.HastaMes,
    rangoTiempoSeleccionado.HastaDia,
    diasDisponiblesHastaFiltrados,
  ]);

  // Calcular días hábiles seleccionados para mostrar al usuario
  const diasHabilesSeleccionados = useMemo(() => {
    if (
      tipoReporteSeleccionado === "POR MESES" ||
      !rangoTiempoSeleccionado.DesdeDia ||
      !rangoTiempoSeleccionado.HastaDia
    ) {
      return null;
    }

    return contarDiasHabiles(
      rangoTiempoSeleccionado.DesdeMes,
      rangoTiempoSeleccionado.DesdeDia,
      rangoTiempoSeleccionado.HastaMes,
      rangoTiempoSeleccionado.HastaDia
    );
  }, [tipoReporteSeleccionado, rangoTiempoSeleccionado]);

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = event.target;

    if (name === "DesdeMes") {
      const nuevoMesDesde = Number(value);
      const diasDisponiblesNuevoMes = getDiasDisponiblesPorMes(
        nuevoMesDesde,
        diaActual,
        horaActual
      );

      setRangoTiempoSeleccionado((prev) => {
        const nuevoEstado = {
          ...prev,
          DesdeMes: nuevoMesDesde,
          DesdeDia: diasDisponiblesNuevoMes[0].numeroDiaDelMes,
        };

        // Si el mes "Hasta" es menor que el nuevo mes "Desde", ajustarlo
        if (prev.HastaMes < nuevoMesDesde) {
          nuevoEstado.HastaMes = nuevoMesDesde;
          nuevoEstado.HastaDia = diasDisponiblesNuevoMes[0].numeroDiaDelMes;
        }

        return nuevoEstado;
      });
    }

    if (name === "HastaMes") {
      const nuevoMesHasta = Number(value);
      const diasDisponiblesNuevoMes = getDiasDisponiblesPorMes(
        nuevoMesHasta,
        diaActual,
        horaActual
      );

      setRangoTiempoSeleccionado((prev) => ({
        ...prev,
        HastaMes: nuevoMesHasta,
        HastaDia: diasDisponiblesNuevoMes[0].numeroDiaDelMes,
      }));
    }

    if (name === "DesdeDia" || name === "HastaDia") {
      setRangoTiempoSeleccionado((prev) => ({
        ...prev,
        [name]: Number(value),
      }));
    }
  };

  return (
    <div
      className="transition-all shadow-[0_0_8px_5px_rgba(0,0,0,0.2)] 
      w-full 
      sxs-only:min-w-[min(18rem,90vw)] sxs-only:max-w-[min(18rem,90vw)]
      xs-only:min-w-[min(18rem,90vw)] xs-only:max-w-[min(18rem,90vw)]
      sm-only:min-w-[16.2rem] sm-only:max-w-[16.2rem]
      md-only:min-w-[16.2rem] md-only:max-w-[16.2rem]
      lg-only:min-w-[16.2rem] lg-only:max-w-[16.2rem]
      xl-only:min-w-[16.2rem] xl-only:max-w-[16.2rem]
      flex flex-col items-center justify-center 
      sxs-only:py-4 xs-only:py-4 sm-only:py-3.5 md-only:py-3.5 lg-only:py-3.5 xl-only:py-3.5
      sxs-only:px-3 xs-only:px-3 sm-only:px-2.5 md-only:px-2.5 lg-only:px-2.5 xl-only:px-2.5
      rounded-[0.8rem] 
      sxs-only:gap-2 xs-only:gap-2 sm-only:gap-1.5 md-only:gap-1.5 lg-only:gap-1.5 xl-only:gap-1.5
      bg-white h-max 
      sxs-only:pb-6 xs-only:pb-6 sm-only:pb-5 md-only:pb-5 lg-only:pb-5 xl-only:pb-5"
    >
      {/* Título */}
      <h3
        className="italic font-light text-gris-oscuro text-center
        sxs-only:text-[1.3rem] sxs-only:mb-1
        xs-only:text-[1.3rem] xs-only:mb-1
        sm-only:text-[1.17rem] sm-only:mb-0.5
        md-only:text-[1.17rem] md-only:mb-0.5
        lg-only:text-[1.17rem] lg-only:mb-0.5
        xl-only:text-[1.17rem] xl-only:mb-0.5"
      >
        Reporte por
      </h3>

      {/* Switch Días/Meses */}
      <SiasisSwitch<TipoReporteAsistenciasEscolares>
        className="w-full 
          sxs-only:h-10 xs-only:h-10 
          sm-only:h-9 md-only:h-9 lg-only:h-9 xl-only:h-9"
        values={["POR DIAS", "POR MESES"]}
        texts={["Días", "Meses"]}
        selectedValue={tipoReporteSeleccionado}
        handleSwitch={() => {
          setRangoTiempoSeleccionado((prev) => ({
            DesdeMes: Number(mesesDisponibles[0].value),
            DesdeDia:
              tipoReporteSeleccionado === "POR MESES" ? null : prev.DesdeDia,
            HastaMes: Number(mesesDisponibles[0].value),
            HastaDia:
              tipoReporteSeleccionado === "POR MESES" ? null : prev.HastaDia,
          }));
          if (tipoReporteSeleccionado == "POR DIAS") {
            setTipoReporteSeleccionado("POR MESES");
          } else {
            setTipoReporteSeleccionado("POR DIAS");
          }
        }}
      />

      {/* Selectores de fecha - Con altura mínima fija para evitar cambio de tamaño */}
      <div
        className="transition-all w-full flex flex-col 
        sxs-only:gap-3 xs-only:gap-3 
        sm-only:gap-2.5 md-only:gap-2.5 lg-only:gap-2.5 xl-only:gap-2.5
        sxs-only:mt-2 xs-only:mt-2 
        sm-only:mt-1.5 md-only:mt-1.5 lg-only:mt-1.5 xl-only:mt-1.5
        sxs-only:min-h-[180px] xs-only:min-h-[180px]
        sm-only:min-h-[162px] md-only:min-h-[162px] lg-only:min-h-[162px] xl-only:min-h-[162px]"
      >
        {tipoReporteSeleccionado === "POR DIAS" ? (
          <>
            {/* Desde - Por Días */}
            <div
              className="w-full flex flex-col 
              sxs-only:gap-2 xs-only:gap-2 
              sm-only:gap-1.5 md-only:gap-1.5 lg-only:gap-1.5 xl-only:gap-1.5"
            >
              <label
                className="font-normal text-negro
                sxs-only:text-base xs-only:text-base
                sm-only:text-[0.9rem] md-only:text-[0.9rem] lg-only:text-[0.9rem] xl-only:text-[0.9rem]"
              >
                Desde:
              </label>
              <div
                className="flex flex-wrap justify-center items-center w-full
                sxs-only:gap-2 xs-only:gap-2 
                sm-only:gap-1.5 md-only:gap-1.5 lg-only:gap-1.5 xl-only:gap-1.5
                sxs-only:min-h-[40px] xs-only:min-h-[40px]
                sm-only:min-h-[36px] md-only:min-h-[36px] lg-only:min-h-[36px] xl-only:min-h-[36px]"
              >
                <SiasisSelect
                  name="DesdeMes"
                  className="flex-1 min-w-[90px]
                    sxs-only:text-[0.85rem] sxs-only:max-w-[8rem]
                    xs-only:text-[0.85rem] xs-only:max-w-[8rem]
                    sm-only:text-[0.765rem] sm-only:max-w-[7.2rem]
                    md-only:text-[0.765rem] md-only:max-w-[7.2rem]
                    lg-only:text-[0.765rem] lg-only:max-w-[7.2rem]
                    xl-only:text-[0.765rem] xl-only:max-w-[7.2rem]"
                  value={rangoTiempoSeleccionado.DesdeMes}
                  onChange={handleChange}
                >
                  <>
                    {mesesDisponibles.map(({ value, label }) => (
                      <option
                        className="sxs-only:text-[0.8rem] xs-only:text-[0.8rem]
                          sm-only:text-[0.72rem] md-only:text-[0.72rem] lg-only:text-[0.72rem] xl-only:text-[0.72rem]"
                        key={value}
                        value={value}
                      >
                        {label}
                      </option>
                    ))}
                  </>
                </SiasisSelect>
                <SiasisSelect
                  name="DesdeDia"
                  className="flex-1 min-w-[108px]
                    sxs-only:text-[0.85rem] sxs-only:max-w-[8rem]
                    xs-only:text-[0.85rem] xs-only:max-w-[8rem]
                    sm-only:text-[0.765rem] sm-only:max-w-[7.2rem]
                    md-only:text-[0.765rem] md-only:max-w-[7.2rem]
                    lg-only:text-[0.765rem] lg-only:max-w-[7.2rem]
                    xl-only:text-[0.765rem] xl-only:max-w-[7.2rem]"
                  value={
                    rangoTiempoSeleccionado.DesdeDia ||
                    diasDisponiblesDesdeMes[0].numeroDiaDelMes
                  }
                  onChange={handleChange}
                >
                  <>
                    {diasDisponiblesDesdeMes.map(
                      ({ numeroDiaDelMes, NombreDiaSemana }, index) => (
                        <option
                          className="sxs-only:text-[0.8rem] xs-only:text-[0.8rem]
                            sm-only:text-[0.72rem] md-only:text-[0.72rem] lg-only:text-[0.72rem] xl-only:text-[0.72rem]"
                          key={index}
                          value={numeroDiaDelMes}
                        >
                          {numeroDiaDelMes} ({NombreDiaSemana})
                        </option>
                      )
                    )}
                  </>
                </SiasisSelect>
              </div>
            </div>

            {/* Hasta - Por Días */}
            <div
              className="w-full flex flex-col 
              sxs-only:gap-2 xs-only:gap-2 
              sm-only:gap-1.5 md-only:gap-1.5 lg-only:gap-1.5 xl-only:gap-1.5"
            >
              <label
                className="font-normal text-negro
                sxs-only:text-base xs-only:text-base
                sm-only:text-[0.9rem] md-only:text-[0.9rem] lg-only:text-[0.9rem] xl-only:text-[0.9rem]"
              >
                Hasta:
              </label>
              <div
                className="flex flex-wrap justify-center items-center w-full
                sxs-only:gap-2 xs-only:gap-2 
                sm-only:gap-1.5 md-only:gap-1.5 lg-only:gap-1.5 xl-only:gap-1.5
                sxs-only:min-h-[40px] xs-only:min-h-[40px]
                sm-only:min-h-[36px] md-only:min-h-[36px] lg-only:min-h-[36px] xl-only:min-h-[36px]"
              >
                <SiasisSelect
                  name="HastaMes"
                  className="flex-1 min-w-[90px]
                    sxs-only:text-[0.85rem] sxs-only:max-w-[8rem]
                    xs-only:text-[0.85rem] xs-only:max-w-[8rem]
                    sm-only:text-[0.765rem] sm-only:max-w-[7.2rem]
                    md-only:text-[0.765rem] md-only:max-w-[7.2rem]
                    lg-only:text-[0.765rem] lg-only:max-w-[7.2rem]
                    xl-only:text-[0.765rem] xl-only:max-w-[7.2rem]"
                  value={rangoTiempoSeleccionado.HastaMes}
                  onChange={handleChange}
                >
                  <>
                    {mesesDisponiblesHasta.map(({ value, label }) => (
                      <option
                        className="sxs-only:text-[0.8rem] xs-only:text-[0.8rem]
                          sm-only:text-[0.72rem] md-only:text-[0.72rem] lg-only:text-[0.72rem] xl-only:text-[0.72rem]"
                        key={value}
                        value={value}
                      >
                        {label}
                      </option>
                    ))}
                  </>
                </SiasisSelect>
                <SiasisSelect
                  name="HastaDia"
                  className="flex-1 min-w-[108px]
                    sxs-only:text-[0.85rem] sxs-only:max-w-[8rem]
                    xs-only:text-[0.85rem] xs-only:max-w-[8rem]
                    sm-only:text-[0.765rem] sm-only:max-w-[7.2rem]
                    md-only:text-[0.765rem] md-only:max-w-[7.2rem]
                    lg-only:text-[0.765rem] lg-only:max-w-[7.2rem]
                    xl-only:text-[0.765rem] xl-only:max-w-[7.2rem]"
                  value={
                    rangoTiempoSeleccionado.HastaDia ||
                    diasDisponiblesHastaFiltrados[0]?.numeroDiaDelMes ||
                    diasDisponiblesHastaMes[0]?.numeroDiaDelMes
                  }
                  onChange={handleChange}
                >
                  <>
                    {diasDisponiblesHastaFiltrados.map(
                      ({ numeroDiaDelMes, NombreDiaSemana }, index) => (
                        <option
                          className="sxs-only:text-[0.8rem] xs-only:text-[0.8rem]
                            sm-only:text-[0.72rem] md-only:text-[0.72rem] lg-only:text-[0.72rem] xl-only:text-[0.72rem]"
                          key={index}
                          value={numeroDiaDelMes}
                        >
                          {numeroDiaDelMes} ({NombreDiaSemana})
                        </option>
                      )
                    )}
                  </>
                </SiasisSelect>
              </div>
            </div>

            {/* Indicador de días hábiles seleccionados */}
            {diasHabilesSeleccionados !== null && (
              <div className="text-center w-full">
                <span
                  className={`
                  sxs-only:text-xs xs-only:text-xs
                  sm-only:text-[0.675rem] md-only:text-[0.675rem] lg-only:text-[0.675rem] xl-only:text-[0.675rem]
                  font-medium
                  ${
                    diasHabilesSeleccionados > 20
                      ? "text-rojo-principal"
                      : "text-verde-principal"
                  }
                `}
                >
                  {diasHabilesSeleccionados} días hábiles{" "}
                  {diasHabilesSeleccionados > 20 ? "(máximo: 20)" : ""}
                </span>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Desde - Por Meses */}
            <div
              className="w-full flex flex-col 
              sxs-only:gap-2 xs-only:gap-2 
              sm-only:gap-1.5 md-only:gap-1.5 lg-only:gap-1.5 xl-only:gap-1.5"
            >
              <label
                className="font-normal text-negro
                sxs-only:text-base xs-only:text-base
                sm-only:text-[0.9rem] md-only:text-[0.9rem] lg-only:text-[0.9rem] xl-only:text-[0.9rem]"
              >
                Desde:
              </label>
              <div
                className="flex flex-wrap justify-center items-center w-full
                sxs-only:gap-2 xs-only:gap-2 
                sm-only:gap-1.5 md-only:gap-1.5 lg-only:gap-1.5 xl-only:gap-1.5
                sxs-only:min-h-[40px] xs-only:min-h-[40px]
                sm-only:min-h-[36px] md-only:min-h-[36px] lg-only:min-h-[36px] xl-only:min-h-[36px]"
              >
                <SiasisSelect
                  name="DesdeMes"
                  className="w-full
                    sxs-only:text-[0.85rem] sxs-only:max-w-[8rem]
                    xs-only:text-[0.85rem] xs-only:max-w-[8rem]
                    sm-only:text-[0.765rem] sm-only:max-w-[15rem]
                    md-only:text-[0.765rem] md-only:max-w-[15rem]
                    lg-only:text-[0.765rem] lg-only:max-w-[15rem]
                    xl-only:text-[0.765rem] xl-only:max-w-[15rem]"
                  value={rangoTiempoSeleccionado.DesdeMes}
                  onChange={handleChange}
                >
                  <>
                    {mesesDisponibles.map(({ value, label }) => (
                      <option
                        className="sxs-only:text-[0.8rem] xs-only:text-[0.8rem]
                          sm-only:text-[0.72rem] md-only:text-[0.72rem] lg-only:text-[0.72rem] xl-only:text-[0.72rem]"
                        key={value}
                        value={value}
                      >
                        {label}
                      </option>
                    ))}
                  </>
                </SiasisSelect>
              </div>
            </div>

            {/* Hasta - Por Meses */}
            <div
              className="w-full flex flex-col 
              sxs-only:gap-2 xs-only:gap-2 
              sm-only:gap-1.5 md-only:gap-1.5 lg-only:gap-1.5 xl-only:gap-1.5"
            >
              <label
                className="font-normal text-negro
                sxs-only:text-base xs-only:text-base
                sm-only:text-[0.9rem] md-only:text-[0.9rem] lg-only:text-[0.9rem] xl-only:text-[0.9rem]"
              >
                Hasta:
              </label>
              <div
                className="flex flex-wrap justify-center items-center w-full
                sxs-only:gap-2 xs-only:gap-2 
                sm-only:gap-1.5 md-only:gap-1.5 lg-only:gap-1.5 xl-only:gap-1.5
                sxs-only:min-h-[40px] xs-only:min-h-[40px]
                sm-only:min-h-[36px] md-only:min-h-[36px] lg-only:min-h-[36px] xl-only:min-h-[36px]"
              >
                <SiasisSelect
                  name="HastaMes"
                  className="w-full
                    sxs-only:text-[0.85rem] sxs-only:max-w-[8rem]
                    xs-only:text-[0.85rem] xs-only:max-w-[8rem]
                    sm-only:text-[0.765rem] sm-only:max-w-[15rem]
                    md-only:text-[0.765rem] md-only:max-w-[15rem]
                    lg-only:text-[0.765rem] lg-only:max-w-[15rem]
                    xl-only:text-[0.765rem] xl-only:max-w-[15rem]"
                  value={rangoTiempoSeleccionado.HastaMes}
                  onChange={handleChange}
                >
                  <>
                    {mesesDisponiblesHasta.map(({ value, label }) => (
                      <option
                        className="sxs-only:text-[0.8rem] xs-only:text-[0.8rem]
                          sm-only:text-[0.72rem] md-only:text-[0.72rem] lg-only:text-[0.72rem] xl-only:text-[0.72rem]"
                        key={value}
                        value={value}
                      >
                        {label}
                      </option>
                    ))}
                  </>
                </SiasisSelect>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SelectorTipoReporteAsistenciasEscolares;
