"use client";

import { AppDispatch, RootState } from "@/global/store";
import { RolesSistema } from "@/interfaces/shared/RolesSistema";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { usePathname } from "next/navigation";
import InterceptedLinkForDataThatCouldBeLost from "../InterceptedLinkForDataThatCouldBeLost";
import allSiasisModules from "@/Assets/routes/modules.routes";
import { useDelegacionEventos } from "@/hooks/useDelegacionDeEventos";
import { setNavBarFooterHeight } from "@/global/state/ElementDimensions/navBarFooterHeight";
import { setSidebarIsOpen } from "@/global/state/Flags/sidebarIsOpen";
import EstadoDeAsistenciaSegunHorarioDeAsistencia from "../messages/EstadoDeAsistenciaSegunHorarioDeAsistencia";
import MarcarAsistenciaDePersonalButton from "../buttons/MarcarAsistenciaDePersonalButton";
import { useAsistenciaCompartida } from "@/hooks/asistencia-personal-no-directivo/useAsistenciaCompartida";

// Estilos uniformes para todos los contenedores de navegación
const getUniformContainerStyles = (itemsCount: number) => {
  const gapClasses = {
    1: "sxs-only:gap-8 xs-only:gap-12 sm-only:gap-16 md-only:gap-20 lg-only:gap-24 xl-only:gap-28",
    2: "sxs-only:gap-6 xs-only:gap-8 sm-only:gap-12 md-only:gap-16 lg-only:gap-20 xl-only:gap-24",
    3: "sxs-only:gap-4 xs-only:gap-6 sm-only:gap-8 md-only:gap-12 lg-only:gap-16 xl-only:gap-20",
  };

  const landscapeGapClasses = {
    1: "landscape-small:gap-[1.2rem] landscape-tablet-sm:gap-[1.2rem]", // 16px * 0.75 = 12px
    2: "landscape-small:gap-[0.9rem] landscape-tablet-sm:gap-[0.9rem]", // 12px * 0.75 = 9px
    3: "landscape-small:gap-[0.6rem] landscape-tablet-sm:gap-[0.6rem]", // 8px * 0.75 = 6px
  };

  return `
    flex items-center
    w-full
    py-5 px-4
    landscape-small:py-[0.9rem] landscape-small:px-[0.75rem]
    landscape-tablet-sm:py-[0.9rem] landscape-tablet-sm:px-[0.75rem]
    bg-white/95
    border-t border-gray-200
    transition-all duration-200
    ${gapClasses[itemsCount as keyof typeof gapClasses] || gapClasses[3]}
    ${
      landscapeGapClasses[itemsCount as keyof typeof landscapeGapClasses] ||
      landscapeGapClasses[3]
    }
    short-height:py-4
    landscape-small:short-height:py-[0.75rem]
    landscape-tablet-sm:short-height:py-[0.75rem]
    overflow-x-auto
    justify-center
    min-w-fit
    scrollbar-hide
    sm:justify-center
  `;
};

// Estilos uniformes para los elementos de navegación
const getUniformItemStyles = () => `
  flex flex-col items-center
  transition-all duration-200
  hover:transform hover:scale-105
  landscape-small:hover:scale-[0.97]
  landscape-tablet-sm:hover:scale-[0.97]
  flex-shrink-0
  min-w-fit
`;

// Estilos uniformes para los iconos
const getUniformIconStyles = (isSelected: boolean = false) => `
  sxs-only:w-5 sxs-only:h-5
  xs-only:w-6 xs-only:h-6
  sm-only:w-7 sm-only:h-7
  md-only:w-8 md-only:h-8
  lg-only:w-9 lg-only:h-9
  xl-only:w-9 xl-only:h-9
  landscape-small:w-[1.5rem] landscape-small:h-[1.5rem]
  landscape-tablet-sm:w-[1.5rem] landscape-tablet-sm:h-[1.5rem]
  ${isSelected ? "text-color-interfaz" : "text-black"}
  transition-colors duration-200
`;

