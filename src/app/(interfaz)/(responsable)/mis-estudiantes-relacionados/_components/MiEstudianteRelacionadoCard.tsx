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
import { useState } from "react";
import GeneradorDeTarjetaQRDeEstudianteParaResponsablesModal from "@/components/modals/QR/GeneradorDeQRParaResponsablesModal";
import { EstudianteConAulaYRelacion } from "@/interfaces/shared/Estudiantes";
import { Link } from "next-view-transitions";

interface MiEstudianteRelacionadoCardProps {
  miEstudianteRelacionado: EstudianteConAulaYRelacion;
  minimizado?: boolean;
}

const MiEstudianteRelacionadoCard = ({
  miEstudianteRelacionado,
  minimizado = false,
}: MiEstudianteRelacionadoCardProps) => {
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

  // Aplicar reducción de tamaños cuando está minimizado (aproximadamente 80% del tamaño original)
  const scale = minimizado ? 0.8 : 1;

  return (
    <>
      {showGenerarQRDelEstudianteModal && (
        <GeneradorDeTarjetaQRDeEstudianteParaResponsablesModal
          EstudianteConAulaYRelacion={miEstudianteRelacionado}
          eliminarModal={() => setShowGenerarQRDelEstudianteModal(null)}
        />
      )}
      <div
        style={{ viewTransitionName: `card-${Id_Estudiante}` }}
        className={`
        overflow-hidden relative ${"siasis-shadow-card hover:shadow-[0_0_8px_5px_rgba(0,0,0,0.2)]"} [cursor:default_!important] 
        flex flex-col items-center justify-center
        ${minimizado ? "p-3" : "p-4"} 
        ${minimizado ? "sxs-only:p-[0.69rem]" : "sxs-only:p-[0.92rem]"} 
        ${minimizado ? "xs-only:p-[0.69rem]" : "xs-only:p-[0.92rem]"} 
        ${minimizado ? "sm-only:p-[0.69rem]" : "sm-only:p-[0.92rem]"} 
        ${minimizado ? "md-only:p-3" : "md-only:p-4"} 
        ${minimizado ? "lg-only:p-3" : "lg-only:p-4"}
        ${
          minimizado
            ? "landscape-small:p-[0.64rem]"
            : "landscape-small:p-[0.85rem]"
        } 
        ${
          minimizado
            ? "landscape-tablet-sm:p-[0.64rem]"
            : "landscape-tablet-sm:p-[0.85rem]"
        }
        ${
          minimizado
            ? "min-w-[min(14.8rem,80vw)] max-w-[min(14.8rem,80vw)]"
            : "min-w-[min(18.5rem,80vw)] max-w-[min(18.5rem,80vw)]"
        }
        ${
          minimizado
            ? "sxs-only:min-w-[min(13.6rem,73.6vw)] sxs-only:max-w-[min(13.6rem,73.6vw)]"
            : "sxs-only:min-w-[min(17.02rem,73.6vw)] sxs-only:max-w-[min(17.02rem,73.6vw)]"
        }
        ${
          minimizado
            ? "xs-only:min-w-[min(13.6rem,73.6vw)] xs-only:max-w-[min(13.6rem,73.6vw)]"
            : "xs-only:min-w-[min(17.02rem,73.6vw)] xs-only:max-w-[min(17.02rem,73.6vw)]"
        }
        ${
          minimizado
            ? "sm-only:min-w-[min(13.6rem,73.6vw)] sm-only:max-w-[min(13.6rem,73.6vw)]"
            : "sm-only:min-w-[min(17.02rem,73.6vw)] sm-only:max-w-[min(17.02rem,73.6vw)]"
        }
        ${
          minimizado
            ? "md-only:min-w-[min(14rem,73.6vw)] md-only:max-w-[min(14rem,73.6vw)]"
            : "md-only:min-w-[min(17.5rem,73.6vw)] md-only:max-w-[min(17.5rem,73.6vw)]"
        }
        ${
          minimizado
            ? "landscape-small:min-w-[min(12.6rem,68vw)] landscape-small:max-w-[min(12.6rem,68vw)]"
            : "landscape-small:min-w-[min(15.725rem,68vw)] landscape-small:max-w-[min(15.725rem,68vw)]"
        }
        ${
          minimizado
            ? "landscape-tablet-sm:min-w-[min(12.6rem,68vw)] landscape-tablet-sm:max-w-[min(12.6rem,68vw)]"
            : "landscape-tablet-sm:min-w-[min(15.725rem,68vw)] landscape-tablet-sm:max-w-[min(15.725rem,68vw)]"
        }
        ${
          minimizado
            ? "h-[min(20.4rem,80vh)] max-h-[min(20.4rem,80vh)]"
            : "h-[min(25.5rem,80vh)] max-h-[min(25.5rem,80vh)]"
        }
        ${
          minimizado
            ? "sxs-only:h-[min(18.8rem,73.6vh)] sxs-only:max-h-[min(18.8rem,73.6vh)]"
            : "sxs-only:h-[min(23.46rem,73.6vh)] sxs-only:max-h-[min(23.46rem,73.6vh)]"
        }
        ${
          minimizado
            ? "xs-only:h-[min(18.8rem,73.6vh)] xs-only:max-h-[min(18.8rem,73.6vh)]"
            : "xs-only:h-[min(23.46rem,73.6vh)] xs-only:max-h-[min(23.46rem,73.6vh)]"
        }
        ${
          minimizado
            ? "sm-only:h-[min(18.8rem,73.6vh)] sm-only:max-h-[min(18.8rem,73.6vh)]"
            : "sm-only:h-[min(23.46rem,73.6vh)] sm-only:max-h-[min(23.46rem,73.6vh)]"
        }
        ${
          minimizado
            ? "md-only:h-[min(19.2rem,73.6vh)] md-only:max-h-[min(19.2rem,73.6vh)]"
            : "md-only:h-[min(24rem,73.6vh)] md-only:max-h-[min(24rem,73.6vh)]"
        }
        ${
          minimizado
            ? "landscape-small:h-[min(17.3rem,68vh)] landscape-small:max-h-[min(17.3rem,68vh)]"
            : "landscape-small:h-[min(21.675rem,68vh)] landscape-small:max-h-[min(21.675rem,68vh)]"
        }
        ${
          minimizado
            ? "landscape-tablet-sm:h-[min(17.3rem,68vh)] landscape-tablet-sm:max-h-[min(17.3rem,68vh)]"
            : "landscape-tablet-sm:h-[min(21.675rem,68vh)] landscape-tablet-sm:max-h-[min(21.675rem,68vh)]"
        }
        ${minimizado ? "rounded-[0.75rem]" : "rounded-[1rem]"} 
        ${
          minimizado
            ? "sxs-only:rounded-[0.69rem]"
            : "sxs-only:rounded-[0.92rem]"
        } 
        ${
          minimizado ? "xs-only:rounded-[0.69rem]" : "xs-only:rounded-[0.92rem]"
        }
        ${
          minimizado
            ? "landscape-small:rounded-[0.64rem]"
            : "landscape-small:rounded-[0.85rem]"
        } 
        ${
          minimizado
            ? "landscape-tablet-sm:rounded-[0.64rem]"
            : "landscape-tablet-sm:rounded-[0.85rem]"
        }
        ${minimizado ? "gap-[0.37rem]" : "gap-2"} 
        ${minimizado ? "sxs-only:gap-[0.34rem]" : "sxs-only:gap-[0.46rem]"} 
        ${minimizado ? "xs-only:gap-[0.34rem]" : "xs-only:gap-[0.46rem]"} 
        ${minimizado ? "sm-only:gap-[0.37rem]" : "sm-only:gap-2"}
        ${
          minimizado
            ? "landscape-small:gap-[0.32rem]"
            : "landscape-small:gap-[0.425rem]"
        } 
        ${
          minimizado
            ? "landscape-tablet-sm:gap-[0.32rem]"
            : "landscape-tablet-sm:gap-[0.425rem]"
        }
        after:absolute after:w-min 
        ${
          Tipo_Relacion === RelacionesEstudianteResponsable.Padre_de_Familia
            ? "after:content-['Hijo(a)']"
            : "after:content-['A_cargo']"
        } 
        after:top-0 after:right-0 after:bg-negro after:text-white 
        ${
          minimizado
            ? "after:px-[0.94rem] after:py-[0.37rem]"
            : "after:px-5 after:py-2"
        }
        ${
          minimizado
            ? "sxs-only:after:px-[0.86rem] sxs-only:after:py-[0.34rem]"
            : "sxs-only:after:px-[1.15rem] sxs-only:after:py-[0.46rem]"
        }
        ${
          minimizado
            ? "xs-only:after:px-[0.86rem] xs-only:after:py-[0.34rem]"
            : "xs-only:after:px-[1.15rem] xs-only:after:py-[0.46rem]"
        }
        ${
          minimizado
            ? "sm-only:after:px-[0.86rem] sm-only:after:py-[0.37rem]"
            : "sm-only:after:px-[1.15rem] sm-only:after:py-2"
        }
        ${
          minimizado
            ? "landscape-small:after:px-[0.8rem] landscape-small:after:py-[0.32rem]"
            : "landscape-small:after:px-[1.0625rem] landscape-small:after:py-[0.425rem]"
        }
        ${
          minimizado
            ? "landscape-tablet-sm:after:px-[0.8rem] landscape-tablet-sm:after:py-[0.32rem]"
            : "landscape-tablet-sm:after:px-[1.0625rem] landscape-tablet-sm:after:py-[0.425rem]"
        }
        ${minimizado ? "after:text-[0.675rem]" : "after:text-[0.9rem]"}
        ${
          minimizado
            ? "sxs-only:after:text-[0.621rem]"
            : "sxs-only:after:text-[0.828rem]"
        }
        ${
          minimizado
            ? "xs-only:after:text-[0.621rem]"
            : "xs-only:after:text-[0.828rem]"
        }
        ${
          minimizado
            ? "sm-only:after:text-[0.621rem]"
            : "sm-only:after:text-[0.828rem]"
        }
        ${
          minimizado
            ? "landscape-small:after:text-[0.574rem]"
            : "landscape-small:after:text-[0.765rem]"
        }
        ${
          minimizado
            ? "landscape-tablet-sm:after:text-[0.574rem]"
            : "landscape-tablet-sm:after:text-[0.765rem]"
        }
        ${minimizado ? "after:rounded-bl-[0.75rem]" : "after:rounded-bl-[1rem]"}
        ${
          minimizado
            ? "sxs-only:after:rounded-bl-[0.69rem]"
            : "sxs-only:after:rounded-bl-[0.92rem]"
        }
        ${
          minimizado
            ? "xs-only:after:rounded-bl-[0.69rem]"
            : "xs-only:after:rounded-bl-[0.92rem]"
        }
        ${
          minimizado
            ? "landscape-small:after:rounded-bl-[0.64rem]"
            : "landscape-small:after:rounded-bl-[0.85rem]"
        }
        ${
          minimizado
            ? "landscape-tablet-sm:after:rounded-bl-[0.64rem]"
            : "landscape-tablet-sm:after:rounded-bl-[0.85rem]"
        }
      `}
      >
        <FotoPerfilClientSide
          className={`
          ${minimizado ? "w-[60px] h-[60px]" : "w-[75px] h-[75px]"} 
          ${
            minimizado
              ? "sxs-only:w-[55px] sxs-only:h-[55px]"
              : "sxs-only:w-[69px] sxs-only:h-[69px]"
          } 
          ${
            minimizado
              ? "xs-only:w-[55px] xs-only:h-[55px]"
              : "xs-only:w-[69px] xs-only:h-[69px]"
          } 
          ${
            minimizado
              ? "sm-only:w-[55px] sm-only:h-[55px]"
              : "sm-only:w-[69px] sm-only:h-[69px]"
          } 
          ${
            minimizado
              ? "md-only:w-[56px] md-only:h-[56px]"
              : "md-only:w-[70px] md-only:h-[70px]"
          }
          ${
            minimizado
              ? "lg-only:w-[60px] lg-only:h-[60px]"
              : "lg-only:w-[75px] lg-only:h-[75px]"
          }
          ${
            minimizado
              ? "landscape-small:w-[51px] landscape-small:h-[51px]"
              : "landscape-small:w-[63.75px] landscape-small:h-[63.75px]"
          }
          ${
            minimizado
              ? "landscape-tablet-sm:w-[51px] landscape-tablet-sm:h-[51px]"
              : "landscape-tablet-sm:w-[63.75px] landscape-tablet-sm:h-[63.75px]"
          }
          rounded-full object-cover
        `}
          Google_Drive_Foto_ID={Google_Drive_Foto_ID}
        />

        <h2
          className={`
        ${
          minimizado ? "mb-[0.18rem]" : "mb-1"
        } font-medium text-center leading-tight
        ${minimizado ? "text-[0.9rem]" : "text-[1.2rem]"}
        ${minimizado ? "sxs-only:text-[0.828rem]" : "sxs-only:text-[1.104rem]"}
        ${minimizado ? "xs-only:text-[0.828rem]" : "xs-only:text-[1.104rem]"}
        ${minimizado ? "sm-only:text-[0.828rem]" : "sm-only:text-[1.104rem]"}
        ${minimizado ? "md-only:text-[0.86rem]" : "md-only:text-[1.15rem]"}
        ${minimizado ? "lg-only:text-[0.9rem]" : "lg-only:text-[1.2rem]"}
        ${
          minimizado
            ? "landscape-small:text-[0.765rem]"
            : "landscape-small:text-[1.02rem]"
        }
        ${
          minimizado
            ? "landscape-tablet-sm:text-[0.765rem]"
            : "landscape-tablet-sm:text-[1.02rem]"
        }
        ${minimizado ? "sxs-only:mb-[0.17rem]" : "sxs-only:mb-[0.23rem]"}
        ${minimizado ? "xs-only:mb-[0.17rem]" : "xs-only:mb-[0.23rem]"}
        ${
          minimizado
            ? "landscape-small:mb-[0.16rem]"
            : "landscape-small:mb-[0.212rem]"
        }
        ${
          minimizado
            ? "landscape-tablet-sm:mb-[0.16rem]"
            : "landscape-tablet-sm:mb-[0.212rem]"
        }
        w-full overflow-hidden text-ellipsis whitespace-nowrap
      `}
        >
          {Nombres} {Apellidos}
        </h2>

        <span
          className={`
        text-azul-principal text-center
        ${minimizado ? "text-[0.825rem]" : "text-[1.1rem]"}
        ${minimizado ? "sxs-only:text-[0.759rem]" : "sxs-only:text-[1.012rem]"}
        ${minimizado ? "xs-only:text-[0.759rem]" : "xs-only:text-[1.012rem]"}
        ${minimizado ? "sm-only:text-[0.759rem]" : "sm-only:text-[1.012rem]"}
        ${minimizado ? "md-only:text-[0.788rem]" : "md-only:text-[1.05rem]"}
        ${minimizado ? "lg-only:text-[0.825rem]" : "lg-only:text-[1.1rem]"}
        ${
          minimizado
            ? "landscape-small:text-[0.701rem]"
            : "landscape-small:text-[0.935rem]"
        }
        ${
          minimizado
            ? "landscape-tablet-sm:text-[0.701rem]"
            : "landscape-tablet-sm:text-[0.935rem]"
        }
      `}
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
          className={`
        font-medium text-center
        ${minimizado ? "text-[0.713rem]" : "text-[0.95rem]"}
        ${minimizado ? "sxs-only:text-[0.656rem]" : "sxs-only:text-[0.874rem]"}
        ${minimizado ? "xs-only:text-[0.656rem]" : "xs-only:text-[0.874rem]"}
        ${minimizado ? "sm-only:text-[0.656rem]" : "sm-only:text-[0.874rem]"}
        ${minimizado ? "md-only:text-[0.713rem]" : "md-only:text-[0.95rem]"}
        ${minimizado ? "lg-only:text-[0.75rem]" : "lg-only:text-[1rem]"}
        ${
          minimizado
            ? "landscape-small:text-[0.606rem]"
            : "landscape-small:text-[0.8075rem]"
        }
        ${
          minimizado
            ? "landscape-tablet-sm:text-[0.606rem]"
            : "landscape-tablet-sm:text-[0.8075rem]"
        }
      `}
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
          className={`
          ${
            minimizado ? "mt-[0.37rem]" : "mt-2"
          } flex flex-col w-full justify-center items-center
          ${minimizado ? "gap-[0.56rem]" : "gap-3"} 
          ${minimizado ? "sxs-only:gap-[0.52rem]" : "sxs-only:gap-[0.69rem]"} 
          ${minimizado ? "xs-only:gap-[0.52rem]" : "xs-only:gap-[0.69rem]"} 
          ${minimizado ? "sm-only:gap-[0.56rem]" : "sm-only:gap-3"}
          ${
            minimizado
              ? "landscape-small:gap-[0.48rem]"
              : "landscape-small:gap-[0.6375rem]"
          } 
          ${
            minimizado
              ? "landscape-tablet-sm:gap-[0.48rem]"
              : "landscape-tablet-sm:gap-[0.6375rem]"
          }
          ${minimizado ? "text-[0.675rem]" : "text-[0.9rem]"}
          ${
            minimizado ? "sxs-only:text-[0.621rem]" : "sxs-only:text-[0.828rem]"
          }
          ${minimizado ? "xs-only:text-[0.621rem]" : "xs-only:text-[0.828rem]"}
          ${minimizado ? "sm-only:text-[0.621rem]" : "sm-only:text-[0.828rem]"}
          ${minimizado ? "md-only:text-[0.675rem]" : "md-only:text-[0.9rem]"}
          ${minimizado ? "lg-only:text-[0.675rem]" : "lg-only:text-[0.9rem]"}
          ${
            minimizado
              ? "landscape-small:text-[0.574rem]"
              : "landscape-small:text-[0.765rem]"
          }
          ${
            minimizado
              ? "landscape-tablet-sm:text-[0.574rem]"
              : "landscape-tablet-sm:text-[0.765rem]"
          }
          font-semibold
          ${
            minimizado
              ? "landscape-small:mt-[0.32rem]"
              : "landscape-small:mt-[0.425rem]"
          }
          ${
            minimizado
              ? "landscape-tablet-sm:mt-[0.32rem]"
              : "landscape-tablet-sm:mt-[0.425rem]"
          }
        `}
          role="group"
        >
          <button
            className={`
            ${minimizado ? "w-[7.2rem]" : "w-[9rem]"}
          ${minimizado ? "sxs-only:w-[6.6rem]" : "sxs-only:w-[8.28rem]"}
          ${minimizado ? "xs-only:w-[6.6rem]" : "xs-only:w-[8.28rem]"} 
          ${minimizado ? "sm-only:w-[6.6rem]" : "sm-only:w-[8.28rem]"}
          ${
            minimizado
              ? "landscape-small:w-[6.1rem]"
              : "landscape-small:w-[7.65rem]"
          }
          ${
            minimizado
              ? "landscape-tablet-sm:w-[6.1rem]"
              : "landscape-tablet-sm:w-[7.65rem]"
          }
          flex items-center justify-center bg-amarillo-ediciones text-black 
          ${minimizado ? "gap-[0.4rem]" : "gap-2"} 
          ${minimizado ? "sxs-only:gap-[0.37rem]" : "sxs-only:gap-[0.46rem]"}
          ${minimizado ? "xs-only:gap-[0.37rem]" : "xs-only:gap-[0.46rem]"}
          ${
            minimizado
              ? "landscape-small:gap-[0.34rem]"
              : "landscape-small:gap-[0.425rem]"
          }
          ${
            minimizado
              ? "landscape-tablet-sm:gap-[0.34rem]"
              : "landscape-tablet-sm:gap-[0.425rem]"
          }
          ${minimizado ? "rounded-[8px]" : "rounded-[10px]"} 
          ${
            minimizado ? "sxs-only:rounded-[7.4px]" : "sxs-only:rounded-[9.2px]"
          } 
          ${minimizado ? "xs-only:rounded-[7.4px]" : "xs-only:rounded-[9.2px]"}
          ${
            minimizado
              ? "landscape-small:rounded-[6.8px]"
              : "landscape-small:rounded-[8.5px]"
          } 
          ${
            minimizado
              ? "landscape-tablet-sm:rounded-[6.8px]"
              : "landscape-tablet-sm:rounded-[8.5px]"
          }
          ${minimizado ? "py-[0.4rem] px-[0.4rem]" : "py-2 px-2"} 
          ${
            minimizado
              ? "sxs-only:py-[0.37rem] sxs-only:px-[0.37rem]"
              : "sxs-only:py-[0.46rem] sxs-only:px-[0.46rem]"
          }
          ${
            minimizado
              ? "xs-only:py-[0.37rem] xs-only:px-[0.37rem]"
              : "xs-only:py-[0.46rem] xs-only:px-[0.46rem]"
          }
          ${
            minimizado
              ? "sm-only:py-[0.4rem] sm-only:px-[0.4rem]"
              : "sm-only:py-2 sm-only:px-2"
          }
          ${
            minimizado
              ? "landscape-small:py-[0.34rem] landscape-small:px-[0.34rem]"
              : "landscape-small:py-[0.425rem] landscape-small:px-[0.425rem]"
          }
          ${
            minimizado
              ? "landscape-tablet-sm:py-[0.34rem] landscape-tablet-sm:px-[0.34rem]"
              : "landscape-tablet-sm:py-[0.425rem] landscape-tablet-sm:px-[0.425rem]"
          }
          transition-all duration-200 hover:bg-opacity-90 active:scale-95
        `}
          >
            Cambiar Foto
            <CamaraIcon
              className={`
            ${minimizado ? "w-[15px]" : "w-5"} 
            ${minimizado ? "sxs-only:w-[14.7px]" : "sxs-only:w-[18.4px]"} 
            ${minimizado ? "xs-only:w-[14.7px]" : "xs-only:w-[18.4px]"} 
            ${minimizado ? "sm-only:w-[14.7px]" : "sm-only:w-[18.4px]"}
            ${minimizado ? "md-only:w-[15px]" : "md-only:w-5"}
            ${minimizado ? "lg-only:w-[15px]" : "lg-only:w-5"}
            ${
              minimizado
                ? "landscape-small:w-[13.6px]"
                : "landscape-small:w-[17px]"
            }
            ${
              minimizado
                ? "landscape-tablet-sm:w-[13.6px]"
                : "landscape-tablet-sm:w-[17px]"
            }
          `}
            />
          </button>

          {/* Condicionalmente renderizar el botón Ver Asistencia solo si NO está minimizado */}
          {!minimizado && (
            <Link
              className={`
            w-[9rem]
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
          `}
              href={`/mis-estudiantes-relacionados/${miEstudianteRelacionado.Id_Estudiante}/asistencias-mensuales`}
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
            </Link>
          )}

          {miEstudianteRelacionado.aula && (
            <button
              onClick={() => setShowGenerarQRDelEstudianteModal(Id_Estudiante)}
              className={`
            ${minimizado ? "w-[7.2rem]" : "w-[9rem]"}
            ${minimizado ? "sxs-only:w-[6.6rem]" : "sxs-only:w-[8.28rem]"}
            ${minimizado ? "xs-only:w-[6.6rem]" : "xs-only:w-[8.28rem]"} 
            ${minimizado ? "sm-only:w-[6.6rem]" : "sm-only:w-[8.28rem]"}
            ${
              minimizado
                ? "landscape-small:w-[6.1rem]"
                : "landscape-small:w-[7.65rem]"
            }
            ${
              minimizado
                ? "landscape-tablet-sm:w-[6.1rem]"
                : "landscape-tablet-sm:w-[7.65rem]"
            }
            text-white flex items-center justify-center bg-negro 
            ${minimizado ? "gap-[0.4rem]" : "gap-2"} 
            ${minimizado ? "sxs-only:gap-[0.37rem]" : "sxs-only:gap-[0.46rem]"}
            ${minimizado ? "xs-only:gap-[0.37rem]" : "xs-only:gap-[0.46rem]"}
            ${
              minimizado
                ? "landscape-small:gap-[0.34rem]"
                : "landscape-small:gap-[0.425rem]"
            }
            ${
              minimizado
                ? "landscape-tablet-sm:gap-[0.34rem]"
                : "landscape-tablet-sm:gap-[0.425rem]"
            }
            ${minimizado ? "rounded-[8px]" : "rounded-[10px]"} 
            ${
              minimizado
                ? "sxs-only:rounded-[7.4px]"
                : "sxs-only:rounded-[9.2px]"
            } 
            ${
              minimizado ? "xs-only:rounded-[7.4px]" : "xs-only:rounded-[9.2px]"
            }
            ${
              minimizado
                ? "landscape-small:rounded-[6.8px]"
                : "landscape-small:rounded-[8.5px]"
            } 
            ${
              minimizado
                ? "landscape-tablet-sm:rounded-[6.8px]"
                : "landscape-tablet-sm:rounded-[8.5px]"
            }
            ${minimizado ? "py-[0.4rem] px-[0.4rem]" : "py-2 px-2"} 
            ${
              minimizado
                ? "sxs-only:py-[0.37rem] sxs-only:px-[0.37rem]"
                : "sxs-only:py-[0.46rem] sxs-only:px-[0.46rem]"
            }
            ${
              minimizado
                ? "xs-only:py-[0.37rem] xs-only:px-[0.37rem]"
                : "xs-only:py-[0.46rem] xs-only:px-[0.46rem]"
            }
            ${
              minimizado
                ? "sm-only:py-[0.4rem] sm-only:px-[0.4rem]"
                : "sm-only:py-2 sm-only:px-2"
            }
            ${
              minimizado
                ? "landscape-small:py-[0.34rem] landscape-small:px-[0.34rem]"
                : "landscape-small:py-[0.425rem] landscape-small:px-[0.425rem]"
            }
            ${
              minimizado
                ? "landscape-tablet-sm:py-[0.34rem] landscape-tablet-sm:px-[0.34rem]"
                : "landscape-tablet-sm:py-[0.425rem] landscape-tablet-sm:px-[0.425rem]"
            }
            transition-all duration-200 hover:bg-opacity-90 active:scale-95
          `}
            >
              Generar QR
              <QRIcon
                className={`
            ${minimizado ? "w-[14.4px]" : "w-[18px]"} 
            ${minimizado ? "sxs-only:w-[13.25px]" : "sxs-only:w-[16.56px]"} 
            ${minimizado ? "xs-only:w-[13.25px]" : "xs-only:w-[16.56px]"} 
            ${minimizado ? "sm-only:w-[13.25px]" : "sm-only:w-[16.56px]"}
            ${minimizado ? "md-only:w-[13.6px]" : "md-only:w-[17px]"}
            ${minimizado ? "lg-only:w-[14.4px]" : "lg-only:w-[18px]"}
            ${
              minimizado
                ? "landscape-small:w-[12.2px]"
                : "landscape-small:w-[15.3px]"
            }
            ${
              minimizado
                ? "landscape-tablet-sm:w-[12.2px]"
                : "landscape-tablet-sm:w-[15.3px]"
            }
          `}
              />
            </button>
          )}
        </section>

        <span
          className={`
            font-semibold
            ${Estado ? "text-verde-principal" : "text-rojo-oscuro"}
            text-center ${minimizado ? "mt-[0.37rem]" : "mt-2"}
            ${minimizado ? "text-[11.25px]" : "text-[15px]"}
            ${minimizado ? "sxs-only:text-[10.35px]" : "sxs-only:text-[13.8px]"}
            ${minimizado ? "xs-only:text-[10.35px]" : "xs-only:text-[13.8px]"}
            ${minimizado ? "sm-only:text-[10.35px]" : "sm-only:text-[13.8px]"}
            ${minimizado ? "md-only:text-[11.25px]" : "md-only:text-[15px]"}
            ${minimizado ? "lg-only:text-[11.25px]" : "lg-only:text-[15px]"}
            ${
              minimizado
                ? "landscape-small:text-[9.56px]"
                : "landscape-small:text-[12.75px]"
            }
            ${
              minimizado
                ? "landscape-tablet-sm:text-[9.56px]"
                : "landscape-tablet-sm:text-[12.75px]"
            }
            ${minimizado ? "sxs-only:mt-[0.34rem]" : "sxs-only:mt-[0.46rem]"}
            ${minimizado ? "xs-only:mt-[0.34rem]" : "xs-only:mt-[0.46rem]"}
            ${
              minimizado
                ? "landscape-small:mt-[0.32rem]"
                : "landscape-small:mt-[0.425rem]"
            }
            ${
              minimizado
                ? "landscape-tablet-sm:mt-[0.32rem]"
                : "landscape-tablet-sm:mt-[0.425rem]"
            }
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
