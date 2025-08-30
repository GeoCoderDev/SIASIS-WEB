import { useState, useCallback, useRef } from "react";
import { checkWebShareApiSupport } from "@/lib/helpers/checkers/web-support/checkWebShareApiSupport";
import { GeneradorTarjetaQREstudiantilEnPDF } from "@/lib/helpers/generators/QR/GeneradorTarjetaQREstudiantilEnPDF";
import { downloadBlob } from "@/lib/helpers/downloaders/downloadBlob";
import { compartirArchivoEnBlobPorNavegador } from "@/lib/helpers/others/compartirArchivoEnBlobPorNavegador";
import { EstudianteConAulaYRelacion } from "@/interfaces/shared/Estudiantes";

export const useQRGenerator = (estudiante: EstudianteConAulaYRelacion) => {
  const hiddenCardsRef = useRef<HTMLDivElement>(null);
  const [selectedQuantity, setSelectedQuantity] = useState<number>(1);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState<boolean>(false);
  const [currentPdfBlob, setCurrentPdfBlob] = useState<Blob | null>(null);
  const [shareSupported, setShareSupported] = useState<boolean>(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

  const initializeShareSupport = useCallback(() => {
    setShareSupported(checkWebShareApiSupport());
  }, []);

  // FUNCIÓN ESTABLE - no cambia en cada render
  const generatePDFStable = useCallback(
    async (quantity: number) => {
      if (!hiddenCardsRef.current) return;

      setIsGeneratingPDF(true);
      try {
        const pdfService = new GeneradorTarjetaQREstudiantilEnPDF(
          hiddenCardsRef.current
        );
        const pdfBlob = await pdfService.generatePDF(estudiante, quantity);

        setCurrentPdfBlob(pdfBlob);

        // Limpiar URL anterior
        setPdfPreviewUrl((prevUrl) => {
          if (prevUrl) {
            URL.revokeObjectURL(prevUrl);
          }
          return URL.createObjectURL(pdfBlob);
        });
      } catch (error) {
        console.error("Error generating PDF:", error);
        alert("Error al generar el PDF. Por favor, intente nuevamente.");
      } finally {
        setIsGeneratingPDF(false);
      }
    },
    [estudiante]
  ); // Solo depende del estudiante

  const downloadPDF = useCallback(() => {
    if (!currentPdfBlob) return;

    const filename = `QR_${estudiante.Nombres}_${estudiante.Apellidos}.pdf`;
    downloadBlob(currentPdfBlob, filename);
  }, [currentPdfBlob, estudiante]);

  const sharePDF = useCallback(async () => {
    if (!currentPdfBlob || !shareSupported) {
      alert("Web Share API no disponible. Use el botón de descarga.");
      return;
    }

    try {
      const filename = `QR_${estudiante.Nombres}_${estudiante.Apellidos}.pdf`;
      const title = `${estudiante.Nombres} ${estudiante.Apellidos}`;
      await compartirArchivoEnBlobPorNavegador(currentPdfBlob, filename, title);
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.error("Error sharing PDF:", error);
        alert("Error al compartir. Use el botón de descarga.");
      }
    }
  }, [currentPdfBlob, shareSupported, estudiante]);

  const cleanup = useCallback(() => {
    if (pdfPreviewUrl) {
      URL.revokeObjectURL(pdfPreviewUrl);
    }
  }, [pdfPreviewUrl]);

  return {
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
  };
};
