import { DatosGraficoReporte } from "@/app/(interfaz)/(directivo)/reportes-asistencias-escolares/_components/GraficoReporteAsistenciaEscolar";
import {
  ReporteAsistenciaEscolarPorDias,
  ReporteAsistenciaEscolarPorMeses,
  TipoReporteAsistenciaEscolar,
} from "@/interfaces/shared/ReporteAsistenciaEscolar";

const NOMBRES_MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const NOMBRES_DIAS_SEMANA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/**
* Obtiene el nombre del día de la semana para una fecha específica
*/
function obtenerNombreDiaSemana(mes: number, dia: number): string {
  const año = new Date().getFullYear();
  const fecha = new Date(año, mes - 1, dia);
  return NOMBRES_DIAS_SEMANA[fecha.getDay()];
}

/**
* Transforma datos de reporte diario para el gráfico
*/
export function transformarReportePorDias(
  datos: ReporteAsistenciaEscolarPorDias
): DatosGraficoReporte[] {
  const resultado: DatosGraficoReporte[] = [];

  // // Estructura temporal para acumular datos por díanst datosPorDia: Record<
    string,
    { asistencias: number; tardanzas: number; faltas: number }
  > = {};

  // // Recorrer todas las aulas
  Object.values(datos).forEach((aula) => {
    // Recorrer los meses
    Objectntries(aula.ConteoEstadosAsistencia).forEach(([mes, diasMes]) => {
      // // Recorrer los días
      Objectntries(diasMes).forEach(([dia, conteos]) => {
        const mesNum = parseInt(mes);
        const diaNum = parseInt(dia);

        // // Crear clavenica para el día
        const nombreDia = obtenerNombreDiaSemana(mesNum, diaNum);
        const claveDia = `${mesNum}-${diaNum}`;
        const etiquetaDia = `${nombreDia} ${diaNum}`;

        // //nicializar si no existe
        if (!datosPorDia[claveDia]) {
          datosPorDia[claveDia] = {
            asistencias: 0,
            tardanzas: 0,
            faltas: 0,
          };
        }

        // // Acumularnteos
        datosPorDia[claveDia].asistencias += conteos.A || 0;
        datosPorDia[claveDia].tardanzas += conteos.T || 0;
        datosPorDia[claveDia].faltas += conteos.F || 0;
      });
    });
  });

  // //nvertir a array y ordenar por fecha
  const diasOrdenados = Object.keys(datosPorDia).sort((a, b) => {
    const [mesA, diaA] = a.split("-").map(Number);
    const [mesB, diaB] = b.split("-").map(Number);

    if (mesA !== mesB) return mesA - mesB;
    return diaA - diaB;
  });

  // // Crear resultadonal
  diasOrdenados.forEach((claveDia) => {
    const [mes, dia] = claveDia.split("-").map(Number);
    const nombreDia = obtenerNombreDiaSemana(mes, dia);

    resultado.push({
      nombre: `${nombreDia} ${dia}`,
      asistencias: datosPorDia[claveDia].asistencias,
      tardanzas: datosPorDia[claveDia].tardanzas,
      faltas: datosPorDia[claveDia].faltas,
    });
  });

  return resultado;
}

/**
* Transforma datos de reporte mensual para el gráfico
*/
export function transformarReportePorMeses(
  datos: ReporteAsistenciaEscolarPorMeses
): DatosGraficoReporte[] {
  const resultado: DatosGraficoReporte[] = [];

  // // Estructura temporal para acumular datos por mesnst datosPorMes: Record<
    number,
    { asistencias: number; tardanzas: number; faltas: number }
  > = {};

  // // Recorrer todas las aulas
  Object.values(datos).forEach((aula) => {
    // Recorrer los meses
    Objectntries(aula.ConteoEstadosAsistencia).forEach(([mes, conteos]) => {
      const mesNum = parseInt(mes);

      // //nicializar si no existe
      if (!datosPorMes[mesNum]) {
        datosPorMes[mesNum] = {
          asistencias: 0,
          tardanzas: 0,
          faltas: 0,
        };
      }

      // // Acumularnteos
      datosPorMes[mesNum].asistencias += conteos.A || 0;
      datosPorMes[mesNum].tardanzas += conteos.T || 0;
      datosPorMes[mesNum].faltas += conteos.F || 0;
    });
  });

  // //nvertir a array y ordenar por mes
  const mesesOrdenados = Object.keys(datosPorMes)
    .map(Number)
    .sort((a, b) => a - b);

  // // Crear resultadonal
  mesesOrdenados.forEach((mes) => {
    resultado.push({
      nombre: NOMBRES_MESES[mes - 1],
      asistencias: datosPorMes[mes].asistencias,
      tardanzas: datosPorMes[mes].tardanzas,
      faltas: datosPorMes[mes].faltas,
    });
  });

  return resultado;
}

/**
* Función principal que determina qué transformador usar
*/
export function transformarDatosReporteAsistenciaEscolarParaGrafico(
  datos: ReporteAsistenciaEscolarPorDias | ReporteAsistenciaEscolarPorMeses,
  tipoReporte: TipoReporteAsistenciaEscolar
): DatosGraficoReporte[] {
  if (tipoReporte === TipoReporteAsistenciaEscolar.POR_DIA) {
    return transformarReportePorDias(datos as ReporteAsistenciaEscolarPorDias);
  } else {
    return transformarReportePorMeses(
      datos as ReporteAsistenciaEscolarPorMeses
    );
  }
}
