"use client";

import FotoPerfilClientSide from "@/components/utils/photos/FotoPerfilClientSide";
import Loader from "@/components/shared/loaders/Loader";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";
import {
  ProfesorPrimariaGenericoConCelular,
  ProfesorSecundariaGenericoConCelular,
} from "@/interfaces/shared/Profesores";
import React from "react";

// Datos del aula
interface DatosAula {
  Nivel: NivelEducativo;
  Grado: number;
  Seccion: string;
}

// Props del componente
interface DatosProfesorDeAulaCardProps {
  profesor:
    | ProfesorPrimariaGenericoConCelular
    | ProfesorSecundariaGenericoConCelular
    | null;
  aula: DatosAula | null;
  isLoadingData?: boolean;
}

const DatosProfesorDeAulaCard = ({
  profesor,
  aula,
  isLoadingData = false,
}: DatosProfesorDeAulaCardProps) => {
  // Función para abrir WhatsApp
  const abrirWhatsApp = (celular: string) => {
    const numeroLimpio = celular.replace(/\D/g, "");
    const numeroCompleto = numeroLimpio.startsWith("51")
      ? numeroLimpio
      : `51${numeroLimpio}`;
    const mensaje = encodeURIComponent(
      `Hola ${obtenerTitulo()} ${
        profesor?.Nombres
      }, soy padre/madre de familia del colegio I.E. 20935 Asunción 8`
    );
    window.open(`https://wa.me/${numeroCompleto}?text=${mensaje}`, "_blank");
  };

  // Función para obtener el título correcto
  const obtenerTitulo = () => {
    if (!profesor) return "";
    return profesor.Genero === "F" ? "Profesora" : "Profesor";
  };

  // Si aún se están cargando datos
  if (isLoadingData) {
    return (
      <div className="bg-white rounded-lg shadow-md p-3">
        <div className="flex items-center gap-2">
          <Loader className="w-4 h-4" />
          <span className="text-sm text-gray-600">Cargando datos...</span>
        </div>
      </div>
    );
  }

  // Si no hay profesor asignado (confirmado)
  if (!profesor || !aula) {
    return (
      <div className="bg-white rounded-lg shadow-md p-3">
        <div className="text-center">
          <div className="w-8 h-8 bg-gray-200 rounded-full mx-auto mb-2 flex items-center justify-center">
            <svg
              className="w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>
          <p className="text-sm text-gray-500 font-medium">
            Sin profesor asignado
          </p>
          <p className="text-xs text-gray-400">Aula sin docente</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      {/* Header con foto y nombre - más espacioso */}
      <div className="flex  gap-3 mb-3">
        <FotoPerfilClientSide
          Google_Drive_Foto_ID={profesor.Google_Drive_Foto_ID}
          className="max-w-10 h-10 aspect-square"
        />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-800 leading-tight mb-1">
            {obtenerTitulo()}{" "}
            {aula.Nivel === NivelEducativo.PRIMARIA ? "Primaria" : "Secundaria"}{" "}
            - {aula.Grado}
            {aula.Seccion}:
          </h3>
          <p className="text-sm text-gray-700 font-medium leading-tight">
            {profesor.Nombres} {profesor.Apellidos}
          </p>
        </div>
      </div>

      {/* Información de contacto con más respiración */}
      <div className="space-y-3">
        {profesor.Celular ? (
          <>
            {/* Celular con ícono */}
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-3 h-3 text-green-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                </svg>
              </div>
              <span className="text-sm font-medium text-green-600">
                {profesor.Celular}
              </span>
            </div>

            {/* Botón de WhatsApp con más padding */}
            <button
              onClick={() => abrirWhatsApp(profesor.Celular!)}
              className="w-full bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.097" />
              </svg>
              Contactar
            </button>
          </>
        ) : (
          /* Mensaje cuando no hay celular - más espacioso */
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-2 text-gray-500 mb-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
              </svg>
              <span className="text-sm font-medium">
                Sin número de contacto
              </span>
            </div>
            <p className="text-xs text-gray-500">
              No disponible para contacto directo
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DatosProfesorDeAulaCard;
