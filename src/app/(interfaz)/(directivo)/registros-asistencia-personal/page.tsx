"use client";
import { EstadosAsistenciaPersonalStyles } from "@/Assets/styles/EstadosAsistenciaPersonalStyles";
import { EstadosAsistenciaPersonal } from "@/interfaces/shared/EstadosAsistenciaPersonal";
import { Meses, mesesTextos } from "@/interfaces/shared/Meses";
import { RolesSistema } from "@/interfaces/shared/RolesSistema";
import getDiasEscolaresPorMes from "@/lib/helpers/functions/date/getDiasEsolaresPorMes";
import { segundosAMinutos } from "@/lib/helpers/functions/time/segundosAMinutos";
import {
  ErrorResponseAPIBase,
  MessageProperty,
} from "@/interfaces/shared/apis/types";
import { useState } from "react";
import { AsistenciaDePersonalIDB } from "@/lib/utils/local/db/models/AsistenciaDePersonal/AsistenciaDePersonalIDB";
import { convertirAFormato12Horas } from "@/lib/helpers/formatters/fechas-hora/formatearAFormato12Horas";
import { ENTORNO } from "@/constants/ENTORNO";
import { Entorno } from "@/interfaces/shared/Entornos";
import {
  EventosIDB,
  IEventoLocal,
} from "@/lib/utils/local/db/models/EventosIDB";
import { RegistroEntradaSalida } from "@/interfaces/shared/AsistenciaRequests";
import { AsistenciaMensualPersonalLocal } from "@/lib/utils/local/db/models/AsistenciaDePersonal/AsistenciaDePersonalTypes";
import { RootState } from "@/global/store";
import { useSelector } from "react-redux";
import {
  Search,
  Loader2,
  Calendar,
  Users,
  AlertCircle,
  CheckCircle,
  Info,
  Clock,
  FileText,
} from "lucide-react";
import SiasisUserSelector from "@/components/inputs/SiasisUserSelector";

// 🔧 CONSTANTE DE CONFIGURACIÓN PARA DESARROLLO
const CONSIDERAR_DIAS_NO_ESCOLARES = false; // false = solo días laborales, true = incluir sábados y domingos

interface RegistroDia {
  fecha: string;
  entradaProgramada: string;
  entradaReal: string;
  diferenciaEntrada: string;
  estadoEntrada: EstadosAsistenciaPersonal;
  salidaProgramada: string;
  salidaReal: string;
  diferenciaSalida: string;
  estadoSalida: EstadosAsistenciaPersonal;
  esEvento: boolean;
  nombreEvento?: string;
  esDiaNoEscolar?: boolean;
}

