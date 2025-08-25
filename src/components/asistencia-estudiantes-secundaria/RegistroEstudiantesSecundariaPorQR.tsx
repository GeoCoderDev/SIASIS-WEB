import React, { useState, useRef, useEffect, useCallback } from "react";
import { IDetectedBarcode, Scanner } from "@yudiel/react-qr-scanner";
import { BaseEstudiantesIDB } from "@/lib/utils/local/db/models/Estudiantes/EstudiantesBaseIDB";
import { decodificarCadenaQREstudiante } from "@/lib/helpers/generators/QR/generacionDeCadenaDeDatosDeEstudianteCodificada";
import { HandlerAuxiliarAsistenciaResponse } from "@/lib/utils/local/db/models/DatosAsistenciaHoy/handlers/HandlerAuxiliarAsistenciaResponse";

interface CamaraInfo {
  deviceId: string;
  label: string;
  tipo: "frontal" | "trasera" | "webcam" | "desconocida";
}

interface RegistroEstudiantesSecundariaPorQRProps {
  handlerAuxiliar?: HandlerAuxiliarAsistenciaResponse;
}

const RegistroEstudiantesSecundariaPorQR: React.FC<
  RegistroEstudiantesSecundariaPorQRProps
> = ({ handlerAuxiliar }) => {
  // Estados principales
  const [camarasDisponibles, setCamarasDisponibles] = useState<CamaraInfo[]>(
    []
  );
  const [camaraSeleccionada, setCamaraSeleccionada] = useState<string | null>(
    null
  );
  const [escaneando, setEscaneando] = useState(false);
  const [estudianteEscaneado, setEstudianteEscaneado] = useState<any>(null);
  const [errorEscaneo, setErrorEscaneo] = useState<string>("");
  const [estudiantesRegistrados, setEstudiantesRegistrados] = useState<
    Set<string>
  >(new Set());
  const [sistemaInicializado, setSistemaInicializado] =
    useState<boolean>(false);
  const [cargandoCamaras, setCargandoCamaras] = useState<boolean>(false);

  // Referencias
  const componenteMontadoRef = useRef(true);
  const timeoutRefs = useRef<NodeJS.Timeout[]>([]);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      componenteMontadoRef.current = false;
      timeoutRefs.current.forEach((timeout) => clearTimeout(timeout));
    };
  }, []);

  const [estudiantesIDB] = useState(() => new BaseEstudiantesIDB());

  // Función principal simplificada para obtener cámaras
  const inicializarSistemaCamaras = useCallback(async () => {
    if (cargandoCamaras) return;

    setCargandoCamaras(true);
    setErrorEscaneo("");
    setSistemaInicializado(false);

    try {
      // Verificar soporte del navegador
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Su navegador no soporta acceso a la cámara");
      }

      // Solicitar permisos si no los tenemos
      let needsPermission = true;
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter((d) => d.kind === "videoinput");
        needsPermission = cameras.length === 0 || !cameras.some((d) => d.label);
      } catch (error) {
        needsPermission = true;
      }

      if (needsPermission) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } },
          });
          stream.getTracks().forEach((track) => track.stop());
          await new Promise((resolve) => setTimeout(resolve, 300));
        } catch (error: any) {
          if (error.name === "NotAllowedError") {
            throw new Error(
              "Permisos de cámara denegados. Por favor, permita el acceso a la cámara."
            );
          } else if (error.name === "NotFoundError") {
            throw new Error("No se encontraron cámaras en este dispositivo.");
          } else if (error.name === "NotReadableError") {
            throw new Error("La cámara está siendo usada por otra aplicación.");
          }
          throw error;
        }
      }

      // Obtener dispositivos después de tener permisos
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter((d) => d.kind === "videoinput");

      if (cameras.length === 0) {
        throw new Error("No se encontraron cámaras en este dispositivo.");
      }

      // Formatear cámaras encontradas
      const camarasFormateadas: CamaraInfo[] = cameras.map((cam, i) => {
        let label = cam.label || `Cámara ${i + 1}`;
        let tipo: CamaraInfo["tipo"] = "desconocida";

        const labelLower = label.toLowerCase();
        if (
          labelLower.includes("back") ||
          labelLower.includes("rear") ||
          labelLower.includes("environment")
        ) {
          tipo = "trasera";
        } else if (
          labelLower.includes("front") ||
          labelLower.includes("user") ||
          labelLower.includes("selfie")
        ) {
          tipo = "frontal";
        } else if (
          labelLower.includes("webcam") ||
          labelLower.includes("usb")
        ) {
          tipo = "webcam";
        } else {
          const esMovil =
            /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
              navigator.userAgent
            );
          tipo = esMovil && i === 0 ? "trasera" : "webcam";
        }

        return {
          deviceId: cam.deviceId,
          label: label,
          tipo: tipo,
        };
      });

      // Actualizar estados
      setCamarasDisponibles(camarasFormateadas);

      // Auto-seleccionar la mejor cámara
      const camaraPreferida =
        camarasFormateadas.find((c) => c.tipo === "trasera") ||
        camarasFormateadas[0];
      setCamaraSeleccionada(camaraPreferida.deviceId);
      setSistemaInicializado(true);
    } catch (error: any) {
      let mensajeError = "Error desconocido al acceder a las cámaras";

      if (error.message) {
        mensajeError = error.message;
      }

      setErrorEscaneo(mensajeError);

      // En desarrollo, agregar cámaras de prueba
      if (process.env.NODE_ENV === "development") {
        const camarasPrueba: CamaraInfo[] = [
          {
            deviceId: "mock-trasera",
            label: "Cámara Trasera (Dev)",
            tipo: "trasera",
          },
          {
            deviceId: "mock-frontal",
            label: "Cámara Frontal (Dev)",
            tipo: "frontal",
          },
        ];
        setCamarasDisponibles(camarasPrueba);
        setCamaraSeleccionada(camarasPrueba[0].deviceId);
        setSistemaInicializado(true);
      }
    } finally {
      setCargandoCamaras(false);
    }
  }, [cargandoCamaras]);

  // Función para manejar el resultado del QR
  const handleQRResult = useCallback(
    async (detectedCodes: IDetectedBarcode[]) => {
      if (
        // !componenteMontadoRef.current ||
        !detectedCodes ||
        detectedCodes.length === 0
      ) {
        console.log("QUE PASOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO");
        return;
      }

      const ultimoQR = detectedCodes.at(-1);

      const studentData = decodificarCadenaQREstudiante(ultimoQR!.rawValue);

      const estudianteEncontrado =
        (await estudiantesIDB.getEstudiantePorId(
          studentData.identificadorEstudiante!
        )) ||
        (await estudiantesIDB.getEstudiantePorId(
          studentData.identificadorEstudiante!.split("-")[0]
        ));

      setEstudianteEscaneado(estudianteEncontrado);
      setEscaneando(false);
      setErrorEscaneo("");
    },
    []
  );

  // Función para manejar errores del scanner
  const handleQRError = useCallback((error: any) => {
    if (error && !error.message?.includes("No QR code found")) {
      console.warn("Scanner error:", error.message);
    }
  }, []);

  // Función para marcar asistencia
  const marcarAsistencia = (estudiante: any) => {
    const nuevosRegistrados = new Set(estudiantesRegistrados);
    nuevosRegistrados.add(estudiante.Id_Estudiante);
    setEstudiantesRegistrados(nuevosRegistrados);

    setEstudianteEscaneado(null);
    setEscaneando(true);
  };

  // Función para cambiar cámara
  const cambiarCamara = (deviceId: string) => {
    setCamaraSeleccionada(deviceId);
    setErrorEscaneo("");

    if (escaneando) {
      setEscaneando(false);
      const timeout = setTimeout(() => {
        if (componenteMontadoRef.current) {
          setEscaneando(true);
        }
      }, 100);
      timeoutRefs.current.push(timeout);
    }
  };

  // Función para alternar escáner
  const toggleScanner = () => {
    const nuevoEstado = !escaneando;
    setEscaneando(nuevoEstado);
    setErrorEscaneo("");
  };

  // Funciones auxiliares para UI
  const obtenerEmojiCamara = (tipo: CamaraInfo["tipo"]) => {
    switch (tipo) {
      case "frontal":
        return "🤳";
      case "trasera":
        return "📷";
      case "webcam":
        return "💻";
      default:
        return "📹";
    }
  };

  const obtenerDescripcionTipo = (tipo: CamaraInfo["tipo"]) => {
    switch (tipo) {
      case "frontal":
        return "Frontal";
      case "trasera":
        return "Trasera";
      case "webcam":
        return "Webcam";
      default:
        return "Cámara";
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel de cámara */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg border-2 border-blue-200 p-6">
            <h3 className="text-lg font-bold text-blue-800 mb-4">
              Escáner de Códigos QR
            </h3>

            {/* Scanner QR */}
            <div className="mb-4">
              <div className="w-full max-w-md mx-auto border-2 border-dashed border-gray-300 rounded-lg overflow-hidden">
                {escaneando && camaraSeleccionada && sistemaInicializado ? (
                  <Scanner
                    onScan={handleQRResult}
                    onError={handleQRError}
                    constraints={{
                      deviceId: camaraSeleccionada,
                      facingMode: undefined,
                    }}
                    scanDelay={200}
                    styles={{
                      container: {
                        width: "100%",
                        height: "auto",
                        minHeight: "300px",
                      },
                      video: {
                        width: "100%",
                        height: "auto",
                        objectFit: "cover",
                      },
                    }}
                    components={{ finder: true, zoom: true }}
                  />
                ) : (
                  <div className="w-full h-64 bg-gray-100 flex items-center justify-center">
                    <div className="text-center">
                      {cargandoCamaras ? (
                        <>
                          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-2"></div>
                          <span className="text-gray-500">
                            Detectando cámaras...
                          </span>
                        </>
                      ) : !sistemaInicializado ? (
                        <>
                          <span className="text-4xl mb-3 block">📷</span>
                          <span className="text-gray-700 block mb-3 font-medium">
                            Sistema de Escáner QR
                          </span>
                          <span className="text-gray-500 block mb-4 text-sm">
                            Para comenzar, inicialice el sistema de cámaras
                          </span>
                          <button
                            onClick={inicializarSistemaCamaras}
                            disabled={cargandoCamaras}
                            className="px-6 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
                          >
                            <span>🚀</span>
                            {cargandoCamaras
                              ? "Inicializando..."
                              : "Inicializar Sistema de Cámaras"}
                          </button>
                        </>
                      ) : camarasDisponibles.length === 0 ? (
                        <>
                          <span className="text-4xl mb-2 block">📷</span>
                          <span className="text-gray-500 block mb-2">
                            No se detectaron cámaras
                          </span>
                          <button
                            onClick={inicializarSistemaCamaras}
                            className="px-3 py-1 bg-orange-500 text-white rounded text-sm hover:bg-orange-600 transition-colors"
                          >
                            🔍 Buscar de nuevo
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="text-4xl mb-2 block">📱</span>
                          <span className="text-gray-500">
                            Presione iniciar para escanear
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Error */}
            {errorEscaneo && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 text-sm">⚠️ {errorEscaneo}</p>
                <button
                  onClick={inicializarSistemaCamaras}
                  className="mt-2 px-3 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                >
                  Intentar de nuevo
                </button>
              </div>
            )}

            {/* Cámaras disponibles */}
            {sistemaInicializado && camarasDisponibles.length > 0 && (
              <div className="mb-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-sm font-medium text-gray-700">
                    Cámaras disponibles ({camarasDisponibles.length}):
                  </h4>
                  <button
                    onClick={inicializarSistemaCamaras}
                    disabled={cargandoCamaras}
                    className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    🔄 {cargandoCamaras ? "Buscando..." : "Actualizar"}
                  </button>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {camarasDisponibles.map((camara, index) => (
                    <button
                      key={camara.deviceId}
                      onClick={() => cambiarCamara(camara.deviceId)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 ${
                        camaraSeleccionada === camara.deviceId
                          ? "bg-blue-500 text-white"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      }`}
                    >
                      <span className="text-base">
                        {obtenerEmojiCamara(camara.tipo)}
                      </span>
                      <div className="text-left">
                        <div className="font-medium">
                          {index + 1}. {obtenerDescripcionTipo(camara.tipo)}
                        </div>
                        <div className="text-xs opacity-75 max-w-32 truncate">
                          {camara.label}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Controles */}
            <div className="text-center">
              <button
                onClick={toggleScanner}
                disabled={
                  !camaraSeleccionada || cargandoCamaras || !sistemaInicializado
                }
                className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                  escaneando
                    ? "bg-red-500 hover:bg-red-600 text-white"
                    : "bg-green-500 hover:bg-green-600 text-white"
                } disabled:bg-gray-300 disabled:cursor-not-allowed`}
              >
                {escaneando ? "⏸️ Pausar Escáner" : "▶️ Iniciar Escáner"}
              </button>

              {!sistemaInicializado && (
                <p className="text-xs text-gray-600 mt-2">
                  Primero inicialice el sistema de cámaras para poder escanear
                </p>
              )}

              {escaneando && sistemaInicializado && (
                <p className="text-xs text-gray-600 mt-2">
                  Enfoque el código QR del estudiante hacia la cámara
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Panel de registro */}
        <div>
          <div className="bg-white rounded-lg border-2 border-green-200 p-6">
            <h3 className="text-lg font-bold text-green-800 mb-4">
              Registro de Asistencia
            </h3>

            {/* Estadísticas */}
            <div className="mb-4 p-3 bg-green-50 rounded-lg">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-700">
                  {estudiantesRegistrados.size}
                </div>
                <div className="text-sm text-green-600">
                  Estudiantes registrados
                </div>
              </div>
            </div>

            {/* Estudiante escaneado */}
            {estudianteEscaneado ? (
              <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                <div className="flex items-center mb-3">
                  <div className="w-12 h-12 rounded-full bg-gray-300 flex-shrink-0 mr-3 overflow-hidden">
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                      <span className="text-xs">📷</span>
                    </div>
                  </div>
                  <div>
                    <p className="font-bold text-green-800 text-sm">
                      {estudianteEscaneado.Nombres}{" "}
                      {estudianteEscaneado.Apellidos}
                    </p>
                    <p className="text-xs text-green-600">✅ QR Escaneado</p>
                    <p className="text-xs text-gray-500">
                      ID: {estudianteEscaneado.Id_Estudiante}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => marcarAsistencia(estudianteEscaneado)}
                    className="flex-1 bg-green-500 text-white py-2 rounded-lg font-medium hover:bg-green-600 transition-colors"
                  >
                    ✓ Confirmar Asistencia
                  </button>
                  <button
                    onClick={() => {
                      setEstudianteEscaneado(null);
                      setEscaneando(true);
                    }}
                    className="px-3 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                  >
                    ✕ Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500">
                {escaneando ? (
                  <>
                    <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-2"></div>
                    <p className="text-sm">Buscando códigos QR...</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Apunte la cámara hacia el código QR
                    </p>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 bg-gray-200 rounded-full mx-auto mb-2 flex items-center justify-center">
                      <span className="text-xl">📱</span>
                    </div>
                    <p className="text-sm">Escáner pausado</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Presione iniciar para comenzar
                    </p>
                  </>
                )}
              </div>
            )}

            {/* Información adicional */}
            {estudiantesRegistrados.size > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500 mb-1">
                  ✅ {estudiantesRegistrados.size} registro(s) completado(s)
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegistroEstudiantesSecundariaPorQR;
