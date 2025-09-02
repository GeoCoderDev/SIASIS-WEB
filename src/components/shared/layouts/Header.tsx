"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { RequestCookie } from "next/dist/compiled/@edge-runtime/cookies";

import LogoCabecera from "../logos/LogoCabecera";
import FooterIcon from "@/components/icons/FooterIcon";
import HamburguesaIcon from "@/components/icons/HamburguesaIcon";
import DespliegueIcon from "@/components/icons/DespliegueIcon";
import FotoPerfilSideServer from "../../utils/photos/FotoPerfilClientSide";
import InterceptedLinkForDataThatCouldBeLost from "../InterceptedLinkForDataThatCouldBeLost";

import { useDelegacionEventos } from "@/hooks/useDelegacionDeEventos";
import useFechaHoraReal from "@/hooks/useFechaHoraReal";

import { AppDispatch, RootState } from "@/global/store";
import { setHeaderHeight } from "@/global/state/ElementDimensions/headerHeight";
import { setWindowHeight } from "@/global/state/ElementDimensions/windowHeight";
import { setWindowWidth } from "@/global/state/ElementDimensions/windowWidth";
import {
  setSidebarIsOpen,
  switchSidebarIsOpen,
} from "@/global/state/Flags/sidebarIsOpen";

import { logout } from "@/lib/utils/frontend/auth/logout";

import { RolesSistema } from "@/interfaces/shared/RolesSistema";
import { Genero } from "@/interfaces/shared/Genero";
import { RolesTextos } from "@/Assets/RolesTextos";
import { ZONA_HORARIA_LOCAL } from "@/constants/ZONA_HORARIA_LOCAL";
import { DatosAsistenciaHoyIDB } from "@/lib/utils/local/db/models/DatosAsistenciaHoy/DatosAsistenciaHoyIDB";
import { Entorno } from "@/interfaces/shared/Entornos";
import { ENTORNO } from "../../../constants/ENTORNO";
import ComunicadosDeHoy from "@/components/modals/Comunicados/ComunicadosDeHoy";
import {
  NOMBRE_TIMESTAMP_ULTIMA_CONSULTA_LOCAL_STORAGE,
  TIEMPO_PARA_ACTUALIZAR_MINIMO_HORA_AL_VOLVER_A_VER_PAGINA_MS,
} from "@/constants/INTERVALO_MINUTOS_SINCRONIZACION_HORA_REAL";

/**
 * Componente Header - Barra superior con información del usuario y controles del sidebar
 */
