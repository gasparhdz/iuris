import { db } from "./index.js";
import { 
  estudios, usuarios, usuarioRoles, parametros, clientes, contactosClientes, 
  terceros, casos, participantesCaso, notasCaso, tareas, subTareas, eventos, 
  honorarios, gastos, ingresos, valoresJus 
} from "./schema.js";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

// ==========================================
// ARRAYS DE DATOS SEMÁNTICOS PARA SIMULACIÓN
// ==========================================
const NOMBRES = ["Gaspar", "Nadir", "Juan", "Maria", "Carlos", "Ana", "Luis", "Sofia", "Diego", "Laura", "Pedro", "Elena", "Martin", "Clara", "Andres", "Lucia", "Gustavo", "Federico", "Patricia", "Florencia", "Agustin", "Valeria", "Mariana", "Javier"];
const APELLIDOS = ["Hernandez", "Meotto", "Gonzalez", "Rodriguez", "Gomez", "Fernandez", "Lopez", "Diaz", "Martinez", "Perez", "Romero", "Sosa", "Alvarez", "Ruiz", "Torres", "Ramirez", "Flores", "Benitez", "Medina", "Herrera", "Aguirre", "Gimenez"];
const RAZONES_SOCIALES = ["Transportes Del Norte S.A.", "Constructora Patria S.R.L.", "Alimentos Pampeanos S.A.", "Tecnología Global S.A.", "Servicios Integrales Meotto S.R.L.", "Agropecuaria Litoral S.A.", "Inmobiliaria del Plata S.A.", "Distribuidora Litoral S.R.L."];

const ESTUDIOS_MOCK = [
  { nombre: "Estudio Jurídico Alvear & Asociados", cuit: "30-71123456-9", dir: "Alvear 1240" },
  { nombre: "Asociación Legales del Litoral", cuit: "30-58432109-8", dir: "Pellegrini 380" },
  { nombre: "Consultora Del Plata & Asociados", cuit: "30-65498712-4", dir: "Cordoba 2050" },
  { nombre: "Defensa Penal Metropolitana", cuit: "30-74561239-5", dir: "San Martin 950" },
  { nombre: "Estudio de Familia & Sucesiones Rosario", cuit: "30-72314568-1", dir: "Urquiza 1845" }
];

const TASK_TITLES = [
  "Redactar contestación de demanda",
  "Ofrecer prueba documental",
  "Acompañar bonos y tasa de justicia",
  "Solicitar apertura a prueba",
  "Preparar pliego de posiciones",
  "Diligenciar oficio al Registro Propiedad",
  "Notificar cédula de traslado",
  "Revisar expediente digital",
  "Coordinar pericia con perito contador",
  "Apelar resolución de primera instancia",
  "Presentar alegatos de bien probado",
  "Solicitar traba de embargo preventivo",
  "Contactar testigos ofrecidos en demanda",
  "Acompañar comprobante de aportes previsionales",
  "Solicitar regulación de honorarios de parte"
];

const SUBTASK_TITLES = [
  "Revisar documentación aportada",
  "Escribir borrador preliminar",
  "Verificar plazos procesales",
  "Firmar digitalmente",
  "Subir al sistema del poder judicial"
];

const EVENT_TITLES = [
  { titulo: "Audiencia de Conciliación", desc: "Audiencia fijada para intentar conciliación entre las partes." },
  { titulo: "Audiencia de Vista de Causa", desc: "Audiencia de vista de causa presencial en el tribunal." },
  { titulo: "Reunión preliminar con el cliente", desc: "Reunión en el estudio para repasar detalles y estrategias." },
  { titulo: "Vencimiento para presentar alegatos", desc: "Plazo fatal para la presentación del escrito de alegatos." },
  { titulo: "Pericia médica en consultorio del Dr. Gomez", desc: "Asistencia al consultorio médico para pericia de incapacidad." },
  { titulo: "Audiencia testimonial de testigos de parte", desc: "Declaración de los testigos ofrecidos en la demanda." },
  { titulo: "Audiencia del Art. 360", desc: "Audiencia preliminar de fijación de hechos y proveído de pruebas." },
  { titulo: "Mediación prejudicial obligatoria", desc: "Primera audiencia de mediación ante mediador oficial." }
];

