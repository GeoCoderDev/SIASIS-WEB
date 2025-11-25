import { useState, useCallback, useEffect, useRef } from "react";
import ModalContainer from "../ModalContainer";
import BotonConIcono from "@/components/buttons/BotonConIcono";
import LapizFirmando from "@/components/icons/LapizFirmando";
import {
  ModoRegistro,
  modoRegistroTextos,
} from "@/interfaces/shared/ModoRegistro";
import { estaDentroDelColegioIE20935 } from "@/lib/helpers/functions/geolocation/getEstadoDeUbicacion";
import { PuntoGeografico } from "@/interfaces/Geolocalizacion";
import { verificarDisponibilidadGPS } from "@/lib/helpers/functions/geolocation/verificarDisponibilidadGPS";
import { detectarTipoDispositivo } from "@/lib/helpers/functions/geolocation/detectarTipoDispositivo";
import Loader from "@/components/shared/loaders/Loader";
import { ENTORNO } from "@/constants/ENTORNO";
import { Entorno } from "@/interfaces/shared/Entornos";

// ✅ IMPORTS FOR SOCKETS
import { useSS01 } from "@/hooks/useSS01";
import { TomaAsistenciaPersonalSIU01Events } from "@/SS01/sockets/events/AsistenciaDePersonal/frontend/TomaAsistenciaPersonalSIU01Events";
import { SALAS_TOMA_ASISTENCIA_PERSONAL_IE20935_MAPPER } from "@/SS01/sockets/events/AsistenciaDePersonal/interfaces/SalasTomaAsistenciaDePersonal";
import { RolesSistema } from "@/interfaces/shared/RolesSistema";
import { AsistenciaDePersonalIDB } from "@/lib/utils/local/db/models/AsistenciaDePersonal/AsistenciaDePersonalIDB";
import { HandlerProfesorPrimariaAsistenciaResponse } from "@/lib/utils/local/db/models/DatosAsistenciaHoy/handlers/HandlerProfesorPrimariaAsistenciaResponse";
import { HandlerAuxiliarAsistenciaResponse } from "@/lib/utils/local/db/models/DatosAsistenciaHoy/handlers/HandlerAuxiliarAsistenciaResponse";
import { HandlerProfesorTutorSecundariaAsistenciaResponse } from "@/lib/utils/local/db/models/DatosAsistenciaHoy/handlers/HandlerProfesorTutorSecundariaAsistenciaResponse";
import { HandlerPersonalAdministrativoAsistenciaResponse } from "@/lib/utils/local/db/models/DatosAsistenciaHoy/handlers/HandlerPersonalAdministrativoAsistenciaResponse";
import userStorage from "@/lib/utils/local/db/models/UserStorage";
import {
  MENSAJES_CONEXION_SOCKET,
  SOCKET_CONNECTION_TIMEOUT,
} from "@/constants/SOCKET_FRONTEND_CONFIGURATION";
import { PersonalDelColegio } from "@/interfaces/shared/PersonalDelColegio";

// ========================================================================================
// CONFIGURATION BY ENVIRONMENT
// ========================================================================================

const TESTING_EXPLICITO = false;

const REQUERIR_VALIDACION_GPS_SEGUN_ENTORNO: Record<Entorno, boolean> = {
  [Entorno.LOCAL]: true,
  [Entorno.DESARROLLO]: true,
  [Entorno.CERTIFICACION]: true,
  [Entorno.PRODUCCION]: true,
  [Entorno.TEST]: true,
};

const USAR_COORDENADAS_MOCKEADAS_SEGUN_ENTORNO: Record<Entorno, boolean> = {
  [Entorno.LOCAL]: true,
  [Entorno.DESARROLLO]: false,
  [Entorno.CERTIFICACION]: true,
  [Entorno.PRODUCCION]: false,
  [Entorno.TEST]: false,
};

const SOLO_PERMITIR_CELULARES_SEGUN_ENTORNO: Record<Entorno, boolean> = {
  [Entorno.LOCAL]: false,
  [Entorno.DESARROLLO]: false,
  [Entorno.CERTIFICACION]: true,
  [Entorno.PRODUCCION]: true,
  [Entorno.TEST]: false,
};

