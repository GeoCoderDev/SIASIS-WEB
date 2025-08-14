import { AuxiliarSinContraseña } from "@/interfaces/shared/apis/shared/others/types";
import FotoPerfilClientSide from "../../../../../components/utils/photos/FotoPerfilClientSide";
import TelefonoIcon from "../../../../../components/icons/TelefonoIcon";
import BotonConIcono from "../../../../../components/buttons/BotonConIcono";
import VerEditarIcon from "@/components/icons/VerEditarIcon";
import { Link } from "next-view-transitions";

const AuxiliarCard = ({
  Auxiliar: {
    Apellidos,
    Celular,
    Correo_Electronico,
    Id_Auxiliar,
    Estado,
    Nombres,
    Nombre_Usuario,
    Google_Drive_Foto_ID,
  },
}: {
  Auxiliar: AuxiliarSinContraseña;
}) => {
  return (
    <div
      className="w-[285px] h-[355px] 
                   sxs-only:w-[220.8px] sxs-only:h-[303.6px] 
                   xs-only:w-[230px] xs-only:h-[312.8px] 
                   sm-only:w-[248.4px] sm-only:h-[317.4px] 
                   md-only:w-[280px] lg-only:w-[285px] xl-only:w-[285px]
                   landscape-small:w-[242.25px] landscape-small:h-[301.75px]
                   landscape-tablet-sm:w-[242.25px] landscape-tablet-sm:h-[301.75px]
                   rounded-[15px] 
                   sxs-only:rounded-[13.8px] xs-only:rounded-[13.8px] sm-only:rounded-[13.8px]
                   landscape-small:rounded-[12.75px] landscape-tablet-sm:rounded-[12.75px]
                   shadow-[0_0_6px_3px_rgba(0,0,0,0.15)] flex flex-col items-center justify-center 
                   py-4 sxs-only:py-[0.92rem] xs-only:py-[0.92rem] sm-only:py-4 
                   landscape-small:py-[0.85rem] landscape-tablet-sm:py-[0.85rem]
                   px-3 sxs-only:px-[0.46rem] 
                   landscape-small:px-[0.64rem] landscape-tablet-sm:px-[0.64rem]
                   gap-2 sxs-only:gap-[0.46rem] xs-only:gap-[0.46rem]
                   landscape-small:gap-[0.425rem] landscape-tablet-sm:gap-[0.425rem]
                   bg-white overflow-hidden"
    >
      <FotoPerfilClientSide
        className="w-[75px] h-[75px] 
                  sxs-only:w-[55.2px] sxs-only:h-[55.2px] 
                  xs-only:w-[59.8px] xs-only:h-[59.8px] 
                  sm-only:w-[64.4px] sm-only:h-[64.4px]
                  landscape-small:w-[63.75px] landscape-small:h-[63.75px]
                  landscape-tablet-sm:w-[63.75px] landscape-tablet-sm:h-[63.75px]
                  rounded-full object-cover"
        Google_Drive_Foto_ID={Google_Drive_Foto_ID}
      />

      <span
        className="text-[19px] 
                  sxs-only:text-[14.72px] xs-only:text-[15.64px] sm-only:text-[16.56px]
                  landscape-small:text-[16.15px] landscape-tablet-sm:text-[16.15px]
                  font-semibold text-negro whitespace-nowrap overflow-hidden text-ellipsis w-full text-center"
        title={`${Nombres} ${Apellidos}`}
      >
        {Nombres} {Apellidos}
      </span>

      <span
        className="text-[17px] 
                  sxs-only:text-[13.8px] xs-only:text-[14.72px] 
                  landscape-small:text-[14.45px] landscape-tablet-sm:text-[14.45px]
                  font-medium text-azul-principal text-center"
        title={Id_Auxiliar}
      >
        {Id_Auxiliar}
      </span>

      <span
        className="italic text-[15px] 
                  sxs-only:text-[11.96px] 
                  landscape-small:text-[12.75px] landscape-tablet-sm:text-[12.75px]
                  text-negro font-bold whitespace-nowrap overflow-hidden text-ellipsis w-full text-center"
        title={Nombre_Usuario}
      >
        {Nombre_Usuario}
      </span>

      <div
        className="flex items-center justify-center gap-1 text-[15px] 
                     sxs-only:text-[11.96px] 
                     landscape-small:text-[12.75px] landscape-tablet-sm:text-[12.75px]
                     text-negro
                     sxs-only:gap-[0.23rem] xs-only:gap-[0.23rem]
                     landscape-small:gap-[0.212rem] landscape-tablet-sm:gap-[0.212rem]"
      >
        <TelefonoIcon
          className="w-[1.1rem] 
                                sxs-only:w-[1.012rem] 
                                landscape-small:w-[0.935rem] landscape-tablet-sm:w-[0.935rem]
                                text-verde-principal"
        />
        <span title={Celular}>{Celular}</span>
      </div>

      <span
        className="text-[13px] 
                  sxs-only:text-[10.12px] 
                  landscape-small:text-[11.05px] landscape-tablet-sm:text-[11.05px]
                  text-negro font-bold whitespace-nowrap overflow-hidden text-ellipsis w-full text-center"
        title={Correo_Electronico || undefined}
      >
        {Correo_Electronico}
      </span>

      <span
        className={`text-[15px] 
                   sxs-only:text-[11.96px] 
                   landscape-small:text-[12.75px] landscape-tablet-sm:text-[12.75px]
                   font-semibold text-center ${
                     Estado ? "text-verde-principal" : "text-rojo-oscuro"
                   }`}
        title={`Estado: ${Estado ? "Activo" : "Inactivo"}`}
      >
        Estado: {Estado ? "Activo" : "Inactivo"}
      </span>

      <Link
        href={`/auxiliares/${Id_Auxiliar}`}
        className="mt-2 
                                                           sxs-only:mt-[0.46rem] xs-only:mt-[0.46rem]
                                                           landscape-small:mt-[0.425rem] landscape-tablet-sm:mt-[0.425rem]"
      >
        <BotonConIcono
          className="bg-amarillo-ediciones text-negro font-medium flex gap-1 items-center 
                    px-2.5 py-1.5 sxs-only:px-[0.46rem] sxs-only:py-[0.23rem] 
                    landscape-small:px-[0.531rem] landscape-small:py-[0.318rem] landscape-small:gap-[0.212rem]
                    landscape-tablet-sm:px-[0.531rem] landscape-tablet-sm:py-[0.318rem] landscape-tablet-sm:gap-[0.212rem]
                    rounded text-[15px] sxs-only:text-[11.96px]
                    landscape-small:text-[12.75px] landscape-tablet-sm:text-[12.75px]"
          texto="Ver/Editar"
          IconTSX={
            <VerEditarIcon
              className="w-4 h-4 
                                     sxs-only:w-[14.72px] sxs-only:h-[14.72px]
                                     landscape-small:w-[13.6px] landscape-small:h-[13.6px]
                                     landscape-tablet-sm:w-[13.6px] landscape-tablet-sm:h-[13.6px]"
            />
          }
        />
      </Link>
    </div>
  );
};

export default AuxiliarCard;
