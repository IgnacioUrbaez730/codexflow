import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { ShieldCheck, Lock, Copy, Trash2, AlertCircle, Info } from "lucide-react";

type Field = {
  id: string;
  label: string;
  type: string;
  required: boolean;
  options: string[];
};

export default function TemplateBuilder({ tenantId }: { tenantId: string }) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [name, setName] = useState("");
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const fetchTemplates = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const res = await fetch("/api/v1/templates", {
        headers: { "Authorization": `Bearer ${session.access_token}` }
      });
      const resData = await res.json();
      if (resData.status === "success") {
        setTemplates(resData.data);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
  const isSystemTemplate = Boolean(selectedTemplate?.is_system_template);

  const loadTemplate = (id: string) => {
    setSelectedTemplateId(id);
    if (!id) {
      setName("");
      setFields([]);
      return;
    }
    const tpl = templates.find((t) => t.id === id);
    if (tpl) {
      setName(tpl.name);
      setFields(tpl.fields || []);
    }
  };

  const toSnakeCase = (str: string) => {
    return str
      .match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g)
      ?.map(x => x.toLowerCase())
      .join('_') || "";
  };

  const addField = () => {
    if (isSystemTemplate) return;
    if (fields.length >= 40) {
      alert("Límite máximo de 40 campos.");
      return;
    }
    setFields([...fields, { id: "nuevo_campo", label: "Nuevo Campo", type: "text", required: false, options: [] }]);
  };

  const updateField = (index: number, key: keyof Field, value: any) => {
    if (isSystemTemplate) return;
    const newFields = [...fields];
    if (key === "label") {
      newFields[index].label = value;
      newFields[index].id = toSnakeCase(value) || `field_${index}`;
    } else {
      (newFields[index] as any)[key] = value;
    }
    setFields(newFields);
  };

  const moveField = (index: number, dir: number) => {
    if (isSystemTemplate) return;
    if (index + dir < 0 || index + dir >= fields.length) return;
    const newFields = [...fields];
    const temp = newFields[index];
    newFields[index] = newFields[index + dir];
    newFields[index + dir] = temp;
    setFields(newFields);
  };

  const removeField = (index: number) => {
    if (isSystemTemplate) return;
    const newFields = [...fields];
    newFields.splice(index, 1);
    setFields(newFields);
  };

  const duplicateTemplate = () => {
    if (!selectedTemplate) return;
    setSelectedTemplateId(""); // Reset to new template
    setName(`${selectedTemplate.name} (Copia Personalizada)`);
    setFields(JSON.parse(JSON.stringify(selectedTemplate.fields || [])));
    alert("Se ha duplicado la plantilla oficial. Ahora puedes personalizar los campos libremente y guardarla como una plantilla propia de tu organización.");
  };

  const deleteTemplate = async () => {
    if (!selectedTemplateId || isSystemTemplate) return;
    const confirmed = window.confirm(`¿Estás seguro de eliminar la plantilla "${name}"?`);
    if (!confirmed) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const res = await fetch(`/api/v1/templates/${selectedTemplateId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${session.access_token}` }
      });
      if (res.ok) {
        alert("Plantilla eliminada exitosamente.");
        setSelectedTemplateId("");
        setName("");
        setFields([]);
        fetchTemplates();
      } else {
        const data = await res.json().catch(() => ({}));
        alert("Error al eliminar: " + (data.detail || "No se pudo eliminar la plantilla"));
      }
    } catch (e: any) {
      alert("Error de conexión: " + e.message);
    }
  };

  const saveTemplate = async () => {
    if (isSystemTemplate) {
      alert("Las plantillas maestras de FamilySearch están protegidas y no pueden sobrescribirse. Usa 'Duplicar para personalizar'.");
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const url = selectedTemplateId ? `/api/v1/templates/${selectedTemplateId}` : "/api/v1/templates";
    const method = selectedTemplateId ? "PUT" : "POST";
    
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ name, fields })
    });
    
    const data = await res.json();
    if (data.status === "success") {
      alert("Plantilla guardada exitosamente");
      fetchTemplates();
      if (!selectedTemplateId) {
        setSelectedTemplateId(data.data.id);
      }
    } else {
      alert("Error: " + data.detail);
    }
  };

  const loadMaster = (type: "bautismo" | "defuncion") => {
    if (type === "bautismo") {
      setFields([
        { id: "nombre_bautizado", label: "Nombre del Bautizado", type: "text", required: true, options: [] },
        { id: "fecha_nacimiento", label: "Fecha de Nacimiento", type: "date", required: false, options: [] },
        { id: "nombre_padre", label: "Nombre del Padre", type: "text", required: true, options: [] },
        { id: "nombre_madre", label: "Nombre de la Madre", type: "text", required: true, options: [] }
      ]);
      setName("Plantilla Bautismo Personalizada");
    } else {
      setFields([
        { id: "nombre_difunto", label: "Nombre del Difunto", type: "text", required: true, options: [] },
        { id: "fecha_defuncion", label: "Fecha de Defunción", type: "date", required: true, options: [] },
        { id: "causa_muerte", label: "Causa de Muerte", type: "text", required: false, options: [] }
      ]);
      setName("Plantilla Defunción Personalizada");
    }
    setSelectedTemplateId("");
  };

  return (
    <div className="flex h-[80vh] border rounded-xl overflow-hidden bg-white shadow-xs">
      {/* Builder Panel */}
      <div className="w-1/2 border-r p-4 overflow-y-auto bg-gray-50 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-800">Diseñador de Plantillas</h3>
          {selectedTemplateId && !isSystemTemplate && (
            <button
              onClick={deleteTemplate}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg transition cursor-pointer"
              title="Eliminar plantilla personalizada"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Eliminar</span>
            </button>
          )}
        </div>

        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">
            Seleccionar o Crear Plantilla
          </label>
          <select 
            className="w-full border border-gray-300 p-2.5 rounded-lg mb-2 text-sm bg-white text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            value={selectedTemplateId}
            onChange={(e) => loadTemplate(e.target.value)}
          >
            <option value="">-- Nueva Plantilla --</option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>
                {t.is_system_template ? `🛡️ [Oficial FamilySearch] ${t.name}` : t.name}
              </option>
            ))}
          </select>

          {/* Quick Preset Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadMaster("bautismo")}
              className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1 rounded-md text-xs font-medium transition cursor-pointer"
            >
              Bautismo Rápido
            </button>
            <button
              onClick={() => loadMaster("defuncion")}
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1 rounded-md text-xs font-medium transition cursor-pointer"
            >
              Defunción Rápida
            </button>
          </div>
        </div>

        {/* System Template Protection Banner (T03-FE-04) */}
        {isSystemTemplate && (
          <div className="mb-4 p-3.5 rounded-xl bg-blue-50/80 border border-blue-200 text-blue-900 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-600 text-white shadow-xs">
                <Lock className="w-3.5 h-3.5 text-blue-100" />
                Oficial FamilySearch
              </span>
              <button
                type="button"
                onClick={duplicateTemplate}
                className="inline-flex items-center gap-1 px-3 py-1 bg-white hover:bg-blue-100 text-blue-700 border border-blue-300 rounded-lg text-xs font-semibold transition cursor-pointer shadow-xs"
                title="Clonar esta plantilla como personalizada para editarla"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Duplicar para personalizar</span>
              </button>
            </div>
            <p className="text-xs text-blue-800 leading-relaxed">
              Esta es una <strong>plantilla canónica oficial de FamilySearch</strong>. Sus campos base están protegidos en modo solo lectura para garantizar la compatibilidad con el estándar archivístico internacional. Si deseas adaptarla o añadir campos adicionales, pulsa <strong>Duplicar para personalizar</strong>.
            </p>
          </div>
        )}

        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">
            Nombre de la Plantilla
          </label>
          <input 
            className={`w-full border border-gray-300 p-2.5 rounded-lg text-sm ${
              isSystemTemplate ? "bg-gray-100 text-gray-600 cursor-not-allowed" : "bg-white text-gray-800"
            }`}
            disabled={isSystemTemplate}
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            placeholder="Ej. Bautismos Parroquia San José 1890"
          />
        </div>

        {/* Fields list */}
        <div className="flex-1 space-y-3">
          {fields.map((f, i) => (
            <div key={i} className="border border-gray-200 p-3.5 rounded-xl bg-white shadow-2xs relative">
              {!isSystemTemplate && (
                <div className="absolute top-2.5 right-2.5 flex space-x-1">
                  <button
                    onClick={() => moveField(i, -1)}
                    className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 px-1.5 py-0.5 rounded text-xs"
                    title="Subir campo"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveField(i, 1)}
                    className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 px-1.5 py-0.5 rounded text-xs"
                    title="Bajar campo"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => removeField(i)}
                    className="text-rose-400 hover:text-rose-600 hover:bg-rose-50 px-1.5 py-0.5 rounded text-xs"
                    title="Eliminar campo"
                  >
                    ✕
                  </button>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2.5 mt-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Etiqueta (Label)</label>
                  <input
                    disabled={isSystemTemplate}
                    className={`w-full border border-gray-300 p-1.5 rounded-md text-xs ${
                      isSystemTemplate ? "bg-gray-100 text-gray-600 cursor-not-allowed" : "bg-white text-gray-800"
                    }`}
                    value={f.label}
                    onChange={(e) => updateField(i, "label", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Tipo de Dato</label>
                  <select
                    disabled={isSystemTemplate}
                    className={`w-full border border-gray-300 p-1.5 rounded-md text-xs ${
                      isSystemTemplate ? "bg-gray-100 text-gray-600 cursor-not-allowed" : "bg-white text-gray-800"
                    }`}
                    value={f.type}
                    onChange={(e) => updateField(i, "type", e.target.value)}
                  >
                    <option value="text">Texto Corto</option>
                    <option value="long_text">Texto Largo</option>
                    <option value="date">Fecha</option>
                    <option value="dropdown">Desplegable (Dropdown)</option>
                  </select>
                </div>
              </div>
              {f.type === "dropdown" && (
                <div className="mt-2.5">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Opciones (separadas por coma)</label>
                  <input
                    disabled={isSystemTemplate}
                    className={`w-full border border-gray-300 p-1.5 rounded-md text-xs ${
                      isSystemTemplate ? "bg-gray-100 text-gray-600 cursor-not-allowed" : "bg-white text-gray-800"
                    }`}
                    value={f.options.join(",")}
                    onChange={(e) => updateField(i, "options", e.target.value.split(",").map(o=>o.trim()))}
                  />
                </div>
              )}
              <div className="mt-2.5 flex items-center justify-between text-xs">
                <label className="flex items-center text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    id={`req-${i}`}
                    disabled={isSystemTemplate}
                    checked={f.required}
                    onChange={(e) => updateField(i, "required", e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 font-medium">Campo obligatorio</span>
                </label>
                <span className="text-[11px] font-mono text-gray-400">ID: {f.id}</span>
              </div>
            </div>
          ))}

          {!isSystemTemplate ? (
            <button
              onClick={addField}
              className="w-full border-2 border-dashed border-gray-300 text-gray-500 py-2.5 rounded-xl hover:bg-gray-100 transition text-xs font-semibold cursor-pointer"
            >
              + Añadir Campo
            </button>
          ) : (
            <div className="p-3 bg-gray-100 border border-gray-200 rounded-xl text-center text-xs text-gray-500">
              Campos base bloqueados por el estándar FamilySearch.
            </div>
          )}
        </div>
        
        {/* Save button or Duplication callout */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          {isSystemTemplate ? (
            <button
              type="button"
              onClick={duplicateTemplate}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <Copy className="w-4 h-4" />
              <span>Duplicar para personalizar</span>
            </button>
          ) : (
            <button
              onClick={saveTemplate}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-sm font-semibold transition cursor-pointer shadow-sm"
            >
              Guardar Plantilla
            </button>
          )}
        </div>
      </div>

      {/* Live Preview Panel */}
      <div className="w-1/2 p-6 overflow-y-auto bg-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-800">Vista Previa Interactiva</h3>
          {isSystemTemplate && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              <ShieldCheck className="w-3.5 h-3.5" />
              Estándar Oficial
            </span>
          )}
        </div>
        <div className="border border-gray-200 p-5 rounded-2xl bg-gray-50/50 shadow-2xs">
          <h4 className="text-lg font-bold mb-4 text-center text-gray-900 border-b pb-3">
            {name || "Sin Nombre Asignado"}
          </h4>
          <div className="space-y-4">
            {fields.length === 0 ? (
              <p className="text-gray-400 text-center text-sm py-8">No hay campos configurados para previsualizar</p>
            ) : fields.map((f, i) => (
              <div key={i} className="space-y-1">
                <label className="block text-xs font-semibold text-gray-700">
                  {f.label} {f.required && <span className="text-red-500">*</span>}
                </label>
                {f.type === "long_text" ? (
                  <textarea className="w-full border border-gray-300 p-2 rounded-lg text-sm bg-white text-gray-500" disabled placeholder="Texto largo descriptivo..." />
                ) : f.type === "dropdown" ? (
                  <select className="w-full border border-gray-300 p-2 rounded-lg text-sm bg-white text-gray-500" disabled>
                    <option>-- Seleccionar opción --</option>
                    {f.options.map((o, j) => <option key={j}>{o}</option>)}
                  </select>
                ) : f.type === "date" ? (
                  <input type="date" className="w-full border border-gray-300 p-2 rounded-lg text-sm bg-white text-gray-500" disabled />
                ) : (
                  <input type="text" className="w-full border border-gray-300 p-2 rounded-lg text-sm bg-white text-gray-500" disabled placeholder="Texto corto..." />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
