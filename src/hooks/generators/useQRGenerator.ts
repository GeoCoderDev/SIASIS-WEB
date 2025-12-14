import { useState, useCallback, useRef } from "react";
import { checkWebShareApiSupport } from "@/lib/helpers/checkers/web-support/checkWebShareApiSupport";
import { GeneradorTarjetaQREstudiantilEnPDF } from "@/lib/helpers/generators/QR/GeneradorTarjetaQREstudiantilEnPDF";
import { downloadBlob } from "@/lib/helpers/downloaders/downloadBlob";
import { compartirArchivoEnBlobPorNavegador } from "@/lib/helpers/others/compartirArchivoEnBlobPorNavegador";
import { EstudianteConAulaYRelacion } from "@/interfaces/shared/Estudiantes";

export const useQRGenerator = (student: EstudianteConAulaYRelacion) => {
  const hiddenCardsRef = useRef<HTMLDivElement>(null);
  const [selectedQuantity, setSelectedQuantity] = useState<number>(1);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState<boolean>(false);
  const [currentPdfBlob, setCurrentPdfBlob] = useState<Blob | null>(null);
  const [shareSupported, setShareSupported] = useState<boolean>(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

  const initializeShareSupport = useCallback(() => {
    setShareSupported(checkWebShareApiSupport());
  }, []);

  // STABLE FUNCTION - does not change on each render
  const generatePDFStable = useCallback(
    async (quantity: number) => {
      if (!hiddenCardsRef.current) return;

      setIsGeneratingPDF(true);
      try {
        const pdfService = new GeneradorTarjetaQREstudiantilEnPDF(
          hiddenCardsRef.current
        );
        const pdfBlob = await pdfService.generatePDF(student, quantity);

        setCurrentPdfBlob(pdfBlob);

        // Clear previous URL
        setPdfPreviewUrl((prevUrl) => {
          if (prevUrl) {
            URL.revokeObjectURL(prevUrl);
          }
          return URL.createObjectURL(pdfBlob);
        });
      } catch (error) {
        console.error("Error generating PDF:", error);
        alert("Error generating PDF. Please try again.");
      } finally {
        setIsGeneratingPDF(false);
      }
    },
    [student]
  ); // Only depends on the student

  const downloadPDF = useCallback(() => {
    if (!currentPdfBlob) return;

    const filename = `QR_${student.Nombres}_${student.Apellidos}.pdf`;
    downloadBlob(currentPdfBlob, filename);
  }, [currentPdfBlob, student]);

  const sharePDF = useCallback(async () => {
    if (!currentPdfBlob || !shareSupported) {
      alert("Web Share API not available. Use the download button.");
      return;
    }

    try {
      const filename = `QR_${student.Nombres}_${student.Apellidos}.pdf`;
      const title = `${student.Nombres} ${student.Apellidos}`;
      await compartirArchivoEnBlobPorNavegador(currentPdfBlob, filename, title);
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.error("Error sharing PDF:", error);
        alert("Error sharing. Use the download button.");
      }
    }
  }, [currentPdfBlob, shareSupported, student]);

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