const Header = ({
  Nombres,
  Apellidos,
  Genero,
  Rol,
  Google_Drive_Foto_ID,
}: {
  Nombres: RequestCookie;
  Apellidos: RequestCookie;
  Genero?: RequestCookie;
  Rol: RolesSistema;
  Google_Drive_Foto_ID: string | null;
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const pathname = usePathname();
  const sidebarIsOpen = useSelector(
    (state: RootState) => state.flags.sidebarIsOpen
  );
  const { delegarEvento } = useDelegacionEventos();
  const { sincronizarConServidor, inicializado, formateada } = useFechaHoraReal(
    {
      timezone: ZONA_HORARIA_LOCAL,
    }
  );

  // Estados
  const [menuVisible, setMenuVisible] = useState(false);
  const isLoginPage = pathname.startsWith("/login");

  const toggleMenu = () => {
    setMenuVisible(!menuVisible);
  };

  const inicializarColaDeAsistencias = async () => {
    const { Asistencias_Escolares_QUEUE } = await import(
      "@/lib/utils/queues/AsistenciasEscolaresQueue"
    );

    Asistencias_Escolares_QUEUE.start();
  };

  useEffect(() => {
    if (!inicializado) return;

    // Obtener datos de asistencia de hoy para Auxiliar
    const obtenerDatosAsistenciaHoy = async () => {
      const datosAsistenciaHoy = new DatosAsistenciaHoyIDB();
      await datosAsistenciaHoy.obtenerDatos();
    };
    obtenerDatosAsistenciaHoy();

    //Obtener listas de estudiantes
    const obtenerListasEstudiantes = async () => {
      const { ListasEstudiantesPorGradosHoyIDB } = await import(
        "@/lib/utils/local/db/models/ListasEstudiantesPorGradosHoy/ListasEstudiantesPorGradosHoyIDB"
      );

      const listasEstudiantesIDB = new ListasEstudiantesPorGradosHoyIDB(
        "SIU01 API"
      );

      await listasEstudiantesIDB.actualizarTodasLasListasDisponibles();
      // Inicializar COLA DE ASISTENCIAS en caso hayan items pendientes
      inicializarColaDeAsistencias();
    };

    //Solicitar todas las listas de estudiantes de manera secuencial
    if (Rol === RolesSistema.Auxiliar) {
      obtenerListasEstudiantes();
    }
  }, [inicializado]);

  // Efecto para obtener datos de asistencia al cargar el componente
  useEffect(() => {
    // Sincronizar la hora cuando la ventana vuelve a ser visible
    sincronizarConServidor();

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        // Inicializar COLA DE ASISTENCIAS en caso hayan items pendientes
        inicializarColaDeAsistencias();

        // Comprobar si ha pasado el tiempo mínimo antes de sincronizar
        const ultimaConsulta = localStorage.getItem(
          NOMBRE_TIMESTAMP_ULTIMA_CONSULTA_LOCAL_STORAGE
        );
        const ahora = Date.now();

        if (
          !ultimaConsulta ||
          Math.abs(ahora - parseInt(ultimaConsulta)) >=
            TIEMPO_PARA_ACTUALIZAR_MINIMO_HORA_AL_VOLVER_A_VER_PAGINA_MS
        ) {
          sincronizarConServidor();
        }
      } else {
        // Cuando la página deja de ser visible, guardar el timestamp
        localStorage.setItem(
          NOMBRE_TIMESTAMP_ULTIMA_CONSULTA_LOCAL_STORAGE,
          Date.now().toString()
        );
      }
    });
  }, []);

  // Efecto para manejar dimensiones y eventos del header
  useEffect(() => {
    if (!delegarEvento) return;

    // Observer para actualizar la altura del header en el store
    const resizeObserverHeader = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        dispatch(
          setHeaderHeight({
            value: parseFloat(getComputedStyle(entry.target).height),
          })
        );
      });
    });

    // Establecer sidebar abierto por defecto en desktop
    if (window.innerWidth > 768) {
      dispatch(setSidebarIsOpen({ value: true }));
    }

    // Inicializar dimensiones de ventana
    dispatch(setWindowHeight({ value: window.innerHeight }));
    dispatch(setWindowWidth({ value: window.innerWidth }));

    // Actualizar dimensiones en redimensionamiento
    const handleResize = () => {
      dispatch(setWindowHeight({ value: window.innerHeight }));
      dispatch(setWindowWidth({ value: window.innerWidth }));
    };

    window.addEventListener("resize", handleResize);

    const headerHTML = document.getElementById("header");
    if (!headerHTML) return;

    resizeObserverHeader.observe(headerHTML);

    // Cerrar menú desplegable al hacer clic fuera
    delegarEvento(
      "mousedown",
      "#Menu-deplegable, #Menu-deplegable *, #despliegue-icon, #despliegue-icon *",
      () => {
        setMenuVisible(false);
      },
      true
    );

    return () => {
      resizeObserverHeader.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, [delegarEvento, dispatch]);

  // No mostrar el header en la página de login
  if (isLoginPage) {
    return null;
  }

  // Verificar que los datos necesarios están disponibles
  if (!Nombres || !Apellidos) {
    return null;
  }

  return (
    <>
      <ComunicadosDeHoy />

      <header
        style={{ boxShadow: "0 0px 2px 2px rgba(0,0,0,0.2)" }}
        id="header"
        className="-opacity-[0] flex w-full items-center text-center z-[1000] bg-verde-spotify sticky top-0 left-0 max-w-full bg-color-interfaz justify-start
                 sxs-only:gap-x-2 sxs-only:py-2 sxs-only:px-2 sxs-only:min-h-[4rem]
                 xs-only:gap-x-2 xs-only:py-2 xs-only:px-3 xs-only:min-h-[4.5rem]
                 max-sm:gap-x-3 max-sm:py-2 max-sm:px-3 max-sm:min-h-[4.5rem]
                 gap-x-4 py-3 px-4 sm:pl-6 sm:pr-4 min-h-[5rem]
                 landscape-small:gap-x-[0.5rem] landscape-small:py-[0.27rem] landscape-small:px-[0.54rem] landscape-small:pr-[0.54rem] landscape-small:min-h-[4.5rem]
                 landscape-tablet-sm:gap-x-[0.5rem] landscape-tablet-sm:py-[0.27rem] landscape-tablet-sm:px-[0.54rem] landscape-tablet-sm:pr-[0.54rem] landscape-tablet-sm:min-h-[4.5rem]
                 text-xs sm:text-base
                 landscape-small:text-[0.9rem] landscape-tablet-sm:text-[0.9rem]"
      >
        {/* Control del sidebar */}
        <div
          className="cursor-pointer select-none"
          onClick={() => dispatch(switchSidebarIsOpen())}
        >
          {Rol === RolesSistema.Directivo ? (
            <HamburguesaIcon
              title={sidebarIsOpen ? "Ocultar Sidebar" : "Mostrar Sidebar"}
              className="aspect-auto text-white
                       sxs-only:w-8
                       xs-only:w-9
                       max-sm:w-10
                       w-10
                       landscape-small:w-9 landscape-tablet-sm:w-9 -border-2"
            />
          ) : (
            <FooterIcon
              className="text-white
                       sxs-only:w-8
                       xs-only:w-9
                       max-sm:w-10
                       w-10
                       landscape-small:w-9 landscape-tablet-sm:w-9"
              title={
                sidebarIsOpen
                  ? "Ocultar Barra Inferior"
                  : "Mostrar Barra Inferior"
              }
            />
          )}
        </div>

        {/* Logo de la cabecera */}
        <div
          className="sxs-only:scale-75 xs-only:scale-85 max-sm:scale-90
                       landscape-small:scale-90 landscape-tablet-sm:scale-90"
        >
          <LogoCabecera />
        </div>

        <div className="flex-1">
          {ENTORNO === Entorno.LOCAL && (
            <>
              {formateada?.fechaCorta} | {formateada?.horaAmPm}
            </>
          )}
        </div>

        {/* Información del usuario y menú */}
        <div
          className="justify-self-end flex items-center justify-center
                      sxs-only:gap-1
                      xs-only:gap-2
                      max-sm:gap-3
                      gap-4
                      landscape-small:gap-[0.5rem] landscape-tablet-sm:gap-[0.5rem]"
        >
          {/* Nombre e información del rol */}
          <div
            className="flex flex-col items-start justify-center
                        sxs-only:gap-y-1 sxs-only:mr-1
                        xs-only:gap-y-1 xs-only:mr-1
                        max-sm:gap-y-1 max-sm:mr-2
                        gap-y-1 mr-2
                        landscape-small:gap-y-0 landscape-small:mr-[0.27rem] landscape-tablet-sm:gap-y-0 landscape-tablet-sm:mr-[0.27rem]"
          >
            <h1
              className="text-blanco font-extrabold text-left leading-5
                         sxs-only:text-[0.8rem] sxs-only:leading-4
                         xs-only:text-[0.9rem] xs-only:leading-4
                         max-sm:text-[1rem] max-sm:leading-5
                         text-[1.1rem]
                         landscape-small:text-[0.99rem] landscape-small:leading-[1.1rem] landscape-tablet-sm:text-[0.99rem] landscape-tablet-sm:leading-[1.1rem]"
            >
              {Nombres.value.split(" ").shift()}{" "}
              {Apellidos.value.split(" ").shift()}
            </h1>
            <i
              className="text-blanco text-left italic sm:hidden
                        sxs-only:text-[0.7rem] sxs-only:leading-3
                        xs-only:text-[0.75rem] xs-only:leading-3
                        max-sm:text-[0.8rem] max-sm:leading-4
                        text-[0.9rem] leading-4
                        landscape-small:hidden landscape-tablet-sm:hidden"
            >
              {
                RolesTextos[Rol as keyof typeof RolesTextos].mobile[
                  Genero ? (Genero.value as Genero) : ("M" as Genero)
                ]
              }
            </i>
            <i
              className="text-blanco text-left italic max-sm:hidden
                        text-[0.9rem] leading-4
                        landscape-small:text-[0.81rem] landscape-small:leading-4 landscape-tablet-sm:text-[0.81rem] landscape-tablet-sm:leading-4"
            >
              {
                RolesTextos[Rol as keyof typeof RolesTextos].desktop[
                  Genero ? (Genero.value as Genero) : ("M" as Genero)
                ]
              }
            </i>
          </div>

          {/* Foto de perfil */}
          <FotoPerfilSideServer
            className="sxs-only:w-9
                     xs-only:w-10
                     max-sm:w-11
                     w-13
                     landscape-small:w-[2.925rem] landscape-tablet-sm:w-[2.925rem]"
            Google_Drive_Foto_ID={Google_Drive_Foto_ID}
          />

          {/* Icono de menú desplegable */}
          <div id="despliegue-icon" onClick={toggleMenu} className="relative">
            <DespliegueIcon
              className="text-blanco aspect-auto hover:cursor-pointer
                       sxs-only:w-8
                       xs-only:w-9
                       max-sm:w-10
                       sm:w-7 w-10
                       landscape-small:w-7 landscape-tablet-sm:w-7"
            />
          </div>

          {/* Menú desplegable */}
          {menuVisible && (
            <ul
              id="Menu-deplegable"
              style={{ boxShadow: "0px 0px 4px 2px rgba(0,0,0,0.2)" }}
              className="absolute bg-white w-auto max-w-[90vw] flex flex-col items-center justify-center mt-3 rounded-lg top-full
                       sxs-only:min-w-[7rem] sxs-only:right-2
                       xs-only:min-w-[7.5rem] xs-only:right-3
                       max-sm:min-w-[8rem] max-sm:right-3
                       sm-only:min-w-[9rem] sm-only:right-4 md-only:min-w-[9rem] md-only:right-4 lg-only:min-w-[9rem] lg-only:right-4 xl-only:min-w-[9rem] xl-only:right-4
                       landscape-small:min-w-[8.1rem] landscape-small:right-[0.36rem] landscape-tablet-sm:min-w-[8.1rem] landscape-tablet-sm:right-[0.36rem]"
              onClick={() => {
                setMenuVisible(false);
              }}
            >
              <InterceptedLinkForDataThatCouldBeLost href={"/mis-datos"}>
                <li
                  className="hover:font-bold cursor-pointer flex items-center justify-center px-3 border-t border-gray-200
                             sxs-only:h-8 sxs-only:w-[7rem] sxs-only:text-sm
                             xs-only:h-9 xs-only:w-[7.5rem] xs-only:text-sm
                             max-sm:h-9 max-sm:w-[8rem] max-sm:text-sm
                             h-10 w-[8rem]
                             landscape-small:h-9 landscape-small:w-[7.2rem] landscape-small:text-sm landscape-tablet-sm:h-9 landscape-tablet-sm:w-[7.2rem] landscape-tablet-sm:text-sm"
                >
                  Editar Perfil
                </li>
              </InterceptedLinkForDataThatCouldBeLost>
              <li
                className="border-t border-gray-200 hover:font-bold cursor-pointer flex items-center justify-center px-3
                         sxs-only:h-8 sxs-only:w-[7rem] sxs-only:text-sm
                         xs-only:h-9 xs-only:w-[7.5rem] xs-only:text-sm
                         max-sm:h-9 max-sm:w-[8rem] max-sm:text-sm
                         h-10 w-[8rem]
                         landscape-small:h-9 landscape-small:w-[7.2rem] landscape-small:text-sm landscape-tablet-sm:h-9 landscape-tablet-sm:w-[7.2rem] landscape-tablet-sm:text-sm"
                onClick={() => logout()}
              >
                Cerrar Sesión
              </li>
            </ul>
          )}
        </div>
      </header>
    </>
  );
};

export default Header;
