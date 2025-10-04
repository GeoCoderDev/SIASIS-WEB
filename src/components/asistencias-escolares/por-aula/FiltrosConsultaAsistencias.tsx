import React from "react";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";

interface FiltrosConsultaAsistenciasProps {
  nivelTemporal: NivelEducativo | "";
  setNivelTemporal: (nivel: NivelEducativo | "") => void;
  gradoTemporal: number | "";
  setGradoTemporal: (grado: number | "") => void;
  seccionTemporal: string;
  setSeccionTemporal: (seccion: string) => void;
  mesTemporal: number;
  setMesTemporal: (mes: number) => void;
  gradosDisponibles: number[];
  seccionesDisponibles: string[];
  mesesDisponibles: Array<{ value: number; label: string }>;
  onConsultar: () => void;
  onLimpiar: () => void;
}

const FiltrosConsultaAsistencias: React.FC<FiltrosConsultaAsistenciasProps> = ({
  nivelTemporal,
  setNivelTemporal,
  gradoTemporal,
  setGradoTemporal,
  seccionTemporal,
  setSeccionTemporal,
  mesTemporal,
  setMesTemporal,
  gradosDisponibles,
  seccionesDisponibles,
  mesesDisponibles,
  onConsultar,
  onLimpiar,
}) => {
  const puedeConsultar = nivelTemporal && gradoTemporal && seccionTemporal;

  return (
    <div className="flex flex-wrap gap-3">
      {/* Nivel Educativo */}
      <div className="flex-1 min-w-[150px]">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nivel Educativo
        </label>
        <select
          value={nivelTemporal}
          onChange={(e) =>
            setNivelTemporal(e.target.value as NivelEducativo | "")
          }
          className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Seleccionar</option>
          <option value={NivelEducativo.PRIMARIA}>Primaria</option>
          <option value={NivelEducativo.SECUNDARIA}>Secundaria</option>
        </select>
      </div>

      {/* Grado */}
      <div className="flex-1 min-w-[150px]">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Grado
        </label>
        <select
          value={gradoTemporal}
          onChange={(e) =>
            setGradoTemporal(e.target.value ? Number(e.target.value) : "")
          }
          disabled={!nivelTemporal}
          className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          <option value="">Seleccionar</option>
          {gradosDisponibles.map((grado) => (
            <option key={grado} value={grado}>
              {grado}°
            </option>
          ))}
        </select>
      </div>

      {/* Sección */}
      <div className="flex-1 min-w-[150px]">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Sección
        </label>
        <select
          value={seccionTemporal}
          onChange={(e) => setSeccionTemporal(e.target.value)}
          disabled={!gradoTemporal}
          className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          <option value="">Seleccionar</option>
          {seccionesDisponibles.map((seccion) => (
            <option key={seccion} value={seccion}>
              {seccion}
            </option>
          ))}
        </select>
      </div>

      {/* Mes */}
      <div className="flex-1 min-w-[150px]">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Mes
        </label>
        <select
          value={mesTemporal}
          onChange={(e) => setMesTemporal(Number(e.target.value))}
          className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          {mesesDisponibles.map((mes) => (
            <option key={mes.value} value={mes.value}>
              {mes.label}
            </option>
          ))}
        </select>
      </div>

      {/* Botón Consultar */}
      <div className="flex items-end min-w-[120px]">
        <button
          onClick={onConsultar}
          disabled={!puedeConsultar}
          className="w-full p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
        >
          Consultar
        </button>
      </div>

      {/* Botón Limpiar */}
      <div className="flex items-end min-w-[120px]">
        <button
          onClick={onLimpiar}
          className="w-full p-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors font-medium"
        >
          Limpiar
        </button>
      </div>
    </div>
  );
};

export default FiltrosConsultaAsistencias;
