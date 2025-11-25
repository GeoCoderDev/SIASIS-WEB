import ItemTomaAsistencia, {
  PersonalParaTomarAsistencia,
} from "./ItemTomaAsistencia";
import { Speaker } from "../../lib/utils/voice/Speaker";
import {
  ModoRegistro,
  modoRegistroTextos,
} from "@/interfaces/shared/ModoRegistro";
import { HandlerDirectivoAsistenciaResponse } from "@/lib/utils/local/db/models/DatosAsistenciaHoy/handlers/HandlerDirectivoAsistenciaResponse";
import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";

import { AsistenciaDePersonalIDB } from "../../lib/utils/local/db/models/AsistenciaDePersonal/AsistenciaDePersonalIDB";
import { FechaHoraActualRealState } from "@/global/state/others/fechaHoraActualReal";
import { RolesSistema } from "@/interfaces/shared/RolesSistema";
import { Loader2 } from "lucide-react";
import { AsistenciaDiariaDePersonalResultado } from "@/interfaces/shared/AsistenciaRequests";
import { ErrorResponseAPIBase } from "@/interfaces/shared/apis/types";
import { useSelector } from "react-redux";
import { RootState } from "@/global/store";
import { useSS01 } from "@/hooks/useSS01";
import { TomaAsistenciaPersonalSIU01Events } from "@/SS01/sockets/events/AsistenciaDePersonal/frontend/TomaAsistenciaPersonalSIU01Events";

import { SALAS_TOMA_ASISTENCIA_PERSONAL_IE20935_MAPPER } from "../../SS01/sockets/events/AsistenciaDePersonal/interfaces/SalasTomaAsistenciaDePersonal";
import { Genero } from "@/interfaces/shared/Genero";
import { PersonalDelColegio } from "@/interfaces/shared/PersonalDelColegio";

// ========================================================================================
// SOCKET AND TIMEOUT CONFIGURATION
// ========================================================================================

// 🕒 Maximum waiting time for socket connection (4 seconds)
const SOCKET_CONNECTION_TIMEOUT = 4000;

// 🎨 Creative messages for connection waiting
const MENSAJES_CONEXION_SOCKET = [
  "🔐 Establishing secure connection...",
  "🌐 Synchronizing with the system...",
  "📡 Connecting to the server...",
  "⚡ Preparing the environment...",
  "🛡️ Verifying credentials...",
];

