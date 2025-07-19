"use client";
import GenerosTextos from "@/Assets/GenerosTextos";
import BotonConIcono from "@/components/buttons/BotonConIcono";
import DatoFormularioConEtiqueta from "@/components/forms/DatoFomularioConEtiqueta";
import FormSection from "@/components/forms/FormSection";
import CandadoUpdate from "@/components/icons/CandadoUpdate";
import EquisIcon from "@/components/icons/EquisIcon";
import LapizIcon from "@/components/icons/LapizIcon";
import MemoriaIcon from "@/components/icons/MemoriaIcon";
import MyUserCard from "@/components/shared/cards/UserCard";
import ErrorMessage from "@/components/shared/errors/ErrorMessage";
import SuccessMessage from "@/components/shared/successes/SuccessMessage";
import { Genero } from "@/interfaces/shared/Genero";
import deepEqualsObjects from "@/lib/helpers/compares/deepEqualsObjects";
import { Loader } from "lucide-react";
import React, { useEffect, useState } from "react";
import CambiarMiContraseñaModal from "@/components/modals/CambiarMiContraseñaModal";
import CambiarFotoModal from "@/components/modals/CambiarFotoModal";
import { RolesSistema } from "@/interfaces/shared/RolesSistema";
import userStorage from "@/lib/utils/local/db/models/UserStorage";
import {
  ApiResponseBase,
  SuccessResponseAPIBase,
} from "@/interfaces/shared/apis/types";

import useRequestAPIFeatures from "@/hooks/useRequestSiasisAPIFeatures";
import { T_Personal_Administrativo } from "@prisma/client";
import {
  ActualizarMisDatosPersonalAdministrativoRequestBody,
  MisDatosPersonalAdministrativo,
  MisDatosErrorResponseAPI01,
  MisDatosSuccessResponseAPI01,
} from "@/interfaces/shared/apis/api01/mis-datos/types";

