import React, { useState } from "react";
import { EstadosAsistenciaEscolar } from "@/interfaces/shared/EstadosAsistenciaEstudiantes";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";
import * as ExcelJS from "exceljs";
import { DatosTablaAsistencias } from "@/app/(interfaz)/(directivo)/registros-asistencias-escolares/page";
import { EstadosAsistenciaEscolarParaExcel } from "@/Assets/asistencia/EstadosEscolaresParaExcel";
import { COLORES_ESTADOS_ASISTENCIA_ESCOLAR } from "@/app/(interfaz)/(responsable)/mis-estudiantes-relacionados/[Id_Estudiante]/asistencias-mensuales/types";

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

  // Función auxiliar para aplicar bordes a TODAS las celdas de un rango fusionado
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

      // PASO 1: CALCULAR ESTRUCTURA DEL CALENDARIO (Lunes a Viernes)
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
        const diasSemanaTextos = ["", "L", "M", "M", "J", "V"];

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

      // PASO 2: CALCULAR TOTAL DE COLUMNAS
      // 1 (nombres) + días calendario + 3 (F, T, A)
      const totalColumnas = 1 + estructuraCalendario.length + 3;

      // PASO 3: ENCABEZADO INSTITUCIONAL
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
      worksheet.getCell("A2").value = "REGISTRO MENSUAL DE ASISTENCIA ESCOLAR";
      worksheet.getRow(2).height = 20;

      // PASO 4: INFORMACIÓN DEL AULA (distribuir en 50%-50%)
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

      // Fila 1: NIVEL | GRADO Y SECCIÓN
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
      ).value = "NIVEL:";

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
          ? "Primaria"
          : "Secundaria";

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
      ).value = "GRADO Y SECCIÓN:";

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

      // Fila 2: MES | TOTAL ESTUDIANTES
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
      ).value = "MES:";

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
      ).value = "TOTAL ESTUDIANTES:";

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

      // Fila de separación entre información y tabla
      worksheet.getRow(filaActual).height = 8;
      filaActual++;

      // PASO 5: TABLA DE ASISTENCIAS
      const filaEncabezados = filaActual;

      worksheet.getColumn(1).width = 30;

      // Nombre (fusionar 2 filas verticalmente)
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
      worksheet.getCell(`A${filaEncabezados}`).value = "APELLIDOS Y NOMBRES";

      // Días del mes (2 filas: letra día y número)
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

      // Totales (F, T, A) - fusionar verticalmente
      const colTotales = estructuraCalendario.length + 2;
      ["F", "T", "A"].forEach((label, index) => {
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

      // PASO 6: DATOS DE ESTUDIANTES
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

      // Fila de separación antes del resumen
      worksheet.getRow(filaData).height = 8;
      filaData++;

      // PASO 7: RESUMEN ESTADÍSTICO
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

      // Calcular porcentajes
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

      // TÍTULO DEL RESUMEN
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
      worksheet.getCell(`A${filaData}`).value = "RESUMEN ESTADÍSTICO";
      worksheet.getRow(filaData).height = 20;
      filaData++;

      // DISTRIBUCIÓN EN 3 COLUMNAS

      // Fila 1: Etiquetas
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
        "ASISTENCIAS";
      worksheet.getCell(`${numberToExcelColumn(col2Inicio)}${filaData}`).value =
        "TARDANZAS";
      worksheet.getCell(`${numberToExcelColumn(col3Inicio)}${filaData}`).value =
        "FALTAS";

      worksheet.getRow(filaData).height = 18;
      filaData++;

      // Fila 2: Totales
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

      // Fila 3: Porcentajes
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

      // Información de generación
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
      ).value = `Documento generado automáticamente el ${new Date().toLocaleString(
        "es-ES"
      )} | Sistema SIASIS - I.E. 20935 Asunción 8`;

      // GENERAR Y GUARDAR ARCHIVO
      const nivel =
        datos.aula.Nivel === NivelEducativo.PRIMARIA
          ? "Primaria"
          : "Secundaria";
      const nombreFinal = `Asistencias_${nivel}_${datos.aula.Grado}${
        datos.aula.Seccion
      }_${mesInfo?.label}_${new Date().getFullYear()}`;

      console.log("📊 Generando buffer del archivo Excel...");
      const buffer = await workbook.xlsx.writeBuffer();
      console.log(`✅ Buffer generado: ${buffer.byteLength} bytes`);

      const tieneFileSystemAPI = "showSaveFilePicker" in window;

      if (tieneFileSystemAPI) {
        try {
          console.log("💾 Mostrando diálogo de guardado...");

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

          console.log(
            "📁 Usuario seleccionó ubicación, escribiendo archivo..."
          );

          const writable = await fileHandle.createWritable();
          await writable.write(buffer);
          await writable.close();

          console.log("✅ Archivo escrito exitosamente");
          setMensajeExportacion("✅ Archivo Excel guardado exitosamente");
        } catch (error: any) {
          console.error("❌ Error durante la exportación:", error);
          console.error("   Nombre del error:", error.name);
          console.error("   Mensaje:", error.message);

          if (error.name === "AbortError") {
            console.log("👤 Usuario canceló el diálogo");
            setMensajeExportacion("⚠️ Operación cancelada");
          } else if (error.name === "NotAllowedError") {
            console.log("🚫 Permiso denegado");
            setMensajeExportacion("❌ Permiso denegado para guardar archivo");
          } else {
            // Cualquier otro error: intentar descarga tradicional
            console.log("🔄 Intentando descarga tradicional como fallback...");
            downloadTraditional(buffer, nombreFinal);
          }
        }
      } else {
        console.log(
          "📥 API de guardado no disponible, usando descarga tradicional"
        );
        downloadTraditional(buffer, nombreFinal);
      }

      setTimeout(() => setMensajeExportacion(""), 4000);
    } catch (error) {
      console.error("❌ Error crítico al exportar a Excel:", error);
      setMensajeExportacion("❌ Error al generar el archivo Excel");
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
              title="Exportar a Excel"
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
                    alt="Logo de Excel"
                  />
                  <span className="truncate">Generando...</span>
                </>
              ) : (
                <>
                  <img
                    className="w-6 flex-shrink-0"
                    src="/images/svg/Aplicaciones Relacionadas/ExcelLogo.svg"
                    alt="Logo de Excel"
                  />
                  <span className="truncate">Exportar</span>
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
