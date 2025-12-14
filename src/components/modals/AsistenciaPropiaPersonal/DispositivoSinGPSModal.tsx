import ModalContainer from "../ModalContainer";

const DispositivoSinGPSModal = ({
  eliminateModal,
}: {
  eliminateModal: () => void;
}) => {
  return (
    <ModalContainer eliminateModal={eliminateModal}>
      <div className="w-full overflow-x-hidden">
        <div className="w-full max-w-md px-4 py-6 sm:px-6 sm:py-8 mx-auto flex flex-col items-center justify-center gap-5">
          {/* You will add the image here */}
          <div className="w-[70px] xs:w-[85px] sm:w-[95px] h-auto bg-gray-200 rounded-lg flex items-center justify-center">
            🚫
          </div>

          <p className="text-center text-sm xs:text-base sm:text-lg leading-relaxed">
            Your device is <b>not compatible</b> <br />
            to register attendance.
            <br />
            <br />
            It does not have a <b>GPS component</b> <br />
            necessary to verify your <br />
            location.
            <br />
            <br />
            Contact the <b>director</b> to <br />
            obtain a compatible device.
          </p>
        </div>
      </div>
    </ModalContainer>
  );
};

export default DispositivoSinGPSModal;
