import { RequestCookie } from "next/dist/compiled/@edge-runtime/cookies";
import React from "react";
import Header from "./Header";
import { RolesSistema } from "../../../interfaces/shared/RolesSistema";
import NavBarFooter from "./NavBarFooter";

const PlantillaProfesorSecundaria = ({
  children,
  Nombres,
  Apellidos,
  Genero,
  Google_Drive_Foto_ID,
}: {
  children: React.ReactNode;
  Nombres: RequestCookie;
  Apellidos: RequestCookie;
  Genero: RequestCookie;
  Google_Drive_Foto_ID: string | null;
}) => {
  return (
    <main className="w-full grid grid-rows-[min-content_1fr_min-content] min-h-[100dvh]">
      <Header
        Genero={Genero}
        Nombres={Nombres}
        Apellidos={Apellidos}
        Rol={RolesSistema.ProfesorSecundaria}
        Google_Drive_Foto_ID={Google_Drive_Foto_ID}
      />
      <main className=" py-4 px-4 min-h-full min-w-full flex justify-center items-center">
        {children}
      </main>
      <NavBarFooter Rol={RolesSistema.ProfesorSecundaria} />
    </main>
  );
};

export default PlantillaProfesorSecundaria;
