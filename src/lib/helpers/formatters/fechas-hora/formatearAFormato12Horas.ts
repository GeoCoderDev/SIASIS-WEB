/**
 * Transforms a timestamp to 12h time format (e.g.: "8:00am", "4:00pm")
 * @param timestamp - String representing a date and time
 * @param yaEsUTC - Boolean indicating if the timestamp is already in UTC (default: false)
 * @returns String formatted as "8:00am"
 */
export function formatearISOaFormato12Horas(
  timestamp: string,
  yaEsUTC: boolean = false
): string {
  try {
    // Create Date object from timestamp
    const fecha = new Date(timestamp);

    // Check if the date is valid
    if (isNaN(fecha.getTime())) {
      return "Invalid date format";
    }

    // Get hours and minutes depending on whether it's already UTC or not
    let horas = yaEsUTC ? fecha.getHours() : fecha.getUTCHours();
    const minutos = yaEsUTC ? fecha.getMinutes() : fecha.getUTCMinutes();

    // Determine AM or PM
    const periodo = horas >= 12 ? "pm" : "am";

    // Convert to 12-hour format
    horas = horas % 12;
    horas = horas ? horas : 12; // If 0, show as 12

    // Format minutes with leading zeros if necessary
    const minutosFormateados = minutos < 10 ? `0${minutos}` : minutos;

    // Build the result string
    return `${horas}:${minutosFormateados}${periodo}`;
  } catch (error) {
    console.log(error);
    // Error processing the date
    return "##:##";
  }
}

// Alternative function that includes seconds if they are different from 00
export function convertirAFormato12Horas(
  time24: string,
  withSeconds: boolean = false
): string {
  const [hours, minutes, seconds] = time24.split(":").map(Number);

  const period = hours >= 12 ? "PM" : "AM";

  let hours12 = hours % 12;
  if (hours12 === 0) {
    hours12 = 12;
  }

  const formattedMinutes = minutes.toString().padStart(2, "0");
  const formattedSeconds = seconds.toString().padStart(2, "0");

  // Only include seconds if they are different from 00
  if (!withSeconds) {
    return `${hours12}:${formattedMinutes} ${period}`;
  } else {
    return `${hours12}:${formattedMinutes}:${formattedSeconds} ${period}`;
  }
}
