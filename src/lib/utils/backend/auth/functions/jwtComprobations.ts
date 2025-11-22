// middleware/authMiddleware.ts
import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

import { RolesSistema } from "@/interfaces/shared/RolesSistema";
import { JWTPayload } from "@/interfaces/shared/JWTPayload";

import { getJwtKeyForRole } from "./getJwtKeyForRoles";
import { redirectToLogin } from "./redirectToLogin";
import { LogoutTypes } from "@/interfaces/LogoutTypes";

/**
 * Middleware to verify authentication in API requests
 * @param req - Next.js request
 * @param allowedRoles - Roles that are allowed to access the endpoint (optional)
 * @returns An object with the decoded token and role, or redirects to login in case of error
 */
export async function verifyAuthToken(
  req: NextRequest,
  allowedRoles?: RolesSistema[]
) {
  try {
    // Get cookies
    const token = req.cookies.get("token")?.value;
    const rol = req.cookies.get("Rol")?.value as RolesSistema | undefined;

    // Verify if the necessary cookies exist
    if (!token || !rol) {
      return {
        error: redirectToLogin(LogoutTypes.SESION_EXPIRADA, {
          mensaje: "Sesión no encontrada",
          origen: "middleware/authMiddleware",
        }),
      };
    }

    // Verify if the role is allowed (if roles were specified)
    if (allowedRoles && !allowedRoles.includes(rol)) {
      return {
        error: redirectToLogin(LogoutTypes.PERMISOS_INSUFICIENTES, {
          mensaje: "No tienes permisos para acceder a este recurso",
          origen: "middleware/authMiddleware",
          contexto: `Rol ${rol} no autorizado`,
        }),
      };
    }

    // Select the correct JWT key according to the role
    const jwtKey = getJwtKeyForRole(rol);
    if (!jwtKey) {
      return {
        error: redirectToLogin(LogoutTypes.ERROR_DATOS_CORRUPTOS, {
          mensaje: "Configuración de seguridad inválida",
          origen: "middleware/authMiddleware",
        }),
      };
    }

    // Decode the JWT token
    let decodedToken: JWTPayload;
    try {
      decodedToken = jwt.verify(token, jwtKey) as JWTPayload;
    } catch (error) {
      console.error("Error al verificar token:", error);
      return {
        error: redirectToLogin(LogoutTypes.ERROR_DATOS_CORRUPTOS, {
          mensaje: "Token de seguridad inválido",
          origen: "middleware/authMiddleware",
          siasisComponent: "SIU01",
        }),
      };
    }

    // Verify that the role in the token matches the role in the cookie
    if (decodedToken.Rol !== rol) {
      return {
        error: redirectToLogin(LogoutTypes.ERROR_DATOS_CORRUPTOS, {
          mensaje: "Datos de sesión inconsistentes",
          origen: "middleware/authMiddleware",
          contexto: "Rol en token no coincide con rol en cookie",
        }),
      };
    }

    // If everything is correct, return the decoded token and role
    return {
      decodedToken,
      rol,
    };
  } catch (error) {
    console.error("Error general en autenticación:", error);
    return {
      error: redirectToLogin(LogoutTypes.ERROR_SISTEMA, {
        mensaje: "Error inesperado del sistema",
        origen: "middleware/authMiddleware",
      }),
    };
  }
}
