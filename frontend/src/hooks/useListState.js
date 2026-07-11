import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

const DEFAULT_DEBOUNCE_KEYS = ["search"];

function parseParam(raw, defaultValue) {
  if (raw == null) return defaultValue;
  if (typeof defaultValue === "number") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : defaultValue;
  }
  if (typeof defaultValue === "boolean") {
    return raw === "true" || raw === "1";
  }
  return String(raw);
}

function readStateFromParams(searchParams, defaults) {
  const state = { ...defaults };
  for (const key of Object.keys(defaults)) {
    const raw = searchParams.get(key);
    if (raw !== null) {
      state[key] = parseParam(raw, defaults[key]);
    }
  }
  return state;
}

function applyListParamsToSearchParams(prev, defaults, state) {
  const next = new URLSearchParams(prev);
  for (const key of Object.keys(defaults)) {
    next.delete(key);
  }
  for (const key of Object.keys(defaults)) {
    const value = state[key];
    const def = defaults[key];
    if (value === def) continue;
    if (value === "" || value == null) continue;
    next.set(key, String(value));
  }
  return next;
}

function paramsEqual(a, b) {
  if (a === b) return true;
  const keysA = [...a.keys()].sort();
  const keysB = [...b.keys()].sort();
  if (keysA.length !== keysB.length) return false;
  return keysA.every((k, i) => k === keysB[i] && a.get(k) === b.get(k));
}

function pickDebounced(state, keys, defaults) {
  const out = {};
  for (const key of keys) {
    if (key in defaults) out[key] = state[key];
  }
  return out;
}

/**
 * Sincroniza estado de listado (search, filtros, orden, paginación) con la URL.
 * Usa replace (no push) para no llenar el historial con cada cambio de filtro.
 *
 * Las claves en `debounceKeys` (por defecto `search`) se reflejan en la URL
 * solo tras el debounce; el estado local se actualiza de inmediato (input).
 *
 * @template {Record<string, string | number | boolean>} T
 * @param {T} defaults
 * @param {{ debounceKeys?: string[], debounceMs?: number }} [options]
 * @returns {[T, (update: Partial<T> | ((prev: T) => Partial<T>)) => void]}
 */
export function useListState(defaults, options = {}) {
  const debounceMs = options.debounceMs ?? 300;
  const debounceKeysKey = (options.debounceKeys ?? DEFAULT_DEBOUNCE_KEYS).join("\0");
  const debounceKeys = useMemo(
    () => (debounceKeysKey === "" ? [] : debounceKeysKey.split("\0")),
    [debounceKeysKey],
  );

  const defaultsRef = useRef(defaults);
  const debounceKeysRef = useRef(debounceKeys);
  debounceKeysRef.current = debounceKeys;

  const [searchParams, setSearchParams] = useSearchParams();

  const [state, setStateInternal] = useState(() =>
    readStateFromParams(searchParams, defaultsRef.current),
  );

  const setState = useCallback((update) => {
    setStateInternal((prev) => {
      const patch = typeof update === "function" ? update(prev) : update;
      return { ...prev, ...patch };
    });
  }, []);

  const [debouncedPart, setDebouncedPart] = useState(() =>
    pickDebounced(state, debounceKeys, defaultsRef.current),
  );

  const debouncedDeps = debounceKeys.map((key) => state[key]).join("\0");

  useEffect(() => {
    const keys = debounceKeysRef.current;
    const defs = defaultsRef.current;
    const next = pickDebounced(state, keys, defs);
    let changed = false;
    for (const key of keys) {
      if (!(key in defs)) continue;
      if (next[key] !== debouncedPart[key]) {
        changed = true;
        break;
      }
    }
    if (!changed) return undefined;
    const id = setTimeout(() => setDebouncedPart(next), debounceMs);
    return () => clearTimeout(id);
    // debouncedDeps captura los valores de las claves debounced
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedDeps, debounceMs, debouncedPart]);

  const urlState = useMemo(() => {
    const merged = { ...state };
    for (const key of debounceKeys) {
      if (key in debouncedPart) merged[key] = debouncedPart[key];
    }
    return merged;
  }, [state, debouncedPart, debounceKeys]);

  useEffect(() => {
    const defs = defaultsRef.current;
    setSearchParams((prev) => {
      const next = applyListParamsToSearchParams(prev, defs, urlState);
      if (paramsEqual(prev, next)) return prev;
      return next;
    }, { replace: true });
  }, [urlState, setSearchParams]);

  return [state, setState];
}

// TODO (bonus): restaurar scroll al volver del detalle
// (sessionStorage keyed por ruta, o <ScrollRestoration /> de react-router).
