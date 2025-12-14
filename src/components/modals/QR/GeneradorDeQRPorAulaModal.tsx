import { useEffect, useState } from "react";
import ModalContainer from "../ModalContainer";
import { useQRGeneratorPorAula } from "@/hooks/generators/useQRGeneratorPorAula";
import CompartirIcon from "@/components/icons/CompartirIcon";
import DescargarIcon from "@/components/icons/DescargarIcon";
import QRIcon from "@/components/icons/QRIcon";
import Loader from "@/components/shared/loaders/Loader";
import { useDetectorNavegador } from "@/hooks/useDetectorNavegador";
import { NavegadoresWeb } from "@/interfaces/shared/NavegadoresWeb";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";
import { NivelEducativoTextos } from "@/Assets/NivelEducativoTextos";

declare global {
  interface Window {
    QRCode: any;
    jspdf: any;
    html2canvas: any;
  }
}

interface Props {
  eliminarModal: () => void;
  restriccionNivel?: NivelEducativo;
  idAulaRestringida?: string;
}

// Estados del modal
enum EstadosModal {
  INICIAL = "inicial", // Solo dropdowns + botón generar deshabilitado
  SELECCIONADO = "seleccionado", // Dropdowns + info aula + botón generar habilitado
  GENERADO = "generado", // Solo info aula + botones de acción
}

// Estilos por navegador
const ESTILOS_POR_NAVEGADORES: Record<
  NavegadoresWeb,
  {
    AnchoContenedorLoader: string;
    AspectRatioVisualizadorDePdf: string;
    AnchoContenedorLoaderResponsive: {
      sxsOnly: string;
      xsOnly: string;
      smOnly: string;
      mdOnly: string;
      lgOnly: string;
      landscapeSmall: string;
      landscapeTabletSm: string;
    };
  }
> = {
  [NavegadoresWeb.Chrome]: {
    AnchoContenedorLoader: "w-[18.75rem]",
    AspectRatioVisualizadorDePdf: "aspect-[1/1.55]",
    AnchoContenedorLoaderResponsive: {
      sxsOnly: "sxs-only:w-[12rem]",
      xsOnly: "xs-only:w-[13rem]",
      smOnly: "sm-only:w-[14rem]",
      mdOnly: "md-only:w-[16rem]",
      lgOnly: "lg-only:w-[18rem]",
      landscapeSmall: "landscape-small:w-[16.875rem]",
      landscapeTabletSm: "landscape-tablet-sm:w-[16.875rem]",
    },
  },
  [NavegadoresWeb.Edge]: {
    AnchoContenedorLoader: "w-[18.75rem]",
    AspectRatioVisualizadorDePdf: "aspect-[4/5]",
    AnchoContenedorLoaderResponsive: {
      sxsOnly: "sxs-only:w-[12rem]",
      xsOnly: "xs-only:w-[13rem]",
      smOnly: "sm-only:w-[14rem]",
      mdOnly: "md-only:w-[16rem]",
      lgOnly: "lg-only:w-[18rem]",
      landscapeSmall: "landscape-small:w-[16.875rem]",
      landscapeTabletSm: "landscape-tablet-sm:w-[16.875rem]",
    },
  },
  [NavegadoresWeb.Firefox]: {
    AnchoContenedorLoader: "w-[18.75rem]",
    AspectRatioVisualizadorDePdf: "aspect-[4/5]",
    AnchoContenedorLoaderResponsive: {
      sxsOnly: "sxs-only:w-[12rem]",
      xsOnly: "xs-only:w-[13rem]",
      smOnly: "sm-only:w-[14rem]",
      mdOnly: "md-only:w-[16rem]",
      lgOnly: "lg-only:w-[18rem]",
      landscapeSmall: "landscape-small:w-[16.875rem]",
      landscapeTabletSm: "landscape-tablet-sm:w-[16.875rem]",
    },
  },
  [NavegadoresWeb.Otro]: {
    AnchoContenedorLoader: "w-[18.75rem]",
    AspectRatioVisualizadorDePdf: "aspect-[4/5]",
    AnchoContenedorLoaderResponsive: {
      sxsOnly: "sxs-only:w-[12rem]",
      xsOnly: "xs-only:w-[13rem]",
      smOnly: "sm-only:w-[14rem]",
      mdOnly: "md-only:w-[16rem]",
      lgOnly: "lg-only:w-[18rem]",
      landscapeSmall: "landscape-small:w-[16.875rem]",
      landscapeTabletSm: "landscape-tablet-sm:w-[16.875rem]",
    },
  },
};

