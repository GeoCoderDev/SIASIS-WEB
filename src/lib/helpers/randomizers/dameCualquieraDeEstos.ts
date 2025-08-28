/**
 * Función randomizadora que devuelve aleatoriamente uno de los parámetros recibidos
 * @param parametros - Cantidad infinita de parámetros de cualquier tipo
 * @returns Uno de los parámetros recibidos de manera aleatoria
 */
export function dameCualquieraDeEstos<T = any>(...parametros: T[]): T {
  if (parametros.length === 0) {
    throw new Error("Se debe proporcionar al menos un parámetro");
  }

  // Generar índice aleatorio basado en la cantidad de parámetros
  const indiceAleatorio = Math.floor(Math.random() * parametros.length);

  return parametros[indiceAleatorio];
}
