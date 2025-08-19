import {
  NOMBRE_ARCHIVO_LISTA_ESTUDIANTES,
  NOMBRE_ARCHIVO_LISTA_ESTUDIANTES_PRIMARIA,
  NOMBRE_ARCHIVO_LISTA_ESTUDIANTES_SECUNDARIA,
} from "../../../constants/NOMBRE_ARCHIVOS_SISTEMA";

export interface ReporteActualizacionDeListasEstudiantes {
  EstadoDeListasDeEstudiantes: Record<NOMBRE_ARCHIVO_LISTA_ESTUDIANTES, Date>;
  Fecha_Actualizacion: Date;
}

export interface ReporteActualizacionDeListasEstudiantesPrimaria {
  EstadoDeListasDeEstudiantes: Record<
    NOMBRE_ARCHIVO_LISTA_ESTUDIANTES_PRIMARIA,
    Date
  >;
  Fecha_Actualizacion: Date;
}

export interface ReporteActualizacionDeListasEstudiantesSecundaria {
  EstadoDeListasDeEstudiantes: Record<
    NOMBRE_ARCHIVO_LISTA_ESTUDIANTES_SECUNDARIA,
    Date
  >;
  Fecha_Actualizacion: Date;
}
