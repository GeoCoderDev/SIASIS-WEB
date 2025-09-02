'use client';

import React, { useState, useRef } from 'react';
import { Upload, Calendar, FileText, Eye, X } from 'lucide-react';

const RegistrarComunicado = () => {
  const [fechaInicio, setFechaInicio] = useState(new Date());
  const [fechaConclusio, setFechaConclusio] = useState(new Date());
  const [titulo, setTitulo] = useState('Comunicado');
  const [contenido, setContenido] = useState(`Estimados Padres de Familia reciban un cordial saludo, por intermedio de la presente, les hacemos recordar que el primer período vacacional de nuestros estudiantes está programado a partir del día lunes 10 al viernes 14 de mayo. Esperamos con mucho entusiasmo a nuestros estudiantes, para el reinicio de las clases modalidad a distancia a partir del día lunes 17 de mayo en el horario escolar habitual.

Nuestro personal docente y administrativo continuará con el trabajo técnico pedagógico.

Gracias por su atención.

Atentamente.

Dirección Académica`);
  const [imagen, setImagen] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mostrarRegistrado, setMostrarRegistrado] = useState(false);
  const [mostrarImagenModal, setMostrarImagenModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputInicioRef = useRef<HTMLInputElement>(null);
  const inputConclusioRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelection(files[0]);
    }
  };

  const handleFileSelection = (file: File) => {
    const allowedTypes = ['image/png', 'image/jpg', 'image/jpeg'];

    if (allowedTypes.includes(file.type)) {
      setImagen(file);
      const url: string = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      alert('Solo se permiten archivos PNG, JPG o JPEG');
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelection(file);
    }
  };

  const handleRegistrarComunicado = () => {
    setMostrarRegistrado(true);
    setTimeout(() => {
      setMostrarRegistrado(false);
    }, 3000);
  };

  const convertirFechaParaInput = (fecha: Date) => {
    return fecha.toISOString().split('T')[0];
  };

  return (
    <div className="min-h-screen bg-white p-4 lg:p-6">
      {/* Estilos globales para ocultar el ícono nativo del date picker */}
      <style jsx global>{`
        input[type="date"]::-webkit-calendar-picker-indicator {
          opacity: 0;
          position: absolute;
          right: 0;
          width: 100%;
          height: 100%;
          cursor: pointer;
        }
      `}</style>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Formulario Principal */}
        <div className="lg:flex-1">
          <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-black">
            REGISTRAR COMUNICADOS
          </h1>
          <br />

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha de Inicio:
              </label>
              <div className="relative">
                <input
                  ref={inputInicioRef}
                  type="date"
                  value={convertirFechaParaInput(fechaInicio)}
                  onChange={(e) => setFechaInicio(new Date(e.target.value + "T00:00:00"))}
                  className="w-full px-3 py-2 bg-red-600 text-white rounded-lg focus:outline-none focus:bg-red-800 pr-8 text-sm cursor-pointer"
                />
                <Calendar
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white cursor-pointer"
                  size={18}
                  onClick={() => inputInicioRef.current?.showPicker()}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha de Conclusión:
              </label>
              <div className="relative">
                <input
                  ref={inputConclusioRef}
                  type="date"
                  value={convertirFechaParaInput(fechaConclusio)}
                  onChange={(e) => setFechaConclusio(new Date(e.target.value + "T00:00:00"))}
                  className="w-full px-3 py-2 bg-red-600 text-white rounded-lg focus:outline-none focus:bg-red-800 pr-8 text-sm cursor-pointer"
                />
                <Calendar
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white cursor-pointer"
                  size={18}
                  onClick={() => inputConclusioRef.current?.showPicker()}
                />
              </div>
            </div>
          </div>

          {/* Título */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Título:</label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Contenido */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Contenido:</label>
            <textarea
              value={contenido}
              onChange={(e) => setContenido(e.target.value)}
              rows={10}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Imagen Adjunta */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Imagen Adjunta(Opcional):</label>
            <div
              className="border-2 border-dashed border-blue-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 transition-colors"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mx-auto h-10 w-10 text-blue-400 mb-3" />
              <p className="text-blue-600 text-sm">
                {imagen ? imagen.name : 'Arrastra y suelta la imagen aquí o haz clic para seleccionar una'}
              </p>
              <p className="text-gray-500 text-xs mt-2">PNG, JPG, JPEG</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".png,.jpg,.jpeg"
                onChange={handleFileInputChange}
                className="hidden"
              />
            </div>
          </div>

          {/* Botón Ver Imagen (solo móvil) */}
          {imagen && (
            <div className="mb-6 lg:hidden text-center">
              <button
                onClick={() => setMostrarImagenModal(true)}
                className="bg-black hover:bg-gray-800 text-white text-sm py-2 px-4 rounded transition-colors"
              >
                Ver imagen adjuntada
              </button>
            </div>
          )}

          {/* Mensaje de Éxito */}
          {mostrarRegistrado && (
            <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
              ¡Comunicado Registrado!
            </div>
          )}

          {/* Botón Registrar */}
          <div className="text-center mb-6">
            <button
              onClick={handleRegistrarComunicado}
              className="bg-green-500 hover:bg-green-600 text-white font-medium py-3 px-8 rounded transition-colors"
            >
              Registrar Comunicado
            </button>
          </div>
        </div>

        {/* Vista Previa - Solo desktop */}
        <div className="hidden lg:block lg:w-1/2 xl:w-2/5 pb-6">
          <h3 className="text-lg font-medium text-gray-800 mb-4 text-center">Vista Previa:</h3>

          {/* Marco del comunicado con sombra */}
          <div className="relative bg-white rounded-lg shadow-lg p-6 border-4 border-[#dd3524]">
            <div className="relative z-10">
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
                <img
                  src="/images/svg/Logo.svg"
                  alt="Logo Colegio"
                  className="w-55 h-55 lg:w-60 lg:h-60 object-contain"
                />
              </div>
              <div className="text-center mb-6">
                <h4 className="text-xl font-bold text-gray-800">{titulo}</h4>
              </div>

              <div className="text-sm text-gray-700 mb-6 leading-relaxed text-justify">
                {contenido.split('\n').map((paragraph, index) => (
                  <p key={index} className="mb-3">
                    {paragraph}
                  </p>
                ))}
              </div>

              {/* Mostrar imagen directamente en la vista previa */}
              {imagen && previewUrl && (
                <div className="mb-6 text-center">
                  <img
                    src={previewUrl}
                    alt="Imagen adjunta"
                    className="max-w-full max-h-48 mx-auto rounded border shadow-sm"
                    style={{ objectFit: 'contain' }}
                  />
                </div>
              )}

              {/* Botón Ver Imagen Adjunta dentro del marco */}
              {imagen && (
                <div className="text-center mb-6">
                  <button
                    onClick={() => setMostrarImagenModal(true)}
                    className="bg-black hover:bg-gray-800 text-white text-sm py-2 px-4 rounded transition-colors shadow-md"
                  >
                    Ver imagen adjuntada
                  </button>
                </div>
              )}

              <div className="text-center text-sm text-gray-600 space-y-2">
                <p>Atentamente,</p>
                <p className="font-medium">Dirección Académica</p>
                <div className="pt-4 border-t border-gray-200 mt-4">
                  <p className="text-xs">Período: {convertirFechaParaInput(fechaInicio)} - {convertirFechaParaInput(fechaConclusio)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal para mostrar imagen */}
      {mostrarImagenModal && previewUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 max-w-4xl max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Imagen Adjunta</h3>
              <button
                onClick={() => setMostrarImagenModal(false)}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <img
              src={previewUrl}
              alt="Imagen adjunta"
              className="max-w-full h-auto rounded"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default RegistrarComunicado;
