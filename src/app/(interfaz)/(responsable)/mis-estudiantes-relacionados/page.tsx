"use client";
import { useEffect, useState } from "react";
import MiEstudianteRelacionadoCard from "./_components/MiEstudianteRelacionadoCard";

import { EstudiantesParaResponsablesIDB } from "@/lib/utils/local/db/models/Estudiantes/EstudiantesParaResponsablesIDB";
import { ErrorResponseAPIBase } from "@/interfaces/shared/apis/types";
import Loader from "@/components/shared/loaders/Loader";
import { AulasParaResponsablesIDB } from "@/lib/utils/local/db/models/Aulas/AulasParaResponsable";
import { T_Aulas } from "@prisma/client";
import { EstudianteConAulaYRelacion } from "@/interfaces/shared/Estudiantes";

const MisEstudiantesRelacionados = () => {
  const [isSomethingLoading, setIsSomethingLoading] = useState(true);
  const [
    misEstudiantesRelacionadosConAula,
    setMisEstudiantesRelacionadosConAula,
  ] = useState<EstudianteConAulaYRelacion[]>([]);
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
        const estudiantesConAula: EstudianteConAulaYRelacion[] =
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

  // Renderizado condicional del contenido principal
  const renderContent = () => {
    // Mostrar loader mientras está cargando
    if (isSomethingLoading && !isInitialized) {
      return (
        <span
          className="sxs-only:text-[11px] xs-only:text-[12px] sm-only:text-[13px] 
                        landscape-small:text-[10.2px] landscape-tablet-sm:text-[10.2px]
                        flex items-center"
        >
          Cargando estudiantes...
          <Loader
            className="w-[2rem] sxs-only:w-[1.84rem] xs-only:w-[1.84rem] 
                            landscape-small:w-[1.7rem] landscape-tablet-sm:w-[1.7rem]
                            p-2 sxs-only:p-[0.46rem] bg-black ml-2 
                            landscape-small:ml-[0.425rem] landscape-tablet-sm:ml-[0.425rem]"
          />
        </span>
      );
    }

    // Mostrar error si existe
    if (error) {
      return (
        <div
          className="flex flex-col items-center gap-4 
                       landscape-small:gap-[0.85rem] landscape-tablet-sm:gap-[0.85rem]"
        >
          <div className="text-center">
            <p
              className="text-red-600 font-medium mb-2 
                         landscape-small:mb-[0.425rem] landscape-tablet-sm:mb-[0.425rem]"
            >
              ❌ Error al cargar estudiantes
            </p>
            <p
              className="text-sm text-gray-600 mb-2 
                         landscape-small:text-[11.9px] landscape-small:mb-[0.425rem] 
                         landscape-tablet-sm:text-[11.9px] landscape-tablet-sm:mb-[0.425rem]"
            >
              {error.message}
            </p>
          </div>
        </div>
      );
    }

    // Mostrar loader durante actualizaciones
    if (isSomethingLoading && isInitialized) {
      return (
        <span
          className="sxs-only:text-[11px] xs-only:text-[12px] sm-only:text-[13px] 
                        landscape-small:text-[10.2px] landscape-tablet-sm:text-[10.2px]
                        flex items-center"
        >
          Actualizando
          <Loader
            className="w-[2rem] sxs-only:w-[1.84rem] xs-only:w-[1.84rem] 
                            landscape-small:w-[1.7rem] landscape-tablet-sm:w-[1.7rem]
                            p-2 sxs-only:p-[0.46rem] bg-black ml-2 
                            landscape-small:ml-[0.425rem] landscape-tablet-sm:ml-[0.425rem]"
          />
        </span>
      );
    }

    // Mostrar mensaje si no hay estudiantes
    if (misEstudiantesRelacionadosConAula.length === 0) {
      return (
        <div className="text-center">
          <p
            className="text-gray-600 mb-4 
                       landscape-small:mb-[0.85rem] landscape-tablet-sm:mb-[0.85rem]"
          >
            No se encontraron estudiantes relacionados a ti
          </p>
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
      <div
        className="flex items-center gap-4 mb-6 
                     sxs-only:gap-[0.92rem] sxs-only:mb-[1.38rem] 
                     xs-only:gap-[0.92rem] xs-only:mb-[1.38rem] 
                     sm-only:gap-[0.92rem] sm-only:mb-[1.38rem]
                     landscape-small:gap-[0.85rem] landscape-small:mb-[1.275rem] 
                     landscape-tablet-sm:gap-[0.85rem] landscape-tablet-sm:mb-[1.275rem]"
      >
        <h1
          className="text-[2.185rem] 
                      sxs-only:text-[1.587rem] 
                      xs-only:text-[1.693rem] 
                      sm-only:text-[1.799rem] 
                      md-only:text-[1.905rem] 
                      landscape-small:text-[1.857rem] 
                      landscape-tablet-sm:text-[1.857rem]
                      text-negro font-semibold mt-2 text-center 
                      landscape-small:mt-[0.425rem] landscape-tablet-sm:mt-[0.425rem]"
        >
          ESTUDIANTES RELACIONADOS
        </h1>
      </div>

      <div
        className="w-full h-full -border-2 flex items-center justify-center 
                     gap-x-[min(3rem,5vw)] 
                     sxs-only:gap-x-[min(2.76rem,4.6vw)] 
                     xs-only:gap-x-[min(2.76rem,4.6vw)] 
                     sm-only:gap-x-[min(2.76rem,4.6vw)]
                     landscape-small:gap-x-[min(2.55rem,4.25vw)] 
                     landscape-tablet-sm:gap-x-[min(2.55rem,4.25vw)]"
      >
        {renderContent()}
      </div>
    </div>
  );
};

export default MisEstudiantesRelacionados;
