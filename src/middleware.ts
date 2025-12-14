import { NextRequest, NextResponse } from "next/server";
import { serialize } from "cookie";
import { isStaticAsset } from "./lib/helpers/validations/isStaticAsset";
import { RolesSistema } from "./interfaces/shared/RolesSistema";
import allSiasisModules from "./Assets/routes/modules.routes";

export enum RedirectionTypes {
  RUTA_NO_PERMITIDA = "RUTA_NO_PERMITIDA",
}

// Función para verificar si es una ruta interna de Next.js
function isNextInternalRoute(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/__nextjs") ||
    pathname.includes("_devMiddlewareManifest") ||
    pathname.includes("_devPagesManifest") ||
    pathname.startsWith("/favicon") ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  );
}

// Función simple para decodificar JWT sin verificar firma (solo para leer el payload)
function decodeJwtPayload(token: string) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    // Decodificar la parte del payload (segunda parte)
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const deleteCookies = () => {
    const deletedNombreCookie = serialize("Nombre", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax",
      maxAge: 0,
    });

    const deletedApellidoCookie = serialize("Apellido", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax",
      maxAge: 0,
    });

    const deletedRolCookie = serialize("Rol", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax",
      maxAge: 0,
    });

    const deletedTokenCookie = serialize("token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax",
      maxAge: 0,
    });

    return NextResponse.redirect(new URL("/login", request.url), {
      headers: {
        "Set-Cookie": `${deletedNombreCookie}, ${deletedApellidoCookie}, ${deletedTokenCookie}, ${deletedRolCookie}`,
      },
    });
  };

  const redirectToHomeWithError = (redirectionType: RedirectionTypes) => {
    const url = new URL("/", request.url);
    url.searchParams.set("REDIRECTION_TYPE", redirectionType);
    return NextResponse.redirect(url);
  };

  try {
    const url = request.nextUrl;
    const pathname = url.pathname;

    // Permitir rutas de API
    if (pathname.startsWith("/api")) {
      return NextResponse.next();
    }

    // Permitir assets estáticos
    if (isStaticAsset(pathname)) {
      return NextResponse.next();
    }

    // Permitir rutas internas de Next.js
    if (isNextInternalRoute(pathname)) {
      return NextResponse.next();
    }

    const token = request.cookies.get("token");
    const Rol = request.cookies.get("Rol");
    const Nombres = request.cookies.get("Nombres");
    const Apellidos = request.cookies.get("Apellidos");

    // Permitir acceso a login si no hay token
    if (!token && (pathname === "/login" || pathname.startsWith("/login/"))) {
      return NextResponse.next();
    }

    // Validar presencia de cookies requeridas
    if (!token || !Rol || !Nombres || !Apellidos) {
      return deleteCookies();
    }

    // Validar rol válido
    const rolValue = Rol.value as RolesSistema;
    switch (rolValue) {
      case RolesSistema.Directivo:
      case RolesSistema.ProfesorPrimaria:
      case RolesSistema.Auxiliar:
      case RolesSistema.ProfesorSecundaria:
      case RolesSistema.Tutor:
      case RolesSistema.Responsable:
      case RolesSistema.PersonalAdministrativo:
        break;
      default:
        console.error("Rol no válido en middleware:", rolValue);
        return deleteCookies();
    }

    // Redirigir a home si ya está autenticado y trata de acceder a login
    if (token && (pathname === "/login" || pathname.startsWith("/login/"))) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    // === VALIDACIÓN DE ACCESO A RUTAS BASADA EN ROLES ===

    // Buscar la ruta en los módulos del sistema
    const moduleForRoute = allSiasisModules.find((module) => {
      // Verificar coincidencia exacta de ruta
      if (module.route === pathname) {
        return true;
      }

      // Verificar si es una subruta (por ejemplo, /estudiantes/123)
      if (pathname.startsWith(module.route + "/")) {
        return true;
      }

      return false;
    });

    // Si encontramos el módulo, verificar permisos
    if (moduleForRoute) {
      // Verificar si el módulo está activo
      if (!moduleForRoute.active) {
        console.warn(
          `Acceso denegado: Módulo ${moduleForRoute.route} está inactivo`
        );
        return redirectToHomeWithError(RedirectionTypes.RUTA_NO_PERMITIDA);
      }

      // Validación básica del token y rol
      const decodedPayload = decodeJwtPayload(token.value);

      if (!decodedPayload) {
        console.error("No se pudo decodificar el token");
        return deleteCookies();
      }

      // Verificar que el rol en el token coincida con el rol en la cookie
      if (decodedPayload.Rol !== rolValue) {
        console.error("Rol en token no coincide con rol en cookie");
        return deleteCookies();
      }

      // Verificar expiración del token
      const now = Math.floor(Date.now() / 1000);
      if (decodedPayload.exp && decodedPayload.exp < now) {
        console.error("Token expirado");
        return deleteCookies();
      }

      // Verificar si el rol del usuario está en la lista de roles permitidos
      const hasAccess = moduleForRoute.allowedRoles.includes(rolValue);

      if (!hasAccess) {
        console.warn(
          `Acceso denegado: Rol ${rolValue} no autorizado para ${moduleForRoute.route}`
        );
        return redirectToHomeWithError(RedirectionTypes.RUTA_NO_PERMITIDA);
      }

      console.log(
        `Acceso autorizado a ${moduleForRoute.route} para rol ${rolValue}`
      );
    }
    // Si no encontramos el módulo, permitir acceso (rutas como "/" o rutas personalizadas)

    return NextResponse.next();
  } catch (e) {
    console.error("Error general en middleware:", e);
    return deleteCookies();
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
