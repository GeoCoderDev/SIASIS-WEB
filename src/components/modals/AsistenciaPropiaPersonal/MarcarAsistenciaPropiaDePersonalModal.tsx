import { useState, useCallback } from "react";
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

// ========================================================================================
// CONFIGURACIÓN POR ENTORNO
// ========================================================================================

// 🔧 TESTING: Mostrar mensajes de debugging y modo de prueba
const TESTING_EXPLICITO = false; // ✅ Cambiar a true para mostrar mensajes de debugging

// 🎯 Configuración de validación GPS según entorno
const REQUERIR_VALIDACION_GPS_SEGUN_ENTORNO: Record<Entorno, boolean> = {
  [Entorno.LOCAL]: false,
  [Entorno.DESARROLLO]: false, // ✅ GPS habilitado (solicitar permisos)
  [Entorno.CERTIFICACION]: true,
  [Entorno.PRODUCCION]: true,
  [Entorno.TEST]: true,
};

// 🎭 Configuración de coordenadas mockeadas según entorno
const USAR_COORDENADAS_MOCKEADAS_SEGUN_ENTORNO: Record<Entorno, boolean> = {
  [Entorno.LOCAL]: false,
  [Entorno.DESARROLLO]: false,
  [Entorno.CERTIFICACION]: true, // ✅ Reemplazar con coordenadas mockeadas al final
  [Entorno.PRODUCCION]: false,
  [Entorno.TEST]: false,
};

// 📱 Configuración de restricción de dispositivos según entorno
const SOLO_PERMITIR_CELULARES_SEGUN_ENTORNO: Record<Entorno, boolean> = {
  [Entorno.LOCAL]: false, // Permitir laptops en local (para desarrollo)
  [Entorno.DESARROLLO]: false, // ✅ PERMITIR LAPTOPS en desarrollo para testing
  [Entorno.CERTIFICACION]: true, // Solo celulares en certificación
  [Entorno.PRODUCCION]: true, // Solo celulares en producción
  [Entorno.TEST]: false, // Permitir laptops en test
};

// 🚀 VALORES FINALES CALCULADOS SEGÚN ENTORNO ACTUAL
const REQUERIR_VALIDACION_GPS = REQUERIR_VALIDACION_GPS_SEGUN_ENTORNO[ENTORNO];
const USAR_COORDENADAS_MOCKEADAS =
  USAR_COORDENADAS_MOCKEADAS_SEGUN_ENTORNO[ENTORNO];
const SOLO_PERMITIR_CELULARES_PARA_ASISTENCIA =
  SOLO_PERMITIR_CELULARES_SEGUN_ENTORNO[ENTORNO];

// 🎯 COORDENADAS PARA TESTING (VERIFICADAS - DENTRO DEL COLEGIO IE 20935)
export const LATITUD_MOCKEADA = -13.0567; // ✅ CONFIRMADO: Dentro del colegio
export const LONGITUD_MOCKEADA = -76.347049; // ✅ CONFIRMADO: Dentro del colegio

// 🔍 COORDENADAS ALTERNATIVAS PARA DEBUGGING
const COORDENADAS_DEBUGGING = {
  DENTRO_COLEGIO_1: { lat: -13.0567, lng: -76.347049 },
  DENTRO_COLEGIO_2: { lat: -13.056641, lng: -76.346922 },
  FUERA_COLEGIO: { lat: -12.0464, lng: -77.0428 }, // Lima, definitivamente fuera
};

/*
📋 CONFIGURACIÓN ACTUAL POR ENTORNO:

🔧 LOCAL (L):
   - REQUERIR_VALIDACION_GPS = true
   - USAR_COORDENADAS_MOCKEADAS = false
   - SOLO_PERMITIR_CELULARES = false
   → GPS real con validación completa, laptops permitidas

🛠️ DESARROLLO (D):
   - REQUERIR_VALIDACION_GPS = true
   - USAR_COORDENADAS_MOCKEADAS = true ← GPS FAKE
   - SOLO_PERMITIR_CELULARES = false ← LAPTOPS PERMITIDAS
   → GPS fake (coordenadas mockeadas) con validación completa

🧪 CERTIFICACIÓN (C):
   - REQUERIR_VALIDACION_GPS = true
   - USAR_COORDENADAS_MOCKEADAS = true
   - SOLO_PERMITIR_CELULARES = true
   → GPS fake (coordenadas mockeadas) con validación completa

🚀 PRODUCCIÓN (P):
   - REQUERIR_VALIDACION_GPS = true
   - USAR_COORDENADAS_MOCKEADAS = false
   - SOLO_PERMITIR_CELULARES = true
   → GPS real con validación completa

🔬 TEST (T):
   - REQUERIR_VALIDACION_GPS = true
   - USAR_COORDENADAS_MOCKEADAS = false
   - SOLO_PERMITIR_CELULARES = false
   → GPS real con validación completa, laptops permitidas
*/

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
}

