import { useState, useCallback, useRef } from "react";
import { T_Estudiantes, T_Aulas } from "@prisma/client";
import { checkWebShareApiSupport } from "@/lib/helpers/checkers/web-support/checkWebShareApiSupport";
import { GeneradorTarjetaQREstudiantilEnPDF } from "@/lib/helpers/generators/QR/GeneradorTarjetaQREstudiantilEnPDF";
import { downloadBlob } from "@/lib/helpers/downloaders/downloadBlob";
import { compartirArchivoEnBlobPorNavegador } from "@/lib/helpers/others/compartirArchivoEnBlobPorNavegador";
import { BaseEstudiantesIDB } from "@/lib/utils/local/db/models/Estudiantes/EstudiantesBaseIDB";
import { BaseAulasIDB } from "@/lib/utils/local/db/models/Aulas/AulasBase";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";

export const useQRGeneratorPorAula = () => {
  const hiddenCardsRef = useRef<HTMLDivElement>(null);
  const [estudiantesIDB] = useState(() => new BaseEstudiantesIDB());
  const [aulasIDB] = useState(() => new BaseAulasIDB()); // Estados para filtros

  const [grados, setGrados] = useState<number[]>([]);
  const [gradoSeleccionado, setGradoSeleccionado] = useState<number | null>(
    null
  );
  const [secciones, setSecciones] = useState<string[]>([]);
  const [seccionSeleccionada, setSeccionSeleccionada] = useState<string | null>(
    null
  );
  const [aulaSeleccionada, setAulaSeleccionada] = useState<T_Aulas | null>(
    null
  );
  const [estudiantesDelAula, setEstudiantesDelAula] = useState<T_Estudiantes[]>(
    []
  ); // Estados para generación

  const [isGeneratingPDF, setIsGeneratingPDF] = useState<boolean>(false);
  const [currentPdfBlob, setCurrentPdfBlob] = useState<Blob | null>(null);
  const [shareSupported, setShareSupported] = useState<boolean>(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

  const initializeShareSupport = useCallback(() => {
    setShareSupported(checkWebShareApiSupport());
  }, []); // Cargar grados disponibles

  const cargarGradosDisponibles = useCallback(
    async (nivelRestringido?: NivelEducativo, idAulaRestringida?: string) => {
      try {
        const todasLasAulas = await aulasIDB.getTodasLasAulas();

        // Si hay restricción de aula, cargar automáticamente
        if (idAulaRestringida) {
          const aulaRestringida = todasLasAulas.find(
            (aula) => aula.Id_Aula === idAulaRestringida
          );

          if (aulaRestringida) {
            setGrados([aulaRestringida.Grado]);
            setGradoSeleccionado(aulaRestringida.Grado);
            setSecciones([aulaRestringida.Seccion]);
            setSeccionSeleccionada(aulaRestringida.Seccion);
            setAulaSeleccionada(aulaRestringida);

            const todosLosEstudiantes =
              await estudiantesIDB.getTodosLosEstudiantes(false);
            const estudiantesAula = todosLosEstudiantes.filter(
              (estudiante) =>
                estudiante.Id_Aula === aulaRestringida.Id_Aula &&
                estudiante.Estado
            );

            estudiantesAula.sort((a, b) =>
              `${a.Apellidos} ${a.Nombres}`.localeCompare(
                `${b.Apellidos} ${b.Nombres}`
              )
            );

            setEstudiantesDelAula(estudiantesAula);
          }
          return;
        }

        const aulasSecundaria = todasLasAulas.filter(
          (aula) =>
            aula.Nivel === (nivelRestringido || NivelEducativo.SECUNDARIA)
        );

        const gradosUnicos = [
          ...new Set(aulasSecundaria.map((aula) => aula.Grado)),
        ].sort();
        setGrados(gradosUnicos);
      } catch (error) {
        console.error("Error al cargar grados:", error);
      }
    },
    [aulasIDB, estudiantesIDB]
  ); // Cargar secciones de un grado específico

  const cargarSeccionesDelGrado = useCallback(
    async (grado: number) => {
      try {
        const todasLasAulas = await aulasIDB.getTodasLasAulas();
        const aulasDelGrado = todasLasAulas.filter(
          (aula) =>
            aula.Nivel === NivelEducativo.SECUNDARIA && aula.Grado === grado
        );

        const seccionesUnicas = [
          ...new Set(aulasDelGrado.map((aula) => aula.Seccion)),
        ].sort();
        setSecciones(seccionesUnicas);
      } catch (error) {
        console.error("Error al cargar secciones:", error);
      }
    },
    [aulasIDB]
  ); // Obtener el aula seleccionada

  const seleccionarAula = useCallback(
    async (grado: number, seccion: string) => {
      try {
        const todasLasAulas = await aulasIDB.getTodasLasAulas();
        const aula = todasLasAulas.find(
          (aula) =>
            aula.Nivel === NivelEducativo.SECUNDARIA &&
            aula.Grado === grado &&
            aula.Seccion === seccion
        );

        setAulaSeleccionada(aula || null);
        return aula;
      } catch (error) {
        console.error("Error al seleccionar aula:", error);
        return null;
      }
    },
    [aulasIDB]
  ); // Cargar estudiantes de un aula

  const cargarEstudiantesDelAula = useCallback(
    async (idAula: string) => {
      try {
        const todosLosEstudiantes = await estudiantesIDB.getTodosLosEstudiantes(
          false
        );
        const estudiantesDelAula = todosLosEstudiantes.filter(
          (estudiante) => estudiante.Id_Aula === idAula && estudiante.Estado
        ); // Ordenar por apellidos

        estudiantesDelAula.sort((a, b) =>
          `${a.Apellidos} ${a.Nombres}`.localeCompare(
            `${b.Apellidos} ${b.Nombres}`
          )
        );

        setEstudiantesDelAula(estudiantesDelAula);
        return estudiantesDelAula;
      } catch (error) {
        console.error("Error al cargar estudiantes:", error);
        return [];
      }
    },
    [estudiantesIDB]
  ); // Manejar cambio de grado

  const handleGradoChange = useCallback(
    (grado: number) => {
      setGradoSeleccionado(grado);
      setSeccionSeleccionada(null);
      setAulaSeleccionada(null);
      setEstudiantesDelAula([]);
      setSecciones([]); // Limpiar PDF anterior

      if (currentPdfBlob) {
        setCurrentPdfBlob(null);
        if (pdfPreviewUrl) {
          URL.revokeObjectURL(pdfPreviewUrl);
          setPdfPreviewUrl(null);
        }
      } // Cargar secciones del grado seleccionado

      cargarSeccionesDelGrado(grado);
    },
    [cargarSeccionesDelGrado, currentPdfBlob, pdfPreviewUrl]
  ); // Manejar cambio de sección

  const handleSeccionChange = useCallback(
    async (seccion: string) => {
      setSeccionSeleccionada(seccion); // Limpiar PDF anterior

      if (currentPdfBlob) {
        setCurrentPdfBlob(null);
        if (pdfPreviewUrl) {
          URL.revokeObjectURL(pdfPreviewUrl);
          setPdfPreviewUrl(null);
        }
      }

      if (gradoSeleccionado !== null) {
        const aula = await seleccionarAula(gradoSeleccionado, seccion);
        if (aula) {
          await cargarEstudiantesDelAula(aula.Id_Aula);
        }
      }
    },
    [
      gradoSeleccionado,
      seleccionarAula,
      cargarEstudiantesDelAula,
      currentPdfBlob,
      pdfPreviewUrl,
    ]
  ); // Generar PDF para todos los estudiantes del aula

  const generatePDFParaAula = useCallback(async () => {
    if (
      !hiddenCardsRef.current ||
      !aulaSeleccionada ||
      estudiantesDelAula.length === 0
    ) {
      return;
    }

    setIsGeneratingPDF(true);
    try {
      const pdfService = new GeneradorTarjetaQREstudiantilEnPDF(
        hiddenCardsRef.current
      ); // Convertir estudiantes a formato compatible con EstudianteDelResponsableConAula

      const estudiantesConAula = estudiantesDelAula.map((estudiante) => ({
        ...estudiante,
        Tipo_Relacion: "Estudiante", // Valor por defecto
        aula: aulaSeleccionada,
      })); // Generar PDF con todos los estudiantes

      const pdfBlob = await pdfService.generatePDFMultiplesEstudiantes(
        estudiantesConAula
      );

      setCurrentPdfBlob(pdfBlob); // Limpiar URL anterior y crear nueva

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
  }, [aulaSeleccionada, estudiantesDelAula]);

  const downloadPDF = useCallback(() => {
    if (!currentPdfBlob || !aulaSeleccionada) return;

    const filename = `QR_${aulaSeleccionada.Grado}${aulaSeleccionada.Seccion}_Secundaria.pdf`;
    downloadBlob(currentPdfBlob, filename);
  }, [currentPdfBlob, aulaSeleccionada]);

  const sharePDF = useCallback(async () => {
    if (!currentPdfBlob || !shareSupported || !aulaSeleccionada) {
      alert("Web Share API no disponible. Use el botón de descarga.");
      return;
    }

    try {
      const filename = `QR_${aulaSeleccionada.Grado}${aulaSeleccionada.Seccion}_Secundaria.pdf`;
      const title = `Tarjetas QR - ${aulaSeleccionada.Grado}° ${aulaSeleccionada.Seccion} Secundaria`;
      await compartirArchivoEnBlobPorNavegador(currentPdfBlob, filename, title);
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.error("Error sharing PDF:", error);
        alert("Error al compartir. Use el botón de descarga.");
      }
    }
  }, [currentPdfBlob, shareSupported, aulaSeleccionada]);

  const cleanup = useCallback(() => {
    if (pdfPreviewUrl) {
      URL.revokeObjectURL(pdfPreviewUrl);
    }
  }, [pdfPreviewUrl]);

  const limpiarSelecciones = useCallback(() => {
    setGradoSeleccionado(null);
    setSeccionSeleccionada(null);
    setAulaSeleccionada(null);
    setEstudiantesDelAula([]);
    setSecciones([]);
    setCurrentPdfBlob(null); // Limpiar preview URL

    if (pdfPreviewUrl) {
      URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(null);
    }
  }, [pdfPreviewUrl]); // Calcular páginas estimadas basándose en configuración real: 2 cartas por fila, 4 cartas por página
  const paginasEstimadas =
    estudiantesDelAula.length > 0
      ? Math.ceil(estudiantesDelAula.length / 4)
      : 0;

  return {
    hiddenCardsRef, // Estados de filtros
    grados,
    gradoSeleccionado,
    secciones,
    seccionSeleccionada,
    aulaSeleccionada,
    estudiantesDelAula, // Estados de generación
    isGeneratingPDF,
    currentPdfBlob,
    shareSupported,
    pdfPreviewUrl, // Cálculos
    paginasEstimadas, // Funciones de inicialización
    initializeShareSupport,
    cargarGradosDisponibles, // Funciones de manejo
    handleGradoChange,
    handleSeccionChange,
    generatePDFParaAula,
    downloadPDF,
    sharePDF,
    cleanup,
    limpiarSelecciones,
  };
};
