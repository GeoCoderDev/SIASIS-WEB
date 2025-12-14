import ModalContainer from "../ModalContainer";

const UbicacionFueraDelColegioAlRegistrarAsistenciaPropiaModal = ({
  eliminateModal,
}: {
  eliminateModal: () => void;
}) => {
  return (
    <ModalContainer eliminateModal={eliminateModal}>
      <div className="w-full overflow-x-hidden">
        <div className="w-full max-w-md px-4 py-6 sm:px-6 sm:py-8 mx-auto flex flex-col items-center justify-center gap-5">
          <img
            src="\images\svg\Asistencia\UbicacionColegioAsistencia.svg"
            alt="School Location"
            className="w-[70px] xs:w-[85px] sm:w-[95px] h-auto object-contain"
          />

          <p className="text-center text-sm xs:text-base sm:text-lg leading-relaxed">
            It seems you are not <br />
            inside the school. <br /> You can only register <br />
            your attendance when <br /> you are at school.
          </p>
        </div>
      </div>
    </ModalContainer>
  );
};

export default UbicacionFueraDelColegioAlRegistrarAsistenciaPropiaModal;
