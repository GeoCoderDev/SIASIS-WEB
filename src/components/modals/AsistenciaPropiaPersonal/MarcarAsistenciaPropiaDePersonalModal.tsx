import { useState, useCallback, useEffect, useRef } from "react";
import ModalContainer from "../ModalContainer";
import BotonConIcono from "@/components/buttons/BotonConIcono";
import LapizFirmando from "@/components/icons/LapizFirmando";
import {
  ModoRegistro,
  modoRegistroTextos,
} from "@/interfaces/shared/ModoRegistroPersonal";
import { estaDentroDelColegioIE20935 } from "@/lib/helpers/functions/geolocation/getEstadoDeUbicacion";
import { PuntoGeografico } from "@/interfaces/Geolocalizacion";
import { verificarDisponibilidadGPS } from "@/lib/helpers/functions/geolocation/verificarDisponibilidadGPS";
import { detectarTipoDispositivo } from "@/lib/helpers/functions/geolocation/detectarTipoDispositivo";
import Loader from "@/components/shared/loaders/Loader";
import { ENTORNO } from "@/constants/ENTORNO";
import { Entorno } from "@/interfaces/shared/Entornos";

// ✅ IMPORTACIONES PARA SOCKETS
import { useSS01 } from "@/hooks/useSS01";
import { TomaAsistenciaPersonalSIU01Events } from "@/SS01/sockets/events/AsistenciaDePersonal/frontend/TomaAsistenciaPersonalSIU01Events";
import { SALAS_TOMA_ASISTENCIA_PERSONAL_IE20935_MAPPER } from "@/SS01/sockets/events/AsistenciaDePersonal/interfaces/SalasTomaAsistenciaDePersonal";
import {
  PersonalDelColegio,
  RolesSistema,
} from "@/interfaces/shared/RolesSistema";
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

// ========================================================================================
// CONFIGURACIÓN POR ENTORNO
// ========================================================================================

const TESTING_EXPLICITO = false;

const REQUERIR_VALIDACION_GPS_SEGUN_ENTORNO: Record<Entorno, boolean> = {
  [Entorno.LOCAL]: false,
  [Entorno.DESARROLLO]: false,
  [Entorno.CERTIFICACION]: true,
  [Entorno.PRODUCCION]: true,
  [Entorno.TEST]: true,
};

