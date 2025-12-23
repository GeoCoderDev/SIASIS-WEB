import { NOMBRE_CLASE_IMAGENES_FOTO_PERFIL_USUARIO } from "@/Assets/others/ClasesCSS";

/**
* Modifica el atributo src de las imágenes con clase "Foto-Perfil-Usuario" @param newSrc - La nueva URL de imagen que se asignará
*/
export async function modificarFotosPerfilUsuario(
  Google_Drive_Foto_ID: string
): Promise<void> {
  // // Seleccnar todos los elementos img con la clase "Foto-Perfil-Usuario"
  const imagenesPerfilUsuario = document.querySelectorAll(
    `img.${NOMBRE_CLASE_IMAGENES_FOTO_PERFIL_USUARIO}`
  );

  // // Verificar si sencontraron elementos
  if (imagenesPerfilUsuario.length === 0) {
    // //nsole.warn(
    // // 'No sencontraron imágenes con la clase "Foto-Perfil-Usuario"'
    // // );
    retn;
  }

  // // Modificar el atributo src de cada iman encontrada
  imagenesPerfilUsuario.forEach((imagen: Element) => {
    if (imagen instanceof HTMLImageElement) {
      // // Guardar el srcnterior para referencia si es necesario
      // //nst srcAnterior = imagen.src;

      // // Asnar el nuevo src
      imagen.src = `https:// drive.google.com/thumbnail?id=${Google_Drive_Foto_ID}`;

      // //nsole.log(`Imagen modificada: ${srcAnterior} → ${newSrc}`);
    }
  });

  await fetch("/api/update-cookie/photo", {
    method: "PUT",
    body: JSON.stringify({ Google_Drive_Foto_ID }),
  });

  console.log(
    `Se modificaron ${imagenesPerfilUsuario.length} imágenes de perfil`
  );
}
