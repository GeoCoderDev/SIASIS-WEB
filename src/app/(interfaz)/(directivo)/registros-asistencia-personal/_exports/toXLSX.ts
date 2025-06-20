import * as ExcelJS from "exceljs";
import { EstadosAsistenciaPersonal } from "@/interfaces/shared/EstadosAsistenciaPersonal";
import { mesesTextos, Meses } from "@/interfaces/shared/Meses";
import { GenericUser } from "@/interfaces/shared/GenericUser";

// Interfaces para los datos
interface RegistroDia {
  fecha: string;
  entradaProgramada: string;
  entradaReal: string;
  diferenciaEntrada: string;
  estadoEntrada: EstadosAsistenciaPersonal;
  salidaProgramada: string;
  salidaReal: string;
  diferenciaSalida: string;
  estadoSalida: EstadosAsistenciaPersonal;
  esEvento: boolean;
  nombreEvento?: string;
  esDiaNoEscolar?: boolean;
}

interface DatosExportacion {
  registros: RegistroDia[];
  usuarioSeleccionado: GenericUser;
  mes: number;
  rolSeleccionado: string;
  nombreArchivo?: string;
}

// Mapeo de estados a colores (equivalente a los estilos CSS)
const COLORES_ESTADOS = {
  [EstadosAsistenciaPersonal.En_Tiempo]: {
    background: "D4F7D4", // verde claro
    font: "047857", // verde oscuro
    nombre: "En tiempo",
  },
  [EstadosAsistenciaPersonal.Temprano]: {
    background: "BFDBFE", // azul claro
    font: "1E40AF", // azul oscuro
    nombre: "Temprano",
  },
  [EstadosAsistenciaPersonal.Tarde]: {
    background: "FED7BA", // naranja claro
    font: "C2410C", // naranja oscuro
    nombre: "Tarde",
  },
  [EstadosAsistenciaPersonal.Cumplido]: {
    background: "D4F7D4", // verde claro
    font: "047857", // verde oscuro
    nombre: "Cumplido",
  },
  [EstadosAsistenciaPersonal.Salida_Anticipada]: {
    background: "FEF3C7", // amarillo claro
    font: "A16207", // amarillo oscuro
    nombre: "Salida anticipada",
  },
  [EstadosAsistenciaPersonal.Falta]: {
    background: "FECACA", // rojo claro
    font: "DC2626", // rojo oscuro
    nombre: "Falta",
  },
  [EstadosAsistenciaPersonal.No_Registrado]: {
    background: "F3F4F6", // gris claro
    font: "6B7280", // gris oscuro
    nombre: "No registrado",
  },
  [EstadosAsistenciaPersonal.Sin_Registro]: {
    background: "F3F4F6", // gris claro
    font: "6B7280", // gris oscuro
    nombre: "Sin registro",
  },
  [EstadosAsistenciaPersonal.Inactivo]: {
    background: "E5E7EB", // gris medio
    font: "4B5563", // gris oscuro
    nombre: "Inactivo",
  },
  [EstadosAsistenciaPersonal.Evento]: {
    background: "DDD6FE", // violeta claro
    font: "7C3AED", // violeta oscuro
    nombre: "Evento",
  },
  [EstadosAsistenciaPersonal.Otro]: {
    background: "F3F4F6", // gris claro
    font: "6B7280", // gris oscuro
    nombre: "Otro",
  },
};

// Función para formatear fecha para mostrar
const formatearFechaParaExcel = (fecha: string): string => {
  const fechaObj = new Date(fecha + "T00:00:00");
  return fechaObj.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
};

