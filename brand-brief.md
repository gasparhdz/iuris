# Brief de marca — Sistema de gestión para estudios jurídicos

> **Cómo usar este documento:** entregáselo a Design tal cual. El nombre está
> confirmado: **Iuris**. Si querés, ajustá la sección 4 (tono). Todo lo demás ya
> está definido.

---

## 1. Qué pedimos

Renovar por completo la identidad visual de **Iuris**, un software de gestión
para estudios jurídicos: **logotipo + isotipo + paleta + tipografía +
aplicaciones**. El nombre se mantiene; lo que cambia es toda la imagen. El
sistema ya está en producción, así que la identidad tiene que poder
implementarse en una app web real (React + Material UI), no solo verse linda en
una presentación.

## 2. Sobre el producto

Plataforma SaaS multi-estudio (cada estudio jurídico es un tenant aislado) para
gestionar la operación diaria de un estudio de abogados en Argentina. Funciones:

- **Clientes y expedientes** — fichas, causas, partes.
- **Agenda y plazos procesales** — vencimientos, audiencias, tareas vinculadas a
  movimientos del expediente.
- **Finanzas** — honorarios, cuenta corriente del cliente, intereses por mora,
  unidad JUS, cobros parciales/totales.
- **Sincronización judicial** — integración con el sistema de gestión judicial
  (SISFE).
- **Reportes** — estado financiero y de gestión del estudio.

En una frase: **el sistema operativo del estudio jurídico** — donde el abogado
lleva sus casos, sus plazos y su plata en un solo lugar.

## 3. Público y contexto

- **Usuarios:** abogados y personal de estudios jurídicos en Argentina (y
  potencialmente LatAm). Desde el director del estudio hasta administrativos.
- **Comprador:** el titular/director del estudio. Valora seriedad, seguridad de
  los datos y que el sistema "no lo haga quedar mal" frente a clientes.
- **Competencia:** sistemas legales tradicionales, percibidos como lentos,
  feos y burocráticos. Nuestra oportunidad es verse como **la opción nueva y
  confiable**, no como un programa viejo más.

## 4. Personalidad de marca (tono)

**Confiable como base, moderno en la ejecución.** Tiene que transmitir seguridad
jurídica y solidez, pero con una estética limpia y actual. Ni "startup ruidosa"
(genera desconfianza con la plata y los plazos) ni "software institucional viejo"
(nos iguala a la competencia que queremos superar).

**Atributos de marca:** confiable · claro · profesional · ordenado · ágil.

**Sí queremos:** azul profundo como ancla de confianza, un acento de color vivo
y controlado, formas geométricas simples y estables, mucho aire, tipografía
legible con autoridad.

**Evitar:** martillos de juez (gavel — es un cliché estadounidense, no se usa en
tribunales argentinos), balanzas literales, columnas griegas, togas, pergaminos,
dorados recargados, serifas anticuadas, degradados estridentes.

## 5. Nombre

**Iuris** (confirmado, no cambia). Del latín *ius / iuris* = "derecho". El
wordmark tiene que sentirse contemporáneo y con autoridad; evitar que la raíz
latina lo haga ver anticuado. Debe convivir bien con el isotipo en versión
horizontal y leerse claro a tamaño chico.

## 6. Entregables

1. **Logotipo principal** — isotipo (símbolo) + wordmark (el nombre), en versión
   horizontal. Que el isotipo funcione **solo**, separado del texto.
2. **Variantes obligatorias:**
   - Isotipo aislado (para favicon y app).
   - Horizontal y, si aplica, apilado/vertical.
   - Monocromo (negro) y negativo (blanco), para fondos claros y oscuros.
3. **App icon / favicon** — el isotipo tiene que leerse nítido a **16×16 px** y
   en círculo. Entregar PNG 192, 512 y versión *maskable* (con zona de seguridad).
4. **Paleta de color** con códigos HEX: color primario (azul de confianza —
   punto de partida actual `#1565C0`, se puede ajustar), 1 color de acento,
   neutros (grises de UI), y colores de estado (éxito / alerta / error / info).
   Debe funcionar en **modo claro y oscuro** (la app ya tiene ambos).
5. **Tipografía** — una para títulos/marca y una para interfaz. Hoy la UI usa
   **Inter**; idealmente proponer algo compatible o conservar Inter para UI y
   sumar una tipo de display para la marca. Solo fuentes con licencia web libre
   (Google Fonts o similar).
6. **Estilo de iconografía** — set coherente con el isotipo (línea o relleno),
   para integrarse con los íconos de Material UI que ya usa la app.
7. **Aplicaciones de muestra:** pantalla de login, barra lateral (sidebar) con el
   logo, splash de la PWA, y membrete para documentos/PDF que genera el sistema.

## 7. Restricciones técnicas

- La app es **React + Material UI (MUI)**; la paleta se va a cargar como tema MUI,
  así que necesitamos los HEX exactos y los estados.
- Entregar logo e isotipo en **SVG** (vectorial) **y PNG**.
- Tiene **modo claro y oscuro**: el logo y los colores deben verse bien en ambos.
- El isotipo se usa como favicon e ícono de PWA → priorizar **legibilidad en
  tamaño chico** por encima del detalle.

## 8. Formato de entrega

- Manual de marca breve (1–2 páginas): usos correctos e incorrectos del logo,
  paleta con HEX, tipografías, espaciado mínimo.
- Archivos fuente: SVG + PNG (logo, variantes, iconos en 16/192/512).
- Tokens de color listos para copiar (HEX) para cargar en el tema de la app.
