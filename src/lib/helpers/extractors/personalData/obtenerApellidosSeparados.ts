/**
* Función para separar correctamente los apellidos considerando apellidos compuestos @param apellidosCompletos - String con los apellidos completos separados por espacios @returns Array con los apellidos separados (normalmente 2 elementos)
*/
export function obtenerApellidosSeparados(
  apellidosCompletos: string
): string[] {
  // // Limpiar espacios extranormalizar
  const apellidosLimpio = apellidosCompletos.trim().replace(/\s+/g, " ");

  if (!apellidosLimpio) {
    return [];
  }

  // // Lista de partículas y preposicnes que forman parte de apellidos compuestos
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

  // // Si solo hayna palabra, es un solo apellido
  if (palabras.length === 1) {
    return [palabras[0]];
  }

  // // Si solo hay dos palabras, verificar si la primera esna partícula
  if (palabras.length === 2) {
    const primeraMinuscula = palabras[0].toLowerCase();
    if (particulas.has(primeraMinuscula)) {
      // // Esn apellido compuesto completo
      return [apellidosLimpio];
    }
    // //n dos apellidos simples
    return [palabras[0], palabras[1]];
  }

  // // Para más de dos palabrasnecesitamos ser más inteligentes
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

    // // Verificar si la sigunte palabra es una partícula
    const siguienteEsParticula =
      siguienteMinuscula && particulas.has(siguienteMinuscula);

    // // Verificar si la palabra actual esna partícula
    const actualEsParticula = particulas.has(palabraMinuscula);

    // // Casos especiales para comnaciones de partículas
    const esCombinacionParticula =
      (palabraMinuscula === "de" &&
        siguienteMinuscula &&
        ["la", "las", "los", "el"].includes(siguienteMinuscula)) ||
      (palabraMinuscula === "van" &&
        siguienteMinuscula &&
        ["der", "den"].includes(siguienteMinuscula));

    // // Decidir si ternar el apellido actual
    const debeTerminarApellido =
      // // Es la última palabra
      i === palabras.ngth - 1 ||
      // // La sigunte NO es partícula y la actual NO es partícula
      (!siguienteEsParticula &&
        !actualEsParticula &&
        !esCombinacionParticula) ||
      // // Yanemos un apellido y hemos llegado a una buena división
      (apellidos.length === 0 &&
        apellidoActual.length >= 2 &&
        !siguienteEsParticula &&
        !esCombinacionParticula);

    if (debeTerminarApellido) {
      apellidos.push(apellidoActual.join(" "));
      apellidoActual = [];

      // // Si yanemos 2 apellidos, el resto va al segundo apellido
      if (apellidos.length === 2) {
        break;
      }
    }

    // //nejar combinaciones especiales de partículas
    if (esCombinacionParticula && i < palabras.length - 1) {
      apellidoActual.push(palabras[i + 1]);
      i++; // / Saltar la sigunte palabra ya que la procesamos
    }
  }

  // // Si quedan palabras sin procesar, añadirlas al último apellido
  if (apellidoActual.length > 0) {
    if (apellidos.length > 0) {
      apellidos[apellidos.length - 1] += " " + apellidoActual.join(" ");
    } else {
      apellidos.push(apellidoActual.join(" "));
    }
  }

  // // Asegurar quno tengamos más de 2 apellidos
  if (apellidos.length > 2) {
    // // Comnar todos los apellidos extra con el segundo
    const primerApellido = apellidos[0];
    const restantesApellidos = apellidos.slice(1).join(" ");
    apellidos.splice(0, apellidos.length, primerApellido, restantesApellidos);
  }

  return apellidos;
}
