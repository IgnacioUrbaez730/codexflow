"use client";

import { useState } from "react";
import { generateUploadUrl } from "../../actions/uploadActions";

export default function UploadPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setMessage("Selecciona al menos un archivo.");
      return;
    }

    // Validations
    let isPdf = false;
    let isImages = false;

    for (const file of files) {
      if (file.type === "application/pdf") {
        isPdf = true;
      } else if (file.type.startsWith("image/")) {
        isImages = true;
      } else {
        setMessage("Solo se permiten PDFs o imágenes.");
        return;
      }
    }

    if (isPdf && isImages) {
      setMessage("No puedes mezclar PDFs e imágenes.");
      return;
    }

    if (isPdf) {
      if (files.length > 1) {
        setMessage("Solo puedes subir 1 PDF a la vez.");
        return;
      }
      if (files[0].size > 50 * 1024 * 1024) {
        setMessage("El PDF no puede superar los 50MB.");
        return;
      }
    }

    if (isImages) {
      if (files.length > 20) {
        setMessage("Puedes subir máximo 20 imágenes a la vez.");
        return;
      }
      for (const file of files) {
        if (file.size > 5 * 1024 * 1024) {
          setMessage(`La imagen ${file.name} supera los 5MB.`);
          return;
        }
      }
    }

    setIsUploading(true);
    setMessage("");

    try {
      for (const file of files) {
        const { signedUrl } = await generateUploadUrl(file.name, file.type);
        
        const response = await fetch(signedUrl, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file.type,
          },
        });

        if (!response.ok) {
          throw new Error(`Error subiendo el archivo ${file.name}`);
        }
      }
      setMessage("Archivos subidos exitosamente.");
    } catch (error: any) {
      setMessage(error.message || "Ocurrió un error al subir.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-8 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Subir Archivos</h1>
      
      <div className="mb-4">
        <input 
          type="file" 
          multiple 
          accept="image/*,.pdf" 
          onChange={handleFileChange} 
          className="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-md file:border-0
            file:text-sm file:font-semibold
            file:bg-blue-50 file:text-blue-700
            hover:file:bg-blue-100"
        />
      </div>

      <button
        onClick={handleUpload}
        disabled={isUploading}
        className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        {isUploading ? "Subiendo..." : "Subir a R2"}
      </button>

      {message && (
        <div className="mt-4 p-4 rounded bg-gray-100 text-gray-800">
          {message}
        </div>
      )}
    </div>
  );
}
