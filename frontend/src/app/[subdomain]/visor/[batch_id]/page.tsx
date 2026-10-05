"use client";

import React, { useEffect, useRef, useState } from "react";
import OpenSeadragon from "openseadragon";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";

// Simulated fetch from DB for the batch, template schema, and current folio
const mockData = {
  dziUrl: "https://example.com/dzi/sample.dzi",
  templateSchema: {
    title: "z.string()",
    date: "z.string()",
    amount: "z.number()",
  },
  ai_predictions: [
    { field_name: "title", xmin: 500, ymin: 500, xmax: 800, ymax: 600 },
    { field_name: "date", xmin: 1000, ymin: 500, xmax: 1200, ymax: 600 },
    { field_name: "amount", xmin: 500, ymin: 700, xmax: 700, ymax: 800 },
  ]
};

// Dynamic schema generation based on mock
const generateSchema = (schemaDef: any) => {
  return z.object({
    title: z.string().min(1, "Title is required"),
    date: z.string().min(1, "Date is required"),
    amount: z.number().min(0, "Amount must be positive"),
  });
};

export default function VisorDualPage({ params }: { params: { subdomain: string; batch_id: string } }) {
  const osdRef = useRef<HTMLDivElement>(null);
  const [viewer, setViewer] = useState<OpenSeadragon.Viewer | null>(null);
  const router = useRouter();

  const DynamicFormSchema = generateSchema(mockData.templateSchema);
  type FormData = z.infer<typeof DynamicFormSchema>;

  const methods = useForm<FormData>({
    resolver: zodResolver(DynamicFormSchema),
  });

  useEffect(() => {
    if (osdRef.current && !viewer) {
      const newViewer = OpenSeadragon({
        element: osdRef.current,
        prefixUrl: "//openseadragon.github.io/openseadragon/images/",
        tileSources: mockData.dziUrl,
        showNavigationControl: true,
        animationTime: 0.5,
        blendTime: 0.1,
        constrainDuringPan: true,
        maxZoomPixelRatio: 2,
        minZoomImageRatio: 1,
        visibilityRatio: 1,
        zoomPerScroll: 2,
      });

      newViewer.addHandler("open", () => {
        if (mockData.ai_predictions && mockData.ai_predictions.length > 0) {
          mockData.ai_predictions.forEach((pred, index) => {
            const elt = document.createElement("div");
            elt.id = `overlay-${index}`;
            elt.style.border = "2px solid rgba(0, 122, 255, 0.6)";
            elt.style.backgroundColor = "rgba(0, 122, 255, 0.2)";
            elt.style.pointerEvents = "none"; // allow clicking through if necessary
            elt.title = pred.field_name;

            // Assuming coordinates are in image pixels
            const rect = newViewer.viewport.imageToViewportRectangle(
              new OpenSeadragon.Rect(
                pred.xmin,
                pred.ymin,
                pred.xmax - pred.xmin,
                pred.ymax - pred.ymin
              )
            );

            newViewer.addOverlay({
              element: elt,
              location: rect,
            });
          });
        }
      });

      setViewer(newViewer);
    }

    return () => {
      if (viewer) {
        viewer.destroy();
      }
    };
  }, [viewer]);

  const processNextFolio = async (status: "completed" | "revision", data?: any) => {
    console.log("Mock: Descontando 1 de la cuota diaria");
    console.log(`Mock: Actualizando folio a estado ${status}`, data);
    
    // Simulate checking for next pending folios
    const hasMorePending = Math.random() > 0.5; // Mock randomness
    if (hasMorePending) {
      console.log("Mock: Cargando folio siguiente...");
      methods.reset();
    } else {
      console.log("Mock: No hay más folios pending, redirigiendo al dashboard...");
      router.push(`/${params.subdomain}/dashboard`);
    }
  };

  const handleFocus = (fieldName: string) => {
    if (!viewer) return;
    const prediction = mockData.ai_predictions?.find(p => p.field_name === fieldName);
    if (prediction) {
      const rect = viewer.viewport.imageToViewportRectangle(
        new OpenSeadragon.Rect(
          prediction.xmin,
          prediction.ymin,
          prediction.xmax - prediction.xmin,
          prediction.ymax - prediction.ymin
        )
      );
      viewer.viewport.fitBounds(rect);
    }
  };

  const onSubmit = (data: FormData) => {
    processNextFolio("completed", data);
  };

  const onDoubt = () => {
    processNextFolio("revision");
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + Enter to Save
      if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        methods.handleSubmit(onSubmit)();
      }
      // Ctrl + Space to mark as Doubt
      if (e.ctrlKey && e.code === "Space") {
        e.preventDefault();
        onDoubt();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [methods]);

  return (
    <div className="flex h-screen w-full bg-gray-100 overflow-hidden">
      {/* Left: OpenSeadragon Viewer */}
      <div className="w-1/2 h-full border-r border-gray-300 relative bg-black">
        <div ref={osdRef} className="absolute inset-0" />
      </div>

      {/* Right: Dynamic Form */}
      <div className="w-1/2 h-full bg-white p-8 overflow-y-auto">
        <h1 className="text-2xl font-bold mb-6 text-gray-800">
          Captura de Datos - {params.batch_id}
        </h1>
        
        <p className="text-sm text-gray-500 mb-6">
          Atajos: <kbd className="bg-gray-200 px-1 rounded">Ctrl + Enter</kbd> para Guardar | <kbd className="bg-gray-200 px-1 rounded">Ctrl + Espacio</kbd> para Dudar
        </p>

        <FormProvider {...methods}>
          <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Título</label>
              <input
                {...methods.register("title")}
                onFocus={() => handleFocus("title")}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                placeholder="Ingrese título"
              />
              {methods.formState.errors.title && (
                <p className="mt-1 text-sm text-red-600">{methods.formState.errors.title.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Fecha</label>
              <input
                type="date"
                {...methods.register("date")}
                onFocus={() => handleFocus("date")}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
              />
              {methods.formState.errors.date && (
                <p className="mt-1 text-sm text-red-600">{methods.formState.errors.date.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Monto</label>
              <input
                type="number"
                {...methods.register("amount", { valueAsNumber: true })}
                onFocus={() => handleFocus("amount")}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
              />
              {methods.formState.errors.amount && (
                <p className="mt-1 text-sm text-red-600">{methods.formState.errors.amount.message}</p>
              )}
            </div>

            <div className="pt-4 flex justify-end space-x-4">
              <button
                type="button"
                onClick={onDoubt}
                className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-gray-500 hover:bg-gray-600"
              >
                Dudar
              </button>
              <button
                type="submit"
                className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Guardar
              </button>
            </div>
          </form>
        </FormProvider>
      </div>
    </div>
  );
}
