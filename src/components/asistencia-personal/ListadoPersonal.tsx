import ItemTomaAsistencia, {
  PersonalParaTomarAsistencia,
} from "./ItemTomaAsistencia";
import { Speaker } from "../../lib/utils/voice/Speaker";
import {
  ModoRegistro,
  modoRegistroTextos,
} from "@/interfaces/shared/ModoRegistroPersonal";
import { HandlerDirectivoAsistenciaResponse } from "@/lib/utils/local/db/models/DatosAsistenciaHoy/handlers/HandlerDirectivoAsistenciaResponse";
import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";

import { AsistenciaDePersonalIDB } from "../../lib/utils/local/db/models/AsistenciaDePersonal/AsistenciaDePersonalIDB";
import { FechaHoraActualRealState } from "@/global/state/others/fechaHoraActualReal";
import {
  PersonalDelColegio,
  RolesSistema,
} from "@/interfaces/shared/RolesSistema";
import { Loader2 } from "lucide-react";
import { AsistenciaDiariaResultado } from "@/interfaces/shared/AsistenciaRequests";
import { ErrorResponseAPIBase } from "@/interfaces/shared/apis/types";
import { useSelector } from "react-redux";
import { RootState } from "@/global/store";
import { useSS01 } from "@/hooks/useSS01";
import { TomaAsistenciaPersonalSIU01Events } from "@/SS01/sockets/events/AsistenciaDePersonal/frontend/TomaAsistenciaPersonalSIU01Events";

import { SALAS_TOMA_ASISTENCIA_PERSONAL_IE20935_MAPPER } from "../../SS01/sockets/events/AsistenciaDePersonal/interfaces/SalasTomaAsistenciaDePersonal";
import { Genero } from "@/interfaces/shared/Genero";

// ========================================================================================
// CONFIGURACIÓN DE SOCKET Y TIMEOUT
// ========================================================================================

// 🕒 Tiempo máximo de espera para conexión de socket (4 segundos)
const SOCKET_CONNECTION_TIMEOUT = 4000;

// 🎨 Mensajes creativos para la espera de conexión
const MENSAJES_CONEXION_SOCKET = [
  "🔐 Estableciendo conexión segura...",
  "🌐 Sincronizando con el sistema...",
  "📡 Conectando con el servidor...",
  "⚡ Preparando el entorno...",
  "🛡️ Verificando credenciales...",
];

// Obtener texto según el rol
export const obtenerTextoRol = (rol: RolesSistema): string => {
  switch (rol) {
    case RolesSistema.Directivo:
      return "Directivos";
    case RolesSistema.ProfesorPrimaria:
      return "Profesores de Primaria";
    case RolesSistema.Auxiliar:
      return "Auxiliares";
    case RolesSistema.ProfesorSecundaria:
    case RolesSistema.Tutor:
      return "Profesores/Tutores de Secundaria";
    case RolesSistema.PersonalAdministrativo:
      return "Personal Administrativo";
    default:
      return "";
  }
};

