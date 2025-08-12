import { useEffect } from "react";
import { EstudianteDelResponsableConAula } from "@/app/(interfaz)/(responsable)/mis-estudiantes-relacionados/page";
import ModalContainer from "../ModalContainer";
import { useQRGenerator } from "@/hooks/generators/useQRGenerator";

declare global {
  interface Window {
    QRCode: any;
    jspdf: any;
    html2canvas: any;
  }
}

interface Props {
  estudianteDelResponsableConAula: EstudianteDelResponsableConAula;
  eliminarModal: () => void;
}

const GeneradorDeTarjetaQRModal = ({
  estudianteDelResponsableConAula,
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
  } = useQRGenerator(estudianteDelResponsableConAula);

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

  // EFECTO DE LIMPIEZA AL DESMONTAR
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
        <div className="w-full max-w-6xl mx-auto bg-white rounded-lg">


          <div className="flex">
            <div className="flex-1 flex items-center justify-center p-6 bg-gray-100">
              <div className="w-full aspect-[1/1.55] bg-white rounded-lg border-2 border-dashed border-green-300 flex items-center justify-center">
                {isGeneratingPDF ? (
                  <div className="text-center">
                    <div className="animate-spin rounded-full w-full aspect-[1/1.55] border-b-2 border-blue-500 mx-auto mb-2"></div>
                    <p className="text-gray-500">Generando tarjetas...</p>
                  </div>
                ) : pdfPreviewUrl ? (
                  <iframe
                    src={pdfPreviewUrl}
                    className="w-full aspect-[1/1.55] rounded-lg"
                    title="Vista previa del PDF"
                  />
                ) : (
                  <div className="text-center">
                    <div className="text-4xl mb-2">📄</div>
                    <p className="text-gray-500">Vista previa del PDF</p>
                  </div>
                )}
              </div>
            </div>

            <div className="w-80 p-6 border-l">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg">📏</span>
                  <h3 className="font-semibold">Configuración</h3>
                </div>

                <p className="text-sm text-gray-600 mb-4">
                  Seleccione la cantidad de tarjetas:
                </p>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  {[1, 2, 3, 4].map((num) => (
                    <button
                      key={num}
                      onClick={() => setSelectedQuantity(num)}
                      disabled={isGeneratingPDF}
                      className={`
                        w-full h-12 rounded-lg border-2 font-semibold text-lg transition-all
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

                <div className="bg-blue-50 p-3 rounded-lg mb-4">
                  <div className="text-sm">
                    <p className="font-medium text-blue-800">
                      {estudianteDelResponsableConAula.Nombres}{" "}
                      {estudianteDelResponsableConAula.Apellidos}
                    </p>
                    {estudianteDelResponsableConAula.aula && (
                      <p className="text-blue-600">
                        {estudianteDelResponsableConAula.aula.Grado}°{" "}
                        {estudianteDelResponsableConAula.aula.Seccion} -{" "}
                        {estudianteDelResponsableConAula.aula.Nivel}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={downloadPDF}
                    disabled={!currentPdfBlob || isGeneratingPDF}
                    className="w-full py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                  >
                    <span>⬇️</span>
                    Descargar
                  </button>

                  <button
                    onClick={sharePDF}
                    disabled={
                      !currentPdfBlob || isGeneratingPDF || !shareSupported
                    }
                    className="w-full py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                  >
                    <span>📤</span>
                    Compartir
                  </button>

                  {!shareSupported && (
                    <p className="text-xs text-gray-500 text-center">
                      Web Share API no disponible en este navegador
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
