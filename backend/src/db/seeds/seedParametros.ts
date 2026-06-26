import { db } from "../../db/index.js";
import { parametros } from "../../db/schema.js";
import { and, eq, sql } from "drizzle-orm";

// ============================================================================
// PARÁMETROS CON IDs EXPLÍCITOS Y ESTABLES
// ----------------------------------------------------------------------------
// Fuente de verdad del mapeo id ↔ código. Los ids NO dependen del orden de las
// llamadas: cada parámetro tiene su id fijo, igual que seedCategorias.ts. Así,
// sobre una base limpia el seed produce SIEMPRE los mismos ids, y agregar uno
// nuevo (con un id > 185) jamás corre ni pisa el significado de los existentes.
//
// Reglas:
//  - Para agregar un parámetro: usá el próximo id libre (máximo actual + 1).
//  - NUNCA reasignes un id ya usado ni cambies el id de un código existente:
//    hay datos (honorarios.politica_jus_id, etc.) que apuntan a estos ids.
//  - El upsert matchea por (categoriaId, codigo); el id solo se usa al insertar.
// ============================================================================

type ParamSeed = {
  id: number;
  categoriaId: number;
  codigo: string;
  nombre: string;
  orden: number;
  parentId: number | null;
  activo?: boolean;
};

const PARAMETROS: ParamSeed[] = [
  // RAMA_DERECHO (categoría 1)
  { id: 1, categoriaId: 1, codigo: 'ADMINISTRATIVO', nombre: 'Administrativo', orden: 1, parentId: null },
  { id: 2, categoriaId: 1, codigo: 'CIRCUITO', nombre: 'Circuito', orden: 2, parentId: null },
  { id: 3, categoriaId: 1, codigo: 'CIVIL_COMERCIAL', nombre: 'Civil y Comercial', orden: 3, parentId: null },
  { id: 4, categoriaId: 1, codigo: 'FAMILIA', nombre: 'Familia', orden: 4, parentId: null },
  { id: 5, categoriaId: 1, codigo: 'LABORAL', nombre: 'Laboral', orden: 5, parentId: null },
  { id: 6, categoriaId: 1, codigo: 'PENAL', nombre: 'Penal', orden: 6, parentId: null },
  { id: 7, categoriaId: 1, codigo: 'PREVISIONAL', nombre: 'Previsional', orden: 7, parentId: null },
  { id: 8, categoriaId: 1, codigo: 'SUCESIONES', nombre: 'Sucesiones', orden: 8, parentId: null },

  // TIPO_CASO (categoría 2)
  { id: 9, categoriaId: 2, codigo: 'ADOPCION', nombre: 'Adopción', orden: 1, parentId: 4 },
  { id: 10, categoriaId: 2, codigo: 'ALIMENTOS', nombre: 'Alimentos', orden: 2, parentId: 4 },
  { id: 11, categoriaId: 2, codigo: 'DIVORCIO', nombre: 'Divorcio', orden: 3, parentId: 4 },
  { id: 12, categoriaId: 2, codigo: 'FILIACION', nombre: 'Filiación', orden: 4, parentId: 4 },
  { id: 13, categoriaId: 2, codigo: 'REGIMEN_DE_VISITAS', nombre: 'Régimen de visitas', orden: 5, parentId: 4 },
  { id: 14, categoriaId: 2, codigo: 'TENENCIA_CUIDADO_PERSONAL', nombre: 'Tenencia / cuidado personal', orden: 6, parentId: 4 },
  { id: 15, categoriaId: 2, codigo: 'COBRO_EJECUTIVO', nombre: 'Cobro ejecutivo', orden: 7, parentId: 3 },
  { id: 16, categoriaId: 2, codigo: 'CONCURSO_PREVENTIVO', nombre: 'Concurso preventivo', orden: 8, parentId: 3 },
  { id: 17, categoriaId: 2, codigo: 'DAÑOS_Y_PERJUICIOS', nombre: 'Daños y perjuicios', orden: 9, parentId: 3 },
  { id: 18, categoriaId: 2, codigo: 'DESALOJO', nombre: 'Desalojo', orden: 10, parentId: 3 },
  { id: 19, categoriaId: 2, codigo: 'INCUMPLIMIENTO_CONTRACTUAL', nombre: 'Incumplimiento contractual', orden: 11, parentId: 3 },
  { id: 20, categoriaId: 2, codigo: 'JUICIO_EJECUTIVO', nombre: 'Juicio ejecutivo', orden: 12, parentId: 3 },
  { id: 21, categoriaId: 2, codigo: 'JUICIO_ORDINARIO_COMERCIAL', nombre: 'Juicio ordinario comercial', orden: 13, parentId: 3 },
  { id: 22, categoriaId: 2, codigo: 'QUIEBRA', nombre: 'Quiebra', orden: 14, parentId: 3 },
  { id: 23, categoriaId: 2, codigo: 'REIVINDICACION', nombre: 'Reivindicación', orden: 15, parentId: 3 },
  { id: 24, categoriaId: 2, codigo: 'RESPONSABILIDAD_CIVIL', nombre: 'Responsabilidad civil', orden: 16, parentId: 3 },
  { id: 25, categoriaId: 2, codigo: 'USUCAPION', nombre: 'Usucapión', orden: 17, parentId: 3 },
  { id: 26, categoriaId: 2, codigo: 'ACCIDENTE_DE_TRABAJO', nombre: 'Accidente de trabajo', orden: 18, parentId: 5 },
  { id: 27, categoriaId: 2, codigo: 'DESPIDO', nombre: 'Despido', orden: 19, parentId: 5 },
  { id: 28, categoriaId: 2, codigo: 'DIFERENCIAS_SALARIALES', nombre: 'Diferencias salariales', orden: 20, parentId: 5 },
  { id: 29, categoriaId: 2, codigo: 'REINSTALACION', nombre: 'Reinstalación', orden: 21, parentId: 5 },
  { id: 30, categoriaId: 2, codigo: 'TRABAJO_NO_REGISTRADO', nombre: 'Trabajo no registrado', orden: 22, parentId: 5 },
  { id: 31, categoriaId: 2, codigo: 'ABUSO_SEXUAL', nombre: 'Abuso sexual', orden: 23, parentId: 6 },
  { id: 32, categoriaId: 2, codigo: 'ESTAFA', nombre: 'Estafa', orden: 24, parentId: 6 },
  { id: 33, categoriaId: 2, codigo: 'HURTO_ROBO', nombre: 'Hurto / Robo', orden: 25, parentId: 6 },
  { id: 34, categoriaId: 2, codigo: 'LESIONES', nombre: 'Lesiones', orden: 26, parentId: 6 },
  { id: 35, categoriaId: 2, codigo: 'VIOLENCIA_DE_GENERO', nombre: 'Violencia de género', orden: 27, parentId: 6 },
  { id: 36, categoriaId: 2, codigo: 'SUCESION_SIMPLE', nombre: 'Sucesión simple', orden: 28, parentId: 8 },
  { id: 37, categoriaId: 2, codigo: 'SUCESION_TESTAMENTARIA', nombre: 'Sucesión testamentaria', orden: 29, parentId: 8 },
  { id: 38, categoriaId: 2, codigo: 'AMPARO', nombre: 'Amparo', orden: 30, parentId: 1 },
  { id: 39, categoriaId: 2, codigo: 'HABEAS_CORPUS', nombre: 'Habeas corpus', orden: 31, parentId: 1 },
  { id: 40, categoriaId: 2, codigo: 'HABEAS_DATA', nombre: 'Habeas data', orden: 32, parentId: 1 },
  { id: 41, categoriaId: 2, codigo: 'RECURSO_DE_RECONSIDERACION', nombre: 'Recurso de reconsideración', orden: 33, parentId: 1 },
  { id: 42, categoriaId: 2, codigo: 'JUBILACION', nombre: 'Jubilación', orden: 34, parentId: 7 },
  { id: 43, categoriaId: 2, codigo: 'PENSION', nombre: 'Pensión', orden: 35, parentId: 7 },
  { id: 44, categoriaId: 2, codigo: 'REAJUSTE', nombre: 'Reajuste', orden: 36, parentId: 7 },
  { id: 45, categoriaId: 2, codigo: 'DAÑOS_Y_PERJUICIOS_DESALOJO', nombre: 'Daños y perjuicios', orden: 37, parentId: 2 },
  { id: 46, categoriaId: 2, codigo: 'DESALOJO_RADICACION', nombre: 'Desalojo', orden: 38, parentId: 2 },
  { id: 47, categoriaId: 2, codigo: 'INSCRIPCION_DE_SUBASTA', nombre: 'Inscripción de subasta', orden: 39, parentId: 2 },
  { id: 48, categoriaId: 2, codigo: 'PRESCRIPCION_ADQUISITIVA', nombre: 'Prescripción adquisitiva', orden: 40, parentId: 2 },

  // ESTADO_CASO (categoría 3)
  { id: 49, categoriaId: 3, codigo: 'APELADO', nombre: 'Apelado', orden: 1, parentId: null },
  { id: 50, categoriaId: 3, codigo: 'ARCHIVADO', nombre: 'Archivado', orden: 2, parentId: null },
  { id: 51, categoriaId: 3, codigo: 'CON_RESOLUCION_FIRME', nombre: 'Con resolución firme', orden: 3, parentId: null },
  { id: 52, categoriaId: 3, codigo: 'CON_SENTENCIA', nombre: 'Con sentencia', orden: 4, parentId: null },
  { id: 53, categoriaId: 3, codigo: 'EJECUTANDO_SENTENCIA', nombre: 'Ejecutando sentencia', orden: 5, parentId: null },
  { id: 54, categoriaId: 3, codigo: 'EN_ESTUDIO', nombre: 'En estudio', orden: 6, parentId: null },
  { id: 55, categoriaId: 3, codigo: 'EN_TRAMITE', nombre: 'En trámite', orden: 7, parentId: null },
  { id: 56, categoriaId: 3, codigo: 'FINALIZADO', nombre: 'Finalizado', orden: 8, parentId: null },
  { id: 57, categoriaId: 3, codigo: 'EN_MEDIACION', nombre: 'En mediación', orden: 9, parentId: null },
  { id: 58, categoriaId: 3, codigo: 'PARA_SENTENCIA', nombre: 'Para sentencia', orden: 10, parentId: null },
  { id: 59, categoriaId: 3, codigo: 'PARALIZADO', nombre: 'Paralizado', orden: 11, parentId: null },

  // ESTADO_RADICACION (categoría 4)
  { id: 60, categoriaId: 4, codigo: 'ARCHIVADO_POR_JUZGADO', nombre: 'Archivado por juzgado', orden: 1, parentId: null },
  { id: 61, categoriaId: 4, codigo: 'CERRADO_POR_RESOLUCION', nombre: 'Cerrado por resolución', orden: 2, parentId: null },
  { id: 62, categoriaId: 4, codigo: 'CON_COMPETENCIA_DECLINADA', nombre: 'Con competencia declinada', orden: 3, parentId: null },
  { id: 63, categoriaId: 4, codigo: 'EN_CAMARA', nombre: 'En cámara', orden: 4, parentId: null },
  { id: 64, categoriaId: 4, codigo: 'PENDIENTE_DE_SORTEO', nombre: 'Pendiente de sorteo', orden: 5, parentId: null },
  { id: 65, categoriaId: 4, codigo: 'RADICADO_EN_JUZGADO', nombre: 'Radicado en juzgado', orden: 6, parentId: null },
  { id: 66, categoriaId: 4, codigo: 'REMITIDO_A_OTRA_JURISDICCION', nombre: 'Remitido a otra jurisdicción', orden: 7, parentId: null },
  { id: 67, categoriaId: 4, codigo: 'EN_CORTE_SUPREMA', nombre: 'En Corte Suprema', orden: 8, parentId: null },
  { id: 68, categoriaId: 4, codigo: 'EN_FISCALIA', nombre: 'En Fiscalía', orden: 9, parentId: null },

  // TIPO_EVENTO (categoría 5)
  { id: 69, categoriaId: 5, codigo: 'APELACION', nombre: 'Apelación', orden: 1, parentId: null },
  { id: 70, categoriaId: 5, codigo: 'ARCHIVO_DEL_EXPEDIENTE', nombre: 'Archivo del expediente', orden: 2, parentId: null },
  { id: 71, categoriaId: 5, codigo: 'AUDIENCIA', nombre: 'Audiencia', orden: 3, parentId: null },
  { id: 72, categoriaId: 5, codigo: 'NOTIFICACION', nombre: 'Notificación', orden: 4, parentId: null },
  { id: 73, categoriaId: 5, codigo: 'OFRECIMIENTO_DE_PRUEBA', nombre: 'Ofrecimiento de prueba', orden: 5, parentId: null },
  { id: 74, categoriaId: 5, codigo: 'OTRO', nombre: 'Otro', orden: 6, parentId: null },
  { id: 75, categoriaId: 5, codigo: 'PAGO', nombre: 'Pago', orden: 7, parentId: null },
  { id: 76, categoriaId: 5, codigo: 'PRESENTACION_DE_ESCRITO', nombre: 'Presentación de escrito', orden: 8, parentId: null },
  { id: 77, categoriaId: 5, codigo: 'PRODUCCION_DE_PRUEBA', nombre: 'Producción de prueba', orden: 9, parentId: null },
  { id: 78, categoriaId: 5, codigo: 'SENTENCIA', nombre: 'Sentencia', orden: 10, parentId: null },
  { id: 79, categoriaId: 5, codigo: 'VENCIMIENTO', nombre: 'Vencimiento', orden: 11, parentId: null },
  { id: 80, categoriaId: 5, codigo: 'VISTA_AL_ACTOR_DEMANDADO', nombre: 'Vista al actor/demandado', orden: 12, parentId: null },
  { id: 81, categoriaId: 5, codigo: 'REUNION_CLIENTE', nombre: 'Reunión con Cliente', orden: 13, parentId: null },
  { id: 82, categoriaId: 5, codigo: 'MEDIACION', nombre: 'Mediación', orden: 14, parentId: null },
  { id: 83, categoriaId: 5, codigo: 'DILIGENCIA', nombre: 'Diligencia / Procuración', orden: 15, parentId: null },
  { id: 84, categoriaId: 5, codigo: 'PERICIA', nombre: 'Examen / Operación Pericial', orden: 16, parentId: null },

  // ESTADO_EVENTO (categoría 6)
  { id: 85, categoriaId: 6, codigo: 'CANCELADO', nombre: 'Cancelado', orden: 1, parentId: null },
  { id: 86, categoriaId: 6, codigo: 'EN_SEGUIMIENTO', nombre: 'En seguimiento', orden: 2, parentId: null },
  { id: 87, categoriaId: 6, codigo: 'INCUMPLIDO', nombre: 'Incumplido', orden: 3, parentId: null },
  { id: 88, categoriaId: 6, codigo: 'PENDIENTE', nombre: 'Pendiente', orden: 4, parentId: null },
  { id: 89, categoriaId: 6, codigo: 'REALIZADO', nombre: 'Realizado', orden: 5, parentId: null },
  { id: 90, categoriaId: 6, codigo: 'REPROGRAMADO', nombre: 'Reprogramado', orden: 6, parentId: null },
  { id: 91, categoriaId: 6, codigo: 'SUSPENDIDO', nombre: 'Suspendido', orden: 7, parentId: null },

  // PRIORIDAD (categoría 7)
  { id: 92, categoriaId: 7, codigo: 'CRITICA', nombre: 'Crítica', orden: 1, parentId: null },
  { id: 93, categoriaId: 7, codigo: 'ALTA', nombre: 'Alta', orden: 2, parentId: null },
  { id: 94, categoriaId: 7, codigo: 'MEDIA', nombre: 'Media', orden: 3, parentId: null },
  { id: 95, categoriaId: 7, codigo: 'BAJA', nombre: 'Baja', orden: 4, parentId: null },
  { id: 96, categoriaId: 7, codigo: 'SIN_PRIORIDAD', nombre: 'Sin prioridad', orden: 5, parentId: null },

  // LOCALIDAD_RADICACION (categoría 9)
  { id: 97, categoriaId: 9, codigo: 'ROSARIO', nombre: 'Rosario', orden: 1, parentId: null },
  { id: 98, categoriaId: 9, codigo: 'SAN_LORENZO', nombre: 'San Lorenzo', orden: 2, parentId: null },
  { id: 99, categoriaId: 9, codigo: 'SANTA_FE', nombre: 'Santa Fé', orden: 3, parentId: null },
  { id: 100, categoriaId: 9, codigo: 'CAÑADA_DE_GOMEZ', nombre: 'Cañada de Gomez', orden: 4, parentId: null },

  // RADICACION (categoría 8)
  { id: 101, categoriaId: 8, codigo: 'JUZGADO_CIVIL_Y_COMERCIAL_N1_ROS', nombre: 'Juzgado Civil y Comercial N°1', orden: 1, parentId: 97 },
  { id: 102, categoriaId: 8, codigo: 'JUZGADO_CIVIL_Y_COMERCIAL_N2_ROS', nombre: 'Juzgado Civil y Comercial N°2', orden: 2, parentId: 97 },
  { id: 103, categoriaId: 8, codigo: 'JUZGADO_DE_FAMILIA_N3_ROS', nombre: 'Juzgado de Familia N°3', orden: 3, parentId: 97 },
  { id: 104, categoriaId: 8, codigo: 'JUZGADO_PENAL_N1_ROS', nombre: 'Juzgado Penal N°1', orden: 4, parentId: 97 },
  { id: 105, categoriaId: 8, codigo: 'CAMARA_DE_APELACIONES_EN_LO_CIVIL_ROS', nombre: 'Cámara de Apelaciones en lo Civil', orden: 5, parentId: 97 },
  { id: 106, categoriaId: 8, codigo: 'JUZGADO_LABORAL_N1_ROS', nombre: 'Juzgado Laboral N°1', orden: 6, parentId: 97 },
  { id: 107, categoriaId: 8, codigo: 'JUZGADO_LABORAL_N2_ROS', nombre: 'Juzgado Laboral N°2', orden: 7, parentId: 97 },
  { id: 108, categoriaId: 8, codigo: 'JUZGADO_FEDERAL_N1_ROS', nombre: 'Juzgado Federal N°1', orden: 8, parentId: 97 },
  { id: 109, categoriaId: 8, codigo: 'TRIBUNAL_COLEGIADO_DE_FAMILIA_N5_ROS', nombre: 'Tribunal Colegiado de Familia N°5', orden: 9, parentId: 97 },
  { id: 110, categoriaId: 8, codigo: 'JUZGADO_CIVIL_Y_COMERCIAL_N1_SL', nombre: 'Juzgado Civil y Comercial N°1', orden: 10, parentId: 98 },
  { id: 111, categoriaId: 8, codigo: 'JUZGADO_DE_FAMILIA_SL', nombre: 'Juzgado de Familia', orden: 11, parentId: 98 },
  { id: 112, categoriaId: 8, codigo: 'JUZGADO_LABORAL_SL', nombre: 'Juzgado Laboral', orden: 12, parentId: 98 },
  { id: 113, categoriaId: 8, codigo: 'JUZGADO_PENAL_SL', nombre: 'Juzgado Penal', orden: 13, parentId: 98 },
  { id: 114, categoriaId: 8, codigo: 'JUZGADO_DE_MENORES_SL', nombre: 'Juzgado de Menores', orden: 14, parentId: 98 },
  { id: 115, categoriaId: 8, codigo: 'FISCALIA_REGIONAL_SL', nombre: 'Fiscalía Regional', orden: 15, parentId: 98 },
  { id: 116, categoriaId: 8, codigo: 'TRIBUNAL_COLEGIADO_DE_FAMILIA_SL', nombre: 'Tribunal Colegiado de Familia', orden: 16, parentId: 98 },
  { id: 117, categoriaId: 8, codigo: 'JUZGADO_DE_CIRCUITO_SL', nombre: 'Juzgado de Circuito', orden: 17, parentId: 98 },
  { id: 118, categoriaId: 8, codigo: 'JUZGADO_CIVIL_Y_COMERCIAL_N1_SF', nombre: 'Juzgado Civil y Comercial N°1', orden: 18, parentId: 99 },
  { id: 119, categoriaId: 8, codigo: 'JUZGADO_CIVIL_Y_COMERCIAL_N2_SF', nombre: 'Juzgado Civil y Comercial N°2', orden: 19, parentId: 99 },
  { id: 120, categoriaId: 8, codigo: 'JUZGADO_LABORAL_N1_SF', nombre: 'Juzgado Laboral N°1', orden: 20, parentId: 99 },
  { id: 121, categoriaId: 8, codigo: 'JUZGADO_DE_FAMILIA_SF', nombre: 'Juzgado de Familia', orden: 21, parentId: 99 },
  { id: 122, categoriaId: 8, codigo: 'JUZGADO_PENAL_DE_INSTRUCCION_SF', nombre: 'Juzgado Penal de Instrucción', orden: 22, parentId: 99 },
  { id: 123, categoriaId: 8, codigo: 'FISCALIA_GENERAL_SF', nombre: 'Fiscalía General', orden: 23, parentId: 99 },
  { id: 124, categoriaId: 8, codigo: 'CAMARA_DE_APELACIONES_EN_LO_CIVIL_Y_COMERCIAL_SF', nombre: 'Cámara de Apelaciones en lo Civil y Comercial', orden: 24, parentId: 99 },
  { id: 125, categoriaId: 8, codigo: 'TRIBUNAL_COLEGIADO_DE_FAMILIA_SF', nombre: 'Tribunal Colegiado de Familia', orden: 25, parentId: 99 },
  { id: 126, categoriaId: 8, codigo: 'JUZGADO_FEDERAL_N1_SF', nombre: 'Juzgado Federal N°1', orden: 26, parentId: 99 },
  { id: 127, categoriaId: 8, codigo: 'JUZGADO_DE_FAMILIA_CG', nombre: 'Juzgado de Familia', orden: 27, parentId: 100 },
  { id: 128, categoriaId: 8, codigo: 'JUZGADO_DE_CIRCUITO_CG', nombre: 'Juzgado de Circuito', orden: 28, parentId: 100 },

  // CONCEPTO_HONORARIO (categoría 10)
  { id: 129, categoriaId: 10, codigo: 'HONORARIOS_REGULADOS', nombre: 'Honorarios regulados', orden: 1, parentId: null },
  { id: 130, categoriaId: 10, codigo: 'HONORARIOS_PACTADOS', nombre: 'Honorarios pactados', orden: 2, parentId: null },
  { id: 131, categoriaId: 10, codigo: 'CAJA_FORENSE', nombre: 'Caja forense', orden: 3, parentId: null },
  { id: 132, categoriaId: 10, codigo: 'CAJA_DE_SEGURIDAD_SOCIAL', nombre: 'Caja de seguridad Social', orden: 4, parentId: null },
  { id: 133, categoriaId: 10, codigo: 'CONSULTA_JURIDICA', nombre: 'Consulta jurídica / Asesoramiento', orden: 5, parentId: null },

  // PARTES (categoría 11)
  { id: 134, categoriaId: 11, codigo: 'CLIENTE', nombre: 'Cliente', orden: 1, parentId: null },
  { id: 135, categoriaId: 11, codigo: 'CONTRAPARTE', nombre: 'Contraparte', orden: 2, parentId: null },

  // CONCEPTO_GASTO (categoría 12)
  { id: 136, categoriaId: 12, codigo: 'CEDULA_DE_NOTIFICACION', nombre: 'Cédula de notificación', orden: 1, parentId: null },
  { id: 137, categoriaId: 12, codigo: 'SELLADOS', nombre: 'Sellados', orden: 2, parentId: null },
  { id: 138, categoriaId: 12, codigo: 'SOLICITUD_DE_INFORMES', nombre: 'Solicitud de informes', orden: 3, parentId: null },
  { id: 139, categoriaId: 12, codigo: 'VIATICOS', nombre: 'Viáticos', orden: 4, parentId: null },
  { id: 140, categoriaId: 12, codigo: 'CARTA_DOCUMENTO', nombre: 'Carta Documento', orden: 5, parentId: null },
  { id: 141, categoriaId: 12, codigo: 'TASA_JUSTICIA', nombre: 'Tasa de Justicia', orden: 6, parentId: null },
  { id: 142, categoriaId: 12, codigo: 'APORTES_ESTAMPILLAS', nombre: 'Aportes / Estampillas colegiales', orden: 7, parentId: null },

  // TIPO_PERSONA (categoría 17)
  { id: 143, categoriaId: 17, codigo: 'PERSONA_FISICA', nombre: 'Persona Fisica', orden: 1, parentId: null },
  { id: 144, categoriaId: 17, codigo: 'PERSONA_JURIDICA', nombre: 'Persona Juridica', orden: 2, parentId: null },

  // CONCEPTO_INGRESO (categoría 13)
  { id: 145, categoriaId: 13, codigo: 'ADELANTO_DE_GASTOS', nombre: 'Adelanto de gastos', orden: 1, parentId: null },
  { id: 146, categoriaId: 13, codigo: 'PAGO_DE_HONORARIOS', nombre: 'Pago de honorarios', orden: 2, parentId: null },
  { id: 147, categoriaId: 13, codigo: 'PAGO_POR_CONSULTA', nombre: 'Pago por consulta', orden: 3, parentId: null },
  { id: 148, categoriaId: 13, codigo: 'REINTEGRO_DE_GASTO', nombre: 'Reintegro de gasto', orden: 4, parentId: null },

  // MONEDA (categoría 14)
  { id: 149, categoriaId: 14, codigo: 'ARS', nombre: 'Peso', orden: 1, parentId: null },
  { id: 150, categoriaId: 14, codigo: 'USD', nombre: 'Dólar', orden: 2, parentId: null, activo: false },
  { id: 151, categoriaId: 14, codigo: 'EUR', nombre: 'Euro', orden: 3, parentId: null, activo: false },
  { id: 152, categoriaId: 14, codigo: 'JUS', nombre: 'JUS', orden: 4, parentId: null },

  // ESTADO_INGRESO (categoría 15)
  { id: 153, categoriaId: 15, codigo: 'PENDIENTE', nombre: 'Pendiente', orden: 1, parentId: null },
  { id: 154, categoriaId: 15, codigo: 'CONFIRMADO', nombre: 'Confirmado', orden: 2, parentId: null },
  { id: 155, categoriaId: 15, codigo: 'ANULADO', nombre: 'Anulado', orden: 3, parentId: null },

  // ESTADO_HONORARIO (categoría 16)
  { id: 156, categoriaId: 16, codigo: 'PENDIENTE', nombre: 'Pendiente', orden: 1, parentId: null },
  { id: 157, categoriaId: 16, codigo: 'ANULADO', nombre: 'Anulado', orden: 2, parentId: null },
  { id: 158, categoriaId: 16, codigo: 'INCOBRABLE', nombre: 'Incobrable', orden: 3, parentId: null },
  { id: 159, categoriaId: 16, codigo: 'PARCIAL', nombre: 'Parcial', orden: 4, parentId: null },
  { id: 160, categoriaId: 16, codigo: 'COBRADO', nombre: 'Cobrado', orden: 5, parentId: null },

  // PERIODICIDAD (categoría 18)
  { id: 161, categoriaId: 18, codigo: 'SEMANAL', nombre: 'Semanal (7 días)', orden: 1, parentId: null },
  { id: 162, categoriaId: 18, codigo: 'QUINCENAL', nombre: 'Quincenal (15 días)', orden: 2, parentId: null },
  { id: 163, categoriaId: 18, codigo: 'MENSUAL', nombre: 'Mensual (30 días)', orden: 3, parentId: null },
  { id: 164, categoriaId: 18, codigo: 'PERSONALIZADA', nombre: 'Personalizada...', orden: 4, parentId: null },

  // ESTADO_CUOTA (categoría 19)
  { id: 165, categoriaId: 19, codigo: 'PENDIENTE', nombre: 'Pendiente', orden: 1, parentId: null },
  { id: 166, categoriaId: 19, codigo: 'PAGADA', nombre: 'Pagada', orden: 2, parentId: null },
  { id: 167, categoriaId: 19, codigo: 'VENCIDA', nombre: 'Vencida', orden: 3, parentId: null },
  { id: 168, categoriaId: 19, codigo: 'CONDONADA', nombre: 'Condonada', orden: 4, parentId: null },
  { id: 169, categoriaId: 19, codigo: 'PARCIAL', nombre: 'Parcial', orden: 5, parentId: null },

  // POLITICA_JUS (categoría 20)
  { id: 170, categoriaId: 20, codigo: 'FECHA_REGULACION', nombre: 'A Fecha Regulación', orden: 1, parentId: null },
  { id: 171, categoriaId: 20, codigo: 'AL_COBRO', nombre: 'Al Cobro', orden: 2, parentId: null },

  // ROL_PARTICIPANTE (categoría 21)
  { id: 172, categoriaId: 21, codigo: 'ACTOR', nombre: 'Actor', orden: 1, parentId: null },
  { id: 173, categoriaId: 21, codigo: 'DEMANDADO', nombre: 'Demandado', orden: 2, parentId: null },
  { id: 174, categoriaId: 21, codigo: 'CO_ACTOR', nombre: 'Co-Actor', orden: 3, parentId: null },
  { id: 175, categoriaId: 21, codigo: 'CO_DEMANDADO', nombre: 'Co-Demandado', orden: 4, parentId: null },
  { id: 176, categoriaId: 21, codigo: 'CITADO_EN_GARANTIA', nombre: 'Citado en Garantía', orden: 5, parentId: null },
  { id: 177, categoriaId: 21, codigo: 'TERCERO', nombre: 'Tercero', orden: 6, parentId: null },
  { id: 178, categoriaId: 21, codigo: 'FISCAL', nombre: 'Fiscal', orden: 7, parentId: null },
  { id: 179, categoriaId: 21, codigo: 'DEFENSOR', nombre: 'Defensor', orden: 8, parentId: null },
  { id: 180, categoriaId: 21, codigo: 'ABOGADO_CONTRAPARTE', nombre: 'Abogado Contraparte', orden: 9, parentId: null },
  { id: 181, categoriaId: 21, codigo: 'MEDIADOR', nombre: 'Mediador', orden: 10, parentId: null },
  { id: 182, categoriaId: 21, codigo: 'PERITO', nombre: 'Perito', orden: 11, parentId: null },

  // ESTADO_GASTO (categoría 22)
  { id: 183, categoriaId: 22, codigo: 'PENDIENTE', nombre: 'Pendiente', orden: 1, parentId: null },
  { id: 184, categoriaId: 22, codigo: 'PAGADO', nombre: 'Pagado', orden: 2, parentId: null },
  { id: 185, categoriaId: 22, codigo: 'ANULADO', nombre: 'Anulado', orden: 3, parentId: null },
];

