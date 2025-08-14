import { NivelEducativoTextos } from "@/Assets/NivelEducativoTextos";
import CamaraIcon from "@/components/icons/CamaraIcon";
import LibretaConLapiz from "@/components/icons/LibretaConLapiz";
import QRIcon from "@/components/icons/QRIcon";
import FotoPerfilClientSide from "@/components/utils/photos/FotoPerfilClientSide";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";
import { RelacionesEstudianteResponsable } from "@/interfaces/shared/RelacionesEstudianteResponsable";
import { TiposIdentificadoresTextos } from "@/interfaces/shared/TiposIdentificadores";
import { extraerIdentificador } from "@/lib/helpers/extractors/extraerIdentificador";
import { extraerTipoDeIdentificador } from "@/lib/helpers/extractors/extraerTipoDeIdentificador";
import { EstudianteDelResponsableConAula } from "../page";
import { useState } from "react";
import GeneradorDeTarjetaQRDeEstudianteParaResponsablesModal from "@/components/modals/QR/GeneradorDeQRParaResponsablesModal";

const MiEstudianteRelacionadoCard = ({
  miEstudianteRelacionado,
}: {
  miEstudianteRelacionado: EstudianteDelResponsableConAula;
}) => {
  const [showCambiarFotoPerfilModal, setShowCambiarFotoPerfilModal] = useState<
    string | null
  >(null);
  const [showGenerarQRDelEstudianteModal, setShowGenerarQRDelEstudianteModal] =
    useState<string | null>(null);

  const {
    Id_Estudiante,
    Nombres,
    Apellidos,
    Estado,
    Google_Drive_Foto_ID,
    aula,
    Tipo_Relacion,
  } = miEstudianteRelacionado;

  return (
    <>
      {showGenerarQRDelEstudianteModal && (
        <GeneradorDeTarjetaQRDeEstudianteParaResponsablesModal
          estudianteDelResponsableConAula={miEstudianteRelacionado}
          eliminarModal={() => setShowGenerarQRDelEstudianteModal(null)}
        />
      )}
      <div
        className={`
        overflow-hidden relative siasis-shadow-card [cursor:default_!important] 
        flex flex-col items-center justify-center
        p-4 sxs-only:p-[0.92rem] xs-only:p-[0.92rem] sm-only:p-[0.92rem] md-only:p-4 lg-only:p-4
        landscape-small:p-[0.85rem] landscape-tablet-sm:p-[0.85rem]
        min-w-[min(18.5rem,80vw)] max-w-[min(18.5rem,80vw)]
        sxs-only:min-w-[min(17.02rem,73.6vw)] sxs-only:max-w-[min(17.02rem,73.6vw)]
        xs-only:min-w-[min(17.02rem,73.6vw)] xs-only:max-w-[min(17.02rem,73.6vw)]
        sm-only:min-w-[min(17.02rem,73.6vw)] sm-only:max-w-[min(17.02rem,73.6vw)]
        md-only:min-w-[min(17.5rem,73.6vw)] md-only:max-w-[min(17.5rem,73.6vw)]
        landscape-small:min-w-[min(15.725rem,68vw)] landscape-small:max-w-[min(15.725rem,68vw)]
        landscape-tablet-sm:min-w-[min(15.725rem,68vw)] landscape-tablet-sm:max-w-[min(15.725rem,68vw)]
        h-[min(25.5rem,80vh)] max-h-[min(25.5rem,80vh)]
        sxs-only:h-[min(23.46rem,73.6vh)] sxs-only:max-h-[min(23.46rem,73.6vh)]
        xs-only:h-[min(23.46rem,73.6vh)] xs-only:max-h-[min(23.46rem,73.6vh)]
        sm-only:h-[min(23.46rem,73.6vh)] sm-only:max-h-[min(23.46rem,73.6vh)]
        md-only:h-[min(24rem,73.6vh)] md-only:max-h-[min(24rem,73.6vh)]
        landscape-small:h-[min(21.675rem,68vh)] landscape-small:max-h-[min(21.675rem,68vh)]
        landscape-tablet-sm:h-[min(21.675rem,68vh)] landscape-tablet-sm:max-h-[min(21.675rem,68vh)]
        rounded-[1rem] sxs-only:rounded-[0.92rem] xs-only:rounded-[0.92rem]
        landscape-small:rounded-[0.85rem] landscape-tablet-sm:rounded-[0.85rem]
        gap-2 sxs-only:gap-[0.46rem] xs-only:gap-[0.46rem] sm-only:gap-2
        landscape-small:gap-[0.425rem] landscape-tablet-sm:gap-[0.425rem]
        after:absolute after:w-min 
        ${
          Tipo_Relacion === RelacionesEstudianteResponsable.Padre_de_Familia
            ? "after:content-['Hijo(a)']"
            : "after:content-['A_cargo']"
        } 
        after:top-0 after:right-0 after:bg-negro after:text-white 
        after:px-5 after:py-2
        sxs-only:after:px-[1.15rem] sxs-only:after:py-[0.46rem]
        xs-only:after:px-[1.15rem] xs-only:after:py-[0.46rem]
        sm-only:after:px-[1.15rem] sm-only:after:py-2
        landscape-small:after:px-[1.0625rem] landscape-small:after:py-[0.425rem]
        landscape-tablet-sm:after:px-[1.0625rem] landscape-tablet-sm:after:py-[0.425rem]
        after:text-[0.9rem]
        sxs-only:after:text-[0.828rem]
        xs-only:after:text-[0.828rem]
        sm-only:after:text-[0.828rem]
        landscape-small:after:text-[0.765rem]
        landscape-tablet-sm:after:text-[0.765rem]
        after:rounded-bl-[1rem]
        sxs-only:after:rounded-bl-[0.92rem]
        xs-only:after:rounded-bl-[0.92rem]
        landscape-small:after:rounded-bl-[0.85rem]
        landscape-tablet-sm:after:rounded-bl-[0.85rem]
      `}
      >
        <FotoPerfilClientSide
          className="
          w-[75px] h-[75px] 
          sxs-only:w-[69px] sxs-only:h-[69px] 
          xs-only:w-[69px] xs-only:h-[69px] 
          sm-only:w-[69px] sm-only:h-[69px] 
          md-only:w-[70px] md-only:h-[70px]
          lg-only:w-[75px] lg-only:h-[75px]
          landscape-small:w-[63.75px] landscape-small:h-[63.75px]
          landscape-tablet-sm:w-[63.75px] landscape-tablet-sm:h-[63.75px]
          rounded-full object-cover
        "
          Google_Drive_Foto_ID={Google_Drive_Foto_ID}
        />

        <h2
          className="
        mb-1 font-medium text-center leading-tight
        text-[1.2rem]
        sxs-only:text-[1.104rem]
        xs-only:text-[1.104rem]
        sm-only:text-[1.104rem]
        md-only:text-[1.15rem]
        lg-only:text-[1.2rem]
        landscape-small:text-[1.02rem]
        landscape-tablet-sm:text-[1.02rem]
        sxs-only:mb-[0.23rem]
        xs-only:mb-[0.23rem]
        landscape-small:mb-[0.212rem]
        landscape-tablet-sm:mb-[0.212rem]
        w-full overflow-hidden text-ellipsis whitespace-nowrap
      "
        >
          {Nombres} {Apellidos}
        </h2>

        <span
          className="
        text-azul-principal text-center
        text-[1.1rem]
        sxs-only:text-[1.012rem]
        xs-only:text-[1.012rem]
        sm-only:text-[1.012rem]
        md-only:text-[1.05rem]
        lg-only:text-[1.1rem]
        landscape-small:text-[0.935rem]
        landscape-tablet-sm:text-[0.935rem]
      "
        >
          <b>
            {
              TiposIdentificadoresTextos[
                extraerTipoDeIdentificador(Id_Estudiante)
              ]
            }
            :
          </b>{" "}
          {extraerIdentificador(Id_Estudiante)}
        </span>

        <i
          className="
        font-medium text-center
        text-[0.95rem]
        sxs-only:text-[0.874rem]
        xs-only:text-[0.874rem]
        sm-only:text-[0.874rem]
        md-only:text-[0.95rem]
        lg-only:text-[1rem]
        landscape-small:text-[0.8075rem]
        landscape-tablet-sm:text-[0.8075rem]
      "
        >
          {aula === undefined
            ? "El aula ya no existe"
            : aula === null
            ? "Sin Aula"
            : `${NivelEducativoTextos[aula.Nivel as NivelEducativo]} - ${
                aula.Grado
              }${aula.Seccion}`}
        </i>

        <section
          className="
          mt-2 flex flex-col w-full justify-center items-center
          gap-3 sxs-only:gap-[0.69rem] xs-only:gap-[0.69rem] sm-only:gap-3
          landscape-small:gap-[0.6375rem] landscape-tablet-sm:gap-[0.6375rem]
          text-[0.9rem]
          sxs-only:text-[0.828rem]
          xs-only:text-[0.828rem]
          sm-only:text-[0.828rem]
          md-only:text-[0.9rem]
          lg-only:text-[0.9rem]
          landscape-small:text-[0.765rem]
          landscape-tablet-sm:text-[0.765rem]
          font-semibold
          landscape-small:mt-[0.425rem]
          landscape-tablet-sm:mt-[0.425rem]
        "
          role="group"
        >
          <button
            className="w-[9rem]
          sxs-only:w-[8.28rem]
          xs-only:w-[8.28rem] 
          sm-only:w-[8.28rem]
          landscape-small:w-[7.65rem]
          landscape-tablet-sm:w-[7.65rem]
          flex items-center justify-center bg-amarillo-ediciones text-black gap-2 
          sxs-only:gap-[0.46rem]
          xs-only:gap-[0.46rem]
          landscape-small:gap-[0.425rem]
          landscape-tablet-sm:gap-[0.425rem]
          rounded-[10px] sxs-only:rounded-[9.2px] xs-only:rounded-[9.2px]
          landscape-small:rounded-[8.5px] landscape-tablet-sm:rounded-[8.5px]
          py-2 px-2 
          sxs-only:py-[0.46rem] sxs-only:px-[0.46rem]
          xs-only:py-[0.46rem] xs-only:px-[0.46rem]
          sm-only:py-2 sm-only:px-2
          landscape-small:py-[0.425rem] landscape-small:px-[0.425rem]
          landscape-tablet-sm:py-[0.425rem] landscape-tablet-sm:px-[0.425rem]
          transition-all duration-200 hover:bg-opacity-90 active:scale-95
        "
          >
            Cambiar Foto
            <CamaraIcon
              className="
            w-5 
            sxs-only:w-[18.4px] 
            xs-only:w-[18.4px] 
            sm-only:w-[18.4px]
            md-only:w-5
            lg-only:w-5
            landscape-small:w-[17px]
            landscape-tablet-sm:w-[17px]
          "
            />
          </button>

          <button
            className="w-[9rem]
          sxs-only:w-[8.28rem]
          xs-only:w-[8.28rem] 
          sm-only:w-[8.28rem]
          landscape-small:w-[7.65rem]
          landscape-tablet-sm:w-[7.65rem]
          text-white flex items-center justify-center bg-azul-principal gap-2 
          sxs-only:gap-[0.46rem]
          xs-only:gap-[0.46rem]
          landscape-small:gap-[0.425rem]
          landscape-tablet-sm:gap-[0.425rem]
          rounded-[10px] sxs-only:rounded-[9.2px] xs-only:rounded-[9.2px]
          landscape-small:rounded-[8.5px] landscape-tablet-sm:rounded-[8.5px]
          py-2 px-2 
          sxs-only:py-[0.46rem] sxs-only:px-[0.46rem]
          xs-only:py-[0.46rem] xs-only:px-[0.46rem]
          sm-only:py-2 sm-only:px-2
          landscape-small:py-[0.425rem] landscape-small:px-[0.425rem]
          landscape-tablet-sm:py-[0.425rem] landscape-tablet-sm:px-[0.425rem]
          transition-all duration-200 hover:bg-opacity-90 active:scale-95
        "
          >
            Ver Asistencia
            <LibretaConLapiz
              className="
            w-5 
            sxs-only:w-[18.4px] 
            xs-only:w-[18.4px] 
            sm-only:w-[18.4px]
            md-only:w-5
            lg-only:w-5
            landscape-small:w-[17px]
            landscape-tablet-sm:w-[17px]
          "
            />
          </button>

          {miEstudianteRelacionado.aula && (
            <button
              onClick={() => setShowGenerarQRDelEstudianteModal(Id_Estudiante)}
              className="w-[9rem]
          sxs-only:w-[8.28rem]
          xs-only:w-[8.28rem] 
          sm-only:w-[8.28rem]
          landscape-small:w-[7.65rem]
          landscape-tablet-sm:w-[7.65rem]
          text-white flex items-center justify-center bg-negro gap-2 
          sxs-only:gap-[0.46rem]
          xs-only:gap-[0.46rem]
          landscape-small:gap-[0.425rem]
          landscape-tablet-sm:gap-[0.425rem]
          rounded-[10px] sxs-only:rounded-[9.2px] xs-only:rounded-[9.2px]
          landscape-small:rounded-[8.5px] landscape-tablet-sm:rounded-[8.5px]
          py-2 px-2 
          sxs-only:py-[0.46rem] sxs-only:px-[0.46rem]
          xs-only:py-[0.46rem] xs-only:px-[0.46rem]
          sm-only:py-2 sm-only:px-2
          landscape-small:py-[0.425rem] landscape-small:px-[0.425rem]
          landscape-tablet-sm:py-[0.425rem] landscape-tablet-sm:px-[0.425rem]
          transition-all duration-200 hover:bg-opacity-90 active:scale-95
        "
            >
              Generar QR
              <QRIcon
                className="
            w-[18px] 
            sxs-only:w-[16.56px] 
            xs-only:w-[16.56px] 
            sm-only:w-[16.56px]
            md-only:w-[17px]
            lg-only:w-[18px]
            landscape-small:w-[15.3px]
            landscape-tablet-sm:w-[15.3px]
          "
              />
            </button>
          )}
        </section>

        <span
          className={`
            font-semibold
            ${Estado ? "text-verde-principal" : "text-rojo-oscuro"}
            text-center mt-2
            text-[15px]
            sxs-only:text-[13.8px]
            xs-only:text-[13.8px]
            sm-only:text-[13.8px]
            md-only:text-[15px]
            lg-only:text-[15px]
            landscape-small:text-[12.75px]
            landscape-tablet-sm:text-[12.75px]
            sxs-only:mt-[0.46rem]
            xs-only:mt-[0.46rem]
            landscape-small:mt-[0.425rem]
            landscape-tablet-sm:mt-[0.425rem]
        `}
          title={`Estado: ${Estado ? "Activo" : "Inactivo"}`}
        >
          Estado: {Estado ? "Activo" : "Inactivo"}
        </span>
      </div>
    </>
  );
};

export default MiEstudianteRelacionadoCard;
