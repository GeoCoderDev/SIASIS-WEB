/**
 * Enum containing the names of tables in the remote database.
 * Allows to intuitively reference server tables in the code.
 */
export enum TablasRemoto {
  // Users and roles
  Tabla_Directivos = "T_Directivos",
  Tabla_Auxiliares = "T_Auxiliares",
  Tabla_Profesores_Primaria = "T_Profesores_Primaria",
  Tabla_Profesores_Secundaria = "T_Profesores_Secundaria",
  Tabla_Personal_Administrativo = "T_Personal_Administrativo",
  Tabla_Responsables = "T_Responsables",

  // Students and attendance
  Tabla_Estudiantes = "T_Estudiantes",
  Tabla_Relaciones_E_R = "T_Relaciones_E_R",

  // Primary attendance tables
  Tabla_Asistencia_Primaria_1 = "T_A_E_P_1",
  Tabla_Asistencia_Primaria_2 = "T_A_E_P_2",
  Tabla_Asistencia_Primaria_3 = "T_A_E_P_3",
  Tabla_Asistencia_Primaria_4 = "T_A_E_P_4",
  Tabla_Asistencia_Primaria_5 = "T_A_E_P_5",
  Tabla_Asistencia_Primaria_6 = "T_A_E_P_6",

  // Secondary attendance tables
  Tabla_Asistencia_Secundaria_1 = "T_A_E_S_1",
  Tabla_Asistencia_Secundaria_2 = "T_A_E_S_2",
  Tabla_Asistencia_Secundaria_3 = "T_A_E_S_3",
  Tabla_Asistencia_Secundaria_4 = "T_A_E_S_4",
  Tabla_Asistencia_Secundaria_5 = "T_A_E_S_5",

  // School structure
  Tabla_Aulas = "T_Aulas",
  Tabla_Cursos_Horario = "T_Cursos_Horario",
  Tabla_Eventos = "T_Eventos",
  Tabla_Comunicados = "T_Comunicados",

  // Staff attendance control
  Tabla_Control_Entrada_Profesores_Primaria = "T_Control_Entrada_Mensual_Profesores_Primaria",
  Tabla_Control_Salida_Profesores_Primaria = "T_Control_Salida_Mensual_Profesores_Primaria",
  Tabla_Control_Entrada_Profesores_Secundaria = "T_Control_Entrada_Mensual_Profesores_Secundaria",
  Tabla_Control_Salida_Profesores_Secundaria = "T_Control_Salida_Mensual_Profesores_Secundaria",
  Tabla_Control_Entrada_Auxiliar = "T_Control_Entrada_Mensual_Auxiliar",
  Tabla_Control_Salida_Auxiliar = "T_Control_Salida_Mensual_Auxiliar",
  Tabla_Control_Entrada_Personal_Administrativo = "T_Control_Entrada_Mensual_Personal_Administrativo",
  Tabla_Control_Salida_Personal_Administrativo = "T_Control_Salida_Mensual_Personal_Administrativo",

  // Configuration and system
  Tabla_Fechas_Importantes = "T_Fechas_Importantes",
  Tabla_Horarios_Asistencia = "T_Horarios_Asistencia",
  Tabla_Ajustes_Sistema = "T_Ajustes_Generales_Sistema",
  Tabla_Bloqueo_Roles = "T_Bloqueo_Roles",
  Tabla_Registro_Fallos = "T_Registro_Fallos_Sistema",
  Tabla_Codigos_OTP = "T_Codigos_OTP",

  // Change control
  Tabla_Ultima_Modificacion = "T_Ultima_Modificacion_Tablas",
}

/**
 * Enum containing the names of tables in the local database (IndexedDB).
 * Allows to intuitively reference local tables in the code.
 */
export enum TablasLocal {
  // Users and roles
  // Note: Directors only exist remotely, no local equivalent
  Tabla_Auxiliares = "auxiliares",
  Tabla_Profesores_Primaria = "profesores_primaria",
  Tabla_Profesores_Secundaria = "profesores_secundaria",
  Tabla_Personal_Administrativo = "personal_administrativo",
  Tabla_Responsables = "responsables",

  // Students and attendance
  Tabla_Estudiantes = "estudiantes",
  Tabla_Relaciones_E_R = "relaciones_e_r",