const REQUERIR_VALIDACION_GPS = REQUERIR_VALIDACION_GPS_SEGUN_ENTORNO[ENTORNO];
const USAR_COORDENADAS_MOCKEADAS =
  USAR_COORDENADAS_MOCKEADAS_SEGUN_ENTORNO[ENTORNO];
const SOLO_PERMITIR_CELULARES_PARA_ASISTENCIA =
  SOLO_PERMITIR_CELULARES_SEGUN_ENTORNO[ENTORNO];

export const LATITUD_MOCKEADA = -13.0567;
export const LONGITUD_MOCKEADA = -76.347049;

const COORDENADAS_DEBUGGING = {
  DENTRO_COLEGIO_1: { lat: -13.0567, lng: -76.347049 },
  DENTRO_COLEGIO_2: { lat: -13.056641, lng: -76.346922 },
  FUERA_COLEGIO: { lat: -12.0464, lng: -77.0428 },
};

interface MarcarAsistenciaPropiaDePersonalModalProps {
  eliminateModal: () => void;
  modoRegistro: ModoRegistro;
  marcarMiAsistenciaDeHoy: () => Promise<void>;
  setMostrarModalConfirmacioAsistenciaMarcada: React.Dispatch<
    React.SetStateAction<boolean>
  >;
  setMostrarModalFaltaActivarGPSoBrindarPermisosGPS: React.Dispatch<
    React.SetStateAction<boolean>
  >;
  setMostrarModalUbicacionFueraDelColegioAlRegistrarAsistenciaPropia: React.Dispatch<
    React.SetStateAction<boolean>
  >;
  setMostrarModalErrorGenericoAlRegistrarAsistenciaPropia: React.Dispatch<
    React.SetStateAction<boolean>
  >;
  setMostrarModalFalloConexionAInternet: React.Dispatch<
    React.SetStateAction<boolean>
  >;
  setMostrarModalNoSePuedeUsarLaptop: React.Dispatch<
    React.SetStateAction<boolean>
  >;
  setMostrarModalDispositivoSinGPS: React.Dispatch<
    React.SetStateAction<boolean>
  >;
  Rol: RolesSistema;
}

