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
  const [studentsIDB] = useState(() => new BaseEstudiantesIDB());
  const [classroomsIDB] = useState(() => new BaseAulasIDB()); // States for filters

  const [grades, setGrades] = useState<number[]>([]);
  const [selectedGrade, setSelectedGrade] = useState<number | null>(
    null
  );
  const [sections, setSections] = useState<string[]>([]);
  const [selectedSection, setSelectedSection] = useState<string | null>(
    null
  );
  const [selectedClassroom, setSelectedClassroom] = useState<T_Aulas | null>(
    null
  );
  const [studentsInClassroom, setStudentsInClassroom] = useState<T_Estudiantes[]>(
    []
  ); // States for generation

  const [isGeneratingPDF, setIsGeneratingPDF] = useState<boolean>(false);
  const [currentPdfBlob, setCurrentPdfBlob] = useState<Blob | null>(null);
  const [shareSupported, setShareSupported] = useState<boolean>(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

  const initializeShareSupport = useCallback(() => {
    setShareSupported(checkWebShareApiSupport());
  }, []); // Load available grades

  const loadAvailableGrades = useCallback(
    async (restrictedLevel?: NivelEducativo, restrictedClassroomId?: string) => {
      try {
        const allClassrooms = await classroomsIDB.getTodasLasAulas();

        // If there is classroom restriction, load automatically
        if (restrictedClassroomId) {
          const restrictedClassroom = allClassrooms.find(
            (classroom) => classroom.Id_Aula === restrictedClassroomId
          );

          if (restrictedClassroom) {
            setGrades([restrictedClassroom.Grado]);
            setSelectedGrade(restrictedClassroom.Grado);
            setSections([restrictedClassroom.Seccion]);
            setSelectedSection(restrictedClassroom.Seccion);
            setSelectedClassroom(restrictedClassroom);

            const allStudents =
              await studentsIDB.getTodosLosEstudiantes(false);
            const classroomStudents = allStudents.filter(
              (student) =>
                student.Id_Aula === restrictedClassroom.Id_Aula &&
                student.Estado
            );

            classroomStudents.sort((a, b) =>
              `${a.Apellidos} ${a.Nombres}`.localeCompare(
                `${b.Apellidos} ${b.Nombres}`
              )
            );

            setStudentsInClassroom(classroomStudents);
          }
          return;
        }

        const secondaryClassrooms = allClassrooms.filter(
          (classroom) =>
            classroom.Nivel === (restrictedLevel || NivelEducativo.SECUNDARIA)
        );

        const uniqueGrades = [
          ...new Set(secondaryClassrooms.map((classroom) => classroom.Grado)),
        ].sort();
        setGrades(uniqueGrades);
      } catch (error) {
        console.error("Error loading grades:", error);
      }
    },
    [classroomsIDB, studentsIDB]
  ); // Load sections for a specific grade

  const loadSectionsForGrade = useCallback(
    async (grade: number) => {
      try {
        const allClassrooms = await classroomsIDB.getTodasLasAulas();
        const classroomsInGrade = allClassrooms.filter(
          (classroom) =>
            classroom.Nivel === NivelEducativo.SECUNDARIA && classroom.Grado === grade
        );

        const uniqueSections = [
          ...new Set(classroomsInGrade.map((classroom) => classroom.Seccion)),
        ].sort();
        setSections(uniqueSections);
      } catch (error) {
        console.error("Error loading sections:", error);
      }
    },
    [classroomsIDB]
  ); // Get the selected classroom

  const selectClassroom = useCallback(
    async (grade: number, section: string) => {
      try {
        const allClassrooms = await classroomsIDB.getTodasLasAulas();
        const classroom = allClassrooms.find(
          (classroom) =>
            classroom.Nivel === NivelEducativo.SECUNDARIA &&
            classroom.Grado === grade &&
            classroom.Seccion === section
        );

        setSelectedClassroom(classroom || null);
        return classroom;
      } catch (error) {
        console.error("Error selecting classroom:", error);
        return null;
      }
    },
    [classroomsIDB]
  ); // Load students for a classroom

  const loadStudentsInClassroom = useCallback(
    async (classroomId: string) => {
      try {
        const allStudents = await studentsIDB.getTodosLosEstudiantes(
          false
        );
        const studentsInClassroom = allStudents.filter(
          (student) => student.Id_Aula === classroomId && student.Estado
        ); // Sort by surnames

        studentsInClassroom.sort((a, b) =>
          `${a.Apellidos} ${a.Nombres}`.localeCompare(
            `${b.Apellidos} ${b.Nombres}`
          )
        );

        setStudentsInClassroom(studentsInClassroom);
        return studentsInClassroom;
      } catch (error) {
        console.error("Error loading students:", error);
        return [];
      }
    },
    [studentsIDB]
  ); // Handle grade change

  const handleGradeChange = useCallback(
    (grade: number) => {
      setSelectedGrade(grade);
      setSelectedSection(null);
      setSelectedClassroom(null);
      setStudentsInClassroom([]);
      setSections([]); // Clear previous PDF

      if (currentPdfBlob) {
        setCurrentPdfBlob(null);
        if (pdfPreviewUrl) {
          URL.revokeObjectURL(pdfPreviewUrl);
          setPdfPreviewUrl(null);
        }
      } // Load sections for the selected grade

      loadSectionsForGrade(grade);
    },
    [loadSectionsForGrade, currentPdfBlob, pdfPreviewUrl]
  ); // Handle section change

  const handleSectionChange = useCallback(
    async (section: string) => {
      setSelectedSection(section); // Clear previous PDF

      if (currentPdfBlob) {
        setCurrentPdfBlob(null);
        if (pdfPreviewUrl) {
          URL.revokeObjectURL(pdfPreviewUrl);
          setPdfPreviewUrl(null);
        }
      }

      if (selectedGrade !== null) {
        const classroom = await selectClassroom(selectedGrade, section);
        if (classroom) {
          await loadStudentsInClassroom(classroom.Id_Aula);
        }
      }
    },
    [
      selectedGrade,
      selectClassroom,
      loadStudentsInClassroom,
      currentPdfBlob,
      pdfPreviewUrl,
    ]
  ); // Generate PDF for all students in the classroom

  const generatePDFForClassroom = useCallback(async () => {
    if (
      !hiddenCardsRef.current ||
      !selectedClassroom ||
      studentsInClassroom.length === 0
    ) {
      return;
    }

    setIsGeneratingPDF(true);
    try {
      const pdfService = new GeneradorTarjetaQREstudiantilEnPDF(
        hiddenCardsRef.current
      ); // Convert students to EstudianteDelResponsableConAula compatible format

      const studentsWithClassroom = studentsInClassroom.map((student) => ({
        ...student,
        Tipo_Relacion: "Student", // Default value
        classroom: selectedClassroom,
      })); // Generate PDF with all students

      const pdfBlob = await pdfService.generatePDFMultiplesEstudiantes(
        studentsWithClassroom
      );

      setCurrentPdfBlob(pdfBlob); // Clear previous URL and create new one

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
  }, [selectedClassroom, studentsInClassroom]);

  const downloadPDF = useCallback(() => {
    if (!currentPdfBlob || !selectedClassroom) return;

    const filename = `QR_${selectedClassroom.Grado}${selectedClassroom.Seccion}_Secondary.pdf`;
    downloadBlob(currentPdfBlob, filename);
  }, [currentPdfBlob, selectedClassroom]);

  const sharePDF = useCallback(async () => {
    if (!currentPdfBlob || !shareSupported || !selectedClassroom) {
      alert("Web Share API not available. Use the download button.");
      return;
    }

    try {
      const filename = `QR_${selectedClassroom.Grado}${selectedClassroom.Seccion}_Secondary.pdf`;
      const title = `QR Cards - ${selectedClassroom.Grado}° ${selectedClassroom.Seccion} Secondary`;
      await compartirArchivoEnBlobPorNavegador(currentPdfBlob, filename, title);
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.error("Error sharing PDF:", error);
        alert("Error sharing. Use the download button.");
      }
    }
  }, [currentPdfBlob, shareSupported, selectedClassroom]);

  const cleanup = useCallback(() => {
    if (pdfPreviewUrl) {
      URL.revokeObjectURL(pdfPreviewUrl);
    }
  }, [pdfPreviewUrl]);

  const clearSelections = useCallback(() => {
    setSelectedGrade(null);
    setSelectedSection(null);
    setSelectedClassroom(null);
    setStudentsInClassroom([]);
    setSections([]);
    setCurrentPdfBlob(null); // Clear preview URL

    if (pdfPreviewUrl) {
      URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(null);
    }
  }, [pdfPreviewUrl]); // Calculate estimated pages based on real configuration: 2 cards per row, 4 cards per page
  const estimatedPages =
    studentsInClassroom.length > 0
      ? Math.ceil(studentsInClassroom.length / 4)
      : 0;

  return {
    hiddenCardsRef, // States for filters
    grades,
    selectedGrade,
    sections,
    selectedSection,
    selectedClassroom,
    studentsInClassroom, // States for generation
    isGeneratingPDF,
    currentPdfBlob,
    shareSupported,
    pdfPreviewUrl, // Calculations
    estimatedPages, // Initialization functions
    initializeShareSupport,
    loadAvailableGrades, // Handling functions
    handleGradeChange,
    handleSectionChange,
    generatePDFForClassroom,
    downloadPDF,
    sharePDF,
    cleanup,
    clearSelections,
  };
};