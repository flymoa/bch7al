// Browser preview only: same API as expo-sqlite, backed by sql.js and saved in localStorage.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import initSqlJs from 'sql.js/dist/sql-wasm.js';

const KEY = 'bch7al-preview-db';
const Ctx = createContext<any>(null);

function toB64(u: Uint8Array) { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); }
function fromB64(b: string) { const s = atob(b); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }

function wrap(raw: any) {
  let depth = 0;
  const persist = () => { if (depth === 0) try { localStorage.setItem(KEY, toB64(raw.export())); } catch {} };
  const all = (sql: string, params: any[] = []) => {
    const st = raw.prepare(sql); st.bind(params.map((p) => (p === undefined ? null : p)));
    const rows: any[] = []; while (st.step()) rows.push(st.getAsObject()); st.free(); return rows;
  };
  return {
    async execAsync(sql: string) { raw.exec(sql); persist(); },
    async runAsync(sql: string, params: any[] = []) {
      raw.run(sql, params.map((p) => (p === undefined ? null : p)));
      const id = all('SELECT last_insert_rowid() AS id')[0].id; const changes = raw.getRowsModified(); persist();
      return { lastInsertRowId: Number(id), changes };
    },
    async getAllAsync(sql: string, params: any[] = []) { return all(sql, params); },
    async getFirstAsync(sql: string, params: any[] = []) { return all(sql, params)[0] ?? null; },
    async withTransactionAsync(fn: () => Promise<void>) {
      raw.exec('BEGIN'); depth++;
      try { await fn(); depth--; raw.exec('COMMIT'); persist(); } catch (e) { depth--; raw.exec('ROLLBACK'); throw e; }
    },
  };
}

export function SQLiteProvider({ onInit, children }: { databaseName: string; onInit?: (db: any) => Promise<void>; children: ReactNode }) {
  const [db, setDb] = useState<any>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    (async () => {
      try {
        const b64 = (globalThis as any).__SQL_WASM_B64__ as string | undefined;
        const SQL = await initSqlJs(b64 ? { wasmBinary: fromB64(b64) } : { locateFile: () => './sql-wasm.wasm' });
        let saved: string | null = null; try { saved = localStorage.getItem(KEY); } catch {}
        const d = wrap(saved ? new SQL.Database(fromB64(saved)) : new SQL.Database());
        if (onInit) await onInit(d);
        setDb(d);
      } catch (e) { setErr(String((e as Error).message ?? e)); }
    })();
    // Open the database once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (err) return <div style={{ padding: 20, fontFamily: 'sans-serif' }}>Erreur de chargement : {err}</div>;
  if (!db) return null;
  return <Ctx.Provider value={db}>{children}</Ctx.Provider>;
}

export function useSQLiteContext() { return useContext(Ctx); }
