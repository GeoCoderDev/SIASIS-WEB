/* eslint-disable @typescript-eslint/no-explicit-any */
// src/lib/utils/excel/exportarAsistenciaExcel.ts

import * as ExcelJS from "exceljs";
import { DatosExportacionExcel, COLORES_ESTADOS_EXCEL } from "./types";
import { mesesTextos } from "@/interfaces/shared/Meses";
import { EstadosAsistenciaPersonal } from "@/interfaces/shared/EstadosAsistenciaPersonal";
import { ErrorResponseAPIBase } from "@/interfaces/shared/apis/types";

/**
 * Exports staff attendances to Excel with professional design
 * @param datos - Export data
 * @param esPersonal - true for "My Attendances", false for administrative report
 * @param setExportandoExcel - Function to handle loading state
 * @param setSuccessMessage - Function to display success message
 * @param setError - Function to display errors
 */
export const exportarAsistenciaPersonalAExcel = async (
  datos: DatosExportacionExcel,
  esPersonal: boolean = false,
  setExportandoExcel: (loading: boolean) => void,
  setSuccessMessage: (message: string) => void,
  setError: React.Dispatch<React.SetStateAction<ErrorResponseAPIBase | null>>
): Promise<void> => {
  if (!datos.usuario || !datos.registros.length) {
    setError({
      success: false,
      message: "No data to export. Perform a search first.",
    });
    return;
  }

  setExportandoExcel(true);

  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(
      esPersonal ? "My Attendance Records" : "Staff Attendance Records",
      {
        pageSetup: {
          paperSize: 9, // A4
          orientation: "landscape",
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
          margins: {
            left: 0.5,
            right: 0.5,
            top: 0.75,
            bottom: 0.75,
            header: 0.3,
            footer: 0.3,
          },
        },
      }
    );

    // Configure columns
    worksheet.columns = [
      { key: "fecha", width: 12 },
      { key: "entradaProgramada", width: 14 },
      { key: "entradaReal", width: 14 },
      { key: "diferenciaEntrada", width: 12 },
      { key: "estadoEntrada", width: 16 },
      { key: "salidaProgramada", width: 14 },
      { key: "salidaReal", width: 14 },
      { key: "diferenciaSalida", width: 12 },
      { key: "estadoSalida", width: 16 },
    ];

    let filaActual = 1;

    // Main title
    worksheet.mergeCells(`A${filaActual}:I${filaActual}`);
    const tituloCell = worksheet.getCell(`A${filaActual}`);
    tituloCell.value = "I.E. 20935 ASUNCIÓN 8 - IMPERIAL, CAÑETE";
    tituloCell.style = {
      font: { size: 16, bold: true, color: { argb: "FFFFFF" } },
      fill: {
        type: "pattern" as const,
        pattern: "solid" as const,
        fgColor: { argb: esPersonal ? "059669" : "1E40AF" },
      },
      alignment: { horizontal: "center" as const, vertical: "middle" as const },
      border: {
        top: { style: "medium" as const, color: { argb: "000000" } },
        left: { style: "medium" as const, color: { argb: "000000" } },
        bottom: { style: "medium" as const, color: { argb: "000000" } },
        right: { style: "medium" as const, color: { argb: "000000" } },
      },
    };
    worksheet.getRow(filaActual).height = 25;
    filaActual++;

    // Subtitle
    worksheet.mergeCells(`A${filaActual}:I${filaActual}`);
    const subtituloCell = worksheet.getCell(`A${filaActual}`);
    subtituloCell.value = esPersonal
      ? "MY MONTHLY ATTENDANCE RECORDS"
      : "STAFF MONTHLY ATTENDANCE RECORD";
    subtituloCell.style = {
      font: { size: 14, bold: true, color: { argb: "FFFFFF" } },
      fill: {
        type: "pattern" as const,
        pattern: "solid" as const,
        fgColor: { argb: "3B82F6" },
      },
      alignment: { horizontal: "center" as const, vertical: "middle" as const },
      border: {
        top: { style: "medium" as const, color: { argb: "000000" } },
        left: { style: "medium" as const, color: { argb: "000000" } },
        bottom: { style: "medium" as const, color: { argb: "000000" } },
        right: { style: "medium" as const, color: { argb: "000000" } },
      },
    };
    worksheet.getRow(filaActual).height = 20;
    filaActual += 2; // Space

    // User information
    const rolLegible = 
      datos.rolesDisponibles.find((r) => r.value === datos.rolSeleccionado)
        ?.label || datos.rolSeleccionado;
    const mesLegible = mesesTextos[datos.mes as keyof typeof mesesTextos];

    if (esPersonal) {
      // Simplified version for "My Attendances"
      worksheet.mergeCells(`A${filaActual}:I${filaActual}`);
      const infoCell = worksheet.getCell(`A${filaActual}`);
      infoCell.value = `${datos.usuario.Nombres} ${datos.usuario.Apellidos} - ${rolLegible} - ${mesLegible}`;
      infoCell.style = {
        font: { size: 12, bold: true },
        alignment: {
          horizontal: "center" as const,
          vertical: "middle" as const,
        },
      };
      filaActual += 2;
    } else {
      // Full version for administrators
      const aplicarBordesACeldasCombinadas = (rango: string, estilo: any) => {
        const celdaInicial = worksheet.getCell(rango.split(":")[0]);
        celdaInicial.style = estilo;
        const startCol = Number(worksheet.getCell(rango.split(":")[0]).col);
        const endCol = Number(worksheet.getCell(rango.split(":")[1]).col);
        const row = Number(worksheet.getCell(rango.split(":")[0]).row);
        for (let col = startCol; col <= endCol; col++) {
          const cell = worksheet.getCell(row, col);
          cell.style = { ...cell.style, border: estilo.border };
        }
      };

      const estiloEtiqueta: Partial<ExcelJS.Style> = {
        font: { bold: true, size: 10 },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "E5E7EB" },
        },
        alignment: {
          horizontal: "left" as const,
          vertical: "middle" as const,
          indent: 1,
        },
        border: {
          top: { style: "thin" as const, color: { argb: "000000" } },
          left: { style: "thin" as const, color: { argb: "000000" } },
          bottom: { style: "thin" as const, color: { argb: "000000" } },
          right: { style: "thin" as const, color: { argb: "000000" } },
        },
      };

      const estiloValor: Partial<ExcelJS.Style> = {
        font: { size: 10 },
        alignment: {
          horizontal: "left" as const,
          vertical: "middle" as const,
          indent: 1,
        },
        border: {
          top: { style: "thin" as const, color: { argb: "000000" } },
          left: { style: "thin" as const, color: { argb: "000000" } },
          bottom: { style: "thin" as const, color: { argb: "000000" } },
          right: { style: "thin" as const, color: { argb: "000000" } },
        },
      };

      // Row 1: Name and DNI
      worksheet.mergeCells(`A${filaActual}:C${filaActual}`);
      worksheet.mergeCells(`D${filaActual}:F${filaActual}`);
      worksheet.mergeCells(`G${filaActual}:H${filaActual}`);

      worksheet.getCell(`A${filaActual}`).value = "FULL NAME:";
      aplicarBordesACeldasCombinadas(
        `A${filaActual}:C${filaActual}`,
        estiloEtiqueta
      );

      worksheet.getCell(
        `D${filaActual}`
      ).value = `${datos.usuario.Nombres} ${datos.usuario.Apellidos}`;
      aplicarBordesACeldasCombinadas(
        `D${filaActual}:F${filaActual}`,
        estiloValor
      );

      worksheet.getCell(`G${filaActual}`).value = "DNI:";
      aplicarBordesACeldasCombinadas(
        `G${filaActual}:H${filaActual}`,
        estiloEtiqueta
      );

      worksheet.getCell(`I${filaActual}`).value =
        datos.usuario.Identificador_Nacional_Directivo ??
        datos.usuario.ID_Usuario;
      worksheet.getCell(`I${filaActual}`).style = estiloValor;

      filaActual++;

      // Row 2: Role and Month
      worksheet.mergeCells(`A${filaActual}:C${filaActual}`);
      worksheet.mergeCells(`D${filaActual}:F${filaActual}`);
      worksheet.mergeCells(`G${filaActual}:H${filaActual}`);

      worksheet.getCell(`A${filaActual}`).value = "ROLE:";
      aplicarBordesACeldasCombinadas(
        `A${filaActual}:C${filaActual}`,
        estiloEtiqueta
      );

      worksheet.getCell(`D${filaActual}`).value = rolLegible;
      aplicarBordesACeldasCombinadas(
        `D${filaActual}:F${filaActual}`,
        estiloValor
      );

      worksheet.getCell(`G${filaActual}`).value = "MONTH:";
      aplicarBordesACeldasCombinadas(
        `G${filaActual}:H${filaActual}`,
        estiloEtiqueta
      );

      worksheet.getCell(`I${filaActual}`).value = mesLegible;
      worksheet.getCell(`I${filaActual}`).style = estiloValor;

      filaActual++;

      // Row 3: Total records and date
      worksheet.mergeCells(`A${filaActual}:C${filaActual}`);
      worksheet.mergeCells(`D${filaActual}:F${filaActual}`);
      worksheet.mergeCells(`G${filaActual}:H${filaActual}`);

      worksheet.getCell(`A${filaActual}`).value = "TOTAL RECORDS:";
      aplicarBordesACeldasCombinadas(
        `A${filaActual}:C${filaActual}`,
        estiloEtiqueta
      );

      worksheet.getCell(`D${filaActual}`).value =
        datos.registros.length.toString();
      aplicarBordesACeldasCombinadas(
        `D${filaActual}:F${filaActual}`,
        estiloValor
      );

      worksheet.getCell(`G${filaActual}`).value = "GENERATION DATE:";
      aplicarBordesACeldasCombinadas(
        `G${filaActual}:H${filaActual}`,
        estiloEtiqueta
      );

      worksheet.getCell(`I${filaActual}`).value = new Date().toLocaleDateString(
        "en-US"
      );
      worksheet.getCell(`I${filaActual}`).style = estiloValor;

      filaActual += 2;
    }

    // Table headers
    const encabezados = [
      "DATE",
      "SCHEDULED\nENTRY",
      "ACTUAL\nENTRY",
      "ENTRY\nDIFFERENCE",
      "ENTRY\nSTATUS",
      "SCHEDULED\nEXIT",
      "ACTUAL\nEXIT",
      "EXIT\nDIFFERENCE",
      "EXIT\nSTATUS",
    ];

    encabezados.forEach((encabezado, index) => {
      const cell = worksheet.getCell(filaActual, index + 1);
      cell.value = encabezado;
      cell.style = {
        font: { bold: true, size: 9, color: { argb: "FFFFFF" } },
        fill: {
          type: "pattern" as const,
          pattern: "solid" as const,
          fgColor: { argb: "374151" },
        },
        alignment: {
          horizontal: "center" as const,
          vertical: "middle" as const,
          wrapText: true,
        },
        border: {
          top: { style: "medium" as const, color: { argb: "000000" } },
          left: { style: "thin" as const, color: { argb: "000000" } },
          bottom: { style: "medium" as const, color: { argb: "000000" } },
          right: { style: "thin" as const, color: { argb: "000000" } },
        },
      };
    });
    worksheet.getRow(filaActual).height = 30;
    filaActual++;

    // Data
    datos.registros.forEach((registro, index) => {
      const fila = worksheet.getRow(filaActual);

      // Background color
      let colorFondo = index % 2 === 0 ? "FFFFFF" : "F9FAFB";
      if (registro.esEvento) colorFondo = "DDD6FE";
      else if (registro.esDiaNoEscolar && !registro.esEvento)
        colorFondo = "EBF8FF";

      // Date
      const fechaCell = fila.getCell(1);
      let textoFecha = new Date(
        registro.fecha + "T00:00:00"
      ).toLocaleDateString("en-US", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
      });
      if (registro.esEvento) textoFecha += `\n🎉 ${registro.nombreEvento}`;
      else if (registro.esDiaNoEscolar) textoFecha += "\n📅 Weekend";

      fechaCell.value = textoFecha;
      fechaCell.style = {
        font: { size: 8 },
        fill: {
          type: "pattern" as const,
          pattern: "solid" as const,
          fgColor: { argb: colorFondo },
        },
        alignment: {
          horizontal: "center" as const,
          vertical: "middle" as const,
          wrapText: true,
        },
        border: {
          top: { style: "thin" as const, color: { argb: "000000" } },
          left: { style: "thin" as const, color: { argb: "000000" } },
          bottom: { style: "thin" as const, color: { argb: "000000" } },
          right: { style: "thin" as const, color: { argb: "000000" } },
        },
      };

      // Function to apply standard style
      const aplicarEstiloEstandar = (celda: any, valor: string) => {
        celda.value = valor;
        celda.style = {
          font: { size: 8 },
          fill: {
            type: "pattern" as const,
            pattern: "solid" as const,
            fgColor: { argb: colorFondo },
          },
          alignment: {
            horizontal: "center" as const,
            vertical: "middle" as const,
          },
          border: {
            top: { style: "thin" as const, color: { argb: "000000" } },
            left: { style: "thin" as const, color: { argb: "000000" } },
            bottom: { style: "thin" as const, color: { argb: "000000" } },
            right: { style: "thin" as const, color: { argb: "000000" } },
          },
        };
      };

      // Apply standard data
      aplicarEstiloEstandar(fila.getCell(2), registro.entradaProgramada);
      aplicarEstiloEstandar(fila.getCell(3), registro.entradaReal);
      aplicarEstiloEstandar(fila.getCell(4), registro.diferenciaEntrada);
      aplicarEstiloEstandar(fila.getCell(6), registro.salidaProgramada);
      aplicarEstiloEstandar(fila.getCell(7), registro.salidaReal);
      aplicarEstiloEstandar(fila.getCell(8), registro.diferenciaSalida);

      // States with specific colors
      const colorEstadoEntrada = COLORES_ESTADOS_EXCEL[registro.estadoEntrada];
      const estadoEntradaCell = fila.getCell(5);
      estadoEntradaCell.value = colorEstadoEntrada.nombre;
      estadoEntradaCell.style = {
        font: { size: 8, bold: true, color: { argb: colorEstadoEntrada.font } },
        fill: {
          type: "pattern" as const,
          pattern: "solid" as const,
          fgColor: { argb: colorEstadoEntrada.background },
        },
        alignment: {
          horizontal: "center" as const,
          vertical: "middle" as const,
        },
        border: {
          top: { style: "thin" as const, color: { argb: "000000" } },
          left: { style: "thin" as const, color: { argb: "000000" } },
          bottom: { style: "thin" as const, color: { argb: "000000" } },
          right: { style: "thin" as const, color: { argb: "000000" } },
        },
      };

      const colorEstadoSalida = COLORES_ESTADOS_EXCEL[registro.estadoSalida];
      const estadoSalidaCell = fila.getCell(9);
      estadoSalidaCell.value = colorEstadoSalida.nombre;
      estadoSalidaCell.style = {
        font: { size: 8, bold: true, color: { argb: colorEstadoSalida.font } },
        fill: {
          type: "pattern" as const,
          pattern: "solid" as const,
          fgColor: { argb: colorEstadoSalida.background },
        },
        alignment: {
          horizontal: "center" as const,
          vertical: "middle" as const,
        },
        border: {
          top: { style: "thin" as const, color: { argb: "000000" } },
          left: { style: "thin" as const, color: { argb: "000000" } },
          bottom: { style: "thin" as const, color: { argb: "000000" } },
          right: { style: "thin" as const, color: { argb: "000000" } },
        },
      };

      fila.height = 20;
      filaActual++;
    });

    // Statistical summary (only for full version)
    if (!esPersonal) {
      filaActual++;

      const totalAsistencias = datos.registros.filter(
        (r) =>
          r.estadoEntrada === EstadosAsistenciaPersonal.En_Tiempo ||
          r.estadoEntrada === EstadosAsistenciaPersonal.Temprano
      ).length;
      const totalTardanzas = datos.registros.filter(
        (r) => r.estadoEntrada === EstadosAsistenciaPersonal.Tarde
      ).length;
      const totalFaltas = datos.registros.filter(
        (r) => r.estadoEntrada === EstadosAsistenciaPersonal.Falta
      ).length;
      const totalEventos = datos.registros.filter((r) => r.esEvento).length;

      // Summary title
      worksheet.mergeCells(`A${filaActual}:I${filaActual}`);
      const resumenTituloCell = worksheet.getCell(`A${filaActual}`);
      resumenTituloCell.value = "STATISTICAL SUMMARY";
      resumenTituloCell.style = {
        font: { size: 12, bold: true, color: { argb: "FFFFFF" } },
        fill: {
          type: "pattern" as const,
          pattern: "solid" as const,
          fgColor: { argb: "059669" },
        },
        alignment: {
          horizontal: "center" as const,
          vertical: "middle" as const,
        },
        border: {
          top: { style: "medium" as const, color: { argb: "000000" } },
          left: { style: "medium" as const, color: { argb: "000000" } },
          bottom: { style: "medium" as const, color: { argb: "000000" } },
          right: { style: "medium" as const, color: { argb: "000000" } },
        },
      };
      worksheet.getRow(filaActual).height = 20;
      filaActual++;

      // Summary data
      const datosResumen = [
        {
          concepto: "Total Attendances:",
          valor: totalAsistencias,
          color: "D4F7D4",
        },
        {
          concepto: "Total Late Arrivals:",
          valor: totalTardanzas,
          color: "FED7BA",
        },
        { concepto: "Total Absences:", valor: totalFaltas, color: "FECACA" },
        { concepto: "Event Days:", valor: totalEventos, color: "DDD6FE" },
      ];

      datosResumen.forEach((dato) => {
        worksheet.mergeCells(`A${filaActual}:G${filaActual}`);
        worksheet.mergeCells(`H${filaActual}:I${filaActual}`);

        const conceptoCell = worksheet.getCell(`A${filaActual}`);
        conceptoCell.value = dato.concepto;
        conceptoCell.style = {
          font: { bold: true, size: 10 },
          fill: {
            type: "pattern" as const,
            pattern: "solid" as const,
            fgColor: { argb: "F3F4F6" },
          },
          alignment: {
            horizontal: "left" as const,
            vertical: "middle" as const,
            indent: 1,
          },
          border: {
            top: { style: "thin" as const, color: { argb: "000000" } },
            left: { style: "thin" as const, color: { argb: "000000" } },
            bottom: { style: "thin" as const, color: { argb: "000000" } },
            right: { style: "thin" as const, color: { argb: "000000" } },
          },
        };

        const valorCell = worksheet.getCell(`H${filaActual}`);
        valorCell.value = dato.valor;
        valorCell.style = {
          font: { bold: true, size: 10 },
          fill: {
            type: "pattern" as const,
            pattern: "solid" as const,
            fgColor: { argb: dato.color },
          },
          alignment: {
            horizontal: "center" as const,
            vertical: "middle" as const,
          },
          border: {
            top: { style: "thin" as const, color: { argb: "000000" } },
            left: { style: "thin" as const, color: { argb: "000000" } },
            bottom: { style: "thin" as const, color: { argb: "000000" } },
            right: { style: "thin" as const, color: { argb: "000000" } },
          },
        };

        filaActual++;
      });

      // Footer
      filaActual++;
      worksheet.mergeCells(`A${filaActual}:I${filaActual}`);
      const infoGenCell = worksheet.getCell(`A${filaActual}`);
      infoGenCell.value = `Document automatically generated on ${new Date().toLocaleString(
        "en-US"
      )} | SIASIS System - I.E. 20935 Asunción 8`;
      infoGenCell.style = {
        font: { size: 8, italic: true },
        fill: {
          type: "pattern" as const,
          pattern: "solid" as const,
          fgColor: { argb: "F9FAFB" },
        },
        alignment: {
          horizontal: "center" as const,
          vertical: "middle" as const,
        },
        border: {
          top: { style: "thin" as const, color: { argb: "000000" } },
          left: { style: "thin" as const, color: { argb: "000000" } },
          bottom: { style: "thin" as const, color: { argb: "000000" } },
          right: { style: "thin" as const, color: { argb: "000000" } },
        },
      };
    }

    // Generate and save file
    const buffer = await workbook.xlsx.writeBuffer();
    const nombreArchivo = esPersonal
      ? `My_Attendances_${mesLegible}_${new Date().getFullYear()}`
      : `Attendance_${datos.usuario.Nombres.replace(
          /\s+/g,
          "_"
        )}_${mesLegible}_${new Date().getFullYear()}`;

    // Attempt to use File System Access API if available
    const tieneFileSystemAPI = "showSaveFilePicker" in window;

    if (tieneFileSystemAPI && !esPersonal) {
      try {
        const fileHandle = await (window as any).showSaveFilePicker({
          suggestedName: `${nombreArchivo}.xlsx`,
          types: [
            {
              description: "Excel Files",
              accept: {
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
                  [".xlsx"],
              },
            },
          ],
        });

        const writable = await fileHandle.createWritable();
        await writable.write(buffer);
        await writable.close();

        setSuccessMessage("✅ Excel file saved successfully");
      } catch (error: any) {
        if (error.name === "AbortError") {
          setSuccessMessage("❌ Operation cancelled by user");
        } else {
          // Fallback to traditional download
          descargarTradicional(buffer, nombreArchivo);
          setSuccessMessage("✅ Excel file downloaded successfully");
        }
      }
    } else {
      // Traditional download
      descargarTradicional(buffer, nombreArchivo);
      setSuccessMessage("✅ Excel file downloaded successfully");
    }
  } catch (error) {
    console.error("❌ Error exporting to Excel:", error);
    setError({
      success: false,
      message: "Error generating Excel file. Please try again.",
    });
  } finally {
    setExportandoExcel(false);
  }
};

// Helper function for traditional download
const descargarTradicional = (buffer: ArrayBuffer, nombreArchivo: string) => {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${nombreArchivo}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};