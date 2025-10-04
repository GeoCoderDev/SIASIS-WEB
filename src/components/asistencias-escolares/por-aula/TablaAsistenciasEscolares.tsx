import React, { useState } from "react";
import { EstadosAsistenciaEscolar } from "@/interfaces/shared/EstadosAsistenciaEstudiantes";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";
import { FileDown, Loader2 } from "lucide-react";
import * as ExcelJS from "exceljs";
import { DatosTablaAsistencias } from "@/app/(interfaz)/(directivo)/registros-asistencias-escolares/page";
import { EstadosAsistenciaEscolarParaExcel } from "@/Assets/asistencia/EstadosEscolaresParaExcel";
import { COLORES_ESTADOS } from "@/app/(interfaz)/(responsable)/mis-estudiantes-relacionados/[Id_Estudiante]/asistencias-mensuales/types";

interface TablaAsistenciasEscolaresProps {
  datos: DatosTablaAsistencias;
}

const COLORES_ESTADOS_EXCEL = {
  [EstadosAsistenciaEscolar.Temprano]: {
    background: "D4F7D4",
    font: "000000",
  },
  [EstadosAsistenciaEscolar.Tarde]: {
    background: "FED7BA",
    font: "000000",
  },
  [EstadosAsistenciaEscolar.Falta]: {
    background: "FECACA",
    font: "000000",
  },
  [EstadosAsistenciaEscolar.Inactivo]: {
    background: "E5E7EB",
    font: "000000",
  },
  [EstadosAsistenciaEscolar.Evento]: {
    background: "DDD6FE",
    font: "000000",
  },
  [EstadosAsistenciaEscolar.Vacaciones]: {
    background: "FEF3C7",
    font: "000000",
  },
};

