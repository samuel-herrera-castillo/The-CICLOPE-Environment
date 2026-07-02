/**
 * Shared data hooks for D3 charts.
 * Fetches real data from SQLite via tauriBridge.
 * Respects global filters from filterStore.
 * Returns empty when no project or no data.
 */
import { useState, useEffect } from "react";
import { useProjectStore } from "../../../stores/projectStore";
import { useFilterStore } from "../../../stores/filterStore";
import { getDistribution, getCooccurrences, execQuery } from "../../../lib/tauriBridge";

/** Map of category ID → segment count. Respects filtroCodigo and filtroDocumento. */
export function useCategoryCounts(): Map<string, number> {
  const proyectoId = useProjectStore((s) => s.project?.id);
  const filtroCodigo = useFilterStore((s) => s.filtroCodigo);
  const filtroDocumento = useFilterStore((s) => s.filtroDocumento);
  const filtrosPausados = useFilterStore((s) => s.filtrosPausados);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (!proyectoId) return;
    getDistribution(proyectoId)
      .then((res) => {
        const map = new Map<string, number>();
        const activeCodes = filtroCodigo.filter((id) => !filtrosPausados.includes(id));
        const activeDocs = filtroDocumento.filter((id) => !filtrosPausados.includes(id));
        (res?.rows || []).forEach((row: any) => {
          const catName = row.categoria || "";
          const docName = row.documento || "";
          const n = Number(row.n) || 0;
          // Apply code filter if active
          if (activeCodes.length > 0 && !activeCodes.some((cid) => catName.includes(cid) || row.codigo_id === cid)) return;
          // Apply doc filter if active
          if (activeDocs.length > 0 && !activeDocs.some((did) => docName.includes(did) || row.documento_id === did)) return;
          map.set(catName, (map.get(catName) || 0) + n);
        });
        setCounts(map);
      })
      .catch(() => {});
  }, [proyectoId, filtroCodigo.length, filtroDocumento.length, filtrosPausados.length]);

  return counts;
}

/** Map of "docName" → total segments. Respects filtroDocumento and filtroCodigo. */
export function useDocCounts(): Map<string, number> {
  const proyectoId = useProjectStore((s) => s.project?.id);
  const filtroCodigo = useFilterStore((s) => s.filtroCodigo);
  const filtroDocumento = useFilterStore((s) => s.filtroDocumento);
  const filtrosPausados = useFilterStore((s) => s.filtrosPausados);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (!proyectoId) return;
    getDistribution(proyectoId)
      .then((res) => {
        const map = new Map<string, number>();
        const activeCodes = filtroCodigo.filter((id) => !filtrosPausados.includes(id));
        const activeDocs = filtroDocumento.filter((id) => !filtrosPausados.includes(id));
        (res?.rows || []).forEach((row: any) => {
          const docName = row.documento || "";
          const n = Number(row.n) || 0;
          if (activeCodes.length > 0 && !activeCodes.some((cid) => row.codigo_id === cid)) return;
          if (activeDocs.length > 0 && !activeDocs.some((did) => docName.includes(did) || row.documento_id === did)) return;
          map.set(docName, (map.get(docName) || 0) + n);
        });
        setCounts(map);
      })
      .catch(() => {});
  }, [proyectoId, filtroCodigo.length, filtroDocumento.length, filtrosPausados.length]);

  return counts;
}

/** Array of co-occurrence pairs. Respects filtroCodigo. */
export function useChartCooccurrences(): { catA: string; catB: string; count: number }[] {
  const proyectoId = useProjectStore((s) => s.project?.id);
  const filtroCodigo = useFilterStore((s) => s.filtroCodigo);
  const filtrosPausados = useFilterStore((s) => s.filtrosPausados);
  const [pairs, setPairs] = useState<{ catA: string; catB: string; count: number }[]>([]);

  useEffect(() => {
    if (!proyectoId) return;
    getCooccurrences(proyectoId)
      .then((res) => {
        const activeCodes = filtroCodigo.filter((id) => !filtrosPausados.includes(id));
        setPairs((res?.rows || []).filter((row: any) => {
          if (activeCodes.length === 0) return true;
          const a = row.cat_a || "", b = row.cat_b || "";
          return activeCodes.some((cid) => a.includes(cid) || b.includes(cid));
        }).map((row: any) => ({
          catA: row.cat_a || "", catB: row.cat_b || "", count: Number(row.n) || 0,
        })));
      })
      .catch(() => {});
  }, [proyectoId, filtroCodigo.length, filtrosPausados.length]);

  return pairs;
}

/** Fetch raw query results for any SQL */
export function useChartQuery(sql: string, params: any[] = []): any[] {
  const proyectoId = useProjectStore((s) => s.project?.id);
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    if (!proyectoId) return;
    execQuery(sql, params)
      .then((res) => setRows(res?.rows || []))
      .catch(() => setRows([]));
  }, [proyectoId, sql, JSON.stringify(params)]);

  return rows;
}
