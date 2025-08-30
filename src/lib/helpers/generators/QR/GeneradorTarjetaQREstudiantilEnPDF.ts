import { generarTarjetaQREstudiantil } from "@/components/shared/plantillas/TarjetaQREstudiantil";
import { generarCadenaDeDatosDeEstudianteCodificada } from "./generacionDeCadenaDeDatosDeEstudianteCodificada";
import {
  generarQREnElementoHTML,
  QR_ESTUDIANTIL_PDF_CONFIG,
} from "./generarQREnElementoHTML";
import { EstudianteConAulaYRelacion } from "@/interfaces/shared/Estudiantes";

export class GeneradorTarjetaQREstudiantilEnPDF {
  private hiddenContainer: HTMLDivElement;

  constructor(hiddenContainer: HTMLDivElement) {
    this.hiddenContainer = hiddenContainer;
  }

  async generatePDF(
    estudiante: EstudianteConAulaYRelacion,
    quantity: number
  ): Promise<Blob> {
    if (!window.jspdf || !window.html2canvas) {
      throw new Error("Required libraries not loaded");
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("portrait", "mm", "a4");

    this.hiddenContainer.innerHTML = "";

    for (let i = 0; i < quantity; i++) {
      const cardContainer = this.createCardContainer(i);
      const cardHTML = generarTarjetaQREstudiantil(estudiante, i);

      cardContainer.innerHTML = cardHTML;
      document.body.appendChild(cardContainer);

      await this.generateQRForCard(cardContainer, i, estudiante);
      await this.waitForRender();

      const canvas = await this.captureCard(cardContainer);
      this.addCardToPDF(doc, canvas, i);

      document.body.removeChild(cardContainer);
    }

    return doc.output("blob");
  }

  private createCardContainer(index: number): HTMLDivElement {
    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.left = "-9999px";
    container.style.top = `${index * 400}px`;
    return container;
  }

  private async generateQRForCard(
    container: HTMLDivElement,
    index: number,
    estudiante: EstudianteConAulaYRelacion
  ): Promise<void> {
    const qrContainer = container.querySelector(
      `#qr-container-${index}`
    ) as HTMLDivElement;
    if (!qrContainer) return;

    const qrData = generarCadenaDeDatosDeEstudianteCodificada(estudiante);
    await generarQREnElementoHTML(qrContainer, qrData);
  }

  private async waitForRender(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 500));
  }

  private async captureCard(
    container: HTMLDivElement
  ): Promise<HTMLCanvasElement> {
    const cardElement = container.querySelector(".student-card") as HTMLElement;

    return await window.html2canvas(cardElement, {
      scale: QR_ESTUDIANTIL_PDF_CONFIG.scale,
      useCORS: true,
      backgroundColor: "#ffffff",
      width: QR_ESTUDIANTIL_PDF_CONFIG.cardDimensions.width,
      height: QR_ESTUDIANTIL_PDF_CONFIG.cardDimensions.height,
      logging: false,
      allowTaint: true,
      removeContainer: true,
      imageTimeout: 0,
    });
  }

  private addCardToPDF(
    doc: any,
    canvas: HTMLCanvasElement,
    index: number
  ): void {
    const row = Math.floor(index / QR_ESTUDIANTIL_PDF_CONFIG.cardsPerRow);
    const col = index % QR_ESTUDIANTIL_PDF_CONFIG.cardsPerRow;

    const x =
      QR_ESTUDIANTIL_PDF_CONFIG.marginMM +
      col *
        (QR_ESTUDIANTIL_PDF_CONFIG.cardWidthMM +
          QR_ESTUDIANTIL_PDF_CONFIG.spacingX);
    const y =
      QR_ESTUDIANTIL_PDF_CONFIG.marginMM +
      row *
        (QR_ESTUDIANTIL_PDF_CONFIG.cardHeightMM +
          QR_ESTUDIANTIL_PDF_CONFIG.spacingY);

    if (
      y + QR_ESTUDIANTIL_PDF_CONFIG.cardHeightMM >
      QR_ESTUDIANTIL_PDF_CONFIG.pageHeight - QR_ESTUDIANTIL_PDF_CONFIG.marginMM
    ) {
      doc.addPage();
      const newRow = Math.floor(
        (index %
          (QR_ESTUDIANTIL_PDF_CONFIG.cardsPerRow *
            Math.floor(
              (QR_ESTUDIANTIL_PDF_CONFIG.pageHeight -
                2 * QR_ESTUDIANTIL_PDF_CONFIG.marginMM) /
                (QR_ESTUDIANTIL_PDF_CONFIG.cardHeightMM +
                  QR_ESTUDIANTIL_PDF_CONFIG.spacingY)
            ))) /
          QR_ESTUDIANTIL_PDF_CONFIG.cardsPerRow
      );
      const newY =
        QR_ESTUDIANTIL_PDF_CONFIG.marginMM +
        newRow *
          (QR_ESTUDIANTIL_PDF_CONFIG.cardHeightMM +
            QR_ESTUDIANTIL_PDF_CONFIG.spacingY);

      doc.addImage(
        canvas.toDataURL("image/png", 1.0),
        "PNG",
        x,
        newY,
        QR_ESTUDIANTIL_PDF_CONFIG.cardWidthMM,
        QR_ESTUDIANTIL_PDF_CONFIG.cardHeightMM
      );
    } else {
      doc.addImage(
        canvas.toDataURL("image/png", 1.0),
        "PNG",
        x,
        y,
        QR_ESTUDIANTIL_PDF_CONFIG.cardWidthMM,
        QR_ESTUDIANTIL_PDF_CONFIG.cardHeightMM
      );
    }
  }

  // Extensión para GeneradorTarjetaQREstudiantilEnPDF.ts
  // Agregar este método a la clase existente

  /**
   * Genera PDF con múltiples estudiantes de un aula
   * @param estudiantes Array de estudiantes con información de aula
   * @returns Promise<Blob> PDF con todas las tarjetas
   */
  async generatePDFMultiplesEstudiantes(
    estudiantes: EstudianteConAulaYRelacion[]
  ): Promise<Blob> {
    if (!window.jspdf || !window.html2canvas) {
      throw new Error("Required libraries not loaded");
    }

    if (estudiantes.length === 0) {
      throw new Error("No hay estudiantes para generar tarjetas");
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("portrait", "mm", "a4");

    this.hiddenContainer.innerHTML = "";

    // Generar tarjetas para todos los estudiantes
    for (let i = 0; i < estudiantes.length; i++) {
      const estudiante = estudiantes[i];

      const cardContainer = this.createCardContainer(i);
      const cardHTML = generarTarjetaQREstudiantil(estudiante, i);

      cardContainer.innerHTML = cardHTML;
      document.body.appendChild(cardContainer);

      await this.generateQRForCard(cardContainer, i, estudiante);
      await this.waitForRender();

      const canvas = await this.captureCard(cardContainer);
      this.addCardToPDFMultiple(doc, canvas, i);

      document.body.removeChild(cardContainer);
    }

    return doc.output("blob");
  }

  /**
   * Versión modificada de addCardToPDF para manejar múltiples páginas correctamente
   */
  private addCardToPDFMultiple(
    doc: any,
    canvas: HTMLCanvasElement,
    cardIndex: number
  ): void {
    const cardsPerRow = QR_ESTUDIANTIL_PDF_CONFIG.cardsPerRow;
    const cardsPerPage = cardsPerRow * 2; // 2 filas por página (4 cards total por página)

    // Calcular en qué página está esta tarjeta
    const pageIndex = Math.floor(cardIndex / cardsPerPage);
    const cardInPageIndex = cardIndex % cardsPerPage;

    // Si necesitamos una nueva página, agregarla
    if (pageIndex > 0 && cardInPageIndex === 0) {
      doc.addPage();
    }

    // Calcular posición dentro de la página
    const row = Math.floor(cardInPageIndex / cardsPerRow);
    const col = cardInPageIndex % cardsPerRow;

    const x =
      QR_ESTUDIANTIL_PDF_CONFIG.marginMM +
      col *
        (QR_ESTUDIANTIL_PDF_CONFIG.cardWidthMM +
          QR_ESTUDIANTIL_PDF_CONFIG.spacingX);
    const y =
      QR_ESTUDIANTIL_PDF_CONFIG.marginMM +
      row *
        (QR_ESTUDIANTIL_PDF_CONFIG.cardHeightMM +
          QR_ESTUDIANTIL_PDF_CONFIG.spacingY);

    doc.addImage(
      canvas.toDataURL("image/png", 1.0),
      "PNG",
      x,
      y,
      QR_ESTUDIANTIL_PDF_CONFIG.cardWidthMM,
      QR_ESTUDIANTIL_PDF_CONFIG.cardHeightMM
    );
  }
}
