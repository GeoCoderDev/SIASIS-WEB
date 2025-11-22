/**
 * Randomizer function that randomly returns one of the received parameters
 * @param parametros - Infinite number of parameters of any type
 * @returns One of the received parameters randomly
 */
export function dameCualquieraDeEstos<T = any>(...parametros: T[]): T {
  if (parametros.length === 0) {
    throw new Error("At least one parameter must be provided");
  }

  // Generate random index based on the number of parameters
  const indiceAleatorio = Math.floor(Math.random() * parametros.length);

  return parametros[indiceAleatorio];
}
