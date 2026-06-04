export type DecimalScale = 2 | 4 | 6;
export type RoundingMode = "HALF_UP" | "BANKERS";

const POW10: Record<number, bigint> = {
  0: 1n,
  1: 10n,
  2: 100n,
  3: 1000n,
  4: 10000n,
  5: 100000n,
  6: 1000000n,
  7: 10000000n,
  8: 100000000n,
  10: 10000000000n,
  12: 1000000000000n,
};

/**
 * Decimal fixed-point exacto sobre bigint.
 *
 * La convención predeterminada de redondeo es HALF_UP, usual en documentos
 * contables: los empates de medio centavo/micro-unidad se alejan de cero.
 * BANKERS queda disponible explícitamente para casos que requieran empate al par.
 */
export class Decimal {
  private constructor(
    private readonly units: bigint,
    public readonly scale: DecimalScale,
  ) {}

  static of(value: string | number | Decimal, scale: DecimalScale, rounding: RoundingMode = "HALF_UP"): Decimal {
    if (value instanceof Decimal) return value.toScale(scale, rounding);
    if (typeof value === "number") {
      if (!Number.isFinite(value)) throw new Error("DECIMAL_INVALID_NUMBER");
      return Decimal.parse(value.toString(), scale, rounding);
    }
    return Decimal.parse(value, scale, rounding);
  }

  static zero(scale: DecimalScale): Decimal {
    return new Decimal(0n, scale);
  }

  add(other: Decimal): Decimal {
    this.assertSameScale(other);
    return new Decimal(this.units + other.units, this.scale);
  }

  sub(other: Decimal): Decimal {
    this.assertSameScale(other);
    return new Decimal(this.units - other.units, this.scale);
  }

  min(other: Decimal): Decimal {
    this.assertSameScale(other);
    return this.units <= other.units ? this : other;
  }

  max(other: Decimal): Decimal {
    this.assertSameScale(other);
    return this.units >= other.units ? this : other;
  }

  abs(): Decimal {
    return new Decimal(this.units < 0n ? -this.units : this.units, this.scale);
  }

  isPositive(): boolean {
    return this.units > 0n;
  }

  isZeroOrLess(): boolean {
    return this.units <= 0n;
  }

  isZero(): boolean {
    return this.units === 0n;
  }

  gt(other: Decimal): boolean {
    this.assertSameScale(other);
    return this.units > other.units;
  }

  gte(other: Decimal): boolean {
    this.assertSameScale(other);
    return this.units >= other.units;
  }

  lt(other: Decimal): boolean {
    this.assertSameScale(other);
    return this.units < other.units;
  }

  mulByRate(rate: Decimal, targetScale: DecimalScale, rounding: RoundingMode = "HALF_UP"): Decimal {
    return new Decimal(roundRatio(this.units * rate.units, pow10(this.scale + rate.scale - targetScale), rounding), targetScale);
  }

  divByRate(rate: Decimal, targetScale: DecimalScale, rounding: RoundingMode = "HALF_UP"): Decimal {
    if (rate.units === 0n) throw new Error("DECIMAL_DIVISION_BY_ZERO");
    const shift = rate.scale + targetScale - this.scale;
    const numerator = shift >= 0 ? this.units * pow10(shift) : this.units;
    const denominator = shift >= 0 ? rate.units : rate.units * pow10(-shift);
    return new Decimal(roundRatio(numerator, denominator, rounding), targetScale);
  }

  toScale(scale: DecimalScale, rounding: RoundingMode = "HALF_UP"): Decimal {
    if (scale === this.scale) return this;
    const diff = scale - this.scale;
    if (diff > 0) return new Decimal(this.units * pow10(diff), scale);
    return new Decimal(roundRatio(this.units, pow10(-diff), rounding), scale);
  }

  toPg(): string {
    const negative = this.units < 0n;
    const abs = negative ? -this.units : this.units;
    const divisor = pow10(this.scale);
    const whole = abs / divisor;
    const fraction = (abs % divisor).toString().padStart(this.scale, "0");
    return `${negative ? "-" : ""}${whole.toString()}.${fraction}`;
  }

  toNumber(): number {
    return Number(this.toPg());
  }

  private assertSameScale(other: Decimal) {
    if (this.scale !== other.scale) throw new Error("DECIMAL_SCALE_MISMATCH");
  }

  private static parse(raw: string, scale: DecimalScale, rounding: RoundingMode): Decimal {
    const normalized = raw.trim().replace(",", ".");
    const match = /^([+-])?(\d+)(?:\.(\d+))?$/.exec(normalized);
    if (!match) throw new Error("DECIMAL_INVALID_FORMAT");
    const negative = match[1] === "-";
    const whole = BigInt(match[2]);
    const fractionRaw = match[3] ?? "";
    const padded = fractionRaw.padEnd(scale + 1, "0");
    const kept = BigInt(padded.slice(0, scale) || "0");
    const extra = padded.slice(scale);
    const base = whole * pow10(scale) + kept;
    const rounded = extra.length > 0 && /[1-9]/.test(extra)
      ? roundRatio(base * 10n + BigInt(extra[0]), 10n, rounding)
      : base;
    return new Decimal(negative ? -rounded : rounded, scale);
  }
}

export function pesos(value: string | number | Decimal): Decimal {
  return Decimal.of(value, 2);
}

export function jus(value: string | number | Decimal): Decimal {
  return Decimal.of(value, 4);
}

export function tasa(value: string | number | Decimal): Decimal {
  return Decimal.of(value, 6);
}

function pow10(exp: number): bigint {
  const cached = POW10[exp];
  if (cached) return cached;
  if (exp < 0) throw new Error("DECIMAL_INVALID_SCALE");
  return 10n ** BigInt(exp);
}

function roundRatio(numerator: bigint, denominator: bigint, mode: RoundingMode): bigint {
  if (denominator <= 0n) throw new Error("DECIMAL_INVALID_DENOMINATOR");
  const negative = numerator < 0n;
  const abs = negative ? -numerator : numerator;
  const quotient = abs / denominator;
  const remainder = abs % denominator;
  const twice = remainder * 2n;
  const increment = twice > denominator || (twice === denominator && (mode === "HALF_UP" || quotient % 2n === 1n));
  const rounded = quotient + (increment ? 1n : 0n);
  return negative ? -rounded : rounded;
}
