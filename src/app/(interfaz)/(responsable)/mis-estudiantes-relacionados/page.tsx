"use client";
import { useEffect, useState } from "react";
import MiEstudianteRelacionadoCard from "./_components/MiEstudianteRelacionadoCard";
import { EstudianteDelResponsable } from "@/interfaces/shared/apis/api02/mis-estudiantes-relacionados/types";
import { EstudiantesParaResponsablesIDB } from "@/lib/utils/local/db/models/Estudiantes/EstudiantesParaResponsablesIDB";
import { ErrorResponseAPIBase } from "@/interfaces/shared/apis/types";
import Loader from "@/components/shared/loaders/Loader";
import { AulasParaResponsablesIDB } from "@/lib/utils/local/db/models/Aulas/AulasParaResponsable";
import { T_Aulas } from "@prisma/client";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";

export interface EstudianteDelResponsableConAula
  extends Omit<EstudianteDelResponsable, "Id_Aula"> {
  aula: T_Aulas | null | undefined;
}

const MisEstudiantesRelacionados = () => {
  const [isSomethingLoading, setIsSomethingLoading] = useState(true);
  const [
    misEstudiantesRelacionadosConAula,
    setMisEstudiantesRelacionadosConAula,
  ] = useState<EstudianteDelResponsableConAula[]>([]);
  const [misAulasRelacionadas, setMisAulasRelacionadas] = useState<T_Aulas[]>(
    []
  );
  const [error, setError] = useState<ErrorResponseAPIBase | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const fetchMisEstudiantesRelacionados = async () => {
      let estudiantesParaResponsablesIDB: EstudiantesParaResponsablesIDB | null =
        null;

      try {
        setIsSomethingLoading(true);
        setError(null);

        // Crear instancia del modelo
        estudiantesParaResponsablesIDB = new EstudiantesParaResponsablesIDB(
          "API02",
          setIsSomethingLoading,
          setError
        );

        const aulasParaResponsableIDB = new AulasParaResponsablesIDB(
          "API02",
          setIsSomethingLoading,
          setError
        );

        // Intentar obtener estudiantes del responsable con sincronización
        const estudiantesObtenidos =
          await estudiantesParaResponsablesIDB.obtenerYSincronizarEstudiantesDelResponsable(
            false
          );

        const aulasObtenidas =
          await aulasParaResponsableIDB.obtenerAulasPorEstudiantes(
            estudiantesObtenidos
          );

        // Mapear las aulas obtenidas a los estudiantes
        const estudiantesConAula: EstudianteDelResponsableConAula[] =
          estudiantesObtenidos.map((estudiante) => {
            if (estudiante.Id_Aula === null)
              return { ...estudiante, aula: null };
            if (estudiante.Id_Aula === undefined)
              return { ...estudiante, aula: undefined };
            const aula = aulasObtenidas.find(
              (aula) => aula.Id_Aula === estudiante.Id_Aula
            );
            return { ...estudiante, aula };
          });

        // Si llegamos aquí, la operación fue exitosa
        setMisEstudiantesRelacionadosConAula(estudiantesConAula);

        // Logging para debugging
        console.log(
          `✅ Estudiantes cargados exitosamente: ${estudiantesObtenidos.length}`
        );
      } catch (fetchError) {
        // Este catch maneja errores que no fueron manejados por el modelo
        console.error("❌ Error no manejado en la interfaz:", fetchError);

        // Si el modelo no estableció un error, establecer uno genérico
        if (!error) {
          setError({
            success: false,
            message: "Error inesperado al cargar estudiantes relacionados",
            errorType: "UNKNOWN_ERROR" as any,
            details: {
              origen:
                "MisEstudiantesRelacionados.fetchMisEstudiantesRelacionados",
              timestamp: Date.now(),
              errorOriginal:
                fetchError instanceof Error
                  ? fetchError.message
                  : String(fetchError),
            },
          });
        }

        // En caso de error, asegurar que no hay estudiantes mostrados
        setMisEstudiantesRelacionadosConAula([]);
      } finally {
        // Siempre marcar como inicializado y detener loading al final
        setIsInitialized(true);
        setIsSomethingLoading(false);

        // Cleanup: liberar referencia del modelo
        estudiantesParaResponsablesIDB = null;
      }
    };

    // Solo ejecutar si no se ha inicializado
    if (!isInitialized) {
      fetchMisEstudiantesRelacionados();
    }
  }, [isInitialized, error]);

  // Función para forzar actualización desde servidor
  // const handleForceRefresh = async () => {
  //   try {
  //     setIsSomethingLoading(true);
  //     setError(null);

  //     const estudiantesParaResponsablesIDB = new EstudiantesParaResponsablesIDB(
  //       "API02",
  //       setIsSomethingLoading,
  //       setError
  //     );

  //     // Forzar actualización desde el servidor
  //     const estudiantesObtenidos =
  //       await estudiantesParaResponsablesIDB.obtenerYSincronizarEstudiantesDelResponsable(
  //         true
  //       );

  //     setMisEstudiantesRelacionadosConAula(estudiantesObtenidos);
  //     console.log(
  //       `🔄 Estudiantes actualizados desde servidor: ${estudiantesObtenidos.length}`
  //     );
  //   } catch (refreshError) {
  //     console.error("❌ Error al forzar actualización:", refreshError);

  //     if (!error) {
  //       setError({
  //         success: false,
  //         message: "Error al actualizar desde el servidor",
  //         errorType: "EXTERNAL_SERVICE_ERROR" as any,
  //         details: {
  //           origen: "MisEstudiantesRelacionados.handleForceRefresh",
  //           timestamp: Date.now(),
  //         },
  //       });
  //     }
  //   } finally {
  //     setIsSomethingLoading(false);
  //   }
  // };

  // Renderizado condicional del contenido principal
  const renderContent = () => {
    // Mostrar loader mientras está cargando
    if (isSomethingLoading && !isInitialized) {
      return (
        <span className="sxs-only:text-[12px] xs-only:text-[13px] sm-only:text-[14px] flex items-center">
          Cargando estudiantes...
          <Loader className="w-[2rem] sxs-only:w-[1.5rem] xs-only:w-[1.7rem] p-2 sxs-only:p-1.5 bg-black ml-2" />
        </span>
      );
    }

    // Mostrar error si existe
    if (error) {
      return (
        <div className="flex flex-col items-center gap-4">
          <div className="text-center">
            <p className="text-red-600 font-medium mb-2">
              ❌ Error al cargar estudiantes
            </p>
            <p className="text-sm text-gray-600 mb-2">{error.message}</p>
          </div>
        </div>
      );
    }

    // Mostrar loader durante actualizaciones
    if (isSomethingLoading && isInitialized) {
      return (
        <span className="sxs-only:text-[12px] xs-only:text-[13px] sm-only:text-[14px] flex items-center">
          Actualizando
          <Loader className="w-[2rem] sxs-only:w-[1.5rem] xs-only:w-[1.7rem] p-2 sxs-only:p-1.5 bg-black ml-2" />
        </span>
      );
    }

    // Mostrar mensaje si no hay estudiantes
    if (misEstudiantesRelacionadosConAula.length === 0) {
      return (
        <div className="text-center">
          <p className="text-gray-600 mb-4">
            No se encontraron estudiantes relacionados a ti
          </p>
          {/* <button
            onClick={handleForceRefresh}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            Buscar actualizaciones
          </button> */}
        </div>
      );
    }

    // Mostrar estudiantes
    return misEstudiantesRelacionadosConAula.map((miEstudianteRelacionado) => (
      <MiEstudianteRelacionadoCard
        key={miEstudianteRelacionado.Id_Estudiante}
        miEstudianteRelacionado={miEstudianteRelacionado}
      />
    ));
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-6">
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-[2.185rem] sxs-only:text-[1.725rem] xs-only:text-[1.84rem] sm-only:text-[1.955rem] md-only:text-[2.07rem] text-negro font-semibold mt-2 text-center">
          ESTUDIANTES RELACIONADOS
        </h1>

        {/* Botón de actualización manual (solo visible cuando hay estudiantes y no hay error) */}
        {/* {isInitialized && !error && misEstudiantesRelacionados.length > 0 && (
          <button
            onClick={handleForceRefresh}
            disabled={isSomethingLoading}
            className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            title="Actualizar desde servidor"
          >
            Actualizar
          </button>
        )} */}
      </div>

      <div className="w-full h-full -border-2 flex items-center justify-center gap-x-[min(3rem,5vw)]">
        {renderContent()}
      </div>
    </div>
  );
};

export default MisEstudiantesRelacionados;