const MarcarAsistenciaPropiaDePersonalModal = ({
  Rol,
  eliminateModal,
  modoRegistro,
  marcarMiAsistenciaDeHoy,
  setMostrarModalConfirmacioAsistenciaMarcada,
  setMostrarModalFaltaActivarGPSoBrindarPermisosGPS,
  setMostrarModalUbicacionFueraDelColegioAlRegistrarAsistenciaPropia,
  setMostrarModalErrorGenericoAlRegistrarAsistenciaPropia,
  setMostrarModalFalloConexionAInternet,
  setMostrarModalNoSePuedeUsarLaptop,
  setMostrarModalDispositivoSinGPS,
}: MarcarAsistenciaPropiaDePersonalModalProps) => {
  // ========================================================================================
  // STATES
  // ========================================================================================

  const [estaProcessando, setEstaProcessando] = useState(false);

  // 🆕 NEW: State to control waiting for socket connection
  const [esperandoConexionSocket, setEsperandoConexionSocket] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [mensajeConexion, setMensajeConexion] = useState(
    MENSAJES_CONEXION_SOCKET[
      Math.floor(Math.random() * MENSAJES_CONEXION_SOCKET.length)
    ]
  );

  // ✅ Hook for Socket.io connection
  const { isReady, globalSocket } = useSS01();

  // Ref for the timeout
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ========================================================================================
  // EFFECTS FOR SOCKET CONNECTION HANDLING WITH TIMEOUT
  // ========================================================================================

  // 🚀 Main useEffect to handle socket connection timeout
  useEffect(() => {
    console.log("🔌 Initializing socket connection wait...", {
      isReady,
      timeout: SOCKET_CONNECTION_TIMEOUT,
      mensaje: mensajeConexion,
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
      return;
    }

    console.log("🔗 Joining attendance taking room:", {
      rol: Rol,
      modoRegistro,
      sala: SALAS_TOMA_ASISTENCIA_PERSONAL_IE20935_MAPPER[
        Rol as PersonalDelColegio
      ][modoRegistro],
    });

    // Create and execute emitter
    const emitter =
      new TomaAsistenciaPersonalSIU01Events.UNIRME_A_SALA_DE_TOMA_DE_ASISTENCIA_DE_PERSONAL_EMITTER(
        SALAS_TOMA_ASISTENCIA_PERSONAL_IE20935_MAPPER[
          Rol as PersonalDelColegio
        ][modoRegistro]
      );
    const sent = emitter.execute();

    if (!sent) {
      console.error("❌ Error sending join room event");
    } else {
      console.log(
        "✅ User successfully joined the room:",
        SALAS_TOMA_ASISTENCIA_PERSONAL_IE20935_MAPPER[
          Rol as PersonalDelColegio
        ][modoRegistro]
      );
    }
  }, [Rol, modoRegistro, isReady, esperandoConexionSocket]);

  // ========================================================================================
  // SOCKET FUNCTIONS
  // ========================================================================================

  // 📡 Function to send emitter event after successful registration
  const enviarEventoEmisoreAsistenciaRegistrada = useCallback(async () => {
    try {
      if (!isReady || !globalSocket) {
        console.warn(
          "⚠️ Socket is not ready to send emitter event, skipping..."
        );
        return;
      }

      console.log(
        "🚀 Sending own attendance registered emitter event..."
      );

      // STEP 1: Get logged-in user data
      const { DatosAsistenciaHoyIDB } = await import(
        "@/lib/utils/local/db/models/DatosAsistenciaHoy/DatosAsistenciaHoyIDB"
      );
      const datosIDB = new DatosAsistenciaHoyIDB();
      const handler = await datosIDB.getHandler();

      if (!handler) {
        console.error("❌ Could not get handler for user data");
        return;
      }

      // Extract user data
      const miDNI = (
        handler as
          | HandlerProfesorPrimariaAsistenciaResponse
          | HandlerAuxiliarAsistenciaResponse
          | HandlerProfesorTutorSecundariaAsistenciaResponse
          | HandlerPersonalAdministrativoAsistenciaResponse
      ).getMiIdentificador();

      const miNombres = await userStorage.getNombres();
      const miApellidos = await userStorage.getApellidos();
      const miGenero = await userStorage.getGenero();

      if (!miDNI) {
        console.error("❌ Could not get basic user data:", {
          miDNI,
          Rol,
        });
        return;
      }

      console.log("👤 User data obtained:", {
        dni: miDNI,
        rol: Rol,
        nombres: miNombres,
        apellidos: miApellidos,
        genero: miGenero,
      });

      // STEP 2: Consult the newly registered attendance
      const asistenciaIDB = new AsistenciaDePersonalIDB("API01");
      const asistenciaRecienRegistrada =
        await asistenciaIDB.consultarMiAsistenciaDeHoy(modoRegistro, Rol);

      if (!asistenciaRecienRegistrada.marcada) {
        console.error("❌ Newly registered attendance not found");
        return;
      }

      console.log(
        "📋 Newly registered attendance found:",
        asistenciaRecienRegistrada
      );

      // STEP 3: Verify that we have all necessary data
      if (
        !asistenciaRecienRegistrada.timestamp ||
        !asistenciaRecienRegistrada.estado
      ) {
        console.error("❌ Missing data from registered attendance:", {
          timestamp: asistenciaRecienRegistrada.timestamp,
          estado: asistenciaRecienRegistrada.estado,
        });
        return;
      }

      // STEP 4: Create and execute the emitter event
      const emitter =
        new TomaAsistenciaPersonalSIU01Events.MARQUE_LA_ASISTENCIA_DE_ESTE_PERSONAL_EMITTER(
          {
            Mi_Socket_Id: globalSocket.id,
            idUsuario: miDNI,
            genero: miGenero!,
            nombres: miNombres!,
            apellidos: miApellidos!,
            Sala_Toma_Asistencia_de_Personal:
              SALAS_TOMA_ASISTENCIA_PERSONAL_IE20935_MAPPER[
                Rol as PersonalDelColegio
              ][modoRegistro],
            modoRegistro,
            RegistroEntradaSalida: {
              desfaseSegundos: 0, // Calculated by the server
              timestamp: asistenciaRecienRegistrada.timestamp,
              estado: asistenciaRecienRegistrada.estado,
            },
            rol: Rol,
          }
        );

      const sent = emitter.execute();

      if (sent) {
        console.log("✅ Emitter event sent successfully:", {
          dni: miDNI,
          modoRegistro,
          sala: SALAS_TOMA_ASISTENCIA_PERSONAL_IE20935_MAPPER[
            Rol as PersonalDelColegio
          ][modoRegistro],
          socketId: globalSocket.id,
        });
      } else {
        console.error("❌ Error sending emitter event");
      }
    } catch (error) {
      console.error(
        "❌ Error sending own attendance emitter event:",
        error
      );
      // Do not throw error to avoid affecting the main registration flow
    }
  }, [isReady, globalSocket, modoRegistro, Rol]);

  // ========================================================================================
  // GEOLOCATION FUNCTIONS
  // ========================================================================================

  const verificarYSolicitarPermisos = async (): Promise<boolean> => {
    try {
      if ("permissions" in navigator) {
        const permission = await navigator.permissions.query({
          name: "geolocation",
        });

        console.log("📍 Current permission status:", permission.state);

        if (permission.state === "granted") {
          console.log("✅ Permissions already granted");
          return true;
        }

        if (permission.state === "denied") {
          console.log("❌ Permissions permanently denied");
          return false;
        }

        console.log("🔄 Permissions in prompt state, requesting...");
      }

      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => {
            console.log("✅ Permissions granted");
            resolve(true);
          },
          (error) => {
            console.log("❌ Permissions denied:", error);
            resolve(false);
          },
          {
            enableHighAccuracy: false,
            timeout: 5000,
            maximumAge: Infinity,
          }
        );
      });
    } catch (error) {
      console.error("❌ Error verifying permissions:", error);
      return false;
    }
  };

  const obtenerUbicacion = (): Promise<PuntoGeografico> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation not supported"));
        return;
      }

      const options = {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000,
      };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log("📍 REAL position obtained:", {
            latitudReal: position.coords.latitude,
            longitudReal: position.coords.longitude,
            precision: position.coords.accuracy,
            entorno: ENTORNO,
          });

          if (USAR_COORDENADAS_MOCKEADAS) {
            console.log("🔄 REPLACING real coordinates with mocked ones");

            const puntoMockeado = {
              latitud: LATITUD_MOCKEADA,
              longitud: LONGITUD_MOCKEADA,
            };

            console.log("🎭 Final coordinates (MOCKED):", puntoMockeado);

            if (TESTING_EXPLICITO) {
              console.log("🎯 HYBRID MODE:", {
                coordenadasRealesObtenidas: {
                  lat: position.coords.latitude,
                  lng: position.coords.longitude,
                },
                coordenadasQueSeUsaran: puntoMockeado,
                entorno: ENTORNO,
                mensaje: "GPS requested ✅ but coordinates replaced ✅",
              });
            }

            const estaDentroMockeado =
              estaDentroDelColegioIE20935(puntoMockeado);
            console.log("🔍 PRE-VERIFICATION mocked coordinates:", {
              coordenadas: puntoMockeado,
              estaDentroDelColegio: estaDentroMockeado,
            });

            if (!estaDentroMockeado) {
              console.error(
                "🚨 ERROR: Mocked coordinates are NOT within the school!"
              );
            }

            resolve(puntoMockeado);
          } else {
            console.log("✅ Using REAL coordinates obtained");
            resolve({
              latitud: position.coords.latitude,
              longitud: position.coords.longitude,
            });
          }
        },
        (error) => {
          console.error("❌ Geolocation error:", {
            code: error.code,
            message: error.message,
          });

          let errorMessage = "Unknown error";
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = "Location permissions denied";
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = "Location unavailable";
              break;
            case error.TIMEOUT:
              errorMessage = "Timeout getting location";
              break;
          }

          reject(new Error(errorMessage));
        },
        options
      );
    });
  };

  // ========================================================================================
  // MAIN REGISTRATION FUNCTION
  // ========================================================================================

  const manejarRegistroAsistencia = useCallback(async () => {
    if (estaProcessando) return;

    try {
      setEstaProcessando(true);

      console.log("🔧 CURRENT CONFIGURATION:", {
        entorno: `${ENTORNO} (${
          Object.keys(Entorno)[Object.values(Entorno).indexOf(ENTORNO)]
        })`,
        requiereValidacionGPS: REQUERIR_VALIDACION_GPS,
        usaCoordenadasMockeadas: USAR_COORDENADAS_MOCKEADAS,
        soloPermitirCelulares: SOLO_PERMITIR_CELULARES_PARA_ASISTENCIA,
        testingExplicito: TESTING_EXPLICITO,
        socketReady: isReady,
      });

      // STEP 1: Check device type
      if (SOLO_PERMITIR_CELULARES_PARA_ASISTENCIA) {
        const tipoDispositivo = detectarTipoDispositivo();

        if (tipoDispositivo === "laptop") {
          console.log("❌ Device not allowed: laptop");
          eliminateModal();
          setMostrarModalNoSePuedeUsarLaptop(true);
          return;
        }

        console.log("✅ Device allowed: mobile");
      } else {
        console.log(
          "✅ Device restriction disabled - Allowing laptops"
        );
      }

      // STEP 2: Check if GPS validation is required
      if (!REQUERIR_VALIDACION_GPS) {
        console.log("⚡ GPS VALIDATION DISABLED");
        console.log("🚀 Skipping ALL location validation...");

        // Go directly to mark attendance
        await marcarMiAsistenciaDeHoy();

        console.log("✅ Attendance registered successfully (without GPS)");

        // 📡 Send emitter event if socket is available
        await enviarEventoEmisoreAsistenciaRegistrada();

        eliminateModal();
        setMostrarModalConfirmacioAsistenciaMarcada(true);
        return;
      }

      console.log(
        "🔍 GPS validation enabled, proceeding with checks..."
      );

      // STEP 3: Check GPS availability
      if (!USAR_COORDENADAS_MOCKEADAS) {
        if (!verificarDisponibilidadGPS()) {
          console.log("❌ GPS not available on device");
          eliminateModal();
          setMostrarModalDispositivoSinGPS(true);
          return;
        }

        console.log("✅ GPS available, checking permissions...");

        const tienePermisos = await verificarYSolicitarPermisos();

        if (!tienePermisos) {
          console.log("❌ Could not get geolocation permissions");
          eliminateModal();
          setMostrarModalFaltaActivarGPSoBrindarPermisosGPS(true);
          return;
        }

        console.log("✅ GPS permissions obtained");
      } else {
        console.log(
          "⏭️ Skipping GPS verification - Using mocked coordinates"
        );
      }

      // STEP 4: Get location
      let ubicacion: PuntoGeografico;
      try {
        console.log("📍 Getting location...");
        ubicacion = await obtenerUbicacion();

        if (USAR_COORDENADAS_MOCKEADAS) {
          if (TESTING_EXPLICITO) {
            console.log(
              `🎭 MOCKED location obtained (Environment: ${ENTORNO}):`,
              ubicacion
            );
          } else {
            console.log("✅ Location obtained:", ubicacion);
          }
        } else {
          console.log("✅ REAL location obtained:", ubicacion);
        }
      } catch (error) {
        console.error("❌ Error getting location:", error);
        eliminateModal();
        setMostrarModalFaltaActivarGPSoBrindarPermisosGPS(true);
        return;
      }

      // STEP 5: Check if it's within the school
      console.log("🏫 Checking if it's within the school...");
      console.log("📊 DATA FOR VERIFICATION:", {
        ubicacionObtenida: ubicacion,
        funcionAUsar: "estaDentroDelColegioIE20935",
        coordenadasMockeadas: USAR_COORDENADAS_MOCKEADAS,
      });

      const estaDentroDelColegio = estaDentroDelColegioIE20935(ubicacion);

      console.log("🎯 VERIFICATION RESULT:", {
        estaDentroDelColegio,
        ubicacion,
        usandoMockeo: USAR_COORDENADAS_MOCKEADAS,
      });

      if (!estaDentroDelColegio) {
        if (USAR_COORDENADAS_MOCKEADAS) {
          console.error(
            "🚨 CRITICAL ERROR: MOCKED coordinates are OUTSIDE the school area!"
          );
          console.log("🔍 FULL DEBUGGING:", {
            coordenadasUsadas: ubicacion,
            coordenadasConfiguradas: {
              LATITUD_MOCKEADA,
              LONGITUD_MOCKEADA,
            },
            coordenadasAlternativas: COORDENADAS_DEBUGGING,
            sugerencia:
              "Verify the estaDentroDelColegioIE20935 function or change coordinates",
          });

          if (TESTING_EXPLICITO) {
            console.log(
              "💡 TIP: Change LATITUD_MOCKEADA and LONGITUD_MOCKEADA for testing"
            );
            console.log(
              "🔧 Or change TESTING_EXPLICITO to false to hide these messages"
            );
          }
        } else {
          console.log("❌ User outside school area");
        }
        eliminateModal();
        setMostrarModalUbicacionFueraDelColegioAlRegistrarAsistenciaPropia(
          true
        );
        return;
      }

      if (USAR_COORDENADAS_MOCKEADAS) {
        if (TESTING_EXPLICITO) {
          console.log(
            "✅ MOCKED coordinates are within the area, marking attendance..."
          );
        } else {
          console.log("✅ Location verified, marking attendance...");
        }
      } else {
        console.log(
          "✅ User within school area, marking attendance..."
        );
      }

      // FINAL STEP: Mark attendance
      await marcarMiAsistenciaDeHoy();

      console.log("✅ Attendance registered successfully");

      // 📡 Send emitter event if socket is available
      await enviarEventoEmisoreAsistenciaRegistrada();

      eliminateModal();
      setMostrarModalConfirmacioAsistenciaMarcada(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error("❌ Error marking attendance:", error);

      if (
        error?.message?.includes("network") ||
        error?.message?.includes("connection") ||
        error?.message?.includes("internet") ||
        error?.name === "NetworkError" ||
        error?.message?.includes("fetch")
      ) {
        eliminateModal();
        setMostrarModalFalloConexionAInternet(true);
      } else {
        eliminateModal();
        setMostrarModalErrorGenericoAlRegistrarAsistenciaPropia(true);
      }
    } finally {
      setEstaProcessando(false);
    }
  }, [
    estaProcessando,
    eliminateModal,
    marcarMiAsistenciaDeHoy,
    setMostrarModalConfirmacioAsistenciaMarcada,
    setMostrarModalFaltaActivarGPSoBrindarPermisosGPS,
    setMostrarModalUbicacionFueraDelColegioAlRegistrarAsistenciaPropia,
    setMostrarModalErrorGenericoAlRegistrarAsistenciaPropia,
    setMostrarModalFalloConexionAInternet,
    setMostrarModalNoSePuedeUsarLaptop,
    setMostrarModalDispositivoSinGPS,
    enviarEventoEmisoreAsistenciaRegistrada,
    isReady,
  ]);

  // ========================================================================================
  // RENDER FUNCTIONS
  // ========================================================================================

  // 🎨 Determine modal text and style based on configuration
  const obtenerTextoModal = () => {
    // 🚀 NEW: If we are waiting for socket connection, show special message
    if (esperandoConexionSocket) {
      return {
        texto: (
          <>
            {mensajeConexion}
            <br />
            <br />
            <span className="text-sm text-gray-600">
              This will only take a few seconds...
            </span>
          </>
        ),
        boton: "Connecting...",
        esConexionSocket: true,
      };
    }

    if (estaProcessando) {
      if (!REQUERIR_VALIDACION_GPS) {
        return {
          texto: (
            <>
              <b>Registering</b> your attendance...
              <br />
              <br />
              {TESTING_EXPLICITO && (
                <span className="text-orange-600">
                  <b>🚀 GPS-less Mode</b> (Environment: {ENTORNO})
                </span>
              )}
            </>
          ),
          boton: "Registering...",
          esConexionSocket: false,
        };
      } else if (USAR_COORDENADAS_MOCKEADAS) {
        return {
          texto: (
            <>
              <b>Verifying permissions</b> and <br />
              getting your <b>location</b>...
              <br />
              <br />
              {TESTING_EXPLICITO && (
                <>
                  <span className="text-purple-600">
                    <b>🎭 MOCK MODE</b> (Environment: {ENTORNO})
                  </span>
                  <br />
                </>
              )}
              If a permission request appears, please <b>accept</b> <br />
              to continue.
            </>
          ),
          boton: "Verifying location...",
          esConexionSocket: false,
        };
      } else {
        return {
          texto: (
            <>
              <b>Verifying permissions</b> and <br />
              getting your <b>location</b>...
              <br />
              <br />
              If a permission request appears, please <b>accept</b> <br />
              to continue.
            </>
          ),
          boton: "Verifying location...",
          esConexionSocket: false,
        };
      }
    } else {
      if (!REQUERIR_VALIDACION_GPS) {
        return {
          texto: (
            <>
              We are going to <b>register</b> your <br />
              attendance directly.
              <br />
              <br />
              {TESTING_EXPLICITO && (
                <span className="text-orange-600">
                  <b>🚀 Without GPS validation</b> (Environment: {ENTORNO})
                </span>
              )}
            </>
          ),
          boton: "🚀 Register (No GPS)",
          esConexionSocket: false,
        };
      } else if (USAR_COORDENADAS_MOCKEADAS) {
        return {
          texto: (
            <>
              We are going to verify your <br />
              <b>location</b> to{" "}
              <b>
                register your <br />
                attendance of {modoRegistroTextos[modoRegistro]}
              </b>
              . Make sure you are <br />
              <b>inside the school</b>.
              {TESTING_EXPLICITO && (
                <>
                  <br />
                  <br />
                  <span className="text-purple-600">
                    <b>🎭 TESTING MODE</b> (Environment: {ENTORNO})
                  </span>
                </>
              )}
            </>
          ),
          boton: TESTING_EXPLICITO
            ? `🎭 Register (Testing Mode)`
            : `Register ${modoRegistroTextos[modoRegistro]}`,
          esConexionSocket: false,
        };
      } else {
        return {
          texto: (
            <>
              We are going to verify your <br />
              <b>location</b> to{" "}
              <b>
                register your <br />
                attendance of {modoRegistroTextos[modoRegistro]}
              </b>
              . Make sure you are <br />
              <b>inside the school</b>.
            </>
          ),
          boton: `Register ${modoRegistroTextos[modoRegistro]}`,
          esConexionSocket: false,
        };
      }
    }
  };

  const { texto, boton } = obtenerTextoModal();

  return (
    <ModalContainer className="z-[1200]" eliminateModal={eliminateModal}>
      <div className="w-full max-w-md px-4 py-4 sm:px-6 sm:py-8 flex flex-col items-center justify-center gap-5">
        <p className="text-center text-sm xs:text-base sm:text-lg leading-relaxed">
          {texto}
        </p>

        {REQUERIR_VALIDACION_GPS && !esperandoConexionSocket && (
          <img
            className="rounded-[5px] w-[11rem] xs:w-[11rem] sm:w-[11.5rem] md:w-[10.5rem] h-auto object-contain"
            src="/images/gif/UbicacionColegioViajeGuiado.gif"
            alt="How to get to school"
          />
        )}

        {/* 🚀 NEW: Show button only if we are NOT waiting for socket connection */}
        {!esperandoConexionSocket && (
          <BotonConIcono
            className={`${
              modoRegistro === ModoRegistro.Entrada
                ? "bg-verde-principal"
                : "bg-rojo-oscuro"
            } text-blanco flex gap-3 px-4 py-2 rounded-md text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed`}
            texto={boton}
            IconTSX={
              estaProcessando ? (
                <Loader className="w-[1.5rem] bg-white p-[0.3rem]" />
              ) : (
                <LapizFirmando className="w-[1.5rem]" />
              )
            }
            onClick={manejarRegistroAsistencia}
            disabled={estaProcessando}
          />
        )}

        {/* 🎨 NEW: Special loader for socket connection */}
        {esperandoConexionSocket && (
          <div className="flex items-center justify-center">
            <Loader className="w-[2rem] bg-blue-500 p-[0.4rem]" />
          </div>
        )}
      </div>
    </ModalContainer>
  );
};

export default MarcarAsistenciaPropiaDePersonalModal;