/**
 * Verificación de integridad de la migración lexmanager -> iuris.
 *
 * Compara registro por registro y campo por campo dos bases restauradas
 * localmente, mapeando los IDs de parámetros por código (no por ID).
 *
 * Uso:
 *   node scripts/verify-lexmanager-migration.cjs [--lex=lexmanager_check] [--iuris=iuris_orig_check]
 *
 * Requiere DATABASE_URL en .env (usa ese host/usuario, cambiando la base).
 */
require('dotenv').config({ quiet: true });
const { Client } = require('pg');

const arg = (name, def) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : def;
};
const LEX_DB = arg('lex', 'lexmanager_check');
const IU_DB = arg('iuris', 'iuris_orig_check');

const url = new URL(process.env.DATABASE_URL);
const base = { host: url.hostname, port: url.port || 5432, user: decodeURIComponent(url.username), password: decodeURIComponent(url.password) };

// Pares de tablas a comparar (lexmanager -> iuris). IDs preservados por el vuelco.
const TABLE_PAIRS = [
  ['Cliente', 'clientes'], ['Caso', 'casos'], ['CasoNota', 'notas_caso'], ['ClienteNota', 'notas_cliente'],
  ['ContactoCliente', 'contactos_clientes'], ['Evento', 'eventos'], ['Gasto', 'gastos'], ['Honorario', 'honorarios'],
  ['Ingreso', 'ingresos'], ['PlanPago', 'planes_pago'], ['PlanCuota', 'plan_cuotas'], ['SubTarea', 'sub_tareas'],
  ['Tarea', 'tareas'], ['Usuario', 'usuarios'], ['ValorJUS', 'valores_jus'],
];

// Columnas que no se comparan (auditoría / propias de iuris / secretos).
const SKIP_COLS = new Set(['created_at', 'updated_at', 'created_by', 'updated_by', 'deleted_by', 'estudio_id', 'password', 'password_hash']);

// Diferencias aceptadas (decisiones deliberadas, no errores). tabla -> columnas.
const ACCEPTED = {
  honorarios: new Set(['monto_pesos', 'valor_jus_ref', 'politica_jus_id', 'parte_id']), // parte_id: lex apuntaba a MONEDA (bug del sistema viejo); el vuelco normalizó a Demandado
  planes_pago: new Set(['politica_jus_id']),
  clientes: new Set(['drive_folder_id']), // enriquecimiento propio de iuris (Drive)
  casos: new Set(['drive_folder_id', 'estado_id', 'nro_expte', 'nro_expte_norm']), // estado: FINALIZADO->CON_SENTENCIA deliberado; nro_expte: limpieza de texto basura (caso 28)
  usuarios: new Set(['email', 'dni', 'last_login_at']), // cambiados deliberadamente en iuris
  plan_cuotas: new Set(['estado_id']), // iuris recalcula estados (VENCIDA por fecha, PAGADA por cobertura); se valida aparte por cobertura
};

const snake = (s) => s.replace(/([A-Z]+)/g, (m) => '_' + m.toLowerCase()).replace(/^_/, '');
// Las fechas se comparan por día calendario argentino (el vuelco normalizó horas a ART).
const artDay = (d) => new Date(d.getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10);
const norm = (v) => {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return artDay(v);
  if (typeof v === 'boolean') return v;
  const n = Number(v);
  if (typeof v !== 'string' || (v.trim() !== '' && Number.isFinite(n) && /^-?\d+(\.\d+)?$/.test(v.trim()))) {
    if (Number.isFinite(n) && typeof v !== 'boolean') return Math.round(n * 10000) / 10000;
  }
  return String(v).trim();
};
const eq = (a, b) => {
  if (a === null && b === null) return true;
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 0.005;
  return a === b;
};

async function paramFkCols(client, table, schemaQuoted) {
  // columnas de `table` con FK hacia la tabla de parámetros
  const q = await client.query(`
    select kcu.column_name col, ccu.table_name ref
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name
    join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
    where tc.constraint_type = 'FOREIGN KEY' and tc.table_name = $1`, [table]);
  return new Map(q.rows.map((r) => [r.col, r.ref]));
}

