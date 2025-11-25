import React, { useState, useRef, useEffect, useCallback } from "react";
import { IDetectedBarcode, Scanner } from "@yudiel/react-qr-scanner";
import { decodificarCadenaQREstudiante } from "@/lib/helpers/generators/QR/generacionDeCadenaDeDatosDeEstudianteCodificada";
import { BaseEstudiantesIDB } from "@/lib/utils/local/db/models/Estudiantes/EstudiantesBaseIDB";
import { VIBRATIONS, vibrator } from "@/lib/utils/vibration/Vibrator";
import { Speaker } from "@/lib/utils/voice/Speaker";
import { obtenerNombreApellidoSimple } from "@/lib/helpers/formatters/personalData/nombres-apellidos";
import { saludosDia } from "@/Assets/voice/others/SaludosDelDia";
import { determinarPeriodoDia } from "@/lib/calc/determinarPeriodoDia";
import { FechaHoraActualRealState } from "@/global/state/others/fechaHoraActualReal";
import { dameCualquieraDeEstos } from "@/lib/helpers/randomizers/dameCualquieraDeEstos";
import { Asistencias_Escolares_QUEUE } from "@/lib/utils/queues/AsistenciasEscolaresQueue";
import { ActoresSistema } from "@/interfaces/shared/ActoresSistema";
import { EstudianteConAula } from "@/interfaces/shared/Estudiantes";
import { ModoRegistro } from "@/interfaces/shared/ModoRegistro";
import { TipoAsistencia } from "@/interfaces/shared/AsistenciaRequests";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";
import { BaseAulasIDB } from "@/lib/utils/local/db/models/Aulas/AulasBase";
import { HandlerAuxiliarAsistenciaResponse } from "@/lib/utils/local/db/models/DatosAsistenciaHoy/handlers/HandlerAuxiliarAsistenciaResponse";
import { HORAS_ANTES_SALIDA_CAMBIO_MODO_PARA_ESTUDIANTES_DE_SECUNDARIA } from "@/constants/INTERVALOS_ASISTENCIAS_ESCOLARES";
import { alterarUTCaZonaPeruana } from "@/lib/helpers/alteradores/alterarUTCaZonaPeruana";
import { CONTROL_ASISTENCIA_DE_SALIDA_SECUNDARIA } from "@/constants/ASISTENCIA_ENTRADA_SALIDA_ESCOLAR";
import FotoPerfilClientSide from "../utils/photos/FotoPerfilClientSide";
import { extraerTipoDeIdentificador } from "@/lib/helpers/extractors/extraerTipoDeIdentificador";
import { TiposIdentificadoresTextos } from "@/interfaces/shared/TiposIdentificadores";
import { extraerIdentificador } from "@/lib/helpers/extractors/extraerIdentificador";
import Play_1_Icon from "../icons/Play_1_Icon";
import Pause_1_Icon from "../icons/Pause_1_Icon";
import Actualizar_1_Icon from "../icons/Actualizar_1_Icon";
import EscanerQRIcon from "../icons/EscanerQRIcon";
import Camara_2_Icon from "../icons/Camara_2_Icon";
import { Search, SearchIcon } from "lucide-react";
import EsperandoIcon from "../icons/EsperandoIcon";

interface CamaraInfo {
  deviceId: string;
  label: string;
  tipo: "frontal" | "trasera" | "webcam" | "desconocida";
}

interface ErrorQR {
  mensaje: string;
  tipo: "decodificacion" | "estudiante_no_encontrado";
  identificadorEscaneado?: string;
}

interface RegistroEstudiantesSecundariaPorQRProps {
  handlerAuxiliar?: HandlerAuxiliarAsistenciaResponse;
  fechaHoraActual: FechaHoraActualRealState;
}

const RegistroEstudiantesSecundariaPorQR: React.FC<
  RegistroEstudiantesSecundariaPorQRProps