// Función principal de exportación
export const exportarAsistenciaPersonalAExcel = async (
  datos: DatosExportacion
): Promise<void> => {
  const {
    registros,
    usuarioSeleccionado,
    mes,
    rolSeleccionado,
    nombreArchivo,
  } = datos;

  // Crear el workbook
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Registros de Asistencia", {
    pageSetup: {
      paperSize: 9, // A4
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  // Configurar columnas con anchos apropiados
  worksheet.columns = [
    { key: "fecha", width: 15 },
    { key: "entradaProgramada", width: 16 },
    { key: "entradaReal", width: 16 },
    { key: "diferenciaEntrada", width: 15 },
    { key: "estadoEntrada", width: 18 },
    { key: "salidaProgramada", width: 16 },
    { key: "salidaReal", width: 16 },
    { key: "diferenciaSalida", width: 15 },
    { key: "estadoSalida", width: 18 },
  ];

  // === SECCIÓN DE ENCABEZADO INSTITUCIONAL ===

  // Título principal
  worksheet.mergeCells("A1:I1");
  const tituloCell = worksheet.getCell("A1");
  tituloCell.value = "I.E. 20935 ASUNCIÓN 8 - IMPERIAL, CAÑETE";
  tituloCell.style = {
    font: { size: 16, bold: true, color: { argb: "FFFFFF" } },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "1E40AF" } },
    alignment: { horizontal: "center", vertical: "middle" },
    border: {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    },
  };
  worksheet.getRow(1).height = 25;

  // Subtítulo
  worksheet.mergeCells("A2:I2");
  const subtituloCell = worksheet.getCell("A2");
  subtituloCell.value = "REGISTRO MENSUAL DE ASISTENCIA DEL PERSONAL";
  subtituloCell.style = {
    font: { size: 14, bold: true, color: { argb: "FFFFFF" } },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "3B82F6" } },
    alignment: { horizontal: "center", vertical: "middle" },
    border: {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    },
  };
  worksheet.getRow(2).height = 20;

  // === SECCIÓN DE INFORMACIÓN DEL USUARIO ===

  // Espacio
  worksheet.getRow(3).height = 10;

  // Información del usuario
  const infoUsuario = [
    {
      label: "NOMBRE COMPLETO:",
      valor: `${usuarioSeleccionado.Nombres} ${usuarioSeleccionado.Apellidos}`,
    },
    { label: "DNI:", valor: usuarioSeleccionado.ID_O_DNI_Usuario },
    { label: "ROL:", valor: rolSeleccionado },
    { label: "MES:", valor: mesesTextos[mes as Meses] },
    { label: "TOTAL REGISTROS:", valor: registros.length.toString() },
    {
      label: "FECHA GENERACIÓN:",
      valor: new Date().toLocaleDateString("es-ES", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    },
  ];

  let filaActual = 4;
  infoUsuario.forEach((info, index) => {
    if (index % 2 === 0) {
      // Columna izquierda (A-D)
      worksheet.mergeCells(`A${filaActual}:B${filaActual}`);
      const labelCell = worksheet.getCell(`A${filaActual}`);
      labelCell.value = info.label;
      labelCell.style = {
        font: { bold: true, size: 10 },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "F3F4F6" },
        },
        alignment: { horizontal: "left", vertical: "middle" },
        border: {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        },
      };

      worksheet.mergeCells(`C${filaActual}:D${filaActual}`);
      const valorCell = worksheet.getCell(`C${filaActual}`);
      valorCell.value = info.valor;
      valorCell.style = {
        font: { size: 10 },
        alignment: { horizontal: "left", vertical: "middle" },
        border: {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        },
      };
    } else {
      // Columna derecha (E-I)
      worksheet.mergeCells(`E${filaActual}:F${filaActual}`);
      const labelCell = worksheet.getCell(`E${filaActual}`);
      labelCell.value = info.label;
      labelCell.style = {
        font: { bold: true, size: 10 },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "F3F4F6" },
        },
        alignment: { horizontal: "left", vertical: "middle" },
        border: {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        },
      };

      worksheet.mergeCells(`G${filaActual}:I${filaActual}`);
      const valorCell = worksheet.getCell(`G${filaActual}`);
      valorCell.value = info.valor;
      valorCell.style = {
        font: { size: 10 },
        alignment: { horizontal: "left", vertical: "middle" },
        border: {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        },
      };

      filaActual++;
    }
  });

  // Si el número de elementos es impar, completar la última fila
  if (infoUsuario.length % 2 !== 0) {
    filaActual++;
  }

  // Espacio antes de la tabla
  filaActual += 2;

  // === SECCIÓN DE ENCABEZADOS DE LA TABLA ===

  const encabezados = [
    "FECHA",
    "ENTRADA\nPROGRAMADA",
    "ENTRADA\nREAL",
    "DIFERENCIA\nENTRADA",
    "ESTADO\nENTRADA",
    "SALIDA\nPROGRAMADA",
    "SALIDA\nREAL",
    "DIFERENCIA\nSALIDA",
    "ESTADO\nSALIDA",
  ];

  const filaEncabezados = filaActual;
  encabezados.forEach((encabezado, index) => {
    const cell = worksheet.getCell(filaEncabezados, index + 1);
    cell.value = encabezado;
    cell.style = {
      font: { bold: true, size: 10, color: { argb: "FFFFFF" } },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "374151" } }, // gris-oscuro
      alignment: { horizontal: "center", vertical: "middle", wrapText: true },
      border: {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      },
    };
  });

  worksheet.getRow(filaEncabezados).height = 35;

  // === SECCIÓN DE DATOS ===

  let filaData = filaEncabezados + 1;

  registros.forEach((registro, index) => {
    const fila = worksheet.getRow(filaData);

    // Determinar color de fondo de la fila
    let colorFondo = "FFFFFF"; // blanco por defecto
    if (index % 2 === 1) {
      colorFondo = "F9FAFB"; // gris muy claro para filas alternas
    }
    if (registro.esDiaNoEscolar && !registro.esEvento) {
      colorFondo = "EBF8FF"; // azul claro para fines de semana
    }

    // Fecha
    let textoFecha = formatearFechaParaExcel(registro.fecha);
    if (registro.esEvento) {
      textoFecha += `\n🎉 ${registro.nombreEvento}`;
    } else if (registro.esDiaNoEscolar) {
      textoFecha += "\n📅 Fin de semana";
    }

    const fechaCell = fila.getCell(1);
    fechaCell.value = textoFecha;
    fechaCell.style = {
      font: { size: 9 },
      fill: {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: colorFondo },
      },
      alignment: { horizontal: "center", vertical: "middle", wrapText: true },
      border: {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      },
    };

    // Entrada Programada
    const entradaProgCell = fila.getCell(2);
    entradaProgCell.value = registro.entradaProgramada;
    entradaProgCell.style = {
      font: { size: 9 },
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

    // Entrada Real
    const entradaRealCell = fila.getCell(3);
    entradaRealCell.value = registro.entradaReal;
    entradaRealCell.style = {
      font: { size: 9 },
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

    // Diferencia Entrada
    const difEntradaCell = fila.getCell(4);
    difEntradaCell.value = registro.diferenciaEntrada;
    difEntradaCell.style = {
      font: { size: 9 },
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

    // Estado Entrada (con color específico)
    const estadoEntradaCell = fila.getCell(5);
    const colorEstadoEntrada = COLORES_ESTADOS[registro.estadoEntrada];
    estadoEntradaCell.value = colorEstadoEntrada.nombre;
    estadoEntradaCell.style = {
      font: { size: 9, bold: true, color: { argb: colorEstadoEntrada.font } },
      fill: {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: colorEstadoEntrada.background },
      },
      alignment: { horizontal: "center", vertical: "middle" },
      border: {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      },
    };

    // Salida Programada
    const salidaProgCell = fila.getCell(6);
    salidaProgCell.value = registro.salidaProgramada;
    salidaProgCell.style = {
      font: { size: 9 },
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

    // Salida Real
    const salidaRealCell = fila.getCell(7);
    salidaRealCell.value = registro.salidaReal;
    salidaRealCell.style = {
      font: { size: 9 },
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

    // Diferencia Salida
    const difSalidaCell = fila.getCell(8);
    difSalidaCell.value = registro.diferenciaSalida;
    difSalidaCell.style = {
      font: { size: 9 },
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

    // Estado Salida (con color específico)
    const estadoSalidaCell = fila.getCell(9);
    const colorEstadoSalida = COLORES_ESTADOS[registro.estadoSalida];
    estadoSalidaCell.value = colorEstadoSalida.nombre;
    estadoSalidaCell.style = {
      font: { size: 9, bold: true, color: { argb: colorEstadoSalida.font } },
      fill: {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: colorEstadoSalida.background },
      },
      alignment: { horizontal: "center", vertical: "middle" },
      border: {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      },
    };

    fila.height = 25;
    filaData++;
  });

  // === SECCIÓN DE PIE DE PÁGINA ===

  filaData += 2;

  // Resumen estadístico
  const totalAsistencias = registros.filter(
    (r) =>
      r.estadoEntrada === EstadosAsistenciaPersonal.En_Tiempo ||
      r.estadoEntrada === EstadosAsistenciaPersonal.Temprano
  ).length;

  const totalTardanzas = registros.filter(
    (r) => r.estadoEntrada === EstadosAsistenciaPersonal.Tarde
  ).length;

  const totalFaltas = registros.filter(
    (r) => r.estadoEntrada === EstadosAsistenciaPersonal.Falta
  ).length;

  const totalEventos = registros.filter((r) => r.esEvento).length;

  // Título del resumen
  worksheet.mergeCells(`A${filaData}:I${filaData}`);
  const resumenTituloCell = worksheet.getCell(`A${filaData}`);
  resumenTituloCell.value = "RESUMEN ESTADÍSTICO";
  resumenTituloCell.style = {
    font: { size: 12, bold: true, color: { argb: "FFFFFF" } },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "059669" } },
    alignment: { horizontal: "center", vertical: "middle" },
    border: {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    },
  };
  worksheet.getRow(filaData).height = 20;
  filaData++;

  // Datos del resumen
  const datosResumen = [
    {
      concepto: "Total Asistencias:",
      valor: totalAsistencias,
      color: "D4F7D4",
    },
    { concepto: "Total Tardanzas:", valor: totalTardanzas, color: "FED7BA" },
    { concepto: "Total Faltas:", valor: totalFaltas, color: "FECACA" },
    { concepto: "Días de Evento:", valor: totalEventos, color: "DDD6FE" },
  ];

  datosResumen.forEach((dato) => {
    worksheet.mergeCells(`A${filaData}:F${filaData}`);
    const conceptoCell = worksheet.getCell(`A${filaData}`);
    conceptoCell.value = dato.concepto;
    conceptoCell.style = {
      font: { bold: true, size: 10 },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "F3F4F6" } },
      alignment: { horizontal: "left", vertical: "middle" },
      border: {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      },
    };

    worksheet.mergeCells(`G${filaData}:I${filaData}`);
    const valorCell = worksheet.getCell(`G${filaData}`);
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

    filaData++;
  });

  // Información de generación
  filaData += 2;
  worksheet.mergeCells(`A${filaData}:I${filaData}`);
  const infoGenCell = worksheet.getCell(`A${filaData}`);
  infoGenCell.value = `Documento generado automáticamente el ${new Date().toLocaleString(
    "es-ES"
  )} | Sistema SIASIS - I.E. 20935 Asunción 8`;
  infoGenCell.style = {
    font: { size: 8, italic: true },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "F9FAFB" } },
    alignment: { horizontal: "center", vertical: "middle" },
    border: {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    },
  };

  // === GENERAR Y DESCARGAR ARCHIVO ===

  const nombreFinal =
    nombreArchivo ||
    `Asistencia_${usuarioSeleccionado.Nombres.replace(/\s+/g, "_")}_${
      mesesTextos[mes as Meses]
    }_${new Date().getFullYear()}`;

  // Generar buffer y descargar
  const buffer = await workbook.xlsx.writeBuffer();
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
};

// Función helper para integrar en el componente
export const manejarExportacionExcel = async (
  registros: RegistroDia[],
  usuarioSeleccionado: GenericUser,
  mes: number,
  rolSeleccionado: string
) => {
  try {
    await exportarAsistenciaPersonalAExcel({
      registros,
      usuarioSeleccionado,
      mes,
      rolSeleccionado,
    });

    // Aquí puedes mostrar un mensaje de éxito
    console.log("✅ Archivo Excel exportado exitosamente");
  } catch (error) {
    console.error("❌ Error al exportar a Excel:", error);
    // Aquí puedes mostrar un mensaje de error
  }
};