export const ListaPersonal = ({
  rol,
  modoRegistro,
  handlerDatosAsistenciaHoyDirectivo,
  fechaHoraActual,
}: {
  rol: RolesSistema;
  modoRegistro: ModoRegistro;
  handlerDatosAsistenciaHoyDirectivo: HandlerDirectivoAsistenciaResponse;
  fechaHoraActual: FechaHoraActualRealState;
}) => {
  // ========================================================================================
  // ESTADOS PARA SOCKET Y TIMEOUT
  // ========================================================================================

  // 🆕 NUEVO: Estado para controlar la espera de conexión del socket
  const [esperandoConexionSocket, setEsperandoConexionSocket] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [mensajeConexion, setMensajeConexion] = useState(
    MENSAJES_CONEXION_SOCKET[
      Math.floor(Math.random() * MENSAJES_CONEXION_SOCKET.length)
    ]
  );

  // Ref para el timeout
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Enlace con el SS01
  const { isReady, globalSocket } = useSS01();

  // ========================================================================================
  // EFECTOS PARA MANEJO DE SOCKET CON TIMEOUT
  // ========================================================================================

  // 🚀 useEffect principal para manejar timeout de conexión de socket
  useEffect(() => {
    console.log("🔌 ListaPersonal: Iniciando espera de conexión de socket...", {
      isReady,
      timeout: SOCKET_CONNECTION_TIMEOUT,
      mensaje: mensajeConexion,
      rol,
      modoRegistro,
    });

    // Si ya está conectado desde el inicio, no esperar
    if (isReady) {
      console.log("✅ Socket ya estaba conectado, saltando espera");
      setEsperandoConexionSocket(false);
      return;
    }

    // Establecer timeout para la espera máxima
    timeoutRef.current = setTimeout(() => {
      console.log(
        `⏰ Timeout de ${SOCKET_CONNECTION_TIMEOUT}ms alcanzado, continuando sin socket`
      );
      setEsperandoConexionSocket(false);
    }, SOCKET_CONNECTION_TIMEOUT);

    // Cleanup function
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []); // Solo se ejecuta al montar el componente

  // 🎯 useEffect para detectar cuando el socket se conecta
  useEffect(() => {
    if (isReady && esperandoConexionSocket) {
      console.log("🎉 Socket conectado antes del timeout, continuando...");

      // Limpiar timeout ya que el socket se conectó
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      setEsperandoConexionSocket(false);
    }
  }, [isReady, esperandoConexionSocket]);

  // 🏠 useEffect para unirse a la sala cuando el socket esté listo y no estemos esperando
  useEffect(() => {
    if (!isReady || esperandoConexionSocket) {
      if (!isReady) {
        console.warn("⚠️ Conexión no está lista");
      }
      return;
    }

    console.log("🔗 ListaPersonal: Uniéndose a sala de toma de asistencia:", {
      rol,
      modoRegistro,
      sala: SALAS_TOMA_ASISTENCIA_PERSONAL_IE20935_MAPPER[
        rol as PersonalDelColegio
      ][modoRegistro],
    });

    // Crear y ejecutar emisor (estilo original)
    const emitter =
      new TomaAsistenciaPersonalSIU01Events.UNIRME_A_SALA_DE_TOMA_DE_ASISTENCIA_DE_PERSONAL_EMITTER(
        SALAS_TOMA_ASISTENCIA_PERSONAL_IE20935_MAPPER[
          rol as PersonalDelColegio
        ][modoRegistro]
      );
    const sent = emitter.execute();

    if (!sent) {
      console.error("❌ Error al enviar el evento de unión a sala");
    } else {
      console.log(
        "✅ Usuario unido exitosamente a la sala:",
        SALAS_TOMA_ASISTENCIA_PERSONAL_IE20935_MAPPER[
          rol as PersonalDelColegio
        ][modoRegistro]
      );
    }
  }, [rol, modoRegistro, isReady, esperandoConexionSocket]);

  // ========================================================================================
  // FUNCIONES DE SOCKET (solo se ejecutan si socket está disponible)
  // ========================================================================================

  const marcarAsistenciaEnElRestoDeSesionesPorSS01 = useCallback(
    async (
      id_o_dni: string | number,
      nombres: string,
      apellidos: string,
      genero: Genero
    ) => {
      if (!isReady || !globalSocket) {
        console.warn(
          "⚠️ Socket no disponible para marcar asistencia, saltando evento..."
        );
        return;
      }

      const asistenciaRecienRegistrada =
        await asistenciaDePersonalIDB.consultarAsistenciaDeHoyDePersonal(
          id_o_dni,
          modoRegistro,
          rol
        );

      // Crear y ejecutar emisor (estilo original)
      const emitter =
        new TomaAsistenciaPersonalSIU01Events.MARQUE_LA_ASISTENCIA_DE_ESTE_PERSONAL_EMITTER(
          {
            Mi_Socket_Id: globalSocket?.id,
            id_o_dni,
            genero,
            nombres,
            apellidos,
            Sala_Toma_Asistencia_de_Personal:
              SALAS_TOMA_ASISTENCIA_PERSONAL_IE20935_MAPPER[
                rol as PersonalDelColegio
              ][modoRegistro],
            modoRegistro,
            RegistroEntradaSalida: {
              desfaseSegundos: asistenciaRecienRegistrada.desfaseSegundos!,
              timestamp: asistenciaRecienRegistrada.timestamp!,
              estado: asistenciaRecienRegistrada.estado!,
            },
            rol,
          }
        );

      const sent = emitter.execute();

      if (!sent) {
        console.error("❌ Error al enviar el evento de marcado de asistencia");
      }
    },
    [rol, modoRegistro, isReady, globalSocket]
  );

  const eliminarAsistenciaEnElRestoDeSesionesPorSS01 = useCallback(
    async (
      id_o_dni: string | number,
      nombres: string,
      apellidos: string,
      genero: Genero
    ) => {
      if (!isReady || !globalSocket) {
        console.warn(
          "⚠️ Socket no disponible para eliminar asistencia, saltando evento..."
        );
        return;
      }

      // Crear y ejecutar emisor (estilo original)
      const emitter =
        new TomaAsistenciaPersonalSIU01Events.ELIMINE_LA_ASISTENCIA_DE_ESTE_PERSONAL_EMITTER(
          {
            Mi_Socket_Id: globalSocket.id,
            id_o_dni,
            genero,
            nombres,
            apellidos,
            Sala_Toma_Asistencia_de_Personal:
              SALAS_TOMA_ASISTENCIA_PERSONAL_IE20935_MAPPER[
                rol as PersonalDelColegio
              ][modoRegistro],
            modoRegistro,
            rol,
          }
        );

      const sent = emitter.execute();

      if (!sent) {
        console.error(
          "❌ Error al enviar el evento de eliminación de asistencia"
        );
      }
    },
    [rol, modoRegistro, isReady, globalSocket]
  );

  // ========================================================================================
  // ESTADOS PRINCIPALES DEL COMPONENTE
  // ========================================================================================

  const { toast } = useToast();
  const [procesando, setProcesando] = useState<string | null>(null);
  const [cargandoAsistencias, setCargandoAsistencias] = useState(true);
  const [eliminandoAsistencia, setEliminandoAsistencia] = useState<
    string | null
  >(null);

  // ✅ NUEVO: Obtener timestamp actual de Redux
  const fechaHoraRedux = useSelector(
    (state: RootState) => state.others.fechaHoraActualReal
  );
  const timestampActual = fechaHoraRedux.utilidades?.timestamp;

  // ✅ NUEVO: Estado para almacenar las asistencias registradas por DNI
  const [asistenciasRegistradas, setAsistenciasRegistradas] = useState<
    Map<string, AsistenciaDiariaResultado>
  >(new Map());

  // Estados para el sistema de manejo de errores
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ErrorResponseAPIBase | null>(null);

  // ✅ MODIFICADO: Crear instancia SIN el callback
  const asistenciaDePersonalIDB = new AsistenciaDePersonalIDB(
    "API01",
    setIsLoading,
    setError
  );

  // Obtenemos los datos del personal
  const personal = rol
    ? handlerDatosAsistenciaHoyDirectivo.obtenerPersonalPorRol(rol)
    : [];

  // ✅ MODIFICADO: Cargar las asistencias ya registradas (solo si no esperando socket)
  const ultimaConsultaRef = useRef<string>("");

  useEffect(() => {
    // 🚀 NUEVO: No cargar asistencias si estamos esperando la conexión del socket
    if (esperandoConexionSocket) {
      console.log(
        "⏳ Esperando conexión de socket, postergando carga de asistencias..."
      );
      return;
    }

    const claveConsulta = `${rol}-${modoRegistro}`;

    // ✅ Evitar consulta si es la misma que la anterior
    if (ultimaConsultaRef.current === claveConsulta) {
      console.log("🚫 Consulta duplicada evitada:", claveConsulta);
      return;
    }

    ultimaConsultaRef.current = claveConsulta;
    const cargarAsistenciasRegistradas = async () => {
      try {
        setCargandoAsistencias(true);

        console.log(`🔍 Cargando asistencias para ${rol} - ${modoRegistro}`);

        // ✅ USAR ORQUESTADOR en lugar de fetch directo
        const resultado =
          await asistenciaDePersonalIDB.consultarYSincronizarAsistenciasRedis(
            rol,
            modoRegistro
          );

        if (resultado.exitoso && resultado.datos) {
          // Crear mapa de asistencias por DNI
          const mapaAsistencias = new Map<string, AsistenciaDiariaResultado>();

          const resultados = Array.isArray(resultado.datos.Resultados)
            ? resultado.datos.Resultados
            : [resultado.datos.Resultados];

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          resultados.forEach((resultado: any) => {
            if (resultado && resultado.ID_o_DNI) {
              mapaAsistencias.set(resultado.ID_o_DNI, resultado);
            }
          });

          console.log("🗺️ Mapa final de asistencias:", mapaAsistencias);
          setAsistenciasRegistradas(mapaAsistencias);
        } else {
          console.error("❌ Error al cargar asistencias:", resultado.mensaje);
          toast({
            title: "Error",
            description: "No se pudieron cargar las asistencias registradas",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("❌ Error al consultar asistencias registradas:", error);
        toast({
          title: "Error",
          description: "No se pudieron cargar las asistencias registradas",
          variant: "destructive",
        });
      } finally {
        setCargandoAsistencias(false);
      }
    };

    if (rol && modoRegistro) {
      cargarAsistenciasRegistradas();
    }
  }, [rol, modoRegistro, esperandoConexionSocket]); // 🚀 NUEVA DEPENDENCIA

  // ========================================================================================
  // FUNCIONES PRINCIPALES
  // ========================================================================================

  const handleMarcarAsistencia = async (
    personal: PersonalParaTomarAsistencia
  ) => {
    if (procesando !== null) return;

    setProcesando(personal.ID_o_DNI);

    try {
      // Obtener la hora esperada
      const horaEsperadaISO =
        handlerDatosAsistenciaHoyDirectivo.obtenerHorarioPersonalISO(
          rol!,
          personal.ID_o_DNI,
          modoRegistro
        );

      // ✅ USAR ORQUESTADOR en lugar de fetch directo
      await asistenciaDePersonalIDB.marcarAsistencia(
        {
          datos: {
            ModoRegistro: modoRegistro,
            DNI: personal.ID_o_DNI,
            Rol: rol!,
            Dia: fechaHoraActual.utilidades!.diaMes,
          },
        },
        horaEsperadaISO // ✅ PASAR hora esperada
      );

      marcarAsistenciaEnElRestoDeSesionesPorSS01(
        personal.ID_o_DNI,
        personal.Nombres,
        personal.Apellidos,
        personal.Genero
      );

      actualizarInterfazPorNuevaMarcacion(
        personal.Nombres,
        personal.Apellidos,
        personal.ID_o_DNI
      );

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      // El orquestador ya manejó el error, solo dar feedback por voz
      const speaker = Speaker.getInstance();
      speaker.start(
        `Error al registrar ${modoRegistroTextos[modoRegistro].toLowerCase()}`
      );
    } finally {
      setProcesando(null);
    }
  };

  const actualizarInterfazPorNuevaMarcacion = (
    Nombres: string,
    Apellidos: string,
    ID_o_DNI: string
  ) => {
    // Feedback por voz
    const speaker = Speaker.getInstance();
    speaker.start(
      `${modoRegistroTextos[modoRegistro]} registrada para ${Nombres.split(
        " "
      ).shift()} ${Apellidos.split(" ").shift()}`
    );

    // ✅ ACTUALIZAR estado local (simulando respuesta exitosa)
    const timestampActual = fechaHoraRedux.utilidades?.timestamp || Date.now();
    const nuevoRegistro: AsistenciaDiariaResultado = {
      ID_o_DNI,
      AsistenciaMarcada: true,
      Detalles: {
        Timestamp: timestampActual,
        DesfaseSegundos: 0, // El servidor calculará el valor real
      },
    };

    setAsistenciasRegistradas((prev) => {
      const nuevo = new Map(prev);
      nuevo.set(ID_o_DNI, nuevoRegistro);
      return nuevo;
    });
  };

  // ========================================================================================
  // HANDLERS DE SOCKET (solo se configuran si socket está disponible)
  // ========================================================================================

  // Refs para mantener referencia a los handlers
  const seAcabaDeMarcarLaAsistenciaDeEstePersonalHandlerRef =
    useRef<InstanceType<
      typeof TomaAsistenciaPersonalSIU01Events.SE_ACABA_DE_MARCAR_LA_ASISTENCIA_DE_ESTE_PERSONAL_HANDLER
    > | null>(null);

  const seAcabaDeEliminarLaAsistenciaDeEstePersonalHandlerRef =
    useRef<InstanceType<
      typeof TomaAsistenciaPersonalSIU01Events.SE_ACABA_DE_ELIMINAR_LA_ASISTENCIA_DE_ESTE_PERSONAL_HANDLER
    > | null>(null);

  // Configurar handlers cuando el socket esté REALMENTE listo y no estemos esperando
  useEffect(() => {
    if (!isReady || !globalSocket || esperandoConexionSocket) {
      return;
    }

    console.log("🎧 Configurando handlers de socket...");

    //HANDLERS

    // Configurar handler para respuesta de saludo (estilo original)
    seAcabaDeMarcarLaAsistenciaDeEstePersonalHandlerRef.current =
      new TomaAsistenciaPersonalSIU01Events.SE_ACABA_DE_MARCAR_LA_ASISTENCIA_DE_ESTE_PERSONAL_HANDLER(
        async ({
          id_o_dni,
          nombres,
          apellidos,
          modoRegistro,
          RegistroEntradaSalida,
          rol,
          Mi_Socket_Id,
        }) => {
          if (globalSocket.id == Mi_Socket_Id) return;

          await asistenciaDePersonalIDB.marcarAsistenciaEnLocal(
            id_o_dni,
            rol,
            modoRegistro,
            RegistroEntradaSalida
          );

          actualizarInterfazPorNuevaMarcacion(
            nombres,
            apellidos,
            String(id_o_dni)
          );
        }
      );

    // Registrar el handler (estilo original)
    seAcabaDeMarcarLaAsistenciaDeEstePersonalHandlerRef.current.hand();

    seAcabaDeEliminarLaAsistenciaDeEstePersonalHandlerRef.current =
      new TomaAsistenciaPersonalSIU01Events.SE_ACABA_DE_ELIMINAR_LA_ASISTENCIA_DE_ESTE_PERSONAL_HANDLER(
        async ({
          Mi_Socket_Id,
          id_o_dni,
          nombres,
          apellidos,
          modoRegistro,
          genero,
          rol,
        }) => {
          if (globalSocket.id == Mi_Socket_Id) return;

          await asistenciaDePersonalIDB.eliminarAsistenciaEnLocal(
            id_o_dni,
            rol,
            modoRegistro
          );

          actualizarInterfazPorEliminacionDeAsistencia({
            ID_o_DNI: String(id_o_dni),
            Nombres: nombres,
            Apellidos: apellidos,
            Genero: genero,
          });
        }
      );

    seAcabaDeEliminarLaAsistenciaDeEstePersonalHandlerRef.current.hand();

    // Cleanup al desmontar o cambiar de socket (estilo original)
    return () => {
      if (seAcabaDeMarcarLaAsistenciaDeEstePersonalHandlerRef.current) {
        seAcabaDeMarcarLaAsistenciaDeEstePersonalHandlerRef.current.unhand();
        seAcabaDeMarcarLaAsistenciaDeEstePersonalHandlerRef.current = null;
      }
      if (seAcabaDeEliminarLaAsistenciaDeEstePersonalHandlerRef.current) {
        seAcabaDeEliminarLaAsistenciaDeEstePersonalHandlerRef.current.unhand();
        seAcabaDeEliminarLaAsistenciaDeEstePersonalHandlerRef.current = null;
      }
    };
  }, [isReady, esperandoConexionSocket]); // 🚀 NUEVA DEPENDENCIA

  const actualizarInterfazPorEliminacionDeAsistencia = (
    personal: Omit<PersonalParaTomarAsistencia, "GoogleDriveFotoId">
  ) => {
    // ✅ Actualizar el mapa de asistencias registradas (eliminar la entrada)
    setAsistenciasRegistradas((prev) => {
      const nuevo = new Map(prev);
      nuevo.delete(personal.ID_o_DNI);
      return nuevo;
    });

    // 🎯 NUEVO: Feedback por voz para eliminación exitosa
    const speaker = Speaker.getInstance();
    speaker.start(
      `${
        modoRegistroTextos[modoRegistro]
      } eliminada para ${personal.Nombres.split(
        " "
      ).shift()} ${personal.Apellidos.split(" ").shift()}`
    );

    console.log("✅ Eliminación exitosa, estado actualizado");
  };

  // Manejar eliminación de asistencia CON FEEDBACK DE VOZ
  const handleEliminarAsistencia = async (
    personal: PersonalParaTomarAsistencia
  ) => {
    if (eliminandoAsistencia !== null) return;

    try {
      setEliminandoAsistencia(personal.ID_o_DNI);

      console.log(
        `🗑️ Iniciando eliminación de asistencia para: ${personal.ID_o_DNI}`
      );

      // Eliminar usando el modelo de IndexedDB
      const resultado = await asistenciaDePersonalIDB.eliminarAsistencia({
        id_o_dni: personal.ID_o_DNI,
        rol: rol,
        modoRegistro: modoRegistro,
      });

      if (resultado.exitoso) {
        actualizarInterfazPorEliminacionDeAsistencia(personal);

        eliminarAsistenciaEnElRestoDeSesionesPorSS01(
          personal.ID_o_DNI,
          personal.Nombres,
          personal.Apellidos,
          personal.Genero
        );

        toast({
          title: "Asistencia eliminada",
          description: resultado.mensaje,
          variant: "default",
        });
      } else {
        // 🎯 NUEVO: Feedback por voz para error en eliminación
        const speaker = Speaker.getInstance();
        speaker.start(
          `Error al eliminar ${modoRegistroTextos[
            modoRegistro
          ].toLowerCase()} de ${personal.Nombres.split(" ").shift()}`
        );

        toast({
          title: "Error",
          description: resultado.mensaje,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error al eliminar asistencia:", error);

      // 🎯 NUEVO: Feedback por voz para error general
      const speaker = Speaker.getInstance();
      speaker.start(
        `Error del sistema al eliminar ${modoRegistroTextos[
          modoRegistro
        ].toLowerCase()}`
      );

      const errorMessage =
        error instanceof Error
          ? error.message
          : "Error desconocido al eliminar asistencia";

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setEliminandoAsistencia(null);
    }
  };

  const textoRol = obtenerTextoRol(rol);

  // ========================================================================================
  // RENDERS CONDICIONALES
  // ========================================================================================

  // 🚀 NUEVO: Mostrar estado de espera de conexión de socket
  if (esperandoConexionSocket) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center">
        <div className="text-center max-w-md">
          <div className="mb-4">
            <Loader2 className="inline-block w-8 h-8 text-blue-500 animate-spin" />
          </div>
          <p className="text-lg text-gray-700 mb-2">{mensajeConexion}</p>
          <p className="text-sm text-gray-500">
            Esto solo tomará unos segundos...
          </p>
        </div>
      </div>
    );
  }

  // Mostrar error si existe
  if (error) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center">
        <div className="text-center max-w-md">
          <p className="text-xl text-red-600 mb-2">Error del Sistema</p>
          <p className="text-sm text-gray-600 mb-4">{error.message}</p>
          <button
            onClick={() => setError(null)}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // Mensaje para cuando no hay personal
  if (personal.length === 0) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center">
        <p className="text-xl text-gray-600">
          No hay personal disponible para este rol
        </p>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col pb-3 px-4 sm-only:pb-4 sm-only:px-3 md-only:pb-4 md-only:px-3 lg-only:pb-4 lg-only:px-4 xl-only:pb-4 xl-only:px-4 bg-gradient-to-b from-white to-gray-50 overflow-auto">
      {/* Encabezados fijos en la parte superior - CON MENSAJE INFORMATIVO */}
      <div className="sticky top-0 bg-[#ffffffcc] [backdrop-filter:blur(10px)] py-2 sm-only:py-3 md-only:py-3 lg-only:py-3 xl-only:py-4 z-11 mb-2">
        <h2 className="text-base sm-only:text-lg md-only:text-lg lg-only:text-lg xl-only:text-xl font-bold text-blue-800 text-center leading-tight">
          {modoRegistroTextos[modoRegistro]} | {textoRol}
        </h2>

        <h3 className="text-lg sm-only:text-xl md-only:text-xl lg-only:text-2xl xl-only:text-2xl font-bold text-green-600 text-center leading-tight">
          Ahora haz clic en tu nombre
        </h3>

        {/* 🆕 MENSAJE INFORMATIVO SOBRE TIEMPO LÍMITE */}
        <div className="text-center mt-1 mb-2">
          <p className="text-xs sm-only:text-sm text-orange-600 font-medium">
            💡 Tienes 5 minutos para cancelar una asistencia después de
            registrarla
          </p>
        </div>

        {/* 🚀 NUEVO: Indicador de estado de socket */}
        {!isReady && (
          <div className="text-center mt-1 mb-2">
            <p className="text-xs sm-only:text-sm text-amber-600 font-medium">
              ⚠️ Funcionando sin conexión de tiempo real
            </p>
          </div>
        )}

        {(cargandoAsistencias || isLoading) && (
          <p className="text-center text-blue-500 mt-1">
            <Loader2 className="inline-block w-4 h-4 mr-1 animate-spin" />
            {cargandoAsistencias
              ? "Cargando asistencias registradas..."
              : "Procesando asistencia..."}
          </p>
        )}
      </div>

      {/* Contenedor centrado para las tarjetas */}
      <div className="flex-1 flex justify-center">
        <div className="max-w-4xl w-full">
          {/* Lista de personas con flex-wrap */}
          <div className="flex flex-wrap justify-center gap-2 sm-only:gap-3 md-only:gap-3 lg-only:gap-3 xl-only:gap-3">
            {personal.map((persona, index) => {
              // ✅ NUEVO: Obtener la asistencia registrada para esta persona
              const asistenciaPersona = asistenciasRegistradas.get(
                persona.ID_o_DNI
              );

              return (
                <ItemTomaAsistencia
                  key={index}
                  personal={persona}
                  handlePersonalSeleccionado={handleMarcarAsistencia}
                  handleEliminarAsistencia={handleEliminarAsistencia} // ← NUEVO: Pasar función de eliminación
                  asistenciaRegistrada={asistenciaPersona} // ← NUEVO: Pasar los datos de asistencia
                  timestampActual={timestampActual} // ← NUEVO: Pasar timestamp de Redux
                  loading={procesando === persona.ID_o_DNI}
                  eliminando={eliminandoAsistencia === persona.ID_o_DNI} // ← NUEVO: Estado de eliminación
                  globalLoading={cargandoAsistencias || isLoading}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
