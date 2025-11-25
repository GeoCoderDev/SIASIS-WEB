/**
 * Function to correctly separate surnames considering compound surnames
 * @param apellidosCompletos - String with full surnames separated by spaces
 * @returns Array with separated surnames (usually 2 elements)
 */
export function obtenerApellidosSeparados(
  apellidosCompletos: string
): string[] {
  // Clean extra spaces and normalize
  const apellidosLimpio = apellidosCompletos.trim().replace(/\s+/g, " ");

  if (!apellidosLimpio) {
    return [];
  }

  // List of particles and prepositions that are part of compound surnames
  const particulas = new Set([
    "de",
    "del",
    "de la",
    "de las",
    "de los",
    "da",
    "das",
    "do",
    "dos",
    "van",
    "von",
    "van der",
    "van den",
    "la",
    "las",
    "los",
    "el",
    "y",
    "e",
    "i",
    "san",
    "santa",
    "santo",
    "mc",
    "mac",
    "o'",
    "ben",
    "ibn",
    "abu",
    "al",
    "el",
  ]);

  const palabras = apellidosLimpio.split(" ");

  // If there is only one word, it is a single surname
  if (palabras.length === 1) {
    return [palabras[0]];
  }

  // If there are only two words, check if the first is a particle
  if (palabras.length === 2) {
    const primeraMinuscula = palabras[0].toLowerCase();
    if (particulas.has(primeraMinuscula)) {
      // It is a complete compound surname
      return [apellidosLimpio];
    }
    // They are two simple surnames
    return [palabras[0], palabras[1]];
  }

  // For more than two words, we need to be smarter
  const apellidos: string[] = [];
  let apellidoActual: string[] = [];

  for (let i = 0; i < palabras.length; i++) {
    const palabraActual = palabras[i];
    const palabraMinuscula = palabraActual.toLowerCase();
    const siguientePalabra = i < palabras.length - 1 ? palabras[i + 1] : null;
    const siguienteMinuscula = siguientePalabra
      ? siguientePalabra.toLowerCase()
      : null;

    apellidoActual.push(palabraActual);

    // Check if the next word is a particle
    const siguienteEsParticula =
      siguienteMinuscula && particulas.has(siguienteMinuscula);

    // Check if the current word is a particle
    const actualEsParticula = particulas.has(palabraMinuscula);

    // Special cases for particle combinations
    const esCombinacionParticula =
      (palabraMinuscula === "de" &&
        siguienteMinuscula &&
        ["la", "las", "los", "el"].includes(siguienteMinuscula)) ||
      (palabraMinuscula === "van" &&
        siguienteMinuscula &&
        ["der", "den"].includes(siguienteMinuscula));

    // Decide whether to end the current surname
    const debeTerminarApellido =
      // It's the last word
      i === palabras.length - 1 ||
      // The next is NOT a particle and the current is NOT a particle
      (!siguienteEsParticula &&
        !actualEsParticula &&
        !esCombinacionParticula) ||
      // We already have a surname and have reached a good division
      (apellidos.length === 0 &&
        apellidoActual.length >= 2 &&
        !siguienteEsParticula &&
        !esCombinacionParticula);

    if (debeTerminarApellido) {
      apellidos.push(apellidoActual.join(" "));
      apellidoActual = [];

      // If we already have 2 surnames, the rest goes to the second surname
      if (apellidos.length === 2) {
        break;
      }
    }

    // Handle special particle combinations
    if (esCombinacionParticula && i < palabras.length - 1) {
      apellidoActual.push(palabras[i + 1]);
      i++; // Skip the next word since we already processed it
    }
  }

  // If there are unprocessed words left, add them to the last surname
  if (apellidoActual.length > 0) {
    if (apellidos.length > 0) {
      apellidos[apellidos.length - 1] += " " + apellidoActual.join(" ");
    } else {
      apellidos.push(apellidoActual.join(" "));
    }
  }

  // Ensure we don't have more than 2 surnames
  if (apellidos.length > 2) {
    // Combine all extra surnames with the second one
    const primerApellido = apellidos[0];
    const restantesApellidos = apellidos.slice(1).join(" ");
    apellidos.splice(0, apellidos.length, primerApellido, restantesApellidos);
  }

  return apellidos;
}