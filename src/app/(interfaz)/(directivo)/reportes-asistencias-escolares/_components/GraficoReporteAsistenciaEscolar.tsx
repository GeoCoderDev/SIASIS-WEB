"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { TipoReporteAsistenciaEscolar } from "@/interfaces/shared/ReporteAsistenciaEscolar";

export interface DatosGraficoReporte {
  nombre: string; // "Lun 15" o "Marzo"
  asistencias: number;
  tardanzas: number;
  faltas: number;
}

interface GraficoReporteAsistenciaProps {
  datos: DatosGraficoReporte[];
  tipoReporte: TipoReporteAsistenciaEscolar;
}

const GraficoReporteAsistencia = ({
  datos,
  tipoReporte,
}: GraficoReporteAsistenciaProps) => {
  if (!datos || datos.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gris-intermedio">No hay datos para mostrar</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <h3 className="text-lg font-bold text-azul-principal mb-4 text-center">
        Reporte de Asistencia -{" "}
        {tipoReporte === TipoReporteAsistenciaEscolar.POR_DIA
          ? "Por Días"
          : "Por Meses"}
      </h3>

      <ResponsiveContainer width="100%" height="90%">
        <BarChart
          data={datos}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 60,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis
            dataKey="nombre"
            angle={-45}
            textAnchor="end"
            height={80}
            tick={{ fill: "#333", fontSize: 12 }}
          />
          <YAxis tick={{ fill: "#333", fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#fff",
              border: "1px solid #ccc",
              borderRadius: "8px",
            }}
            labelStyle={{ fontWeight: "bold", color: "#333" }}
          />
          <Legend
            wrapperStyle={{
              paddingTop: "20px",
            }}
            iconType="circle"
          />
          <Bar
            dataKey="asistencias"
            name="Asistencias"
            fill="#22c55e"
            radius={[8, 8, 0, 0]}
          />
          <Bar
            dataKey="tardanzas"
            name="Tardanzas"
            fill="#eab308"
            radius={[8, 8, 0, 0]}
          />
          <Bar
            dataKey="faltas"
            name="Faltas"
            fill="#ef4444"
            radius={[8, 8, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default GraficoReporteAsistencia;