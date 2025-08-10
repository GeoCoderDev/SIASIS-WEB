/**
 * Funcion para extraer el identificador puro del identificador completo
 * @param identificadorCompleto
 * @returns
 */
export function extraerIdentificador(identificadorCompleto: string): string {
  const parts = identificadorCompleto.split("-");

  return parts[0];
}