const MESES = [
  { value: 1, label: "Enero" },
  { value: 2, label: "Febrero" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Mayo" },
  { value: 6, label: "Junio" },
  { value: 7, label: "Julio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Septiembre" },
  { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" },
  { value: 12, label: "Diciembre" },
];

const TablaAsistenciasEscolares: React.FC<TablaAsistenciasEscolaresProps> = ({
  datos,
}) => {
  const [exportandoExcel, setExportandoExcel] = useState(false);
  const [mensajeExportacion, setMensajeExportacion] = useState("");

  const mesInfo = MESES.find((m) => m.value === datos.mes);

  const hoy = new Date();
  const mesActual = hoy.getMonth() + 1;
  const diaActual = hoy.getDate();
  const esMesActual = datos.mes === mesActual;
  const diaSemanaActual = hoy.getDay();

  const mostrarIndicadorDiaActual =
    esMesActual && diaSemanaActual >= 1 && diaSemanaActual <= 5;

  const renderCeldaAsistencia = (
    estado: EstadosAsistenciaEscolar,
    dia: number
  ) => {
    const colores = COLORES_ESTADOS[estado];
    const simbolo =
      estado === EstadosAsistenciaEscolar.Temprano
        ? "A"
        : estado === EstadosAsistenciaEscolar.Tarde
        ? "T"
        : estado === EstadosAsistenciaEscolar.Falta
        ? "F"
        : estado === EstadosAsistenciaEscolar.Evento
        ? "E"
        : "-";

    return (
      <div
        className={`w-6 h-6 flex items-center justify-center text-xs font-medium ${colores.background} ${colores.text} rounded`}
        title={`Día ${dia}: ${
          simbolo === "A"
            ? "Asistió"
            : simbolo === "T"
            ? "Tardanza"
            : simbolo === "F"
            ? "Falta"
            : simbolo === "E"
            ? "Evento"
            : "Sin datos"
        }`}
      >
        {simbolo}
      </div>
    );
  };

  const exportarAExcel = async () => {
    setExportandoExcel(true);
    setMensajeExportacion("");

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Asistencias", {
        pageSetup: {
          paperSize: 9,
          orientation: "landscape",
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
        },
      });

      // ENCABEZADO INSTITUCIONAL
      worksheet.mergeCells("A1:Z1");
      const tituloCell = worksheet.getCell("A1");
      tituloCell.value = "I.E. 20935 ASUNCIÓN 8 - IMPERIAL, CAÑETE";
      tituloCell.style = {
        font: { size: 16, bold: true, color: { argb: "FFFFFF" } },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "1E40AF" },
        },
        alignment: { horizontal: "center", vertical: "middle" },
        border: {
          top: { style: "medium" },
          left: { style: "medium" },
          bottom: { style: "medium" },
          right: { style: "medium" },
        },
      };
      worksheet.getRow(1).height = 25;

      worksheet.mergeCells("A2:Z2");
      const subtituloCell = worksheet.getCell("A2");
      subtituloCell.value = "REGISTRO MENSUAL DE ASISTENCIA ESCOLAR";
      subtituloCell.style = {
        font: { size: 14, bold: true, color: { argb: "FFFFFF" } },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "3B82F6" },
        },
        alignment: { horizontal: "center", vertical: "middle" },
        border: {
          top: { style: "medium" },
          left: { style: "medium" },
          bottom: { style: "medium" },
          right: { style: "medium" },
        },
      };
      worksheet.getRow(2).height = 20;

      worksheet.getRow(3).height = 5;

      // INFORMACIÓN DEL AULA
      let filaActual = 4;

      worksheet.mergeCells(`A${filaActual}:C${filaActual}`);
      worksheet.mergeCells(`D${filaActual}:F${filaActual}`);
      worksheet.mergeCells(`G${filaActual}:I${filaActual}`);
      worksheet.mergeCells(`J${filaActual}:L${filaActual}`);

      const nivelLabelCell = worksheet.getCell(`A${filaActual}`);
      nivelLabelCell.value = "NIVEL:";
      nivelLabelCell.style = {
        font: { bold: true, size: 10 },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "E5E7EB" },
        },
        alignment: { horizontal: "left", vertical: "middle", indent: 1 },
        border: {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        },
      };

      const nivelValueCell = worksheet.getCell(`D${filaActual}`);
      nivelValueCell.value =
        datos.aula.Nivel === NivelEducativo.PRIMARIA
          ? "Primaria"
          : "Secundaria";
      nivelValueCell.style = {
        font: { size: 10 },
        alignment: { horizontal: "left", vertical: "middle", indent: 1 },
        border: {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        },
      };

      const gradoLabelCell = worksheet.getCell(`G${filaActual}`);
      gradoLabelCell.value = "GRADO Y SECCIÓN:";
      gradoLabelCell.style = {
        font: { bold: true, size: 10 },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "E5E7EB" },
        },
        alignment: { horizontal: "left", vertical: "middle", indent: 1 },
        border: {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        },
      };

      const gradoValueCell = worksheet.getCell(`J${filaActual}`);
      gradoValueCell.value = `${datos.aula.Grado}° "${datos.aula.Seccion}"`;
      gradoValueCell.style = {
        font: { size: 10 },
        alignment: { horizontal: "left", vertical: "middle", indent: 1 },
        border: {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        },
      };

      filaActual++;

      worksheet.mergeCells(`A${filaActual}:C${filaActual}`);
      worksheet.mergeCells(`D${filaActual}:F${filaActual}`);
      worksheet.mergeCells(`G${filaActual}:I${filaActual}`);
      worksheet.mergeCells(`J${filaActual}:L${filaActual}`);

      const mesLabelCell = worksheet.getCell(`A${filaActual}`);
      mesLabelCell.value = "MES:";
      mesLabelCell.style = {
        font: { bold: true, size: 10 },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "E5E7EB" },
        },
        alignment: { horizontal: "left", vertical: "middle", indent: 1 },
        border: {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        },
      };

      const mesValueCell = worksheet.getCell(`D${filaActual}`);
      mesValueCell.value = mesInfo?.label || "";
      mesValueCell.style = {
        font: { size: 10 },
        alignment: { horizontal: "left", vertical: "middle", indent: 1 },
        border: {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        },
      };

      const totalLabelCell = worksheet.getCell(`G${filaActual}`);
      totalLabelCell.value = "TOTAL ESTUDIANTES:";
      totalLabelCell.style = {
        font: { bold: true, size: 10 },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "E5E7EB" },
        },
        alignment: { horizontal: "left", vertical: "middle", indent: 1 },
        border: {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        },
      };

      const totalValueCell = worksheet.getCell(`J${filaActual}`);
      totalValueCell.value = datos.estudiantes.length;
      totalValueCell.style = {
        font: { size: 10 },
        alignment: { horizontal: "left", vertical: "middle", indent: 1 },
        border: {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        },
      };

      filaActual += 2;

      // TABLA DE ASISTENCIAS
      const filaEncabezados = filaActual;

      worksheet.getColumn(1).width = 30;

      const nombreCell = worksheet.getCell(filaEncabezados, 1);
      nombreCell.value = "APELLIDOS Y NOMBRES";
      nombreCell.style = {
        font: { bold: true, size: 9, color: { argb: "FFFFFF" } },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "374151" },
        },
        alignment: { horizontal: "center", vertical: "middle", wrapText: true },
        border: {
          top: { style: "medium" },
          left: { style: "thin" },
          bottom: { style: "medium" },
          right: { style: "thin" },
        },
      };

      datos.diasDelMes.forEach(({ dia }, index) => {
        const col = index + 2;
        worksheet.getColumn(col).width = 4;

        const cell = worksheet.getCell(filaEncabezados, col);
        cell.value = dia;
        cell.style = {
          font: { bold: true, size: 9, color: { argb: "FFFFFF" } },
          fill: {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "374151" },
          },
          alignment: { horizontal: "center", vertical: "middle" },
          border: {
            top: { style: "medium" },
            left: { style: "thin" },
            bottom: { style: "medium" },
            right: { style: "thin" },
          },
        };
      });

      const colTotales = datos.diasDelMes.length + 2;
      ["F", "T", "A"].forEach((label, index) => {
        const col = colTotales + index;
        worksheet.getColumn(col).width = 6;

        const cell = worksheet.getCell(filaEncabezados, col);
        cell.value = label;
        cell.style = {
          font: { bold: true, size: 9, color: { argb: "FFFFFF" } },
          fill: {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "374151" },
          },
          alignment: { horizontal: "center", vertical: "middle" },
          border: {
            top: { style: "medium" },
            left: { style: "thin" },
            bottom: { style: "medium" },
            right: { style: "thin" },
          },
        };
      });

      worksheet.getRow(filaEncabezados).height = 20;

      // DATOS DE ESTUDIANTES
      let filaData = filaEncabezados + 1;

      datos.estudiantes.forEach((item, index) => {
        const fila = worksheet.getRow(filaData);
        const colorFondo = index % 2 === 0 ? "FFFFFF" : "F9FAFB";

        const nombreCell = fila.getCell(1);
        nombreCell.value = `${item.estudiante.Apellidos}, ${item.estudiante.Nombres}`;
        nombreCell.style = {
          font: { size: 9 },
          fill: {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: colorFondo },
          },
          alignment: { horizontal: "left", vertical: "middle", indent: 1 },
          border: {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          },
        };

        datos.diasDelMes.forEach(({ dia }, index) => {
          const col = index + 2;
          const cell = fila.getCell(col);
          const estado = item.asistencias[dia];

          if (estado) {
            const simbolo = EstadosAsistenciaEscolarParaExcel[estado];
            const colores = COLORES_ESTADOS_EXCEL[estado];

            cell.value = simbolo;
            cell.style = {
              font: { size: 9, bold: true, color: { argb: colores.font } },
              fill: {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: colores.background },
              },
              alignment: { horizontal: "center", vertical: "middle" },
              border: {
                top: { style: "thin" },
                left: { style: "thin" },
                bottom: { style: "thin" },
                right: { style: "thin" },
              },
            };
          } else {
            cell.value = "";
            cell.style = {
              fill: {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: colorFondo },
              },
              border: {
                top: { style: "thin" },
                left: { style: "thin" },
                bottom: { style: "thin" },
                right: { style: "thin" },
              },
            };
          }
        });

        const colTotales = datos.diasDelMes.length + 2;
        [
          item.totales.faltas,
          item.totales.tardanzas,
          item.totales.asistencias,
        ].forEach((valor, index) => {
          const col = colTotales + index;
          const cell = fila.getCell(col);
          cell.value = valor;
          cell.style = {
            font: { size: 9, bold: true },
            fill: {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: colorFondo },
            },
            alignment: { horizontal: "center", vertical: "middle" },
            border: {
              top: { style: "thin" },
              left: { style: "thin" },
              bottom: { style: "thin" },
              right: { style: "thin" },
            },
          };
        });

        fila.height = 18;
        filaData++;
      });

      // RESUMEN ESTADÍSTICO
      filaData += 1;

      const totalAsistencias = datos.estudiantes.reduce(
        (sum, e) => sum + e.totales.asistencias,
        0
      );
      const totalTardanzas = datos.estudiantes.reduce(
        (sum, e) => sum + e.totales.tardanzas,
        0
      );
      const totalFaltas = datos.estudiantes.reduce(
        (sum, e) => sum + e.totales.faltas,
        0
      );
      const totalDiasEscolares = datos.diasDelMes.length;
      const totalOportunidades = datos.estudiantes.length * totalDiasEscolares;
      const porcentajeAsistencia =
        totalOportunidades > 0
          ? ((totalAsistencias / totalOportunidades) * 100).toFixed(2)
          : "0.00";

      const colMax = datos.diasDelMes.length + 4;
      worksheet.mergeCells(`A${filaData}:${numberToExcelColumn(colMax)}${filaData}`);
      const resumenTituloCell = worksheet.getCell(`A${filaData}`);
      resumenTituloCell.value = "RESUMEN ESTADÍSTICO";
      resumenTituloCell.style = {
        font: { size: 12, bold: true, color: { argb: "FFFFFF" } },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "059669" },
        },
        alignment: { horizontal: "center", vertical: "middle" },
        border: {
          top: { style: "medium" },
          left: { style: "medium" },
          bottom: { style: "medium" },
          right: { style: "medium" },
        },
      };
      worksheet.getRow(filaData).height = 20;
      filaData++;

      const datosResumen = [
        {
          concepto: "Total Asistencias:",
          valor: totalAsistencias,
          color: "D4F7D4",
        },
        {
          concepto: "Total Tardanzas:",
          valor: totalTardanzas,
          color: "FED7BA",
        },
        { concepto: "Total Faltas:", valor: totalFaltas, color: "FECACA" },
        {
          concepto: "Porcentaje de Asistencia:",
          valor: `${porcentajeAsistencia}%`,
          color: "BFDBFE",
        },
      ];

      const colResumenConcepto = Math.floor(colMax / 2);
      
      datosResumen.forEach((dato, indexResumen) => {
        const filaActualResumen = filaData + indexResumen;
        
        const rangoConcepto = `A${filaActualResumen}:${numberToExcelColumn(colResumenConcepto)}${filaActualResumen}`;
        const rangoValor = `${numberToExcelColumn(colResumenConcepto + 1)}${filaActualResumen}:${numberToExcelColumn(colMax)}${filaActualResumen}`;
        
        worksheet.mergeCells(rangoConcepto);
        worksheet.mergeCells(rangoValor);

        const conceptoCell = worksheet.getCell(`A${filaActualResumen}`);
        conceptoCell.value = dato.concepto;
        conceptoCell.style = {
          font: { bold: true, size: 10 },
          fill: {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "F3F4F6" },
          },
          alignment: { horizontal: "left", vertical: "middle", indent: 1 },
          border: {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          },
        };

        const valorCell = worksheet.getCell(`${numberToExcelColumn(colResumenConcepto + 1)}${filaActualResumen}`);
        valorCell.value = dato.valor;
        valorCell.style = {
          font: { bold: true, size: 10 },
          fill: {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: dato.color },
          },
          alignment: { horizontal: "center", vertical: "middle" },
          border: {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          },
        };
      });
      
      filaData += datosResumen.length;

      // Información de generación
      filaData += 1;
      worksheet.mergeCells(`A${filaData}:${numberToExcelColumn(colMax)}${filaData}`);
      const infoGenCell = worksheet.getCell(`A${filaData}`);
      infoGenCell.value = `Documento generado automáticamente el ${new Date().toLocaleString(
        "es-ES"
      )} | Sistema SIASIS - I.E. 20935 Asunción 8`;
      infoGenCell.style = {
        font: { size: 8, italic: true },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "F9FAFB" },
        },
        alignment: { horizontal: "center", vertical: "middle" },
        border: {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        },
      };

      // GENERAR Y GUARDAR ARCHIVO
      const nivel =
        datos.aula.Nivel === NivelEducativo.PRIMARIA
          ? "Primaria"
          : "Secundaria";
      const nombreFinal = `Asistencias_${nivel}_${datos.aula.Grado}${
        datos.aula.Seccion
      }_${mesInfo?.label}_${new Date().getFullYear()}`;

      const buffer = await workbook.xlsx.writeBuffer();

      const tieneFileSystemAPI = "showSaveFilePicker" in window;

      if (tieneFileSystemAPI) {
        try {
          const fileHandle = await (window as any).showSaveFilePicker({
            suggestedName: `${nombreFinal}.xlsx`,
            types: [
              {
                description: "Archivos Excel",
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

          setMensajeExportacion("✅ Archivo Excel guardado exitosamente");
        } catch (error: any) {
          if (error.name === "AbortError") {
            setMensajeExportacion("❌ Operación cancelada por el usuario");
          } else {
            downloadTraditional(buffer, nombreFinal);
          }
        }
      } else {
        downloadTraditional(buffer, nombreFinal);
      }

      setTimeout(() => setMensajeExportacion(""), 4000);
    } catch (error) {
      console.error("Error al exportar a Excel:", error);
      setMensajeExportacion("❌ Error al generar el archivo Excel");
      setTimeout(() => setMensajeExportacion(""), 4000);
    } finally {
      setExportandoExcel(false);
    }
  };

  // Función auxiliar para convertir número a letra de columna Excel
  const numberToExcelColumn = (num: number): string => {
    let column = "";
    while (num > 0) {
      const remainder = (num - 1) % 26;
      column = String.fromCharCode(65 + remainder) + column;
      num = Math.floor((num - 1) / 26);
    }
    return column;
  };

  const downloadTraditional = (buffer: ArrayBuffer, nombreFinal: string) => {
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${nombreFinal}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    setMensajeExportacion("✅ Archivo Excel descargado exitosamente");
  };

  return (
    <div className="bg-white rounded-lg shadow-sm h-full flex flex-col overflow-hidden w-full max-w-full max-h-[500px]">
      <div className="p-4 border-b border-gray-200 flex-shrink-0">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">
            {mesInfo?.label} - {datos.aula.Grado}° "{datos.aula.Seccion}"
          </h2>
          <div className="flex items-center gap-4">
            <button
              onClick={exportarAExcel}
              disabled={exportandoExcel}
              className={`px-4 py-2 rounded-md font-medium flex items-center gap-2 transition-all duration-200 ${
                exportandoExcel
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-green-600 text-white hover:bg-green-700 shadow-md hover:shadow-lg"
              }`}
            >
              {exportandoExcel ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Exportando...
                </>
              ) : (
                <>
                  <FileDown className="w-5 h-5" />
                  Exportar a Excel
                </>
              )}
            </button>

            <div className="text-sm text-gray-600">
              {datos.estudiantes.length} estudiantes • Actualizado:{" "}
              {datos.fechaConsulta}
            </div>
          </div>
        </div>

        {mensajeExportacion && (
          <div
            className={`mt-2 text-sm ${
              mensajeExportacion.includes("✅")
                ? "text-green-600"
                : "text-red-600"
            }`}
          >
            {mensajeExportacion}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        <table className="min-w-full relative border-collapse">
          <thead className="bg-gray-50">
            <tr>
              <th className="md:sticky md:left-0 sticky top-0 bg-gray-50 px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-b-0 border-gray-200 md:z-30 z-20 min-w-[200px] h-10"></th>
              {datos.diasDelMes.map(({ dia, diaSemana }) => (
                <th
                  key={`dia-${dia}`}
                  className="sticky top-0 bg-gray-50 px-2 py-1 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-0 border-gray-200 z-20 min-w-[40px] h-10"
                >
                  {diaSemana}
                </th>
              ))}
              <th className="md:sticky md:right-[120px] sticky top-0 bg-gray-50 px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-l border-b-0 border-gray-200 md:z-30 z-20 min-w-[60px] h-10"></th>
              <th className="md:sticky md:right-[60px] sticky top-0 bg-gray-50 px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-0 border-gray-200 md:z-30 z-20 min-w-[60px] h-10"></th>
              <th className="md:sticky md:right-0 sticky top-0 bg-gray-50 px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-l border-b-0 border-gray-200 md:z-30 z-20 min-w-[60px] h-10"></th>
            </tr>
            <tr>
              <th className="md:sticky md:left-0 sticky top-10 bg-gray-50 px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-b border-gray-200 md:z-30 z-20 h-12">
                Apellidos y Nombres
              </th>
              {datos.diasDelMes.map(({ dia }) => (
                <th
                  key={dia}
                  className="sticky top-10 bg-gray-50 px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200 z-20 min-w-[40px] relative h-12"
                >
                  <div className="flex flex-col items-center justify-center gap-0.5 h-full">
                    {mostrarIndicadorDiaActual && dia === diaActual && (
                      <div className="text-blue-600 text-base leading-none -mb-1">
                        ▼
                      </div>
                    )}
                    <span>{dia}</span>
                  </div>
                </th>
              ))}
              <th className="md:sticky md:right-[120px] sticky top-10 bg-gray-50 px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-l border-b border-gray-200 md:z-30 z-20 h-12">
                F
              </th>
              <th className="md:sticky md:right-[60px] sticky top-10 bg-gray-50 px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200 md:z-30 z-20 h-12">
                T
              </th>
              <th className="md:sticky md:right-0 sticky top-10 bg-gray-50 px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-l border-b border-gray-200 md:z-30 z-20 h-12">
                A
              </th>
            </tr>
          </thead>

          <tbody className="bg-white divide-y divide-gray-200">
            {datos.estudiantes.map((item: any, index: any) => (
              <tr
                key={item.estudiante.Id_Estudiante}
                className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
              >
                <td className="md:sticky md:left-0 bg-inherit px-4 py-3 text-sm font-medium text-gray-900 border-r border-gray-200 md:z-10 min-w-[200px]">
                  <div className="truncate">
                    {item.estudiante.Apellidos}, {item.estudiante.Nombres}
                  </div>
                </td>

                {datos.diasDelMes.map(({ dia }: { dia: any }) => (
                  <td key={dia} className="px-2 py-3 text-center min-w-[40px]">
                    {item.asistencias[dia] ? (
                      <div className="flex justify-center">
                        {renderCeldaAsistencia(item.asistencias[dia], dia)}
                      </div>
                    ) : (
                      <div className="w-6 h-6"></div>
                    )}
                  </td>
                ))}

                <td className="md:sticky md:right-[120px] bg-inherit px-4 py-3 text-center text-sm font-medium text-red-600 border-l border-gray-200 md:z-10">
                  {item.totales.faltas}
                </td>
                <td className="md:sticky md:right-[60px] bg-inherit px-4 py-3 text-center text-sm font-medium text-orange-600 md:z-10">
                  {item.totales.tardanzas}
                </td>
                <td className="md:sticky md:right-0 bg-inherit px-4 py-3 text-center text-sm font-medium text-green-600 border-l border-gray-200 md:z-10">
                  {item.totales.asistencias}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded flex items-center justify-center text-white text-xs font-medium">
              A
            </div>
            <span>Asistió</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-orange-500 rounded flex items-center justify-center text-white text-xs font-medium">
              T
            </div>
            <span>Tardanza</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-700 rounded flex items-center justify-center text-white text-xs font-medium">
              F
            </div>
            <span>Falta</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-purple-600 rounded flex items-center justify-center text-white text-xs font-medium">
              E
            </div>
            <span>Evento</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-400 rounded flex items-center justify-center text-white text-xs font-medium">
              -
            </div>
            <span>Sin datos</span>
          </div>
          {mostrarIndicadorDiaActual && (
            <div className="flex items-center gap-2 ml-4">
              <div className="text-blue-600 text-lg leading-none">▼</div>
              <span>Día actual</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TablaAsistenciasEscolares;