const USAR_COORDENADAS_MOCKEADAS_SEGUN_ENTORNO: Record<Entorno, boolean> = {
  [Entorno.LOCAL]: false,
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
  // ESTADOS
  // ========================================================================================

  const [estaProcessando, setEstaProcessando] = useState(false);

  // 🆕 NUEVO: Estado para controlar la espera de conexión del socket
  const [esperandoConexionSocket, setEsperandoConexionSocket] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [mensajeConexion, setMensajeConexion] = useState(
    MENSAJES_CONEXION_SOCKET[
      Math.floor(Math.random() * MENSAJES_CONEXION_SOCKET.length)
    ]
  );

  // ✅ Hook para conexión Socket.io
  const { isReady, globalSocket } = useSS01();

  // Ref para el timeout
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ========================================================================================
  // EFECTOS PARA MANEJO DE SOCKET CON TIMEOUT
  // ========================================================================================

  // 🚀 useEffect principal para manejar timeout de conexión de socket
  useEffect(() => {
    console.log("🔌 Iniciando espera de conexión de socket...", {
      isReady,
      timeout: SOCKET_CONNECTION_TIMEOUT,
      mensaje: mensajeConexion,
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
      return;
    }

    console.log("🔗 Uniéndose a sala de toma de asistencia:", {
      rol: Rol,
      modoRegistro,
      sala: SALAS_TOMA_ASISTENCIA_PERSONAL_IE20935_MAPPER[
        Rol as PersonalDelColegio
      ][modoRegistro],
    });

    // Crear y ejecutar emisor
    const emitter =
      new TomaAsistenciaPersonalSIU01Events.UNIRME_A_SALA_DE_TOMA_DE_ASISTENCIA_DE_PERSONAL_EMITTER(
        SALAS_TOMA_ASISTENCIA_PERSONAL_IE20935_MAPPER[
          Rol as PersonalDelColegio
        ][modoRegistro]
      );
    const sent = emitter.execute();

    if (!sent) {
      console.error("❌ Error al enviar el evento de unión a sala");
    } else {
      console.log(
        "✅ Usuario unido exitosamente a la sala:",
        SALAS_TOMA_ASISTENCIA_PERSONAL_IE20935_MAPPER[
          Rol as PersonalDelColegio
        ][modoRegistro]
      );
    }
  }, [Rol, modoRegistro, isReady, esperandoConexionSocket]);

  // ========================================================================================
  // FUNCIONES DE SOCKET
  // ========================================================================================

  // 📡 Función para enviar evento emisor después del registro exitoso
  const enviarEventoEmisoreAsistenciaRegistrada = useCallback(async () => {
    try {
      if (!isReady || !globalSocket) {
        console.warn(
          "⚠️ Socket no está listo para enviar evento emisor, saltando..."
        );
        return;
      }

      console.log(
        "🚀 Enviando evento emisor de asistencia propia registrada..."
      );

      // PASO 1: Obtener datos del usuario logueado
      const { DatosAsistenciaHoyIDB } = await import(
        "@/lib/utils/local/db/models/DatosAsistenciaHoy/DatosAsistenciaHoyIDB"
      );
      const datosIDB = new DatosAsistenciaHoyIDB();
      const handler = await datosIDB.getHandler();

      if (!handler) {
        console.error("❌ No se pudo obtener handler para datos del usuario");
        return;
      }

      // Extraer datos del usuario
      const miDNI = (
        handler as
          | HandlerProfesorPrimariaAsistenciaResponse
          | HandlerAuxiliarAsistenciaResponse
          | HandlerProfesorTutorSecundariaAsistenciaResponse
          | HandlerPersonalAdministrativoAsistenciaResponse
      ).getMiDNI();

      const miNombres = await userStorage.getNombres();
      const miApellidos = await userStorage.getApellidos();
      const miGenero = await userStorage.getGenero();

      if (!miDNI) {
        console.error("❌ No se pudieron obtener datos básicos del usuario:", {
          miDNI,
          Rol,
        });
        return;
      }

      console.log("👤 Datos del usuario obtenidos:", {
        dni: miDNI,
        rol: Rol,
        nombres: miNombres,
        apellidos: miApellidos,
        genero: miGenero,
      });

      // PASO 2: Consultar la asistencia recién registrada
      const asistenciaIDB = new AsistenciaDePersonalIDB("API01");
      const asistenciaRecienRegistrada =
        await asistenciaIDB.consultarMiAsistenciaDeHoy(modoRegistro, Rol);

      if (!asistenciaRecienRegistrada.marcada) {
        console.error("❌ No se encontró la asistencia recién registrada");
        return;
      }

      console.log(
        "📋 Asistencia recién registrada encontrada:",
        asistenciaRecienRegistrada
      );

      // PASO 3: Verificar que tenemos todos los datos necesarios
      if (
        !asistenciaRecienRegistrada.timestamp ||
        !asistenciaRecienRegistrada.estado
      ) {
        console.error("❌ Faltan datos de la asistencia registrada:", {
          timestamp: asistenciaRecienRegistrada.timestamp,
          estado: asistenciaRecienRegistrada.estado,
        });
        return;
      }

      // PASO 4: Crear y ejecutar el evento emisor
      const emitter =
        new TomaAsistenciaPersonalSIU01Events.MARQUE_LA_ASISTENCIA_DE_ESTE_PERSONAL_EMITTER(
          {
            Mi_Socket_Id: globalSocket.id,
            id_o_dni: miDNI,
            genero: miGenero!,
            nombres: miNombres!,
            apellidos: miApellidos!,
            Sala_Toma_Asistencia_de_Personal:
              SALAS_TOMA_ASISTENCIA_PERSONAL_IE20935_MAPPER[
                Rol as PersonalDelColegio
              ][modoRegistro],
            modoRegistro,
            RegistroEntradaSalida: {
              desfaseSegundos: 0, // Calculado por el servidor
              timestamp: asistenciaRecienRegistrada.timestamp,
              estado: asistenciaRecienRegistrada.estado,
            },
            rol: Rol,
          }
        );

      const sent = emitter.execute();

      if (sent) {
        console.log("✅ Evento emisor enviado exitosamente:", {
          dni: miDNI,
          modoRegistro,
          sala: SALAS_TOMA_ASISTENCIA_PERSONAL_IE20935_MAPPER[
            Rol as PersonalDelColegio
          ][modoRegistro],
          socketId: globalSocket.id,
        });
      } else {
        console.error("❌ Error al enviar evento emisor");
      }
    } catch (error) {
      console.error(
        "❌ Error al enviar evento emisor de asistencia propia:",
        error
      );
      // No lanzar error para no afectar el flujo principal del registro
    }
  }, [isReady, globalSocket, modoRegistro, Rol]);

  // ========================================================================================
  // FUNCIONES DE GEOLOCALIZACIÓN
  // ========================================================================================

  const verificarYSolicitarPermisos = async (): Promise<boolean> => {
    try {
      if ("permissions" in navigator) {
        const permission = await navigator.permissions.query({
          name: "geolocation",
        });

        console.log("📍 Estado actual de permisos:", permission.state);

        if (permission.state === "granted") {
          console.log("✅ Permisos ya concedidos");
          return true;
        }

        if (permission.state === "denied") {
          console.log("❌ Permisos denegados permanentemente");
          return false;
        }

        console.log("🔄 Permisos en estado prompt, solicitando...");
      }

      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => {
            console.log("✅ Permisos concedidos");
            resolve(true);
          },
          (error) => {
            console.log("❌ Permisos denegados:", error);
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
      console.error("❌ Error al verificar permisos:", error);
      return false;
    }
  };

  const obtenerUbicacion = (): Promise<PuntoGeografico> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocalización no soportada"));
        return;
      }

      const options = {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000,
      };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log("📍 Posición REAL obtenida:", {
            latitudReal: position.coords.latitude,
            longitudReal: position.coords.longitude,
            precision: position.coords.accuracy,
            entorno: ENTORNO,
          });

          if (USAR_COORDENADAS_MOCKEADAS) {
            console.log("🔄 REEMPLAZANDO coordenadas reales con mockeadas");

            const puntoMockeado = {
              latitud: LATITUD_MOCKEADA,
              longitud: LONGITUD_MOCKEADA,
            };

            console.log("🎭 Coordenadas finales (MOCKEADAS):", puntoMockeado);

            if (TESTING_EXPLICITO) {
              console.log("🎯 MODO HÍBRIDO:", {
                coordenadasRealesObtenidas: {
                  lat: position.coords.latitude,
                  lng: position.coords.longitude,
                },
                coordenadasQueSeUsaran: puntoMockeado,
                entorno: ENTORNO,
                mensaje: "GPS solicitado ✅ pero coordenadas reemplazadas ✅",
              });
            }

            const estaDentroMockeado =
              estaDentroDelColegioIE20935(puntoMockeado);
            console.log("🔍 PRE-VERIFICACIÓN coordenadas mockeadas:", {
              coordenadas: puntoMockeado,
              estaDentroDelColegio: estaDentroMockeado,
            });

            if (!estaDentroMockeado) {
              console.error(
                "🚨 ERROR: Las coordenadas mockeadas NO están dentro del colegio!"
              );
            }

            resolve(puntoMockeado);
          } else {
            console.log("✅ Usando coordenadas REALES obtenidas");
            resolve({
              latitud: position.coords.latitude,
              longitud: position.coords.longitude,
            });
          }
        },
        (error) => {
          console.error("❌ Error de geolocalización:", {
            code: error.code,
            message: error.message,
          });

          let errorMessage = "Error desconocido";
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = "Permisos de ubicación denegados";
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = "Ubicación no disponible";
              break;
            case error.TIMEOUT:
              errorMessage = "Timeout al obtener ubicación";
              break;
          }

          reject(new Error(errorMessage));
        },
        options
      );
    });
  };

  // ========================================================================================
  // FUNCIÓN PRINCIPAL DE REGISTRO
  // ========================================================================================

  const manejarRegistroAsistencia = useCallback(async () => {
    if (estaProcessando) return;

    try {
      setEstaProcessando(true);

      console.log("🔧 CONFIGURACIÓN ACTUAL:", {
        entorno: `${ENTORNO} (${
          Object.keys(Entorno)[Object.values(Entorno).indexOf(ENTORNO)]
        })`,
        requiereValidacionGPS: REQUERIR_VALIDACION_GPS,
        usaCoordenadasMockeadas: USAR_COORDENADAS_MOCKEADAS,
        soloPermitirCelulares: SOLO_PERMITIR_CELULARES_PARA_ASISTENCIA,
        testingExplicito: TESTING_EXPLICITO,
        socketReady: isReady,
      });

      // PASO 1: Verificar tipo de dispositivo
      if (SOLO_PERMITIR_CELULARES_PARA_ASISTENCIA) {
        const tipoDispositivo = detectarTipoDispositivo();

        if (tipoDispositivo === "laptop") {
          console.log("❌ Dispositivo no permitido: laptop");
          eliminateModal();
          setMostrarModalNoSePuedeUsarLaptop(true);
          return;
        }

        console.log("✅ Dispositivo permitido: móvil");
      } else {
        console.log(
          "✅ Restricción de dispositivos deshabilitada - Permitiendo laptops"
        );
      }

      // PASO 2: Verificar si debe validar GPS
      if (!REQUERIR_VALIDACION_GPS) {
        console.log("⚡ VALIDACIÓN GPS DESHABILITADA");
        console.log("🚀 Saltando TODA la validación de ubicación...");

        // Ir directamente a marcar asistencia
        await marcarMiAsistenciaDeHoy();

        console.log("✅ Asistencia registrada exitosamente (sin GPS)");

        // 📡 Enviar evento emisor si el socket está disponible
        await enviarEventoEmisoreAsistenciaRegistrada();

        eliminateModal();
        setMostrarModalConfirmacioAsistenciaMarcada(true);
        return;
      }

      console.log(
        "🔍 Validación GPS habilitada, procediendo con verificaciones..."
      );

      // PASO 3: Verificar disponibilidad de GPS
      if (!USAR_COORDENADAS_MOCKEADAS) {
        if (!verificarDisponibilidadGPS()) {
          console.log("❌ GPS no disponible en el dispositivo");
          eliminateModal();
          setMostrarModalDispositivoSinGPS(true);
          return;
        }

        console.log("✅ GPS disponible, verificando permisos...");

        const tienePermisos = await verificarYSolicitarPermisos();

        if (!tienePermisos) {
          console.log("❌ No se pudieron obtener permisos de geolocalización");
          eliminateModal();
          setMostrarModalFaltaActivarGPSoBrindarPermisosGPS(true);
          return;
        }

        console.log("✅ Permisos GPS obtenidos");
      } else {
        console.log(
          "⏭️ Saltando verificación de GPS - Usando coordenadas mockeadas"
        );
      }

      // PASO 4: Obtener ubicación
      let ubicacion: PuntoGeografico;
      try {
        console.log("📍 Obteniendo ubicación...");
        ubicacion = await obtenerUbicacion();

        if (USAR_COORDENADAS_MOCKEADAS) {
          if (TESTING_EXPLICITO) {
            console.log(
              `🎭 Ubicación MOCKEADA obtenida (Entorno: ${ENTORNO}):`,
              ubicacion
            );
          } else {
            console.log("✅ Ubicación obtenida:", ubicacion);
          }
        } else {
          console.log("✅ Ubicación REAL obtenida:", ubicacion);
        }
      } catch (error) {
        console.error("❌ Error al obtener ubicación:", error);
        eliminateModal();
        setMostrarModalFaltaActivarGPSoBrindarPermisosGPS(true);
        return;
      }

      // PASO 5: Verificar si está dentro del colegio
      console.log("🏫 Verificando si está dentro del colegio...");
      console.log("📊 DATOS PARA VERIFICACIÓN:", {
        ubicacionObtenida: ubicacion,
        funcionAUsar: "estaDentroDelColegioIE20935",
        coordenadasMockeadas: USAR_COORDENADAS_MOCKEADAS,
      });

      const estaDentroDelColegio = estaDentroDelColegioIE20935(ubicacion);

      console.log("🎯 RESULTADO VERIFICACIÓN:", {
        estaDentroDelColegio,
        ubicacion,
        usandoMockeo: USAR_COORDENADAS_MOCKEADAS,
      });

      if (!estaDentroDelColegio) {
        if (USAR_COORDENADAS_MOCKEADAS) {
          console.error(
            "🚨 ERROR CRÍTICO: Coordenadas MOCKEADAS están fuera del área del colegio!"
          );
          console.log("🔍 DEBUGGING COMPLETO:", {
            coordenadasUsadas: ubicacion,
            coordenadasConfiguradas: {
              LATITUD_MOCKEADA,
              LONGITUD_MOCKEADA,
            },
            coordenadasAlternativas: COORDENADAS_DEBUGGING,
            sugerencia:
              "Verificar la función estaDentroDelColegioIE20935 o cambiar coordenadas",
          });

          if (TESTING_EXPLICITO) {
            console.log(
              "💡 TIP: Cambia LATITUD_MOCKEADA y LONGITUD_MOCKEADA para testing"
            );
            console.log(
              "🔧 O cambia TESTING_EXPLICITO a false para ocultar estos mensajes"
            );
          }
        } else {
          console.log("❌ Usuario fuera del área del colegio");
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
            "✅ Coordenadas MOCKEADAS están dentro del área, marcando asistencia..."
          );
        } else {
          console.log("✅ Ubicación verificada, marcando asistencia...");
        }
      } else {
        console.log(
          "✅ Usuario dentro del área del colegio, marcando asistencia..."
        );
      }

      // PASO FINAL: Marcar asistencia
      await marcarMiAsistenciaDeHoy();

      console.log("✅ Asistencia registrada exitosamente");

      // 📡 Enviar evento emisor si el socket está disponible
      await enviarEventoEmisoreAsistenciaRegistrada();

      eliminateModal();
      setMostrarModalConfirmacioAsistenciaMarcada(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error("❌ Error al marcar asistencia:", error);

      if (
        error?.message?.includes("network") ||
        error?.message?.includes("conexión") ||
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
  // FUNCIONES DE RENDER
  // ========================================================================================

  // 🎨 Determinar texto y estilo según configuración
  const obtenerTextoModal = () => {
    // 🚀 NUEVO: Si estamos esperando conexión del socket, mostrar mensaje especial
    if (esperandoConexionSocket) {
      return {
        texto: (
          <>
            {mensajeConexion}
            <br />
            <br />
            <span className="text-sm text-gray-600">
              Esto solo tomará unos segundos...
            </span>
          </>
        ),
        boton: "Conectando...",
        esConexionSocket: true,
      };
    }

    if (estaProcessando) {
      if (!REQUERIR_VALIDACION_GPS) {
        return {
          texto: (
            <>
              <b>Registrando</b> tu asistencia...
              <br />
              <br />
              {TESTING_EXPLICITO && (
                <span className="text-orange-600">
                  <b>🚀 Modo sin GPS</b> (Entorno: {ENTORNO})
                </span>
              )}
            </>
          ),
          boton: "Registrando...",
          esConexionSocket: false,
        };
      } else if (USAR_COORDENADAS_MOCKEADAS) {
        return {
          texto: (
            <>
              <b>Verificando permisos</b> y <br />
              obteniendo tu <b>ubicación</b>...
              <br />
              <br />
              {TESTING_EXPLICITO && (
                <>
                  <span className="text-purple-600">
                    <b>🎭 Modo MOCKEO</b> (Entorno: {ENTORNO})
                  </span>
                  <br />
                </>
              )}
              Si aparece una solicitud de <br />
              permisos, por favor <b>acepta</b> <br />
              para continuar.
            </>
          ),
          boton: "Verificando ubicación...",
          esConexionSocket: false,
        };
      } else {
        return {
          texto: (
            <>
              <b>Verificando permisos</b> y <br />
              obteniendo tu <b>ubicación</b>...
              <br />
              <br />
              Si aparece una solicitud de <br />
              permisos, por favor <b>acepta</b> <br />
              para continuar.
            </>
          ),
          boton: "Verificando ubicación...",
          esConexionSocket: false,
        };
      }
    } else {
      if (!REQUERIR_VALIDACION_GPS) {
        return {
          texto: (
            <>
              Vamos a <b>registrar</b> tu <br />
              asistencia directamente.
              <br />
              <br />
              {TESTING_EXPLICITO && (
                <span className="text-orange-600">
                  <b>🚀 Sin validación GPS</b> (Entorno: {ENTORNO})
                </span>
              )}
            </>
          ),
          boton: "🚀 Registrar (Sin GPS)",
          esConexionSocket: false,
        };
      } else if (USAR_COORDENADAS_MOCKEADAS) {
        return {
          texto: (
            <>
              Vamos a verificar tu <br />
              <b>ubicación</b> para{" "}
              <b>
                registrar tu <br />
                asistencia de {modoRegistroTextos[modoRegistro]}
              </b>
              . Asegúrate de <br />
              estar <b>dentro del colegio</b>.
              {TESTING_EXPLICITO && (
                <>
                  <br />
                  <br />
                  <span className="text-purple-600">
                    <b>🎭 Modo TESTING</b> (Entorno: {ENTORNO})
                  </span>
                </>
              )}
            </>
          ),
          boton: TESTING_EXPLICITO
            ? `🎭 Registrar (Modo Testing)`
            : `Registrar ${modoRegistroTextos[modoRegistro]}`,
          esConexionSocket: false,
        };
      } else {
        return {
          texto: (
            <>
              Vamos a verificar tu <br />
              <b>ubicación</b> para{" "}
              <b>
                registrar tu <br />
                asistencia de {modoRegistroTextos[modoRegistro]}
              </b>
              . Asegúrate de <br />
              estar <b>dentro del colegio</b>.
            </>
          ),
          boton: `Registrar ${modoRegistroTextos[modoRegistro]}`,
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
            alt="Como llegar al colegio"
          />
        )}

        {/* 🚀 NUEVO: Mostrar botón solo si NO estamos esperando conexión del socket */}
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

        {/* 🎨 NUEVO: Loader especial para conexión de socket */}
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
