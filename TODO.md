# Pendientes UX/UI

## Completados
- [x] Indicador de progreso en FinanzasForm — LinearProgress con % de campos completados
- [x] Transición de rutas — AnimatedPage con framer-motion en Layout.jsx
- [x] Validar migración react-hook-form en FinanzasForm — corregido TDZ (useRef)
- [x] MobileFinanceCard con jerarquía visual de 3 niveles (Finanzas.jsx + ClienteDetalle.jsx)
- [x] SisfeSync feedback animado — ícono rotatorio, barra de progreso, tooltip con timestamp relativo

---

## Bugs visuales — Botones
- [x] #15 Expediente → botón "Sincronizar SISFE" menos alto que los demás botones de tab
- [x] #16 Expediente → Expediente Digital: botones con distinto ancho entre sí

## Mobile — Bugs visuales
- [x] #1  Dashboard: botones de Acciones Rápidas — grid 2 col en móvil, 3 en tablet, 6 en desktop
- [x] #2  Clientes: listado mostraba "0 expedientes" — fix en backend (subquery COUNT en findAll)
- [x] #6  Expediente → SISFE: header vertical en móvil, TablePagination compacta
- [x] #7  Expediente → Participantes: `minWidth: "200px"` → `minWidth: 0`; botón alineado a la derecha en móvil
- [x] #8  Pantallas que se agrandan — `overflow: hidden` + `width: 100%` en wrapper de AnimatePresence

## Mobile — Tablas que deben convertirse a cards
- [x] #3  ClienteDetalle → Finanzas → Planes: muestra tabla en móvil
- [x] #4  ABM Clientes → Contactos secundarios cargados: muestra tabla en móvil
- [x] #10 Finanzas → Planes: listado en modo tabla en móvil
- [x] #12 Alta/edición de Ingresos: selección de honorarios y gastos en modo tabla en móvil
- [x] #13 Auditoría: se ve en modo tabla en móvil

## Mobile — Formularios
- [x] #9  Finanzas: filtro de períodos son chips desordenados → reemplazar por selector desplegable
- [x] #11 Alta/edición de movimientos: botones de tipo de movimiento se salen de pantalla en móvil

## Lógica / Funcionalidad
- [x] #5  ABM Clientes y Terceros: campo código postal innecesario — obtenerlo automáticamente desde la localidad seleccionada
- [ ] #14 Reportes: reorientar a reportes útiles con datos reales
  - [x] #14a Backend: agregar `responsableId` a casos (schema + queries + schema Zod) — PENDIENTE correr migración
  - [x] #14b Expediente form: selector de abogado responsable (+ endpoint GET /equipo/miembros)
  - [x] #14c Reportes: Financiero + Cartera (ya andaban; Expedientes arreglado: activo real + tipos por catálogo)
  - [x] #14d Reportes: nueva solapa "Cobranzas y Deuda" (Aging de honorarios + Proyección de cuotas)
  - [x] #14e Reportes: solapa "Vencimientos" + tabla "Expedientes sin movimiento +90d"
  - [x] #14f Reportes: Productividad por abogado real (usa responsableId)
