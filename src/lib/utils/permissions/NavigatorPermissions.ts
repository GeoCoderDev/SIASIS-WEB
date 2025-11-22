import { EstadoPermisos } from "@/interfaces/Geolocalizacion";

export interface ResultadoPermisos {
  estado: EstadoPermisos;
  mensaje: string;
  puedeReintentar: boolean;
}

/**
 * Service to verify and manage geolocation permissions
 */
export class PermissionsService {
  /**
   * Checks if geolocation is supported in the browser
   */
  static esSoportadaGeolocalizacion(): boolean {
    return 'geolocation' in navigator;
  }

  /**
   * Checks if the Permissions API is available
   */
  static esSoportadaAPIPermisos(): boolean {
    return 'permissions' in navigator;
  }

  /**
   * Gets the current state of geolocation permissions
   */
  static async obtenerEstadoPermisos(): Promise<ResultadoPermisos> {
    try {
      // Check if geolocation is supported
      if (!this.esSoportadaGeolocalizacion()) {
        return {
          estado: EstadoPermisos.NO_SOPORTADO,
          mensaje: 'Geolocation is not supported in this browser',
          puedeReintentar: false
        };
      }

      // If the Permissions API is available, use it
      if (this.esSoportadaAPIPermisos()) {
        const permission = await navigator.permissions.query({ name: 'geolocation' });

        switch (permission.state) {
          case 'granted':
            return {
              estado: EstadoPermisos.CONCEDIDO,
              mensaje: 'Location permissions granted',
              puedeReintentar: false
            };

          case 'denied':
            return {
              estado: EstadoPermisos.DENEGADO,
              mensaje: 'Location permissions denied. Please enable location in browser settings.',
              puedeReintentar: true
            };

          case 'prompt':
            return {
              estado: EstadoPermisos.SOLICITADO,
              mensaje: 'Location permissions will be requested',
              puedeReintentar: true
            };

          default:
            return {
              estado: EstadoPermisos.NO_SOPORTADO,
              mensaje: 'Unknown permission state',
              puedeReintentar: true
            };
        }
      }

      // If there is no Permissions API, return that it can be requested
      return {
        estado: EstadoPermisos.SOLICITADO,
        mensaje: 'Permissions will be verified when attempting to get location',
        puedeReintentar: true
      };

    } catch (error) {
      console.error('Error verifying geolocation permissions:', error);
      return {
        estado: EstadoPermisos.NO_SOPORTADO,
        mensaje: 'Error verifying location permissions',
        puedeReintentar: true
      };
    }
  }

  /**
   * Requests geolocation permissions by performing a location query
   */
  static async solicitarPermisos(): Promise<ResultadoPermisos> {
    return new Promise((resolve) => {
      if (!this.esSoportadaGeolocalizacion()) {
        resolve({
          estado: EstadoPermisos.NO_SOPORTADO,
          mensaje: 'Geolocation is not supported on this device',
          puedeReintentar: false
        });
        return;
      }

      navigator.geolocation.getCurrentPosition(
        () => {
          // Success - permissions granted
          resolve({
            estado: EstadoPermisos.CONCEDIDO,
            mensaje: 'Location permissions granted successfully',
            puedeReintentar: false
          });
        },
        (error) => {
          // Error - permissions denied or error
          switch (error.code) {
            case 1: // PERMISSION_DENIED
              resolve({
                estado: EstadoPermisos.DENEGADO,
                mensaje: 'Location permissions denied by user',
                puedeReintentar: true
              });
              break;

            case 2: // POSITION_UNAVAILABLE
              resolve({
                estado: EstadoPermisos.CONCEDIDO, // Permissions OK, but technical issue
                mensaje: 'Location temporarily unavailable',
                puedeReintentar: true
              });
              break;

            case 3: // TIMEOUT
              resolve({
                estado: EstadoPermisos.CONCEDIDO, // Permissions OK, but timeout
                mensaje: 'Timeout while getting location',
                puedeReintentar: true
              });
              break;

            default:
              resolve({
                estado: EstadoPermisos.NO_SOPORTADO,
                mensaje: 'Unknown error while requesting permissions',
                puedeReintentar: true
              });
          }
        },
        {
          timeout: 10000, // 10 seconds timeout
          enableHighAccuracy: false, // Do not require high accuracy for verification
          maximumAge: 60000 // Accept location up to 1 minute old
        }
      );
    });
  }

  /**
   * Provides instructions to enable permissions based on browser
   */
  static obtenerInstruccionesPermisos(): { titulo: string; pasos: string[] } {
    const userAgent = navigator.userAgent.toLowerCase();

    if (userAgent.includes('chrome')) {
      return {
        titulo: 'Enable location in Chrome',
        pasos: [
          'Click the lock or info icon next to the URL',
          'Select "Location" and change to "Allow"',
          'Reload the page'
        ]
      };
    } else if (userAgent.includes('firefox')) {
      return {
        titulo: 'Enable location in Firefox',
        pasos: [
          'Click the shield icon next to the URL',
          'Select "Location" and choose "Allow"',
          'Reload the page'
        ]
      };
    } else if (userAgent.includes('safari')) {
      return {
        titulo: 'Enable location in Safari',
        pasos: [
          'Go to Safari > Preferences > Websites',
          'Select "Location" in the sidebar',
          'Set this site to "Allow"'
        ]
      };
    } else {
      return {
        titulo: 'Enable location in browser',
        pasos: [
          'Look for the location icon in the address bar',
          'Click and select "Allow"',
          'Reload the page if necessary'
        ]
      };
    }
  }
}