> = ({ handlerAuxiliar, fechaHoraActual }) => {
  // Main states
  const [camarasDisponibles, setCamarasDisponibles] = useState<CamaraInfo[]>(
    []
  );
  const [camaraSeleccionada, setCamaraSeleccionada] = useState<string | null>(
    null
  );
  const [escaneando, setEscaneando] = useState(false);

  // Separate states for student and errors
  const [estudianteEscaneado, setEstudianteEscaneado] =
    useState<EstudianteConAula | null>(null);
  const [errorQR, setErrorQR] = useState<ErrorQR | null>(null);
  const [errorEscaneo, setErrorEscaneo] = useState<string>("");

  const [estudiantesRegistrados, setEstudiantesRegistrados] = useState<
    Set<string>
  >(new Set());
  const [sistemaInicializado, setSistemaInicializado] =
    useState<boolean>(false);
  const [cargandoCamaras, setCargandoCamaras] = useState<boolean>(false);

  // References
  const componenteMontadoRef = useRef(true);
  const timeoutRefs = useRef<NodeJS.Timeout[]>([]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      componenteMontadoRef.current = false;
      timeoutRefs.current.forEach((timeout) => clearTimeout(timeout));
    };
  }, []);

  // Function to determine the current registration mode
  const determinarModoRegistro = (): ModoRegistro => {
    if (
      !CONTROL_ASISTENCIA_DE_SALIDA_SECUNDARIA ||
      !handlerAuxiliar ||
      !fechaHoraActual.fechaHora
    ) {
      return ModoRegistro.Entrada;
    }

    const horarioSecundaria = handlerAuxiliar.getHorarioEscolarSecundaria();
    const horaActual = new Date(fechaHoraActual.fechaHora);

    // Calculate the cutoff time (1 hour before official exit)
    const horaLimite = new Date(
      alterarUTCaZonaPeruana(String(horarioSecundaria.Fin))
    );
    horaLimite.setHours(
      horaLimite.getHours() -
        HORAS_ANTES_SALIDA_CAMBIO_MODO_PARA_ESTUDIANTES_DE_SECUNDARIA
    );

    return horaActual < horaLimite ? ModoRegistro.Entrada : ModoRegistro.Salida;
  };

  // Main simplified function to get cameras
  const inicializarSistemaCamaras = useCallback(async () => {
    if (cargandoCamaras) return;

    setCargandoCamaras(true);
    setErrorEscaneo("");
    setSistemaInicializado(false);

    try {
      // Check browser support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Your browser does not support camera access");
      }

      // Request permissions if we don't have them
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
              "Camera permissions denied. Please allow camera access."
            );
          } else if (error.name === "NotFoundError") {
            throw new Error("No cameras found on this device.");
          } else if (error.name === "NotReadableError") {
            throw new Error("The camera is being used by another application.");
          }
          throw error;
        }
      }

      // Get devices after having permissions
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter((d) => d.kind === "videoinput");

      if (cameras.length === 0) {
        throw new Error("No cameras found on this device.");
      }

      // Format found cameras
      const camarasFormateadas: CamaraInfo[] = cameras.map((cam, i) => {
        let label = cam.label || `Camera ${i + 1}`;
        let tipo: CamaraInfo["tipo"] = "unknown";

        const labelLower = label.toLowerCase();
        if (
          labelLower.includes("back") ||
          labelLower.includes("rear") ||
          labelLower.includes("environment")
        ) {
          tipo = "rear";
        } else if (
          labelLower.includes("front") ||
          labelLower.includes("user") ||
          labelLower.includes("selfie")
        ) {
          tipo = "front";
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
          tipo = esMovil && i === 0 ? "rear" : "webcam";
        }

        return {
          deviceId: cam.deviceId,
          label: label,
          tipo: tipo,
        };
      });

      // Update states
      setCamarasDisponibles(camarasFormateadas);

      // Auto-select the best camera
      const camaraPreferida =
        camarasFormateadas.find((c) => c.tipo === "rear") ||
        camarasFormateadas[0];
      setCamaraSeleccionada(camaraPreferida.deviceId);
      setSistemaInicializado(true);
    } catch (error: any) {
      let mensajeError = "Unknown error accessing cameras";

      if (error.message) {
        mensajeError = error.message;
      }

      setErrorEscaneo(mensajeError);

      // In development, add test cameras
      if (process.env.NODE_ENV === "development") {
        const camarasPrueba: CamaraInfo[] = [
          {
            deviceId: "mock-trasera",
            label: "Rear Camera (Dev)",
            tipo: "rear",
          },
          {
            deviceId: "mock-frontal",
            label: "Front Camera (Dev)",
            tipo: "front",
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

  // Function to handle QR result
  const handleQRResult = useCallback(
    async (detectedCodes: IDetectedBarcode[]) => {
      if (!detectedCodes || detectedCodes.length === 0) {
        return;
      }

      const ultimoQR = detectedCodes.at(-1);
      const studentData = decodificarCadenaQREstudiante(ultimoQR!.rawValue);

      // Check if there was an error in decoding
      if (!studentData.exito || studentData.error) {
        vibrator.vibrate(VIBRATIONS.LONG);
        const speaker = Speaker.getInstance();

        // Save decoding error
        setErrorQR({
          mensaje: studentData.error!,
          tipo: "decoding",
        });

        speaker.start(studentData.error!);
        setEscaneando(false);
        setErrorEscaneo("");
        return;
      }

      // If we got here, decoding was successful
      vibrator.vibrate(VIBRATIONS.SHORT);

      const speaker = Speaker.getInstance();
      const estudiantesIDB = new BaseEstudiantesIDB();
      const aulasIDB = new BaseAulasIDB();

      // Search for the student in the local database
      const estudianteEncontrado =
        (await estudiantesIDB.getEstudiantePorId(
          studentData.identificadorEstudiante!
        )) ||
        (await estudiantesIDB.getEstudiantePorId(
          studentData.identificadorEstudiante!.split("-")[0]
        ));

      if (!estudianteEncontrado) {
        vibrator.vibrate(VIBRATIONS.MEDIUM);

        // Save student not found error
        setErrorQR({
          mensaje: "The student is not found in today's list",
          tipo: "student_not_found",
          identificadorEscaneado: studentData.identificadorEstudiante,
        });

        speaker.start("The student is not found in today's list");
        setEscaneando(false);
        setErrorEscaneo("");
        return;
      }

      // All successful - save valid student
      const periodoDelDia = determinarPeriodoDia(
        fechaHoraActual.fechaHora || new Date().toISOString()
      );
      const saludo = saludosDia[periodoDelDia];

      speaker.start(
        `${obtenerNombreApellidoSimple(
          estudianteEncontrado.Nombres,
          estudianteEncontrado.Apellidos
        )}, ${dameCualquieraDeEstos(saludo, "Hello", "Good morning", "Come in")}`
      );

      const estudianteEncontradoConAula =
        await aulasIDB.obtenerEstudianteConAula(estudianteEncontrado);

      setEstudianteEscaneado(estudianteEncontradoConAula);
      setEscaneando(false);
      setErrorEscaneo("");
    },
    [fechaHoraActual]
  );

  // Function to handle scanner errors
  const handleQRError = useCallback((error: any) => {
    if (error && !error.message?.includes("No QR code found")) {
      console.warn("Scanner error:", error.message);
    }
  }, []);

  // Function to mark attendance - WITH SCHEDULE CONTROL
  const marcarAsistencia = (estudiante: EstudianteConAula) => {
    if (!handlerAuxiliar || !fechaHoraActual.fechaHora) {
      console.error(
        "Cannot mark attendance: handler data or current date missing"
      );
      return;
    }

    const horarioSecundaria = handlerAuxiliar.getHorarioEscolarSecundaria();
    const horaActual = new Date(fechaHoraActual.fechaHora);
    const horaEntradaOficial = new Date(
      alterarUTCaZonaPeruana(String(horarioSecundaria.Inicio))
    );
    const horaSalidaOficial = new Date(
      alterarUTCaZonaPeruana(String(horarioSecundaria.Fin))
    );

    let modoRegistro: ModoRegistro;
    let desfaseSegundos: number;

    if (CONTROL_ASISTENCIA_DE_SALIDA_SECUNDARIA) {
      // Original logic with entry/exit
      const horaLimite = new Date(horaSalidaOficial);
      horaLimite.setHours(
        horaLimite.getHours() -
          HORAS_ANTES_SALIDA_CAMBIO_MODO_PARA_ESTUDIANTES_DE_SECUNDARIA
      );

      modoRegistro =
        horaActual < horaLimite ? ModoRegistro.Entrada : ModoRegistro.Salida;

      if (modoRegistro === ModoRegistro.Entrada) {
        desfaseSegundos = Math.floor(
          (horaActual.getTime() - horaEntradaOficial.getTime()) / 1000
        );
      } else {
        desfaseSegundos = Math.floor(
          (horaActual.getTime() - horaSalidaOficial.getTime()) / 1000
        );
      }
    } else {
      // Only entry, always calculate offset with entry time
      modoRegistro = ModoRegistro.Entrada;
      desfaseSegundos = Math.floor(
        (horaActual.getTime() - horaEntradaOficial.getTime()) / 1000
      );
    }

    // Debug to verify calculations
    console.log("🕒 ATTENDANCE CALCULATION DEBUG:");
    console.log(
      "Entry/exit schedule control:",
      CONTROL_ASISTENCIA_DE_SALIDA_SECUNDARIA
    );
    console.log("Current time:", horaActual.toLocaleString("en-US"));
    console.log(
      "Determined mode:",
      modoRegistro === ModoRegistro.Entrada ? "ENTRY" : "EXIT"
    );
    console.log("Calculated offset:", desfaseSegundos, "seconds");

    Asistencias_Escolares_QUEUE.enqueue({
      Id_Estudiante: estudiante.Id_Estudiante,
      Actor: ActoresSistema.Estudiante,
      desfaseSegundosAsistenciaEstudiante: desfaseSegundos,
      NivelDelEstudiante: estudiante.aula!.Nivel as NivelEducativo,
      Grado: estudiante.aula!.Grado,
      Seccion: estudiante.aula!.Seccion,
      ModoRegistro: modoRegistro,
      TipoAsistencia: TipoAsistencia.ParaEstudiantesSecundaria,
    });

    const nuevosRegistrados = new Set(estudiantesRegistrados);
    nuevosRegistrados.add(estudiante.Id_Estudiante);
    setEstudiantesRegistrados(nuevosRegistrados);

    // Clear states and continue
    setEstudianteEscaneado(null);
    setErrorQR(null);
    setEscaneando(true);
  };

  // Function to restart scanner after error
  const reiniciarEscaner = () => {
    setEstudianteEscaneado(null);
    setErrorQR(null);
    setEscaneando(true);
  };

  // Function to cancel scanner
  const cancelarEscaner = () => {
    setEstudianteEscaneado(null);
    setErrorQR(null);
    setEscaneando(false);
  };

  // Function to change camera
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

  // Function to toggle scanner
  const toggleScanner = () => {
    const nuevoEstado = !escaneando;
    setEscaneando(nuevoEstado);
    setErrorEscaneo("");
  };

  // Auxiliary functions for UI
  const obtenerEmojiCamara = (tipo: CamaraInfo["tipo"]) => {
    switch (tipo) {
      case "front":
        return "🤳";
      case "rear":
        return "📷";
      case "webcam":
        return "💻";
      default:
        return "📹";
    }
  };

  const obtenerDescripcionTipo = (tipo: CamaraInfo["tipo"]) => {
    switch (tipo) {
      case "front":
        return "Frontal";
      case "rear":
        return "Rear";
      case "webcam":
        return "Webcam";
      default:
        return "Camera";
    }
  };

  // Function to get button text and style according to mode
  const obtenerConfiguracionBoton = () => {
    if (!CONTROL_ASISTENCIA_DE_SALIDA_SECUNDARIA) {
      return {
        texto: "Confirm",
        colorClass: "bg-green-500 hover:bg-green-600",
      };
    }

    const modoActual = determinarModoRegistro();
    if (modoActual === ModoRegistro.Entrada) {
      return {
        texto: "Confirm Entry",
        colorClass: "bg-green-500 hover:bg-green-600",
      };
    } else {
      return {
        texto: "Confirm Exit",
        colorClass: "bg-red-500 hover:bg-red-600",
      };
    }
  };

  // Component to display QR errors
  const ErrorQRDisplay = ({ error }: { error: ErrorQR }) => (
    <div className="w-full max-w-xs bg-red-50 border-2 border-red-200 p-3 rounded-lg shadow-lg">
      <div className="text-center mb-3">
        <div className="w-10 h-10 rounded-full bg-red-100 mx-auto mb-2 flex items-center justify-center">
          <span className="text-red-600 text-lg">⚠️</span>
        </div>
        <p className="font-bold text-red-800 text-xs mb-1 leading-tight">
          QR Error
        </p>
        <p className="text-[0.6rem] text-red-600 mb-1 leading-tight">
          {error.mensaje}
        </p>
      </div>

      <div className="flex gap-1.5">
        <button
          onClick={reiniciarEscaner}
          className="flex-1 bg-blue-500 text-white py-2.5 xs:py-3 rounded-lg font-medium hover:bg-blue-600 transition-colors text-xs flex items-center justify-center gap-2"
        >
          <Actualizar_1_Icon className="w-4" /> Try again
        </button>
        <button
          onClick={cancelarEscaner}
          className="px-4 xs:px-5 py-2.5 xs:py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors text-xs"
        >
          ✕
        </button>
      </div>
    </div>
  );

  // Component to display valid student
  const EstudianteDisplay = ({
    estudiante,
  }: {
    estudiante: EstudianteConAula;
  }) => {
    const configuracionBoton = obtenerConfiguracionBoton();

    return (
      <div className="w-full max-w-xs bg-green-50 border-2 border-green-200 p-3 rounded-lg shadow-lg">
        <div className="text-center mb-3">
          <div className="w-10 h-10 rounded-full bg-gray-300 mx-auto mb-2 overflow-hidden">
            <div className="w-full h-full bg-gray-200 flex items-center justify-center">
              <FotoPerfilClientSide
                className="w-full h-full bg-gray-200 flex items-center justify-center object-cover"
                Google_Drive_Foto_ID={
                  estudiante.Google_Drive_Foto_ID
                }
              />
            </div>
          </div>
          <p className="font-bold text-green-800 text-xs mb-1 leading-tight">
            {estudiante.Nombres} {estudiante.Apellidos}
          </p>
          <p className="text-[0.6rem] text-green-600 mb-1">✅ QR Scanned</p>
          <p className="text-[0.6rem] text-gray-500 truncate">
            {
              TiposIdentificadoresTextos[
                extraerTipoDeIdentificador(estudiante.Id_Estudiante)
              ]
            }
            : {extraerIdentificador(estudiante.Id_Estudiante)}
          </p>
        </div>

        <div className="flex gap-1.5">
          {(() => {
            const configuracionBoton = obtenerConfiguracionBoton();
            return (
              <button
                onClick={() => marcarAsistencia(estudiante)}
                className={`flex-1 text-white py-2 rounded-lg font-medium transition-colors text-sm ${configuracionBoton.colorClass}`}
              >
                ✓ {configuracionBoton.texto}
              </button>
            );
          })()}
          <button
            onClick={reiniciarEscaner}
            className="px-3 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors text-sm"
          >
            ✕ Cancel
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-3 sxs-only:p-2 xs-only:p-3 sm-only:p-4 md-only:p-5 lg-only:p-6 xl-only:p-6">
      {/* Mobile layout: Vertical stack as before */}
      <div className="sm:hidden flex flex-col gap-3 xs:gap-4">
        {/* Main camera panel for mobiles */}
        <div className="bg-white rounded-lg border-2 border-blue-200 p-3 xs:p-4 relative">
          <h3 className="text-base xs:text-lg font-bold text-blue-800 mb-2 xs:mb-3">
            <span className="hidden xs:inline">QR Code Scanner</span>
            <span className="xs:hidden">QR Scanner</span>
          </h3>

          {/* Scanner area */}
          <div className="mb-3 xs:mb-4 relative">
            <div className="w-[70%] max-w-xs mx-auto border-2 border-dashed border-gray-300 rounded-lg overflow-hidden">
              {escaneando && camaraSeleccionada && sistemaInicializado ? (
                <Scanner
                  sound={false}
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
                  <div className="text-center flex items-center justify-center flex-col">
                    {cargandoCamaras ? (
                      <>
                        <div className="w-5 h-5 xs:w-6 xs:h-6 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-2"></div>
                        <span className="text-gray-500 text-xs">
                          <span className="hidden xs:inline">
                            Detecting...
                          </span>
                          <span className="xs:hidden">...</span>
                        </span>
                      </>
                    ) : !sistemaInicializado ? (
                      <>
                        <span className="text-xl xs:text-2xl mb-2 block">
                          <Camara_2_Icon className="w-6 h-6 xs:w-8 xs:h-8 mx-auto" />
                        </span>
                        <span className="text-gray-700 block mb-2 font-medium text-xs">
                          <span className="hidden xs:inline">
                            QR Scanner System
                          </span>
                          <span className="xs:hidden">QR Scanner</span>
                        </span>
                        <button
                          onClick={inicializarSistemaCamaras}
                          disabled={cargandoCamaras}
                          className="px-3 py-2 xs:px-4 xs:py-2.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed text-xs"
                        >
                          <SearchIcon className="w-4 xs:w-5 inline" />
                          <span className="hidden xs:inline ml-1">
                            Detect Cameras
                          </span>
                        </button>
                      </>
                    ) : camarasDisponibles.length === 0 ? (
                      <>
                        <span className="text-xl xs:text-2xl mb-2 block">
                          📷
                        </span>
                        <span className="text-gray-500 block mb-2 text-xs">
                          No cameras
                        </span>
                        <button
                          onClick={inicializarSistemaCamaras}
                          className="px-3 py-1.5 xs:px-4 xs:py-2 bg-orange-500 text-white rounded text-xs hover:bg-orange-600 transition-colors"
                        >
                          🔍 Search again
                        </button>
                      </>
                    ) : (
                      <>
                        <EsperandoIcon className="w-6 xs:w-8" />
                        <span className="text-gray-500 text-xs mt-2">
                          Press the start button
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Overlay to show student or error */}
            {(estudianteEscaneado || errorQR) && (
              <div className="absolute inset-0 bg-white bg-opacity-95 backdrop-blur-sm rounded-lg flex items-center justify-center p-2">
                {errorQR ? (
                  <ErrorQRDisplay error={errorQR} />
                ) : estudianteEscaneado ? (
                  <EstudianteDisplay estudiante={estudianteEscaneado} />
                ) : null}
              </div>
            )}
          </div>

          {/* Camera selection for mobiles */}
          {sistemaInicializado && camarasDisponibles.length > 0 && (
            <div className="mb-2 xs:mb-3">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-xs font-medium text-gray-700">
                  <span className="hidden xs:inline">
                    Cameras ({camarasDisponibles.length})
                  </span>
                  <span className="xs:hidden">Cameras</span>
                </h4>
                <button
                  onClick={inicializarSistemaCamaras}
                  disabled={cargandoCamaras}
                  className="px-2 xs:px-3 py-1.5 xs:py-2 bg-blue-500 text-white rounded text-[0.6rem] hover:bg-blue-600 disabled:bg-gray-300"
                >
                  <Actualizar_1_Icon className="w-4" />
                </button>
              </div>
              <select
                value={camaraSeleccionada || ""}
                onChange={(e) => cambiarCamara(e.target.value)}
                className="w-full p-2.5 xs:p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs bg-white"
              >
                <option value="">Select camera</option>
                {camarasDisponibles.map((camara, index) => (
                  <option key={camara.deviceId} value={camara.deviceId}>
                    {obtenerEmojiCamara(camara.tipo)} {index + 1}.{" "}
                    {obtenerDescripcionTipo(camara.tipo)} - {camara.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Controls for mobiles */}
          <div className="text-center flex flex-col items-center justify-center">
            <button
              onClick={toggleScanner}
              disabled={
                !camaraSeleccionada || cargandoCamaras || !sistemaInicializado
              }
              className={`px-4 py-2 xs:px-5 xs:py-2.5 rounded-lg font-medium transition-colors text-xs w-max flex items-center justify-center gap-2 ${
                escaneando
                  ? "bg-red-500 hover:bg-red-600 text-white"
                  : "bg-green-500 hover:bg-green-600 text-white"
              } disabled:bg-gray-300 disabled:cursor-not-allowed`}
            >
              {escaneando ? (
                <>
                  <Pause_1_Icon className="w-4 xs:w-5 inline" /> Pause
                </>
              ) : (
                <>
                  <Play_1_Icon className="w-4 xs:w-5 inline" /> Start
                </>
              )}
            </button>
          </div>
        </div>

        {/* Compact statistics for mobiles */}
        <div className="bg-white rounded-lg border-2 border-green-200 p-2 xs:p-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-green-800 font-bold text-lg">
                {estudiantesRegistrados.size}
              </span>
              <span className="text-green-600 text-sm ml-2">
                students registered
              </span>
            </div>
            <div className="text-xs text-gray-500 flex items-center justify-center gap-1.5">
              {escaneando ? (
                "🔴 Scanning..."
              ) : (
                <>
                  <Pause_1_Icon className="w-4 xs:w-5 inline" /> Paused
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Layout for SM+ screens */}
      <div className="hidden sm:grid sm:grid-cols-3 gap-4 lg:gap-6">
        {/* Section 1: Camera display + controls */}
        <div className="sm:col-span-2">
          <div className="bg-white rounded-lg border-2 border-blue-200 p-3 md:p-4 lg:p-5">
            <h3 className="text-lg font-bold text-blue-800 mb-3">
              QR Code Scanner
            </h3>

            {/* Scanner area */}
            <div className="mb-3 relative">
              <div className="w-[60%] max-w-sm mx-auto border-2 border-dashed border-gray-300 rounded-lg overflow-hidden">
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
                  <div className="w-full  h-44 md:h-48 bg-gray-100 flex items-center justify-center">
                    <div className="flex flex-col items-center justify-center ">
                      {cargandoCamaras ? (
                        <>
                          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-3"></div>
                          <span className="text-gray-500 text-sm">
                            Detecting cameras...
                          </span>
                        </>
                      ) : !sistemaInicializado ? (
                        <>
                          <Camara_2_Icon className="w-8" />
                          <span className="text-gray-700 block mb-3 font-medium">
                            QR Scanner System
                          </span>
                          <span className="text-gray-500 block mb-4 text-sm">
                            To start, detect your device's cameras
                          </span>
                          <button
                            onClick={inicializarSistemaCamaras}
                            disabled={cargandoCamaras}
                            className="px-6 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2 mx-auto text-sm"
                          >
                            <SearchIcon className="w-5" />
                            {cargandoCamaras
                              ? "Detecting..."
                              : "Detect Cameras"}
                          </button>
                        </>
                      ) : camarasDisponibles.length === 0 ? (
                        <>
                          <span className="text-4xl mb-2 block">📷</span>
                          <span className="text-gray-500 block mb-2">
                            No cameras detected
                          </span>
                          <button
                            onClick={inicializarSistemaCamaras}
                            className="px-3 py-1 bg-orange-500 text-white rounded text-sm hover:bg-orange-600 transition-colors"
                          >
                            🔍 Search again
                          </button>
                        </>
                      ) : (
                        <>
                          <EsperandoIcon className="w-12" />

                          <span className="text-gray-500 mt-2">
                            Press the <b>start button</b> to scan
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="text-center flex flex-col items-center justify-center">
              <button
                onClick={toggleScanner}
                disabled={
                  !camaraSeleccionada || cargandoCamaras || !sistemaInicializado
                }
                className={`flex justify-center w-max items-center px-6 py-2 rounded-lg font-medium transition-colors gap-1.5 flex-wrap text-sm ${
                  escaneando
                    ? "bg-red-500 hover:bg-red-600 text-white"
                    : "bg-green-500 hover:bg-green-600 text-white"
                } disabled:bg-gray-300 disabled:cursor-not-allowed`}
              >
                {escaneando ? (
                  <>
                    <Pause_1_Icon className="w-5" /> Pause Scanner
                  </>
                ) : (
                  <>
                    <Play_1_Icon className="w-5" /> Start Scanner
                  </>
                )}
              </button>

              {!sistemaInicializado && (
                <p className="text-xs text-gray-600 mt-2">
                  First initialize the camera system to scan
                </p>
              )}

              {escaneando && sistemaInicializado && (
                <p className="text-xs text-gray-600 mt-2">
                  Point the camera at the student's QR code
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
                  Try again
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Attendance registration + Camera selection */}
        <div className="space-y-3 lg:space-y-4">
          {/* Attendance Registration */}
          <div className="bg-white rounded-lg border-2 border-green-200 p-3 md:p-4 lg:p-5">
            <h3 className="text-lg font-bold text-green-800 mb-3">
              Attendance Registration
            </h3>

            {/* Statistics */}
            <div className="mb-3 p-2 bg-green-50 rounded-lg">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-700">
                  {estudiantesRegistrados.size}
                </div>
                <div className="text-sm text-green-600">
                  Students registered
                </div>
              </div>
            </div>

            {/* Show student or error */}
            {errorQR ? (
              <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
                <div className="flex items-center mb-3">
                  <div className="w-12 h-12 rounded-full bg-red-100 flex-shrink-0 mr-3 flex items-center justify-center">
                    <span className="text-red-600 text-lg">⚠️</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-red-800 text-sm">
                      QR Error
                    </p>
                    <p className="text-xs text-red-600 mb-1">
                      {errorQR.mensaje}
                    </p>
                    {errorQR.identificadorEscaneado && (
                      <p className="text-xs text-gray-500 truncate">
                        ID: {errorQR.identificadorEscaneado}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={reiniciarEscaner}
                    className="flex-1 bg-blue-500 text-white py-2 rounded-lg font-medium hover:bg-blue-600 transition-colors text-sm flex items-center justify-center gap-2"
                  >
                    <Actualizar_1_Icon className="w-4" /> Try again
                  </button>
                  <button
                    onClick={cancelarEscaner}
                    className="px-3 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors text-sm"
                  >
                    ✕ Cancel
                  </button>
                </div>
              </div>
            ) : estudianteEscaneado ? (
              <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                <div className="flex items-center mb-3">
                  <div className="w-12 h-12 rounded-full bg-gray-300 flex-shrink-0 mr-3 overflow-hidden">
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                      <FotoPerfilClientSide
                        className="w-full h-full bg-gray-200 flex items-center justify-center object-cover"
                        Google_Drive_Foto_ID={
                          estudianteEscaneado.Google_Drive_Foto_ID
                        }
                      />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-green-800 text-sm truncate">
                      {estudianteEscaneado.Nombres}{" "}
                      {estudianteEscaneado.Apellidos}
                    </p>
                    <p className="text-xs text-green-600">✅ QR Scanned</p>
                    <p className="text-xs text-gray-500 truncate">
                      {
                        TiposIdentificadoresTextos[
                          extraerTipoDeIdentificador(
                            estudianteEscaneado.Id_Estudiante
                          )
                        ]
                      }
                      :{" "}
                      {extraerIdentificador(estudianteEscaneado.Id_Estudiante)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {(() => {
                    const configuracionBoton = obtenerConfiguracionBoton();
                    return (
                      <button
                        onClick={() => marcarAsistencia(estudianteEscaneado)}
                        className={`flex-1 text-white py-2 rounded-lg font-medium transition-colors text-sm ${configuracionBoton.colorClass}`}
                      >
                        ✓ {configuracionBoton.texto}
                      </button>
                    );
                  })()}
                  <button
                    onClick={reiniciarEscaner}
                    className="px-3 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors text-sm"
                  >
                    ✕ Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500">
                {escaneando ? (
                  <>
                    <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-2"></div>
                    <p className="text-sm">Searching for QR codes...</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Point the camera at the QR code
                    </p>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 bg-gray-200 rounded-full mx-auto mb-2 flex items-center justify-center">
                      <EscanerQRIcon className="w-6 text-gray-400" />
                    </div>
                    <p className="text-sm"> Scanner paused</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Press start to begin
                    </p>
                  </>
                )}
              </div>
            )}

            {/* Additional information */}
            {estudiantesRegistrados.size > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  ✅ {estudiantesRegistrados.size} registration(s) completed
                </p>
              </div>
            )}
          </div>

          {/* Camera selection */}
          {sistemaInicializado && camarasDisponibles.length > 0 && (
            <div className="bg-white rounded-lg border-2 border-blue-200 p-3 md:p-4 lg:p-5">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-sm font-medium text-gray-700">
                  Available cameras ({camarasDisponibles.length}):
                </h4>
                <button
                  onClick={inicializarSistemaCamaras}
                  disabled={cargandoCamaras}
                  className="px-2 py-1.5 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex w-max items-center justify-center gap-1.5 flex-wrap"
                >
                  <Actualizar_1_Icon className="w-3.5" />{" "}
                  {cargandoCamaras ? "Searching..." : "Update"}
                </button>
              </div>

              {/* Dropdown list up to XL */}
              <div className="xl:hidden">
                <select
                  value={camaraSeleccionada || ""}
                  onChange={(e) => cambiarCamara(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs bg-white"
                >
                  <option value="">Select camera</option>
                  {camarasDisponibles.map((camara, index) => (
                    <option key={camara.deviceId} value={camara.deviceId}>
                      {obtenerEmojiCamara(camara.tipo)} {index + 1}.{" "}
                      {obtenerDescripcionTipo(camara.tipo)} - {camara.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Wide buttons for XL */}
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