import { useState, useCallback } from "react";
import ModalContainer from "../ModalContainer";
import BotonConIcono from "@/components/buttons/BotonConIcono";
import LapizFirmando from "@/components/icons/LapizFirmando";
import { ModoRegistro } from "@/interfaces/shared/ModoRegistroPersonal";
import { estaDentroDelColegioIE20935 } from "@/lib/helpers/functions/geolocation/getEstadoDeUbicacion";
import { PuntoGeografico } from "@/interfaces/Geolocalizacion";
import { verificarDisponibilidadGPS } from "@/lib/helpers/functions/geolocation/verificarDisponibilidadGPS";
import { detectarTipoDispositivo } from "@/lib/helpers/functions/geolocation/detectarTipoDispositivo";
import Loader from "@/components/shared/loaders/Loader";

// ========================================================================================
// CONSTANTES DE CONFIGURACIÓN
// ========================================================================================
export const SOLO_PERMITIR_CELULARES_PARA_ASISTENCIA = false; // Cambiar a false para permitir laptops
export const REQUERIR_VALIDACION_GPS = true; // 🆕 Cambiar a false para saltarse GPS completamente

// 🆕 MOCKEO DE COORDENADAS PARA TESTING
export const USAR_COORDENADAS_MOCKEADAS = true; // Cambiar a true para usar coordenadas fake
export const LATITUD_MOCKEADA = -13.056668; // 🎯 Coordenada de prueba - cambiar según necesites
export const LONGITUD_MOCKEADA = -76.346977; // 🎯 Coordenada de prueba - cambiar según necesites

/*
🎭 INSTRUCCIONES PARA MOCKEO DE COORDENADAS:

1. ACTIVAR MOCKEO: Cambiar USAR_COORDENADAS_MOCKEADAS = true
2. CONFIGURAR COORDENADAS: Cambiar LATITUD_MOCKEADA y LONGITUD_MOCKEADA

📍 COORDENADAS ÚTILES PARA TESTING:

DENTRO DEL COLEGIO IE 20935 (Ejemplo):
- LATITUD_MOCKEADA = -13.0393
- LONGITUD_MOCKEADA = -76.3806

FUERA DEL COLEGIO (Para testing de "fuera del área"):
- LATITUD_MOCKEADA = -12.0464
- LONGITUD_MOCKEADA = -77.0428

🎯 VENTAJAS DEL MOCKEO:
- ✅ Testing sin estar físicamente en el colegio
- ✅ No necesita permisos GPS reales
- ✅ Resultados predecibles
- ✅ Simula delay real de GPS (1 segundo)

⚠️ IMPORTANTE: Desactivar en producción (false)

🔧 RESUMEN DE MODOS DISPONIBLES:

MODO 1 - PRODUCCIÓN NORMAL:
- REQUERIR_VALIDACION_GPS = true
- USAR_COORDENADAS_MOCKEADAS = false
👉 GPS real + Validación completa

MODO 2 - TESTING CON GPS FAKE:
- REQUERIR_VALIDACION_GPS = true  
- USAR_COORDENADAS_MOCKEADAS = true
👉 GPS fake + Validación completa (útil para testing)

MODO 3 - BYPASS COMPLETO:
- REQUERIR_VALIDACION_GPS = false
- USAR_COORDENADAS_MOCKEADAS = cualquier valor
👉 Sin GPS + Sin validación (desarrollo/emergencias)
*/

interface MarcarAsistenciaPropiaDePersonalModalProps {
  eliminateModal: () => void;
  modoRegistro: ModoRegistro;
  marcarMiAsistenciaDeHoy: () => Promise<void>; // Nueva prop
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

