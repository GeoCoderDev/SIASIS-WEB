"use client";
import React, { useState, useRef, useMemo } from 'react';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import CreacionEvento from "@/components/modals/Eventos/CreacionEvento";
import EditarEvento from "@/components/modals/Eventos/EditarEvento";
import ElimiarEvento from "@/components/modals/Eventos/EliminarEvento";
import BotonConIcono from "@/components/buttons/BotonConIcono";
import AgregarIcon from "@/components/icons/AgregarIcon"
import LapizIcon from "@/components/icons/LapizIcon";
import BasureroIcon from "@/components/icons/BasureroIcon";
import { EstadoEvento } from "@/interfaces/shared/EstadoEventos";

const EventosInterface = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const hoy = new Date();
  const [fechaDesde, setFechaDesde] = useState(hoy);
  const [fechaHasta, setFechaHasta] = useState(hoy);
  const [selectedState, setSelectedState] = useState<'Todos' | EstadoEvento>('Todos');
  
  // Estados para paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const eventosPorPagina = 5;

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
      estado: EstadoEvento.Pasado
    },
    {
      id: '002',
      nombre: 'Viernes Santo',
      fechaInicio: '18/04/2024',
      fechaConclusion: '18/04/2024',
      estado: EstadoEvento.Pasado
    },
    {
      id: '003',
      nombre: 'Día del Trabajo',
      fechaInicio: '01/05/2024',
      fechaConclusion: '01/05/2024',
      estado: EstadoEvento.Activo
    },
    {
      id: '004',
      nombre: 'San Pedro y San Pablo',
      fechaInicio: '29/06/2024',
      fechaConclusion: '29/06/2024',
      estado: EstadoEvento.Pendiente
    },
    {
      id: '005',
      nombre: 'Fiestas Patrias',
      fechaInicio: '28/07/2024',
      fechaConclusion: '28/07/2024',
      estado: EstadoEvento.Pendiente
    },
    {
      id: '006',
      nombre: 'Batalla de Junín',
      fechaInicio: '06/08/2024',
      fechaConclusion: '06/08/2024',
      estado: EstadoEvento.Pendiente
    },
    {
      id: '007',
      nombre: 'Santa Rosa de Lima',
      fechaInicio: '30/08/2024',
      fechaConclusion: '30/08/2024',
      estado: EstadoEvento.Pendiente
    },
    {
      id: '008',
      nombre: 'Combate de Angamos',
      fechaInicio: '08/10/2024',
      fechaConclusion: '08/10/2024',
      estado: EstadoEvento.Pendiente
    },
    {
      id: '009',
      nombre: 'Todos los Santos',
      fechaInicio: '01/11/2024',
      fechaConclusion: '01/11/2024',
      estado: EstadoEvento.Pendiente
    },
    {
      id: '010',
      nombre: 'Inmaculada Concepción',
      fechaInicio: '08/12/2024',
      fechaConclusion: '08/12/2024',
      estado: EstadoEvento.Pendiente
    },
    {
      id: '011',
      nombre: 'Navidad',
      fechaInicio: '25/12/2024',
      fechaConclusion: '25/12/2024',
      estado: EstadoEvento.Pendiente
    },
    {
      id: '012',
      nombre: 'Año Nuevo',
      fechaInicio: '01/01/2025',
      fechaConclusion: '01/01/2025',
      estado: EstadoEvento.Pendiente
    }
  ];

  // Filtrar eventos y calcular paginación
  const eventosFiltrados = useMemo(() => {
    return eventos.filter(evento => {
      const cumpleFiltroEstado = selectedState === 'Todos' || evento.estado === selectedState;
      const cumpleFiltroNombre = evento.nombre.toLowerCase().includes(searchTerm.toLowerCase());
      return cumpleFiltroEstado && cumpleFiltroNombre;
    });
  }, [eventos, selectedState, searchTerm]);

  // Calcular información de paginación
  const totalPaginas = Math.ceil(eventosFiltrados.length / eventosPorPagina);
  const indiceInicio = (paginaActual - 1) * eventosPorPagina;
  const indiceFin = indiceInicio + eventosPorPagina;
  const eventosPaginaActual = eventosFiltrados.slice(indiceInicio, indiceFin);

  // Resetear página cuando cambian los filtros
  React.useEffect(() => {
    setPaginaActual(1);
  }, [selectedState, searchTerm]);

  // Funciones de navegación
  const irAPaginaAnterior = () => {
    if (paginaActual > 1) {
      setPaginaActual(paginaActual - 1);
    }
  };

  const irAPaginaSiguiente = () => {
    if (paginaActual < totalPaginas) {
      setPaginaActual(paginaActual + 1);
    }
  };

  const irAPagina = (numeroPagina: number) => {
    if (numeroPagina >= 1 && numeroPagina <= totalPaginas) {
      setPaginaActual(numeroPagina);
    }
  };

  // Generar números de página para mostrar
  const generarNumerosPagina = () => {
    const numeros: number[] = [];
    const rango = 2; // Mostrar 2 páginas antes y después de la actual
    
    let inicio = Math.max(1, paginaActual - rango);
    let fin = Math.min(totalPaginas, paginaActual + rango);
    
    // Asegurar que siempre mostremos al menos 5 páginas si es posible
    if (fin - inicio < 4) {
      if (inicio === 1) {
        fin = Math.min(totalPaginas, inicio + 4);
      } else if (fin === totalPaginas) {
        inicio = Math.max(1, fin - 4);
      }
    }
    
    for (let i = inicio; i <= fin; i++) {
      numeros.push(i);
    }
    
    return numeros;
  };

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

  const getEstadoColor = (estado: EstadoEvento) => {
    switch (estado) {
      case EstadoEvento.Pasado:
        return 'bg-gray-800 text-white';
      case EstadoEvento.Activo:
        return 'bg-green-600 text-white';
      case EstadoEvento.Pendiente:
        return 'bg-orange-500 text-white';
      default:
        return 'bg-gray-400 text-black';
    }
  };

  const renderAcciones = (evento: any) => {
    if (evento.estado === EstadoEvento.Pasado) {
      return null;
    }
    
    if (evento.estado === EstadoEvento.Activo) {
      return (
        <BotonConIcono
          texto="Editar"
          IconTSX={
            <LapizIcon className="w-4 h-4 ml-1 flex-shrink-0" />
          }
          className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold px-2 py-1 rounded-md flex items-center gap-1 text-sm whitespace-nowrap transition"
          onClick={() => {
            setShowEditarEvento(true);
          }}
        />
      );
    }
    
    if (evento.estado === EstadoEvento.Pendiente) {
      return (
        <div className="flex gap-2 flex-nowrap">
          <BotonConIcono
            texto="Editar"
            IconTSX={
              <LapizIcon className="w-4 h-4 ml-1 flex-shrink-0" />
            }
            className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold px-2 py-1 rounded-md flex items-center gap-1 text-sm whitespace-nowrap transition"
            onClick={() => {
              setShowEditarEvento(true);
            }}
          />
          <BotonConIcono
              texto="Eliminar"
              IconTSX={
            <BasureroIcon className="w-4 h-4 ml-1 flex-shrink-0" />
              }
              className="bg-red-600 hover:bg-red-700 text-white font-bold px-2 py-1 rounded-md flex items-center gap-1 text-sm whitespace-nowrap transition"
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
                onChange={(e) => setSelectedState(e.target.value as 'Todos' | EstadoEvento)}
                className="px-3 py-2 bg-red-600 text-white rounded-lg focus:outline-none focus:bg-red-800 appearance-none pr-8 cursor-pointer text-sm w-full sm:w-auto"
              >
                <option value="Todos">Todos</option>
                <option value={EstadoEvento.Activo}>Activo</option>
                <option value={EstadoEvento.Pendiente}>Pendiente</option>
                <option value={EstadoEvento.Pasado}>Pasado</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white pointer-events-none" size={16} />
            </div>
          </div>
        </div>

        {/* Vista de Tabla/Cards Responsive */}
        <div className="mb-6">
          {/* Vista de Cards para móviles - MEJORADA */}
          <div className="block lg:hidden space-y-6">
            {eventosPaginaActual.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg font-medium">No se encontraron eventos</p>
                <p className="text-sm">
                  {selectedState === 'Todos' 
                    ? 'No hay eventos disponibles.' 
                    : `No hay eventos con estado "${selectedState}".`
                  }
                </p>
              </div>
            ) : (
              eventosPaginaActual.map((evento) => (
              <div key={evento.id} className="bg-white rounded-xl shadow-md border border-gray-100 p-6 transition-all duration-200 hover:shadow-lg">
                {/* Header del Card con mejor espaciado */}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
                  <div className="flex-1">
                    <div className="flex items-center justify-between sm:justify-start sm:gap-3 mb-3">
                      <span className="text-xs font-semibold text-gray-400 bg-gray-50 px-3 py-1 rounded-full tracking-wider uppercase">
                        ID: {evento.id}
                      </span>
                      <span className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm ${getEstadoColor(evento.estado)}`}>
                        {evento.estado}
                      </span>
                    </div>
                    <h3 className="font-bold text-gray-900 text-lg leading-tight mb-2">
                      {evento.nombre}
                    </h3>
                  </div>
                </div>
                
                {/* Información de fechas con mejor diseño */}
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div className="flex flex-col space-y-1">
                      <span className="text-gray-500 font-medium text-xs uppercase tracking-wider">Fecha de Inicio</span>
                      <span className="font-semibold text-gray-900 text-base">{evento.fechaInicio}</span>
                    </div>
                    <div className="flex flex-col space-y-1">
                      <span className="text-gray-500 font-medium text-xs uppercase tracking-wider">Fecha de Conclusión</span>
                      <span className="font-semibold text-gray-900 text-base">{evento.fechaConclusion}</span>
                    </div>
                  </div>
                </div>
                
                {/* Acciones con mejor espaciado */}
                {renderAcciones(evento) && (
                  <div className="flex justify-center sm:justify-start">
                    <div className="w-full sm:w-auto">
                      {renderAcciones(evento)}
                    </div>
                  </div>
                )}
                
                {/* Línea decorativa sutil si no hay acciones */}
                {!renderAcciones(evento) && (
                  <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent"></div>
                )}
              </div>
              ))
            )}
          </div>

          {/* Vista de Tabla para pantallas grandes */}
          <div className="hidden lg:block bg-white rounded-lg shadow-sm border overflow-x-hidden">
            <div className="w-full">
              <table className="w-full table-auto">
                {/* Header de tabla mejorado */}
                <thead>
                  <tr className="bg-red-600 text-white">
                    <th className="px-4 py-4 text-left font-semibold text-sm uppercase tracking-wider w-auto">ID</th>
                    <th className="px-6 py-4 text-left font-semibold text-sm uppercase tracking-wider">Nombre del Evento</th>
                    <th className="px-4 py-4 text-left font-semibold text-sm uppercase tracking-wider w-auto">Fecha Inicio</th>
                    <th className="px-4 py-4 text-left font-semibold text-sm uppercase tracking-wider w-auto">Fecha Conclusión</th>
                    <th className="px-6 py-4 text-left font-semibold text-sm uppercase tracking-wider">Estado</th>
                    <th className="px-6 py-4 text-left font-semibold text-sm uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>

                {/* Cuerpo de la tabla mejorado */}
                <tbody className="divide-y divide-gray-200 bg-white">
                  {eventosPaginaActual.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                        <p className="text-lg font-medium">No se encontraron eventos</p>
                        <p className="text-sm">
                          {selectedState === 'Todos' 
                            ? 'No hay eventos disponibles.' 
                            : `No hay eventos con estado "${selectedState}".`
                          }
                        </p>
                      </td>
                    </tr>
                  ) : (
                    eventosPaginaActual.map((evento) => (
                    <tr key={evento.id} className="hover:bg-gray-50 transition-colors duration-200">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{evento.id}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900" title={evento.nombre}>
                          {evento.nombre}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{evento.fechaInicio}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
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
                  ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Paginación Funcional */}
        {totalPaginas > 1 && (
          <div className="flex flex-col sm:flex-row justify-center items-center gap-3 sm:gap-0">
            <div className="flex items-center border-2 border-red-600 rounded-lg overflow-hidden">
              <button 
                className="px-3 py-2 text-red-600 hover:bg-red-600 hover:text-white transition-colors flex items-center gap-1 text-sm font-medium border-r border-red-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-red-600" 
                disabled={paginaActual === 1}
                onClick={irAPaginaAnterior}
              >
                <ChevronLeft size={16} /><span className="hidden sm:inline">Anterior</span>
              </button>
              
              <div className="flex">
                {generarNumerosPagina().map(num => (
                  <button 
                    key={num} 
                    className={`px-3 py-2 ${num === paginaActual ? 'bg-red-600 text-white' : 'text-red-600 hover:bg-red-50'} font-medium text-sm min-w-[40px] ${num > generarNumerosPagina()[0] ? 'border-l border-red-200' : ''}`}
                    onClick={() => irAPagina(num)}
                  >
                    {num}
                  </button>
                ))}
                {totalPaginas > 5 && generarNumerosPagina()[generarNumerosPagina().length - 1] < totalPaginas && (
                  <>
                    <span className="hidden lg:flex items-center px-2 text-red-600 text-sm border-l border-red-200">...</span>
                    <button 
                      className="hidden lg:block px-3 py-2 text-red-600 hover:bg-red-50 transition-colors text-sm font-medium min-w-[40px] border-l border-red-200"
                      onClick={() => irAPagina(totalPaginas)}
                    >
                      {totalPaginas}
                    </button>
                  </>
                )}
              </div>
              
              <button 
                className="px-3 py-2 text-red-600 hover:bg-red-600 hover:text-white transition-colors flex items-center gap-1 text-sm font-medium border-l border-red-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-red-600"
                disabled={paginaActual === totalPaginas}
                onClick={irAPaginaSiguiente}
              >
                <span className="hidden sm:inline">Siguiente</span><ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Información de paginación */}
        {eventosFiltrados.length > 0 && (
          <div className="mt-4 text-center text-sm text-gray-600">
            Mostrando {indiceInicio + 1} - {Math.min(indiceFin, eventosFiltrados.length)} de {eventosFiltrados.length} eventos
          </div>
        )}
      </div>
    </div>
    </>
  );
};

export default EventosInterface;