(async () => {
  const lex = new Client({ ...base, database: LEX_DB });
  const iu = new Client({ ...base, database: IU_DB });
  await lex.connect(); await iu.connect();
  let problems = 0, accepted = 0;

  // ---- 1. Mapeo de parámetros por (categoria.codigo, parametro.codigo) ----
  const lexParams = (await lex.query(`select p.id, p.codigo, p.nombre, c.codigo catcod from "Parametro" p join "Categoria" c on c.id = p."categoriaId"`)).rows;
  const iuParams = (await iu.query(`select p.id, p.codigo, p.nombre, c.codigo catcod from parametros p join categorias c on c.id = p.categoria_id`)).rows;
  const iuByKey = new Map(iuParams.map((r) => [`${r.catcod}::${r.codigo}`, Number(r.id)]));
  const paramMap = new Map(); // lexId -> iurisId
  const unmappedParams = [];
  for (const p of lexParams) {
    const target = iuByKey.get(`${p.catcod}::${p.codigo}`);
    if (target) paramMap.set(Number(p.id), target);
    else unmappedParams.push(`${p.catcod}/${p.codigo} "${p.nombre}" (lex id ${p.id})`);
  }
  console.log(`PARAMETROS: ${lexParams.length} en lex, ${paramMap.size} mapeados por código.`);
  if (unmappedParams.length) {
    // solo es problema si algún registro de negocio referencia un parámetro sin mapeo (se detecta abajo)
    console.log(`  sin equivalente en iuris (${unmappedParams.length}):`);
    unmappedParams.forEach((u) => console.log(`   - ${u}`));
  }

  // ---- 2. Tablas de negocio ----
  for (const [lt, it] of TABLE_PAIRS) {
    const lexCols = (await lex.query(`select column_name c from information_schema.columns where table_name=$1`, [lt])).rows.map((r) => r.c);
    const iuCols = new Set((await iu.query(`select column_name c from information_schema.columns where table_name=$1`, [it])).rows.map((r) => r.c));
    const fks = await paramFkCols(iu, it);

    // columnas comparables: existen en ambos (con snake_case) y no están excluidas
    const pairs = [];
    for (const lc of lexCols) {
      const ic = snake(lc);
      if (!iuCols.has(ic) || SKIP_COLS.has(ic) || ic === 'id') continue;
      pairs.push([lc, ic, fks.get(ic) === 'parametros']);
    }

    const lexRows = new Map((await lex.query(`select * from "${lt}"`)).rows.map((r) => [Number(r.id), r]));
    const iuRows = new Map((await iu.query(`select * from ${it}`)).rows.map((r) => [Number(r.id), r]));

    const missing = [...lexRows.keys()].filter((id) => !iuRows.has(id));
    const extra = [...iuRows.keys()].filter((id) => !lexRows.has(id));
    let diffCount = 0;
    const diffSamples = [];

    for (const [id, lr] of lexRows) {
      const ir = iuRows.get(id);
      if (!ir) continue;
      for (const [lc, ic, isParam] of pairs) {
        let a = lr[lc];
        let b = ir[ic];
        if (isParam && a != null) {
          const mapped = paramMap.get(Number(a));
          if (!mapped) { diffCount++; diffSamples.push(`id=${id} ${ic}: parámetro lex ${a} SIN MAPEO`); continue; }
          a = mapped;
          if (eq(Number(a), Number(b))) continue;
        }
        const na = norm(a), nb = norm(b);
        if (eq(na, nb)) continue;
        if (ACCEPTED[it]?.has(ic)) { accepted++; continue; }
        // caso especial documentado: ingresos JUS convertidos a representación nativa (pesos + cotización)
        if (it === 'ingresos' && ['monto', 'moneda_id', 'cotizacion_ars'].includes(ic)) {
          const monedaLex = lr['monedaId'] ? paramMap.get(Number(lr['monedaId'])) : null;
          const esJusLex = lexParams.find((p) => Number(p.id) === Number(lr['monedaId']))?.codigo?.toUpperCase().includes('JUS');
          if (esJusLex) {
            const okMonto = ic !== 'monto' || eq(norm(lr['montoPesosEquivalente']), nb);
            const okCot = ic !== 'cotizacion_ars' || eq(norm(lr['valorJusAlCobro']), nb);
            if (okMonto && okCot && (ic !== 'moneda_id' || true)) { accepted++; continue; }
          }
        }
        diffCount++;
        if (diffSamples.length < 8) diffSamples.push(`id=${id} ${ic}: lex=${JSON.stringify(na)} iuris=${JSON.stringify(nb)}`);
      }
    }

    const flag = (missing.length || extra.length || diffCount) ? '*** REVISAR ***' : 'OK';
    if (flag !== 'OK') problems++;
    console.log(`\n${lt} -> ${it}: ${lexRows.size} vs ${iuRows.size} filas, ${pairs.length} columnas comparadas ${flag}`);
    if (missing.length) console.log(`  faltan en iuris: [${missing}]`);
    if (extra.length) console.log(`  solo en iuris: [${extra}]`);
    if (diffCount) { console.log(`  ${diffCount} diferencia(s) de campo:`); diffSamples.forEach((d) => console.log(`   - ${d}`)); }
  }

  // ---- 3. Aplicaciones (estructura distinta: 2 tablas lex -> 1 iuris) ----
  const la = (await lex.query(`select (select coalesce(sum("montoAplicadoARS"),0) from "IngresoCuota" where activo) + (select coalesce(sum("montoAplicadoARS"),0) from "IngresoGasto" where activo) s`)).rows[0].s;
  const ia = (await iu.query(`select coalesce(sum(monto),0) s from ingreso_aplicaciones where activo`)).rows[0].s;
  const okApps = Math.abs(Number(la) - Number(ia)) < 0.01;
  if (!okApps) problems++;
  console.log(`\nAPLICACIONES (suma activas): lex=${la} iuris=${ia} ${okApps ? 'OK' : '*** REVISAR ***'}`);

  console.log(`\n==== RESULTADO: ${problems === 0 ? 'INTEGRIDAD OK' : problems + ' seccion(es) a revisar'} (${accepted} diferencias aceptadas por diseño) ====`);
  await lex.end(); await iu.end();
  process.exit(problems === 0 ? 0 : 1);
})().catch((e) => { console.error('FALLO:', e.message); process.exit(2); });
