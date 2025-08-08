"use client";
import React, { useState, useRef } from 'react';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import CreacionEvento from "@/components/modals/Eventos/CreacionEvento";
import EditarEvento from "@/components/modals/Eventos/EditarEvento";
import ElimiarEvento from "@/components/modals/Eventos/EliminarEvento";
import BotonConIcono from "@/components/buttons/BotonConIcono";
import AgregarIcon from "@/components/icons/AgregarIcon"
import LapizIcon from "@/components/icons/LapizIcon";
import BasureroIcon from "@/components/icons/BasureroIcon";

const EventosInterface = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const hoy = new Date();
  const [fechaDesde, setFechaDesde] = useState(hoy);
  const [fechaHasta, setFechaHasta] = useState(hoy);
  const [selectedState, setSelectedState] = useState('Todos');

  // Referencias a los inputs para controlar el calendario
  const inputDesdeRef = useRef<HTMLInputElement>(null);
  const inputHastaRef = useRef<HTMLInputElement>(null);

  const [showCreacionEvento, setShowCreacionEvento] = useState(false);
  const [showEditarEvento, setShowEditarEvento] = useState(false);
  const [showEliminarEvento, setShowEliminarEvento] = useState(false);

  const eventos = [
    {
      id: '001',
      nombre: 'Jueves Santo',
      fechaInicio: '17/04/2024',
      fechaConclusion: '17/04/2024',
      estado: 'Pasado'
    },
    {
      id: '002',
      nombre: 'Viernes Santo',
      fechaInicio: '18/04/2024',
      fechaConclusion: '18/04/2024',
      estado: 'Pasado'
    },
    {
      id: '003',
      nombre: 'Día del Trabajo',
      fechaInicio: '01/05/2024',
      fechaConclusion: '01/05/2024',
      estado: 'Activo'
    },
    {
      id: '004',
      nombre: 'San Pedro y San Pablo',
      fechaInicio: '29/06/2024',
      fechaConclusion: '29/06/2024',
      estado: 'Pendiente'
    },
    {
      id: '005',
      nombre: 'Fiestas Patrias',
      fechaInicio: '28/07/2024',
      fechaConclusion: '28/07/2024',
      estado: 'Pendiente'
    }
  ];

  const convertirFechaParaInput = (fecha: Date) =>
    `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(
      fecha.getDate()
    ).padStart(2, "0")}`;

  const manejarCambioFechaDesde = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nuevaFecha = new Date(e.target.value + "T00:00:00");
    setFechaDesde(nuevaFecha);
  };

  const manejarCambioFechaHasta = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nuevaFecha = new Date(e.target.value + "T00:00:00");
    setFechaHasta(nuevaFecha);
  };

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'Pasado':
        return 'bg-gray-800 text-white';
      case 'Activo':
        return 'bg-green-600 text-white';
      case 'Pendiente':
        return 'bg-orange-500 text-white';
      default:
        return 'bg-gray-400 text-black';
    }
  };

  const renderAcciones = (evento: any) => {
    if (evento.estado === 'Pasado') {
      return null;
    }
    
    if (evento.estado === 'Activo') {
      return (
        <BotonConIcono
          texto="Editar"
          IconTSX={
            <LapizIcon className="w-4 sxs-only:w-3 xs-only:w-3 sm-only:w-3 md-only:w-3 lg-only:w-3 xl-only:w-3 ml-2" />
          }
          className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold px-4 sxs-only:px-3 xs-only:px-3 sm-only:px-3 md-only:px-3 lg-only:px-2 xl-only:px-3 py-2 sxs-only:py-1.5 xs-only:py-1.5 sm-only:py-1.5 md-only:py-1.5 lg-only:py-1 xl-only:py-1.5 rounded-md flex items-center text-base sxs-only:text-sm xs-only:text-sm sm-only:text-sm md-only:text-sm lg-only:text-xs xl-only:text-sm transition"
          onClick={() => {
            setShowEditarEvento(true);
          }}
        />
      );
    }
    
    if (evento.estado === 'Pendiente') {
      return (
        <div className="flex gap-1">
          <BotonConIcono
            texto="Editar"
            IconTSX={
              <LapizIcon className="w-4 sxs-only:w-3 xs-only:w-3 sm-only:w-3 md-only:w-3 lg-only:w-3 xl-only:w-3 ml-2" />
            }
            className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold px-4 sxs-only:px-3 xs-only:px-3 sm-only:px-3 md-only:px-3 lg-only:px-2 xl-only:px-3 py-2 sxs-only:py-1.5 xs-only:py-1.5 sm-only:py-1.5 md-only:py-1.5 lg-only:py-1 xl-only:py-1.5 rounded-md flex items-center text-base sxs-only:text-sm xs-only:text-sm sm-only:text-sm md-only:text-sm lg-only:text-xs xl-only:text-sm transition"
            onClick={() => {
              setShowEditarEvento(true);
            }}
          />
          <BotonConIcono
              texto="Eliminar"
              IconTSX={
            <BasureroIcon className="w-4 sxs-only:w-3 xs-only:w-3 sm-only:w-3 md-only:w-3 lg-only:w-3 xl-only:w-3 ml-2" />
              }
              className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 sxs-only:px-3 xs-only:px-3 sm-only:px-3 md-only:px-3 lg-only:px-2 xl-only:px-3 py-2 sxs-only:py-1.5 xs-only:py-1.5 sm-only:py-1.5 md-only:py-1.5 lg-only:py-1 xl-only:py-1.5 rounded-md text-base sxs-only:text-sm xs-only:text-sm sm-only:text-sm md-only:text-sm lg-only:text-xs xl-only:text-sm transition"
              onClick={() => {
              setShowEliminarEvento(true);
            }}
          />
        </div>
      );
    }
  };

  return (
    <>
      {/* Estilos globales para ocultar el ícono del date picker */}
      <style jsx global>{`
        .date-input-custom::-webkit-calendar-picker-indicator {
          opacity: 0;
          position: absolute;
          right: 0;
          width: 100%;
          height: 100%;
          cursor: pointer;
          z-index: 1;
        }
        
        .date-input-custom::-webkit-inner-spin-button,
        .date-input-custom::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
          display: none;
        }
        
        .date-input-custom::-webkit-clear-button {
          display: none;
        }
        
        .date-input-custom {
          -webkit-appearance: none;
          -moz-appearance: textfield;
          appearance: none;
        }
        
        .date-input-custom:focus {
          outline: none;
          box-shadow: none;
        }
      `}</style>

      {showCreacionEvento && (
        <CreacionEvento
          eliminateModal={() => {
            setShowCreacionEvento(false);
          }}
        />
      )}

      {showEditarEvento && (
        <EditarEvento
          eliminateModal={() => {
            setShowEditarEvento(false);
          }}
        />
      )}

      {showEliminarEvento && (
        <ElimiarEvento
          eliminateModal={() => {
            setShowEliminarEvento(false);
          }}
        />
      )}

      <div className="w-full max-w-full overflow-hidden">
      <div className="px-3 py-4 sm:px-4 sm:py-4 md:px-6 md:py-6 lg:px-8 lg:py-8 bg-white min-h-screen font-sans">
        
        {/* Header */}
        <div className="mb-4 sm:mb-5 md:mb-6">
          <p className="text-gray-600 text-sm mb-2">Eventos</p>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 md:gap-4">
            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-black">BUSCAR EVENTOS</h1>
            <BotonConIcono
                  texto="Registrar Eventos"
                  IconTSX={
                    <AgregarIcon className="w-4 sxs-only:w-3 xs-only:w-3 sm-only:w-3 md-only:w-3 lg-only:w-3 xl-only:w-3 ml-2" />
                  }
                  className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center gap-2 w-full md:w-auto justify-center text-sm"
                  onClick={() => {
                    setShowCreacionEvento(true);
                  }}
                />
          </div>
        </div>

        {/* Filtros */}
        <div className="mb-4 sm:mb-5 md:mb-6 space-y-4">
          
          {/* Nombre de evento, Desde y Hasta */}
          <div className="flex flex-col lg:flex-row lg:items-end gap-3 lg:gap-4">
            {/* Nombres de Evento */}
            <div className="flex-1">
              <label className="text-black font-medium text-sm block mb-2">Nombres de Evento:</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border-2 border-red-600 rounded-lg focus:outline-none focus:border-red-800 text-sm"
                placeholder=""
              />
            </div>

            {/* Fechas */}
            <div className="flex flex-col sm:flex-row gap-3 lg:gap-4">
              <div className="flex-1">
                <label className="text-black font-medium text-sm block mb-2">Desde:</label>
                <div className="relative">
                  <input
                    ref={inputDesdeRef}
                    type="date"
                    defaultValue={convertirFechaParaInput(hoy)}
                    onChange={manejarCambioFechaDesde}
                    className="date-input-custom w-full px-3 py-2 bg-red-600 text-white rounded-lg focus:outline-none focus:bg-red-800 pr-8 text-sm cursor-pointer"
                  />
                  <Calendar 
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white cursor-pointer pointer-events-none" 
                    size={16}
                    onClick={() => inputDesdeRef.current?.showPicker()}
                  />
                </div>
              </div>
              <div className="flex-1">
                <label className="text-black font-medium text-sm block mb-2">Hasta:</label>
                <div className="relative">
                  <input
                    ref={inputHastaRef}
                    type="date"
                    defaultValue={convertirFechaParaInput(hoy)}
                    onChange={manejarCambioFechaHasta}
                    className="date-input-custom w-full px-3 py-2 bg-red-600 text-white rounded-lg focus:outline-none focus:bg-red-800 pr-8 text-sm cursor-pointer"
                  />
                  <Calendar 
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white cursor-pointer pointer-events-none" 
                    size={16}
                    onClick={() => inputHastaRef.current?.showPicker()}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Estado */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <label className="text-black font-medium text-sm">Estado:</label>
            <div className="relative">
              <select
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="px-3 py-2 bg-red-600 text-white rounded-lg focus:outline-none focus:bg-red-800 appearance-none pr-8 cursor-pointer text-sm w-full sm:w-auto"
              >
                <option value="Todos">Todos</option>
                <option value="Activo">Activo</option>
                <option value="Pendiente">Pendiente</option>
                <option value="Pasado">Pasado</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white pointer-events-none" size={16} />
            </div>
          </div>
        </div>

        {/* Vista de Tabla/Cards Responsive */}
        <div className="mb-6">
          {/* Vista de Cards para móviles */}
          <div className="block lg:hidden space-y-4">
            {eventos.map((evento) => (
              <div key={evento.id} className="bg-white rounded-lg shadow-sm border p-4">
                {/* Header del Card */}
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-gray-500">{evento.id}</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium w-20 text-center ${getEstadoColor(evento.estado)}`}>
                        {evento.estado}
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-900 text-base leading-tight">
                      {evento.nombre}
                    </h3>
                  </div>
                </div>
                
                {/* Información de fechas */}
                <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                  <div>
                    <span className="text-gray-500 block">Inicio:</span>
                    <span className="font-medium text-gray-900">{evento.fechaInicio}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Conclusión:</span>
                    <span className="font-medium text-gray-900">{evento.fechaConclusion}</span>
                  </div>
                </div>
                
                {/* Acciones */}
                {renderAcciones(evento) && (
                  <div className="pt-3 border-t border-gray-100">
                    {renderAcciones(evento)}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Vista de Tabla para pantallas grandes */}
          <div className="hidden lg:block bg-white rounded-lg shadow-sm border overflow-x-hidden">
            <div  className="w-full">
              <table className="w-full max-w-full table-fixed">
                {/* Header de tabla mejorado */}
                <thead>
                  <tr className="bg-red-600 text-white">
                    <th className="px-6 py-4 text-left font-semibold text-sm uppercase tracking-wider">ID</th>
                    <th className="px-6 py-4 text-left font-semibold text-sm uppercase tracking-wider">Nombre del Evento</th>
                    <th className="px-6 py-4 text-left font-semibold text-sm uppercase tracking-wider">Fecha Inicio</th>
                    <th className="px-6 py-4 text-left font-semibold text-sm uppercase tracking-wider">Fecha Conclusión</th>
                    <th className="px-6 py-4 text-left font-semibold text-sm uppercase tracking-wider">Estado</th>
                    <th className="px-6 py-4 text-left font-semibold text-sm uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>

                {/* Cuerpo de la tabla mejorado */}
                <tbody className="divide-y divide-gray-200 bg-white">
                  {eventos.map((evento) => (
                    <tr key={evento.id} className="hover:bg-gray-50 transition-colors duration-200">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{evento.id}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900 max-w-xs truncate" title={evento.nombre}>
                          {evento.nombre}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{evento.fechaInicio}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{evento.fechaConclusion}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-4 py-1 rounded-full text-xs font-semibold w-20 justify-center ${getEstadoColor(evento.estado)}`}>
                          {evento.estado}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {renderAcciones(evento)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Paginación */}
          <div className="flex flex-col sm:flex-row justify-center items-center gap-3 sm:gap-0">
            <div className="flex items-center border-2 border-red-600 rounded-lg overflow-hidden">
              <button className="px-3 py-2 text-red-600 hover:bg-red-600 hover:text-white transition-colors flex items-center gap-1 text-sm font-medium border-r border-red-200 disabled:opacity-50 disabled:cursor-not-allowed" disabled>
                <ChevronLeft size={16} /><span className="hidden sm:inline">Anterior</span>
              </button>
              
              <div className="flex">
                {[1, 2, 3].map(num => (
                  <button key={num} className={`px-3 py-2 ${num === 1 ? 'bg-red-600 text-white' : 'text-red-600 hover:bg-red-50'} font-medium text-sm min-w-[40px] ${num > 1 ? 'border-l border-red-200' : ''}`}>
                    {num}
                  </button>
                ))}
                <span className="hidden lg:flex items-center px-2 text-red-600 text-sm border-l border-red-200">...</span>
                <button className="hidden lg:block px-3 py-2 text-red-600 hover:bg-red-50 transition-colors text-sm font-medium min-w-[40px] border-l border-red-200">10</button>
              </div>
              
              <button className="px-3 py-2 text-red-600 hover:bg-red-600 hover:text-white transition-colors flex items-center gap-1 text-sm font-medium border-l border-red-200">
                <span className="hidden sm:inline">Siguiente</span><ChevronRight size={16} />
              </button>
            </div>
          </div>
      </div>
    </div>
    </>
  );
};

export default EventosInterface;