export const QR_ESTUDIANTIL_PDF_CONFIG = {
  pageWidth: 210,
  pageHeight: 297,
  cardWidthMM: 73,
  cardHeightMM: 110,
  marginMM: 15,
  cardsPerRow: 2,
  spacingX: 24,
  spacingY: 31,
  qrSize: 124,
  scale: 2,
  cardDimensions: {
    width: 254,
    height: 387,
  },
};

export const generarQREnElementoHTML = async (
  element: HTMLDivElement,
  qrData: string
): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      if (!window.QRCode) {
        reject(new Error("QRCode library not loaded"));
        return;
      }

      element.innerHTML = "";

      new window.QRCode(element, {
        text: qrData,
        width: QR_ESTUDIANTIL_PDF_CONFIG.qrSize,
        height: QR_ESTUDIANTIL_PDF_CONFIG.qrSize,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: window.QRCode.CorrectLevel.M,
      });

      setTimeout(() => resolve(), 200);
    } catch (error) {
      reject(error);
    }
  });
};