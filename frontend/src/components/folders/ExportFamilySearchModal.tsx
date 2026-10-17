"use client";

import React, { useState, useEffect } from "react";
import {
  Download,
  AlertTriangle,
  CheckCircle,
  FileSpreadsheet,
  FileText,
  Layers,
  Image as ImageIcon,
  Loader2,
  X,
  ShieldCheck,
  Info
} from "lucide-react";
import { DocumentFolder } from "./types";

interface PreExportSummary {
  tome_id: string;
  tome_name: string;
  folder_type: string;
  total_folios: number;
  total_entries: number;
  completed_entries: number;
  revision_entries: number;
  pending_entries: number;
  has_revisions: boolean;
  doubtful_folios_count: number;
  ready_for_export: boolean;
}

interface ExportFamilySearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  folder: DocumentFolder | null;
  authToken?: string | null;
  tenantId?: string;
}

export default function ExportFamilySearchModal({
  isOpen,
  onClose,
  folder,
  authToken,
  tenantId,
}: ExportFamilySearchModalProps) {
  const [loadingSummary, setLoadingSummary] = useState<boolean>(true);
  const [summary, setSummary] = useState<PreExportSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Selector de tipo de paquete
  // 'data_only': Paquete rápido con Excel, CSV, GEDCOM y Manifiesto
  // 'dip_full': Paquete completo con subcarpeta images/ y fotos en alta resolución
  const [packageType, setPackageType] = useState<"data_only" | "dip_full">("data_only");
  const [exporting, setExporting] = useState<boolean>(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !folder) {
      setSummary(null);
      setSummaryError(null);
      return;
    }

    let isMounted = true;
    async function loadSummary() {
      setLoadingSummary(true);
      setSummaryError(null);
      try {
        const headers: Record<string, string> = {
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          ...(tenantId ? { "X-Tenant-ID": tenantId } : {}),
        };
        const res = await fetch(`/api/v1/folders/${folder?.id}/pre-export-summary`, {
          headers,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || "Error al obtener la auditoría del tomo");
        }

        const json = await res.json();
        if (isMounted) {
          setSummary(json.data);
        }
      } catch (err: any) {
        if (isMounted) {
          setSummaryError(err.message || "No se pudo auditar la carpeta seleccionada.");
        }
      } finally {
        if (isMounted) {
          setLoadingSummary(false);
        }
      }
    }

    loadSummary();

    return () => {
      isMounted = false;
    };
  }, [isOpen, folder, authToken, tenantId]);

  if (!isOpen || !folder) return null;

  const handleDownloadPackage = async () => {
    try {
      setExporting(true);
      setExportError(null);

      const includeImages = packageType === "dip_full";
      const headers: Record<string, string> = {
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(tenantId ? { "X-Tenant-ID": tenantId } : {}),
      };

      const res = await fetch(
        `/api/v1/folders/${folder.id}/export-familysearch?include_images=${includeImages}`,
        {
          headers,
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Error al generar el paquete de exportación");
      }

      // Convertir respuesta a blob y descargar
      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition");
      let filename = `${folder.name.replace(/\s+/g, "_")}_FamilySearch_DIP.zip`;
      if (disposition && disposition.includes("filename=")) {
        const match = disposition.match(/filename="?([^";]+)"?/);
        if (match && match[1]) {
          filename = match[1];
        }
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      // Auto cerrar el modal tras descarga exitosa
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err: any) {
      setExportError(err.message || "Error al descargar el archivo ZIP.");
    } finally {
      setExporting(false);
    }
  };

  const totalEntries = summary?.total_entries || 0;
  const completedEntries = summary?.completed_entries || 0;
  const progressPercent =
    totalEntries > 0 ? Math.round((completedEntries / totalEntries) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Exportación Interoperable FamilySearch (DIP)
              </h3>
              <p className="text-xs text-slate-300">
                Paquete estandarizado para preservación e indexación genealógica
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={exporting}
            className="text-slate-400 hover:text-white transition p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Target Tome details */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex items-start justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-200 px-2 py-0.5 rounded">
                {folder.folder_type === "tome" ? "Tomo Seleccionado" : folder.folder_type}
              </span>
              <h4 className="font-semibold text-slate-900 mt-1 text-sm">{folder.name}</h4>
              {folder.metadata && (
                <p className="text-xs text-slate-500 mt-0.5">
                  {folder.metadata.parish_name && `${folder.metadata.parish_name} • `}
                  {folder.metadata.tome_number && `Tomo N° ${folder.metadata.tome_number} • `}
                  {folder.metadata.year_start && `${folder.metadata.year_start} - ${folder.metadata.year_end || ""}`}
                </p>
              )}
            </div>
          </div>

          {/* QC / Audit Status Card */}
          {loadingSummary ? (
            <div className="py-8 flex flex-col items-center justify-center space-y-2 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
              <span className="text-xs font-medium">Auditando calidad y conteo de partidas...</span>
            </div>
          ) : summaryError ? (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{summaryError}</span>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Quality & Progress Metrics */}
              <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-2xs space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">Control de Calidad Documental</span>
                  <span className="font-bold text-emerald-700">
                    {progressPercent}% completado
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <div className="text-lg font-bold text-slate-800">{summary?.total_folios}</div>
                    <div className="text-[11px] text-slate-500">Folios Físicos</div>
                  </div>
                  <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-200">
                    <div className="text-lg font-bold text-emerald-700">{summary?.completed_entries}</div>
                    <div className="text-[11px] font-semibold text-emerald-800">Actas a Exportar</div>
                  </div>
                  <div className="p-2 bg-amber-50 rounded-lg">
                    <div className="text-lg font-bold text-amber-700">{summary?.revision_entries}</div>
                    <div className="text-[11px] text-amber-700">En Revisión</div>
                  </div>
                </div>

                {/* Zero completed entries warning (T03-FE-05) */}
                {summary && summary.completed_entries === 0 && (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2.5 text-xs text-rose-800">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                    <div>
                      <strong className="font-semibold text-rose-900">No es posible exportar:</strong>{" "}
                      El tomo no tiene ninguna partida completada aún. Completa e indexa al menos una partida antes de generar el paquete DIP.
                    </div>
                  </div>
                )}

                {/* Information on pending entries/folios excluded for DIP purity (T03-FE-05) */}
                {summary && summary.completed_entries > 0 && ((summary.pending_entries || 0) > 0 || ((summary.total_folios || 0) > summary.completed_entries)) && (
                  <div className="p-3 bg-blue-50/90 border border-blue-200 rounded-lg flex items-start space-x-2.5 text-xs text-blue-800">
                    <Info className="w-4 h-4 shrink-0 text-blue-600 mt-0.5" />
                    <div>
                      <strong className="font-semibold">Filtro Estricto de Calidad:</strong> Se incluirán {summary.completed_entries} actas completadas. Nota: Se excluirán {summary.pending_entries || Math.max(0, (summary.total_folios || 0) - summary.completed_entries)} folios/partidas pendientes para garantizar la pureza del paquete.
                    </div>
                  </div>
                )}

                {/* Warning if there are doubtful/revision records */}
                {summary && summary.has_revisions && summary.completed_entries > 0 && (
                  <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-lg flex items-start space-x-2.5 text-xs text-amber-800">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                    <div>
                      <strong className="font-semibold">Advertencia de Auditoría:</strong> Hay{" "}
                      <span className="font-bold underline">{summary.revision_entries}</span> partida(s)
                      marcadas como dudosas o en revisión. El paquete incluirá las notas de revisión y
                      observaciones de calidad para auditoría de FamilySearch.
                    </div>
                  </div>
                )}
              </div>

              {/* Package Type Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Selecciona el Formato del Paquete
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Option A: Complete Data Package */}
                  <label
                    className={`relative p-3.5 border-2 rounded-xl cursor-pointer flex flex-col justify-between transition-all ${
                      packageType === "data_only"
                        ? "border-emerald-600 bg-emerald-50/40 shadow-xs"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <input
                      type="radio"
                      name="package_type"
                      value="data_only"
                      checked={packageType === "data_only"}
                      onChange={() => setPackageType("data_only")}
                      className="sr-only"
                    />
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
                          <FileSpreadsheet className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          Descarga Inmediata
                        </span>
                      </div>
                      <div className="font-bold text-xs text-slate-900">Paquete de Datos</div>
                      <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                        Excel (.xlsx), CSV universal (BOM), GEDCOM 5.5.1 y manifest.json.
                      </p>
                    </div>
                    {packageType === "data_only" && (
                      <div className="absolute top-2 right-2 text-emerald-600">
                        <CheckCircle className="w-4 h-4 fill-emerald-600 text-white" />
                      </div>
                    )}
                  </label>

                  {/* Option B: Integral DIP Package with Images */}
                  <label
                    className={`relative p-3.5 border-2 rounded-xl cursor-pointer flex flex-col justify-between transition-all ${
                      packageType === "dip_full"
                        ? "border-emerald-600 bg-emerald-50/40 shadow-xs"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <input
                      type="radio"
                      name="package_type"
                      value="dip_full"
                      checked={packageType === "dip_full"}
                      onChange={() => setPackageType("dip_full")}
                      className="sr-only"
                    />
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700">
                          <ImageIcon className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800">
                          Preservación DIP
                        </span>
                      </div>
                      <div className="font-bold text-xs text-slate-900">Paquete Integral DIP</div>
                      <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                        Datos genealógicos + Fotos en alta resolución en subcarpeta <code>images/</code>.
                      </p>
                    </div>
                    {packageType === "dip_full" && (
                      <div className="absolute top-2 right-2 text-emerald-600">
                        <CheckCircle className="w-4 h-4 fill-emerald-600 text-white" />
                      </div>
                    )}
                  </label>
                </div>
              </div>

              {exportError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{exportError}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            disabled={exporting}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleDownloadPackage}
            disabled={exporting || loadingSummary || !summary || summary.completed_entries === 0}
            className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:pointer-events-none rounded-lg shadow-sm transition flex items-center space-x-2 cursor-pointer"
          >
            {exporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generando Paquete ZIP...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Descargar Paquete FamilySearch (.ZIP)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