async function main() {
  console.log('📂 Iniciando seed de parámetros (ids explícitos)...');

  for (const p of PARAMETROS) {
    const [existing] = await db
      .select()
      .from(parametros)
      .where(and(eq(parametros.categoriaId, p.categoriaId), eq(parametros.codigo, p.codigo)))
      .limit(1);

    const activo = p.activo ?? true;

    if (!existing) {
      // Base limpia (o parámetro nuevo): insertar con id explícito.
      await db.insert(parametros).values({
        id: p.id,
        categoriaId: p.categoriaId,
        codigo: p.codigo,
        nombre: p.nombre,
        orden: p.orden,
        parentId: p.parentId,
        activo,
      });
    } else {
      // Ya existe (matcheado por código): actualizar metadatos, NUNCA el id ni el código.
      if (
        existing.nombre !== p.nombre ||
        existing.orden !== p.orden ||
        existing.parentId !== p.parentId ||
        existing.activo !== activo
      ) {
        await db
          .update(parametros)
          .set({ nombre: p.nombre, orden: p.orden, parentId: p.parentId, activo })
          .where(eq(parametros.id, existing.id));
      }
    }
  }

  console.log(`✅ ${PARAMETROS.length} parámetros sembrados.`);

  // Reajustar la secuencia para que futuros inserts (no-seed) no colisionen con los ids fijos.
  console.log('🔄 Reiniciando secuencia de ID de parametros...');
  await db.execute(
    sql`SELECT setval(pg_get_serial_sequence('parametros', 'id'), COALESCE((SELECT max(id) FROM parametros), 1));`,
  );

  console.log('🎉 Seed de parámetros completado exitosamente.');
}

main()
  .then(() => console.log('✅ Seed ejecutado exitosamente'))
  .catch((e) => {
    console.error('❌ Error en ejecución del Seed:', e);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