const MarcarAsistenciaPropiaDePersonalModal = ({
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
  const [estaProcessando, setEstaProcessando] = useState(false);

  const verificarYSolicitarPermisos = async (): Promise<boolean> => {
    try {
      // Verificar si ya tenemos permisos
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

      // Solicitar permisos
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
      // 🔄 MODO NORMAL - GPS REAL (pero con posible reemplazo al final)
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

          // 🎭 VERIFICAR SI DEBE REEMPLAZAR CON COORDENADAS MOCKEADAS
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

            // ✅ PRE-VERIFICACIÓN DE COORDENADAS MOCKEADAS
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
            // ✅ USAR COORDENADAS REALES
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

  const manejarRegistroAsistencia = useCallback(async () => {
    if (estaProcessando) return;

    try {
      setEstaProcessando(true);

      // MOSTRAR CONFIGURACIÓN ACTUAL EN CONSOLA
      console.log("🔧 CONFIGURACIÓN ACTUAL:", {
        entorno: `${ENTORNO} (${
          Object.keys(Entorno)[Object.values(Entorno).indexOf(ENTORNO)]
        })`,
        requiereValidacionGPS: REQUERIR_VALIDACION_GPS,
        usaCoordenadasMockeadas: USAR_COORDENADAS_MOCKEADAS,
        soloPermitirCelulares: SOLO_PERMITIR_CELULARES_PARA_ASISTENCIA,
        testingExplicito: TESTING_EXPLICITO,
        configuracionCompleta: {
          validacionGPS: REQUERIR_VALIDACION_GPS_SEGUN_ENTORNO,
          coordenadasMock: USAR_COORDENADAS_MOCKEADAS_SEGUN_ENTORNO,
          celularesOnly: SOLO_PERMITIR_CELULARES_SEGUN_ENTORNO,
        },
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
        eliminateModal();
        setMostrarModalConfirmacioAsistenciaMarcada(true);
        return;
      }

      // 🔍 VALIDACIÓN GPS COMPLETA
      console.log(
        "🔍 Validación GPS habilitada, procediendo con verificaciones..."
      );

      // PASO 3: Verificar disponibilidad de GPS (Solo si no usamos coordenadas fake)
      if (!USAR_COORDENADAS_MOCKEADAS) {
        if (!verificarDisponibilidadGPS()) {
          console.log("❌ GPS no disponible en el dispositivo");
          eliminateModal();
          setMostrarModalDispositivoSinGPS(true);
          return;
        }

        console.log("✅ GPS disponible, verificando permisos...");

        // PASO 4: Verificar y solicitar permisos de geolocalización
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

      // PASO 5: Obtener ubicación
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

      // PASO 6: Verificar si está dentro del colegio
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
      eliminateModal();
      setMostrarModalConfirmacioAsistenciaMarcada(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error("❌ Error al marcar asistencia:", error);

      // Verificar si es error de conexión
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
  ]);

  // 🎨 DETERMINAR TEXTO Y ESTILO SEGÚN CONFIGURACIÓN
  const obtenerTextoModal = () => {
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

        {REQUERIR_VALIDACION_GPS && (
          <img
            className="rounded-[5px] w-[11rem] xs:w-[11rem] sm:w-[11.5rem] md:w-[10.5rem] h-auto object-contain"
            src="/images/gif/UbicacionColegioViajeGuiado.gif"
            alt="Como llegar al colegio"
          />
        )}

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
      </div>
    </ModalContainer>
  );
};

export default MarcarAsistenciaPropiaDePersonalModal;
