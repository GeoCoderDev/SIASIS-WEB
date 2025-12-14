import { NOMBRE_CLASE_IMAGENES_FOTO_PERFIL_USUARIO } from "@/Assets/others/ClasesCSS";

/**
 * Modifies the src attribute of images with the "Foto-Perfil-Usuario" class
 * @param newSrc - The new image URL to be assigned
 */
export async function modificarFotosPerfilUsuario(
  Google_Drive_Foto_ID: string
): Promise<void> {
  // Select all img elements with the "Foto-Perfil-Usuario" class
  const imagenesPerfilUsuario = document.querySelectorAll(
    `img.${NOMBRE_CLASE_IMAGENES_FOTO_PERFIL_USUARIO}`
  );

  // Check if elements were found
  if (imagenesPerfilUsuario.length === 0) {
    // console.warn(
    //   'No images with the class "Foto-Perfil-Usuario" were found'
    // );
    return;
  }

  // Modify the src attribute of each found image
  imagenesPerfilUsuario.forEach((imagen: Element) => {
    if (imagen instanceof HTMLImageElement) {
      // Save the previous src for reference if necessary
      // const srcAnterior = imagen.src;

      // Assign the new src
      imagen.src = `https://drive.google.com/thumbnail?id=${Google_Drive_Foto_ID}`;

      // console.log(`Image modified: ${srcAnterior} → ${newSrc}`);
    }
  });

  await fetch("/api/update-cookie/photo", {
    method: "PUT",
    body: JSON.stringify({ Google_Drive_Foto_ID }),
  });

  console.log(
    `${imagenesPerfilUsuario.length} profile pictures were modified`
  );
}