        // Si está en 'prompt', continuamos para solicitar
        console.log("🔄 Permisos en estado prompt, solicitando...");
      }

      // Solicitar permisos haciendo una llamada simple a getCurrentPosition
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
      // 🆕 USAR COORDENADAS MOCKEADAS SI ESTÁ HABILITADO
      if (USAR_COORDENADAS_MOCKEADAS) {
        console.log("🎭 MODO MOCKEO ACTIVADO - Usando coordenadas fake");
        console.log("📍 Coordenadas mockeadas:", {
          latitud: LATITUD_MOCKEADA,
          longitud: LONGITUD_MOCKEADA,
          precision: "FAKE",
          nota: "Estas coordenadas son para testing",
        });

        // Simular un pequeño delay como si fuera GPS real
        setTimeout(() => {
          resolve({
            latitud: LATITUD_MOCKEADA,
            longitud: LONGITUD_MOCKEADA,
          });
        }, 1000); // 1 segundo de delay

        return;
      }

      // 🔄 MODO NORMAL - GPS REAL
      if (!navigator.geolocation) {
        reject(new Error("Geolocalización no soportada"));
        return;
      }

      const options = {
        enableHighAccuracy: true,
        timeout: 15000, // 15 segundos
        maximumAge: 30000, // 30 segundos
      };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log("📍 Posición REAL obtenida:", {
            latitud: position.coords.latitude,
            longitud: position.coords.longitude,
            precision: position.coords.accuracy,
          });

          resolve({
            latitud: position.coords.latitude,
            longitud: position.coords.longitude,
          });
        },
        (error) => {
          console.error("❌ Error de geolocalización:", {
            code: error.code,
            message: error.message,
            PERMISSION_DENIED: error.PERMISSION_DENIED,
            POSITION_UNAVAILABLE: error.POSITION_UNAVAILABLE,
            TIMEOUT: error.TIMEOUT,
          });

          // Crear un error más descriptivo
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

      // PASO 1: Verificar tipo de dispositivo (si está habilitada la restricción)
      if (SOLO_PERMITIR_CELULARES_PARA_ASISTENCIA) {
        const tipoDispositivo = detectarTipoDispositivo();

        if (tipoDispositivo === "laptop") {
          console.log("❌ Dispositivo no permitido: laptop");
          eliminateModal();
          setMostrarModalNoSePuedeUsarLaptop(true);
          return;
        }

        console.log("✅ Dispositivo permitido: móvil");
      }

      // 🆕 VERIFICAR SI SE REQUIERE VALIDACIÓN GPS
      if (REQUERIR_VALIDACION_GPS) {
        console.log(
          "🔍 Validación GPS habilitada, procediendo con verificaciones..."
        );

        // 🆕 SI USAMOS COORDENADAS MOCKEADAS, SALTARSE TODA LA VERIFICACIÓN GPS
        if (USAR_COORDENADAS_MOCKEADAS) {
          console.log(
            "🎭 COORDENADAS MOCKEADAS ACTIVADAS - Saltando TODA verificación GPS"
          );
          console.log("⚡ Usando directamente coordenadas fake para testing");
        } else {
          // SOLO VERIFICAR GPS REAL SI NO ESTAMOS USANDO COORDENADAS FAKE

          // PASO 2: Verificar disponibilidad de GPS
          if (!verificarDisponibilidadGPS()) {
            console.log("❌ GPS no disponible en el dispositivo");
            eliminateModal();
            setMostrarModalDispositivoSinGPS(true);
            return;
          }

          console.log("✅ GPS disponible, verificando permisos...");

          // PASO 3: Verificar y solicitar permisos de geolocalización
          const tienePermisos = await verificarYSolicitarPermisos();

          if (!tienePermisos) {
            console.log(
              "❌ No se pudieron obtener permisos de geolocalización"
            );
            eliminateModal();
            setMostrarModalFaltaActivarGPSoBrindarPermisosGPS(true);
            return;
          }

          console.log("✅ Permisos GPS reales obtenidos");
        }

        console.log("✅ Listos para obtener ubicación...");

        // PASO 4: Obtener ubicación con permisos ya concedidos
        let ubicacion: PuntoGeografico;
        try {
          ubicacion = await obtenerUbicacion();

          if (USAR_COORDENADAS_MOCKEADAS) {
            console.log("🎭 Ubicación MOCKEADA obtenida:", ubicacion);
            console.log("⚠️ RECUERDA: Estas son coordenadas FAKE para testing");
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
        const estaDentroDelColegio = estaDentroDelColegioIE20935(ubicacion);

        if (!estaDentroDelColegio) {
          if (USAR_COORDENADAS_MOCKEADAS) {
            console.log(
              "❌ Coordenadas MOCKEADAS están fuera del área del colegio"
            );
            console.log(
              "💡 TIP: Cambia LATITUD_MOCKEADA y LONGITUD_MOCKEADA para testing"
            );
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
          console.log(
            "✅ Coordenadas MOCKEADAS están dentro del área del colegio, marcando asistencia..."
          );
        } else {
          console.log(
            "✅ Usuario dentro del área del colegio, marcando asistencia..."
          );
        }
      } else {
        // 🆕 GPS BYPASS: Saltarse toda la validación de ubicación
        console.log(
          "⚠️ Validación GPS DESHABILITADA - Saltando verificaciones de ubicación"
        );
        console.log("🚀 Procediendo directamente a marcar asistencia...");
      }

      // PASO FINAL: Marcar asistencia usando el orquestador
      try {
        await marcarMiAsistenciaDeHoy();

        // Si llegamos aquí, todo fue exitoso
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
          // Error genérico
          eliminateModal();
          setMostrarModalErrorGenericoAlRegistrarAsistenciaPropia(true);
        }
      }
    } catch (error) {
      console.error("❌ Error general en el proceso:", error);
      eliminateModal();
      setMostrarModalErrorGenericoAlRegistrarAsistenciaPropia(true);
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

  return (
    <ModalContainer className="z-[1200]" eliminateModal={eliminateModal}>
      <div className="w-full max-w-md px-4 py-4 sm:px-6 sm:py-8 flex flex-col items-center justify-center gap-5">
        <p className="text-center text-sm xs:text-base sm:text-lg leading-relaxed">
          {estaProcessando ? (
            REQUERIR_VALIDACION_GPS ? (
              USAR_COORDENADAS_MOCKEADAS ? (
                <>
                  <b>Usando coordenadas</b> de <br />
                  <b>prueba</b> para registro...
                  <br />
                  <br />
                  <span className="text-purple-600">
                    <b>🎭 Modo MOCKEO</b> activado
                  </span>
                </>
              ) : (
                <>
                  <b>Verificando permisos</b> y <br />
                  obteniendo tu <b>ubicación</b>...
                  <br />
                  <br />
                  Si aparece una solicitud de <br />
                  permisos, por favor <b>acepta</b> <br />
                  para continuar.
                </>
              )
            ) : (
              <>
                <b>Registrando</b> tu <br />
                asistencia...
                <br />
                <br />
                <span className="text-orange-600">
                  <b>Modo sin GPS</b> activado
                </span>
              </>
            )
          ) : REQUERIR_VALIDACION_GPS ? (
            USAR_COORDENADAS_MOCKEADAS ? (
              <>
                Vamos a <b>registrar</b> tu <br />
                asistencia usando <br />
                <b>coordenadas de prueba</b>.
                <br />
                <br />
                <span className="text-purple-600">
                  <b>🎭 Modo TESTING</b>
                </span>
              </>
            ) : (
              <>
                Vamos a verificar tu <br />
                <b>ubicación</b> para{" "}
                <b>
                  registrar tu <br />
                  asistencia
                </b>
                . Asegúrate de <br />
                estar <b>dentro del colegio</b>.
              </>
            )
          ) : (
            <>
              Vamos a <b>registrar</b> tu <br />
              asistencia directamente.
              <br />
              <br />
              <span className="text-orange-600">
                <b>Validación GPS deshabilitada</b>
              </span>
            </>
          )}
        </p>

        <b>{modoRegistro}</b>

        <BotonConIcono
          className="bg-verde-principal text-blanco flex gap-3 px-4 py-2 rounded-md text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
          texto={
            estaProcessando
              ? REQUERIR_VALIDACION_GPS
                ? USAR_COORDENADAS_MOCKEADAS
                  ? "Usando GPS fake..."
                  : "Verificando ubicación..."
                : "Registrando asistencia..."
              : USAR_COORDENADAS_MOCKEADAS
              ? "🎭 Registrar (Modo Testing)"
              : "Registrar Asistencia"
          }
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
