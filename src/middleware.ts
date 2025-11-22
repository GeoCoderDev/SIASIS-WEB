import { NextRequest, NextResponse } from "next/server";
import { serialize } from "cookie";
import { isStaticAsset } from "./lib/helpers/validations/isStaticAsset";
import { RolesSistema } from "./interfaces/shared/RolesSistema";
import allSiasisModules from "./Assets/routes/modules.routes";

export enum RedirectionTypes {
  RUTA_NO_PERMITIDA = "RUTA_NO_PERMITIDA",
}

// Function to check if it's an internal Next.js route
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

// Simple function to decode JWT without verifying signature (only for reading the payload)
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

    // Allow static assets
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

    // Validate valid role
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

    // Redirect to home if already authenticated and trying to access login
    if (token && (pathname === "/login" || pathname.startsWith("/login/"))) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    // === ROLE-BASED ROUTE ACCESS VALIDATION ===

    // Search for the route in the system modules
    const moduleForRoute = allSiasisModules.find((module) => {
      // Check exact route match
      if (module.route === pathname) {
        return true;
      }

      // Check if it's a subroute (for example, /estudiantes/123)
      if (pathname.startsWith(module.route + "/")) {
        return true;
      }

      return false;
    });

    // If we find the module, verify permissions
    if (moduleForRoute) {
      // Check if the module is active
      if (!moduleForRoute.active) {
        console.warn(
          `Acceso denegado: Módulo ${moduleForRoute.route} está inactivo`
        );
        return redirectToHomeWithError(RedirectionTypes.RUTA_NO_PERMITIDA);
      }

      // Basic token and role validation
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

      // Check token expiration
      const now = Math.floor(Date.now() / 1000);
      if (decodedPayload.exp && decodedPayload.exp < now) {
        console.error("Token expirado");
        return deleteCookies();
      }

      // Check if the user's role is in the list of allowed roles
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
    // If we don't find the module, allow access (routes like "/" or custom routes)

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
