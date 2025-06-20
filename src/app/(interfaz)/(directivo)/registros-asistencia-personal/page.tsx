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
import { useState, useEffect } from "react";
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
  AlertCircle,
  CheckCircle,
  Info,
  Clock,
  FileText,
} from "lucide-react";
import SiasisUserSelector from "@/components/inputs/SiasisUserSelector";
import { GenericUser } from "@/interfaces/shared/GenericUser";
import FotoPerfilClientSide from "@/components/utils/photos/FotoPerfilClientSide";

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
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<GenericUser>();
  const [loading, setLoading] = useState(false);
  const [loadingEventos, setLoadingEventos] = useState(false);
  const [data, setData] = useState<AsistenciaMensualPersonalLocal | null>(null);
  const [eventos, setEventos] = useState<IEventoLocal[]>([]);
  const [registros, setRegistros] = useState<RegistroDia[]>([]);
  const [error, setError] = useState<ErrorResponseAPIBase | null>(null);
  const [successMessage, setSuccessMessage] = useState("");

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

  // 🆕 NUEVO: useEffect para limpiar resultados cuando cambie el usuario seleccionado
  useEffect(() => {
    // Solo limpiar si había resultados previos y cambió el usuario
    if (data || registros.length > 0) {
      limpiarResultados();
    }
  }, [usuarioSeleccionado?.ID_O_DNI_Usuario]);

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

  // ✅ ROLES ACTUALIZADOS: Sin emojis y con Directivo agregado
  const roles = [
    {
      value: RolesSistema.Directivo,
      label: "Directivo",
    },
    {
      value: RolesSistema.ProfesorPrimaria,
      label: "Profesor de Primaria",
    },
    {
      value: RolesSistema.ProfesorSecundaria,
      label: "Profesor de Secundaria",
    },
    {
      value: RolesSistema.Auxiliar,
      label: "Auxiliar",
    },
    {
      value: RolesSistema.PersonalAdministrativo,
      label: "Personal Administrativo",
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
    if (
      !selectedRol ||
      !selectedMes ||
      !usuarioSeleccionado?.ID_O_DNI_Usuario
    ) {
      setError({
        success: false,
        message: "Por favor completa todos los campos correctamente",
      });
      return;
    }

    setError(null);
    setSuccessMessage("");
    setLoading(true);

    try {
      await obtenerEventos(parseInt(selectedMes));

      const resultado =
        await asistenciaPersonalIDB.obtenerAsistenciaMensualConAPI({
          rol: selectedRol as RolesSistema,
          id_o_dni: usuarioSeleccionado.ID_O_DNI_Usuario,
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
        await procesarDatos(
          selectedRol,
          usuarioSeleccionado.ID_O_DNI_Usuario,
          parseInt(selectedMes)
        );
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

  // ✅ FUNCIÓN AUXILIAR para limpiar resultados
  const limpiarResultados = () => {
    setData(null);
    setRegistros([]);
    setError(null);
    setSuccessMessage("");
  };

  // ✅ FUNCIONES DE LIMPIEZA cuando cambian los campos (SIN CONSULTAR)
  const handleRolChange = (rol: RolesSistema | undefined) => {
    setSelectedRol(rol);
    // Limpiar campos dependientes
    setUsuarioSeleccionado(undefined);
    setSelectedMes("");
    // Limpiar resultados inmediatamente
    limpiarResultados();
  };

  const handleMesChange = (mes: string) => {
    setSelectedMes(mes);
    // Limpiar resultados inmediatamente
    limpiarResultados();
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
  const usuarioEstaSeleccionado = !!usuarioSeleccionado?.ID_O_DNI_Usuario;
  const mesEstaSeleccionado = !!selectedMes;
  const todosLosCamposCompletos =
    rolEstaSeleccionado && usuarioEstaSeleccionado && mesEstaSeleccionado;

  return (
    <div className="min-h-full min-w-full -bg-gray-50 p-4 lg:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center space-x-3 mb-1">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl lg:text-2xl font-bold text-gray-900">
                Consulta de Asistencias de Personal
              </h1>
              <p className="text-gray-600 text-xs lg:text-sm">
                Consulta los registros mensuales de entrada y salida del
                personal institucional
              </p>
            </div>
          </div>

          {/* Banner de desarrollo si está activado */}
          {CONSIDERAR_DIAS_NO_ESCOLARES && ENTORNO === Entorno.LOCAL && (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-3 mt-3">
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-amber-800 text-sm">
                    Modo Desarrollo Activado
                  </p>
                  <p className="text-xs text-amber-700 mt-1">
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
          <div className="space-y-4">
            {/* ✅ CAMPOS DEL FORMULARIO - DISTRIBUCIÓN RESPONSIVE OPTIMIZADA */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 lg:gap-4">
              {/* Selector de Rol - 3 columnas en lg */}
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Tipo de Personal
                </label>
                <select
                  value={selectedRol || ""}
                  onChange={(e) =>
                    handleRolChange(e.target.value as RolesSistema)
                  }
                  onKeyPress={handleKeyPress}
                  disabled={loading || loadingEventos}
                  className={`w-full px-3 py-2.5 border-2 rounded-lg transition-all duration-200 text-sm
                             bg-white min-h-[3rem] shadow-sm ${
                               loading || loadingEventos
                                 ? "border-gray-200 bg-gray-50 cursor-not-allowed opacity-60"
                                 : "border-gray-200 hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                             }`}
                >
                  <option value="">Seleccionar tipo de personal</option>
                  {roles.map((rol) => (
                    <option key={rol.value} value={rol.value}>
                      {rol.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Selector de Usuario - 4 columnas en lg */}
              <div className="sm:col-span-2 lg:col-span-4">
                <SiasisUserSelector
                  usuarioSeleccionado={usuarioSeleccionado}
                  ID_SELECTOR_USUARIO_GENERICO_HTML="SIASIS-SDU_Seccion-Consulta-Registros-Mensuales-Personal"
                  siasisAPI="API01"
                  rolUsuariosABuscar={selectedRol}
                  setUsuarioSeleccionado={setUsuarioSeleccionado}
                  disabled={!rolEstaSeleccionado || loading || loadingEventos}
                />
              </div>

              {/* Selector de Mes - 3 columnas en lg */}
              <div className="sm:col-span-1 lg:col-span-3">
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Mes a Consultar
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 z-10" />
                  <select
                    value={selectedMes}
                    onChange={(e) => handleMesChange(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={
                      !usuarioEstaSeleccionado || loading || loadingEventos
                    }
                    className={`w-full pl-9 pr-3 py-2.5 border-2 rounded-lg transition-all duration-200 text-sm
                               bg-white min-h-[3rem] shadow-sm appearance-none ${
                                 !usuarioEstaSeleccionado ||
                                 loading ||
                                 loadingEventos
                                   ? "border-gray-200 bg-gray-50 cursor-not-allowed opacity-60"
                                   : "border-gray-200 hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
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

              {/* Botón de búsqueda - 2 columnas en lg */}
              <div className="sm:col-span-1 lg:col-span-2">
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  &nbsp;
                </label>
                <button
                  type="button"
                  onClick={buscarAsistencias}
                  disabled={
                    !todosLosCamposCompletos || loading || loadingEventos
                  }
                  className={`w-full px-4 py-2.5 rounded-lg font-semibold transition-all duration-200 
                             flex items-center justify-center text-sm min-h-[3rem] shadow-sm ${
                               !todosLosCamposCompletos ||
                               loading ||
                               loadingEventos
                                 ? "bg-gray-100 text-gray-400 cursor-not-allowed border-2 border-gray-200"
                                 : "bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 border-2 border-blue-500"
                             }`}
                >
                  {loading || loadingEventos ? (
                    <>
                      <Loader2 className="animate-spin w-4 h-4 mr-2 flex-shrink-0" />
                      <span className="truncate">Consultando...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2 flex-shrink-0" />
                      <span className="truncate">Buscar</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Indicadores de estado */}
            {(loading || loadingEventos) && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center">
                  <Loader2 className="animate-spin h-4 w-4 text-blue-500 mr-2 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-blue-700 font-semibold truncate text-sm">
                      Consultando registros de asistencia...
                    </p>
                    <p className="text-blue-600 text-xs truncate">
                      Esto puede tomar unos segundos
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Mensaje de error */}
            {error && (
              <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center">
                  <AlertCircle className="w-4 h-4 text-red-500 mr-2 flex-shrink-0" />
                  <p className="text-red-700 font-medium truncate min-w-0 flex-1 text-sm">
                    {error.message}
                  </p>
                </div>
              </div>
            )}

            {/* Mensaje de éxito */}
            {successMessage && ENTORNO !== Entorno.PRODUCCION && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                  <p className="text-green-700 font-medium truncate min-w-0 flex-1 text-sm">
                    {successMessage}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Información del usuario */}
        {data && !loading && !loadingEventos && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-4">
            <div className="flex items-center space-x-6">
              <div className="flex-shrink-0">
                {usuarioSeleccionado?.Google_Drive_Foto_ID ? (
                  <FotoPerfilClientSide
                    Google_Drive_Foto_ID={
                      usuarioSeleccionado.Google_Drive_Foto_ID
                    }
                    className="w-20 h-20 border-3 border-white rounded-full"
                  />
                ) : (
                  <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center text-white font-bold text-2xl border-3 border-white">
                    {usuarioSeleccionado?.Nombres?.charAt(0)}
                    {usuarioSeleccionado?.Apellidos?.charAt(0)}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="text-xl lg:text-2xl font-bold text-gray-900 truncate">
                    {usuarioSeleccionado?.Nombres}{" "}
                    {usuarioSeleccionado?.Apellidos}
                  </h3>
                  <span className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-semibold bg-blue-100 text-blue-800 flex-shrink-0 border border-blue-300">
                    {roles.find((r) => r.value === selectedRol)?.label}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-gray-700 flex-shrink-0">
                      DNI:
                    </span>
                    <span className="truncate font-medium text-gray-900">
                      {data.ID_o_DNI_Personal}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-gray-700 flex-shrink-0">
                      Mes:
                    </span>
                    <span className="truncate font-medium text-gray-900">
                      {mesesTextos[data.mes as Meses]}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-gray-700 flex-shrink-0">
                      Registros:
                    </span>
                    <span className="truncate font-medium text-gray-900">
                      {registros.length}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-600">
                  {CONSIDERAR_DIAS_NO_ESCOLARES && ENTORNO === Entorno.LOCAL
                    ? "Incluye todos los días hasta la fecha actual"
                    : "Solo días laborables hasta la fecha actual"}
                </p>
              </div>

              {/* 🆕 BOTÓN DE EXPORTAR MEJORADO - 15% más grande */}
              <div className="flex-shrink-0">
                <button
                  title="Exportar a Excel"
                  className="bg-white border border-gray-300 hover:border-green-400 hover:bg-green-50 text-gray-700 hover:text-green-700 px-5 py-3 rounded-lg font-medium text-base transition-all duration-200 flex items-center space-x-2.5 min-w-[140px] shadow-sm hover:shadow-md"
                >
                  <img
                    className="w-6 h-6"
                    src="/images/svg/Aplicaciones Relacionadas/ExcelLogo.svg"
                    alt="Logo de Excel"
                  />
                  <span>Exportar</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 🆕 TABLA DE REGISTROS CON SCROLL HORIZONTAL OPTIMIZADO */}
        {registros.length > 0 && !loading && !loadingEventos && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-4">
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-gray-600 flex-shrink-0" />
                <h3 className="text-base font-bold text-gray-900 truncate">
                  Detalle de Asistencias
                </h3>
              </div>
            </div>

            {/* 🆕 CONTENEDOR CON SCROLL HORIZONTAL SOLO PARA LA TABLA */}
            <div className="w-full overflow-hidden">
              <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                <div className="min-w-[1200px]">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-20">
                          Fecha
                        </th>
                        <th className="px-2 py-2 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-24">
                          Entrada Prog.
                        </th>
                        <th className="px-2 py-2 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-24">
                          Entrada Real
                        </th>
                        <th className="px-2 py-2 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-20">
                          Dif.
                        </th>
                        <th className="px-2 py-2 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-28">
                          Estado Entrada
                        </th>
                        <th className="px-2 py-2 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-24">
                          Salida Prog.
                        </th>
                        <th className="px-2 py-2 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-24">
                          Salida Real
                        </th>
                        <th className="px-2 py-2 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-20">
                          Dif.
                        </th>
                        <th className="px-2 py-2 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-28">
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
                          <td className="px-2 py-2 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="text-xs font-medium text-gray-900">
                                {new Date(
                                  registro.fecha + "T00:00:00"
                                ).toLocaleDateString("es-ES", {
                                  weekday: "short",
                                  day: "2-digit",
                                  month: "2-digit",
                                })}
                              </span>
                              {registro.esEvento && (
                                <span className="text-xs text-purple-600 font-medium mt-0.5 truncate">
                                  🎉 {registro.nombreEvento}
                                </span>
                              )}
                              {registro.esDiaNoEscolar &&
                                !registro.esEvento && (
                                  <span className="text-xs text-blue-600 font-medium mt-0.5">
                                    📅 Fin de semana
                                  </span>
                                )}
                            </div>
                          </td>
                          <td className="px-2 py-2 text-center text-xs text-gray-700">
                            <span className="block truncate">
                              {registro.entradaProgramada}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-center text-xs text-gray-700">
                            <span className="block truncate">
                              {registro.entradaReal}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-center text-xs text-gray-700">
                            <span className="block truncate">
                              {registro.diferenciaEntrada}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-center">
                            <span
                              className={`inline-flex px-1.5 py-0.5 rounded-full text-xs font-semibold 
                                          truncate max-w-full ${
                                            EstadosAsistenciaPersonalStyles[
                                              registro.estadoEntrada
                                            ]
                                          }`}
                            >
                              {mapearEstadoParaUI(registro.estadoEntrada)}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-center text-xs text-gray-700">
                            <span className="block truncate">
                              {registro.salidaProgramada}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-center text-xs text-gray-700">
                            <span className="block truncate">
                              {registro.salidaReal}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-center text-xs text-gray-700">
                            <span className="block truncate">
                              {registro.diferenciaSalida}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-center">
                            <span
                              className={`inline-flex px-1.5 py-0.5 rounded-full text-xs font-semibold 
                                          truncate max-w-full ${
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
            </div>
          </div>
        )}

        {/* Leyenda explicativa de estados */}
        {registros.length > 0 && !loading && !loadingEventos && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center space-x-2 mb-4">
              <Info className="w-5 h-5 text-blue-500 flex-shrink-0" />
              <h4 className="text-base font-bold text-gray-900 truncate">
                Leyenda de Estados de Asistencia
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Estados de Entrada */}
              <div className="space-y-2 min-w-0">
                <h5 className="text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded-md truncate">
                  Estados de Entrada
                </h5>
                <div className="space-y-2">
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
                    <div
                      key={estado}
                      className="flex items-start space-x-2 min-w-0"
                    >
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${EstadosAsistenciaPersonalStyles[estado]}`}
                      >
                        {mapearEstadoParaUI(estado)}
                      </span>
                      <p className="text-xs text-gray-600 truncate min-w-0 flex-1">
                        {descripcion}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Estados de Salida */}
              <div className="space-y-2 min-w-0">
                <h5 className="text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded-md truncate">
                  Estados de Salida
                </h5>
                <div className="space-y-2">
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
                    <div
                      key={estado}
                      className="flex items-start space-x-2 min-w-0"
                    >
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${EstadosAsistenciaPersonalStyles[estado]}`}
                      >
                        {mapearEstadoParaUI(estado)}
                      </span>
                      <p className="text-xs text-gray-600 truncate min-w-0 flex-1">
                        {descripcion}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Estados Especiales */}
              <div className="space-y-2 min-w-0">
                <h5 className="text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded-md truncate">
                  Estados Especiales
                </h5>
                <div className="space-y-2">
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
                    <div
                      key={estado}
                      className="flex items-start space-x-2 min-w-0"
                    >
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${EstadosAsistenciaPersonalStyles[estado]}`}
                      >
                        {mapearEstadoParaUI(estado)}
                      </span>
                      <p className="text-xs text-gray-600 truncate min-w-0 flex-1">
                        {descripcion}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Información importante */}
            <div className="mt-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <Clock className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <h5 className="text-blue-800 font-semibold mb-2 truncate text-sm">
                    Información del Sistema
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-blue-700">
                    <div className="flex items-start space-x-1 min-w-0">
                      <span className="text-blue-600 font-bold flex-shrink-0">
                        📊
                      </span>
                      <span className="truncate">
                        Los estados se calculan automáticamente según la
                        diferencia entre horarios programados y reales
                      </span>
                    </div>
                    <div className="flex items-start space-x-1 min-w-0">
                      <span className="text-green-600 font-bold flex-shrink-0">
                        ⏰
                      </span>
                      <span className="truncate">
                        Los registros se sincronizan en tiempo real con el
                        servidor
                      </span>
                    </div>
                    <div className="flex items-start space-x-1 min-w-0">
                      <span className="text-purple-600 font-bold flex-shrink-0">
                        📅
                      </span>
                      <span className="truncate">
                        Se muestran solo días laborables hasta la fecha actual
                      </span>
                    </div>
                    <div className="flex items-start space-x-1 min-w-0">
                      <span className="text-orange-600 font-bold flex-shrink-0">
                        🎯
                      </span>
                      <span className="truncate">
                        Los datos incluyen entrada, salida y diferencias
                        horarias
                      </span>
                    </div>
                    {CONSIDERAR_DIAS_NO_ESCOLARES &&
                      ENTORNO === Entorno.LOCAL && (
                        <div className="md:col-span-2 flex items-start space-x-1 min-w-0">
                          <span className="text-amber-600 font-bold flex-shrink-0">
                            ⚠️
                          </span>
                          <span className="truncate">
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
