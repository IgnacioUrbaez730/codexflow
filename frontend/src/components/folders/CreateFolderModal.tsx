"use client";

import React, { useState, useEffect } from "react";
import { X, BookOpen, AlertCircle, MapPin, ChevronDown, ChevronUp } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import { DocumentFolder, FolderType } from "./types";
import { useGeographicSuggestions } from "../../hooks/useGeographicSuggestions";

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

  const { suggestions } = useGeographicSuggestions(tenantId);

  const [name, setName] = useState("");
  const [folderType, setFolderType] = useState<FolderType>("tome");
  const [parentId, setParentId] = useState<string>("");
  const [yearStart, setYearStart] = useState<string>("");
  const [yearEnd, setYearEnd] = useState<string>("");
  const [tomeNumber, setTomeNumber] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [templateId, setTemplateId] = useState<string>("");

  // Geographic state
  const [country, setCountry] = useState<string>("");
  const [state, setState] = useState<string>("");
  const [municipality, setMunicipality] = useState<string>("");
  const [cityOrLocality, setCityOrLocality] = useState<string>("");
  const [dioceseName, setDioceseName] = useState<string>("");
  const [parishName, setParishName] = useState<string>("");

  // Collapsible section state
  const [isGeoSectionOpen, setIsGeoSectionOpen] = useState(true);

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
      const fType = folderToEdit.folder_type || "tome";
      setFolderType(fType);
      setParentId(folderToEdit.parent_id || "");
      const meta = folderToEdit.metadata || {};
      setYearStart(meta.year_start !== undefined && meta.year_start !== null ? String(meta.year_start) : "");
      setYearEnd(meta.year_end !== undefined && meta.year_end !== null ? String(meta.year_end) : "");
      setTomeNumber(meta.tome_number || "");
      setLocation(meta.location || "");
      setTemplateId(meta.template_id || "");

      // Geographic fields from folder to edit
      setCountry(meta.country || "");
      setState(meta.state || "");
      setMunicipality(meta.municipality || "");
      setCityOrLocality(meta.city_or_locality || "");
      setDioceseName(meta.diocese_name || "");
      setParishName(meta.parish_name || "");

      const hasGeoData = Boolean(
        meta.country ||
        meta.state ||
        meta.municipality ||
        meta.city_or_locality ||
        meta.diocese_name ||
        meta.parish_name
      );
      setIsGeoSectionOpen(fType === "root" || fType === "parish" || hasGeoData);
    } else {
      setName("");
      const defaultType = parentFolder?.folder_type === "series" ? "tome" : (parentFolder ? "series" : "root");
      setFolderType(defaultType);
      setParentId(parentFolder?.id || "");
      setYearStart("");
      setYearEnd("");
      setTomeNumber("");
      setLocation("");
      setTemplateId("");

      // Intelligent prefilling from parent folder
      const parentMeta = parentFolder?.metadata || {};
      setCountry(parentMeta.country || "");
      setState(parentMeta.state || "");
      setMunicipality(parentMeta.municipality || "");
      setCityOrLocality(parentMeta.city_or_locality || "");
      setDioceseName(parentMeta.diocese_name || "");
      setParishName(parentMeta.parish_name || "");

      setIsGeoSectionOpen(defaultType === "root" || (defaultType as string) === "parish");
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

      // Add geographic metadata if non-empty
      if (country.trim()) metadata.country = country.trim();
      else delete metadata.country;

      if (state.trim()) metadata.state = state.trim();
      else delete metadata.state;

      if (municipality.trim()) metadata.municipality = municipality.trim();
      else delete metadata.municipality;

      if (cityOrLocality.trim()) metadata.city_or_locality = cityOrLocality.trim();
      else delete metadata.city_or_locality;

      if (dioceseName.trim()) metadata.diocese_name = dioceseName.trim();
      else delete metadata.diocese_name;

      if (parishName.trim()) metadata.parish_name = parishName.trim();
      else delete metadata.parish_name;

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
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden border max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50 shrink-0">
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
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
                onChange={(e) => {
                  const newType = e.target.value as FolderType;
                  setFolderType(newType);
                  if (newType === "root" || newType === "parish") {
                    setIsGeoSectionOpen(true);
                  }
                }}
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

          {/* Datalists for Dynamic Geographic Suggestions */}
          <datalist id="geo-countries">
            {suggestions.countries.map((c, i) => (
              <option key={`c-${i}`} value={c} />
            ))}
          </datalist>
          <datalist id="geo-states">
            {suggestions.states.map((s, i) => (
              <option key={`s-${i}`} value={s} />
            ))}
          </datalist>
          <datalist id="geo-municipalities">
            {suggestions.municipalities.map((m, i) => (
              <option key={`m-${i}`} value={m} />
            ))}
          </datalist>
          <datalist id="geo-cities">
            {suggestions.cities_or_localities.map((city, i) => (
              <option key={`city-${i}`} value={city} />
            ))}
          </datalist>
          <datalist id="geo-dioceses">
            {suggestions.dioceses.map((d, i) => (
              <option key={`d-${i}`} value={d} />
            ))}
          </datalist>
          <datalist id="geo-parishes">
            {suggestions.parishes.map((p, i) => (
              <option key={`p-${i}`} value={p} />
            ))}
          </datalist>

          {/* Collapsible Territorial & Geographic Jurisdiction Section (SPEC-013) */}
          <div className="border border-blue-200 rounded-lg overflow-hidden bg-white shadow-xs">
            <button
              type="button"
              onClick={() => setIsGeoSectionOpen(!isGeoSectionOpen)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-blue-50/70 hover:bg-blue-100/70 text-blue-900 transition font-medium text-xs text-left"
            >
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="font-semibold tracking-wide">
                  📍 Jurisdicción Territorial y Localidad Geográfica
                </span>
              </div>
              <div className="flex items-center space-x-1 text-blue-600">
                <span className="text-[11px] font-normal hidden sm:inline">
                  {isGeoSectionOpen ? "Ocultar" : "Mostrar"}
                </span>
                {isGeoSectionOpen ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </div>
            </button>

            {isGeoSectionOpen && (
              <div className="p-4 bg-slate-50/50 space-y-3 border-t border-blue-100">
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  Los datos geográficos definidos se heredan a todos los niveles inferiores (tomos y folios), permitiendo generar exportaciones FamilySearch estándar (<code className="text-blue-700 bg-blue-50 px-1 rounded">2 PLAC</code>).
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      País
                    </label>
                    <input
                      type="text"
                      list="geo-countries"
                      placeholder="Ej. Venezuela"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full border rounded px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Estado / Departamento
                    </label>
                    <input
                      type="text"
                      list="geo-states"
                      placeholder="Ej. Sucre"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="w-full border rounded px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Municipio / Cantón
                    </label>
                    <input
                      type="text"
                      list="geo-municipalities"
                      placeholder="Ej. Bermúdez"
                      value={municipality}
                      onChange={(e) => setMunicipality(e.target.value)}
                      className="w-full border rounded px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Ciudad / Localidad / Parroquia Civil
                    </label>
                    <input
                      type="text"
                      list="geo-cities"
                      placeholder="Ej. Carúpano"
                      value={cityOrLocality}
                      onChange={(e) => setCityOrLocality(e.target.value)}
                      className="w-full border rounded px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1 border-t border-gray-200">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Diócesis / Arquidiócesis
                    </label>
                    <input
                      type="text"
                      list="geo-dioceses"
                      placeholder="Ej. Diócesis de Carúpano"
                      value={dioceseName}
                      onChange={(e) => setDioceseName(e.target.value)}
                      className="w-full border rounded px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Parroquia Eclesiástica
                    </label>
                    <input
                      type="text"
                      list="geo-parishes"
                      placeholder="Ej. Santa Rosa de Lima"
                      value={parishName}
                      onChange={(e) => setParishName(e.target.value)}
                      className="w-full border rounded px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

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