const NOTAS_EXPTE = [
  "Cliente trajo copias certificadas del contrato. Falta abonar la tasa de justicia.",
  "Se dejó nota en el juzgado para agilizar el proveído del escrito de apertura a prueba.",
  "Hablé con el abogado de la contraparte. Ofrece acuerdo extrajudicial por $800.000 en 3 cuotas.",
  "Se completó la notificación por cédula en el domicilio constituido de la demandada.",
  "Perito médico aceptó el cargo. Falta fijar fecha para el examen del actor.",
  "Se presentó el escrito de alegatos digitalmente dentro del plazo legal.",
  "Juez dictó sentencia de primera instancia haciendo lugar a la demanda en un 80%.",
  "Cliente pagó el saldo pendiente de gastos operativos. Registrar ingreso en ledger."
];

const CARATULAS_CIVIL = [
  " c/ Sancor Seguros s/ Daños y Perjuicios",
  " c/ Inmobiliaria del Plata s/ Desalojo",
  " c/ Banco del Litoral s/ Cobro Ejecutivo",
  " c/ Telecom Argentina s/ Incumplimiento de Contrato"
];

const CARATULAS_LABORAL = [
  " c/ Transportes Rosarinos s/ Despido Incausado",
  " c/ Metalúrgica Litoral s/ Accidente de Trabajo",
  " c/ Supermercados Unidos s/ Diferencias Salariales"
];

const CARATULAS_FAMILIA = [
  " s/ Divorcio Vincular",
  " c/ Alimentos y Régimen de Visitas",
  " c/ Filiación y Reclamación de Estado"
];

const CARATULAS_SUCESIONES = [
  " s/ Sucesorio Ab Intestato",
  " s/ Sucesión Testamentaria"
];

const CALLES = ["San Martin", "Belgrano", "Mitre", "Sarmiento", "Pellegrini", "Santa Fe", "Cordoba", "Urquiza", "Alvear", "Moreno", "España", "Italia", "San Lorenzo", "Dorriego"];

// ==========================================
// AYUDANTES Y UTILERÍAS
// ==========================================
function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomDate(daysFromNow: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date;
}