// Get text according to role
export const obtenerTextoRol = (rol: RolesSistema): string => {
  switch (rol) {
    case RolesSistema.Directivo:
      return "Directors";
    case RolesSistema.ProfesorPrimaria:
      return "Primary School Teachers";
    case RolesSistema.Auxiliar:
      return "Assistants";
    case RolesSistema.ProfesorSecundaria:
    case RolesSistema.Tutor:
      return "Secondary School Teachers/Tutors";
    case RolesSistema.PersonalAdministrativo:
      return "Administrative Staff";
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
  // STATES FOR SOCKET AND TIMEOUT
  // ========================================================================================

  // 🆕 NEW: State to control waiting for socket connection
  const [esperandoConexionSocket, setEsperandoConexionSocket] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [mensajeConexion, setMensajeConexion] = useState(
    MENSAJES_CONEXION_SOCKET[
      Math.floor(Math.random() * MENSAJES_CONEXION_SOCKET.length)
    ]
  );

  // Ref for the timeout
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Link with SS01
  const { isReady, globalSocket } = useSS01();

  // ========================================================================================
  // EFFECTS FOR SOCKET CONNECTION HANDLING WITH TIMEOUT
  // ========================================================================================

  // 🚀 Main useEffect to handle socket connection timeout
  useEffect(() => {
    console.log("🔌 ListaPersonal: Starting socket connection wait...", {
      isReady,
      timeout: SOCKET_CONNECTION_TIMEOUT,
      mensaje: mensajeConexion,
      rol,
      modoRegistro,
    });

    // If already connected from the start, do not wait
    if (isReady) {
      console.log("✅ Socket was already connected, skipping wait");
      setEsperandoConexionSocket(false);
      return;
    }

    // Set timeout for maximum wait
    timeoutRef.current = setTimeout(() => {
      console.log(
        `⏰ Timeout of ${SOCKET_CONNECTION_TIMEOUT}ms reached, continuing without socket`
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
  }, []); // Only runs on component mount

  // 🎯 useEffect to detect when the socket connects
  useEffect(() => {
    if (isReady && esperandoConexionSocket) {
      console.log("🎉 Socket connected before timeout, continuing...");

      // Clear timeout as the socket connected
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      setEsperandoConexionSocket(false);
    }
  }, [isReady, esperandoConexionSocket]);

  // 🏠 useEffect to join the room when the socket is ready and we are not waiting
  useEffect(() => {
    if (!isReady || esperandoConexionSocket) {
      if (!isReady) {
        console.warn("⚠️ Connection is not ready");
      }
      return;
    }

    console.log("🔗 ListaPersonal: Joining attendance taking room:", {
      rol,
      modoRegistro,
      sala: SALAS_TOMA_ASISTENCIA_PERSONAL_IE20935_MAPPER[
        rol as PersonalDelColegio
      ][modoRegistro],
    });

    // Create and execute emitter (original style)
    const emitter =
      new TomaAsistenciaPersonalSIU01Events.UNIRME_A_SALA_DE_TOMA_DE_ASISTENCIA_DE_PERSONAL_EMITTER(
        SALAS_TOMA_ASISTENCIA_PERSONAL_IE20935_MAPPER[
          rol as PersonalDelColegio
        ][modoRegistro]
      );
    const sent = emitter.execute();

    if (!sent) {
      console.error("❌ Error sending join room event");
    } else {
      console.log(
        "✅ User successfully joined the room:",
        SALAS_TOMA_ASISTENCIA_PERSONAL_IE20935_MAPPER[
          rol as PersonalDelColegio
        ][modoRegistro]
      );
    }
  }, [rol, modoRegistro, isReady, esperandoConexionSocket]);

  // ========================================================================================
  // SOCKET FUNCTIONS (only execute if socket is available)
  // ========================================================================================

  const marcarAsistenciaEnElRestoDeSesionesPorSS01 = useCallback(
    async (
      idUsuario: string | number,
      nombres: string,
      apellidos: string,
      genero: Genero
    ) => {
      if (!isReady || !globalSocket) {
        console.warn(
          "⚠️ Socket not available to mark attendance, skipping event..."
        );
        return;
      }

      const asistenciaRecienRegistrada =
        await asistenciaDePersonalIDB.consultarAsistenciaDeHoyDePersonal(
          idUsuario,
          modoRegistro,
          rol
        );

      // Create and execute emitter (original style)
      const emitter =
        new TomaAsistenciaPersonalSIU01Events.MARQUE_LA_ASISTENCIA_DE_ESTE_PERSONAL_EMITTER(
          {
            Mi_Socket_Id: globalSocket?.id,
            idUsuario,
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
        console.error("❌ Error sending attendance marking event");
      }
    },
    [rol, modoRegistro, isReady, globalSocket]
  );

  const eliminarAsistenciaEnElRestoDeSesionesPorSS01 = useCallback(
    async (
      idUsuario: string | number,
      nombres: string,
      apellidos: string,
      genero: Genero
    ) => {
      if (!isReady || !globalSocket) {
        console.warn(
          "⚠️ Socket not available to delete attendance, skipping event..."
        );
        return;
      }

      // Create and execute emitter (original style)
      const emitter =
        new TomaAsistenciaPersonalSIU01Events.ELIMINE_LA_ASISTENCIA_DE_ESTE_PERSONAL_EMITTER(
          {
            Mi_Socket_Id: globalSocket.id,
            idUsuario,
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
          "❌ Error sending attendance deletion event"
        );
      }
    },
    [rol, modoRegistro, isReady, globalSocket]
  );

  // ========================================================================================
  // MAIN COMPONENT STATES
  // ========================================================================================

  const { toast } = useToast();
  const [procesando, setProcesando] = useState<string | null>(null);
  const [cargandoAsistencias, setCargandoAsistencias] = useState(true);
  const [eliminandoAsistencia, setEliminandoAsistencia] = useState<
    string | null
  >(null);

  // ✅ NEW: Get current Redux timestamp
  const fechaHoraRedux = useSelector(
    (state: RootState) => state.others.fechaHoraActualReal
  );
  const timestampActual = fechaHoraRedux.utilidades?.timestamp;

  // ✅ NEW: State to store registered attendances by DNI
  const [asistenciasRegistradas, setAsistenciasRegistradas] = useState<
    Map<string, AsistenciaDiariaDePersonalResultado>
  >(new Map());

  // Error handling system states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ErrorResponseAPIBase | null>(null);

  // ✅ MODIFIED: Create instance WITHOUT the callback
  const asistenciaDePersonalIDB = new AsistenciaDePersonalIDB(
    "API01",
    setIsLoading,
    setError
  );

  // We get the staff data
  const personal = rol
    ? handlerDatosAsistenciaHoyDirectivo.obtenerPersonalPorRol(rol)
    : [];

  // ✅ MODIFIED: Load already registered attendances (only if not waiting for socket)
  const ultimaConsultaRef = useRef<string>("");

  useEffect(() => {
    // 🚀 NEW: Do not load attendances if we are waiting for socket connection
    if (esperandoConexionSocket) {
      console.log(
        "⏳ Waiting for socket connection, postponing attendance loading..."
      );
      return;
    }

    const claveConsulta = `${rol}-${modoRegistro}`;

    // ✅ Avoid query if it's the same as the previous one
    if (ultimaConsultaRef.current === claveConsulta) {
      console.log("🚫 Duplicate query avoided:", claveConsulta);
      return;
    }

    ultimaConsultaRef.current = claveConsulta;
    const cargarAsistenciasRegistradas = async () => {
      try {
        setCargandoAsistencias(true);

        console.log(`🔍 Loading attendances for ${rol} - ${modoRegistro}`);

        // ✅ USE ORCHESTRATOR instead of direct fetch
        const resultado =
          await asistenciaDePersonalIDB.consultarYSincronizarAsistenciasRedis(
            rol,
            modoRegistro
          );

        if (resultado.exitoso && resultado.datos) {
          // Create attendance map by DNI
          const mapaAsistencias = new Map<
            string,
            AsistenciaDiariaDePersonalResultado
          >();

          const resultados = Array.isArray(resultado.datos.Resultados)
            ? resultado.datos.Resultados
            : [resultado.datos.Resultados];

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          resultados.forEach((resultado: any) => {
            if (resultado && resultado.idUsuario) {
              mapaAsistencias.set(resultado.idUsuario, resultado);
            }
          });

          console.log("🗺️ Final attendance map:", mapaAsistencias);
          setAsistenciasRegistradas(mapaAsistencias);
        } else {
          console.error("❌ Error loading attendances:", resultado.mensaje);
          toast({
            title: "Error",
            description: "Could not load registered attendances",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("❌ Error consulting registered attendances:", error);
        toast({
          title: "Error",
          description: "Could not load registered attendances",
          variant: "destructive",
        });
      } finally {
        setCargandoAsistencias(false);
      }
    };

    if (rol && modoRegistro) {
      cargarAsistenciasRegistradas();
    }
  }, [rol, modoRegistro, esperandoConexionSocket]); // 🚀 NEW DEPENDENCY

  // ========================================================================================
  // MAIN FUNCTIONS
  // ========================================================================================

  const handleMarcarAsistencia = async (
    personal: PersonalParaTomarAsistencia
  ) => {
    if (procesando !== null) return;

    setProcesando(personal.idUsuario);

    try {
      // Get the expected time
      const horaEsperadaISO =
        handlerDatosAsistenciaHoyDirectivo.obtenerHorarioPersonalISO(
          rol!,
          personal.idUsuario,
          modoRegistro
        );

      // ✅ USE ORCHESTRATOR instead of direct fetch
      await asistenciaDePersonalIDB.marcarAsistencia(
        {
          datos: {
            ModoRegistro: modoRegistro,
            DNI: personal.idUsuario,
            Rol: rol!,
            Dia: fechaHoraActual.utilidades!.diaMes,
          },
        },
        horaEsperadaISO // ✅ PASS expected time
      );

      marcarAsistenciaEnElRestoDeSesionesPorSS01(
        personal.idUsuario,
        personal.Nombres,
        personal.Apellidos,
        personal.Genero
      );

      actualizarInterfazPorNuevaMarcacion(
        personal.Nombres,
        personal.Apellidos,
        personal.idUsuario
      );

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      // The orchestrator has already handled the error, just give voice feedback
      const speaker = Speaker.getInstance();
      speaker.start(
        `Error registering ${modoRegistroTextos[modoRegistro].toLowerCase()}`
      );
    } finally {
      setProcesando(null);
    }
  };

  const actualizarInterfazPorNuevaMarcacion = (
    Nombres: string,
    Apellidos: string,
    idUsuario: string
  ) => {
    // Voice feedback
    const speaker = Speaker.getInstance();
    speaker.start(
      `${modoRegistroTextos[modoRegistro]} registered for ${Nombres.split(
        " "
      ).shift()} ${Apellidos.split(" ").shift()}`
    );

    // ✅ UPDATE local state (simulating successful response)
    const OFFSET_PERU_MS = 5 * 60 * 60 * 1000;
    const timestampActual = fechaHoraRedux.utilidades?.timestamp
      ? fechaHoraRedux.utilidades?.timestamp - OFFSET_PERU_MS
      : Date.now();

    const nuevoRegistro: AsistenciaDiariaDePersonalResultado = {
      idUsuario,
      AsistenciaMarcada: true,
      Detalles: {
        Timestamp: timestampActual,
        DesfaseSegundos: 0, // Server will calculate real value
      },
    };

    setAsistenciasRegistradas((prev) => {
      const nuevo = new Map(prev);
      nuevo.set(idUsuario, nuevoRegistro);
      return nuevo;
    });
  };

  // ========================================================================================
  // SOCKET HANDLERS (only configured if socket is available)
  // ========================================================================================

  // Refs to maintain reference to handlers
  const seAcabaDeMarcarLaAsistenciaDeEstePersonalHandlerRef =
    useRef<InstanceType<
      typeof TomaAsistenciaPersonalSIU01Events.SE_ACABA_DE_MARCAR_LA_ASISTENCIA_DE_ESTE_PERSONAL_HANDLER
    > | null>(null);

  const seAcabaDeEliminarLaAsistenciaDeEstePersonalHandlerRef =
    useRef<InstanceType<
      typeof TomaAsistenciaPersonalSIU01Events.SE_ACABA_DE_ELIMINAR_LA_ASISTENCIA_DE_ESTE_PERSONAL_HANDLER
    > | null>(null);

  // Configure handlers when the socket is REALLY ready and we are not waiting
  useEffect(() => {
    if (!isReady || !globalSocket || esperandoConexionSocket) {
      return;
    }

    console.log("🎧 Configuring socket handlers...");

    //HANDLERS

    // Configure handler for greeting response (original style)
    seAcabaDeMarcarLaAsistenciaDeEstePersonalHandlerRef.current =
      new TomaAsistenciaPersonalSIU01Events.SE_ACABA_DE_MARCAR_LA_ASISTENCIA_DE_ESTE_PERSONAL_HANDLER(
        async ({
          idUsuario,
          nombres,
          apellidos,
          modoRegistro,
          RegistroEntradaSalida,
          rol,
          Mi_Socket_Id,
        }) => {
          if (globalSocket.id == Mi_Socket_Id) return;

          await asistenciaDePersonalIDB.marcarAsistenciaEnLocal(
            idUsuario,
            rol,
            modoRegistro,
            RegistroEntradaSalida
          );

          actualizarInterfazPorNuevaMarcacion(
            nombres,
            apellidos,
            String(idUsuario)
          );
        }
      );

    // Register handler (original style)
    seAcabaDeMarcarLaAsistenciaDeEstePersonalHandlerRef.current.hand();

    seAcabaDeEliminarLaAsistenciaDeEstePersonalHandlerRef.current =
      new TomaAsistenciaPersonalSIU01Events.SE_ACABA_DE_ELIMINAR_LA_ASISTENCIA_DE_ESTE_PERSONAL_HANDLER(
        async ({
          Mi_Socket_Id,
          idUsuario,
          nombres,
          apellidos,
          modoRegistro,
          genero,
          rol,
        }) => {
          if (globalSocket.id == Mi_Socket_Id) return;

          await asistenciaDePersonalIDB.eliminarAsistenciaEnLocal(
            idUsuario,
            rol,
            modoRegistro
          );

          actualizarInterfazPorEliminacionDeAsistencia({
            idUsuario: String(idUsuario),
            Nombres: nombres,
            Apellidos: apellidos,
            Genero: genero,
          });
        }
      );

    seAcabaDeEliminarLaAsistenciaDeEstePersonalHandlerRef.current.hand();

    // Cleanup on unmount or socket change (original style)
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
  }, [isReady, esperandoConexionSocket]); // 🚀 NEW DEPENDENCY

  const actualizarInterfazPorEliminacionDeAsistencia = (
    personal: Omit<PersonalParaTomarAsistencia, "GoogleDriveFotoId">
  ) => {
    // ✅ Update the map of registered attendances (delete the entry)
    setAsistenciasRegistradas((prev) => {
      const nuevo = new Map(prev);
      nuevo.delete(personal.idUsuario);
      return nuevo;
    });

    // 🎯 NEW: Voice feedback for successful deletion
    const speaker = Speaker.getInstance();
    speaker.start(
      `${
        modoRegistroTextos[modoRegistro]
      } deleted for ${personal.Nombres.split(
        " "
      ).shift()} ${personal.Apellidos.split(" ").shift()}`
    );

    console.log("✅ Successful deletion, state updated");
  };

  // Handle attendance deletion WITH VOICE FEEDBACK
  const handleEliminarAsistencia = async (
    personal: PersonalParaTomarAsistencia
  ) => {
    if (eliminandoAsistencia !== null) return;

    try {
      setEliminandoAsistencia(personal.idUsuario);

      console.log(
        `🗑️ Starting attendance deletion for: ${personal.idUsuario}`
      );

      // Delete using the IndexedDB model
      const resultado = await asistenciaDePersonalIDB.eliminarAsistencia({
        idUsuario: personal.idUsuario,
        rol: rol,
        modoRegistro: modoRegistro,
      });

      if (resultado.exitoso) {
        actualizarInterfazPorEliminacionDeAsistencia(personal);

        eliminarAsistenciaEnElRestoDeSesionesPorSS01(
          personal.idUsuario,
          personal.Nombres,
          personal.Apellidos,
          personal.Genero
        );

        toast({
          title: "Attendance deleted",
          description: resultado.mensaje,
          variant: "default",
        });
      } else {
        // 🎯 NEW: Voice feedback for error in deletion
        const speaker = Speaker.getInstance();
        speaker.start(
          `Error deleting ${modoRegistroTextos[
            modoRegistro
          ].toLowerCase()} for ${personal.Nombres.split(" ").shift()}`
        );

        toast({
          title: "Error",
          description: resultado.mensaje,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error deleting attendance:", error);

      // 🎯 NEW: Voice feedback for general error
      const speaker = Speaker.getInstance();
      speaker.start(
        `System error deleting ${modoRegistroTextos[
          modoRegistro
        ].toLowerCase()}`
      );

      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unknown error deleting attendance";

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
  // CONDITIONAL RENDERS
  // ========================================================================================

  // 🚀 NEW: Show socket connection waiting status
  if (esperandoConexionSocket) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center">
        <div className="text-center max-w-md">
          <div className="mb-4">
            <Loader2 className="inline-block w-8 h-8 text-blue-500 animate-spin" />
          </div>
          <p className="text-lg text-gray-700 mb-2">{mensajeConexion}</p>
          <p className="text-sm text-gray-500">
            This will only take a few seconds...
          </p>
        </div>
      </div>
    );
  }

  // Show error if exists
  if (error) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center">
        <div className="text-center max-w-md">
          <p className="text-xl text-red-600 mb-2">System Error</p>
          <p className="text-sm text-gray-600 mb-4">{error.message}</p>
          <button
            onClick={() => setError(null)}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Message when no staff
  if (personal.length === 0) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center">
        <p className="text-xl text-gray-600">
          No staff available for this role
        </p>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col pb-3 px-4 sm-only:pb-4 sm-only:px-3 md-only:pb-4 md-only:px-3 lg-only:pb-4 lg-only:px-4 bg-gradient-to-b from-white to-gray-50 overflow-auto">
      {/* Fixed headers at the top - WITH INFORMATIONAL MESSAGE */}
      <div className="sticky top-0 bg-[#ffffff34] [backdrop-filter:blur(10px)] py-2 sm-only:py-3 md-only:py-3 lg-only:py-3 xl-only:py-4 z-[1] mb-2">
        <h2 className="text-base sm-only:text-lg md-only:text-lg lg-only:text-lg xl-only:text-xl font-bold text-blue-800 text-center leading-tight">
          {modoRegistroTextos[modoRegistro]} | {textoRol}
        </h2>

        <h3 className="text-lg sm-only:text-xl md-only:text-xl lg-only:text-2xl xl-only:text-2xl font-bold text-green-600 text-center leading-tight">
          Now click on your name
        </h3>

        {/* 🆕 INFORMATIONAL MESSAGE ABOUT TIME LIMIT */}
        <div className="text-center mt-1 mb-2">
          <p className="text-xs sm-only:text-sm text-orange-600 font-medium">
            💡 You have 5 minutes to cancel an attendance after registering it
          </p>
        </div>

        {/* 🚀 NEW: Socket status indicator */}
        {!isReady && (
          <div className="text-center mt-1 mb-2">
            <p className="text-xs sm-only:text-sm text-amber-600 font-medium">
              ⚠️ Running without real-time connection
            </p>
          </div>
        )}

        {(cargandoAsistencias || isLoading) && (
          <p className="text-center text-blue-500 mt-1">
            <Loader2 className="inline-block w-4 h-4 mr-1 animate-spin" />
            {cargandoAsistencias
              ? "Loading registered attendances..."
              : "Processing attendance..."}
          </p>
        )}
      </div>

      {/* Centered container for cards */}
      <div className="z-0 flex-1 flex justify-center">
        <div className="max-w-4xl w-full">
          {/* List of people with flex-wrap */}
          <div className="flex flex-wrap justify-center gap-2 sm-only:gap-3 md-only:gap-3 lg-only:gap-3 xl-only:gap-3">
            {personal.map((persona, index) => {
              // ✅ NEW: Get the registered attendance for this person
              const asistenciaPersona = asistenciasRegistradas.get(
                persona.idUsuario
              );

              return (
                <ItemTomaAsistencia
                  key={index}
                  personal={persona}
                  handlePersonalSeleccionado={handleMarcarAsistencia}
                  handleEliminarAsistencia={handleEliminarAsistencia} // ← NEW: Pass deletion function
                  asistenciaRegistrada={asistenciaPersona} // ← NEW: Pass attendance data
                  timestampActual={timestampActual} // ← NEW: Pass Redux timestamp
                  loading={procesando === persona.idUsuario}
                  eliminando={eliminandoAsistencia === persona.idUsuario} // ← NEW: Deletion status
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