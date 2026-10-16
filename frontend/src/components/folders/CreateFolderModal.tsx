"use client";

import React, { useState, useEffect } from "react";
import { X, BookOpen, AlertCircle } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import { DocumentFolder, FolderType } from "./types";

interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (savedFolder: DocumentFolder) => void;
  folderToEdit?: DocumentFolder | null;
  parentFolder?: DocumentFolder | null;
  tree: DocumentFolder[];
  templates: Array<{ id: string; name: string }>;
  tenantId?: string;
}

export default function CreateFolderModal({
  isOpen,
  onClose,
  onSuccess,
  folderToEdit,
  parentFolder,
  tree,
  templates,
  tenantId,
}: CreateFolderModalProps) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );

  const [name, setName] = useState("");
  const [folderType, setFolderType] = useState<FolderType>("tome");
  const [parentId, setParentId] = useState<string>("");
  const [yearStart, setYearStart] = useState<string>("");
  const [yearEnd, setYearEnd] = useState<string>("");
  const [tomeNumber, setTomeNumber] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [templateId, setTemplateId] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Flatten the tree for parent selector dropdown
  const flattenFolders = (nodes: DocumentFolder[], prefix = ""): Array<{ id: string; name: string; type: FolderType }> => {
    let result: Array<{ id: string; name: string; type: FolderType }> = [];
    for (const node of nodes) {
      if (folderToEdit && node.id === folderToEdit.id) {
        continue; // cannot select self as parent
      }
      const label = prefix ? `${prefix} / ${node.name}` : node.name;
      result.push({ id: node.id, name: label, type: node.folder_type });
      if (node.children && node.children.length > 0) {
        result = result.concat(flattenFolders(node.children, label));
      }
    }
    return result;
  };

  const flatFolderOptions = flattenFolders(tree);

  useEffect(() => {
    if (folderToEdit) {
      setName(folderToEdit.name || "");
      setFolderType(folderToEdit.folder_type || "tome");
      setParentId(folderToEdit.parent_id || "");
      const meta = folderToEdit.metadata || {};
      setYearStart(meta.year_start !== undefined && meta.year_start !== null ? String(meta.year_start) : "");
      setYearEnd(meta.year_end !== undefined && meta.year_end !== null ? String(meta.year_end) : "");
      setTomeNumber(meta.tome_number || "");
      setLocation(meta.location || "");
      setTemplateId(meta.template_id || "");
    } else {
      setName("");
      setFolderType(parentFolder?.folder_type === "series" ? "tome" : (parentFolder ? "series" : "root"));
      setParentId(parentFolder?.id || "");
      setYearStart("");
      setYearEnd("");
      setTomeNumber("");
      setLocation("");
      setTemplateId("");
    }
    setErrorMsg(null);
  }, [folderToEdit, parentFolder, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMsg("El nombre de la carpeta o tomo es obligatorio.");
      return;
    }

    const yStart = yearStart.trim() ? parseInt(yearStart.trim(), 10) : null;
    const yEnd = yearEnd.trim() ? parseInt(yearEnd.trim(), 10) : null;

    if (yStart !== null && isNaN(yStart)) {
      setErrorMsg("El año de inicio debe ser un número entero válido.");
      return;
    }
    if (yEnd !== null && isNaN(yEnd)) {
      setErrorMsg("El año de fin debe ser un número entero válido.");
      return;
    }
    if (yStart !== null && yEnd !== null && yStart > yEnd) {
      setErrorMsg("El año de inicio no puede ser mayor que el año de fin.");
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        throw new Error("No hay sesión activa de usuario.");
      }

      const metadata: Record<string, any> = {
        ...(folderToEdit?.metadata || {}),
      };

      if (folderType === "tome") {
        if (yStart !== null) metadata.year_start = yStart;
        if (yEnd !== null) metadata.year_end = yEnd;
        if (tomeNumber.trim()) metadata.tome_number = tomeNumber.trim();
        if (location.trim()) metadata.location = location.trim();
        if (templateId) metadata.template_id = templateId;
      }

      if (folderToEdit) {
        // PATCH
        const patchPayload: Record<string, any> = {
          name: trimmedName,
          folder_type: folderType,
          parent_id: parentId ? parentId : null,
          metadata,
        };

        const res = await fetch(`/api/v1/folders/${folderToEdit.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...(tenantId ? { "X-Tenant-ID": tenantId } : {}),
          },
          body: JSON.stringify(patchPayload),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || "Error al actualizar la carpeta.");
        }

        const data = await res.json();
        onSuccess(data.data || folderToEdit);
      } else {
        // POST
        const payload: Record<string, any> = {
          name: trimmedName,
          folder_type: folderType,
          parent_id: parentId ? parentId : null,
          metadata: {
            ...metadata,
            ...(tenantId ? { tenant_id: tenantId } : {}),
          },
        };

        const res = await fetch("/api/v1/folders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...(tenantId ? { "X-Tenant-ID": tenantId } : {}),
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || "Error al crear la carpeta.");
        }

        const data = await res.json();
        onSuccess(data.data);
      }

      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Ocurrió un error inesperado.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden border">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-gray-900">
              {folderToEdit ? "Editar Carpeta / Tomo" : "Nueva Carpeta / Tomo"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Nombre de la Carpeta / Tomo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ej. Libro 3 de Bautismos (1850-1875)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Tipo de Nivel <span className="text-red-500">*</span>
              </label>
              <select
                value={folderType}
                onChange={(e) => setFolderType(e.target.value as FolderType)}
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="root">Fondo / Diócesis</option>
                <option value="parish">Parroquia / Notaría</option>
                <option value="series">Serie Documental</option>
                <option value="tome">Tomo / Libro Físico</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Carpeta Contenedora (Padre)
              </label>
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">(Ninguna - Nivel Raíz)</option>
                {flatFolderOptions.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.type})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Details for Tome */}
          {folderType === "tome" && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Metadatos Físicos del Tomo (DCam)
              </h4>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Número de Tomo
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. 03"
                    value={tomeNumber}
                    onChange={(e) => setTomeNumber(e.target.value)}
                    className="w-full border rounded px-2.5 py-1.5 text-sm bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Año Inicial
                  </label>
                  <input
                    type="number"
                    placeholder="Ej. 1850"
                    value={yearStart}
                    onChange={(e) => setYearStart(e.target.value)}
                    className="w-full border rounded px-2.5 py-1.5 text-sm bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Año Final
                  </label>
                  <input
                    type="number"
                    placeholder="Ej. 1875"
                    value={yearEnd}
                    onChange={(e) => setYearEnd(e.target.value)}
                    className="w-full border rounded px-2.5 py-1.5 text-sm bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Ubicación Física (Caja / Estante)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Estante B - Caja 12"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full border rounded px-2.5 py-1.5 text-sm bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Plantilla Predeterminada
                  </label>
                  <select
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                    className="w-full border rounded px-2.5 py-1.5 text-sm bg-white"
                  >
                    <option value="">-- Sin plantilla predeterminada --</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-md transition font-medium shadow flex items-center space-x-1"
            >
              {loading ? (
                <span>Guardando...</span>
              ) : (
                <span>{folderToEdit ? "Guardar Cambios" : "Crear Tomo/Carpeta"}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
