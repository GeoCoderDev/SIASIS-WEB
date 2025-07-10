import ModalContainer from "../ModalContainer";
import {
  ModoRegistro,
  modoRegistroTextos,
} from "@/interfaces/shared/ModoRegistroPersonal";

interface ConfirmacionAsistenciaMarcadaModalProps {
  eliminateModal: () => void;
  fechaHoraRegistro: Date | null;
  tipoRegistro: ModoRegistro | null;
}

const ConfirmacionAsistenciaMarcadaModal = ({
  eliminateModal,
  fechaHoraRegistro,
  tipoRegistro,
}: ConfirmacionAsistenciaMarcadaModalProps) => {
  // Función para formatear la fecha y hora
  const formatearFechaHora = (fecha: Date): string => {
    const opciones: Intl.DateTimeFormatOptions = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Lima",
    };

    return fecha.toLocaleDateString("es-PE", opciones);
  };

  // Función para obtener texto del tipo de registro
  const obtenerTextoRegistro = (): string => {
    if (!tipoRegistro) return "asistencia";
    return modoRegistroTextos[tipoRegistro].toLowerCase();
  };

  // Obtener fecha formateada
  const fechaFormateada = fechaHoraRegistro
    ? formatearFechaHora(fechaHoraRegistro)
    : "fecha no disponible";

  return (
    <ModalContainer className="z-[1201]" eliminateModal={eliminateModal}>
      <div className="w-full overflow-x-hidden">
        <div className="w-full max-w-md px-4 py-6 sm:px-6 sm:py-8 mx-auto flex flex-col items-center justify-center gap-5">
          <img
            src="/images/svg/Asistencia/ConfirmacionDeAsistencia.svg"
            alt="Confirmación de asistencia"
            className="w-[70px] xs:w-[85px] sm:w-[95px] h-auto object-contain"
          />

          <div className="text-center">
            <p className="text-sm xs:text-base sm:text-lg leading-relaxed mb-4">
              Tu <b>{obtenerTextoRegistro()}</b> ha sido <br />
              registrada correctamente.
            </p>

            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
              <p className="text-xs xs:text-sm text-green-700 font-medium mb-1">
                📅 Fecha y hora de registro:
              </p>
              <p className="text-sm xs:text-base font-bold text-green-800">
                {fechaFormateada}
              </p>
            </div>

            <p className="text-sm xs:text-base text-gray-600">
              ¡Gracias por registrar tu {obtenerTextoRegistro()}!
            </p>
          </div>
        </div>
      </div>
    </ModalContainer>
  );
};

export default ConfirmacionAsistenciaMarcadaModal;
