/**
 * Converts an ISO date in UTC format (with Z) to the same numeric
 * representation but treated as Peruvian time.
 *
 * Example:
 * "2025-04-07T03:16:00.000Z" (3:16 AM UTC) →
 * "2025-04-07T03:16:00.000-05:00" (3:16 AM Peruvian time, which would be 8:16 AM UTC)
 *
 * @param fechaUTC Date in ISO format with Z at the end
 * @returns The same date but with -05:00 indicator instead of Z
 */
export function alterarUTCaZonaPeruana(fechaUTC: string | Date): string {

  if(fechaUTC instanceof Date) {
    return fechaUTC.toISOString().replace("Z", "-05:00");
  }

  // Check if the date has 'Z' at the end
  if (!fechaUTC.endsWith("Z")) {
    // If it doesn't have 'Z', we assume it's already in local format
    return fechaUTC;
  }

  // Remove the 'Z' and add Peru's offset (-05:00)
  return fechaUTC.replace("Z", "-05:00");
}

/**
 * Alternative function that creates a new date using the same numeric values
 * but interpreted as Peruvian time
 *
 * @param fechaUTC Date in ISO format with Z at the end
 * @returns A new Date object with Peruvian time
 */
export function crearFechaHoraPeruanaDeUTC(fechaUTC: string): Date {
  // Check if the date has 'Z' at the end
  if (!fechaUTC.endsWith("Z")) {
    // If it doesn't have 'Z', simply parse the date
    return new Date(fechaUTC);
  }

  // Extract UTC date components
  const fechaObj = new Date(fechaUTC);
  const year = fechaObj.getUTCFullYear();
  const month = fechaObj.getUTCMonth();
  const day = fechaObj.getUTCDate();
  const hours = fechaObj.getUTCHours();
  const minutes = fechaObj.getUTCMinutes();
  const seconds = fechaObj.getUTCSeconds();
  const milliseconds = fechaObj.getUTCMilliseconds();

  // Create a new date using those same values but as local
  // (interpreted as Peruvian time)
  return new Date(year, month, day, hours, minutes, seconds, milliseconds);
}

/**
 * Usage example:
 *
 * // Using the first function (returns string)
 * const fechaPeruanaStr = convertirAHoraPeruana("2025-04-07T03:16:00.000Z");
 * console.log(fechaPeruanaStr); // "2025-04-07T03:16:00.000-05:00"
 *
 * // Using the second function (returns Date)
 * const fechaPeruanaObj = crearFechaHoraPeruana("2025-04-07T03:16:00.000Z");
 * console.log(fechaPeruanaObj.toISOString()); // New date in ISO
 */
