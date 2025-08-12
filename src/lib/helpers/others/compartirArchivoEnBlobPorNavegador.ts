export const compartirArchivoEnBlobPorNavegador = async (
  blob: Blob,
  filename: string,
  title: string
): Promise<void> => {
  const file = new File([blob], filename, { type: "application/pdf" });
  await navigator.share({
    files: [file],
    title,
    text: `Código QR de ${title}`,
  });
};
