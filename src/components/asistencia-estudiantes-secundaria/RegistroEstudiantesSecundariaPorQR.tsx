import React, { useState, useRef, useEffect, useCallback } from "react";
import { IDetectedBarcode, Scanner } from "@yudiel/react-qr-scanner";

interface CamaraInfo {
  deviceId: string;
  label: string;
  tipo: "frontal" | "trasera" | "webcam" | "desconocida";
}

interface RegistroEstudiantesSecundariaPorQRProps {
  handlerAuxiliar?: any;
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
      if (!detectedCodes || detectedCodes.length === 0) {
        console.log("QUE PASOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO");
        return;
      }

      const ultimoQR = detectedCodes.at(-1);

      // Simulación de estudiante escaneado para demo
      const estudianteDemo = {
        Id_Estudiante: "EST-" + Math.random().toString(36).substr(2, 9),
        Nombres: "Juan Carlos",
        Apellidos: "Pérez López",
      };

      setEstudianteEscaneado(estudianteDemo);
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
    <div className="max-w-6xl mx-auto p-3 sxs-only:p-2 xs-only:p-3 sm-only:p-4 md-only:p-5 lg-only:p-6 xl-only:p-6">
      {/* Layout para móviles: Stack vertical como antes */}
      <div className="sm:hidden flex flex-col gap-3 xs:gap-4">
        {/* Panel principal de cámara para móviles */}
        <div className="bg-white rounded-lg border-2 border-blue-200 p-3 xs:p-4 relative">
          <h3 className="text-base xs:text-lg font-bold text-blue-800 mb-2 xs:mb-3">
            <span className="hidden xs:inline">Escáner de Códigos QR</span>
            <span className="xs:hidden">Escáner QR</span>
          </h3>