async function main() {
  console.log("🚀 Iniciando generación de datos simulados multi-tenant de alto volumen...");

  // 1. Borrar todas las tablas operativas de datos de prueba previos reseteando IDs a partir del ID 2
  // Dejamos intactas las tablas categorias, parametros, paises, provincias, localidades, codigos_postales y roles.
  // También mantenemos el Estudio 1, el Usuario 1 y el Vínculo de Rol 1 por consistencia.
  console.log("🧹 Vaciando tablas operativas multi-tenant (excluyendo maestro ID 1)...");
  await db.execute(sql`
    DELETE FROM refresh_tokens WHERE usuario_id > 1;
    DELETE FROM usuario_roles WHERE id > 1;
    DELETE FROM usuarios WHERE id > 1;
    DELETE FROM valores_jus WHERE id > 32; -- Mantenemos los del CSV inicial
    DELETE FROM plan_cuotas;
    DELETE FROM planes_pago;
    DELETE FROM ingresos;
    DELETE FROM gastos;
    DELETE FROM honorarios;
    DELETE FROM sub_tareas;
    DELETE FROM tareas;
    DELETE FROM eventos;
    DELETE FROM notas_caso;
    DELETE FROM notas_cliente;
    DELETE FROM participantes_caso;
    DELETE FROM casos;
    DELETE FROM contactos_clientes;
    DELETE FROM clientes;
    DELETE FROM terceros;
    DELETE FROM estudios WHERE id > 1;
  `);
  console.log("✓ Tablas limpias de registros simulados previos.");

  // 2. Cargar catálogos y parámetros dinámicamente desde la base de datos
  const tipoPersonaParams = await db.select().from(parametros).where(eq(parametros.categoriaId, 17));
  const fisicaParam = tipoPersonaParams.find(p => p.codigo === "PERSONA_FISICA")!;
  const juridicaParam = tipoPersonaParams.find(p => p.codigo === "PERSONA_JURIDICA")!;

  const tipoCasoParams = await db.select().from(parametros).where(eq(parametros.categoriaId, 2));
  const estadoCasoParams = await db.select().from(parametros).where(eq(parametros.categoriaId, 3));
  const estadoRadicacionParams = await db.select().from(parametros).where(eq(parametros.categoriaId, 4));
  const tipoEventoParams = await db.select().from(parametros).where(eq(parametros.categoriaId, 5));
  const estadoEventoParams = await db.select().from(parametros).where(eq(parametros.categoriaId, 6));
  const prioridadParams = await db.select().from(parametros).where(eq(parametros.categoriaId, 7));
  const radicacionParams = await db.select().from(parametros).where(eq(parametros.categoriaId, 8));
  const conceptoHonorarioParams = await db.select().from(parametros).where(eq(parametros.categoriaId, 10));
  const partesParams = await db.select().from(parametros).where(eq(parametros.categoriaId, 11));
  const conceptoGastoParams = await db.select().from(parametros).where(eq(parametros.categoriaId, 12));
  const conceptoIngresoParams = await db.select().from(parametros).where(eq(parametros.categoriaId, 13));
  const monedaParams = await db.select().from(parametros).where(eq(parametros.categoriaId, 14));
  const rolParticipanteParams = await db.select().from(parametros).where(eq(parametros.categoriaId, 21));
  const estadoGastoParams = await db.select().from(parametros).where(eq(parametros.categoriaId, 22));

  // Monedas
  const arsMoneda = monedaParams.find(m => m.codigo === "ARS") || monedaParams[0];
  const jusMoneda = monedaParams.find(m => m.codigo === "JUS") || monedaParams[0];

  // Parte cobro
  const parteActor = partesParams.find(p => p.codigo === "ACTOR") || partesParams[0];

  const passwordHash = await bcrypt.hash("123456", 12);

  // ==========================================
  // GENERACIÓN DE LOS 5 ESTUDIOS
  // ==========================================
  let currentEstudioId = 2;
  let currentUsuarioId = 2;
  let currentUserRoleId = 2;

  for (const est of ESTUDIOS_MOCK) {
    console.log(`\n🏢 Creando Tenant [${est.nombre}] (Estudio ID: ${currentEstudioId})...`);

    // A. Insertar Estudio
    const [estudio] = await db.insert(estudios).values({
      id: currentEstudioId,
      nombre: est.nombre,
      cuit: est.cuit,
      dirCalle: est.dir,
      dirNro: String(getRandomNumber(100, 3500)),
      telefono: `341-${getRandomNumber(4100000, 4999999)}`,
      emailContacto: `administracion@${est.nombre.toLowerCase().replace(/[^a-z]/g, "")}.com`,
      activo: true
    }).returning();

    // B. Insertar Valores JUS iniciales para este estudio (histórico básico)
    const listValoresJusIds: number[] = [];
    const anios = [2024, 2025, 2026];
    let valorJusBase = 80000;
    for (const anio of anios) {
      for (let mes = 1; mes <= 12; mes += 3) {
        valorJusBase += getRandomNumber(2000, 5000);
        const [vJus] = await db.insert(valoresJus).values({
          estudioId: estudio.id,
          valor: String(valorJusBase.toFixed(4)),
          fecha: new Date(`${anio}-${String(mes).padStart(2, '0')}-01T00:00:00.000Z`),
          activo: true
        }).returning();
        listValoresJusIds.push(vJus.id);
      }
    }

    // C. Insertar 3 Usuarios por Estudio (Director, Abogado, Asistente)
    const listUsers: number[] = [];
    const rolMap = [
      { prefix: "director", rolId: 5, desc: "DIRECTOR" }, // DIRECTOR
      { prefix: "abogado", rolId: 3, desc: "ABOGADO" },  // ABOGADO
      { prefix: "asistente", rolId: 4, desc: "ASISTENTE" } // ASISTENTE
    ];

    for (const rolInfo of rolMap) {
      const email = `${rolInfo.prefix}@${estudio.nombre.toLowerCase().replace(/[^a-z]/g, "")}.com`;
      const nombreUsr = getRandomElement(NOMBRES);
      const apellidoUsr = getRandomElement(APELLIDOS);

      const [usr] = await db.insert(usuarios).values({
        id: currentUsuarioId,
        estudioId: estudio.id,
        nombre: nombreUsr,
        apellido: apellidoUsr,
        email: email,
        passwordHash: passwordHash,
        activo: true
      }).returning();

      await db.insert(usuarioRoles).values({
        id: currentUserRoleId++,
        usuarioId: usr.id,
        rolId: rolInfo.rolId
      });

      listUsers.push(usr.id);
      currentUsuarioId++;
      console.log(`  👤 Usuario [${nombreUsr} ${apellidoUsr}] (${rolInfo.desc}) - Email: ${email}`);
    }

    const adminUserId = listUsers[0];
    const defaultUserId = listUsers[1] || adminUserId;

    // D. Poblar 20 Clientes por Estudio (Mezcla de Físicos y Jurídicos)
    const listClientes: any[] = [];
    for (let i = 1; i <= 20; i++) {
      const esFisica = Math.random() > 0.3; // 70% físicas, 30% jurídicas
      const tipoPersonaId = esFisica ? fisicaParam.id : juridicaParam.id;
      const nombre = esFisica ? getRandomElement(NOMBRES) : null;
      const apellido = esFisica ? getRandomElement(APELLIDOS) : null;
      const razonSocial = esFisica ? null : getRandomElement(RAZONES_SOCIALES);

      const email = esFisica 
        ? `${nombre?.toLowerCase()}.${apellido?.toLowerCase()}-${i}@ejemplo.com` 
        : `contacto-${i}@${razonSocial?.toLowerCase().replace(/[^a-z0-9]/g, "") || "empresa"}.com`;

      const [cliente] = await db.insert(clientes).values({
        estudioId: estudio.id,
        tipoPersonaId,
        nombre,
        apellido,
        razonSocial,
        dni: esFisica ? String(getRandomNumber(20000000, 45000000)) : null,
        cuit: String(getRandomNumber(20, 30)) + "-" + String(getRandomNumber(10000000, 90000000)) + "-" + String(getRandomNumber(0, 9)),
        email,
        telCelular: `341-${getRandomNumber(15000000, 15999999)}`,
        dirCalle: getRandomElement(CALLES),
        dirNro: String(getRandomNumber(100, 3500)),
        observaciones: `Cliente registrado en ${estudio.nombre}. Simulado multi-tenant.`,
        createdBy: adminUserId
      }).returning();
      listClientes.push(cliente);
    }
    console.log(`  ✓ 20 Clientes creados.`);

    // E. Poblar 20 Contactos Secundarios vinculados aleatoriamente a los clientes
    for (let i = 1; i <= 20; i++) {
      const clienteRandom = getRandomElement(listClientes);
      await db.insert(contactosClientes).values({
        clienteId: clienteRandom.id,
        nombre: `${getRandomElement(NOMBRES)} ${getRandomElement(APELLIDOS)}`,
        rol: getRandomElement(["Gerente de Legales", "Director", "Apoderado", "Cónyuge", "Hijo/a", "Socio"]),
        email: `contacto-secundario-${i}@ejemplo.com`,
        telefono: `341-${getRandomNumber(15000000, 15999999)}`,
        observaciones: "Contacto secundario cargado por el poblador masivo.",
        createdBy: defaultUserId
      });
    }
    console.log(`  ✓ 20 Contactos Secundarios asignados.`);

    // F. Poblar 20 Terceros por estudio (Abogados contraparte, peritos, mediadores)
    const listTerceros: any[] = [];
    for (let i = 1; i <= 20; i++) {
      const esFisica = Math.random() > 0.1; // 90% físicas
      const tipoPersonaId = esFisica ? fisicaParam.id : juridicaParam.id;
      const nombre = esFisica ? getRandomElement(NOMBRES) : null;
      const apellido = esFisica ? getRandomElement(APELLIDOS) : null;
      const razonSocial = esFisica ? null : getRandomElement(RAZONES_SOCIALES);

      const [tercero] = await db.insert(terceros).values({
        estudioId: estudio.id,
        tipoPersonaId,
        nombre,
        apellido,
        razonSocial,
        dni: esFisica ? String(getRandomNumber(10000000, 48000000)) : null,
        cuit: String(getRandomNumber(20, 30)) + "-" + String(getRandomNumber(10000000, 90000000)) + "-" + String(getRandomNumber(0, 9)),
        email: `tercero-${i}@correo.com`,
        telefono: `341-${getRandomNumber(15000000, 15999999)}`,
        dirCalle: getRandomElement(CALLES),
        dirNro: String(getRandomNumber(100, 3500)),
        observaciones: `Tercero participante simulado en ${estudio.nombre}.`,
        createdBy: defaultUserId
      }).returning();
      listTerceros.push(tercero);
    }
    console.log(`  ✓ 20 Terceros creados.`);

    // G. Poblar 20 Casos (Expedientes)
    const listCasos: any[] = [];
    for (let i = 1; i <= 20; i++) {
      const clienteRandom = getRandomElement(listClientes);
      const clienteLabel = clienteRandom.razonSocial || `${clienteRandom.apellido}, ${clienteRandom.nombre}`;

      const tipoRandom = getRandomElement(tipoCasoParams);
      const estadoRandom = getRandomElement(estadoCasoParams);
      const radicacionRandom = getRandomElement(radicacionParams);
      const estadoRadicacionRandom = getRandomElement(estadoRadicacionParams);

      // Armar carátula realista según la rama o tipo
      let caratula = "";
      const ramaId = tipoRandom.parentId; // ID de rama de derecho

      if (ramaId === 3 || ramaId === 2) { // Civil o Circuito
        caratula = `${clienteRandom.apellido || "Sociedad"} c/ ${getRandomElement(APELLIDOS)}${getRandomElement(CARATULAS_CIVIL)}`;
      } else if (ramaId === 5) { // Laboral
        caratula = `${clienteRandom.apellido || "Trabajador"} c/ ${getRandomElement(RAZONES_SOCIALES)}${getRandomElement(CARATULAS_LABORAL)}`;
      } else if (ramaId === 4) { // Familia
        caratula = `${clienteRandom.apellido || "Actor"}${getRandomElement(CARATULAS_FAMILIA)}`;
      } else if (ramaId === 8) { // Sucesiones
        caratula = `Sucesorio de ${clienteRandom.apellido || "Causante"} ${clienteRandom.nombre || ""}${getRandomElement(CARATULAS_SUCESIONES)}`;
      } else {
        caratula = `${clienteRandom.apellido || "Cliente"} s/ Reclamo Administrativo y Amparo`;
      }

      const [caso] = await db.insert(casos).values({
        estudioId: estudio.id,
        clienteId: clienteRandom.id,
        nroExpte: `${getRandomNumber(1000, 9999)}/${getRandomNumber(2023, 2026)}`,
        nroExpteNorm: `EXP-${estudio.id}-${i}`,
        caratula,
        tipoId: tipoRandom.id,
        estadoId: estadoRandom.id,
        radicacionId: radicacionRandom.id,
        estadoRadicacionId: estadoRadicacionRandom.id,
        descripcion: `Expediente judicial en trámite. Carátula: ${caratula}.`,
        createdBy: defaultUserId
      }).returning();
      listCasos.push(caso);
    }
    console.log(`  ✓ 20 Casos/Expedientes creados.`);

    // H. Poblar 20 Participantes de Caso vinculando terceros a los expedientes creados
    for (let i = 1; i <= 20; i++) {
      const casoRandom = getRandomElement(listCasos);
      // El tercero debe pertenecer al mismo estudio que el caso (invariante tenant / FK compuesta).
      const tercerosMismoEstudio = listTerceros.filter((t) => t.estudioId === casoRandom.estudioId);
      if (tercerosMismoEstudio.length === 0) continue;
      const terceroRandom = getRandomElement(tercerosMismoEstudio);
      const rolRandom = getRandomElement(rolParticipanteParams);

      await db.insert(participantesCaso).values({
        casoId: casoRandom.id,
        estudioId: casoRandom.estudioId,
        terceroId: terceroRandom.id,
        rolId: rolRandom.id,
        observaciones: `Participa activamente del caso en carácter de ${rolRandom.nombre}.`
      });
    }
    console.log(`  ✓ 20 Participantes vinculados a expedientes.`);

    // I. Poblar 20 Notas de Caso
    for (let i = 1; i <= 20; i++) {
      const casoRandom = getRandomElement(listCasos);
      const notaMeta = getRandomElement(NOTAS_EXPTE);
      
      await db.insert(notasCaso).values({
        casoId: casoRandom.id,
        estudioId: estudio.id,
        contenido: `${notaMeta} (Nota Simulación Nro ${i})`,
        createdBy: getRandomElement(listUsers)
      });
    }
    console.log(`  ✓ 20 Notas de Caso procesadas.`);

    // J. Poblar 20 Tareas con Subtareas
    const listTareasIds: number[] = [];
    for (let i = 1; i <= 20; i++) {
      const casoRandom = getRandomElement(listCasos);
      const prioridadRandom = getRandomElement(prioridadParams);
      const asignadoRandom = getRandomElement(listUsers);
      const completada = Math.random() > 0.5;

      const [t] = await db.insert(tareas).values({
        estudioId: estudio.id,
        titulo: `${getRandomElement(TASK_TITLES)} - Exp. ${casoRandom.nroExpte}`,
        descripcion: `Tarea proactiva del caso ${casoRandom.caratula}.`,
        fechaLimite: getRandomDate(getRandomNumber(-5, 20)),
        prioridadId: prioridadRandom.id,
        completada,
        completadaAt: completada ? new Date() : null,
        clienteId: casoRandom.clienteId,
        casoId: casoRandom.id,
        asignadoA: asignadoRandom,
        createdBy: adminUserId
      }).returning();
      listTareasIds.push(t.id);

      // 3 subtareas por cada tarea
      for (let j = 1; j <= 3; j++) {
        const subComp = completada || Math.random() > 0.5;
        await db.insert(subTareas).values({
          tareaId: t.id,
          titulo: `${getRandomElement(SUBTASK_TITLES)} (${j})`,
          completada: subComp,
          completadaAt: subComp ? new Date() : null,
          orden: j
        });
      }
    }
    console.log(`  ✓ 20 Tareas con 60 Subtareas registradas.`);

    // K. Poblar 20 Eventos de Agenda
    for (let i = 1; i <= 20; i++) {
      const casoRandom = getRandomElement(listCasos);
      const tipoRandom = getRandomElement(tipoEventoParams);
      const estadoRandom = getRandomElement(estadoEventoParams);
      const evMeta = getRandomElement(EVENT_TITLES);

      const fechaIni = getRandomDate(getRandomNumber(-15, 20));
      const fechaFin = new Date(fechaIni.getTime() + 60 * 60 * 1000); // 1 hora de duración

      await db.insert(eventos).values({
        estudioId: estudio.id,
        casoId: casoRandom.id,
        clienteId: casoRandom.clienteId,
        fechaInicio: fechaIni,
        fechaFin: fechaFin,
        allDay: false,
        tipoId: tipoRandom.id,
        estadoId: estadoRandom.id,
        descripcion: `${evMeta.desc} - Exp: ${casoRandom.nroExpte}`,
        ubicacion: `Tribunales Provinciales Nro ${getRandomNumber(1, 12)} - Balcarce 1651 Rosario`,
        createdBy: getRandomElement(listUsers)
      });
    }
    console.log(`  ✓ 20 Eventos de Agenda insertados.`);

    // L. Poblar Finanzas: 20 Honorarios Regulados
    const listHonorarios: any[] = [];
    const listEstadosHonorario = await db.select().from(parametros).where(eq(parametros.categoriaId, 16));
    const estadoHonorarioCobrado = listEstadosHonorario.find(e => e.codigo === "PAGADO") || listEstadosHonorario[0];

    for (let i = 1; i <= 20; i++) {
      const casoRandom = getRandomElement(listCasos);
      const conceptoRandom = getRandomElement(conceptoHonorarioParams);
      const monedaRandom = Math.random() > 0.5 ? jusMoneda : arsMoneda;
      const estadoRandom = getRandomElement(listEstadosHonorario);

      const esJus = monedaRandom.id === jusMoneda.id;
      const cantJus = esJus ? String(getRandomNumber(5, 50)) : null;
      const valorJusRef = esJus ? "124873.05" : null; // Valor JUS de referencia reciente
      const montoPesos = esJus 
        ? String((Number(cantJus) * Number(valorJusRef)).toFixed(2))
        : String(getRandomNumber(150000, 950000).toFixed(2));

      const [h] = await db.insert(honorarios).values({
        estudioId: estudio.id,
        clienteId: casoRandom.clienteId,
        casoId: casoRandom.id,
        conceptoId: conceptoRandom.id,
        parteId: parteActor.id,
        jus: cantJus,
        montoPesos: montoPesos,
        monedaId: monedaRandom.id,
        valorJusRef: valorJusRef,
        fechaRegulacion: getRandomDate(getRandomNumber(-40, -5)),
        fechaVencimiento: getRandomDate(getRandomNumber(5, 45)),
        estadoId: estadoRandom.id,
        createdBy: defaultUserId
      }).returning();
      listHonorarios.push(h);
    }
    console.log(`  ✓ 20 Honorarios Regulados.`);

    // M. Poblar Finanzas: 20 Gastos Procesales
    const listGastos: any[] = [];
    for (let i = 1; i <= 20; i++) {
      const casoRandom = getRandomElement(listCasos);
      const conceptoRandom = getRandomElement(conceptoGastoParams);
      const estadoRandom = getRandomElement(estadoGastoParams);

      const [g] = await db.insert(gastos).values({
        estudioId: estudio.id,
        clienteId: casoRandom.clienteId,
        casoId: casoRandom.id,
        conceptoId: conceptoRandom.id,
        descripcion: `Gasto operativo devengado en expediente ${casoRandom.nroExpte}.`,
        fechaGasto: getRandomDate(getRandomNumber(-40, 5)),
        monto: String(getRandomNumber(12000, 180000).toFixed(2)),
        monedaId: arsMoneda.id,
        cotizacionArs: "1.0000",
        estadoId: estadoRandom.id,
        createdBy: defaultUserId
      }).returning();
      listGastos.push(g);
    }
    console.log(`  ✓ 20 Gastos procesados.`);

    // N. Poblar Finanzas: 20 Ingresos (Pagos Percibidos)
    const listEstadosIngreso = await db.select().from(parametros).where(eq(parametros.categoriaId, 15));
    const estadoIngresoCobrado = listEstadosIngreso.find(e => e.codigo === "COBRADO") || listEstadosIngreso[0];

    for (let i = 1; i <= 20; i++) {
      const casoRandom = getRandomElement(listCasos);
      const conceptoRandom = getRandomElement(conceptoIngresoParams);

      await db.insert(ingresos).values({
        estudioId: estudio.id,
        clienteId: casoRandom.clienteId,
        casoId: casoRandom.id,
        descripcion: `Ingreso percibido del cliente por cobro de ${conceptoRandom.nombre}.`,
        monto: String(getRandomNumber(20000, 350000).toFixed(2)),
        monedaId: arsMoneda.id,
        cotizacionArs: "1.0000",
        fechaIngreso: getRandomDate(getRandomNumber(-30, 2)),
        tipoId: conceptoRandom.id,
        estadoId: estadoIngresoCobrado.id,
        createdBy: defaultUserId
      });
    }
    console.log(`  ✓ 20 Ingresos / Cobros registrados.`);

    currentEstudioId++;
  }

  // ==========================================
  // RESET SECUENCIAS BASE DE DATOS
  // ==========================================
  console.log("\n🔄 Reiniciando secuencias de todas las tablas operativas pobladas...");
  const tables = [
    "estudios", "usuarios", "usuario_roles", "clientes", "contactos_clientes", 
    "terceros", "casos", "participantes_caso", "notas_caso", "tareas", 
    "sub_tareas", "eventos", "honorarios", "gastos", "ingresos", "valores_jus"
  ];

  for (const table of tables) {
    try {
      await db.execute(sql`SELECT setval(pg_get_serial_sequence(${table}, 'id'), COALESCE(max(id), 1)) FROM ${sql.raw(table)};`);
      console.log(`  ✓ Secuencia de '${table}' reseteada correctamente.`);
    } catch (e) {
      console.warn(`  ⚠️ No se pudo resetear la secuencia de '${table}' (puede no tener secuencia serial):`, e);
    }
  }

  console.log("\n🎉 ¡PROCESO DE POBLAMIENTO MASIVO COMPLETADO CON ÉXITO!");
  console.log("==========================================================================");
  console.log(`🏢 Se crearon 5 nuevos estudios (IDs 2, 3, 4, 5, 6).`);
  console.log(`👤 Se crearon 15 nuevos usuarios (3 por estudio con contraseña '123456').`);
  console.log(`💼 Cuentas listas: admin@estudiojuricoalvearasociados.com, abogado@..., etc.`);
  console.log("==========================================================================\n");
  process.exit(0);
}

main().catch(err => {
  console.error("❌ Error catastrófico durante el poblamiento masivo:", err);
  process.exit(1);
});