  // Primary attendance tables
  Tabla_Asistencia_Primaria_1 = "asistencias_e_p_1",
  Tabla_Asistencia_Primaria_2 = "asistencias_e_p_2",
  Tabla_Asistencia_Primaria_3 = "asistencias_e_p_3",
  Tabla_Asistencia_Primaria_4 = "asistencias_e_p_4",
  Tabla_Asistencia_Primaria_5 = "asistencias_e_p_5",
  Tabla_Asistencia_Primaria_6 = "asistencias_e_p_6",

  // Secondary attendance tables
  Tabla_Asistencia_Secundaria_1 = "asistencias_e_s_1",
  Tabla_Asistencia_Secundaria_2 = "asistencias_e_s_2",
  Tabla_Asistencia_Secundaria_3 = "asistencias_e_s_3",
  Tabla_Asistencia_Secundaria_4 = "asistencias_e_s_4",
  Tabla_Asistencia_Secundaria_5 = "asistencias_e_s_5",

  // School structure
  Tabla_Aulas = "aulas",
  Tabla_Cursos_Horario = "cursos_horario",
  Tabla_Eventos = "eventos",
  Tabla_Comunicados = "comunicados",
  Tabla_Vacaciones_Interescolares = "vacaciones_interescolares",

  // Staff attendance control
  Tabla_Control_Entrada_directivos = "control_entrada_directivos",
  Tabla_Control_Salida_directivos = "control_salida_directivos",
  Tabla_Control_Entrada_Profesores_Primaria = "control_entrada_profesores_primaria",
  Tabla_Control_Salida_Profesores_Primaria = "control_salida_profesores_primaria",
  Tabla_Control_Entrada_Profesores_Secundaria = "control_entrada_profesores_secundaria",
  Tabla_Control_Salida_Profesores_Secundaria = "control_salida_profesores_secundaria",
  Tabla_Control_Entrada_Auxiliar = "control_entrada_auxiliar",
  Tabla_Control_Salida_Auxiliar = "control_salida_auxiliar",
  Tabla_Control_Entrada_Personal_Administrativo = "control_entrada_personal_administrativo",
  Tabla_Control_Salida_Personal_Administrativo = "control_salida_personal_administrativo",

  // Configuration and system
  Tabla_Fechas_Importantes = "fechas_importantes",
  Tabla_Horarios_Asistencia = "horarios_asistencia",
  Tabla_Ajustes_Sistema = "ajustes_generales_sistema",
  Tabla_Bloqueo_Roles = "bloqueo_roles",
  Tabla_Registro_Fallos = "registro_fallos_sistema",
  Tabla_Codigos_OTP = "codigos_otp", // May not actually exist locally

  // Change control
  Tabla_Ultima_Modificacion = "ultima_modificacion_tablas",
  Tabla_Ultima_Actualizacion = "ultima_actualizacion_tablas_locales",

  // IndexedDB exclusive tables
  Tabla_Datos_Usuario = "user_data",
  Tabla_Solicitudes_Offline = "offline_requests",
  Tabla_Metadatos_Sistema = "system_meta",

  // Table for today's attendances
  Tabla_Asistencias_Tomadas_Hoy = "asistencias_tomadas_hoy",
  Tabla_Usuarios_Genericos_Cache = "usuarios_genericos_cache",
  Tabla_Archivos_Asistencia_Hoy = "archivos_asistencia_hoy",

  // Persistence for Queues
  Tabla_Cola_Asistencias_Escolares = "cola_asistencias_escolares",
}

/**
 * Interface that defines the structure of a table's information
 */
export interface ITablaInfo {
  /** Name of the table in the remote database (PostgreSQL/MySQL) */
  nombreRemoto?: TablasRemoto;

  /** Name of the table in the local database (IndexedDB) */
  nombreLocal?: TablasLocal;

  /** Description of the table */
  descripcion: string;

  /** Indicates if the table is synchronizable between local and remote */
  sincronizable: boolean;
}

/**
 * Full mapping between remote and local system tables
 * Contains information of all tables including their name in the remote DB and in IndexedDB
 */
