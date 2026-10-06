"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SuperadminOnboardingPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    weekly_limit: "",
    email: "",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      // Usar localStorage o context según cómo la app guarde el token
      const token = localStorage.getItem("accessToken") || "";

      const res = await fetch("/api/superadmin/tenants", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formData.name,
          weekly_limit: parseInt(formData.weekly_limit, 10),
          email: formData.email,
        }),
      });

      if (!res.ok) {
        throw new Error("Error al crear el tenant");
      }

      setMessage({ type: "success", text: "Cliente creado exitosamente." });
      setFormData({ name: "", weekly_limit: "", email: "" });
      
      // Opcional, redirigir después de un tiempo
      // setTimeout(() => router.push("/superadmin"), 2000);
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Ocurrió un error inesperado." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Nuevo Cliente (Onboarding)</h1>
      
      {message && (
        <div className={`p-4 mb-4 rounded ${message.type === "success" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Nombre de la Organización</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className="w-full border rounded p-2"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Cuota Semanal Inicial</label>
          <input
            type="number"
            name="weekly_limit"
            value={formData.weekly_limit}
            onChange={handleChange}
            className="w-full border rounded p-2"
            min="1"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Email del Administrador</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className="w-full border rounded p-2"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Creando..." : "Crear Cliente"}
        </button>
      </form>
    </div>
  );
}