const RegistrosAsistenciaDePersonal = () => {
  const [selectedRol, setSelectedRol] = useState<RolesSistema>();
  const [selectedMes, setSelectedMes] = useState("");
  const [id_o_DNI, setId_o_DNI] = useState<string | number>();
  const [loading, setLoading] = useState(false);
  const [loadingEventos, setLoadingEventos] = useState(false);
  const [data, setData] = useState<AsistenciaMensualPersonalLocal | null>(null);
  const [eventos, setEventos] = useState<IEventoLocal[]>([]);
  const [registros, setRegistros] = useState<RegistroDia[]>([]);
  const [error, setError] = useState<ErrorResponseAPIBase | null>(null);
  const [successMessage, setSuccessMessage] = useState("");

  // ✅ Estado para controlar si se han realizado búsquedas
  const [hasSearched, setHasSearched] = useState(false);

  // ✅ MEJORADO: Usar useSelector para obtener fecha de Redux reactivamente
  const fechaHoraRedux = useSelector(
    (state: RootState) => state.others.fechaHoraActualReal.fechaHora
  );

  // ✅ MEJORADO: Función helper para obtener fecha Redux con manejo de errores
  const obtenerFechaRedux = () => {
    if (!fechaHoraRedux) {
      return null;
    }

    try {
      const fechaObj = new Date(fechaHoraRedux);

      // Validar que la fecha sea válida
      if (isNaN(fechaObj.getTime())) {
        console.error("❌ Fecha inválida desde Redux:", fechaHoraRedux);
        return null;
      }

      return {
        fechaActual: fechaObj,
        mesActual: fechaObj.getMonth() + 1,
        diaActual: fechaObj.getDate(),
        añoActual: fechaObj.getFullYear(),
        timestamp: fechaObj.getTime(),
        esHoy: true,
      };
    } catch (error) {
      console.error("❌ Error al procesar fecha de Redux:", error);
      return null;
    }
  };

  // ✅ MEJORADO: Obtener fecha una vez y manejar el caso de error
  const fechaRedux = obtenerFechaRedux();

  // ✅ MEJORADO: Si no hay fecha de Redux, mostrar error en lugar de fallback
  const mesActual = fechaRedux?.mesActual || new Date().getMonth() + 1; // fallback solo si Redux falla
  const diaActual = fechaRedux?.diaActual || new Date().getDate();
  const añoActual = fechaRedux?.añoActual || new Date().getFullYear();

  // Función para obtener meses disponibles (hasta mayo o mes actual)
  const getMesesDisponibles = () => {
    const mesesDisponibles: { value: string; label: string }[] = [];
    const limiteMaximo = mesActual;

    for (let mes = 3; mes <= limiteMaximo; mes++) {
      // Empezar desde marzo (3)
      mesesDisponibles.push({
        value: mes.toString(),
        label: mesesTextos[mes as Meses],
      });
    }

    return mesesDisponibles;
  };

  // Función para verificar si una fecha debe mostrarse (no futura)
  const esFechaValida = (fecha: string): boolean => {
    const fechaObj = new Date(fecha + "T00:00:00");
    const fechaHoy = new Date(añoActual, mesActual - 1, diaActual); // mes-1 porque Date usa 0-11

    return fechaObj <= fechaHoy;
  };

  const [asistenciaPersonalIDB] = useState(
    () =>
      new AsistenciaDePersonalIDB(
        "API01",
        setLoading,
        (error: ErrorResponseAPIBase | null) => {
          if (error) {
            setError({
              success: false,
              message: error.message,
            });
          } else {
            setError(null);
          }
        },
        (message: MessageProperty | null) => {
          if (message) {
            setSuccessMessage(message.message);
            setTimeout(() => setSuccessMessage(""), 3000);
          } else {
            setSuccessMessage("");
          }
        }
      )
  );

  const roles = [
    {
      value: RolesSistema.ProfesorPrimaria,
      label: "Profesor de Primaria",
      icon: "👨‍🏫",
    },
    {
      value: RolesSistema.ProfesorSecundaria,
      label: "Profesor de Secundaria",
      icon: "👩‍🏫",
    },
    { value: RolesSistema.Auxiliar, label: "Auxiliar", icon: "👤" },
    {
      value: RolesSistema.PersonalAdministrativo,
      label: "Personal Administrativo",
      icon: "💼",
    },
  ];

  // 🔧 FUNCIÓN CORREGIDA para verificar si un día es evento
  const esEvento = (
    fecha: string
  ): { esEvento: boolean; nombreEvento?: string } => {
    const evento = eventos.find((e) => {
      const fechaInicio = new Date(e.Fecha_Inicio + "T00:00:00");
      const fechaFin = new Date(e.Fecha_Conclusion + "T00:00:00");
      const fechaConsulta = new Date(fecha + "T00:00:00");

      return fechaConsulta >= fechaInicio && fechaConsulta <= fechaFin;
    });

    const resultado = {
      esEvento: !!evento,
      nombreEvento: evento?.Nombre,
    };

    return resultado;
  };

  // Función para mapear estados del enum a strings para la UI
  const mapearEstadoParaUI = (estado: EstadosAsistenciaPersonal): string => {
    const mapeoEstados: Record<EstadosAsistenciaPersonal, string> = {
      [EstadosAsistenciaPersonal.Temprano]: "Temprano",
      [EstadosAsistenciaPersonal.En_Tiempo]: "En tiempo",
      [EstadosAsistenciaPersonal.Cumplido]: "Cumplido",
      [EstadosAsistenciaPersonal.Salida_Anticipada]: "Salida anticipada",
      [EstadosAsistenciaPersonal.Tarde]: "Tarde",
      [EstadosAsistenciaPersonal.Falta]: "Falta",
      [EstadosAsistenciaPersonal.Sin_Registro]: "Sin registro",
      [EstadosAsistenciaPersonal.No_Registrado]: "No registrado",
      [EstadosAsistenciaPersonal.Inactivo]: "Inactivo",
      [EstadosAsistenciaPersonal.Evento]: "Evento",
      [EstadosAsistenciaPersonal.Otro]: "Otro",
    };

    return mapeoEstados[estado] || estado;
  };

  // 🕐 FUNCIÓN ADAPTADA para calcular la hora programada con formato 12 horas
  const calcularHoraProgramada = (
    timestamp: number,
    desfaseSegundos: number
  ): string => {
    if (timestamp === 0 || timestamp === null) return "N/A";

    const timestampProgramado = timestamp - desfaseSegundos * 1000;
    const timestampPeru = timestampProgramado + 5 * 60 * 60 * 1000;
    const fechaProgramadaPeru = new Date(timestampPeru);

    const tiempo24Horas = fechaProgramadaPeru.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    return convertirAFormato12Horas(tiempo24Horas, false);
  };

  // 🕐 FUNCIÓN ADAPTADA para formatear hora con formato 12 horas
  const formatearHora = (timestamp: number): string => {
    if (timestamp === 0 || timestamp === null) return "No registrado";

    const timestampPeru = timestamp + 5 * 60 * 60 * 1000;
    const fechaPeru = new Date(timestampPeru);

    const tiempo24Horas = fechaPeru.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    return convertirAFormato12Horas(tiempo24Horas, false);
  };

  // Función para verificar si una fecha es día laboral (lunes a viernes)
  const esDiaLaboral = (fecha: string): boolean => {
    const fechaObj = new Date(fecha + "T00:00:00");
    const diaSemana = fechaObj.getDay(); // 0=domingo, 1=lunes, ..., 6=sábado
    return diaSemana >= 1 && diaSemana <= 5; // Solo lunes a viernes
  };

  // 📅 FUNCIÓN MEJORADA para generar todas las fechas del mes según configuración
  const obtenerFechasDelMes = (mes: number, año: number): string[] => {
    if (CONSIDERAR_DIAS_NO_ESCOLARES && ENTORNO === Entorno.LOCAL) {
      const fechas: string[] = [];
      const ultimoDiaDelMes = new Date(año, mes, 0).getDate();

      for (let dia = 1; dia <= ultimoDiaDelMes; dia++) {
        const fecha = `${año}-${mes.toString().padStart(2, "0")}-${dia
          .toString()
          .padStart(2, "0")}`;
        fechas.push(fecha);
      }

      return fechas;
    } else {
      return getDiasEscolaresPorMes(mes, año);
    }
  };

  // Función para obtener asistencias combinadas de entrada y salida
  const obtenerAsistenciasCombinadas = async (
    rol: RolesSistema,
    id_o_dni: string | number,
    mes: number
  ): Promise<Record<
    string,
    { entrada?: RegistroEntradaSalida; salida?: RegistroEntradaSalida }
  > | null> => {
    try {
      const resultado =
        await asistenciaPersonalIDB.obtenerAsistenciaMensualConAPI({
          id_o_dni,
          mes,
          rol,
        });

      if (!resultado.encontrado) {
        return null;
      }

      const registrosCombinados: Record<
        string,
        { entrada?: RegistroEntradaSalida; salida?: RegistroEntradaSalida }
      > = {};

      const año = new Date().getFullYear();

      // Procesar entradas
      if (resultado.entrada) {
        Object.entries(resultado.entrada.registros).forEach(
          ([dia, registro]) => {
            const fechaCompleta = `${año}-${mes
              .toString()
              .padStart(2, "0")}-${dia.padStart(2, "0")}`;

            const esLaboral = esDiaLaboral(fechaCompleta);
            const debeIncluir = CONSIDERAR_DIAS_NO_ESCOLARES || esLaboral;

            if (debeIncluir) {
              if (!registrosCombinados[dia]) {
                registrosCombinados[dia] = {};
              }
              registrosCombinados[dia].entrada = registro;
            }
          }
        );
      }

      // Procesar salidas
      if (resultado.salida) {
        Object.entries(resultado.salida.registros).forEach(
          ([dia, registro]) => {
            const fechaCompleta = `${año}-${mes
              .toString()
              .padStart(2, "0")}-${dia.padStart(2, "0")}`;

            const esLaboral = esDiaLaboral(fechaCompleta);
            const debeIncluir = CONSIDERAR_DIAS_NO_ESCOLARES || esLaboral;

            if (debeIncluir) {
              if (!registrosCombinados[dia]) {
                registrosCombinados[dia] = {};
              }
              registrosCombinados[dia].salida = registro;
            }
          }
        );
      }

      return Object.keys(registrosCombinados).length > 0
        ? registrosCombinados
        : null;
    } catch (error) {
      console.error("Error al obtener asistencias combinadas:", error);
      return null;
    }
  };

  // Función para procesar datos
  const procesarDatos = async (
    rol: RolesSistema,
    id_o_dni: string | number,
    mes: number
  ) => {
    try {
      const registrosCombinados = await obtenerAsistenciasCombinadas(
        rol,
        id_o_dni,
        mes
      );

      const año = new Date().getFullYear();
      const todasLasFechas = obtenerFechasDelMes(mes, año);
      const fechasFiltradas = todasLasFechas.filter((fecha) =>
        esFechaValida(fecha)
      );

      const registrosResultado: RegistroDia[] = fechasFiltradas.map((fecha) => {
        const fechaObj = new Date(fecha + "T00:00:00");
        const dia = fechaObj.getDate().toString();
        const eventoInfo = esEvento(fecha);
        const esLaboral = esDiaLaboral(fecha);

        // Si es evento, retornar registro especial
        if (eventoInfo.esEvento) {
          return {
            fecha,
            entradaProgramada: "N/A",
            entradaReal: "Evento",
            diferenciaEntrada: "N/A",
            estadoEntrada: EstadosAsistenciaPersonal.Evento,
            salidaProgramada: "N/A",
            salidaReal: "Evento",
            diferenciaSalida: "N/A",
            estadoSalida: EstadosAsistenciaPersonal.Evento,
            esEvento: true,
            nombreEvento: eventoInfo.nombreEvento,
            esDiaNoEscolar: !esLaboral,
          };
        }

        // Si no hay registros combinados
        if (!registrosCombinados || !registrosCombinados[dia]) {
          return {
            fecha,
            entradaProgramada: "N/A",
            entradaReal: "No se tomó asistencia",
            diferenciaEntrada: "N/A",
            estadoEntrada: EstadosAsistenciaPersonal.Sin_Registro,
            salidaProgramada: "N/A",
            salidaReal: "No se tomó asistencia",
            diferenciaSalida: "N/A",
            estadoSalida: EstadosAsistenciaPersonal.Sin_Registro,
            esEvento: false,
            esDiaNoEscolar: !esLaboral,
          };
        }

        const registroDia = registrosCombinados[dia];

        // Procesar información de entrada
        let entradaProgramada = "N/A";
        let entradaReal = "No registrado";
        let diferenciaEntrada = "N/A";
        let estadoEntrada = EstadosAsistenciaPersonal.No_Registrado;

        if (registroDia.entrada) {
          if (registroDia.entrada === null) {
            entradaReal = "Inactivo";
            estadoEntrada = EstadosAsistenciaPersonal.Inactivo;
          } else if (
            (registroDia.entrada.timestamp === null ||
              registroDia.entrada.timestamp === 0) &&
            (registroDia.entrada.desfaseSegundos === null ||
              registroDia.entrada.desfaseSegundos === 0)
          ) {
            entradaReal = "Falta";
            estadoEntrada = EstadosAsistenciaPersonal.Falta;
          } else if (registroDia.entrada.timestamp > 0) {
            estadoEntrada = registroDia.entrada.estado;
            entradaProgramada = calcularHoraProgramada(
              registroDia.entrada.timestamp,
              registroDia.entrada.desfaseSegundos
            );
            entradaReal = formatearHora(registroDia.entrada.timestamp);
            const desfaseMinutos = segundosAMinutos(
              registroDia.entrada.desfaseSegundos
            );
            diferenciaEntrada = `${
              desfaseMinutos >= 0 ? "+" : ""
            }${desfaseMinutos} min`;
          } else {
            estadoEntrada = registroDia.entrada.estado;
            entradaReal = mapearEstadoParaUI(estadoEntrada);
          }
        }

        // Procesar información de salida
        let salidaProgramada = "N/A";
        let salidaReal = "No registrado";
        let diferenciaSalida = "N/A";
        let estadoSalida = EstadosAsistenciaPersonal.No_Registrado;

        if (registroDia.salida) {
          if (registroDia.salida === null) {
            salidaReal = "Inactivo";
            estadoSalida = EstadosAsistenciaPersonal.Inactivo;
          } else if (
            (registroDia.salida.timestamp === null ||
              registroDia.salida.timestamp === 0) &&
            (registroDia.salida.desfaseSegundos === null ||
              registroDia.salida.desfaseSegundos === 0)
          ) {
            salidaReal = "Falta";
            estadoSalida = EstadosAsistenciaPersonal.Falta;
          } else if (registroDia.salida.timestamp > 0) {
            estadoSalida = registroDia.salida.estado;
            salidaProgramada = calcularHoraProgramada(
              registroDia.salida.timestamp,
              registroDia.salida.desfaseSegundos
            );
            salidaReal = formatearHora(registroDia.salida.timestamp);
            const desfaseMinutos = segundosAMinutos(
              registroDia.salida.desfaseSegundos
            );
            diferenciaSalida = `${
              desfaseMinutos >= 0 ? "+" : ""
            }${desfaseMinutos} min`;
          } else {
            estadoSalida = registroDia.salida.estado;
            salidaReal = mapearEstadoParaUI(estadoSalida);
          }
        }

        return {
          fecha,
          entradaProgramada,
          entradaReal,
          diferenciaEntrada,
          estadoEntrada,
          salidaProgramada,
          salidaReal,
          diferenciaSalida,
          estadoSalida,
          esEvento: false,
          esDiaNoEscolar: !esLaboral,
        };
      });

      setRegistros(registrosResultado);
    } catch (error) {
      console.error("Error al procesar datos:", error);
      setError({
        success: false,
        message: "Error al procesar los datos de asistencia",
      });
    }
  };

  // Función para obtener eventos
  const obtenerEventos = async (mes: number) => {
    try {
      const eventosIDB = new EventosIDB("API01", setLoadingEventos);
      const eventosDelMes = await eventosIDB.getEventosPorMes(mes);
      setEventos(eventosDelMes);
    } catch (error) {
      console.error("Error obteniendo eventos:", error);
    }
  };

  // ✅ FUNCIÓN DE BÚSQUEDA - Solo se ejecuta al hacer clic en botón
  const buscarAsistencias = async () => {
    if (!selectedRol || !selectedMes || !id_o_DNI) {
      setError({
        success: false,
        message: "Por favor completa todos los campos correctamente",
      });
      return;
    }

    setError(null);
    setSuccessMessage("");
    setLoading(true);
    setHasSearched(true);

    try {
      await obtenerEventos(parseInt(selectedMes));

      const resultado =
        await asistenciaPersonalIDB.obtenerAsistenciaMensualConAPI({
          rol: selectedRol as RolesSistema,
          id_o_dni: id_o_DNI,
          mes: parseInt(selectedMes),
        });

      if (resultado.encontrado) {
        let datosParaMostrar: AsistenciaMensualPersonalLocal;

        if (resultado.entrada) {
          datosParaMostrar = resultado.entrada;
        } else if (resultado.salida) {
          datosParaMostrar = resultado.salida;
        } else {
          throw new Error("No se pudieron procesar los datos obtenidos");
        }

        setData(datosParaMostrar);
        setSuccessMessage(resultado.mensaje);

        // ✅ Procesar datos solo después de búsqueda exitosa
        await procesarDatos(selectedRol, id_o_DNI, parseInt(selectedMes));
      } else {
        setError({ success: false, message: resultado.mensaje });
        setData(null);
        setRegistros([]);
      }
    } catch (error) {
      console.error("Error al buscar asistencias:", error);
      setError({
        success: false,
        message: "Error al obtener los datos de asistencia",
      });
      setData(null);
      setRegistros([]);
    } finally {
      setLoading(false);
    }
  };

  // ✅ FUNCIONES DE LIMPIEZA cuando cambian los campos (SIN CONSULTAR)
  const handleRolChange = (rol: RolesSistema | undefined) => {
    setSelectedRol(rol);
    // Limpiar campos dependientes
    setId_o_DNI(undefined);
    setSelectedMes("");
    // Limpiar resultados previos
    if (hasSearched) {
      setData(null);
      setRegistros([]);
      setError(null);
      setSuccessMessage("");
    }
  };

  const handleUsuarioChange = (usuario: string | number | undefined) => {
    setId_o_DNI(usuario);
    // Limpiar mes seleccionado
    setSelectedMes("");
    // Limpiar resultados previos
    if (hasSearched) {
      setData(null);
      setRegistros([]);
      setError(null);
      setSuccessMessage("");
    }
  };

  const handleMesChange = (mes: string) => {
    setSelectedMes(mes);
    // Limpiar resultados previos
    if (hasSearched) {
      setData(null);
      setRegistros([]);
      setError(null);
      setSuccessMessage("");
    }
  };

  // ✅ Manejar Enter en los campos
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (
      e.key === "Enter" &&
      todosLosCamposCompletos &&
      !loading &&
      !loadingEventos
    ) {
      buscarAsistencias();
    }
  };

  // ✅ Estados de validación
  const rolEstaSeleccionado = !!selectedRol;
  const usuarioEstaSeleccionado = !!id_o_DNI;
  const mesEstaSeleccionado = !!selectedMes;
  const todosLosCamposCompletos =
    rolEstaSeleccionado && usuarioEstaSeleccionado && mesEstaSeleccionado;

  return (
    <div className="min-h-screen -bg-gray-50 p-4 lg:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
                Consulta de Asistencias de Personal
              </h1>
              <p className="text-gray-600 text-sm lg:text-base">
                Consulta los registros mensuales de entrada y salida del
                personal institucional
              </p>
            </div>
          </div>

          {/* Banner de desarrollo si está activado */}
          {CONSIDERAR_DIAS_NO_ESCOLARES && ENTORNO === Entorno.LOCAL && (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 mt-4">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-800">
                    Modo Desarrollo Activado
                  </p>
                  <p className="text-sm text-amber-700 mt-1">
                    Se están mostrando registros de todos los días (incluidos
                    sábados y domingos). Para producción, cambiar
                    CONSIDERAR_DIAS_NO_ESCOLARES a false.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Formulario de búsqueda */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="space-y-6">
            {/* Campos del formulario */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Selector de Rol */}
              <div className="lg:col-span-3">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tipo de Personal
                </label>
                <select
                  value={selectedRol || ""}
                  onChange={(e) =>
                    handleRolChange(e.target.value as RolesSistema)
                  }
                  onKeyPress={handleKeyPress}
                  disabled={loading || loadingEventos}
                  className={`w-full px-4 py-3 border-2 rounded-xl transition-all duration-200 text-sm
                             bg-white min-h-[3.5rem] shadow-sm ${
                               loading || loadingEventos
                                 ? "border-gray-200 bg-gray-50 cursor-not-allowed opacity-60"
                                 : "border-gray-200 hover:border-blue-300 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
                             }`}
                >
                  <option value="">Seleccionar tipo de personal</option>
                  {roles.map((rol) => (
                    <option key={rol.value} value={rol.value}>
                      {rol.icon} {rol.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Selector de Usuario */}
              <div className="lg:col-span-5">
                <SiasisUserSelector
                  ID_SELECTOR_USUARIO_GENERICO_HTML="SIASIS-SDU_Seccion-Consulta-Registros-Mensuales-Personal"
                  siasisAPI="API01"
                  rolUsuariosABuscar={selectedRol}
                  setId_o_DNI={handleUsuarioChange}
                  disabled={!rolEstaSeleccionado || loading || loadingEventos}
                />
              </div>

              {/* Selector de Mes */}
              <div className="lg:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Mes a Consultar
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <select
                    value={selectedMes}
                    onChange={(e) => handleMesChange(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={
                      !usuarioEstaSeleccionado || loading || loadingEventos
                    }
                    className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl transition-all duration-200 text-sm
                               bg-white min-h-[3.5rem] shadow-sm appearance-none ${
                                 !usuarioEstaSeleccionado ||
                                 loading ||
                                 loadingEventos
                                   ? "border-gray-200 bg-gray-50 cursor-not-allowed opacity-60"
                                   : "border-gray-200 hover:border-blue-300 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
                               }`}
                  >
                    <option value="">
                      {!usuarioEstaSeleccionado
                        ? "Selecciona usuario primero"
                        : "Seleccionar mes"}
                    </option>
                    {usuarioEstaSeleccionado &&
                      getMesesDisponibles().map(({ value, label }) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Botón de búsqueda */}
              <div className="lg:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  &nbsp;
                </label>
                <button
                  type="button"
                  onClick={buscarAsistencias}
                  disabled={
                    !todosLosCamposCompletos || loading || loadingEventos
                  }
                  className={`w-full px-6 py-3 rounded-xl font-semibold transition-all duration-200 
                             flex items-center justify-center text-sm min-h-[3.5rem] shadow-sm ${
                               !todosLosCamposCompletos ||
                               loading ||
                               loadingEventos
                                 ? "bg-gray-100 text-gray-400 cursor-not-allowed border-2 border-gray-200"
                                 : "bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 border-2 border-blue-500"
                             }`}
                >
                  {loading || loadingEventos ? (
                    <>
                      <Loader2 className="animate-spin w-5 h-5 mr-2" />
                      Consultando...
                    </>
                  ) : (
                    <>
                      <Search className="w-5 h-5 mr-2" />
                      Buscar
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Indicadores de estado */}
            {(loading || loadingEventos) && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-center">
                  <Loader2 className="animate-spin h-5 w-5 text-blue-500 mr-3" />
                  <div>
                    <p className="text-blue-700 font-semibold">
                      Consultando registros de asistencia...
                    </p>
                    <p className="text-blue-600 text-sm">
                      Esto puede tomar unos segundos
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Mensaje de error */}
            {error && (
              <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-center">
                  <AlertCircle className="w-5 h-5 text-red-500 mr-3" />
                  <p className="text-red-700 font-medium">{error.message}</p>
                </div>
              </div>
            )}

            {/* Mensaje de éxito */}
            {successMessage && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
                <div className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                  <p className="text-green-700 font-medium">{successMessage}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Información del usuario */}
        {data && !loading && !loadingEventos && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center">
                <Users className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-1">
                  Registros de{" "}
                  {roles.find((r) => r.value === selectedRol)?.label}
                </h3>
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                  <span className="flex items-center">
                    <span className="font-semibold">DNI:</span>
                    <span className="ml-1">{data.ID_o_DNI_Personal}</span>
                  </span>
                  <span className="flex items-center">
                    <span className="font-semibold">Mes:</span>
                    <span className="ml-1">
                      {mesesTextos[data.mes as Meses]}
                    </span>
                  </span>
                  <span className="flex items-center">
                    <span className="font-semibold">Total registros:</span>
                    <span className="ml-1">{registros.length}</span>
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {CONSIDERAR_DIAS_NO_ESCOLARES && ENTORNO === Entorno.LOCAL
                    ? "Incluye todos los días hasta la fecha actual"
                    : "Solo días laborables hasta la fecha actual"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tabla de registros */}
        {registros.length > 0 && !loading && !loadingEventos && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-6">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center space-x-3">
                <FileText className="w-6 h-6 text-gray-600" />
                <h3 className="text-lg font-bold text-gray-900">
                  Detalle de Asistencias
                </h3>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="px-4 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Entrada Programada
                    </th>
                    <th className="px-4 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Entrada Real
                    </th>
                    <th className="px-4 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Diferencia
                    </th>
                    <th className="px-4 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Estado Entrada
                    </th>
                    <th className="px-4 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Salida Programada
                    </th>
                    <th className="px-4 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Salida Real
                    </th>
                    <th className="px-4 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Diferencia
                    </th>
                    <th className="px-4 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Estado Salida
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {registros.map((registro) => (
                    <tr
                      key={registro.fecha}
                      className={`transition-colors duration-150 hover:bg-gray-50 ${
                        registro.esDiaNoEscolar && !registro.esEvento
                          ? "bg-blue-25"
                          : ""
                      }`}
                    >
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900">
                            {new Date(
                              registro.fecha + "T00:00:00"
                            ).toLocaleDateString("es-ES", {
                              weekday: "short",
                              day: "2-digit",
                              month: "2-digit",
                            })}
                          </span>
                          {registro.esEvento && (
                            <span className="text-xs text-purple-600 font-medium mt-1">
                              🎉 {registro.nombreEvento}
                            </span>
                          )}
                          {registro.esDiaNoEscolar && !registro.esEvento && (
                            <span className="text-xs text-blue-600 font-medium mt-1">
                              📅 Fin de semana
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center text-sm text-gray-700">
                        {registro.entradaProgramada}
                      </td>
                      <td className="px-4 py-4 text-center text-sm text-gray-700">
                        {registro.entradaReal}
                      </td>
                      <td className="px-4 py-4 text-center text-sm text-gray-700">
                        {registro.diferenciaEntrada}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span
                          className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
                            EstadosAsistenciaPersonalStyles[
                              registro.estadoEntrada
                            ]
                          }`}
                        >
                          {mapearEstadoParaUI(registro.estadoEntrada)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center text-sm text-gray-700">
                        {registro.salidaProgramada}
                      </td>
                      <td className="px-4 py-4 text-center text-sm text-gray-700">
                        {registro.salidaReal}
                      </td>
                      <td className="px-4 py-4 text-center text-sm text-gray-700">
                        {registro.diferenciaSalida}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span
                          className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
                            EstadosAsistenciaPersonalStyles[
                              registro.estadoSalida
                            ]
                          }`}
                        >
                          {mapearEstadoParaUI(registro.estadoSalida)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Leyenda explicativa de estados */}
        {registros.length > 0 && !loading && !loadingEventos && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center space-x-3 mb-6">
              <Info className="w-6 h-6 text-blue-500" />
              <h4 className="text-lg font-bold text-gray-900">
                Leyenda de Estados de Asistencia
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Estados de Entrada */}
              <div className="space-y-4">
                <h5 className="text-sm font-semibold text-gray-700 bg-gray-100 px-3 py-2 rounded-lg">
                  Estados de Entrada
                </h5>
                <div className="space-y-3">
                  {[
                    {
                      estado: EstadosAsistenciaPersonal.En_Tiempo,
                      descripcion: "Llegó dentro del horario establecido",
                    },
                    {
                      estado: EstadosAsistenciaPersonal.Temprano,
                      descripcion: "Llegó antes del horario programado",
                    },
                    {
                      estado: EstadosAsistenciaPersonal.Tarde,
                      descripcion: "Llegó después del horario establecido",
                    },
                  ].map(({ estado, descripcion }) => (
                    <div key={estado} className="flex items-start space-x-3">
                      <span
                        className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${EstadosAsistenciaPersonalStyles[estado]}`}
                      >
                        {mapearEstadoParaUI(estado)}
                      </span>
                      <p className="text-sm text-gray-600">{descripcion}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Estados de Salida */}
              <div className="space-y-4">
                <h5 className=" text-sm font-semibold text-gray-700 bg-gray-100 px-3 py-2 rounded-lg">
                  Estados de Salida
                </h5>
                <div className="space-y-3">
                  {[
                    {
                      estado: EstadosAsistenciaPersonal.Cumplido,
                      descripcion: "Completó su horario laboral correctamente",
                    },
                    {
                      estado: EstadosAsistenciaPersonal.Salida_Anticipada,
                      descripcion: "Se retiró antes del horario establecido",
                    },
                  ].map(({ estado, descripcion }) => (
                    <div key={estado} className="flex items-start space-x-3">
                      <span
                        className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${EstadosAsistenciaPersonalStyles[estado]}`}
                      >
                        {mapearEstadoParaUI(estado)}
                      </span>
                      <p className="text-sm text-gray-600">{descripcion}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Estados Especiales */}
              <div className="space-y-4">
                <h5 className="text-sm font-semibold text-gray-700 bg-gray-100 px-3 py-2 rounded-lg">
                  Estados Especiales
                </h5>
                <div className="space-y-3">
                  {[
                    {
                      estado: EstadosAsistenciaPersonal.Falta,
                      descripcion: "No asistió al trabajo ese día",
                    },
                    {
                      estado: EstadosAsistenciaPersonal.No_Registrado,
                      descripcion: "No marcó entrada/salida en el sistema",
                    },
                    {
                      estado: EstadosAsistenciaPersonal.Sin_Registro,
                      descripcion: "No se tomó asistencia ese día",
                    },
                    {
                      estado: EstadosAsistenciaPersonal.Inactivo,
                      descripcion: "Usuario inactivo en el sistema",
                    },
                    {
                      estado: EstadosAsistenciaPersonal.Evento,
                      descripcion: "Día feriado o evento especial",
                    },
                  ].map(({ estado, descripcion }) => (
                    <div key={estado} className="flex items-start space-x-3">
                      <span
                        className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${EstadosAsistenciaPersonalStyles[estado]}`}
                      >
                        {mapearEstadoParaUI(estado)}
                      </span>
                      <p className="text-sm text-gray-600">{descripcion}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Información importante */}
            <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl">
              <div className="flex items-start space-x-3">
                <Clock className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h5 className="text-blue-800 font-semibold mb-2">
                    Información del Sistema
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-blue-700">
                    <div className="flex items-start space-x-2">
                      <span className="text-blue-600 font-bold">📊</span>
                      <span>
                        Los estados se calculan automáticamente según la
                        diferencia entre horarios programados y reales
                      </span>
                    </div>
                    <div className="flex items-start space-x-2">
                      <span className="text-green-600 font-bold">⏰</span>
                      <span>
                        Los registros se sincronizan en tiempo real con el
                        servidor
                      </span>
                    </div>
                    <div className="flex items-start space-x-2">
                      <span className="text-purple-600 font-bold">📅</span>
                      <span>
                        Se muestran solo días laborables hasta la fecha actual
                      </span>
                    </div>
                    <div className="flex items-start space-x-2">
                      <span className="text-orange-600 font-bold">🎯</span>
                      <span>
                        Los datos incluyen entrada, salida y diferencias
                        horarias
                      </span>
                    </div>
                    {CONSIDERAR_DIAS_NO_ESCOLARES &&
                      ENTORNO === Entorno.LOCAL && (
                        <div className="md:col-span-2 flex items-start space-x-2">
                          <span className="text-amber-600 font-bold">⚠️</span>
                          <span>
                            <strong>Modo Desarrollo:</strong> Los registros con
                            fondo azul corresponden a fines de semana
                          </span>
                        </div>
                      )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RegistrosAsistenciaDePersonal;