export const TablasSistema = {
  // Users and roles
  DIRECTIVOS: {
    nombreRemoto: TablasRemoto.Tabla_Directivos,
    // Does not have a local equivalent
    descripcion: "Directors and deputy directors of the institution",
    sincronizable: false,
  },
  AUXILIARES: {
    nombreRemoto: TablasRemoto.Tabla_Auxiliares,
    nombreLocal: TablasLocal.Tabla_Auxiliares,
    descripcion: "Assistant staff of the institution",
    sincronizable: true,
  },
  PROFESORES_PRIMARIA: {
    nombreRemoto: TablasRemoto.Tabla_Profesores_Primaria,
    nombreLocal: TablasLocal.Tabla_Profesores_Primaria,
    descripcion: "Primary level teachers",
    sincronizable: true,
  },
  PROFESORES_SECUNDARIA: {
    nombreRemoto: TablasRemoto.Tabla_Profesores_Secundaria,
    nombreLocal: TablasLocal.Tabla_Profesores_Secundaria,
    descripcion: "Secondary level teachers",
    sincronizable: true,
  },
  PERSONAL_ADMINISTRATIVO: {
    nombreRemoto: TablasRemoto.Tabla_Personal_Administrativo,
    nombreLocal: TablasLocal.Tabla_Personal_Administrativo,
    descripcion: "Administrative staff of the institution",
    sincronizable: true,
  },
  RESPONSABLES: {
    nombreRemoto: TablasRemoto.Tabla_Responsables,
    nombreLocal: TablasLocal.Tabla_Responsables,
    descripcion: "Parents or guardians",
    sincronizable: true,
  },

  // Students and relationships
  ESTUDIANTES: {
    nombreRemoto: TablasRemoto.Tabla_Estudiantes,
    nombreLocal: TablasLocal.Tabla_Estudiantes,
    descripcion: "Students of the institution",
    sincronizable: true,
  },
  RELACIONES_E_R: {
    nombreRemoto: TablasRemoto.Tabla_Relaciones_E_R,
    nombreLocal: TablasLocal.Tabla_Relaciones_E_R,
    descripcion: "Relationships between students and guardians",
    sincronizable: true,
  },

  // Primary attendance
  ASISTENCIA_P_1: {
    nombreRemoto: TablasRemoto.Tabla_Asistencia_Primaria_1,
    nombreLocal: TablasLocal.Tabla_Asistencia_Primaria_1,
    descripcion: "Attendance of 1st grade primary students",
    sincronizable: true,
  },
  ASISTENCIA_P_2: {
    nombreRemoto: TablasRemoto.Tabla_Asistencia_Primaria_2,
    nombreLocal: TablasLocal.Tabla_Asistencia_Primaria_2,
    descripcion: "Attendance of 2nd grade primary students",
    sincronizable: true,
  },
  ASISTENCIA_P_3: {
    nombreRemoto: TablasRemoto.Tabla_Asistencia_Primaria_3,
    nombreLocal: TablasLocal.Tabla_Asistencia_Primaria_3,
    descripcion: "Attendance of 3rd grade primary students",
    sincronizable: true,
  },
  ASISTENCIA_P_4: {
    nombreRemoto: TablasRemoto.Tabla_Asistencia_Primaria_4,
    nombreLocal: TablasLocal.Tabla_Asistencia_Primaria_4,
    descripcion: "Attendance of 4th grade primary students",
    sincronizable: true,
  },
  ASISTENCIA_P_5: {
    nombreRemoto: TablasRemoto.Tabla_Asistencia_Primaria_5,
    nombreLocal: TablasLocal.Tabla_Asistencia_Primaria_5,
    descripcion: "Attendance of 5th grade primary students",
    sincronizable: true,
  },
  ASISTENCIA_P_6: {
    nombreRemoto: TablasRemoto.Tabla_Asistencia_Primaria_6,
    nombreLocal: TablasLocal.Tabla_Asistencia_Primaria_6,
    descripcion: "Attendance of 6th grade primary students",
    sincronizable: true,
  },

  // Secondary attendance
  ASISTENCIA_S_1: {
    nombreRemoto: TablasRemoto.Tabla_Asistencia_Secundaria_1,
    nombreLocal: TablasLocal.Tabla_Asistencia_Secundaria_1,
    descripcion: "Attendance of 1st grade secondary students",
    sincronizable: true,
  },
  ASISTENCIA_S_2: {
    nombreRemoto: TablasRemoto.Tabla_Asistencia_Secundaria_2,
    nombreLocal: TablasLocal.Tabla_Asistencia_Secundaria_2,
    descripcion: "Attendance of 2nd grade secondary students",
    sincronizable: true,
  },
  ASISTENCIA_S_3: {
    nombreRemoto: TablasRemoto.Tabla_Asistencia_Secundaria_3,
    nombreLocal: TablasLocal.Tabla_Asistencia_Secundaria_3,
    descripcion: "Attendance of 3rd grade secondary students",
    sincronizable: true,
  },
  ASISTENCIA_S_4: {
    nombreRemoto: TablasRemoto.Tabla_Asistencia_Secundaria_4,
    nombreLocal: TablasLocal.Tabla_Asistencia_Secundaria_4,
    descripcion: "Attendance of 4th grade secondary students",
    sincronizable: true,
  },
  ASISTENCIA_S_5: {
    nombreRemoto: TablasRemoto.Tabla_Asistencia_Secundaria_5,
    nombreLocal: TablasLocal.Tabla_Asistencia_Secundaria_5,
    descripcion: "Attendance of 5th grade secondary students",
    sincronizable: true,
  },

  // School structure
  AULAS: {
    nombreRemoto: TablasRemoto.Tabla_Aulas,
    nombreLocal: TablasLocal.Tabla_Aulas,
    descripcion: "Classrooms or sections of the institution",
    sincronizable: true,
  },
  CURSOS_HORARIO: {
    nombreRemoto: TablasRemoto.Tabla_Cursos_Horario,
    nombreLocal: TablasLocal.Tabla_Cursos_Horario,
    descripcion: "Course schedules",
    sincronizable: true,
  },
  EVENTOS: {
    nombreRemoto: TablasRemoto.Tabla_Eventos,
    nombreLocal: TablasLocal.Tabla_Eventos,
    descripcion: "Events and celebrations of the school calendar",
    sincronizable: true,
  },
  COMUNICADOS: {
    nombreRemoto: TablasRemoto.Tabla_Comunicados,
    nombreLocal: TablasLocal.Tabla_Comunicados,
    descripcion: "Institutional communications",
    sincronizable: true,
  },

  // Staff attendance control
  CONTROL_ENTRADA_PROF_PRIMARIA: {
    nombreRemoto: TablasRemoto.Tabla_Control_Entrada_Profesores_Primaria,
    nombreLocal: TablasLocal.Tabla_Control_Entrada_Profesores_Primaria,
    descripcion: "Entry control for primary teachers",
    sincronizable: true,
  },
  CONTROL_SALIDA_PROF_PRIMARIA: {
    nombreRemoto: TablasRemoto.Tabla_Control_Salida_Profesores_Primaria,
    nombreLocal: TablasLocal.Tabla_Control_Salida_Profesores_Primaria,
    descripcion: "Exit control for primary teachers",
    sincronizable: true,
  },
  CONTROL_ENTRADA_PROF_SECUNDARIA: {
    nombreRemoto: TablasRemoto.Tabla_Control_Entrada_Profesores_Secundaria,
    nombreLocal: TablasLocal.Tabla_Control_Entrada_Profesores_Secundaria,
    descripcion: "Entry control for secondary teachers",
    sincronizable: true,
  },
  CONTROL_SALIDA_PROF_SECUNDARIA: {
    nombreRemoto: TablasRemoto.Tabla_Control_Salida_Profesores_Secundaria,
    nombreLocal: TablasLocal.Tabla_Control_Salida_Profesores_Secundaria,
    descripcion: "Exit control for secondary teachers",
    sincronizable: true,
  },
  CONTROL_ENTRADA_AUXILIAR: {
    nombreRemoto: TablasRemoto.Tabla_Control_Entrada_Auxiliar,
    nombreLocal: TablasLocal.Tabla_Control_Entrada_Auxiliar,
    descripcion: "Entry control for assistants",
    sincronizable: true,
  },
  CONTROL_SALIDA_AUXILIAR: {
    nombreRemoto: TablasRemoto.Tabla_Control_Salida_Auxiliar,
    nombreLocal: TablasLocal.Tabla_Control_Salida_Auxiliar,
    descripcion: "Exit control for assistants",
    sincronizable: true,
  },
  CONTROL_ENTRADA_ADMIN: {
    nombreRemoto: TablasRemoto.Tabla_Control_Entrada_Personal_Administrativo,
    nombreLocal: TablasLocal.Tabla_Control_Entrada_Personal_Administrativo,
    descripcion: "Entry control for administrative staff",
    sincronizable: true,
  },
  CONTROL_SALIDA_ADMIN: {
    nombreRemoto: TablasRemoto.Tabla_Control_Salida_Personal_Administrativo,
    nombreLocal: TablasLocal.Tabla_Control_Salida_Personal_Administrativo,
    descripcion: "Exit control for administrative staff",
    sincronizable: true,
  },

  // Configuration and system
  FECHAS_IMPORTANTES: {
    nombreRemoto: TablasRemoto.Tabla_Fechas_Importantes,
    nombreLocal: TablasLocal.Tabla_Fechas_Importantes,
    descripcion: "Important dates of the school year",
    sincronizable: true,
  },
  HORARIOS_ASISTENCIA: {
    nombreRemoto: TablasRemoto.Tabla_Horarios_Asistencia,
    nombreLocal: TablasLocal.Tabla_Horarios_Asistencia,
    descripcion: "Attendance schedule configuration",
    sincronizable: true,
  },
  AJUSTES_SISTEMA: {
    nombreRemoto: TablasRemoto.Tabla_Ajustes_Sistema,
    nombreLocal: TablasLocal.Tabla_Ajustes_Sistema,
    descripcion: "General system settings",
    sincronizable: true,
  },
  BLOQUEO_ROLES: {
    nombreRemoto: TablasRemoto.Tabla_Bloqueo_Roles,
    nombreLocal: TablasLocal.Tabla_Bloqueo_Roles,
    descripcion: "Temporary role blocking in the system",
    sincronizable: true,
  },
  REGISTRO_FALLOS: {
    nombreRemoto: TablasRemoto.Tabla_Registro_Fallos,
    nombreLocal: TablasLocal.Tabla_Registro_Fallos,
    descripcion: "System error and failure log",
    sincronizable: false, // Local errors are generally not synchronized
  },
  CODIGOS_OTP: {
    nombreRemoto: TablasRemoto.Tabla_Codigos_OTP,
    nombreLocal: TablasLocal.Tabla_Codigos_OTP,
    descripcion: "One-time verification codes",
    sincronizable: false, // OTPs are usually not synchronized for security
  },
  ULTIMA_MODIFICACION: {
    nombreRemoto: TablasRemoto.Tabla_Ultima_Modificacion,
    nombreLocal: TablasLocal.Tabla_Ultima_Modificacion,
    descripcion: "Record of last modifications of each table",
    sincronizable: true,
  },

  ULTIMA_ACTUALIZACION_LOCAL: {
    nombreLocal: TablasLocal.Tabla_Ultima_Actualizacion,
    descripcion: "Record of last local table update",
    sincronizable: false,
  },
  // IndexedDB exclusive tables
  DATOS_USUARIO: {
    nombreLocal: TablasLocal.Tabla_Datos_Usuario,
    descripcion: "Current user session data",
    sincronizable: false,
  },
  SOLICITUDES_OFFLINE: {
    nombreLocal: TablasLocal.Tabla_Solicitudes_Offline,
    descripcion: "Queue of pending requests in offline mode",
    sincronizable: false,
  },
  METADATOS_SISTEMA: {
    nombreLocal: TablasLocal.Tabla_Metadatos_Sistema,
    descripcion: "Local system metadata and configurations",
    sincronizable: false,
  },

  ASISTENCIAS_TOMADAS_HOY: {
    nombreLocal: TablasLocal.Tabla_Asistencias_Tomadas_Hoy,
    descripcion:
      "Temporary cache of attendances queried from Redis for the current day",
    sincronizable: false, // ✅ IMPORTANT: Not synchronized with server
  },
  USUARIOS_GENERICOS_CACHE: {
    nombreLocal: TablasLocal.Tabla_Usuarios_Genericos_Cache,
    descripcion: "Cache of generic user queries",
    sincronizable: false,
  },

  // Queues

  COLA_ASISTENCIAS_ESCOLARES: {
    nombreLocal: TablasLocal.Tabla_Cola_Asistencias_Escolares,
    descripcion: "Queue of school attendances",
    sincronizable: false,
  },

};

export default TablasSistema;