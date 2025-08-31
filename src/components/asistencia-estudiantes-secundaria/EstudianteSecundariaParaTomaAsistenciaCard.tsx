import React from "react";
import { T_Estudiantes, T_Aulas } from "@prisma/client";
import FotoPerfilClientSide from "../utils/photos/FotoPerfilClientSide";
import { extraerTipoDeIdentificador } from "@/lib/helpers/extractors/extraerTipoDeIdentificador";
import { TiposIdentificadoresTextos } from "@/interfaces/shared/TiposIdentificadores";
import { extraerIdentificador } from "@/lib/helpers/extractors/extraerIdentificador";

interface ConfiguracionBoton {
  texto: string;
  colorClass: string;
}

interface EstudianteSecundariaParaTomaAsistenciaCardProps {
  estudiante: T_Estudiantes;
  aulaSeleccionada: T_Aulas | null;
  onMarcarAsistencia: (estudiante: T_Estudiantes) => void;
  yaRegistrado?: boolean; // Para mostrar si ya fue registrado
  className?: string;
  // Nuevas props para soporte de entrada/salida
  configuracionBoton?: ConfiguracionBoton;
}

const EstudianteSecundariaParaTomaAsistenciaCard: React.FC<
  EstudianteSecundariaParaTomaAsistenciaCardProps
> = ({
  estudiante,
  aulaSeleccionada,
  onMarcarAsistencia,
  yaRegistrado = false,
  className = "",
  configuracionBoton = {
    texto: "✓ Marcar",
    colorClass: "bg-green-500 hover:bg-green-600 active:bg-green-700",
  },
}) => {
  // Determinar si el botón es de salida para aplicar estilos rojos
  const esSalida = configuracionBoton.colorClass.includes("red");

  return (
    <div
      className={`border rounded-lg p-3 xs:p-4 hover:shadow-md transition-all duration-200 ${
        yaRegistrado
          ? "bg-green-50 border-green-200"
          : "bg-white hover:bg-gray-50"
      } ${className}`}
      style={{
        borderLeftWidth: "4px",
        borderLeftColor: aulaSeleccionada?.Color || "#gray",
      }}
    >
      {/* Header con foto y nombre completo */}
      <div className="flex items-center mb-2 xs:mb-3">
        <FotoPerfilClientSide
          className="w-8 h-8 xs:w-10 xs:h-10 rounded-full mr-2 xs:mr-3 flex items-center justify-center overflow-hidden object-cover"
          Google_Drive_Foto_ID={estudiante.Google_Drive_Foto_ID}
        />

        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-900 text-xs xs:text-sm truncate">
            {estudiante.Nombres} {estudiante.Apellidos}
          </p>
        </div>
        {yaRegistrado && (
          <div className="ml-2 flex-shrink-0">
            <span className="text-green-600 text-sm xs:text-base">✓</span>
          </div>
        )}
      </div>

      {/* Información adicional */}
      <div className="mb-2 xs:mb-3 space-y-1">
        <p className="text-xs text-gray-500 truncate">
          {
            TiposIdentificadoresTextos[
              extraerTipoDeIdentificador(estudiante.Id_Estudiante)
            ]
          }
          : {extraerIdentificador(estudiante.Id_Estudiante)}
        </p>
        {aulaSeleccionada && (
          <p className="text-xs text-gray-400 truncate">
            {aulaSeleccionada.Grado}° "{aulaSeleccionada.Seccion}"
          </p>
        )}
      </div>

      {/* Botón de acción en la parte inferior */}
      <button
        onClick={() => onMarcarAsistencia(estudiante)}
        disabled={yaRegistrado}
        className={`w-full py-1.5 xs:py-2 px-2 xs:px-3 rounded text-xs font-medium transition-colors ${
          yaRegistrado
            ? "bg-green-100 text-green-700 cursor-not-allowed"
            : `${configuracionBoton.colorClass} text-white`
        }`}
        title={
          yaRegistrado
            ? "Ya registrado"
            : esSalida
            ? "Marcar salida"
            : "Marcar entrada"
        }
      >
        {yaRegistrado ? "✓ Registrado" : configuracionBoton.texto}
      </button>
    </div>
  );
};

export default EstudianteSecundariaParaTomaAsistenciaCard;
