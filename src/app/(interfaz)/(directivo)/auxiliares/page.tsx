"use client";

import { useEffect, useState } from "react";
import { AuxiliarSinContraseña } from "../../../../interfaces/shared/apis/shared/others/types";
import AuxiliardCard from "./_components/AuxiliarCard";
import ErrorMessage from "@/components/shared/errors/ErrorMessage";
import { ErrorResponseAPIBase } from "@/interfaces/shared/apis/types";

import Loader from "@/components/shared/loaders/Loader";
import { AuxiliaresIDB } from "@/lib/utils/local/db/models/AuxiliaresIDB";

const Auxiliares = () => {
  const [auxiliares, setAuxiliares] = useState<AuxiliarSinContraseña[]>();

  const [isSomethingLoading, setIsSomethingLoading] = useState(true);
  const [error, setError] = useState<ErrorResponseAPIBase | null>(null);

  useEffect(() => {
    const getAuxiliares = async () => {
      const auxiliares = await new AuxiliaresIDB(
        "API01",
        setIsSomethingLoading,
        setError
      ).getAll();

      setAuxiliares(auxiliares);
    };

    getAuxiliares();
  }, []);

  return (
    <div className="w-full max-w-[80rem] h-full flex flex-col justify-between">
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
        LISTA DE AUXILIARES
      </h1>

      {error && <ErrorMessage error={error} />}

      {!isSomethingLoading && auxiliares && auxiliares.length === 0 && (
        <span
          className="sxs-only:text-[11px] xs-only:text-[12px] sm-only:text-[13px] 
                        landscape-small:text-[10.2px] landscape-tablet-sm:text-[10.2px]
                        text-center w-full"
        >
          No se encontraron Auxiliares Registrados en el Sistema
        </span>
      )}

      <div
        className="flex flex-col items-center w-full flex-1 pt-8 
                     sxs-only:pt-[1.38rem] xs-only:pt-[1.61rem] sm-only:pt-[1.61rem] md-only:pt-8
                     landscape-small:pt-[1.7rem] landscape-tablet-sm:pt-[1.7rem]"
      >
        {isSomethingLoading && (
          <span
            className="sxs-only:text-[11px] xs-only:text-[12px] sm-only:text-[13px] 
                          landscape-small:text-[10.2px] landscape-tablet-sm:text-[10.2px]
                          flex items-center"
          >
            Actualizando
            <Loader
              className="w-[2rem] sxs-only:w-[1.84rem] xs-only:w-[1.84rem] 
                              landscape-small:w-[1.7rem] landscape-tablet-sm:w-[1.7rem]
                              p-2 sxs-only:p-[0.46rem] bg-black ml-2
                              landscape-small:ml-[0.425rem] landscape-tablet-sm:ml-[0.425rem]"
            />
          </span>
        )}
        {auxiliares && (
          <div
            className="flex flex-wrap justify-center w-full 
                         gap-y-6 sxs-only:gap-y-[0.92rem] xs-only:gap-y-[1.15rem] 
                         gap-x-4 sxs-only:gap-x-[0.46rem] xs-only:gap-x-[0.69rem]
                         landscape-small:gap-y-[1.275rem] landscape-small:gap-x-[0.85rem]
                         landscape-tablet-sm:gap-y-[1.275rem] landscape-tablet-sm:gap-x-[0.85rem]"
          >
            {auxiliares.map((auxiliar) => (
              <AuxiliardCard key={auxiliar.Id_Auxiliar} Auxiliar={auxiliar} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Auxiliares;
