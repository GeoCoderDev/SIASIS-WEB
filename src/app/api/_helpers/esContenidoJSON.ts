// Función auxiliar para verificar si el contenido es realmente JSON
export async function esContenidoJSON(response: Response): Promise<boolean> {
  try {
    // Verificar header Content-Type
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      // Si no es application/json, verificamos el contenido mismo
      const texto = await response.clone().text();

      // Intentar hacer un parse del texto para ver si es JSON válido
      JSON.parse(texto);
      return true;
    }
    return true;
  } catch (error) {
    console.warn("El contenido recibido no es JSON válido:", error);
    return false;
  }
}
