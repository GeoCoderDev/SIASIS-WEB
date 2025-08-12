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
import GeneradorDeQRParaResponsablesModal from "@/components/modals/QR/GeneradorDeQRParaResponsablesModal";
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
        p-4 sxs-only:p-2.5 xs-only:p-3 sm-only:p-3.5 md-only:p-4 lg-only:p-4
        min-w-[min(18.5rem,80vw)] max-w-[min(18.5rem,80vw)]
        sxs-only:min-w-[min(15rem,90vw)] sxs-only:max-w-[min(15rem,90vw)]
        xs-only:min-w-[min(15.5rem,85vw)] xs-only:max-w-[min(15.5rem,85vw)]
        sm-only:min-w-[min(16.5rem,80vw)] sm-only:max-w-[min(16.5rem,80vw)]
        md-only:min-w-[min(17.5rem,80vw)] md-only:max-w-[min(17.5rem,80vw)]
        h-[min(25.5rem,80vh)] max-h-[min(25.5rem,80vh)]
        sxs-only:h-[min(21rem,85vh)] sxs-only:max-h-[min(21rem,85vh)]
        xs-only:h-[min(21.5rem,82vh)] xs-only:max-h-[min(21.5rem,82vh)]
        sm-only:h-[min(22.5rem,80vh)] sm-only:max-h-[min(22.5rem,80vh)]
        md-only:h-[min(24rem,80vh)] md-only:max-h-[min(24rem,80vh)]
        rounded-[1rem] sxs-only:rounded-[0.8rem] xs-only:rounded-[0.9rem]
        gap-2 sxs-only:gap-1.5 xs-only:gap-1.5 sm-only:gap-2
        after:absolute after:w-min 
        ${
          Tipo_Relacion === RelacionesEstudianteResponsable.Padre_de_Familia
            ? "after:content-['Hijo(a)']"
            : "after:content-['A_cargo']"
        } 
        after:top-0 after:right-0 after:bg-negro after:text-white 
        after:px-5 after:py-2
        sxs-only:after:px-3 sxs-only:after:py-1.5
        xs-only:after:px-4 xs-only:after:py-1.5
        sm-only:after:px-4 sm-only:after:py-2
        after:text-[0.9rem]
        sxs-only:after:text-[0.75rem]
        xs-only:after:text-[0.8rem]
        sm-only:after:text-[0.85rem]
        after:rounded-bl-[1rem]
        sxs-only:after:rounded-bl-[0.8rem]
        xs-only:after:rounded-bl-[0.9rem]
      `}
      >
        <FotoPerfilClientSide
          className="
          w-[75px] h-[75px] 
          sxs-only:w-[55px] sxs-only:h-[55px] 
          xs-only:w-[60px] xs-only:h-[60px] 
          sm-only:w-[65px] sm-only:h-[65px] 
          md-only:w-[70px] md-only:h-[70px]
          lg-only:w-[75px] lg-only:h-[75px]
          rounded-full object-cover
        "
          Google_Drive_Foto_ID={Google_Drive_Foto_ID}
        />

        <h2
          className="
        mb-1 font-medium text-center leading-tight
        text-[1.2rem]
        sxs-only:text-[1rem]
        xs-only:text-[1.05rem]
        sm-only:text-[1.1rem]
        md-only:text-[1.15rem]
        lg-only:text-[1.2rem]
        sxs-only:mb-0.5
        xs-only:mb-0.5
        w-full overflow-hidden text-ellipsis whitespace-nowrap
      "
        >
          {Nombres} {Apellidos}
        </h2>

        <span
          className="
        text-azul-principal text-center
        text-[1.1rem]
        sxs-only:text-[0.9rem]
        xs-only:text-[0.95rem]
        sm-only:text-[1rem]
        md-only:text-[1.05rem]
        lg-only:text-[1.1rem]
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
        sxs-only:text-[0.8rem]
        xs-only:text-[0.85rem]
        sm-only:text-[0.9rem]
        md-only:text-[0.95rem]
        lg-only:text-[1rem]
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
          gap-3 sxs-only:gap-2 xs-only:gap-2.5 sm-only:gap-3
          text-[0.9rem]
          sxs-only:text-[0.75rem]
          xs-only:text-[0.8rem]
          sm-only:text-[0.85rem]
          md-only:text-[0.9rem]
          lg-only:text-[0.9rem]
          font-semibold
        "
          role="group"
        >
          <button
            className="w-[9rem]
          flex items-center justify-center bg-amarillo-ediciones text-black gap-2 
          rounded-[10px] sxs-only:rounded-[8px] xs-only:rounded-[9px]
          py-2 px-2 
          sxs-only:py-1.5 sxs-only:px-1.5
          xs-only:py-1.5 xs-only:px-1.5
          sm-only:py-2 sm-only:px-2
          transition-all duration-200 hover:bg-opacity-90 active:scale-95
        "
          >
            Cambiar Foto
            <CamaraIcon
              className="
            w-5 
            sxs-only:w-4 
            xs-only:w-4 
            sm-only:w-4
            md-only:w-5
            lg-only:w-5
          "
            />
          </button>

          <button
            className="w-[9rem]
          text-white flex items-center justify-center bg-azul-principal gap-2 
          rounded-[10px] sxs-only:rounded-[8px] xs-only:rounded-[9px]
          py-2 px-2 
          sxs-only:py-1.5 sxs-only:px-1.5
          xs-only:py-1.5 xs-only:px-1.5
          sm-only:py-2 sm-only:px-2
          transition-all duration-200 hover:bg-opacity-90 active:scale-95
        "
          >
            Ver Asistencia
            <LibretaConLapiz
              className="
            w-5 
            sxs-only:w-4 
            xs-only:w-4 
            sm-only:w-4
            md-only:w-5
            lg-only:w-5
          "
            />
          </button>

          {miEstudianteRelacionado.aula && (
            <button
              onClick={() => setShowGenerarQRDelEstudianteModal(Id_Estudiante)}
              className="w-[9rem]
          text-white flex items-center justify-center bg-negro gap-2 
          rounded-[10px] sxs-only:rounded-[8px] xs-only:rounded-[9px]
          py-2 px-2 
          sxs-only:py-1.5 sxs-only:px-1.5
          xs-only:py-1.5 xs-only:px-1.5
          sm-only:py-2 sm-only:px-2
          transition-all duration-200 hover:bg-opacity-90 active:scale-95
        "
            >
              Generar QR
              <QRIcon
                className="
            w-[18px] 
            sxs-only:w-[14px] 
            xs-only:w-[15px] 
            sm-only:w-[16px]
            md-only:w-[17px]
            lg-only:w-[18px]
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
            sxs-only:text-[12px]
            xs-only:text-[13px]
            sm-only:text-[14px]
            md-only:text-[15px]
            lg-only:text-[15px]
            sxs-only:mt-1
            xs-only:mt-1.5
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
