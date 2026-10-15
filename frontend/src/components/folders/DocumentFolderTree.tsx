"use client";

import React, { useState } from "react";
import { 
  Church, 
  Landmark, 
  Folder, 
  FolderOpen, 
  BookOpen, 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  Pencil, 
  Layers
} from "lucide-react";
import { DocumentFolder, FolderType } from "./types";

interface DocumentFolderTreeProps {
  tree: DocumentFolder[];
  selectedFolderId?: string | null;
  onSelectFolder: (folder: DocumentFolder) => void;
  onCreateFolder?: (parent?: DocumentFolder | null) => void;
  onEditFolder?: (folder: DocumentFolder) => void;
  userRole?: string;
  loading?: boolean;
}

export default function DocumentFolderTree({
  tree,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onEditFolder,
  userRole = "digitizer",
  loading = false,
}: DocumentFolderTreeProps) {
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  const canManage = userRole === "admin" || userRole === "archivist" || userRole === "superadmin";

  const toggleExpand = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodes((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  };

  const getFolderIcon = (type: FolderType, isExpanded: boolean) => {
    switch (type) {
      case "root":
        return <Church className="w-4 h-4 text-amber-700 shrink-0" />;
      case "parish":
        return <Landmark className="w-4 h-4 text-blue-700 shrink-0" />;
      case "series":
        return isExpanded ? (
          <FolderOpen className="w-4 h-4 text-indigo-600 shrink-0" />
        ) : (
          <Folder className="w-4 h-4 text-indigo-500 shrink-0" />
        );
      case "tome":
        return <BookOpen className="w-4 h-4 text-emerald-600 shrink-0" />;
      default:
        return <Folder className="w-4 h-4 text-gray-500 shrink-0" />;
    }
  };

  const getTypeBadge = (type: FolderType) => {
    switch (type) {
      case "root":
        return (
          <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-800 rounded">
            Fondo / Diócesis
          </span>
        );
      case "parish":
        return (
          <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-800 rounded">
            Parroquia
          </span>
        );
      case "series":
        return (
          <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-indigo-100 text-indigo-800 rounded">
            Serie
          </span>
        );
      case "tome":
        return (
          <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-800 rounded">
            Tomo
          </span>
        );
      default:
        return null;
    }
  };

  const renderNode = (node: DocumentFolder, level: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    // Default: root and parish expanded automatically unless toggled off
    const isExpanded = expandedNodes[node.id] !== undefined 
      ? expandedNodes[node.id] 
      : (level < 2);

    const isSelected = selectedFolderId === node.id;
    const isTome = node.folder_type === "tome";

    return (
      <div key={node.id} className="select-none">
        <div
          onClick={() => onSelectFolder(node)}
          style={{ paddingLeft: `${Math.max(level * 16 + 6, 6)}px` }}
          className={`group flex items-center justify-between pr-2 py-1.5 text-sm rounded cursor-pointer transition-colors ${
            isSelected
              ? "bg-blue-100 text-blue-900 font-semibold"
              : "hover:bg-gray-100 text-gray-800"
          }`}
        >
          <div className="flex items-center space-x-1.5 min-w-0 flex-1 mr-2">
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => toggleExpand(node.id, e)}
                className="p-0.5 hover:bg-gray-200 rounded text-gray-500"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
            ) : (
              <span className="w-4 inline-block" />
            )}

            {getFolderIcon(node.folder_type, isExpanded)}

            <span className="truncate text-xs font-medium" title={node.name}>
              {node.name}
            </span>

            {node.metadata?.is_virtual_unclassified && (
              <span className="px-1 py-0.2 text-[9px] bg-yellow-200 text-yellow-900 rounded font-normal">
                Virtual
              </span>
            )}
          </div>

          <div className="flex items-center space-x-1 shrink-0">
            {getTypeBadge(node.folder_type)}

            {typeof node.total_folios === "number" && (
              <span
                className={`px-1.5 py-0.5 text-[10px] rounded-full font-mono ${
                  node.total_folios > 0
                    ? "bg-slate-200 text-slate-700"
                    : "bg-gray-100 text-gray-400"
                }`}
                title={`${node.total_folios} folios asignados`}
              >
                {node.total_folios} {node.total_folios === 1 ? "fol" : "fols"}
              </span>
            )}

            {canManage && (
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-0.5">
                {onEditFolder && !node.metadata?.is_virtual_unclassified && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditFolder(node);
                    }}
                    title="Editar Tomo/Carpeta"
                    className="p-1 hover:bg-blue-200 text-blue-700 rounded"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
                {onCreateFolder && !isTome && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCreateFolder(node);
                    }}
                    title="Añadir subcarpeta/tomo"
                    className="p-1 hover:bg-green-200 text-green-700 rounded"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="border-l border-gray-200 ml-4">
            {node.children!.map((child) => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white border rounded-lg shadow-sm p-3 flex flex-col h-full">
      <div className="flex items-center justify-between pb-3 border-b mb-3">
        <div className="flex items-center space-x-2">
          <Layers className="w-5 h-5 text-gray-700" />
          <h3 className="font-semibold text-sm text-gray-800">
            Estructura Documental
          </h3>
        </div>
        {canManage && onCreateFolder && (
          <button
            type="button"
            onClick={() => onCreateFolder(null)}
            className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded shadow-sm transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nueva Carpeta / Tomo</span>
          </button>
        )}
      </div>

      <div className="overflow-y-auto flex-1 pr-1 space-y-0.5">
        {loading ? (
          <div className="py-8 text-center text-xs text-gray-400">
            Cargando estructura de carpetas...
          </div>
        ) : tree.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-500">
            No se han registrado carpetas documentales aún.
            {canManage && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => onCreateFolder && onCreateFolder(null)}
                  className="text-blue-600 hover:underline"
                >
                  Crear la primera carpeta raíz
                </button>
              </div>
            )}
          </div>
        ) : (
          tree.map((node) => renderNode(node, 0))
        )}
      </div>
    </div>
  );
}
