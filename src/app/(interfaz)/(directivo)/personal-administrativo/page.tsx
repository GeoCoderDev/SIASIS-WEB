"use client";
import { PersonalAdministrativoSinContraseña } from "@/interfaces/shared/apis/shared/others/types";
import { ErrorResponseAPIBase } from "@/interfaces/shared/apis/types";
import React, { useEffect, useState } from "react";

import ErrorMessage from "@/components/shared/errors/ErrorMessage";
import Loader from "@/components/shared/loaders/Loader";
import PersonalAdministrativoCard from "./_components/PersonalAdministrativoCard";
import { PersonalAdministrativoIDB } from "@/lib/utils/local/db/models/PersonalAdministrativoIDB";

const PersonalAdministrativo = () => {
  const [personalAdministrivo, setPersonalAdministrivo] =
    useState<PersonalAdministrativoSinContraseña[]>();

  const [isSomethingLoading, setIsSomethingLoading] = useState(true);
  const [error, setError] = useState<ErrorResponseAPIBase | null>(null);

  useEffect(() => {
    const getPersonalAdministrativo = async () => {
      const personalAdministrativo = await new PersonalAdministrativoIDB(
        "API01",
        setIsSomethingLoading,
        setError
      ).getAll();

      setPersonalAdministrivo(personalAdministrativo);
    };

    getPersonalAdministrativo();
  }, []);

  return (
    <div className="w-full max-w-[80rem] h-full flex flex-col justify-start">
      <div className="flex flex-col items-center">
        <h1
          className="text-[2.185rem] 
                      sxs-only:text-[1.587rem] 
                      xs-only:text-[1.693rem] 
                      sm-only:text-[1.799rem] 
                      md-only:text-[1.905rem]
                      landscape-small:text-[1.857rem] 
                      landscape-tablet-sm:text-[1.857rem]
                      text-negro font-semibold mt-2 text-center
                      landscape-small:mt-[0.425rem] landscape-tablet-sm:mt-[0.425rem]"
        >
          LISTA DE P. ADMINISTRATIVO
        </h1>

        {isSomethingLoading && (
          <span
            className="mt-4 sxs-only:mt-[0.92rem] xs-only:mt-[0.92rem]
                          landscape-small:mt-[0.85rem] landscape-tablet-sm:mt-[0.85rem]
                          sxs-only:text-[11px] xs-only:text-[12px] sm-only:text-[13px]
                          landscape-small:text-[10.2px] landscape-tablet-sm:text-[10.2px]
                          flex items-center gap-2
                          sxs-only:gap-[0.46rem] xs-only:gap-[0.46rem]
                          landscape-small:gap-[0.425rem] landscape-tablet-sm:gap-[0.425rem]"
          >
            Actualizando
            <Loader
              className="w-[2rem] p-2 bg-black
                              sxs-only:w-[1.84rem] sxs-only:p-[0.46rem]
                              landscape-small:w-[1.7rem] landscape-small:p-[0.425rem]
                              landscape-tablet-sm:w-[1.7rem] landscape-tablet-sm:p-[0.425rem]"
            />
          </span>
        )}

        {error && <ErrorMessage error={error} />}

        {!isSomethingLoading &&
          personalAdministrivo &&
          personalAdministrivo.length === 0 && (
            <span
              className="sxs-only:text-[11px] xs-only:text-[12px] sm-only:text-[13px]
                            landscape-small:text-[10.2px] landscape-tablet-sm:text-[10.2px]"
            >
              No se encontro Personal Administrativo registrado en el Sistema
            </span>
          )}
      </div>

      <div
        className="mt-7 xs-only:mt-[1.38rem] sxs-only:mt-[1.15rem] 
                     landscape-small:mt-[1.487rem] landscape-tablet-sm:mt-[1.487rem]
                     flex flex-wrap justify-center w-full 
                     gap-y-7 sxs-only:gap-y-[1.15rem] xs-only:gap-y-[1.38rem] 
                     gap-x-8 sxs-only:gap-x-[0.92rem] xs-only:gap-x-[0.92rem]
                     landscape-small:gap-y-[1.487rem] landscape-small:gap-x-[1.7rem]
                     landscape-tablet-sm:gap-y-[1.487rem] landscape-tablet-sm:gap-x-[1.7rem]"
      >
        {personalAdministrivo &&
          personalAdministrivo.map((unPersonal) => (
            <PersonalAdministrativoCard
              key={unPersonal.Id_Personal_Administrativo}
              PersonalAdministrativo={unPersonal}
            />
          ))}
      </div>
    </div>
  );
};

export default PersonalAdministrativo;
