import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";

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
    if (fields.length >= 40) {
      alert("Límite máximo de 40 campos.");
      return;
    }
    setFields([...fields, { id: "nuevo_campo", label: "Nuevo Campo", type: "text", required: false, options: [] }]);
  };

  const updateField = (index: number, key: keyof Field, value: any) => {
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
    if (index + dir < 0 || index + dir >= fields.length) return;
    const newFields = [...fields];
    const temp = newFields[index];
    newFields[index] = newFields[index + dir];
    newFields[index + dir] = temp;
    setFields(newFields);
  };

  const removeField = (index: number) => {
    const newFields = [...fields];
    newFields.splice(index, 1);
    setFields(newFields);
  };

  const saveTemplate = async () => {
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
      alert("Plantilla guardada");
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
        { id: "nombre_padre", label: "Nombre del Padre", type: "text", required: true, options: [] }
      ]);
      setName("Plantilla Bautismo");
    } else {
      setFields([
        { id: "nombre_difunto", label: "Nombre del Difunto", type: "text", required: true, options: [] },
        { id: "fecha_defuncion", label: "Fecha de Defunción", type: "date", required: true, options: [] }
      ]);
      setName("Plantilla Defunción");
    }
    setSelectedTemplateId("");
  };

  return (
    <div className="flex h-[80vh] border rounded-lg overflow-hidden bg-white">
      {/* Builder Panel */}
      <div className="w-1/2 border-r p-4 overflow-y-auto bg-gray-50 flex flex-col">
        <h3 className="text-xl font-bold mb-4">Builder</h3>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Seleccionar o Crear</label>
          <select 
            className="w-full border p-2 rounded mb-2"
            value={selectedTemplateId}
            onChange={(e) => loadTemplate(e.target.value)}
          >
            <option value="">-- Nueva Plantilla --</option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <div className="flex space-x-2">
            <button onClick={() => loadMaster("bautismo")} className="bg-blue-100 text-blue-700 px-3 py-1 rounded text-sm">Maestra: Bautismo</button>
            <button onClick={() => loadMaster("defuncion")} className="bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm">Maestra: Defunción</button>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Nombre de la Plantilla</label>
          <input 
            className="w-full border p-2 rounded" 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            placeholder="Ej. Matrimonios 2024"
          />
        </div>

        <div className="flex-1 space-y-4">
          {fields.map((f, i) => (
            <div key={i} className="border p-3 rounded bg-white shadow-sm relative">
              <div className="absolute top-2 right-2 flex space-x-1">
                <button onClick={() => moveField(i, -1)} className="text-gray-500 hover:bg-gray-100 px-2 rounded">↑</button>
                <button onClick={() => moveField(i, 1)} className="text-gray-500 hover:bg-gray-100 px-2 rounded">↓</button>
                <button onClick={() => removeField(i)} className="text-red-500 hover:bg-red-100 px-2 rounded">x</button>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500">Label</label>
                  <input className="w-full border p-1 rounded text-sm" value={f.label} onChange={(e) => updateField(i, "label", e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500">Tipo</label>
                  <select className="w-full border p-1 rounded text-sm" value={f.type} onChange={(e) => updateField(i, "type", e.target.value)}>
                    <option value="text">Texto Corto</option>
                    <option value="long_text">Texto Largo</option>
                    <option value="date">Fecha</option>
                    <option value="dropdown">Dropdown</option>
                  </select>
                </div>
              </div>
              {f.type === "dropdown" && (
                <div className="mt-2">
                  <label className="block text-xs font-medium text-gray-500">Opciones (separadas por comas)</label>
                  <input className="w-full border p-1 rounded text-sm" value={f.options.join(",")} onChange={(e) => updateField(i, "options", e.target.value.split(",").map(o=>o.trim()))} />
                </div>
              )}
              <div className="mt-2 flex items-center">
                <input type="checkbox" id={`req-${i}`} checked={f.required} onChange={(e) => updateField(i, "required", e.target.checked)} />
                <label htmlFor={`req-${i}`} className="ml-2 text-xs text-gray-700">Requerido</label>
              </div>
              <div className="mt-2 text-xs text-gray-400">ID: {f.id}</div>
            </div>
          ))}
          <button onClick={addField} className="w-full border-2 border-dashed border-gray-300 text-gray-500 p-2 rounded hover:bg-gray-50">+ Añadir Campo</button>
        </div>
        
        <div className="mt-4 pt-4 border-t">
          <button onClick={saveTemplate} className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700">
            Guardar Plantilla
          </button>
        </div>
      </div>

      {/* Live Preview Panel */}
      <div className="w-1/2 p-6 overflow-y-auto">
        <h3 className="text-xl font-bold mb-4">Live Preview</h3>
        <div className="border p-4 rounded bg-white shadow">
          <h4 className="text-lg font-semibold mb-4 text-center">{name || "Sin Nombre"}</h4>
          <div className="space-y-4">
            {fields.length === 0 ? (
              <p className="text-gray-400 text-center text-sm">No hay campos para previsualizar</p>
            ) : fields.map((f, i) => (
              <div key={i}>
                <label className="block text-sm font-medium mb-1">
                  {f.label} {f.required && <span className="text-red-500">*</span>}
                </label>
                {f.type === "long_text" ? (
                  <textarea className="w-full border p-2 rounded" disabled placeholder="Texto largo..." />
                ) : f.type === "dropdown" ? (
                  <select className="w-full border p-2 rounded" disabled>
                    <option>-- Seleccionar --</option>
                    {f.options.map((o, j) => <option key={j}>{o}</option>)}
                  </select>
                ) : f.type === "date" ? (
                  <input type="date" className="w-full border p-2 rounded text-gray-500" disabled />
                ) : (
                  <input type="text" className="w-full border p-2 rounded" disabled placeholder="Texto corto..." />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
