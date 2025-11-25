import React, { useState } from "react";
import { EstadosAsistenciaEscolar } from "@/interfaces/shared/EstadosAsistenciaEstudiantes";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";
import * as ExcelJS from "exceljs";

import { EstadosAsistenciaEscolarParaExcel } from "@/Assets/asistencia/EstadosEscolaresParaExcel";
import { COLORES_ESTADOS_ASISTENCIA_ESCOLAR } from "@/app/(interfaz)/(responsable)/mis-estudiantes-relacionados/[Id_Estudiante]/asistencias-mensuales/types";
import { DatosTablaAsistencias } from "./ConsultaAsistenciasEscolaresPorRol";

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
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
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

  // Helper function to convert number to Excel column letter
  const numberToExcelColumn = (num: number): string => {
    let column = "";
    while (num > 0) {
      const remainder = (num - 1) % 26;
      column = String.fromCharCode(65 + remainder) + column;
      num = Math.floor((num - 1) / 26);
    }
    return column;
  };

  // Helper function to apply borders to ALL cells in a merged range
  const aplicarBordesACeldasFusionadas = (
    worksheet: ExcelJS.Worksheet,
    rango: string,
    estilo: any
  ) => {
    const [inicio, fin] = rango.split(":");
    const colInicio = inicio.match(/[A-Z]+/)?.[0] || "";
    const filaInicio = parseInt(inicio.match(/\d+/)?.[0] || "0");
    const colFin = fin.match(/[A-Z]+/)?.[0] || "";
    const filaFin = parseInt(fin.match(/\d+/)?.[0] || "0");

    const colInicioNum = colInicio
      .split("")
      .reduce((acc, char) => acc * 26 + char.charCodeAt(0) - 64, 0);
    const colFinNum = colFin
      .split("")
      .reduce((acc, char) => acc * 26 + char.charCodeAt(0) - 64, 0);

    for (let fila = filaInicio; fila <= filaFin; fila++) {
      for (let col = colInicioNum; col <= colFinNum; col++) {
        const celda = worksheet.getCell(fila, col);
        celda.style = { ...celda.style, ...estilo };
      }
    }
  };

  const renderCeldaAsistencia = (
    estado: EstadosAsistenciaEscolar,
    dia: number
  ) => {
    const colores = COLORES_ESTADOS_ASISTENCIA_ESCOLAR[estado];
    const simbolo =
      estado === EstadosAsistenciaEscolar.Temprano
        ? "P"
        : estado === EstadosAsistenciaEscolar.Tarde
        ? "L"
        : estado === EstadosAsistenciaEscolar.Falta
        ? "A"
        : estado === EstadosAsistenciaEscolar.Evento
        ? "E"
        : "-";

    return (
      <div
        className={`w-6 h-6 flex items-center justify-center text-xs font-medium ${colores.background} ${colores.text} rounded`}
        title={`Day ${dia}: ${
          simbolo === "P"
            ? "Present"
            : simbolo === "L"
            ? "Late"
            : simbolo === "A"
            ? "Absent"
            : simbolo === "E"
            ? "Event"
            : "No data"
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
      const worksheet = workbook.addWorksheet("Attendances", {
        pageSetup: {
          paperSize: 9,
          orientation: "landscape",
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
        },
      });

      // STEP 1: CALCULATE CALENDAR STRUCTURE (Monday to Friday)
      const año = new Date().getFullYear();
      const mes = datos.mes;
      const primerDia = new Date(año, mes - 1, 1);
      const ultimoDia = new Date(año, mes, 0);
      const diasEnMes = ultimoDia.getDate();

      let diaSemanaInicio = primerDia.getDay();
      if (diaSemanaInicio === 0) diaSemanaInicio = 7;

      const estructuraCalendario: Array<{
        dia: number | null;
        diaSemana: string;
      }> = [];

      let diaActualMes = 1;

      while (diaActualMes <= diasEnMes) {
        const diasSemanaTextos = ["", "M", "T", "W", "T", "F"];

        for (let diaSemana = 1; diaSemana <= 5; diaSemana++) {
          if (diaActualMes === 1 && diaSemana < diaSemanaInicio) {
            estructuraCalendario.push({
              dia: null,
              diaSemana: diasSemanaTextos[diaSemana],
            });
          } else if (diaActualMes <= diasEnMes) {
            const fechaActual = new Date(año, mes - 1, diaActualMes);
            const diaSemanaActual = fechaActual.getDay();

            if (diaSemanaActual >= 1 && diaSemanaActual <= 5) {
              estructuraCalendario.push({
                dia: diaActualMes,
                diaSemana: diasSemanaTextos[diaSemanaActual],
              });
              diaActualMes++;
            } else {
              diaActualMes++;
              diaSemana--;
            }
          } else {
            estructuraCalendario.push({
              dia: null,
              diaSemana: diasSemanaTextos[diaSemana],
            });
          }
        }
      }

      // STEP 2: CALCULATE TOTAL COLUMNS
      // 1 (names) + calendar days + 3 (A, L, P)
      const totalColumnas = 1 + estructuraCalendario.length + 3;

      // STEP 3: INSTITUTIONAL HEADER
      const rangoTitulo = `A1:${numberToExcelColumn(totalColumnas)}1`;
      worksheet.mergeCells(rangoTitulo);

      const estiloTitulo = {
        font: { size: 16, bold: true, color: { argb: "FFFFFF" } },
        fill: {
          type: "pattern" as const,
          pattern: "solid" as const,
          fgColor: { argb: "1E40AF" },
        },
        alignment: {
          horizontal: "center" as const,
          vertical: "middle" as const,
        },
        border: {
          top: { style: "medium" as const },
          left: { style: "medium" as const },
          bottom: { style: "medium" as const },
          right: { style: "medium" as const },
        },
      };

      aplicarBordesACeldasFusionadas(worksheet, rangoTitulo, estiloTitulo);
      worksheet.getCell("A1").value =
        "I.E. 20935 ASUNCIÓN 8 - IMPERIAL, CAÑETE";
      worksheet.getRow(1).height = 25;

      const rangoSubtitulo = `A2:${numberToExcelColumn(totalColumnas)}2`;
      worksheet.mergeCells(rangoSubtitulo);

      const estiloSubtitulo = {
        font: { size: 14, bold: true, color: { argb: "FFFFFF" } },
        fill: {
          type: "pattern" as const,
          pattern: "solid" as const,
          fgColor: { argb: "3B82F6" },
        },
        alignment: {
          horizontal: "center" as const,
          vertical: "middle" as const,
        },
        border: {
          top: { style: "medium" as const },
          left: { style: "medium" as const },
          bottom: { style: "medium" as const },
          right: { style: "medium" as const },
        },
      };

      aplicarBordesACeldasFusionadas(
        worksheet,
        rangoSubtitulo,
        estiloSubtitulo
      );
      worksheet.getCell("A2").value = "MONTHLY SCHOOL ATTENDANCE RECORD";
      worksheet.getRow(2).height = 20;

      // STEP 4: CLASSROOM INFORMATION (distribute in 50%-50%)
      let filaActual = 3;

      const colsPorSeccion = Math.floor(totalColumnas / 3);
      const col1Inicio = 1;
      const col1Fin = colsPorSeccion;
      const col2Inicio = colsPorSeccion + 1;
      const col2Fin = colsPorSeccion * 2;
      const col3Inicio = colsPorSeccion * 2 + 1;
      const col3Fin = totalColumnas;

      const estiloLabel = {
        font: { bold: true, size: 10 },
        fill: {
          type: "pattern" as const,
          pattern: "solid" as const,
          fgColor: { argb: "E5E7EB" },
        },
        alignment: {
          horizontal: "left" as const,
          vertical: "middle" as const,
          indent: 1,
        },
        border: {
          top: { style: "thin" as const },
          left: { style: "thin" as const },
          bottom: { style: "thin" as const },
          right: { style: "thin" as const },
        },
      };

      const estiloValor = {
        font: { size: 10 },
        alignment: {
          horizontal: "left" as const,
          vertical: "middle" as const,
          indent: 1,
        },
        border: {
          top: { style: "thin" as const },
          left: { style: "thin" as const },
          bottom: { style: "thin" as const },
          right: { style: "thin" as const },
        },
      };

      // Row 1: LEVEL | GRADE AND SECTION
      const labelCol1Fin =
        Math.floor((col1Fin - col1Inicio) * 0.4) + col1Inicio;
      const labelCol2Fin =
        Math.floor((col2Fin - col2Inicio) * 0.4) + col2Inicio;

      worksheet.mergeCells(
        `${numberToExcelColumn(col1Inicio)}${filaActual}:${numberToExcelColumn(
          labelCol1Fin
        )}${filaActual}`
      );
      aplicarBordesACeldasFusionadas(
        worksheet,
        `${numberToExcelColumn(col1Inicio)}${filaActual}:${numberToExcelColumn(
          labelCol1Fin
        )}${filaActual}`,
        {
          ...estiloLabel,
          border: { ...estiloLabel.border, left: { style: "medium" as const } },
        }
      );
      worksheet.getCell(
        `${numberToExcelColumn(col1Inicio)}${filaActual}`
      ).value = "LEVEL:";

      worksheet.mergeCells(
        `${numberToExcelColumn(
          labelCol1Fin + 1
        )}${filaActual}:${numberToExcelColumn(col1Fin)}${filaActual}`
      );
      aplicarBordesACeldasFusionadas(
        worksheet,
        `${numberToExcelColumn(
          labelCol1Fin + 1
        )}${filaActual}:${numberToExcelColumn(col1Fin)}${filaActual}`,
        estiloValor
      );
      worksheet.getCell(
        `${numberToExcelColumn(labelCol1Fin + 1)}${filaActual}`
      ).value =
        datos.aula.Nivel === NivelEducativo.PRIMARIA
          ? "Primary"
          : "Secondary";

      worksheet.mergeCells(
        `${numberToExcelColumn(col2Inicio)}${filaActual}:${numberToExcelColumn(
          labelCol2Fin
        )}${filaActual}`
      );
      aplicarBordesACeldasFusionadas(
        worksheet,
        `${numberToExcelColumn(col2Inicio)}${filaActual}:${numberToExcelColumn(
          labelCol2Fin
        )}${filaActual}`,
        estiloLabel
      );
      worksheet.getCell(
        `${numberToExcelColumn(col2Inicio)}${filaActual}`
      ).value = "GRADE AND SECTION:";

      worksheet.mergeCells(
        `${numberToExcelColumn(
          labelCol2Fin + 1
        )}${filaActual}:${numberToExcelColumn(col2Fin)}${filaActual}`
      );
      aplicarBordesACeldasFusionadas(
        worksheet,
        `${numberToExcelColumn(
          labelCol2Fin + 1
        )}${filaActual}:${numberToExcelColumn(col2Fin)}${filaActual}`,
        {
          ...estiloValor,
          border: {
            ...estiloValor.border,
            right: { style: "medium" as const },
          },
        }
      );
      worksheet.getCell(
        `${numberToExcelColumn(labelCol2Fin + 1)}${filaActual}`
      ).value = `${datos.aula.Grado}° "${datos.aula.Seccion}"`;

      filaActual++;

      // Row 2: MONTH | TOTAL STUDENTS
      worksheet.mergeCells(
        `${numberToExcelColumn(col1Inicio)}${filaActual}:${numberToExcelColumn(
          labelCol1Fin
        )}${filaActual}`
      );
      aplicarBordesACeldasFusionadas(
        worksheet,
        `${numberToExcelColumn(col1Inicio)}${filaActual}:${numberToExcelColumn(
          labelCol1Fin
        )}${filaActual}`,
        {
          ...estiloLabel,
          border: { ...estiloLabel.border, left: { style: "medium" as const } },
        }
      );
      worksheet.getCell(
        `${numberToExcelColumn(col1Inicio)}${filaActual}`
      ).value = "MONTH:";

      worksheet.mergeCells(
        `${numberToExcelColumn(
          labelCol1Fin + 1
        )}${filaActual}:${numberToExcelColumn(col1Fin)}${filaActual}`
      );
      aplicarBordesACeldasFusionadas(
        worksheet,
        `${numberToExcelColumn(
          labelCol1Fin + 1
        )}${filaActual}:${numberToExcelColumn(col1Fin)}${filaActual}`,
        estiloValor
      );
      worksheet.getCell(
        `${numberToExcelColumn(labelCol1Fin + 1)}${filaActual}`
      ).value = mesInfo?.label || "";

      worksheet.mergeCells(
        `${numberToExcelColumn(col2Inicio)}${filaActual}:${numberToExcelColumn(
          labelCol2Fin
        )}${filaActual}`
      );
      aplicarBordesACeldasFusionadas(
        worksheet,
        `${numberToExcelColumn(col2Inicio)}${filaActual}:${numberToExcelColumn(
          labelCol2Fin
        )}${filaActual}`,
        estiloLabel
      );
      worksheet.getCell(
        `${numberToExcelColumn(col2Inicio)}${filaActual}`
      ).value = "TOTAL STUDENTS:";

      worksheet.mergeCells(
        `${numberToExcelColumn(
          labelCol2Fin + 1
        )}${filaActual}:${numberToExcelColumn(col2Fin)}${filaActual}`
      );
      aplicarBordesACeldasFusionadas(
        worksheet,
        `${numberToExcelColumn(
          labelCol2Fin + 1
        )}${filaActual}:${numberToExcelColumn(col2Fin)}${filaActual}`,
        {
          ...estiloValor,
          border: {
            ...estiloValor.border,
            right: { style: "medium" as const },
          },
        }
      );
      worksheet.getCell(
        `${numberToExcelColumn(labelCol2Fin + 1)}${filaActual}`
      ).value = datos.estudiantes.length;

      filaActual++;

      // Separation row between information and table
      worksheet.getRow(filaActual).height = 8;
      filaActual++;

      // STEP 5: ATTENDANCE TABLE
      const filaEncabezados = filaActual;

      worksheet.getColumn(1).width = 30;

      // Name (merge 2 rows vertically)
      worksheet.mergeCells(`A${filaEncabezados}:A${filaEncabezados + 1}`);
      const estiloNombreHeader = {
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
          top: { style: "medium" as const },
          left: { style: "medium" as const },
          bottom: { style: "medium" as const },
          right: { style: "thin" as const },
        },
      };

      aplicarBordesACeldasFusionadas(
        worksheet,
        `A${filaEncabezados}:A${filaEncabezados + 1}`,
        estiloNombreHeader
      );
      worksheet.getCell(`A${filaEncabezados}`).value = "SURNAMES AND NAMES";

      // Days of the month (2 rows: day letter and number)
      estructuraCalendario.forEach((diaInfo, index) => {
        const col = index + 2;
        worksheet.getColumn(col).width = 4;

        const cellDiaSemana = worksheet.getCell(filaEncabezados, col);
        cellDiaSemana.value = diaInfo.diaSemana;
        cellDiaSemana.style = {
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
            bottom: { style: "thin" },
            right: { style: "thin" },
          },
        };

        const cellNumDia = worksheet.getCell(filaEncabezados + 1, col);
        cellNumDia.value = diaInfo.dia || "";
        cellNumDia.style = {
          font: { bold: true, size: 9, color: { argb: "FFFFFF" } },
          fill: {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "374151" },
          },
          alignment: { horizontal: "center", vertical: "middle" },
          border: {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "medium" },
            right: { style: "thin" },
          },
        };
      });

      // Totals (A, L, P) - merge vertically
      const colTotales = estructuraCalendario.length + 2;
      ["A", "L", "P"].forEach((label, index) => {
        const col = colTotales + index;
        worksheet.getColumn(col).width = 6;

        worksheet.mergeCells(
          `${numberToExcelColumn(col)}${filaEncabezados}:${numberToExcelColumn(
            col
          )}${filaEncabezados + 1}`
        );
        const estiloTotal = {
          font: { bold: true, size: 9, color: { argb: "FFFFFF" } },
          fill: {
            type: "pattern" as const,
            pattern: "solid" as const,
            fgColor: { argb: "374151" },
          },
          alignment: {
            horizontal: "center" as const,
            vertical: "middle" as const,
          },
          border: {
            top: { style: "medium" as const },
            left: { style: "thin" as const },
            bottom: { style: "medium" as const },
            right:
              index === 2
                ? { style: "medium" as const }
                : { style: "thin" as const },
          },
        };

        aplicarBordesACeldasFusionadas(
          worksheet,
          `${numberToExcelColumn(col)}${filaEncabezados}:${numberToExcelColumn(
            col
          )}${filaEncabezados + 1}`,
          estiloTotal
        );
        worksheet.getCell(filaEncabezados, col).value = label;
      });

      worksheet.getRow(filaEncabezados).height = 15;
      worksheet.getRow(filaEncabezados + 1).height = 15;

      // STEP 6: STUDENT DATA
      let filaData = filaEncabezados + 2;

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
            left: { style: "medium" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          },
        };

        estructuraCalendario.forEach((diaInfo, idx) => {
          const col = idx + 2;
          const cell = fila.getCell(col);
          const dia = diaInfo.dia;

          if (dia && item.asistencias[dia]) {
            const estado = item.asistencias[dia];
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

        [
          item.totales.faltas,
          item.totales.tardanzas,
          item.totales.asistencias,
        ].forEach((valor, idx) => {
          const col = colTotales + idx;
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
              right: idx === 2 ? { style: "medium" } : { style: "thin" },
            },
          };
        });

        fila.height = 18;
        filaData++;
      });

      // Separation row before summary
      worksheet.getRow(filaData).height = 8;
      filaData++;

      // STEP 7: STATISTICAL SUMMARY
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

      const diasEscolaresReales = estructuraCalendario.filter(
        (d) => d.dia !== null
      ).length;
      const totalOportunidades = datos.estudiantes.length * diasEscolaresReales;

      // Calculate percentages
      const porcentajeAsistencias =
        totalOportunidades > 0
          ? ((totalAsistencias / totalOportunidades) * 100).toFixed(2)
          : "0.00";
      const porcentajeTardanzas =
        totalOportunidades > 0
          ? ((totalTardanzas / totalOportunidades) * 100).toFixed(2)
          : "0.00";
      const porcentajeFaltas =
        totalOportunidades > 0
          ? ((totalFaltas / totalOportunidades) * 100).toFixed(2)
          : "0.00";

      // SUMMARY TITLE
      const rangoResumenTitulo = `A${filaData}:${numberToExcelColumn(
        totalColumnas
      )}${filaData}`;
      worksheet.mergeCells(rangoResumenTitulo);

      const estiloResumenTitulo = {
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
          top: { style: "medium" as const },
          left: { style: "medium" as const },
          bottom: { style: "medium" as const },
          right: { style: "medium" as const },
        },
      };

      aplicarBordesACeldasFusionadas(
        worksheet,
        rangoResumenTitulo,
        estiloResumenTitulo
      );
      worksheet.getCell(`A${filaData}`).value = "STATISTICAL SUMMARY";
      worksheet.getRow(filaData).height = 20;
      filaData++;

      // DISTRIBUTION IN 3 COLUMNS

      // Row 1: Labels
      const rangoLabelAsistencias = `${numberToExcelColumn(
        col1Inicio
      )}${filaData}:${numberToExcelColumn(col1Fin)}${filaData}`;
      const rangoLabelTardanzas = `${numberToExcelColumn(
        col2Inicio
      )}${filaData}:${numberToExcelColumn(col2Fin)}${filaData}`;
      const rangoLabelFaltas = `${numberToExcelColumn(
        col3Inicio
      )}${filaData}:${numberToExcelColumn(col3Fin)}${filaData}`;

      worksheet.mergeCells(rangoLabelAsistencias);
      worksheet.mergeCells(rangoLabelTardanzas);
      worksheet.mergeCells(rangoLabelFaltas);

      const estiloLabelAsistencias = {
        font: { bold: true, size: 10, color: { argb: "FFFFFF" } },
        fill: {
          type: "pattern" as const,
          pattern: "solid" as const,
          fgColor: { argb: "16A34A" },
        },
        alignment: {
          horizontal: "center" as const,
          vertical: "middle" as const,
        },
        border: {
          top: { style: "thin" as const },
          left: { style: "medium" as const },
          bottom: { style: "thin" as const },
          right: { style: "thin" as const },
        },
      };

      const estiloLabelTardanzas = {
        ...estiloLabelAsistencias,
        fill: {
          type: "pattern" as const,
          pattern: "solid" as const,
          fgColor: { argb: "EA580C" },
        },
        border: {
          top: { style: "thin" as const },
          left: { style: "thin" as const },
          bottom: { style: "thin" as const },
          right: { style: "thin" as const },
        },
      };

      const estiloLabelFaltas = {
        ...estiloLabelAsistencias,
        fill: {
          type: "pattern" as const,
          pattern: "solid" as const,
          fgColor: { argb: "DC2626" },
        },
        border: {
          top: { style: "thin" as const },
          left: { style: "thin" as const },
          bottom: { style: "thin" as const },
          right: { style: "medium" as const },
        },
      };

      aplicarBordesACeldasFusionadas(
        worksheet,
        rangoLabelAsistencias,
        estiloLabelAsistencias
      );
      aplicarBordesACeldasFusionadas(
        worksheet,
        rangoLabelTardanzas,
        estiloLabelTardanzas
      );
      aplicarBordesACeldasFusionadas(
        worksheet,
        rangoLabelFaltas,
        estiloLabelFaltas
      );

      worksheet.getCell(`${numberToExcelColumn(col1Inicio)}${filaData}`).value =
        "ATTENDANCES";
      worksheet.getCell(`${numberToExcelColumn(col2Inicio)}${filaData}`).value =
        "LATE ARRIVALS";
      worksheet.getCell(`${numberToExcelColumn(col3Inicio)}${filaData}`).value =
        "ABSENCES";

      worksheet.getRow(filaData).height = 18;
      filaData++;

      // Row 2: Totals
      const rangoTotalAsistencias = `${numberToExcelColumn(
        col1Inicio
      )}${filaData}:${numberToExcelColumn(col1Fin)}${filaData}`;
      const rangoTotalTardanzas = `${numberToExcelColumn(
        col2Inicio
      )}${filaData}:${numberToExcelColumn(col2Fin)}${filaData}`;
      const rangoTotalFaltas = `${numberToExcelColumn(
        col3Inicio
      )}${filaData}:${numberToExcelColumn(col3Fin)}${filaData}`;

      worksheet.mergeCells(rangoTotalAsistencias);
      worksheet.mergeCells(rangoTotalTardanzas);
      worksheet.mergeCells(rangoTotalFaltas);

      const estiloValorAsistencias = {
        font: { bold: true, size: 11 },
        fill: {
          type: "pattern" as const,
          pattern: "solid" as const,
          fgColor: { argb: "D4F7D4" },
        },
        alignment: {
          horizontal: "center" as const,
          vertical: "middle" as const,
        },
        border: {
          top: { style: "thin" as const },
          left: { style: "medium" as const },
          bottom: { style: "thin" as const },
          right: { style: "thin" as const },
        },
      };

      const estiloValorTardanzas = {
        ...estiloValorAsistencias,
        fill: {
          type: "pattern" as const,
          pattern: "solid" as const,
          fgColor: { argb: "FED7BA" },
        },
        border: {
          top: { style: "thin" as const },
          left: { style: "thin" as const },
          bottom: { style: "thin" as const },
          right: { style: "thin" as const },
        },
      };

      const estiloValorFaltas = {
        ...estiloValorAsistencias,
        fill: {
          type: "pattern" as const,
          pattern: "solid" as const,
          fgColor: { argb: "FECACA" },
        },
        border: {
          top: { style: "thin" as const },
          left: { style: "thin" as const },
          bottom: { style: "thin" as const },
          right: { style: "medium" as const },
        },
      };

      aplicarBordesACeldasFusionadas(
        worksheet,
        rangoTotalAsistencias,
        estiloValorAsistencias
      );
      aplicarBordesACeldasFusionadas(
        worksheet,
        rangoTotalTardanzas,
        estiloValorTardanzas
      );
      aplicarBordesACeldasFusionadas(
        worksheet,
        rangoTotalFaltas,
        estiloValorFaltas
      );

      worksheet.getCell(
        `${numberToExcelColumn(col1Inicio)}${filaData}`
      ).value = `Total: ${totalAsistencias}`;
      worksheet.getCell(
        `${numberToExcelColumn(col2Inicio)}${filaData}`
      ).value = `Total: ${totalTardanzas}`;
      worksheet.getCell(
        `${numberToExcelColumn(col3Inicio)}${filaData}`
      ).value = `Total: ${totalFaltas}`;

      worksheet.getRow(filaData).height = 18;
      filaData++;

      // Row 3: Percentages
      const rangoPorcentajeAsistencias = `${numberToExcelColumn(
        col1Inicio
      )}${filaData}:${numberToExcelColumn(col1Fin)}${filaData}`;
      const rangoPorcentajeTardanzas = `${numberToExcelColumn(
        col2Inicio
      )}${filaData}:${numberToExcelColumn(col2Fin)}${filaData}`;
      const rangoPorcentajeFaltas = `${numberToExcelColumn(
        col3Inicio
      )}${filaData}:${numberToExcelColumn(col3Fin)}${filaData}`;

      worksheet.mergeCells(rangoPorcentajeAsistencias);
      worksheet.mergeCells(rangoPorcentajeTardanzas);
      worksheet.mergeCells(rangoPorcentajeFaltas);

      const estiloPorcentajeAsistencias = {
        font: { bold: true, size: 12, color: { argb: "16A34A" } },
        fill: {
          type: "pattern" as const,
          pattern: "solid" as const,
          fgColor: { argb: "DCFCE7" },
        },
        alignment: {
          horizontal: "center" as const,
          vertical: "middle" as const,
        },
        border: {
          top: { style: "thin" as const },
          left: { style: "medium" as const },
          bottom: { style: "medium" as const },
          right: { style: "thin" as const },
        },
      };

      const estiloPorcentajeTardanzas = {
        ...estiloPorcentajeAsistencias,
        font: { bold: true, size: 12, color: { argb: "EA580C" } },
        fill: {
          type: "pattern" as const,
          pattern: "solid" as const,
          fgColor: { argb: "FFEDD5" },
        },
        border: {
          top: { style: "thin" as const },
          left: { style: "thin" as const },
          bottom: { style: "medium" as const },
          right: { style: "thin" as const },
        },
      };

      const estiloPorcentajeFaltas = {
        ...estiloPorcentajeAsistencias,
        font: { bold: true, size: 12, color: { argb: "DC2626" } },
        fill: {
          type: "pattern" as const,
          pattern: "solid" as const,
          fgColor: { argb: "FEE2E2" },
        },
        border: {
          top: { style: "thin" as const },
          left: { style: "thin" as const },
          bottom: { style: "medium" as const },
          right: { style: "medium" as const },
        },
      };

      aplicarBordesACeldasFusionadas(
        worksheet,
        rangoPorcentajeAsistencias,
        estiloPorcentajeAsistencias
      );
      aplicarBordesACeldasFusionadas(
        worksheet,
        rangoPorcentajeTardanzas,
        estiloPorcentajeTardanzas
      );
      aplicarBordesACeldasFusionadas(
        worksheet,
        rangoPorcentajeFaltas,
        estiloPorcentajeFaltas
      );

      worksheet.getCell(
        `${numberToExcelColumn(col1Inicio)}${filaData}`
      ).value = `${porcentajeAsistencias}%`;
      worksheet.getCell(
        `${numberToExcelColumn(col2Inicio)}${filaData}`
      ).value = `${porcentajeTardanzas}%`;
      worksheet.getCell(
        `${numberToExcelColumn(col3Inicio)}${filaData}`
      ).value = `${porcentajeFaltas}%`;

      worksheet.getRow(filaData).height = 20;
      filaData++;

      // Generation information
      const rangoInfoGen = `A${filaData}:${numberToExcelColumn(
        totalColumnas
      )}${filaData}`;
      worksheet.mergeCells(rangoInfoGen);

      const estiloInfoGen = {
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
          top: { style: "thin" as const },
          left: { style: "medium" as const },
          bottom: { style: "medium" as const },
          right: { style: "medium" as const },
        },
      };

      aplicarBordesACeldasFusionadas(worksheet, rangoInfoGen, estiloInfoGen);
      worksheet.getCell(
        `A${filaData}`
      ).value = `Document automatically generated on ${new Date().toLocaleString(
        "en-US"
      )} | SIASIS System - I.E. 20935 Asunción 8`;

      // GENERATE AND SAVE FILE
      const nivel =
        datos.aula.Nivel === NivelEducativo.PRIMARIA
          ? "Primary"
          : "Secondary";
      const nombreFinal = `Attendances_${nivel}_${datos.aula.Grado}${
        datos.aula.Seccion
      }_${mesInfo?.label}_${new Date().getFullYear()}`;

      console.log("📊 Generating Excel file buffer...");
      const buffer = await workbook.xlsx.writeBuffer();
      console.log(`✅ Buffer generated: ${buffer.byteLength} bytes`);

      const tieneFileSystemAPI = "showSaveFilePicker" in window;

      if (tieneFileSystemAPI) {
        try {
          console.log("💾 Showing save dialog...");

          const fileHandle = await (window as any).showSaveFilePicker({
            suggestedName: `${nombreFinal}.xlsx`,
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

          console.log(
            "📁 User selected location, writing file..."
          );

          const writable = await fileHandle.createWritable();
          await writable.write(buffer);
          await writable.close();

          console.log("✅ File written successfully");
          setMensajeExportacion("✅ Excel file saved successfully");
        } catch (error: any) {
          console.error("❌ Error during export:", error);
          console.error("   Error name:", error.name);
          console.error("   Message:", error.message);

          if (error.name === "AbortError") {
            console.log("👤 User cancelled dialog");
            setMensajeExportacion("⚠️ Operation cancelled");
          } else if (error.name === "NotAllowedError") {
            console.log("🚫 Permission denied");
            setMensajeExportacion("❌ Permission denied to save file");
          } else {
            // Any other error: try traditional download
            console.log("🔄 Attempting traditional download as fallback...");
            downloadTraditional(buffer, nombreFinal);
          }
        }
      } else {
        console.log(
          "📥 Save API not available, using traditional download"
        );
        downloadTraditional(buffer, nombreFinal);
      }

      setTimeout(() => setMensajeExportacion(""), 4000);
    } catch (error) {
      console.error("❌ Critical error exporting to Excel:", error);
      setMensajeExportacion("❌ Error generating Excel file");
      setTimeout(() => setMensajeExportacion(""), 4000);
    } finally {
      setExportandoExcel(false);
    }
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

    setMensajeExportacion("✅ Excel file downloaded successfully");
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
              title="Export to Excel"
              className={`px-5 py-3 rounded-lg font-medium text-sm transition-all duration-200 flex items-center justify-center space-x-2.5 min-w-[140px] shadow-sm hover:shadow-md ${
                exportandoExcel
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-300"
                  : "bg-white border border-gray-300 hover:border-green-400 hover:bg-green-50 text-gray-700 hover:text-green-700"
              }`}
            >
              {exportandoExcel ? (
                <>
                  <img
                    className="w-6 flex-shrink-0 animate-bounce"
                    src="/images/svg/Aplicaciones Relacionadas/ExcelLogo.svg"
                    alt="Excel Logo"
                  />
                  <span className="truncate">Generating...</span>
                </>
              ) : (
                <>
                  <img
                    className="w-6 flex-shrink-0"
                    src="/images/svg/Aplicaciones Relacionadas/ExcelLogo.svg"
                    alt="Excel Logo"
                  />
                  <span className="truncate">Export</span>
                </>
              )}
            </button>

            <div className="text-sm text-gray-600">
              {datos.estudiantes.length} students • Updated:{" "}
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
                Last Names and Names
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
                A
              </th>
              <th className="md:sticky md:right-[60px] sticky top-10 bg-gray-50 px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200 md:z-30 z-20 h-12">
                L
              </th>
              <th className="md:sticky md:right-0 sticky top-10 bg-gray-50 px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-l border-b border-gray-200 md:z-30 z-20 h-12">
                P
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
              P
            </div>
            <span>Present</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-orange-500 rounded flex items-center justify-center text-white text-xs font-medium">
              L
            </div>
            <span>Late</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-700 rounded flex items-center justify-center text-white text-xs font-medium">
              A
            </div>
            <span>Absent</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-purple-600 rounded flex items-center justify-center text-white text-xs font-medium">
              E
            </div>
            <span>Event</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-400 rounded flex items-center justify-center text-white text-xs font-medium">
              -
            </div>
            <span>No data</span>
          </div>
          {mostrarIndicadorDiaActual && (
            <div className="flex items-center gap-2 ml-4">
              <div className="text-blue-600 text-lg leading-none">▼</div>
              <span>Current day</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TablaAsistenciasEscolares;