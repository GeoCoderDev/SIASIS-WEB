import { TablasLocal } from "@/interfaces/shared/TablasSistema";

export const CLN01_Stores: Record<TablasLocal, any> = {
  // ========================================
  // STORES FOR SESSION DATA AND CACHE
  // ========================================
  user_data: {
    keyPath: null,
    autoIncrement: false,
    indexes: [],
  },
  archivos_asistencia_hoy: {
    keyPath: null,
    autoIncrement: false,
    indexes: [],
  },

  // ========================================
  // USERS AND ROLES
  // ========================================

  estudiantes: {
    keyPath: "Id_Estudiante",
    autoIncrement: false,
    indexes: [
      { name: "by_names", keyPath: "Nombres", options: { unique: false } },
      {
        name: "by_surnames",
        keyPath: "Apellidos",
        options: { unique: false },
      },
      { name: "by_classroom", keyPath: "Id_Aula", options: { unique: false } },
      { name: "by_status", keyPath: "Estado", options: { unique: false } },
    ],
  },

  responsables: {
    keyPath: "Id_Responsable",
    autoIncrement: false,
    indexes: [
      {
        name: "by_username",
        keyPath: "Nombre_Usuario",
        options: { unique: true },
      },
      { name: "by_names", keyPath: "Nombres", options: { unique: false } },
      {
        name: "by_surnames",
        keyPath: "Apellidos",
        options: { unique: false },
      },
    ],
  },

  relaciones_e_r: {
    keyPath: "Id_Relacion",
    autoIncrement: true,
    indexes: [
      {
        name: "by_guardian",
        keyPath: "Id_Responsable",
        options: { unique: false },
      },
      {
        name: "by_student",
        keyPath: "Id_Estudiante",
        options: { unique: false },
      },
      { name: "by_type", keyPath: "Tipo", options: { unique: false } },
    ],
  },

  profesores_primaria: {
    keyPath: "Id_Profesor_Primaria",
    autoIncrement: false,
    indexes: [
      { name: "by_names", keyPath: "Nombres", options: { unique: false } },
      {
        name: "by_surnames",
        keyPath: "Apellidos",
        options: { unique: false },
      },
      {
        name: "by_last_update_date",
        keyPath: "ultima_fecha_actualizacion",
        options: { unique: false },
      },
    ],
  },

  profesores_secundaria: {
    keyPath: "Id_Profesor_Secundaria", // Uses Id_ instead of Id_
    autoIncrement: false,
    indexes: [
      {
        name: "by_username",
        keyPath: "Nombre_Usuario",
        options: { unique: true },
      },
      { name: "by_names", keyPath: "Nombres", options: { unique: false } },
      {
        name: "by_surnames",
        keyPath: "Apellidos",
        options: { unique: false },
      },
      {
        name: "by_last_update_date",
        keyPath: "ultima_fecha_actualizacion",
        options: { unique: false },
      },
    ],
  },

  auxiliares: {
    keyPath: "Id_Auxiliar", // Uses Id_ instead of Id_
    autoIncrement: false,
    indexes: [
      {
        name: "by_username",
        keyPath: "Nombre_Usuario",
        options: { unique: true },
      },
      { name: "by_names", keyPath: "Nombres", options: { unique: false } },
      {
        name: "by_surnames",
        keyPath: "Apellidos",
        options: { unique: false },
      },
      { name: "by_status", keyPath: "Estado", options: { unique: false } },
    ],
  },

  personal_administrativo: {
    keyPath: "Id_Personal_Administrativo", // Uses Id_ instead of Id_
    autoIncrement: false,
    indexes: [
      {
        name: "by_username",
        keyPath: "Nombre_Usuario",
        options: { unique: true },
      },
      { name: "by_names", keyPath: "Nombres", options: { unique: false } },
      {
        name: "by_surnames",
        keyPath: "Apellidos",
        options: { unique: false },
      },
      { name: "by_status", keyPath: "Estado", options: { unique: false } },
      { name: "by_position", keyPath: "Cargo", options: { unique: false } },
    ],
  },

  // ========================================
  // ACADEMIC STRUCTURE
  // ========================================

  aulas: {
    keyPath: "Id_Aula",
    autoIncrement: true,
    indexes: [
      { name: "by_level", keyPath: "Nivel", options: { unique: false } },
      { name: "by_grade", keyPath: "Grado", options: { unique: false } },
      { name: "by_section", keyPath: "Seccion", options: { unique: false } },
      {
        name: "by_level_grado_seccion",
        keyPath: ["Nivel", "Grado", "Seccion"],
        options: { unique: true },
      },
      {
        name: "by_primary_teacher",
        keyPath: "Id_Profesor_Primaria", // Changed from Id_ to Id_
        options: { unique: false },
      },
      {
        name: "by_secondary_teacher",
        keyPath: "Id_Profesor_Secundaria", // Changed from Id_ to Id_
        options: { unique: false },
      },
    ],
  },

  cursos_horario: {
    keyPath: "Id_Curso_Horario",
    autoIncrement: true,
    indexes: [
      { name: "by_day", keyPath: "Dia_Semana", options: { unique: false } },
      {
        name: "by_teacher",
        keyPath: "Id_Profesor_Secundaria", // Changed from Id_ to Id_
        options: { unique: false },
      },
      {
        name: "by_classroom",
        keyPath: "Id_Aula_Secundaria",
        options: { unique: false },
      },
    ],
  },

  // ========================================
  // SCHEDULES BY DAYS (NEW TABLES)
  // ========================================

  // ✅ ADDED: Schedules by days - Administrative Staff
  // horarios_by_days_personal_administrativo: {
  //   keyPath: "Id_Horario_by_day_P_Administrativo",
  //   autoIncrement: true,
  //   indexes: [
  //     {
  //       name: "by_administrative_staff",
  //       keyPath: "Id_Personal_Administrativo", // Changed from Id_ to Id_
  //       options: { unique: false },
  //     },
  //     { name: "by_day", keyPath: "Dia", options: { unique: false } },
  //     {
  //       name: "by_staff_day",
  //       keyPath: ["Id_Personal_Administrativo", "Dia"], // Changed from Id_ to Id_
  //       options: { unique: true },
  //     },
  //     {
  //       name: "by_start_time",
  //       keyPath: "Hora_Inicio",
  //       options: { unique: false },
  //     },
  //     { name: "by_end_time", keyPath: "Hora_Fin", options: { unique: false } },
  //   ],
  // },

  // ✅ ADDED: Schedules by days - Directors
  // horarios_by_days_directivos: {
  //   keyPath: "Id_Horario_by_day_Directivo",
  //   autoIncrement: true,
  //   indexes: [
  //     {
  //       name: "by_director",
  //       keyPath: "Id_Directivo", // Keeps Id_Directivo (it's different)
  //       options: { unique: false },
  //     },
  //     { name: "by_day", keyPath: "Dia", options: { unique: false } },
  //     {
  //       name: "by_director_day",
  //       keyPath: ["Id_Directivo", "Dia"],
  //       options: { unique: true },
  //     },
  //     {
  //       name: "by_start_time",
  //       keyPath: "Hora_Inicio",
  //       options: { unique: false },
  //     },
  //     { name: "by_end_time", keyPath: "Hora_Fin", options: { unique: false } },
  //   ],
  // },

  // ========================================
  // STAFF ATTENDANCE CONTROL
  // ========================================

  // PRIMARY TEACHERS
  control_entrada_profesores_primaria: {
    keyPath: "Id_C_E_M_P_Profesores_Primaria",
    autoIncrement: false,
    indexes: [
      {
        name: "by_teacher",
        keyPath: "Id_Profesor_Primaria", // Changed from Id_ to Id_
        options: { unique: false },
      },
      { name: "by_month", keyPath: "Mes", options: { unique: false } },
      {
        name: "by_teacher_mes",
        keyPath: ["Id_Profesor_Primaria", "Mes"], // Changed from Id_ to Id_
        options: { unique: true },
      },
      // ✅ NEW: Index for ultima_fecha_actualizacion
      {
        name: "by_last_update_date",
        keyPath: "ultima_fecha_actualizacion",
        options: { unique: false },
      },
    ],
  },

  control_salida_profesores_primaria: {
    keyPath: "Id_C_S_M_P_Profesores_Primaria",
    autoIncrement: false,
    indexes: [
      {
        name: "by_teacher",
        keyPath: "Id_Profesor_Primaria", // Changed from Id_ to Id_
        options: { unique: false },
      },
      { name: "by_month", keyPath: "Mes", options: { unique: false } },
      {
        name: "by_teacher_mes",
        keyPath: ["Id_Profesor_Primaria", "Mes"], // Changed from Id_ to Id_
        options: { unique: true },
      },
      // ✅ NEW: Index for ultima_fecha_actualizacion
      {
        name: "by_last_update_date",
        keyPath: "ultima_fecha_actualizacion",
        options: { unique: false },
      },
    ],
  },

  // SECONDARY TEACHERS
  control_entrada_profesores_secundaria: {
    keyPath: "Id_C_E_M_P_Profesores_Secundaria",
    autoIncrement: false,
    indexes: [
      {
        name: "by_teacher",
        keyPath: "Id_Profesor_Secundaria", // Changed from Id_ to Id_
        options: { unique: false },
      },
      { name: "by_month", keyPath: "Mes", options: { unique: false } },
      {
        name: "by_teacher_mes",
        keyPath: ["Id_Profesor_Secundaria", "Mes"], // Changed from Id_ to Id_
        options: { unique: true },
      },
      // ✅ NEW: Index for ultima_fecha_actualizacion
      {
        name: "by_last_update_date",
        keyPath: "ultima_fecha_actualizacion",
        options: { unique: false },
      },
    ],
  },

  control_salida_profesores_secundaria: {
    keyPath: "Id_C_S_M_P_Profesores_Secundaria",
    autoIncrement: false,
    indexes: [
      {
        name: "by_teacher",
        keyPath: "Id_Profesor_Secundaria", // Changed from Id_ to Id_
        options: { unique: false },
      },
      { name: "by_month", keyPath: "Mes", options: { unique: false } },
      {
        name: "by_teacher_mes",
        keyPath: ["Id_Profesor_Secundaria", "Mes"], // Changed from Id_ to Id_
        options: { unique: true },
      },
      // ✅ NEW: Index for ultima_fecha_actualizacion
      {
        name: "by_last_update_date",
        keyPath: "ultima_fecha_actualizacion",
        options: { unique: false },
      },
    ],
  },

  // TEACHING ASSISTANTS
  control_entrada_auxiliar: {
    keyPath: "Id_C_E_M_P_Auxiliar",
    autoIncrement: false,
    indexes: [
      {
        name: "by_assistant",
        keyPath: "Id_Auxiliar", // Changed from Id_ to Id_
        options: { unique: false },
      },
      { name: "by_month", keyPath: "Mes", options: { unique: false } },
      {
        name: "by_assistant_mes",
        keyPath: ["Id_Auxiliar", "Mes"], // Changed from Id_ to Id_
        options: { unique: true },
      },
      // ✅ NEW: Index for ultima_fecha_actualizacion
      {
        name: "by_last_update_date",
        keyPath: "ultima_fecha_actualizacion",
        options: { unique: false },
      },
    ],
  },

  control_salida_auxiliar: {
    keyPath: "Id_C_S_M_P_Auxiliar",
    autoIncrement: false,
    indexes: [
      {
        name: "by_assistant",
        keyPath: "Id_Auxiliar", // Changed from Id_ to Id_
        options: { unique: false },
      },
      { name: "by_month", keyPath: "Mes", options: { unique: false } },
      {
        name: "by_assistant_mes",
        keyPath: ["Id_Auxiliar", "Mes"], // Changed from Id_ to Id_
        options: { unique: true },
      },
      // ✅ NEW: Index for ultima_fecha_actualizacion
      {
        name: "by_last_update_date",
        keyPath: "ultima_fecha_actualizacion",
        options: { unique: false },
      },
    ],
  },

  // ADMINISTRATIVE STAFF
  control_entrada_personal_administrativo: {
    keyPath: "Id_C_E_M_P_Administrativo",
    autoIncrement: false,
    indexes: [
      {
        name: "by_administrative",
        keyPath: "Id_Personal_Administrativo", // Changed from Id_ to Id_
        options: { unique: false },
      },
      { name: "by_month", keyPath: "Mes", options: { unique: false } },
      {
        name: "by_administrative_mes",
        keyPath: ["Id_Personal_Administrativo", "Mes"], // Changed from Id_ to Id_
        options: { unique: true },
      },
      // ✅ NEW: Index for ultima_fecha_actualizacion
      {
        name: "by_last_update_date",
        keyPath: "ultima_fecha_actualizacion",
        options: { unique: false },
      },
    ],
  },

  control_salida_personal_administrativo: {
    keyPath: "Id_C_S_M_P_Administrativo",
    autoIncrement: false,
    indexes: [
      {
        name: "by_administrative",
        keyPath: "Id_Personal_Administrativo", // Changed from Id_ to Id_
        options: { unique: false },
      },
      { name: "by_month", keyPath: "Mes", options: { unique: false } },
      {
        name: "by_administrative_mes",
        keyPath: ["Id_Personal_Administrativo", "Mes"], // Changed from Id_ to Id_
        options: { unique: true },
      },
      // ✅ NEW: Index for ultima_fecha_actualizacion
      {
        name: "by_last_update_date",
        keyPath: "ultima_fecha_actualizacion",
        options: { unique: false },
      },
    ],
  },

  // ✅ ADDED: DIRECTORS
  control_entrada_directivos: {
    keyPath: "Id_C_E_M_P_Directivo",
    autoIncrement: true,
    indexes: [
      {
        name: "by_director",
        keyPath: "Id_Directivo", // Keeps Id_Directivo
        options: { unique: false },
      },
      { name: "by_month", keyPath: "Mes", options: { unique: false } },
      {
        name: "by_director_month",
        keyPath: ["Id_Directivo", "Mes"],
        options: { unique: true },
      },
      // ✅ NEW: Index for ultima_fecha_actualizacion
      {
        name: "by_last_update_date",
        keyPath: "ultima_fecha_actualizacion",
        options: { unique: false },
      },
    ],
  },

  control_salida_directivos: {
    keyPath: "Id_C_S_M_P_Directivo",
    autoIncrement: true,
    indexes: [
      {
        name: "by_director",
        keyPath: "Id_Directivo", // Keeps Id_Directivo
        options: { unique: false },
      },
      { name: "by_month", keyPath: "Mes", options: { unique: false } },
      {
        name: "by_director_month",
        keyPath: ["Id_Directivo", "Mes"],
        options: { unique: true },
      },
      // ✅ NEW: Index for ultima_fecha_actualizacion
      {
        name: "by_last_update_date",
        keyPath: "ultima_fecha_actualizacion",
        options: { unique: false },
      },
    ],
  },

  // ========================================
  // STUDENT ATTENDANCE
  // ========================================

  // PRIMARY (6 grades)
  asistencias_e_p_1: {
    keyPath: ["Id_Estudiante", "Mes"],
    autoIncrement: false,
    indexes: [
      {
        name: "by_student",
        keyPath: "Id_Estudiante",
        options: { unique: false },
      },
      { name: "by_month", keyPath: "Mes", options: { unique: false } },
      {
        name: "by_student_mes",
        keyPath: ["Id_Estudiante", "Mes"],
        options: { unique: true },
      },
      {
        name: "by_last_update_date",
        keyPath: "ultima_fecha_actualizacion",
        options: { unique: false },
      },
    ],
  },

  asistencias_e_p_2: {
    keyPath: ["Id_Estudiante", "Mes"],
    autoIncrement: false,
    indexes: [
      {
        name: "by_student",
        keyPath: "Id_Estudiante",
        options: { unique: false },
      },
      { name: "by_month", keyPath: "Mes", options: { unique: false } },
      {
        name: "by_student_mes",
        keyPath: ["Id_Estudiante", "Mes"],
        options: { unique: true },
      },
      {
        name: "by_last_update_date",
        keyPath: "ultima_fecha_actualizacion",
        options: { unique: false },
      },
    ],
  },

  asistencias_e_p_3: {
    keyPath: ["Id_Estudiante", "Mes"],
    autoIncrement: false,
    indexes: [
      {
        name: "by_student",
        keyPath: "Id_Estudiante",
        options: { unique: false },
      },
      { name: "by_month", keyPath: "Mes", options: { unique: false } },
      {
        name: "by_student_mes",
        keyPath: ["Id_Estudiante", "Mes"],
        options: { unique: true },
      },
      {
        name: "by_last_update_date",
        keyPath: "ultima_fecha_actualizacion",
        options: { unique: false },
      },
    ],
  },

  asistencias_e_p_4: {
    keyPath: ["Id_Estudiante", "Mes"],
    autoIncrement: false,
    indexes: [
      {
        name: "by_student",
        keyPath: "Id_Estudiante",
        options: { unique: false },
      },
      { name: "by_month", keyPath: "Mes", options: { unique: false } },
      {
        name: "by_student_mes",
        keyPath: ["Id_Estudiante", "Mes"],
        options: { unique: true },
      },
      {
        name: "by_last_update_date",
        keyPath: "ultima_fecha_actualizacion",
        options: { unique: false },
      },
    ],
  },

  asistencias_e_p_5: {
    keyPath: ["Id_Estudiante", "Mes"],
    autoIncrement: false,
    indexes: [
      {
        name: "by_student",
        keyPath: "Id_Estudiante",
        options: { unique: false },
      },
      { name: "by_month", keyPath: "Mes", options: { unique: false } },
      {
        name: "by_student_mes",
        keyPath: ["Id_Estudiante", "Mes"],
        options: { unique: true },
      },
      {
        name: "by_last_update_date",
        keyPath: "ultima_fecha_actualizacion",
        options: { unique: false },
      },
    ],
  },

  asistencias_e_p_6: {
    keyPath: ["Id_Estudiante", "Mes"],
    autoIncrement: false,
    indexes: [
      {
        name: "by_student",
        keyPath: "Id_Estudiante",
        options: { unique: false },
      },
      { name: "by_month", keyPath: "Mes", options: { unique: false } },
      {
        name: "by_student_mes",
        keyPath: ["Id_Estudiante", "Mes"],
        options: { unique: true },
      },
      {
        name: "by_last_update_date",
        keyPath: "ultima_fecha_actualizacion",
        options: { unique: false },
      },
    ],
  },

  // SECONDARY (5 grades)
  asistencias_e_s_1: {
    keyPath: ["Id_Estudiante", "Mes"],
    autoIncrement: false,
    indexes: [
      {
        name: "by_student",
        keyPath: "Id_Estudiante",
        options: { unique: false },
      },
      { name: "by_month", keyPath: "Mes", options: { unique: false } },
      {
        name: "by_student_mes",
        keyPath: ["Id_Estudiante", "Mes"],
        options: { unique: true },
      },
      {
        name: "by_last_update_date",
        keyPath: "ultima_fecha_actualizacion",
        options: { unique: false },
      },
    ],
  },

  asistencias_e_s_2: {
    keyPath: ["Id_Estudiante", "Mes"],
    autoIncrement: false,
    indexes: [
      {
        name: "by_student",
        keyPath: "Id_Estudiante",
        options: { unique: false },
      },
      { name: "by_month", keyPath: "Mes", options: { unique: false } },
      {
        name: "by_student_mes",
        keyPath: ["Id_Estudiante", "Mes"],
        options: { unique: true },
      },
      {
        name: "by_last_update_date",
        keyPath: "ultima_fecha_actualizacion",
        options: { unique: false },
      },
    ],
  },

  asistencias_e_s_3: {
    keyPath: ["Id_Estudiante", "Mes"],
    autoIncrement: false,
    indexes: [
      {
        name: "by_student",
        keyPath: "Id_Estudiante",
        options: { unique: false },
      },
      { name: "by_month", keyPath: "Mes", options: { unique: false } },
      {
        name: "by_student_mes",
        keyPath: ["Id_Estudiante", "Mes"],
        options: { unique: true },
      },
      {
        name: "by_last_update_date",
        keyPath: "ultima_fecha_actualizacion",
        options: { unique: false },
      },
    ],
  },

  asistencias_e_s_4: {
    keyPath: ["Id_Estudiante", "Mes"],
    autoIncrement: false,
    indexes: [
      {
        name: "by_student",
        keyPath: "Id_Estudiante",
        options: { unique: false },
      },
      { name: "by_month", keyPath: "Mes", options: { unique: false } },
      {
        name: "by_student_mes",
        keyPath: ["Id_Estudiante", "Mes"],
        options: { unique: true },
      },
      {
        name: "by_last_update_date",
        keyPath: "ultima_fecha_actualizacion",
        options: { unique: false },
      },
    ],
  },

  asistencias_e_s_5: {
    keyPath: ["Id_Estudiante", "Mes"],
    autoIncrement: false,
    indexes: [
      {
        name: "by_student",
        keyPath: "Id_Estudiante",
        options: { unique: false },
      },
      { name: "by_month", keyPath: "Mes", options: { unique: false } },
      {
        name: "by_student_mes",
        keyPath: ["Id_Estudiante", "Mes"],
        options: { unique: true },
      },
      {
        name: "by_last_update_date",
        keyPath: "ultima_fecha_actualizacion",
        options: { unique: false },
      },
    ],
  },

  // ========================================
  // CONFIGURATION AND ADMINISTRATION
  // ========================================

  bloqueo_roles: {
    keyPath: "Rol", // Now uses Rol as PK instead of Id_Bloqueo_Rol
    autoIncrement: false,
    indexes: [
      // 🗑️ REMOVED: no longer needs by_role index because Rol is the PK
    ],
  },

  ajustes_generales_sistema: {
    keyPath: "Id_Constante",
    autoIncrement: true,
    indexes: [
      { name: "by_name", keyPath: "Nombre", options: { unique: true } },
    ],
  },

  horarios_asistencia: {
    keyPath: "Id_Horario",
    autoIncrement: true,
    indexes: [
      { name: "by_name", keyPath: "Nombre", options: { unique: true } },
    ],
  },

  eventos: {
    keyPath: "Id_Evento",
    autoIncrement: true,
    indexes: [
      {
        name: "by_start_date",
        keyPath: "Fecha_Inicio",
        options: { unique: false },
      },
      {
        name: "by_end_date",
        keyPath: "Fecha_Conclusion",
        options: { unique: false },
      },
      {
        name: "by_month_año_inicio",
        keyPath: "mes_año_inicio",
        options: { unique: false },
      },
      {
        name: "by_month_año_conclusion",
        keyPath: "mes_año_conclusion",
        options: { unique: false },
      },
    ],
  },

  comunicados: {
    keyPath: "Id_Comunicado",
    autoIncrement: true,
    indexes: [
      {
        name: "by_start_date",
        keyPath: "Fecha_Inicio",
        options: { unique: false },
      },
      {
        name: "by_end_date",
        keyPath: "Fecha_Conclusion",
        options: { unique: false },
      },
    ],
  },

  // ✅ ADDED: OTP Codes
  codigos_otp: {
    keyPath: "Id_Codigo_OTP",
    autoIncrement: true,
    indexes: [
      {
        name: "by_destination_email",
        keyPath: "Correo_Destino",
        options: { unique: false },
      },
      {
        name: "by_user_role",
        keyPath: "Rol_Usuario",
        options: { unique: false },
      },
      {
        name: "by_user_id",
        keyPath: "Id_Usuario",
        options: { unique: false },
      },
      { name: "by_code", keyPath: "Codigo", options: { unique: false } },
      {
        name: "by_creation_date",
        keyPath: "Fecha_Creacion",
        options: { unique: false },
      },
      {
        name: "by_expiration_date",
        keyPath: "Fecha_Expiracion",
        options: { unique: false },
      },
      {
        name: "by_email_code",
        keyPath: ["Correo_Destino", "Codigo"],
        options: { unique: false },
      },
    ],
  },

  registro_fallos_sistema: {
    keyPath: "Id_Registro_Fallo_Sistema",
    autoIncrement: true,
    indexes: [
      { name: "by_date", keyPath: "Fecha", options: { unique: false } },
      {
        name: "by_component",
        keyPath: "Componente",
        options: { unique: false },
      },
    ],
  },

  ultima_modificacion_tablas: {
    keyPath: "Nombre_Tabla",
    autoIncrement: false,
    indexes: [
      {
        name: "by_operation",
        keyPath: "Operacion",
        options: { unique: false },
      },
      {
        name: "by_date",
        keyPath: "Fecha_Modificacion",
        options: { unique: false },
      },
      {
        name: "by_user",
        keyPath: "Usuario_Modificacion",
        options: { unique: false },
      },
    ],
  },

  fechas_importantes: {
    keyPath: "Id_Fecha_Importante",
    autoIncrement: true,
    indexes: [
      { name: "by_name", keyPath: "Nombre", options: { unique: true } },
      { name: "by_value", keyPath: "Valor", options: { unique: false } },
      {
        name: "by_last_modification",
        keyPath: "Ultima_Modificacion",
        options: { unique: false },
      },
    ],
  },

  vacaciones_interescolares: {
    keyPath: "Id_Vacacion_Interescolar",
    autoIncrement: true,
    indexes: [
      {
        name: "by_start_date",
        keyPath: "Fecha_Inicio",
        options: { unique: false },
      },
      {
        name: "by_end_date",
        keyPath: "Fecha_Conclusion",
        options: { unique: false },
      },
      {
        name: "by_date_range",
        keyPath: ["Fecha_Inicio", "Fecha_Conclusion"],
        options: { unique: false },
      },
    ],
  },

  // ========================================
  // LOCAL STORES AND CACHE
  // ========================================

  ultima_actualizacion_tablas_locales: {
    keyPath: "Nombre_Tabla",
    autoIncrement: false,
    indexes: [
      {
        name: "by_operation",
        keyPath: "Operacion",
        options: { unique: false },
      },
      {
        name: "by_date",
        keyPath: "Fecha_Actualizacion",
        options: { unique: false },
      },
    ],
  },

  offline_requests: {
    keyPath: "id",
    autoIncrement: true,
    indexes: [
      {
        name: "by_created_at",
        keyPath: "created_at",
        options: { unique: false },
      },
      { name: "by_attempts", keyPath: "attempts", options: { unique: false } },
    ],
  },

  system_meta: {
    keyPath: "key",
    autoIncrement: false,
    indexes: [],
  },

  // Attendance cache queried from Redis
  asistencias_tomadas_hoy: {
    keyPath: "clave",
    autoIncrement: false,
    indexes: [
      {
        name: "by_identifier",
        keyPath: "identificador",
        options: { unique: false },
      },
      { name: "by_date", keyPath: "fecha", options: { unique: false } },
      { name: "by_actor", keyPath: "actor", options: { unique: false } },
      {
        name: "by_registry_mode",
        keyPath: "modoRegistro",
        options: { unique: false },
      },
      {
        name: "by_type_asistencia",
        keyPath: "tipoAsistencia",
        options: { unique: false },
      },
      {
        name: "by_query_timestamp",
        keyPath: "timestampConsulta",
        options: { unique: false },
      },
      {
        name: "by_identifier_modo",
        keyPath: ["identificador", "modoRegistro"],
        options: { unique: false },
      },
      {
        name: "by_actor_tipo",
        keyPath: ["actor", "tipoAsistencia"],
        options: { unique: false },
      },
      {
        name: "by_date_identificador",
        keyPath: ["fecha", "identificador"],
        options: { unique: false },
      },
    ],
  },

  usuarios_genericos_cache: {
    keyPath: "clave_busqueda",
    autoIncrement: false,
    indexes: [
      { name: "by_role", keyPath: "rol", options: { unique: false } },
      { name: "by_criteria", keyPath: "criterio", options: { unique: false } },
      { name: "by_limit", keyPath: "limite", options: { unique: false } },
      {
        name: "por_ultima_actualizacion",
        keyPath: "ultima_actualizacion",
        options: { unique: false },
      },
      {
        name: "by_role_criterio",
        keyPath: ["rol", "criterio"],
        options: { unique: false },
      },
    ],
  },

  cola_asistencias_escolares: {
    keyPath: "NumeroDeOrden",
    autoIncrement: false,
    indexes: [
      {
        name: "by_student",
        keyPath: "Id_Estudiante",
        options: { unique: false },
      },
      {
        name: "by_type_asistencia",
        keyPath: "TipoAsistencia",
        options: { unique: false },
      },
      {
        name: "by_offset_seconds",
        keyPath: "DesfaseSegundos",
        options: { unique: false },
      },
      {
        name: "by_student_tipo",
        keyPath: ["Id_Estudiante", "TipoAsistencia"],
        options: { unique: false },
      },
      {
        name: "by_type_desfase",
        keyPath: ["TipoAsistencia", "DesfaseSegundos"],
        options: { unique: false },
      },
    ],
  },
};