const GeneradorQRParametrizado = ({
  eliminarModal,
  restriccionNivel,
  idAulaRestringida,
}: Props) => {
  const {
    hiddenCardsRef,
    grados,
    gradoSeleccionado,
    secciones,
    seccionSeleccionada,
    aulaSeleccionada,
    estudiantesDelAula,
    isGeneratingPDF,
    currentPdfBlob,
    shareSupported,
    pdfPreviewUrl,
    paginasEstimadas,
    initializeShareSupport,
    cargarGradosDisponibles,
    handleGradoChange,
    handleSeccionChange,
    generatePDFParaAula,
    downloadPDF,
    sharePDF,
    cleanup,
    limpiarSelecciones,
  } = useQRGeneratorPorAula();

  // Estados locales
  const [estadoModal, setEstadoModal] = useState<EstadosModal>(
    EstadosModal.INICIAL
  );
  const [nivelSeleccionado, setNivelSeleccionado] = useState<NivelEducativo>(
    restriccionNivel || NivelEducativo.PRIMARIA
  );

  // Detectar navegador
  const navegador = useDetectorNavegador();
  const estilos = ESTILOS_POR_NAVEGADORES[navegador];

  // Construir clases del loader e iframe
  const clasesLoader = [
    "my-4 text-center flex items-center justify-center flex-col gap-2",
    "landscape-small:my-[0.9rem] landscape-small:gap-[0.45rem]",
    "landscape-tablet-sm:my-[0.9rem] landscape-tablet-sm:gap-[0.45rem]",
    estilos.AnchoContenedorLoader,
    estilos.AspectRatioVisualizadorDePdf,
    estilos.AnchoContenedorLoaderResponsive.sxsOnly,
    estilos.AnchoContenedorLoaderResponsive.xsOnly,
    estilos.AnchoContenedorLoaderResponsive.smOnly,
    estilos.AnchoContenedorLoaderResponsive.mdOnly,
    estilos.AnchoContenedorLoaderResponsive.lgOnly,
    estilos.AnchoContenedorLoaderResponsive.landscapeSmall,
    estilos.AnchoContenedorLoaderResponsive.landscapeTabletSm,
    "sxs-only:gap-0.5",
    "xs-only:gap-0.5",
    "sm-only:gap-1",
  ].join(" ");

  const clasesIframe = [
    "w-full rounded-lg max-md:my-4",
    "landscape-small:max-md:my-[0.9rem]",
    "landscape-tablet-sm:max-md:my-[0.9rem]",
    "landscape-small:rounded-[0.45rem]",
    "landscape-tablet-sm:rounded-[0.45rem]",
    estilos.AspectRatioVisualizadorDePdf,
  ].join(" ");

  // Control de estados del modal
  useEffect(() => {
    if (currentPdfBlob) {
      setEstadoModal(EstadosModal.GENERADO);
    } else if (gradoSeleccionado && seccionSeleccionada && aulaSeleccionada) {
      setEstadoModal(EstadosModal.SELECCIONADO);
    } else {
      setEstadoModal(EstadosModal.INICIAL);
    }
  }, [
    currentPdfBlob,
    gradoSeleccionado,
    seccionSeleccionada,
    aulaSeleccionada,
  ]);

  // Función de limpiar personalizada
  const handleLimpiar = () => {
    limpiarSelecciones();
    setEstadoModal(EstadosModal.INICIAL);
  };

  // Inicialización
  useEffect(() => {
    initializeShareSupport();
    // Cargar grados según restricciones o nivel por defecto
    const nivelInicial = restriccionNivel || nivelSeleccionado;
    cargarGradosDisponibles(nivelInicial, idAulaRestringida);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initializeShareSupport]);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // Lógica de habilitación del botón generar
  const puedeGenerarPDF =
    aulaSeleccionada && estudiantesDelAula.length > 0 && !isGeneratingPDF;
  const estudiantesCount = estudiantesDelAula.length;

  // Determinar si mostrar selector de nivel
  const mostrarSelectorNivel = !restriccionNivel && !idAulaRestringida;

  // Determinar si mostrar selectores de grado/sección
  const mostrarSelectoresGradoSeccion = !idAulaRestringida;

  // Handler para cambio de nivel (solo para Directivos)
  const handleNivelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nuevoNivel = e.target.value as NivelEducativo;
    setNivelSeleccionado(nuevoNivel);
    limpiarSelecciones();
    cargarGradosDisponibles(nuevoNivel);
  };

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=B612:wght@400;700&display=swap"
        rel="stylesheet"
      />

      <ModalContainer eliminateModal={eliminarModal}>
        <div
          className="w-full max-w-6xl mx-auto bg-white rounded-lg
                        sxs-only:max-w-[92vw] sxs-only:max-h-[88vh]
                        xs-only:max-w-[92vw] xs-only:max-h-[88vh]
                        sm-only:max-w-[92vw] sm-only:max-h-[85vh]
                        md-only:max-w-[90vw] md-only:max-h-[82vh]
                        lg-only:max-w-[85vw] lg-only:max-h-[80vh]
                        xl-only:max-w-[80vw] xl-only:max-h-[78vh]
                        landscape-small:max-w-[92vw] landscape-small:max-h-[82vh] landscape-small:rounded-[0.4rem]
                        landscape-tablet-sm:max-w-[90vw] landscape-tablet-sm:max-h-[80vh] landscape-tablet-sm:rounded-[0.4rem]
                        overflow-y-auto"
        >
          {/* Grid principal */}
          <div
            className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4
                          sxs-only:grid-cols-1 sxs-only:gap-2
                          xs-only:grid-cols-1 xs-only:gap-2
                          sm-only:grid-cols-1 sm-only:gap-3
                          md-only:grid-cols-1 md-only:gap-3
                          lg-only:gap-5
                          landscape-small:grid-cols-[1fr_280px] landscape-small:gap-[0.9rem]
                          landscape-tablet-sm:grid-cols-[1fr_300px] landscape-tablet-sm:gap-[0.9rem]"
          >
            {/* Panel de vista previa */}
            <div
              className="flex flex-col p-4 bg-gris-intermedio rounded-[9px] shadow-[0_0_7px_2px_rgba(0,0,0,0.4)_inset]
                            sxs-only:p-2
                            xs-only:p-2
                            sm-only:p-3
                            lg-only:p-4
                            landscape-small:p-[0.9rem] landscape-small:rounded-[8px]
                            landscape-tablet-sm:p-[0.9rem] landscape-tablet-sm:rounded-[8px]"
            >
              {/* Visualizador */}
              <div
                className="flex-1 flex items-center justify-center min-h-[200px]
                              sxs-only:min-h-[140px]
                              xs-only:min-h-[160px]
                              sm-only:min-h-[180px]
                              lg-only:min-h-[220px]
                              landscape-small:min-h-[160px]
                              landscape-tablet-sm:min-h-[180px]"
              >
                <div
                  className="w-full max-w-[300px] rounded-lg flex items-center justify-center
                                sxs-only:max-w-[200px]
                                xs-only:max-w-[220px]
                                sm-only:max-w-[260px]
                                lg-only:max-w-[320px]
                                xl-only:max-w-[360px]
                                landscape-small:rounded-[0.4rem] landscape-small:max-w-[280px]
                                landscape-tablet-sm:rounded-[0.4rem] landscape-tablet-sm:max-w-[280px]"
                >
                  {isGeneratingPDF ? (
                    <div className={clasesLoader}>
                      <Loader
                        className="w-[1.8rem] sxs-only:w-[1.1rem] xs-only:w-[1.35rem] p-1 sxs-only:p-1 bg-white ml-1.5
                                        lg-only:w-[2rem] xl-only:w-[2.2rem]
                                        landscape-small:w-[1.6rem] landscape-small:p-[0.2rem] landscape-small:ml-[0.4rem]
                                        landscape-tablet-sm:w-[1.6rem] landscape-tablet-sm:p-[0.2rem] landscape-tablet-sm:ml-[0.4rem]"
                      />
                      <p
                        className="text-white font-medium
                                    sxs-only:text-[9px]
                                    xs-only:text-[11px]
                                    sm-only:text-[13px]
                                    lg-only:text-sm
                                    xl-only:text-base
                                    landscape-small:text-[11.5px]
                                    landscape-tablet-sm:text-[11.5px]"
                      >
                        Generando {estudiantesCount} tarjetas...
                      </p>
                    </div>
                  ) : pdfPreviewUrl ? (
                    <iframe
                      src={pdfPreviewUrl}
                      className={clasesIframe}
                      title="Vista previa del PDF del aula"
                    />
                  ) : (
                    <div className="text-center">
                      <div
                        className="text-4xl mb-2
                                      sxs-only:text-lg sxs-only:mb-1
                                      xs-only:text-xl xs-only:mb-1
                                      sm-only:text-2xl sm-only:mb-1.5
                                      lg-only:text-5xl lg-only:mb-3
                                      xl-only:text-6xl xl-only:mb-4
                                      landscape-small:text-[2rem] landscape-small:mb-[0.45rem]
                                      landscape-tablet-sm:text-[2rem] landscape-tablet-sm:mb-[0.45rem]"
                      >
                        📄
                      </div>
                      <p
                        className="text-gray-500
                                    sxs-only:text-[10px]
                                    xs-only:text-[12px]
                                    sm-only:text-sm
                                    lg-only:text-base
                                    xl-only:text-lg
                                    landscape-small:text-[12.6px]
                                    landscape-tablet-sm:text-[12.6px]"
                      >
                        Vista previa del PDF
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Panel de configuración */}
            <div
              className="p-4
                            sxs-only:p-2
                            xs-only:p-2
                            sm-only:p-3
                            lg-only:p-4
                            landscape-small:p-[0.9rem]
                            landscape-tablet-sm:p-[0.9rem]"
            >
              {/* Título */}
              <div
                className="mb-4
                              sxs-only:mb-1.5
                              xs-only:mb-1.5
                              sm-only:mb-2.5
                              lg-only:mb-4
                              landscape-small:mb-[0.8rem]
                              landscape-tablet-sm:mb-[0.8rem]"
              >
                <div
                  className="flex items-center gap-2 mb-4 justify-center
                                sxs-only:gap-1 sxs-only:mb-1.5
                                xs-only:gap-1.5 xs-only:mb-1.5
                                sm-only:gap-2 sm-only:mb-2.5
                                lg-only:gap-2.5 lg-only:mb-4
                                landscape-small:gap-[0.45rem] landscape-small:mb-[0.8rem]
                                landscape-tablet-sm:gap-[0.45rem] landscape-tablet-sm:mb-[0.8rem]"
                >
                  <h3
                    className="font-semibold text-lg
                                 sxs-only:text-xs
                                 xs-only:text-sm
                                 sm-only:text-base
                                 lg-only:text-lg
                                 landscape-small:text-[1rem]
                                 landscape-tablet-sm:text-[1rem]"
                  >
                    QR por Aula
                  </h3>
                  <QRIcon
                    className="w-5
                                     sxs-only:w-3.5
                                     xs-only:w-4
                                     sm-only:w-4.5
                                     lg-only:w-6
                                     xl-only:w-7
                                     landscape-small:w-[18px]
                                     landscape-tablet-sm:w-[18px]"
                  />
                </div>

                {/* ESTADO INICIAL O SELECCIONADO: Mostrar dropdowns */}
                {(estadoModal === EstadosModal.INICIAL ||
                  estadoModal === EstadosModal.SELECCIONADO) && (
                  <div
                    className="grid grid-cols-1 gap-3
                                  sxs-only:gap-1.5
                                  xs-only:gap-1.5
                                  sm-only:gap-2
                                  md:grid-cols-[80px_1fr_80px]
                                  lg:grid-cols-1
                                  lg-only:gap-4
                                  xl-only:gap-5
                                  landscape-small:gap-[0.55rem]
                                  landscape-tablet-sm:gap-[0.55rem]"
                  >
                    {/* Selector de Nivel - solo si no hay restricciones */}
                    {mostrarSelectorNivel && (
                      <div>
                        <label
                          className="block text-xs font-medium text-gray-700 mb-1
                                        sxs-only:text-[9px] sxs-only:mb-0.5
                                        xs-only:text-[10px] xs-only:mb-0.5
                                        sm-only:text-xs sm-only:mb-0.5
                                        lg-only:text-sm lg-only:mb-1.5
                                        xl-only:text-base xl-only:mb-2
                                        landscape-small:text-[11px] landscape-small:mb-[0.2rem]
                                        landscape-tablet-sm:text-[11px] landscape-tablet-sm:mb-[0.2rem]"
                        >
                          Nivel
                        </label>
                        <select
                          value={nivelSeleccionado}
                          onChange={handleNivelChange}
                          className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                                   sxs-only:p-1 sxs-only:text-[9px] sxs-only:rounded
                                   xs-only:p-1 xs-only:text-[10px] xs-only:rounded
                                   sm-only:p-1.5 sm-only:text-xs sm-only:rounded-sm
                                   lg-only:p-2.5 lg-only:text-sm
                                   xl-only:p-3 xl-only:text-base
                                   landscape-small:p-[0.35rem] landscape-small:text-[11px] landscape-small:rounded-[0.35rem]
                                   landscape-tablet-sm:p-[0.35rem] landscape-tablet-sm:text-[11px] landscape-tablet-sm:rounded-[0.35rem]"
                        >
                          {Object.values(NivelEducativo).map((nivel) => (
                            <option key={nivel} value={nivel}>
                              {NivelEducativoTextos[nivel]}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Grid para Grado y Sección - solo si no hay restricción de aula */}
                    {mostrarSelectoresGradoSeccion && (
                      <div
                        className={`grid grid-cols-2 gap-3 ${
                          mostrarSelectorNivel
                            ? "md:col-span-2 lg:col-span-1"
                            : ""
                        }
                                    sxs-only:gap-1.5
                                    xs-only:gap-1.5
                                    sm-only:gap-2
                                    lg-only:gap-4
                                    xl-only:gap-5
                                    landscape-small:gap-[0.55rem]
                                    landscape-tablet-sm:gap-[0.55rem]`}
                      >
                        {/* Selector de Grado */}
                        <div>
                          <label
                            className="block text-xs font-medium text-gray-700 mb-1
                                          sxs-only:text-[9px] sxs-only:mb-0.5
                                          xs-only:text-[10px] xs-only:mb-0.5
                                          sm-only:text-xs sm-only:mb-0.5
                                          lg-only:text-sm lg-only:mb-1.5
                                          xl-only:text-base xl-only:mb-2
                                          landscape-small:text-[11px] landscape-small:mb-[0.2rem]
                                          landscape-tablet-sm:text-[11px] landscape-tablet-sm:mb-[0.2rem]"
                          >
                            Grado
                          </label>
                          <select
                            value={gradoSeleccionado || ""}
                            onChange={(e) =>
                              handleGradoChange(Number(e.target.value))
                            }
                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                                       sxs-only:p-1 sxs-only:text-[9px] sxs-only:rounded
                                       xs-only:p-1 xs-only:text-[10px] xs-only:rounded
                                       sm-only:p-1.5 sm-only:text-xs sm-only:rounded-sm
                                       lg-only:p-2.5 lg-only:text-sm
                                       xl-only:p-3 xl-only:text-base
                                       landscape-small:p-[0.35rem] landscape-small:text-[11px] landscape-small:rounded-[0.35rem]
                                       landscape-tablet-sm:p-[0.35rem] landscape-tablet-sm:text-[11px] landscape-tablet-sm:rounded-[0.35rem]"
                          >
                            <option value="">Grado</option>
                            {grados.map((grado) => (
                              <option key={grado} value={grado}>
                                {grado}°
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Selector de Sección */}
                        <div>
                          <label
                            className="block text-xs font-medium text-gray-700 mb-1
                                          sxs-only:text-[9px] sxs-only:mb-0.5
                                          xs-only:text-[10px] xs-only:mb-0.5
                                          sm-only:text-xs sm-only:mb-0.5
                                          lg-only:text-sm lg-only:mb-1.5
                                          xl-only:text-base xl-only:mb-2
                                          landscape-small:text-[11px] landscape-small:mb-[0.2rem]
                                          landscape-tablet-sm:text-[11px] landscape-tablet-sm:mb-[0.2rem]"
                          >
                            Sección
                          </label>
                          <select
                            value={seccionSeleccionada || ""}
                            onChange={(e) =>
                              handleSeccionChange(e.target.value)
                            }
                            disabled={!gradoSeleccionado}
                            className={`w-full p-2 border border-gray-300 rounded-md ${
                              !gradoSeleccionado
                                ? "bg-gray-100 cursor-not-allowed"
                                : "focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            }
                                       sxs-only:p-1 sxs-only:text-[9px] sxs-only:rounded
                                       xs-only:p-1 xs-only:text-[10px] xs-only:rounded
                                       sm-only:p-1.5 sm-only:text-xs sm-only:rounded-sm
                                       lg-only:p-2.5 lg-only:text-sm
                                       xl-only:p-3 xl-only:text-base
                                       landscape-small:p-[0.35rem] landscape-small:text-[11px] landscape-small:rounded-[0.35rem]
                                       landscape-tablet-sm:p-[0.35rem] landscape-tablet-sm:text-[11px] landscape-tablet-sm:rounded-[0.35rem]`}
                          >
                            <option value="">Sección</option>
                            {secciones.map((seccion) => (
                              <option key={seccion} value={seccion}>
                                {seccion}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ESTADO SELECCIONADO O GENERADO: Mostrar información del aula */}
                {(estadoModal === EstadosModal.SELECCIONADO ||
                  estadoModal === EstadosModal.GENERADO) &&
                  aulaSeleccionada && (
                    <div
                      className={`bg-blue-50 p-2 rounded-md border border-blue-200
                                sxs-only:p-1 sxs-only:rounded-sm
                                xs-only:p-1.5 xs-only:rounded-sm
                                sm-only:p-2 sm-only:rounded-sm
                                lg-only:p-2.5 lg-only:rounded-md
                                landscape-small:p-[0.35rem] landscape-small:rounded-[0.25rem]
                                landscape-tablet-sm:p-[0.35rem] landscape-tablet-sm:rounded-[0.25rem]
                                ${
                                  estadoModal === EstadosModal.SELECCIONADO
                                    ? "mt-3 lg-only:mt-4"
                                    : ""
                                }`}
                    >
                      <div
                        className="text-sm text-center leading-relaxed
                                  sxs-only:text-[8px] sxs-only:leading-tight
                                  xs-only:text-[9px] xs-only:leading-tight
                                  sm-only:text-[10px] sm-only:leading-tight
                                  lg-only:text-sm lg-only:leading-relaxed
                                  landscape-small:text-[11px] landscape-small:leading-tight
                                  landscape-tablet-sm:text-[11px] landscape-tablet-sm:leading-tight"
                      >
                        <div className="flex items-center justify-center gap-3 font-medium text-blue-800 mb-1 lg-only:mb-2 xl-only:mb-2.5">
                          {gradoSeleccionado}° {seccionSeleccionada} -{" "}
                          {
                            NivelEducativoTextos[
                              aulaSeleccionada.Nivel as NivelEducativo
                            ]
                          }
                          {estudiantesCount > 0 && (
                            <div className="flex items-center justify-center gap-1 lg-only:gap-1.5 xl-only:gap-2">
                              <div
                                className="w-2.5 h-2.5 rounded-full
                                       sxs-only:w-1.5 sxs-only:h-1.5
                                       xs-only:w-2 xs-only:h-2
                                       lg-only:w-3 lg-only:h-3
                                       xl-only:w-3.5 xl-only:h-3.5
                                       landscape-small:w-[8px] landscape-small:h-[8px]
                                       landscape-tablet-sm:w-[8px] landscape-tablet-sm:h-[8px]"
                                style={{
                                  backgroundColor: aulaSeleccionada.Color,
                                }}
                              />
                            </div>
                          )}
                        </div>
                        <p className="text-blue-600 mb-1 lg-only:mb-2 xl-only:mb-2.5">
                          {estudiantesCount === 0
                            ? `Sin estudiantes activos | No se pueden generar tarjetas QRs`
                            : `${estudiantesCount} estudiante${
                                estudiantesCount !== 1 ? "s" : ""
                              }`}
                        </p>
                        {estudiantesCount > 0 && (
                          <p className="text-blue-500 text-xs mb-1 lg-only:text-sm lg-only:mb-2 xl-only:text-base xl-only:mb-2.5">
                            {paginasEstimadas} página
                            {paginasEstimadas !== 1 ? "s" : ""} • 4
                            tarjetas/página
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                {/* Botones de acción según estado */}
                <div
                  className="mt-4 space-y-2
                                sxs-only:mt-2.5 sxs-only:space-y-1
                                xs-only:mt-2.5 xs-only:space-y-1
                                sm-only:mt-2.5 sm-only:space-y-1.5
                                lg-only:mt-4 lg-only:space-y-2
                                landscape-small:mt-[0.8rem] landscape-small:space-y-[0.35rem]
                                landscape-tablet-sm:mt-[0.8rem] landscape-tablet-sm:space-y-[0.35rem]"
                >
                  {/* ESTADO INICIAL O SELECCIONADO: Botón Generar PDF */}
                  {(estadoModal === EstadosModal.INICIAL ||
                    estadoModal === EstadosModal.SELECCIONADO) && (
                    <button
                      onClick={generatePDFParaAula}
                      disabled={!puedeGenerarPDF}
                      className="w-full py-2.5 bg-red-500 text-white rounded-md font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors
                                 sxs-only:py-1 sxs-only:text-[9px] sxs-only:gap-0.5 sxs-only:rounded
                                 xs-only:py-1.5 xs-only:text-[10px] xs-only:gap-0.5 xs-only:rounded
                                 sm-only:py-1.5 sm-only:text-xs sm-only:gap-1 sm-only:rounded-sm
                                 lg-only:py-3 lg-only:text-sm lg-only:gap-2.5
                                 xl-only:py-3.5 xl-only:text-base xl-only:gap-3
                                 landscape-small:py-[0.45rem] landscape-small:text-[11px] landscape-small:gap-[0.35rem] landscape-small:rounded-[0.35rem]
                                 landscape-tablet-sm:py-[0.45rem] landscape-tablet-sm:text-[11px] landscape-tablet-sm:gap-[0.35rem] landscape-tablet-sm:rounded-[0.35rem]"
                    >
                      {isGeneratingPDF ? "Generando..." : "Generar PDF"}
                      <QRIcon
                        className="w-4
                                                sxs-only:w-2.5
                                                xs-only:w-3
                                                sm-only:w-3.5
                                                lg-only:w-5
                                                xl-only:w-6
                                                landscape-small:w-[12px]
                                                landscape-tablet-sm:w-[12px]"
                      />
                    </button>
                  )}

                  {/* ESTADO GENERADO: Botones de descarga, compartir y limpiar */}
                  {estadoModal === EstadosModal.GENERADO && (
                    <>
                      <button
                        onClick={downloadPDF}
                        disabled={isGeneratingPDF}
                        className="w-full py-2.5 bg-blue-500 text-white rounded-md font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors
                                   sxs-only:py-1 sxs-only:text-[9px] sxs-only:gap-0.5 sxs-only:rounded
                                   xs-only:py-1.5 xs-only:text-[10px] xs-only:gap-0.5 xs-only:rounded
                                   sm-only:py-1.5 sm-only:text-xs sm-only:gap-1 sm-only:rounded-sm
                                   lg-only:py-3 lg-only:text-sm lg-only:gap-2.5
                                   xl-only:py-3.5 xl-only:text-base xl-only:gap-3
                                   landscape-small:py-[0.45rem] landscape-small:text-[11px] landscape-small:gap-[0.35rem] landscape-small:rounded-[0.35rem]
                                   landscape-tablet-sm:py-[0.45rem] landscape-tablet-sm:text-[11px] landscape-tablet-sm:gap-[0.35rem] landscape-tablet-sm:rounded-[0.35rem]"
                      >
                        Descargar
                        <DescargarIcon
                          className="w-4
                                                  sxs-only:w-2.5
                                                  xs-only:w-3
                                                  sm-only:w-3.5
                                                  lg-only:w-5
                                                  xl-only:w-6
                                                  landscape-small:w-[12px]
                                                  landscape-tablet-sm:w-[12px]"
                        />
                      </button>

                      <button
                        onClick={sharePDF}
                        disabled={isGeneratingPDF || !shareSupported}
                        className="w-full py-2.5 bg-green-500 text-white rounded-md font-medium hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors
                                   sxs-only:py-1 sxs-only:text-[9px] sxs-only:gap-0.5 sxs-only:rounded
                                   xs-only:py-1.5 xs-only:text-[10px] xs-only:gap-0.5 xs-only:rounded
                                   sm-only:py-1.5 sm-only:text-xs sm-only:gap-1 sm-only:rounded-sm
                                   lg-only:py-3 lg-only:text-sm lg-only:gap-2.5
                                   xl-only:py-3.5 xl-only:text-base xl-only:gap-3
                                   landscape-small:py-[0.45rem] landscape-small:text-[11px] landscape-small:gap-[0.35rem] landscape-small:rounded-[0.35rem]
                                   landscape-tablet-sm:py-[0.45rem] landscape-tablet-sm:text-[11px] landscape-tablet-sm:gap-[0.35rem] landscape-tablet-sm:rounded-[0.35rem]"
                      >
                        Compartir
                        <CompartirIcon
                          className="w-4 text-white
                                                 sxs-only:w-2.5
                                                 xs-only:w-3
                                                 sm-only:w-3.5
                                                 lg-only:w-5
                                                 xl-only:w-6
                                                 landscape-small:w-[12px]
                                                 landscape-tablet-sm:w-[12px]"
                        />
                      </button>

                      <button
                        onClick={handleLimpiar}
                        disabled={isGeneratingPDF}
                        className="w-full py-2 bg-gray-300 text-gray-700 rounded-md font-medium hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors
                                   sxs-only:py-0.5 sxs-only:text-[9px] sxs-only:rounded
                                   xs-only:py-1 xs-only:text-[10px] xs-only:rounded
                                   sm-only:py-1 sm-only:text-xs sm-only:rounded-sm
                                   lg-only:py-2.5 lg-only:text-sm
                                   xl-only:py-3 xl-only:text-base
                                   landscape-small:py-[0.35rem] landscape-small:text-[11px] landscape-small:rounded-[0.35rem]
                                   landscape-tablet-sm:py-[0.35rem] landscape-tablet-sm:text-[11px] landscape-tablet-sm:rounded-[0.35rem]"
                      >
                        Limpiar
                      </button>
                    </>
                  )}

                  {/* Mensajes informativos según estado */}
                  {!shareSupported && estadoModal === EstadosModal.GENERADO && (
                    <p
                      className="text-center text-amber-600 bg-amber-50 p-2 rounded-md border border-amber-200
                                   sxs-only:text-[7px] sxs-only:p-0.5 sxs-only:leading-tight sxs-only:rounded
                                   xs-only:text-[8px] xs-only:p-0.5 xs-only:leading-tight xs-only:rounded
                                   sm-only:text-[9px] sm-only:p-1 sm-only:leading-tight sm-only:rounded-sm
                                   lg-only:text-sm lg-only:p-3 lg-only:leading-relaxed
                                   xl-only:text-base xl-only:p-3.5 xl-only:leading-relaxed
                                   landscape-small:text-[9.5px] landscape-small:p-[0.35rem] landscape-small:leading-tight landscape-small:rounded-[0.35rem]
                                   landscape-tablet-sm:text-[9.5px] landscape-tablet-sm:p-[0.35rem] landscape-tablet-sm:leading-tight landscape-tablet-sm:rounded-[0.35rem]"
                    >
                      La función de compartir no está disponible en este
                      dispositivo. Use el botón "Descargar" para guardar el
                      archivo.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div ref={hiddenCardsRef} style={{ display: "none" }} />
        </div>
      </ModalContainer>
    </>
  );
};

export default GeneradorQRParametrizado;