          {/* Área de scanner con ancho reducido 15% más (era w-3/5, ahora w-1/2) */}
          <div className="mb-3 xs:mb-4 relative">
            <div className="w-1/2 max-w-xs mx-auto border-2 border-dashed border-gray-300 rounded-lg overflow-hidden">
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
                      minHeight: "140px",
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
                <div className="w-full h-28 xs:h-36 bg-gray-100 flex items-center justify-center">
                  <div className="text-center">
                    {cargandoCamaras ? (
                      <>
                        <div className="w-5 h-5 xs:w-6 xs:h-6 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-2"></div>
                        <span className="text-gray-500 text-xs">
                          <span className="hidden xs:inline">
                            Detectando...
                          </span>
                          <span className="xs:hidden">...</span>
                        </span>
                      </>
                    ) : !sistemaInicializado ? (
                      <>
                        <span className="text-xl xs:text-2xl mb-2 block">
                          📷
                        </span>
                        <span className="text-gray-700 block mb-2 font-medium text-xs">
                          <span className="hidden xs:inline">
                            Sistema de Escáner QR
                          </span>
                          <span className="xs:hidden">Escáner QR</span>
                        </span>
                        {/* Botón aumentado 10% para móviles */}
                        <button
                          onClick={inicializarSistemaCamaras}
                          disabled={cargandoCamaras}
                          className="px-3 py-2 xs:px-4 xs:py-2.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed text-xs"
                        >
                          <span>🚀</span>
                          <span className="hidden xs:inline ml-1">
                            Inicializar
                          </span>
                        </button>
                      </>
                    ) : camarasDisponibles.length === 0 ? (
                      <>
                        <span className="text-xl xs:text-2xl mb-2 block">
                          📷
                        </span>
                        <span className="text-gray-500 block mb-2 text-xs">
                          Sin cámaras
                        </span>
                        {/* Botón aumentado 10% para móviles */}
                        <button
                          onClick={inicializarSistemaCamaras}
                          className="px-3 py-1.5 xs:px-4 xs:py-2 bg-orange-500 text-white rounded text-xs hover:bg-orange-600 transition-colors"
                        >
                          🔍 Buscar
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="text-xl xs:text-2xl mb-2 block">
                          📱
                        </span>
                        <span className="text-gray-500 text-xs">
                          Presione iniciar
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Confirmador superpuesto para móviles - Ajustado para no desbordarse */}
            {estudianteEscaneado && (
              <div className="absolute inset-0 bg-white bg-opacity-95 backdrop-blur-sm rounded-lg flex items-center justify-center p-2">
                <div className="w-full max-w-xs bg-green-50 border-2 border-green-200 p-3 rounded-lg shadow-lg">
                  <div className="text-center mb-3">
                    <div className="w-10 h-10 rounded-full bg-gray-300 mx-auto mb-2 overflow-hidden">
                      <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                        <span className="text-sm">📷</span>
                      </div>
                    </div>
                    <p className="font-bold text-green-800 text-xs mb-1 leading-tight">
                      {estudianteEscaneado.Nombres}{" "}
                      {estudianteEscaneado.Apellidos}
                    </p>
                    <p className="text-[0.6rem] text-green-600 mb-1">
                      ✅ QR Escaneado
                    </p>
                    <p className="text-[0.6rem] text-gray-500 truncate">
                      ID: {estudianteEscaneado.Id_Estudiante}
                    </p>
                  </div>

                  <div className="flex gap-1.5">
                    {/* Botones aumentados 10% para móviles */}
                    <button
                      onClick={() => marcarAsistencia(estudianteEscaneado)}
                      className="flex-1 bg-green-500 text-white py-2.5 xs:py-3 rounded-lg font-medium hover:bg-green-600 transition-colors text-xs"
                    >
                      ✓ Confirmar
                    </button>
                    <button
                      onClick={() => {
                        setEstudianteEscaneado(null);
                        setEscaneando(true);
                      }}
                      className="px-4 xs:px-5 py-2.5 xs:py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors text-xs"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Selección de cámaras para móviles - Reducida 15% */}
          {sistemaInicializado && camarasDisponibles.length > 0 && (
            <div className="mb-2 xs:mb-3">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-xs font-medium text-gray-700">
                  <span className="hidden xs:inline">
                    Cámaras ({camarasDisponibles.length})
                  </span>
                  <span className="xs:hidden">Cámaras</span>
                </h4>
                {/* Botón actualizar aumentado 10% para móviles */}
                <button
                  onClick={inicializarSistemaCamaras}
                  disabled={cargandoCamaras}
                  className="px-2 xs:px-3 py-1.5 xs:py-2 bg-blue-500 text-white rounded text-[0.6rem] hover:bg-blue-600 disabled:bg-gray-300"
                >
                  <span className="hidden xs:inline">🔄</span>
                  <span className="xs:hidden">🔄</span>
                </button>
              </div>
              <select
                value={camaraSeleccionada || ""}
                onChange={(e) => cambiarCamara(e.target.value)}
                className="w-full p-2.5 xs:p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs bg-white"
              >
                <option value="">Seleccionar cámara</option>
                {camarasDisponibles.map((camara, index) => (
                  <option key={camara.deviceId} value={camara.deviceId}>
                    {obtenerEmojiCamara(camara.tipo)} {index + 1}.{" "}
                    {obtenerDescripcionTipo(camara.tipo)} - {camara.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Controles para móviles */}
          <div className="text-center">
            {/* Botón principal aumentado 10% para móviles */}
            <button
              onClick={toggleScanner}
              disabled={
                !camaraSeleccionada || cargandoCamaras || !sistemaInicializado
              }
              className={`px-4 py-2 xs:px-5 xs:py-2.5 rounded-lg font-medium transition-colors text-xs ${
                escaneando
                  ? "bg-red-500 hover:bg-red-600 text-white"
                  : "bg-green-500 hover:bg-green-600 text-white"
              } disabled:bg-gray-300 disabled:cursor-not-allowed`}
            >
              {escaneando ? "⏸️ Pausar" : "▶️ Iniciar"}
            </button>
          </div>
        </div>

        {/* Estadísticas compactas para móviles - Reducidas 15% */}
        <div className="bg-white rounded-lg border-2 border-green-200 p-2 xs:p-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-green-800 font-bold text-lg">
                {estudiantesRegistrados.size}
              </span>
              <span className="text-green-600 text-sm ml-2">
                estudiantes registrados
              </span>
            </div>
            <div className="text-xs text-gray-500">
              {escaneando ? "🔴 Escaneando..." : "⏸️ Pausado"}
            </div>
          </div>
        </div>
      </div>

      {/* Layout para pantallas SM+ : 3 secciones */}
      <div className="hidden sm:grid sm:grid-cols-3 gap-4 lg:gap-6">
        {/* Sección 1: Visualización de cámara + controles */}
        <div className="sm:col-span-2">
          <div className="bg-white rounded-lg border-2 border-blue-200 p-3 md:p-4 lg:p-5">
            <h3 className="text-lg font-bold text-blue-800 mb-3">
              Escáner de Códigos QR
            </h3>

            {/* Área de scanner con ancho reducido 15% (era w-3/5, ahora w-1/2) */}
            <div className="mb-3 relative">
              <div className="w-1/2 max-w-sm mx-auto border-2 border-dashed border-gray-300 rounded-lg overflow-hidden">
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
                        minHeight: "180px",
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
                  <div className="w-full h-40 md:h-48 bg-gray-100 flex items-center justify-center">
                    <div className="text-center">
                      {cargandoCamaras ? (
                        <>
                          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-3"></div>
                          <span className="text-gray-500 text-sm">
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
                            className="px-6 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2 mx-auto text-sm"
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

            {/* Controles */}
            <div className="text-center">
              <button
                onClick={toggleScanner}
                disabled={
                  !camaraSeleccionada || cargandoCamaras || !sistemaInicializado
                }
                className={`px-6 py-2 rounded-lg font-medium transition-colors text-sm ${
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

            {/* Error */}
            {errorEscaneo && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 text-sm">⚠️ {errorEscaneo}</p>
                <button
                  onClick={inicializarSistemaCamaras}
                  className="mt-2 px-3 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                >
                  Intentar de nuevo
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Sección 2: Registro de asistencia + Selección de cámaras */}
        <div className="space-y-3 lg:space-y-4">
          {/* Registro de Asistencia - Reducido 15% */}
          <div className="bg-white rounded-lg border-2 border-green-200 p-3 md:p-4 lg:p-5">
            <h3 className="text-lg font-bold text-green-800 mb-3">
              Registro de Asistencia
            </h3>

            {/* Estadísticas - Reducidas */}
            <div className="mb-3 p-2 bg-green-50 rounded-lg">
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
              <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                <div className="flex items-center mb-3">
                  <div className="w-12 h-12 rounded-full bg-gray-300 flex-shrink-0 mr-3 overflow-hidden">
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                      <span className="text-xs">📷</span>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-green-800 text-sm truncate">
                      {estudianteEscaneado.Nombres}{" "}
                      {estudianteEscaneado.Apellidos}
                    </p>
                    <p className="text-xs text-green-600">✅ QR Escaneado</p>
                    <p className="text-xs text-gray-500 truncate">
                      ID: {estudianteEscaneado.Id_Estudiante}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => marcarAsistencia(estudianteEscaneado)}
                    className="flex-1 bg-green-500 text-white py-2 rounded-lg font-medium hover:bg-green-600 transition-colors text-sm"
                  >
                    ✓ Confirmar Asistencia
                  </button>
                  <button
                    onClick={() => {
                      setEstudianteEscaneado(null);
                      setEscaneando(true);
                    }}
                    className="px-3 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors text-sm"
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
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  ✅ {estudiantesRegistrados.size} registro(s) completado(s)
                </p>
              </div>
            )}
          </div>

          {/* Selección de cámaras - Reducida 15% */}
          {sistemaInicializado && camarasDisponibles.length > 0 && (
            <div className="bg-white rounded-lg border-2 border-blue-200 p-3 md:p-4 lg:p-5">
              <div className="flex justify-between items-center mb-2">
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

              {/* Lista desplegable hasta XL (era lg:hidden, ahora xl:hidden) */}
              <div className="xl:hidden">
                <select
                  value={camaraSeleccionada || ""}
                  onChange={(e) => cambiarCamara(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs bg-white"
                >
                  <option value="">Seleccionar cámara</option>
                  {camarasDisponibles.map((camara, index) => (
                    <option key={camara.deviceId} value={camara.deviceId}>
                      {obtenerEmojiCamara(camara.tipo)} {index + 1}.{" "}
                      {obtenerDescripcionTipo(camara.tipo)} - {camara.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Botones amplios para XL (1600px+) */}
              <div className="hidden xl:grid xl:grid-cols-1 gap-2">
                {camarasDisponibles.map((camara, index) => (
                  <button
                    key={camara.deviceId}
                    onClick={() => cambiarCamara(camara.deviceId)}
                    className={`px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center gap-3 ${
                      camaraSeleccionada === camara.deviceId
                        ? "bg-blue-500 text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    <span className="text-lg flex-shrink-0">
                      {obtenerEmojiCamara(camara.tipo)}
                    </span>
                    <div className="text-left min-w-0 flex-1">
                      <div className="font-bold text-sm">
                        {index + 1}. {obtenerDescripcionTipo(camara.tipo)}
                      </div>
                      <div className="text-xs opacity-75 truncate">
                        {camara.label}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RegistroEstudiantesSecundariaPorQR;
