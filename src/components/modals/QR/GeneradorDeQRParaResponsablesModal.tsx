import { useEffect } from "react";
import ModalContainer from "../ModalContainer";
import { useQRGenerator } from "@/hooks/generators/useQRGenerator";
import CompartirIcon from "@/components/icons/CompartirIcon";
import DescargarIcon from "@/components/icons/DescargarIcon";
import QRIcon from "@/components/icons/QRIcon";
import Loader from "@/components/shared/loaders/Loader";
import { NivelEducativoTextos } from "@/Assets/NivelEducativoTextos";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";
import { useDetectorNavegador } from "@/hooks/useDetectorNavegador";
import { NavegadoresWeb } from "@/interfaces/shared/NavegadoresWeb";
import { EstudianteConAulaYRelacion } from "@/interfaces/shared/Estudiantes";

declare global {
  interface Window {
    QRCode: any;
    jspdf: any;
    html2canvas: any;
  }
}

// Estilos específicos por navegador
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

interface Props {
  EstudianteConAulaYRelacion: EstudianteConAulaYRelacion;
  eliminarModal: () => void;
}

const GeneradorDeTarjetaQRModal = ({
  EstudianteConAulaYRelacion,
  eliminarModal,
}: Props) => {
  const {
    hiddenCardsRef,
    selectedQuantity,
    setSelectedQuantity,
    isGeneratingPDF,
    currentPdfBlob,
    shareSupported,
    pdfPreviewUrl,
    initializeShareSupport,
    generatePDFStable,
    downloadPDF,
    sharePDF,
    cleanup,
  } = useQRGenerator(EstudianteConAulaYRelacion);

  // Detectar navegador
  const navegador = useDetectorNavegador();
  const estilos = ESTILOS_POR_NAVEGADORES[navegador];

  // Construir clases del loader
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

  // Construir clases del iframe
  const clasesIframe = [
    "w-full rounded-lg max-md:my-4",
    "landscape-small:max-md:my-[0.9rem]",
    "landscape-tablet-sm:max-md:my-[0.9rem]",
    "landscape-small:rounded-[0.45rem]",
    "landscape-tablet-sm:rounded-[0.45rem]",
    estilos.AspectRatioVisualizadorDePdf,
  ].join(" ");

  useEffect(() => {
    initializeShareSupport();
  }, [initializeShareSupport]);

  // EFECTO PARA GENERAR PDF INICIAL - SIN DEPENDENCIAS PROBLEMÁTICAS
  useEffect(() => {
    let isMounted = true;
    let attempts = 0;
    const maxAttempts = 20;

    const checkLibrariesAndGenerate = async () => {
      if (!isMounted) return;

      attempts++;

      if (window.QRCode && window.jspdf && window.html2canvas) {
        try {
          await generatePDFStable(selectedQuantity);
        } catch (error) {
          console.error("Error generating initial PDF:", error);
        }
      } else if (attempts < maxAttempts) {
        setTimeout(checkLibrariesAndGenerate, 200);
      } else {
        console.error("Libraries not loaded after maximum attempts");
      }
    };

    checkLibrariesAndGenerate();

    return () => {
      isMounted = false;
      cleanup();
    };
  }, [selectedQuantity]); // SOLO selectedQuantity como dependencia

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=B612:wght@400;700&display=swap"
        rel="stylesheet"
      />

      <ModalContainer eliminateModal={eliminarModal}>
        <div
          className="w-full max-w-6xl mx-auto bg-white rounded-lg
                        sxs-only:max-w-[95vw] sxs-only:max-h-[95vh]
                        xs-only:max-w-[95vw] xs-only:max-h-[95vh]
                        sm-only:max-w-[90vw] sm-only:max-h-[90vh]
                        lg-only:max-h-[85vh]
                        landscape-small:max-w-[64.8rem] landscape-small:max-h-[85vh] landscape-small:rounded-[0.45rem]
                        landscape-tablet-sm:max-w-[64.8rem] landscape-tablet-sm:max-h-[85vh] landscape-tablet-sm:rounded-[0.45rem]
                        overflow-y-auto"
        >
          <div
            className="flex
                          sxs-only:flex-col
                          xs-only:flex-col
                          sm-only:flex-col"
          >
            <div
              className="flex-1 flex items-center justify-center p-6 bg-gris-intermedio rounded-[10px] shadow-[0_0_8px_2px_rgba(0,0,0,0.4)_inset]
                            sxs-only:p-0.5
                            xs-only:p-0.5
                            sm-only:p-1
                            lg-only:p-4 py-4
                            landscape-small:p-[1.35rem] landscape-small:py-[0.9rem] landscape-small:rounded-[9px]
                            landscape-tablet-sm:p-[1.35rem] landscape-tablet-sm:py-[0.9rem] landscape-tablet-sm:rounded-[9px]"
            >
              <div
                className="w-full rounded-lg flex items-center justify-center
                              sxs-only:w-[75%] sxs-only:max-w-[200px]
                              xs-only:w-[75%] xs-only:max-w-[220px]
                              sm-only:w-[70%] sm-only:max-w-[260px]
                              landscape-small:rounded-[0.45rem] landscape-small:max-w-[234px]
                              landscape-tablet-sm:rounded-[0.45rem] landscape-tablet-sm:max-w-[234px]"
              >
                {isGeneratingPDF ? (
                  <div className={clasesLoader}>
                    <Loader
                      className="w-[2rem] sxs-only:w-[1.2rem] xs-only:w-[1.5rem] p-1 sxs-only:p-1.5 bg-white ml-2
                                      landscape-small:w-[1.8rem] landscape-small:p-[0.225rem] landscape-small:ml-[0.45rem]
                                      landscape-tablet-sm:w-[1.8rem] landscape-tablet-sm:p-[0.225rem] landscape-tablet-sm:ml-[0.45rem]"
                    />
                    <p
                      className="text-white font-semibold
                                  sxs-only:text-[10px]
                                  xs-only:text-xs
                                  sm-only:text-sm
                                  landscape-small:text-[12.6px]
                                  landscape-tablet-sm:text-[12.6px]"
                    >
                      Generando tarjetas...
                    </p>
                  </div>
                ) : pdfPreviewUrl ? (
                  <iframe
                    src={pdfPreviewUrl}
                    className={clasesIframe}
                    title="Vista previa del PDF"
                  />
                ) : (
                  <div className="text-center">
                    <div
                      className="text-4xl mb-2
                                    sxs-only:text-lg sxs-only:mb-0.5
                                    xs-only:text-xl xs-only:mb-0.5
                                    sm-only:text-2xl sm-only:mb-1
                                    landscape-small:text-[2.16rem] landscape-small:mb-[0.45rem]
                                    landscape-tablet-sm:text-[2.16rem] landscape-tablet-sm:mb-[0.45rem]"
                    >
                      📄
                    </div>
                    <p
                      className="text-gray-500
                                  sxs-only:text-[10px]
                                  xs-only:text-xs
                                  sm-only:text-sm
                                  landscape-small:text-[12.6px]
                                  landscape-tablet-sm:text-[12.6px]"
                    >
                      Vista previa del PDF
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div
              className="w-80 p-6 pl-8 pr-0
                            sxs-only:w-full sxs-only:p-1.5 sxs-only:pl-1.5 sxs-only:pr-1.5
                            xs-only:w-full xs-only:p-1.5 xs-only:pl-1.5 xs-only:pr-1.5
                            sm-only:w-full sm-only:p-2 sm-only:pl-2 sm-only:pr-2
                            lg-only:p-4 lg-only:pl-6 lg-only:pr-0
                            landscape-small:w-[18rem] landscape-small:p-[1.35rem] landscape-small:pl-[1.8rem] landscape-small:pr-0
                            landscape-tablet-sm:w-[18rem] landscape-tablet-sm:p-[1.35rem] landscape-tablet-sm:pl-[1.8rem] landscape-tablet-sm:pr-0"
            >
              <div
                className="mb-6
                              sxs-only:mb-3
                              xs-only:mb-3
                              sm-only:mb-4
                              md-only:mb-5
                              lg-only:mb-6
                              landscape-small:mb-[1.35rem]
                              landscape-tablet-sm:mb-[1.35rem]"
              >
                <div
                  className="flex items-center gap-2.5 mb-4 justify-center
                                sxs-only:gap-1.5 sxs-only:mb-2
                                xs-only:gap-2 xs-only:mb-2
                                sm-only:gap-2.5 sm-only:mb-3
                                md-only:gap-2.5 md-only:mb-3
                                lg-only:gap-2.5 lg-only:mb-4
                                landscape-small:gap-[0.5625rem] landscape-small:mb-[0.9rem]
                                landscape-tablet-sm:gap-[0.5625rem] landscape-tablet-sm:mb-[0.9rem]"
                >
                  <h3
                    className="font-semibold text-[1.2rem]
                                 sxs-only:text-xs
                                 xs-only:text-sm
                                 sm-only:text-base
                                 lg-only:text-lg
                                 landscape-small:text-[1.08rem]
                                 landscape-tablet-sm:text-[1.08rem]"
                  >
                    Generación de QR
                  </h3>
                  <QRIcon
                    className="w-[26px]
                                     sxs-only:w-[14px]
                                     xs-only:w-[16px]
                                     sm-only:w-[18px]
                                     lg-only:w-[22px]
                                     landscape-small:w-[23.4px]
                                     landscape-tablet-sm:w-[23.4px]"
                  />
                </div>

                <p
                  className="text-sm text-gray-600 mb-4 text-center
                               sxs-only:text-[9px] sxs-only:mb-2
                               xs-only:text-[10px] xs-only:mb-2
                               sm-only:text-xs sm-only:mb-3
                               md-only:text-sm md-only:mb-3
                               lg-only:text-sm lg-only:mb-4
                               landscape-small:text-[12.6px] landscape-small:mb-[0.9rem]
                               landscape-tablet-sm:text-[12.6px] landscape-tablet-sm:mb-[0.9rem]"
                >
                  Seleccione la cantidad de tarjetas:
                </p>

                <div
                  className="grid grid-cols-2 gap-3 mb-6
                                sxs-only:gap-1.5 sxs-only:mb-3
                                xs-only:gap-2 xs-only:mb-3
                                sm-only:gap-2.5 sm-only:mb-4
                                md-only:gap-3 md-only:mb-5
                                lg-only:gap-3 lg-only:mb-5
                                landscape-small:gap-[0.675rem] landscape-small:mb-[1.35rem]
                                landscape-tablet-sm:gap-[0.675rem] landscape-tablet-sm:mb-[1.35rem]"
                >
                  {[1, 2, 3, 4].map((num) => (
                    <button
                      key={num}
                      onClick={() => setSelectedQuantity(num)}
                      disabled={isGeneratingPDF}
                      className={`
                        w-full h-12 rounded-lg border-2 font-semibold text-lg transition-all
                        sxs-only:h-6 sxs-only:text-xs sxs-only:rounded
                        xs-only:h-7 xs-only:text-xs xs-only:rounded
                        sm-only:h-8 sm-only:text-sm sm-only:rounded-md
                        lg-only:h-9 lg-only:text-base
                        landscape-small:h-[2.7rem] landscape-small:text-[16.2px] landscape-small:rounded-[0.45rem] landscape-small:border-[1.8px]
                        landscape-tablet-sm:h-[2.7rem] landscape-tablet-sm:text-[16.2px] landscape-tablet-sm:rounded-[0.45rem] landscape-tablet-sm:border-[1.8px]
                        ${
                          selectedQuantity === num
                            ? "bg-red-500 text-white border-red-500"
                            : "bg-white text-gray-700 border-gray-300 hover:border-red-300"
                        }
                        ${
                          isGeneratingPDF
                            ? "opacity-50 cursor-not-allowed"
                            : "cursor-pointer"
                        }
                      `}
                    >
                      {num}
                    </button>
                  ))}
                </div>

                <div
                  className="bg-blue-50 p-3 rounded-lg mb-4
                                sxs-only:p-1.5 sxs-only:mb-2 sxs-only:rounded
                                xs-only:p-1.5 xs-only:mb-2 xs-only:rounded
                                sm-only:p-2 sm-only:mb-3 sm-only:rounded-md
                                md-only:p-2.5 md-only:mb-3
                                lg-only:p-3 lg-only:mb-4
                                landscape-small:p-[0.675rem] landscape-small:mb-[0.9rem] landscape-small:rounded-[0.45rem]
                                landscape-tablet-sm:p-[0.675rem] landscape-tablet-sm:mb-[0.9rem] landscape-tablet-sm:rounded-[0.45rem]"
                >
                  <div
                    className="text-sm
                                  sxs-only:text-[9px] sxs-only:leading-tight
                                  xs-only:text-[10px] xs-only:leading-tight
                                  sm-only:text-xs sm-only:leading-tight
                                  lg-only:text-xs
                                  landscape-small:text-[12.6px] landscape-small:leading-tight
                                  landscape-tablet-sm:text-[12.6px] landscape-tablet-sm:leading-tight"
                  >
                    <p className="font-medium text-blue-800 text-center">
                      {EstudianteConAulaYRelacion.Nombres}{" "}
                      {EstudianteConAulaYRelacion.Apellidos}
                    </p>
                    {EstudianteConAulaYRelacion.aula && (
                      <p className="text-blue-600 text-center">
                        {`${EstudianteConAulaYRelacion.aula.Grado}° ${
                          EstudianteConAulaYRelacion.aula.Seccion
                        } - ${
                          NivelEducativoTextos[
                            EstudianteConAulaYRelacion.aula
                              .Nivel as NivelEducativo
                          ]
                        }`}
                      </p>
                    )}
                  </div>
                </div>

                <div
                  className="space-y-3
                                sxs-only:space-y-1.5
                                xs-only:space-y-1.5
                                sm-only:space-y-2
                                md-only:space-y-2.5
                                lg-only:space-y-3
                                landscape-small:space-y-[0.675rem]
                                landscape-tablet-sm:space-y-[0.675rem]"
                >
                  <button
                    onClick={downloadPDF}
                    disabled={!currentPdfBlob || isGeneratingPDF}
                    className="w-full py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors
                               sxs-only:py-1 sxs-only:text-[10px] sxs-only:gap-1 sxs-only:rounded
                               xs-only:py-1.5 xs-only:text-xs xs-only:gap-1 xs-only:rounded
                               sm-only:py-2 sm-only:text-sm sm-only:gap-1.5 sm-only:rounded-md
                               md-only:py-2.5 md-only:gap-2
                               lg-only:py-2.5 lg-only:text-sm lg-only:gap-2
                               landscape-small:py-[0.675rem] landscape-small:text-[12.6px] landscape-small:gap-[0.45rem] landscape-small:rounded-[0.45rem]
                               landscape-tablet-sm:py-[0.675rem] landscape-tablet-sm:text-[12.6px] landscape-tablet-sm:gap-[0.45rem] landscape-tablet-sm:rounded-[0.45rem]"
                  >
                    Descargar
                    <DescargarIcon
                      className="w-5
                                              sxs-only:w-3
                                              xs-only:w-3.5
                                              sm-only:w-4
                                              md-only:w-4
                                              lg-only:w-4
                                              landscape-small:w-[18px]
                                              landscape-tablet-sm:w-[18px]"
                    />
                  </button>

                  <button
                    onClick={sharePDF}
                    disabled={
                      !currentPdfBlob || isGeneratingPDF || !shareSupported
                    }
                    className="w-full py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors
                               sxs-only:py-1 sxs-only:text-[10px] sxs-only:gap-1 sxs-only:rounded
                               xs-only:py-1.5 xs-only:text-xs xs-only:gap-1 xs-only:rounded
                               sm-only:py-2 sm-only:text-sm sm-only:gap-1.5 sm-only:rounded-md
                               md-only:py-2.5 md-only:gap-2
                               lg-only:py-2.5 lg-only:text-sm lg-only:gap-2
                               landscape-small:py-[0.675rem] landscape-small:text-[12.6px] landscape-small:gap-[0.45rem] landscape-small:rounded-[0.45rem]
                               landscape-tablet-sm:py-[0.675rem] landscape-tablet-sm:text-[12.6px] landscape-tablet-sm:gap-[0.45rem] landscape-tablet-sm:rounded-[0.45rem]"
                  >
                    Compartir
                    <CompartirIcon
                      className="w-5 text-white
                                             sxs-only:w-3
                                             xs-only:w-3.5
                                             sm-only:w-4
                                             md-only:w-4
                                             lg-only:w-4
                                             landscape-small:w-[18px]
                                             landscape-tablet-sm:w-[18px]"
                    />
                  </button>

                  {!shareSupported && (
                    <p
                      className="text-center text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-200
                                   sxs-only:text-[8px] sxs-only:p-0.5 sxs-only:leading-tight sxs-only:rounded
                                   xs-only:text-[9px] xs-only:p-0.5 xs-only:leading-tight xs-only:rounded
                                   sm-only:text-[10px] sm-only:p-1 sm-only:leading-tight sm-only:rounded-md
                                   lg-only:text-[11px] lg-only:p-1 lg-only:leading-tight
                                   landscape-small:text-[9.9px] landscape-small:p-[0.45rem] landscape-small:leading-tight landscape-small:rounded-[0.45rem] landscape-small:border-[0.9px]
                                   landscape-tablet-sm:text-[9.9px] landscape-tablet-sm:p-[0.45rem] landscape-tablet-sm:leading-tight landscape-tablet-sm:rounded-[0.45rem] landscape-tablet-sm:border-[0.9px]"
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

export default GeneradorDeTarjetaQRModal;