const MisDatosDePersonalAdministrativo = ({
  googleDriveFotoIdCookieValue,
  nombresCookieValue,
  apellidosCookieValue,
  generoCookieValue,
}: {
  googleDriveFotoIdCookieValue: string | null;
  nombresCookieValue: string | null;
  apellidosCookieValue: string | null;
  generoCookieValue: Genero | null;
}) => {
  const [modoEdicion, setModoEdicion] = useState(false);

  const [cambiarFotoModal, setCambiarFotoModal] = useState(false);
  const [cambiarContraseñaModal, setCambiarContraseñaModal] = useState(false);

  const [
    misDatosPersonalAdministrativoSaved,
    setMisDatosPersonalAdministrativoSaved,
  ] = useState<Partial<T_Personal_Administrativo>>({
    Google_Drive_Foto_ID: googleDriveFotoIdCookieValue || undefined,
  });

  const [
    misDatosPersonalAdministrativoModificados,
    setMisDatosPersonalAdministrativoModificados,
  ] = useState<Partial<T_Personal_Administrativo>>({});

  const {
    error,
    setError,
    fetchSiasisAPI,
    isSomethingLoading,
    setIsSomethingLoading,
    setSuccessMessage,
    successMessage,
  } = useRequestAPIFeatures("API01", true);

  const updateFoto = async (Google_Drive_Foto_ID: string | null) => {
    setMisDatosPersonalAdministrativoSaved((prev) => ({
      ...prev,
      Google_Drive_Foto_ID,
    }));

    fetch("/api/auth/update-cookies", {
      method: "PUT",
      body: JSON.stringify({
        Google_Drive_Foto_ID,
      }),
    });

    await userStorage.saveUserData({
      Google_Drive_Foto_ID,
    });
  };

  useEffect(() => {
    if (!fetchSiasisAPI) return;

    const fetchMisDatos = async () => {
      setIsSomethingLoading(true);
      try {
        const fetchCancelable = await fetchSiasisAPI({
          endpoint: "/api/mis-datos",
          method: "GET",
        });

        if (!fetchCancelable) throw new Error();

        const res = await fetchCancelable.fetch();

        const responseJson = (await res.json()) as ApiResponseBase;

        if (!responseJson.success) {
          return setError(responseJson as MisDatosErrorResponseAPI01);
        }

        const misDatosPersonalAdministrativoData = (
          responseJson as MisDatosSuccessResponseAPI01
        ).data as MisDatosPersonalAdministrativo;

        setMisDatosPersonalAdministrativoModificados(
          misDatosPersonalAdministrativoData
        );

        setMisDatosPersonalAdministrativoSaved(
          misDatosPersonalAdministrativoData
        );

        //Actualizando Cache

        await userStorage.saveUserData({
          Apellidos: misDatosPersonalAdministrativoData.Apellidos,
          Genero: misDatosPersonalAdministrativoData.Genero,
          Google_Drive_Foto_ID:
            misDatosPersonalAdministrativoData.Google_Drive_Foto_ID,
          Nombres: misDatosPersonalAdministrativoData.Nombres,
        });

        setIsSomethingLoading(false);

        //Actualizando Cookies por lo bajo
        if (
          googleDriveFotoIdCookieValue !==
            misDatosPersonalAdministrativoData.Google_Drive_Foto_ID ||
          nombresCookieValue !== misDatosPersonalAdministrativoData.Nombres ||
          apellidosCookieValue !==
            misDatosPersonalAdministrativoData.Apellidos ||
          generoCookieValue !== misDatosPersonalAdministrativoData.Genero
        ) {
          fetch("/api/auth/update-cookies", {
            method: "PUT",
            body: JSON.stringify({
              Google_Drive_Foto_ID:
                misDatosPersonalAdministrativoData.Google_Drive_Foto_ID,
              Nombres: misDatosPersonalAdministrativoData.Nombres,
              Apellidos: misDatosPersonalAdministrativoData.Apellidos,
              Genero: misDatosPersonalAdministrativoData.Genero,
            }),
          });
        }

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
        if (error) {
          setError({
            message: "Error al obtener tus datos, vuelve a inténtalo más tarde",
            success: false,
          });
        }
        setIsSomethingLoading(false);
      }
    };

    fetchMisDatos();
  }, [fetchSiasisAPI, setError]);

  const handleSubmitUpdateData = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSomethingLoading(true);
    setError(null);
    try {
      const fetchCancelable = await fetchSiasisAPI({
        endpoint: "/api/mis-datos",
        method: "PUT",
        body: JSON.stringify({
          Celular: misDatosPersonalAdministrativoModificados.Celular,
        } as ActualizarMisDatosPersonalAdministrativoRequestBody),
        queryParams: {
          Rol: RolesSistema.PersonalAdministrativo,
        },
      });

      if (!fetchCancelable) throw new Error();

      const res = await fetchCancelable.fetch();

      const responseJson = (await res.json()) as ApiResponseBase;

      if (!responseJson.success) {
        setIsSomethingLoading(false);
        return setError(responseJson as MisDatosErrorResponseAPI01);
      }

      const { message } = responseJson as SuccessResponseAPIBase;

      setSuccessMessage({ message });

      setMisDatosPersonalAdministrativoSaved(
        misDatosPersonalAdministrativoModificados
      );

      //Actualizando Cache
      await userStorage.saveUserData({
        Apellidos: misDatosPersonalAdministrativoModificados.Apellidos,
        Genero: misDatosPersonalAdministrativoModificados.Genero as Genero,
        Google_Drive_Foto_ID:
          misDatosPersonalAdministrativoModificados.Google_Drive_Foto_ID,
        Nombres: misDatosPersonalAdministrativoModificados.Nombres,
      });

      fetch("/api/auth/update-cookies", {
        method: "PUT",
        body: JSON.stringify({
          Nombres: misDatosPersonalAdministrativoModificados.Nombres,
          Apellidos: misDatosPersonalAdministrativoModificados.Apellidos,
        }),
      });

      setIsSomethingLoading(false);
      setModoEdicion(false);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      if (error) {
        setError({
          message:
            "Error al actualizar tus datos, vuelve a inténtalo más tarde",
          success: false,
        });
      }
      setIsSomethingLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setError(null);
    const { name, value } = e.target;
    setMisDatosPersonalAdministrativoModificados((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <>
      {cambiarFotoModal && (
        <CambiarFotoModal
          siasisAPI="API01"
          Rol={RolesSistema.PersonalAdministrativo}
          updateFoto={(googleDriveFotoId: string) => {
            updateFoto(googleDriveFotoId);
          }}
          onSuccess={() => {
            setSuccessMessage({
              message: "Se actualizo correctamente la Foto",
            });
          }}
          initialSource={
            misDatosPersonalAdministrativoSaved.Google_Drive_Foto_ID &&
            `https://drive.google.com/thumbnail?id=${misDatosPersonalAdministrativoSaved.Google_Drive_Foto_ID}`
          }
          eliminateModal={() => {
            setCambiarFotoModal(false);
          }}
        />
      )}
      {cambiarContraseñaModal && (
        <CambiarMiContraseñaModal
          siasisAPI="API01"
          onSuccess={() => {
            setSuccessMessage({
              message: "Se actualizo la contraseña correctamente",
            });
          }}
          Rol={RolesSistema.PersonalAdministrativo}
          eliminateModal={() => {
            setCambiarContraseñaModal(false);
          }}
        />
      )}

      <div className="@container -border-2 border-blue-500 w-full lg:w-[85%] max-w-[75rem] h-full grid grid-cols-7 grid-rows-[min-content_1fr] gap-y-4 md:gap-0 max-md:p-[min(1rem,3vw)] py-1.5">
        {/* SECCION DE BOTONES */}
        <div className="flex col-span-full -border-2 flex-wrap py-2 justify-start items-center gap-x-6 gap-y-2">
          <h1
            className="font-medium 
            sxs-only:text-[1.55rem] xs-only:text-[1.65rem] sm-only:text-[1.75rem] md-only:text-[1.9rem] lg-only:text-[2.1rem] xl-only:text-[2.4rem]"
          >
            MIS DATOS
          </h1>
          {!isSomethingLoading && (
            <BotonConIcono
              texto={modoEdicion ? "Cancelar Edición" : "Editar Datos"}
              IconTSX={
                !modoEdicion ? (
                  <LapizIcon className="w-[0.95rem]" />
                ) : (
                  <EquisIcon className="text-blanco w-[0.85rem]" />
                )
              }
              onClick={() => {
                //SI se esta cancelando el modo edicion entonces se volvera al
                // estado en el que se encuentran los datos guardados en la base de datos
                if (modoEdicion)
                  setMisDatosPersonalAdministrativoModificados(
                    misDatosPersonalAdministrativoSaved
                  );
                setModoEdicion(!modoEdicion);
              }}
              className={`${
                modoEdicion
                  ? "bg-rojo-oscuro text-blanco"
                  : "bg-amarillo-ediciones text-negro"
              }  gap-[0.5rem] content-center font-semibold px-[0.6rem] py-[0.35rem] rounded-[6px] 
              sxs-only:text-[0.75rem] xs-only:text-[0.8rem] sm-only:text-[0.85rem] md-only:text-[0.9rem] lg-only:text-[0.95rem] xl-only:text-[1rem]`}
            />
          )}
        </div>

        {/* SECCION DEL FORMULARIO */}
        <div className="col-span-full @lg:col-span-4 -border-2 justify-center">
          <form onSubmit={handleSubmitUpdateData}>
            <div className="flex flex-col gap-3 justify-center items-center">
              {error && (
                <ErrorMessage error={error} closable duration={12000} />
              )}

              {successMessage && (
                <SuccessMessage
                  className="mb-[-1rem]"
                  closable
                  duration={7000}
                  {...successMessage}
                />
              )}
              <FormSection titulo="Información Personal">
                <DatoFormularioConEtiqueta<T_Personal_Administrativo>
                  inputAttributes={{
                    minLength: 8,
                    maxLength: 8,
                    required: true,
                    disabled: isSomethingLoading,
                  }}
                  isSomethingLoading={isSomethingLoading}
                  modoEdicion={modoEdicion}
                  etiqueta="DNI"
                  nombreDato="DNI_Personal_Administrativo"
                  savedValue={
                    misDatosPersonalAdministrativoSaved.DNI_Personal_Administrativo
                  }
                  onChange={handleChange}
                  className="sxs-only:text-[1.105rem] xs-only:text-[1.17rem] sm-only:text-[1.235rem] md-only:text-[1.3rem] lg-only:text-[1.365rem] xl-only:text-[1.43rem]"
                  fullWidth
                />
                <DatoFormularioConEtiqueta<T_Personal_Administrativo>
                  inputAttributes={{
                    minLength: 2,
                    maxLength: 60,
                    required: true,
                    disabled: isSomethingLoading,
                  }}
                  isSomethingLoading={isSomethingLoading}
                  modoEdicion={modoEdicion}
                  etiqueta="Nombres"
                  nombreDato="Nombres"
                  onChange={handleChange}
                  savedValue={misDatosPersonalAdministrativoSaved.Nombres}
                />
                <DatoFormularioConEtiqueta<T_Personal_Administrativo>
                  inputAttributes={{
                    minLength: 2,
                    maxLength: 60,
                    required: true,
                    disabled: isSomethingLoading,
                  }}
                  isSomethingLoading={isSomethingLoading}
                  modoEdicion={modoEdicion}
                  etiqueta="Apellidos"
                  nombreDato="Apellidos"
                  onChange={handleChange}
                  savedValue={misDatosPersonalAdministrativoSaved.Apellidos}
                />
                <DatoFormularioConEtiqueta<T_Personal_Administrativo>
                  isSomethingLoading={isSomethingLoading}
                  modoEdicion={modoEdicion}
                  etiqueta="Género"
                  nombreDato="Genero"
                  onChange={handleChange}
                  inputType="select"
                  selectValues={{
                    [Genero.Masculino]: GenerosTextos.M,
                    [Genero.Femenino]: GenerosTextos.F,
                  }}
                  selectAttributes={{ disabled: isSomethingLoading }}
                  skeletonClassName={{ className: "min-w-[1.1rem]" }}
                  savedValue={misDatosPersonalAdministrativoSaved.Genero}
                />

                <DatoFormularioConEtiqueta<T_Personal_Administrativo>
                  inputAttributes={{
                    minLength: 9,
                    maxLength: 9,
                    required: true,
                    disabled: isSomethingLoading,
                  }}
                  isSomethingLoading={isSomethingLoading}
                  modoEdicion={modoEdicion}
                  inputType="text"
                  etiqueta="Celular"
                  nombreDato="Celular"
                  modificable
                  modificatedValue={
                    misDatosPersonalAdministrativoModificados.Celular
                  }
                  onChange={handleChange}
                  savedValue={misDatosPersonalAdministrativoSaved.Celular}
                />
              </FormSection>

              {modoEdicion && (
                <BotonConIcono
                  LoaderTSX={
                    <Loader className="w-[1.3rem] p-[0.2rem] bg-negro" />
                  }
                  isSomethingLoading={isSomethingLoading}
                  disabled={deepEqualsObjects(
                    misDatosPersonalAdministrativoSaved,
                    misDatosPersonalAdministrativoModificados
                  )}
                  titleDisabled="Aun no has modificado nada"
                  typeButton="submit"
                  className="w-max content-center font-semibold p-3 py-2 rounded-[10px] bg-amarillo-ediciones gap-2 sxs-only:text-[0.75rem] xs-only:text-[0.8rem] sm-only:text-[0.85rem] md-only:text-[0.9rem] lg-only:text-[0.95rem] xl-only:text-[1rem]"
                  texto="Guardar Cambios"
                  IconTSX={
                    <MemoriaIcon className="w-[1.4rem] sxs-only:w-[0.85rem] xs-only:w-[0.9rem] sm-only:w-[0.95rem] md-only:w-[1rem] lg-only:w-[1.1rem] xl-only:w-[1.2rem]" />
                  }
                />
              )}

              <FormSection titulo="Informacion del Usuario">
                <DatoFormularioConEtiqueta<T_Personal_Administrativo>
                  isSomethingLoading={isSomethingLoading}
                  modoEdicion={modoEdicion}
                  etiqueta="Nombre de Usuario"
                  nombreDato="Nombre_Usuario"
                  savedValue={
                    misDatosPersonalAdministrativoSaved.Nombre_Usuario
                  }
                />
                <DatoFormularioConEtiqueta<T_Personal_Administrativo>
                  isSomethingLoading={isSomethingLoading}
                  modoEdicion={modoEdicion}
                  etiqueta="Contraseña"
                  nombreDato="Contraseña"
                  savedValue={
                    misDatosPersonalAdministrativoSaved.Nombre_Usuario
                  }
                  savedValueOculto
                  onChange={handleChange}
                  modificable
                  modificableConModal
                  IconTSX={<CandadoUpdate className="text-negro w-[1.3rem]" />}
                  setModalVisibility={setCambiarContraseñaModal}
                />
              </FormSection>
            </div>
          </form>
        </div>

        {/* SECCION DE USER CARD - Ahora usa container queries */}
        <div className="flex w-full h-full justify-center items-start @lg:row-auto row-start-2 col-span-full @lg:col-span-3 @lg:order-none order-2 p-4">
          <MyUserCard
            setCambiarFotoModal={setCambiarFotoModal}
            isSomethingLoading={isSomethingLoading}
            Nombres={misDatosPersonalAdministrativoSaved.Nombres}
            Apellidos={misDatosPersonalAdministrativoSaved.Apellidos}
            Nombre_Usuario={misDatosPersonalAdministrativoSaved.Nombre_Usuario}
            Google_Drive_Foto_ID={
              misDatosPersonalAdministrativoSaved.Google_Drive_Foto_ID || null
            }
          />
        </div>
      </div>
    </>
  );
};

export default MisDatosDePersonalAdministrativo;
