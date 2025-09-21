import { TablasLocal } from "@/interfaces/shared/TablasSistema";

export const CLN01_Stores: Record<TablasLocal, any> = {
  // ========================================
  // STORES PARA DATOS DE SESIÓN Y CACHE
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
  // USUARIOS Y ROLES
  // ========================================

  estudiantes: {
    keyPath: "Id_Estudiante",
    autoIncrement: false,
    indexes: [
      { name: "por_nombres", keyPath: "Nombres", options: { unique: false } },
      {
        name: "por_apellidos",
        keyPath: "Apellidos",
        options: { unique: false },
      },
      { name: "por_aula", keyPath: "Id_Aula", options: { unique: false } },
      { name: "por_estado", keyPath: "Estado", options: { unique: false } },
    ],
  },

  responsables: {
    keyPath: "Id_Responsable",
    autoIncrement: false,
    indexes: [
      {
        name: "por_nombre_usuario",
        keyPath: "Nombre_Usuario",
        options: { unique: true },
      },
      { name: "por_nombres", keyPath: "Nombres", options: { unique: false } },
      {
        name: "por_apellidos",
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
        name: "por_responsable",
        keyPath: "Id_Responsable",
        options: { unique: false },
      },
      {
        name: "por_estudiante",
        keyPath: "Id_Estudiante",
        options: { unique: false },
      },
      { name: "por_tipo", keyPath: "Tipo", options: { unique: false } },
    ],
  },

  profesores_primaria: {
    keyPath: "Id_Profesor_Primaria",
    autoIncrement: false,
    indexes: [
      { name: "por_nombres", keyPath: "Nombres", options: { unique: false } },
      {
        name: "por_apellidos",
        keyPath: "Apellidos",
        options: { unique: false },
      },
      {
        name: "por_ultima_fecha_actualizacion",
        keyPath: "ultima_fecha_actualizacion",
        options: { unique: false },
      },
    ],
  },

  profesores_secundaria: {
    keyPath: "Id_Profesor_Secundaria", // Usa Id_ en lugar de Id_
    autoIncrement: false,
    indexes: [
      {
        name: "por_nombre_usuario",
        keyPath: "Nombre_Usuario",
        options: { unique: true },
      },
      { name: "por_nombres", keyPath: "Nombres", options: { unique: false } },
      {
        name: "por_apellidos",
        keyPath: "Apellidos",
        options: { unique: false },
      },
      {
        name: "por_ultima_fecha_actualizacion",
        keyPath: "ultima_fecha_actualizacion",
        options: { unique: false },
      },
    ],
  },

  auxiliares: {
    keyPath: "Id_Auxiliar", // Usa Id_ en lugar de Id_
    autoIncrement: false,
    indexes: [
      {
        name: "por_nombre_usuario",
        keyPath: "Nombre_Usuario",
        options: { unique: true },
      },
      { name: "por_nombres", keyPath: "Nombres", options: { unique: false } },
      {
        name: "por_apellidos",
        keyPath: "Apellidos",
        options: { unique: false },
      },
      { name: "por_estado", keyPath: "Estado", options: { unique: false } },
    ],
  },

  personal_administrativo: {
    keyPath: "Id_Personal_Administrativo", // Usa Id_ en lugar de Id_
    autoIncrement: false,
    indexes: [
      {
        name: "por_nombre_usuario",
        keyPath: "Nombre_Usuario",
        options: { unique: true },
      },
      { name: "por_nombres", keyPath: "Nombres", options: { unique: false } },
      {
        name: "por_apellidos",
        keyPath: "Apellidos",
        options: { unique: false },
      },
      { name: "por_estado", keyPath: "Estado", options: { unique: false } },
      { name: "por_cargo", keyPath: "Cargo", options: { unique: false } },
    ],
  },

  // ========================================
  // ESTRUCTURA ACADÉMICA
  // ========================================

  aulas: {
    keyPath: "Id_Aula",
    autoIncrement: true,
    indexes: [
      { name: "por_nivel", keyPath: "Nivel", options: { unique: false } },
      { name: "por_grado", keyPath: "Grado", options: { unique: false } },
      { name: "por_seccion", keyPath: "Seccion", options: { unique: false } },
      {
        name: "por_nivel_grado_seccion",
        keyPath: ["Nivel", "Grado", "Seccion"],
        options: { unique: true },
      },
      {
        name: "por_profesor_primaria",
        keyPath: "Id_Profesor_Primaria", // Cambió de Id_ a Id_
        options: { unique: false },
      },
      {
        name: "por_profesor_secundaria",
        keyPath: "Id_Profesor_Secundaria", // Cambió de Id_ a Id_
        options: { unique: false },
      },
    ],
  },

  cursos_horario: {
    keyPath: "Id_Curso_Horario",
    autoIncrement: true,
    indexes: [
      { name: "por_dia", keyPath: "Dia_Semana", options: { unique: false } },
      {
        name: "por_profesor",
        keyPath: "Id_Profesor_Secundaria", // Cambió de Id_ a Id_
        options: { unique: false },
      },
      {
        name: "por_aula",
        keyPath: "Id_Aula_Secundaria",
        options: { unique: false },
      },
    ],
  },

  // ========================================
  // HORARIOS POR DÍAS (NUEVAS TABLAS)
  // ========================================

  // ✅ AGREGADO: Horarios por días - Personal Administrativo
  // horarios_por_dias_personal_administrativo: {
  //   keyPath: "Id_Horario_Por_Dia_P_Administrativo",
  //   autoIncrement: true,
  //   indexes: [
  //     {
  //       name: "por_personal_administrativo",
  //       keyPath: "Id_Personal_Administrativo", // Cambió de Id_ a Id_
  //       options: { unique: false },
  //     },
  //     { name: "por_dia", keyPath: "Dia", options: { unique: false } },
  //     {
  //       name: "por_personal_dia",
  //       keyPath: ["Id_Personal_Administrativo", "Dia"], // Cambió de Id_ a Id_
  //       options: { unique: true },
  //     },
  //     {
  //       name: "por_hora_inicio",
  //       keyPath: "Hora_Inicio",
  //       options: { unique: false },
  //     },
  //     { name: "por_hora_fin", keyPath: "Hora_Fin", options: { unique: false } },
  //   ],
  // },

  // ✅ AGREGADO: Horarios por días - Directivos
  // horarios_por_dias_directivos: {
  //   keyPath: "Id_Horario_Por_Dia_Directivo",
  //   autoIncrement: true,
  //   indexes: [
  //     {
  //       name: "por_directivo",
  //       keyPath: "Id_Directivo", // Mantiene Id_Directivo (es diferente)
  //       options: { unique: false },
  //     },
  //     { name: "por_dia", keyPath: "Dia", options: { unique: false } },
  //     {
  //       name: "por_directivo_dia",
  //       keyPath: ["Id_Directivo", "Dia"],
  //       options: { unique: true },
  //     },
  //     {
  //       name: "por_hora_inicio",
  //       keyPath: "Hora_Inicio",
  //       options: { unique: false },
  //     },
  //     { name: "por_hora_fin", keyPath: "Hora_Fin", options: { unique: false } },
  //   ],
  // },

  // ========================================
  // CONTROL DE ASISTENCIA DEL PERSONAL
  // ========================================

  // PROFESORES PRIMARIA
  control_entrada_profesores_primaria: {
    keyPath: "Id_C_E_M_P_Profesores_Primaria",
    autoIncrement: false,
    indexes: [
      {
        name: "por_profesor",
        keyPath: "Id_Profesor_Primaria", // Cambió de Id_ a Id_
        options: { unique: false },
      },
      { name: "por_mes", keyPath: "Mes", options: { unique: false } },
      {
        name: "por_profesor_mes",
        keyPath: ["Id_Profesor_Primaria", "Mes"], // Cambió de Id_ a Id_
        options: { unique: true },
      },
      // ✅ NUEVO: Índice para ultima_fecha_actualizacion
      {
        name: "por_ultima_fecha_actualizacion",
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
        name: "por_profesor",
        keyPath: "Id_Profesor_Primaria", // Cambió de Id_ a Id_
        options: { unique: false },
      },
      { name: "por_mes", keyPath: "Mes", options: { unique: false } },
      {
        name: "por_profesor_mes",
        keyPath: ["Id_Profesor_Primaria", "Mes"], // Cambió de Id_ a Id_
        options: { unique: true },
      },
      // ✅ NUEVO: Índice para ultima_fecha_actualizacion
      {
        name: "por_ultima_fecha_actualizacion",
        keyPath: "ultima_fecha_actualizacion",
        options: { unique: false },
      },
    ],
  },

  // PROFESORES SECUNDARIA
  control_entrada_profesores_secundaria: {
    keyPath: "Id_C_E_M_P_Profesores_Secundaria",
    autoIncrement: false,
    indexes: [
      {
        name: "por_profesor",
        keyPath: "Id_Profesor_Secundaria", // Cambió de Id_ a Id_
        options: { unique: false },
      },
      { name: "por_mes", keyPath: "Mes", options: { unique: false } },
      {
        name: "por_profesor_mes",
        keyPath: ["Id_Profesor_Secundaria", "Mes"], // Cambió de Id_ a Id_
        options: { unique: true },
      },
      // ✅ NUEVO: Índice para ultima_fecha_actualizacion
      {
        name: "por_ultima_fecha_actualizacion",
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
        name: "por_profesor",
        keyPath: "Id_Profesor_Secundaria", // Cambió de Id_ a Id_
        options: { unique: false },
      },
      { name: "por_mes", keyPath: "Mes", options: { unique: false } },
      {
        name: "por_profesor_mes",
        keyPath: ["Id_Profesor_Secundaria", "Mes"], // Cambió de Id_ a Id_
        options: { unique: true },
      },
      // ✅ NUEVO: Índice para ultima_fecha_actualizacion
      {
        name: "por_ultima_fecha_actualizacion",
        keyPath: "ultima_fecha_actualizacion",
        options: { unique: false },
      },
    ],
  },

  // AUXILIARES
  control_entrada_auxiliar: {
    keyPath: "Id_C_E_M_P_Auxiliar",
    autoIncrement: false,
    indexes: [
      {
        name: "por_auxiliar",
        keyPath: "Id_Auxiliar", // Cambió de Id_ a Id_
        options: { unique: false },
      },
      { name: "por_mes", keyPath: "Mes", options: { unique: false } },
      {
        name: "por_auxiliar_mes",
        keyPath: ["Id_Auxiliar", "Mes"], // Cambió de Id_ a Id_
        options: { unique: true },
      },
      // ✅ NUEVO: Índice para ultima_fecha_actualizacion
      {
        name: "por_ultima_fecha_actualizacion",
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
        name: "por_auxiliar",
        keyPath: "Id_Auxiliar", // Cambió de Id_ a Id_
        options: { unique: false },
      },
      { name: "por_mes", keyPath: "Mes", options: { unique: false } },
      {
        name: "por_auxiliar_mes",
        keyPath: ["Id_Auxiliar", "Mes"], // Cambió de Id_ a Id_
        options: { unique: true },
      },
      // ✅ NUEVO: Índice para ultima_fecha_actualizacion
      {
        name: "por_ultima_fecha_actualizacion",
        keyPath: "ultima_fecha_actualizacion",
        options: { unique: false },
      },
    ],
  },

  // PERSONAL ADMINISTRATIVO
  control_entrada_personal_administrativo: {
    keyPath: "Id_C_E_M_P_Administrativo",
    autoIncrement: false,
    indexes: [
      {
        name: "por_administrativo",
        keyPath: "Id_Personal_Administrativo", // Cambió de Id_ a Id_
        options: { unique: false },
      },
      { name: "por_mes", keyPath: "Mes", options: { unique: false } },
      {
        name: "por_administrativo_mes",
        keyPath: ["Id_Personal_Administrativo", "Mes"], // Cambió de Id_ a Id_
        options: { unique: true },
      },
      // ✅ NUEVO: Índice para ultima_fecha_actualizacion
      {
        name: "por_ultima_fecha_actualizacion",
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
        name: "por_administrativo",
        keyPath: "Id_Personal_Administrativo", // Cambió de Id_ a Id_
        options: { unique: false },
      },
      { name: "por_mes", keyPath: "Mes", options: { unique: false } },
      {
        name: "por_administrativo_mes",
        keyPath: ["Id_Personal_Administrativo", "Mes"], // Cambió de Id_ a Id_
        options: { unique: true },
      },
      // ✅ NUEVO: Índice para ultima_fecha_actualizacion
      {
        name: "por_ultima_fecha_actualizacion",
        keyPath: "ultima_fecha_actualizacion",
        options: { unique: false },
      },
    ],
  },

  // ✅ AGREGADO: DIRECTIVOS
  control_entrada_directivos: {
    keyPath: "Id_C_E_M_P_Directivo",
    autoIncrement: true,
    indexes: [
      {
        name: "por_directivo",
        keyPath: "Id_Directivo", // Mantiene Id_Directivo
        options: { unique: false },
      },
      { name: "por_mes", keyPath: "Mes", options: { unique: false } },
      {
        name: "por_directivo_mes",
        keyPath: ["Id_Directivo", "Mes"],
        options: { unique: true },
      },
      // ✅ NUEVO: Índice para ultima_fecha_actualizacion
      {
        name: "por_ultima_fecha_actualizacion",
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
        name: "por_directivo",
        keyPath: "Id_Directivo", // Mantiene Id_Directivo
        options: { unique: false },
      },
      { name: "por_mes", keyPath: "Mes", options: { unique: false } },
      {
        name: "por_directivo_mes",
        keyPath: ["Id_Directivo", "Mes"],
        options: { unique: true },
      },
      // ✅ NUEVO: Índice para ultima_fecha_actualizacion
      {
        name: "por_ultima_fecha_actualizacion",
        keyPath: "ultima_fecha_actualizacion",
        options: { unique: false },
      },
    ],
  },

  // ========================================
  // ASISTENCIA ESTUDIANTIL
  // ========================================

  // PRIMARIA (6 grados)
  asistencias_e_p_1: {
    keyPath: ["Id_Estudiante", "Mes"],
    autoIncrement: false,
    indexes: [
      {
        name: "por_estudiante",
        keyPath: "Id_Estudiante",
        options: { unique: false },
      },
      { name: "por_mes", keyPath: "Mes", options: { unique: false } },
      {
        name: "por_estudiante_mes",
        keyPath: ["Id_Estudiante", "Mes"],
        options: { unique: true },
      },
      {
        name: "por_ultima_fecha_actualizacion",
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
        name: "por_estudiante",
        keyPath: "Id_Estudiante",
        options: { unique: false },
      },
      { name: "por_mes", keyPath: "Mes", options: { unique: false } },
      {
        name: "por_estudiante_mes",
        keyPath: ["Id_Estudiante", "Mes"],
        options: { unique: true },
      },
      {
        name: "por_ultima_fecha_actualizacion",
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
        name: "por_estudiante",
        keyPath: "Id_Estudiante",
        options: { unique: false },
      },
      { name: "por_mes", keyPath: "Mes", options: { unique: false } },
      {
        name: "por_estudiante_mes",
        keyPath: ["Id_Estudiante", "Mes"],
        options: { unique: true },
      },
      {
        name: "por_ultima_fecha_actualizacion",
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
        name: "por_estudiante",
        keyPath: "Id_Estudiante",
        options: { unique: false },
      },
      { name: "por_mes", keyPath: "Mes", options: { unique: false } },
      {
        name: "por_estudiante_mes",
        keyPath: ["Id_Estudiante", "Mes"],
        options: { unique: true },
      },
      {
        name: "por_ultima_fecha_actualizacion",
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
        name: "por_estudiante",
        keyPath: "Id_Estudiante",
        options: { unique: false },
      },
      { name: "por_mes", keyPath: "Mes", options: { unique: false } },
      {
        name: "por_estudiante_mes",
        keyPath: ["Id_Estudiante", "Mes"],
        options: { unique: true },
      },
      {
        name: "por_ultima_fecha_actualizacion",
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
        name: "por_estudiante",
        keyPath: "Id_Estudiante",
        options: { unique: false },
      },
      { name: "por_mes", keyPath: "Mes", options: { unique: false } },
      {
        name: "por_estudiante_mes",
        keyPath: ["Id_Estudiante", "Mes"],
        options: { unique: true },
      },
      {
        name: "por_ultima_fecha_actualizacion",
        keyPath: "ultima_fecha_actualizacion",
        options: { unique: false },
      },
    ],
  },

  // SECUNDARIA (5 grados)
  asistencias_e_s_1: {
    keyPath: ["Id_Estudiante", "Mes"],
    autoIncrement: false,
    indexes: [
      {
        name: "por_estudiante",
        keyPath: "Id_Estudiante",
        options: { unique: false },
      },
      { name: "por_mes", keyPath: "Mes", options: { unique: false } },
      {
        name: "por_estudiante_mes",
        keyPath: ["Id_Estudiante", "Mes"],
        options: { unique: true },
      },
      {
        name: "por_ultima_fecha_actualizacion",
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
        name: "por_estudiante",
        keyPath: "Id_Estudiante",
        options: { unique: false },
      },
      { name: "por_mes", keyPath: "Mes", options: { unique: false } },
      {
        name: "por_estudiante_mes",
        keyPath: ["Id_Estudiante", "Mes"],
        options: { unique: true },
      },
      {
        name: "por_ultima_fecha_actualizacion",
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
        name: "por_estudiante",
        keyPath: "Id_Estudiante",
        options: { unique: false },
      },
      { name: "por_mes", keyPath: "Mes", options: { unique: false } },
      {
        name: "por_estudiante_mes",
        keyPath: ["Id_Estudiante", "Mes"],
        options: { unique: true },
      },
      {
        name: "por_ultima_fecha_actualizacion",
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
        name: "por_estudiante",
        keyPath: "Id_Estudiante",
        options: { unique: false },
      },
      { name: "por_mes", keyPath: "Mes", options: { unique: false } },
      {
        name: "por_estudiante_mes",
        keyPath: ["Id_Estudiante", "Mes"],
        options: { unique: true },
      },
      {
        name: "por_ultima_fecha_actualizacion",
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
        name: "por_estudiante",
        keyPath: "Id_Estudiante",
        options: { unique: false },
      },
      { name: "por_mes", keyPath: "Mes", options: { unique: false } },
      {
        name: "por_estudiante_mes",
        keyPath: ["Id_Estudiante", "Mes"],
        options: { unique: true },
      },
      {
        name: "por_ultima_fecha_actualizacion",
        keyPath: "ultima_fecha_actualizacion",
        options: { unique: false },
      },
    ],
  },

  // ========================================
  // CONFIGURACIÓN Y ADMINISTRACIÓN
  // ========================================

  bloqueo_roles: {
    keyPath: "Rol", // Ahora usa Rol como PK en lugar de Id_Bloqueo_Rol
    autoIncrement: false,
    indexes: [
      // 🗑️ REMOVIDO: ya no necesita índice por_rol porque Rol es la PK
    ],
  },

  ajustes_generales_sistema: {
    keyPath: "Id_Constante",
    autoIncrement: true,
    indexes: [
      { name: "por_nombre", keyPath: "Nombre", options: { unique: true } },
    ],
  },

  horarios_asistencia: {
    keyPath: "Id_Horario",
    autoIncrement: true,
    indexes: [
      { name: "por_nombre", keyPath: "Nombre", options: { unique: true } },
    ],
  },

  eventos: {
    keyPath: "Id_Evento",
    autoIncrement: true,
    indexes: [
      {
        name: "por_fecha_inicio",
        keyPath: "Fecha_Inicio",
        options: { unique: false },
      },
      {
        name: "por_fecha_conclusion",
        keyPath: "Fecha_Conclusion",
        options: { unique: false },
      },
      {
        name: "por_mes_año_inicio",
        keyPath: "mes_año_inicio",
        options: { unique: false },
      },
      {
        name: "por_mes_año_conclusion",
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
        name: "por_fecha_inicio",
        keyPath: "Fecha_Inicio",
        options: { unique: false },
      },
      {
        name: "por_fecha_conclusion",
        keyPath: "Fecha_Conclusion",
        options: { unique: false },
      },
    ],
  },

  // ✅ AGREGADO: Códigos OTP
  codigos_otp: {
    keyPath: "Id_Codigo_OTP",
    autoIncrement: true,
    indexes: [
      {
        name: "por_correo_destino",
        keyPath: "Correo_Destino",
        options: { unique: false },
      },
      {
        name: "por_rol_usuario",
        keyPath: "Rol_Usuario",
        options: { unique: false },
      },
      {
        name: "por_id_usuario",
        keyPath: "Id_Usuario",
        options: { unique: false },
      },
      { name: "por_codigo", keyPath: "Codigo", options: { unique: false } },
      {
        name: "por_fecha_creacion",
        keyPath: "Fecha_Creacion",
        options: { unique: false },
      },
      {
        name: "por_fecha_expiracion",
        keyPath: "Fecha_Expiracion",
        options: { unique: false },
      },
      {
        name: "por_correo_codigo",
        keyPath: ["Correo_Destino", "Codigo"],
        options: { unique: false },
      },
    ],
  },

  registro_fallos_sistema: {
    keyPath: "Id_Registro_Fallo_Sistema",
    autoIncrement: true,
    indexes: [
      { name: "por_fecha", keyPath: "Fecha", options: { unique: false } },
      {
        name: "por_componente",
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
        name: "por_operacion",
        keyPath: "Operacion",
        options: { unique: false },
      },
      {
        name: "por_fecha",
        keyPath: "Fecha_Modificacion",
        options: { unique: false },
      },
      {
        name: "por_usuario",
        keyPath: "Usuario_Modificacion",
        options: { unique: false },
      },
    ],
  },

  fechas_importantes: {
    keyPath: "Id_Fecha_Importante",
    autoIncrement: true,
    indexes: [
      { name: "por_nombre", keyPath: "Nombre", options: { unique: true } },
      { name: "por_valor", keyPath: "Valor", options: { unique: false } },
      {
        name: "por_ultima_modificacion",
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
        name: "por_fecha_inicio",
        keyPath: "Fecha_Inicio",
        options: { unique: false },
      },
      {
        name: "por_fecha_conclusion",
        keyPath: "Fecha_Conclusion",
        options: { unique: false },
      },
      {
        name: "por_rango_fechas",
        keyPath: ["Fecha_Inicio", "Fecha_Conclusion"],
        options: { unique: false },
      },
    ],
  },

  // ========================================
  // STORES LOCALES Y CACHE
  // ========================================

  ultima_actualizacion_tablas_locales: {
    keyPath: "Nombre_Tabla",
    autoIncrement: false,
    indexes: [
      {
        name: "por_operacion",
        keyPath: "Operacion",
        options: { unique: false },
      },
      {
        name: "por_fecha",
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
        name: "por_created_at",
        keyPath: "created_at",
        options: { unique: false },
      },
      { name: "por_attempts", keyPath: "attempts", options: { unique: false } },
    ],
  },

  system_meta: {
    keyPath: "key",
    autoIncrement: false,
    indexes: [],
  },

  // Cache de asistencias consultadas desde Redis
  asistencias_tomadas_hoy: {
    keyPath: "clave",
    autoIncrement: false,
    indexes: [
      {
        name: "por_identificador",
        keyPath: "identificador",
        options: { unique: false },
      },
      { name: "por_fecha", keyPath: "fecha", options: { unique: false } },
      { name: "por_actor", keyPath: "actor", options: { unique: false } },
      {
        name: "por_modo_registro",
        keyPath: "modoRegistro",
        options: { unique: false },
      },
      {
        name: "por_tipo_asistencia",
        keyPath: "tipoAsistencia",
        options: { unique: false },
      },
      {
        name: "por_timestamp_consulta",
        keyPath: "timestampConsulta",
        options: { unique: false },
      },
      {
        name: "por_identificador_modo",
        keyPath: ["identificador", "modoRegistro"],
        options: { unique: false },
      },
      {
        name: "por_actor_tipo",
        keyPath: ["actor", "tipoAsistencia"],
        options: { unique: false },
      },
      {
        name: "por_fecha_identificador",
        keyPath: ["fecha", "identificador"],
        options: { unique: false },
      },
    ],
  },

  usuarios_genericos_cache: {
    keyPath: "clave_busqueda",
    autoIncrement: false,
    indexes: [
      { name: "por_rol", keyPath: "rol", options: { unique: false } },
      { name: "por_criterio", keyPath: "criterio", options: { unique: false } },
      { name: "por_limite", keyPath: "limite", options: { unique: false } },
      {
        name: "por_ultima_actualizacion",
        keyPath: "ultima_actualizacion",
        options: { unique: false },
      },
      {
        name: "por_rol_criterio",
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
        name: "por_estudiante",
        keyPath: "Id_Estudiante",
        options: { unique: false },
      },
      {
        name: "por_tipo_asistencia",
        keyPath: "TipoAsistencia",
        options: { unique: false },
      },
      {
        name: "por_desfase_segundos",
        keyPath: "DesfaseSegundos",
        options: { unique: false },
      },
      {
        name: "por_estudiante_tipo",
        keyPath: ["Id_Estudiante", "TipoAsistencia"],
        options: { unique: false },
      },
      {
        name: "por_tipo_desfase",
        keyPath: ["TipoAsistencia", "DesfaseSegundos"],
        options: { unique: false },
      },
    ],
  },
};
