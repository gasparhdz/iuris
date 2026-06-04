import { ValorJusQueries, VALORES_JUS_ESTUDIO_GLOBAL_ID } from "../db/queries/valorjus.queries.js";
import { serializeDates } from "../utils/serialize.js";

const VALOR_JUS_URL = "https://www.justiciasantafe.gov.ar/index.php/unidad_jus/unidad-jus-ley-12851/";
const VALOR_JUS_REGEX = /\$([0-9\.]+),([0-9]{2})\s*a partir del\s*([0-9]{1,2})\s*de\s*(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s*de\s*([0-9]{4})/gi;

const MESES: Record<string, number> = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
};

export interface ValorJusScraped {
  valor: number;
  fecha: Date;
}

export class ValorJusScraperService {
  static async sync() {
    const html = await this.fetchHtml();
    const parsed = this.parseValores(html);
    const maxFecha = normalizeDate(await ValorJusQueries.findMaxFechaActiva(VALORES_JUS_ESTUDIO_GLOBAL_ID));
    const nuevos = parsed.filter((item) => !maxFecha || item.fecha.getTime() > maxFecha.getTime());

    const inserted = await ValorJusQueries.insertValoresJus(
      nuevos.map((item) => ({
        estudioId: VALORES_JUS_ESTUDIO_GLOBAL_ID,
        valor: item.valor.toFixed(4),
        fecha: item.fecha,
        activo: true,
      })),
    );

    return {
      message: `Sincronizacion Valor JUS finalizada. Registros nuevos insertados: ${inserted.length}.`,
      insertedCount: inserted.length,
      maxFechaActual: maxFecha ? maxFecha.toISOString() : null,
      parsedCount: parsed.length,
      data: inserted.map((row) => serializeDates({ ...row, valor: Number(row.valor) })),
    };
  }

  static parseValores(html: string): ValorJusScraped[] {
    const valuesByDate = new Map<string, ValorJusScraped>();

    for (const match of html.matchAll(VALOR_JUS_REGEX)) {
      const [, integerPart, decimalPart, day, monthName, year] = match;
      const monthIndex = MESES[monthName.toLowerCase()];
      if (monthIndex === undefined) continue;

      const fecha = new Date(Number(year), monthIndex, Number(day));
      const valor = Number(`${integerPart.replace(/\./g, "")}.${decimalPart}`);
      if (Number.isNaN(valor) || Number.isNaN(fecha.getTime())) continue;

      valuesByDate.set(formatDateKey(fecha), { valor, fecha });
    }

    return [...valuesByDate.values()].sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  }

  private static async fetchHtml() {
    const response = await fetch(VALOR_JUS_URL, {
      headers: {
        "user-agent": "Iuris ValorJus Sync/1.0",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      throw new Error(`VALOR_JUS_FETCH_FAILED:${response.status}`);
    }

    return await response.text();
  }
}

function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function normalizeDate(value: Date | string | null) {
  if (!value) return null;
  if (value instanceof Date) return value;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