// Estilos uniformes para las etiquetas de texto
const getUniformLabelStyles = (isSelected: boolean = false) => `
  mt-1
  landscape-small:mt-[0.15rem]
  landscape-tablet-sm:mt-[0.15rem]
  text-xs font-medium
  sxs-only:text-xs
  xs-only:text-xs
  sm-only:text-sm
  md-only:text-sm
  lg-only:text-sm
  xl-only:text-sm
  landscape-small:text-[0.7rem]
  landscape-tablet-sm:text-[0.7rem]
  ${isSelected ? "text-color-interfaz" : "text-black"}
  transition-colors duration-200
  text-center leading-tight
  short-height:mt-0.5 short-height:text-xs
  landscape-small:short-height:mt-[0.15rem] landscape-small:short-height:text-[0.7rem]
  landscape-tablet-sm:short-height:mt-[0.15rem] landscape-tablet-sm:short-height:text-[0.7rem]
  whitespace-nowrap
`;

function getNavBarFooterByRol(
  Rol: RolesSistema,
  pathname: string
): React.ReactNode {
  // Filtrar módulos disponibles para el rol actual que estén activos
  const availableModules = allSiasisModules.filter(
    (module) => module.allowedRoles.includes(Rol) && module.active
  );

  if (availableModules.length === 0) {
    return <></>;
  }

  return (
    <div className={getUniformContainerStyles(availableModules.length)}>
      {availableModules.map((module, index) => {
        const isSelected = pathname.startsWith(module.route);

        return (
          <InterceptedLinkForDataThatCouldBeLost
            key={index}
            href={module.route}
            className={getUniformItemStyles()}
          >
            <module.IconTSX className={getUniformIconStyles(isSelected)} />
            <span className={getUniformLabelStyles(isSelected)}>
              {module.text}
            </span>
          </InterceptedLinkForDataThatCouldBeLost>
        );
      })}
    </div>
  );
}

const NavBarFooter = ({ Rol }: { Rol: RolesSistema }) => {
  const [montado, setMontado] = useState(false);
  const pathname = usePathname();

  const { delegarEvento } = useDelegacionEventos();
  const dispatch = useDispatch<AppDispatch>();

  // ✅ NUEVA LÍNEA: Hook compartido para evitar doble consulta
  const datosAsistencia = useAsistenciaCompartida(Rol);

  useEffect(() => {
    if (!delegarEvento) return;

    // Observer para actualizar la altura del header en el store
    const resizeObserver = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        dispatch(
          setNavBarFooterHeight({
            value: parseFloat(getComputedStyle(entry.target).height),
          })
        );
      });
    });

    // Establecer navbarfooter abierto por defecto en movil
    if (window.innerWidth < 768) {
      dispatch(setSidebarIsOpen({ value: true }));
    }

    const navBarFooterHTML = document.getElementById("navbar-footer");

    if (!navBarFooterHTML) return;
    resizeObserver.observe(navBarFooterHTML);

    return () => {
      resizeObserver.disconnect();
    };
  }, [delegarEvento, dispatch]);

  useEffect(() => {
    setMontado(true);
  }, []);

  const showEstadoDeAsistenciaSegunHorario = allSiasisModules.every(
    (modulo) => {
      if (
        modulo.allowedRoles.includes(Rol) &&
        modulo.route === pathname &&
        modulo.detallesEstadoAsistenciaNavbarInactivo
      ) {
        return false;
      }
      return true;
    }
  );

  const navBarFooterIsOpen = useSelector(
    (state: RootState) => state.flags.sidebarIsOpen
  );

  if (Rol == RolesSistema.Directivo) {
    return <></>;
  }

  return (
    <>
      {/* ✅ PASAMOS LOS DATOS COMPARTIDOS AL BOTÓN FLOTANTE */}
      {Rol !== RolesSistema.Responsable && (
        <MarcarAsistenciaDePersonalButton
          rol={Rol}
          datosAsistencia={datosAsistencia}
        />
      )}
      <nav
        id="navbar-footer"
        className={`max-w-[100vw] w-full z-[101] bottom-0 left-0 bg-white shadow-[0_0_12px_4px_rgba(0,0,0,0.20)] animate__animated fixed
        ${
          montado && navBarFooterIsOpen
            ? "animate__slideInUp sticky"
            : "animate__slideOutDown"
        } 
        [animation-duration:150ms] `}
      >
        {/* ✅ PASAMOS LOS DATOS COMPARTIDOS AL COMPONENTE DE ESTADO */}
        {Rol !== RolesSistema.Responsable &&
          showEstadoDeAsistenciaSegunHorario && (
            <EstadoDeAsistenciaSegunHorarioDeAsistencia
              datosAsistencia={datosAsistencia}
            />
          )}
        <div className="flex items-center justify-center">
          {getNavBarFooterByRol(Rol, pathname)}
        </div>
      </nav>
    </>
  );
};

export default NavBarFooter;
