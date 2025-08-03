"use client";
import React, { useState } from 'react';
import { Calendar, ChevronDown, Edit, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';

const EventosInterface = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [fromDate, setFromDate] = useState('06/09/2024');
  const [toDate, setToDate] = useState('09/09/2024');
  const [selectedState, setSelectedState] = useState('Todos');
  const [currentPage, setCurrentPage] = useState(1);

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

  const getEstadoColor = (estado) => {
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

  const renderAcciones = (evento) => {
    if (evento.estado === 'Pasado') {
      return null;
    }
    
    if (evento.estado === 'Activo') {
      return (
        <button className="bg-yellow-400 text-black px-2 py-1 rounded text-xs font-medium hover:opacity-80 transition-opacity flex items-center gap-1 whitespace-nowrap">
          <Edit size={12} />
          <span>Editar</span>
        </button>
      );
    }
    
    if (evento.estado === 'Pendiente') {
      return (
        <div className="flex gap-1">
          <button className="bg-yellow-400 text-black px-2 py-1 rounded text-xs font-medium hover:opacity-80 transition-opacity flex items-center gap-1 whitespace-nowrap">
            <Edit size={12} />
            <span>Editar</span>
          </button>
          <button className="bg-red-600 text-white px-2 py-1 rounded text-xs font-medium hover:opacity-80 transition-opacity flex items-center gap-1 whitespace-nowrap">
            <Trash2 size={12} />
            <span>Eliminar</span>
          </button>
        </div>
      );
    }
  };

  return (
    <div className="w-full max-w-full overflow-hidden">
      <div className="px-3 py-4 sm:px-4 sm:py-4 md:px-6 md:py-6 lg:px-8 lg:py-8 bg-white min-h-screen font-sans">
        
        {/* Header */}
        <div className="mb-4 sm:mb-5 md:mb-6">
          <p className="text-gray-600 text-sm mb-2">Eventos</p>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 md:gap-4">
            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-black">BUSCAR EVENTOS</h1>
            <button className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center gap-2 w-full md:w-auto justify-center text-sm">
              <Calendar size={16} />
              Registrar Eventos
            </button>
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
                    type="text"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full px-3 py-2 bg-red-600 text-white rounded-lg focus:outline-none focus:bg-red-800 pr-8 text-sm"
                  />
                  <Calendar className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white" size={16} />
                </div>
              </div>
              <div className="flex-1">
                <label className="text-black font-medium text-sm block mb-2">Hasta:</label>
                <div className="relative">
                  <input
                    type="text"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full px-3 py-2 bg-red-600 text-white rounded-lg focus:outline-none focus:bg-red-800 pr-8 text-sm"
                  />
                  <Calendar className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white" size={16} />
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

        {/* Tabla Responsive - Para todas las pantallas */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden mb-6">
          {/* Contenedor con scroll horizontal solo para la tabla */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-max">
              {/* Header de tabla */}
              <thead>
                <tr className="bg-red-600 text-white">
                  <th className="px-4 py-3 text-left font-medium text-sm whitespace-nowrap">ID</th>
                  <th className="px-4 py-3 text-left font-medium text-sm whitespace-nowrap">Nombre del Evento</th>
                  <th className="px-4 py-3 text-left font-medium text-sm whitespace-nowrap">Fecha Inicio</th>
                  <th className="px-4 py-3 text-left font-medium text-sm whitespace-nowrap">Fecha Conclusión</th>
                  <th className="px-4 py-3 text-left font-medium text-sm whitespace-nowrap">Estado</th>
                  <th className="px-4 py-3 text-left font-medium text-sm whitespace-nowrap">Acciones</th>
                </tr>
              </thead>

              {/* Cuerpo de la tabla */}
              <tbody className="divide-y divide-gray-200">
                {eventos.map((evento, index) => (
                  <tr key={evento.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-black font-medium text-sm whitespace-nowrap">{evento.id}</td>
                    <td className="px-4 py-3 text-black text-sm whitespace-nowrap">{evento.nombre}</td>
                    <td className="px-4 py-3 text-black text-sm whitespace-nowrap">{evento.fechaInicio}</td>
                    <td className="px-4 py-3 text-black text-sm whitespace-nowrap">{evento.fechaConclusion}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEstadoColor(evento.estado)}`}>
                        {evento.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {renderAcciones(evento)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Paginación Responsive */}
        <div className="flex justify-center">
          <div className="flex items-center gap-1 border-2 border-red-600 rounded-lg p-1">
            <button className="px-2 py-1 text-red-600 hover:bg-red-600 hover:text-white transition-colors rounded flex items-center gap-1 text-xs sm:text-sm">
              <ChevronLeft size={14} />
              <span className="hidden sm:inline">Anterior</span>
            </button>
            
            <button className="px-2 py-1 bg-red-600 text-white rounded font-medium text-xs sm:text-sm">1</button>
            <button className="px-2 py-1 text-red-600 hover:bg-red-600 hover:text-white transition-colors rounded text-xs sm:text-sm">2</button>
            <button className="px-2 py-1 text-red-600 hover:bg-red-600 hover:text-white transition-colors rounded text-xs sm:text-sm">3</button>
            <button className="px-2 py-1 text-red-600 hover:bg-red-600 hover:text-white transition-colors rounded text-xs sm:text-sm">4</button>
            <span className="px-1 text-red-600 text-xs sm:text-sm">...</span>
            
            <button className="px-2 py-1 text-red-600 hover:bg-red-600 hover:text-white transition-colors rounded flex items-center gap-1 text-xs sm:text-sm">
              <span className="hidden sm:inline">Siguiente</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default EventosInterface;