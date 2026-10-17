"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

import { 
  AlertCircle, 
  BookOpen, 
  Folder, 
  Layers, 
  MoveRight, 
  CheckSquare, 
  Square, 
  Pencil, 
  ExternalLink,
  Plus,
  Download,
  Trash2
} from "lucide-react";
import TemplateBuilder from "./TemplateBuilder";
import DocumentFolderTree from "@/components/folders/DocumentFolderTree";
import CreateFolderModal from "@/components/folders/CreateFolderModal";
import ExportFamilySearchModal from "@/components/folders/ExportFamilySearchModal";
import { DocumentFolder, FolioItem } from "@/components/folders/types";

export default function IngestHub() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
  const router = useRouter();
  const params = useParams();
  const subdomain = params.subdomain as string;
  const [activeTab, setActiveTab] = useState("folders");
  const [userRole, setUserRole] = useState<string>("");
  const [tenantId, setTenantId] = useState<string>("");

  // States for the UI
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [recentBatches, setRecentBatches] = useState<any[]>([]);
  const [revisionFolios, setRevisionFolios] = useState<any[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [loadingRevision, setLoadingRevision] = useState(false);

  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // SPEC-012: Folder / Tome states
  const [folderTree, setFolderTree] = useState<DocumentFolder[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<DocumentFolder | null>(null);

  const [folderFolios, setFolderFolios] = useState<FolioItem[]>([]);
  const [loadingFolderFolios, setLoadingFolderFolios] = useState(false);

  const [unclassifiedFolios, setUnclassifiedFolios] = useState<FolioItem[]>([]);
  const [loadingUnclassified, setLoadingUnclassified] = useState(false);
  const [selectedUnclassifiedIds, setSelectedUnclassifiedIds] = useState<string[]>([]);
  const [isMovingFolios, setIsMovingFolios] = useState(false);

  // Tome assignment during batch upload
  const [selectedUploadTomeId, setSelectedUploadTomeId] = useState<string>("");

  // Modal create/edit states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [folderToEdit, setFolderToEdit] = useState<DocumentFolder | null>(null);
  const [parentForCreate, setParentForCreate] = useState<DocumentFolder | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [userToken, setUserToken] = useState<string | null>(null);

  // Modal delete folder states
  const [isDeleteFolderModalOpen, setIsDeleteFolderModalOpen] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<DocumentFolder | null>(null);
  const [isDeletingFolder, setIsDeletingFolder] = useState(false);

  const canManageFolders = userRole === "admin" || userRole === "archivist" || userRole === "superadmin";

  // Recursively extract all tomes from tree for dropdowns
  const availableTomes = useMemo(() => {
    const tomes: DocumentFolder[] = [];
    const traverse = (nodes: DocumentFolder[]) => {
      for (const node of nodes) {
        const isUnclass =
          Boolean(node.metadata?.is_virtual_unclassified) ||
          Boolean(node.metadata?.system_managed) ||
          Boolean(node.name?.toLowerCase().includes("sin clasificar"));
        if (node.folder_type === "tome" && !isUnclass) {
          tomes.push(node);
        }
        if (node.children && node.children.length > 0) {
          traverse(node.children);
        }
      }
    };
    traverse(folderTree);
    return tomes;
  }, [folderTree]);

  // Virtual unclassified folder ID if exists
  const unclassifiedFolderId = useMemo(() => {
    let foundId: string | null = null;
    const traverse = (nodes: DocumentFolder[]) => {
      for (const node of nodes) {
        const isUnclass =
          Boolean(node.metadata?.is_virtual_unclassified) ||
          Boolean(node.metadata?.system_managed) ||
          Boolean(node.name?.toLowerCase().includes("sin clasificar"));
        if (isUnclass) {
          foundId = node.id;
          return;
        }
        if (node.children && node.children.length > 0) {
          traverse(node.children);
        }
      }
    };
    traverse(folderTree);
    return foundId;
  }, [folderTree]);

  const fetchFoldersTree = useCallback(async (explicitTenantId?: string) => {
    setLoadingFolders(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      setUserToken(token);

      const tid = explicitTenantId || tenantId;
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      if (tid) {
        headers["X-Tenant-ID"] = tid;
      }

      const res = await fetch("/api/v1/folders/tree", {
        headers,
      });

      if (res.ok) {
        const json = await res.json();
        let treeData: DocumentFolder[] = json.data || [];
        
        // Al detectar la carpeta 'Sin Clasificar', asegurar que su contador de folios refleje los folios que contiene
        const syncUnclassified = (nodes: DocumentFolder[]): DocumentFolder[] => {
          return nodes.map((node) => {
            const isUnclass =
              Boolean(node.metadata?.is_virtual_unclassified) ||
              Boolean(node.metadata?.system_managed) ||
              Boolean(node.name?.toLowerCase().includes("sin clasificar"));
            const updated = { ...node };
            if (isUnclass && typeof updated.total_folios !== "number") {
              updated.total_folios = 0;
            }
            if (updated.children && updated.children.length > 0) {
              updated.children = syncUnclassified(updated.children);
            }
            return updated;
          });
        };
        treeData = syncUnclassified(treeData);
        setFolderTree(treeData);

        // Keep or select initial folder
        setSelectedFolder((prev) => {
          if (!prev) {
            // Find first tome or root
            let initial: DocumentFolder | null = null;
            const findFirst = (nodes: DocumentFolder[]) => {
              for (const n of nodes) {
                if (n.folder_type === "tome") {
                  initial = n;
                  return;
                }
                if (n.children && n.children.length > 0) {
                  findFirst(n.children);
                }
              }
            };
            findFirst(treeData);
            return initial || treeData[0] || null;
          }
          return prev;
        });
      }
    } catch (err) {
      console.error("Error cargando árbol de carpetas:", err);
    } finally {
      setLoadingFolders(false);
    }
  }, [supabase, tenantId]);

  const fetchFolderFolios = useCallback(async (folderId: string) => {
    setLoadingFolderFolios(true);
    try {
      let query = supabase
        .from("folios")
        .select("*, batches(id, template_id, templates(name))");

      if (unclassifiedFolderId && folderId === unclassifiedFolderId) {
        query = query.or(`folder_id.is.null,folder_id.eq.${folderId}`);
      } else {
        query = query.eq("folder_id", folderId);
      }

      if (tenantId) {
        query = query.eq("tenant_id", tenantId);
      }

      const { data, error } = await query.order("sequence_order", { ascending: true });

      if (!error && data) {
        setFolderFolios(data as FolioItem[]);
      } else {
        setFolderFolios([]);
      }
    } catch (err) {
      console.error("Error cargando folios de la carpeta:", err);
      setFolderFolios([]);
    } finally {
      setLoadingFolderFolios(false);
    }
  }, [supabase, tenantId, unclassifiedFolderId]);

  const fetchUnclassifiedFolios = useCallback(async () => {
    setLoadingUnclassified(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      let foliosData: FolioItem[] | null = null;

      // 1. Intentar llamar al endpoint dedicado en backend
      if (token) {
        try {
          const headers: Record<string, string> = {
            Authorization: `Bearer ${token}`,
          };
          if (tenantId) {
            headers["X-Tenant-ID"] = tenantId;
          }
          const res = await fetch("/api/v1/folders/unclassified-folios", { headers });
          if (res.ok) {
            const json = await res.json();
            if (json.status === "success" && Array.isArray(json.data)) {
              foliosData = json.data as FolioItem[];
            }
          }
        } catch (fetchErr) {
          console.warn("Fallback a Supabase directo para folios sin clasificar:", fetchErr);
        }
      }

      // 2. Si falló el endpoint o no hay token, fallback a consulta directa en Supabase
      if (!foliosData) {
        let query = supabase
          .from("folios")
          .select("*, batches(id, template_id, templates(name))");

        if (tenantId) {
          query = query.eq("tenant_id", tenantId);
        }

        if (unclassifiedFolderId) {
          query = query.or(`folder_id.is.null,folder_id.eq.${unclassifiedFolderId}`);
        } else {
          query = query.is("folder_id", null);
        }

        const { data, error } = await query.order("created_at", { ascending: false }).limit(50);

        if (!error && data) {
          foliosData = data as FolioItem[];
        } else {
          foliosData = [];
        }
      }

      setUnclassifiedFolios(foliosData);

      // Sincronizar el contador en folderTree para reflejar los folios que contiene la carpeta 'Sin Clasificar'
      setFolderTree((prevTree) => {
        const updateTreeCounts = (nodes: DocumentFolder[]): DocumentFolder[] => {
          return nodes.map((node) => {
            const isUnclass =
              Boolean(node.metadata?.is_virtual_unclassified) ||
              Boolean(node.metadata?.system_managed) ||
              Boolean(node.name?.toLowerCase().includes("sin clasificar"));
            const updated = { ...node };
            if (isUnclass) {
              updated.total_folios = foliosData!.length;
            }
            if (updated.children && updated.children.length > 0) {
              updated.children = updateTreeCounts(updated.children);
            }
            return updated;
          });
        };
        return updateTreeCounts(prevTree);
      });
    } catch (err) {
      console.error("Error cargando folios sin clasificar:", err);
      setUnclassifiedFolios([]);
    } finally {
      setLoadingUnclassified(false);
    }
  }, [supabase, tenantId, unclassifiedFolderId]);

  const fetchRecentBatches = async () => {
    setLoadingBatches(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      let fetchedBatches: any[] = [];
      if (token) {
        try {
          const res = await fetch("/api/v1/batches", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            fetchedBatches = Array.isArray(data) ? data : data.data || [];
          }
        } catch (fetchErr) {
          console.warn("Fallback a Supabase directo para batches:", fetchErr);
        }
      }

      if (fetchedBatches.length === 0) {
        const { data, error } = await supabase
          .from("batches")
          .select("id, template_id, status, created_at, templates(name)")
          .order("created_at", { ascending: false });
        if (!error && data) {
          fetchedBatches = data;
        }
      }

      setRecentBatches(fetchedBatches);
    } catch (err) {
      console.error("Error cargando lotes recientes:", err);
    } finally {
      setLoadingBatches(false);
    }
  };

  const fetchDudosos = async () => {
    setLoadingRevision(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      let fetchedFolios: any[] = [];
      if (token) {
        try {
          const res = await fetch("/api/v1/folios/revision", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            fetchedFolios = Array.isArray(data) ? data : data.data || [];
          }
        } catch (fetchErr) {
          console.warn("Fallback a Supabase directo para folios en revisión:", fetchErr);
        }
      }

      if (fetchedFolios.length === 0) {
        const { data, error } = await supabase
          .from("folios")
          .select("*, batches(id, template_id, uploaded_by, templates(name))")
          .eq("status", "revision")
          .order("created_at", { ascending: false });

        if (!error && data) {
          if (userRole === "archivist" && session?.user?.id) {
            fetchedFolios = data.filter((f: any) => f.batches?.uploaded_by === session.user.id);
          } else {
            fetchedFolios = data;
          }
        }
      }

      setRevisionFolios(fetchedFolios);
    } catch (err) {
      console.error("Error cargando folios dudosos:", err);
    } finally {
      setLoadingRevision(false);
    }
  };

  useEffect(() => {
    // Fetch user role & tenant
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const res = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUserRole(data.role);
        }

        const { data: profile } = await supabase
          .from("user_profiles")
          .select("tenant_id")
          .eq("user_id", session.user.id)
          .single();

        let resolvedTenantId = profile?.tenant_id;
        if (!resolvedTenantId && subdomain) {
          const { data: tenantData } = await supabase
            .from("tenants")
            .select("id")
            .eq("subdomain", subdomain)
            .single();
          if (tenantData?.id) {
            resolvedTenantId = tenantData.id;
          }
        }

        if (resolvedTenantId) {
          setTenantId(resolvedTenantId);
          fetchFoldersTree(resolvedTenantId);
        }
      }
    };
    const fetchTemplates = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const res = await fetch("/api/v1/templates", {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              ...(tenantId ? { "X-Tenant-ID": tenantId } : {}),
            },
          });
          if (res.ok) {
            const resData = await res.json();
            if (resData.status === "success" && Array.isArray(resData.data)) {
              setTemplates(resData.data);
              return;
            }
          }
        }
      } catch (e) {
        console.warn("Fallback to Supabase direct fetch for templates:", e);
      }

      // Fallback query: tenant templates OR system templates
      let query = supabase.from("templates").select("id, name, is_system_template");
      if (tenantId) {
        query = query.or(`tenant_id.eq.${tenantId},is_system_template.eq.true`);
      } else {
        query = query.or("is_system_template.eq.true");
      }
      const { data, error } = await query;
      if (error) console.error("Error cargando plantillas:", error);
      if (data && !error) {
        setTemplates(data);
      }
    };
    fetchUser();
    fetchTemplates();
    fetchFoldersTree();
  }, [fetchFoldersTree, supabase]);

  useEffect(() => {
    if (activeTab === "upload") {
      fetchRecentBatches();
    } else if (activeTab === "revision") {
      fetchDudosos();
    } else if (activeTab === "folders") {
      fetchFoldersTree();
      fetchUnclassifiedFolios();
    }
  }, [activeTab, fetchFoldersTree, fetchUnclassifiedFolios]);

  useEffect(() => {
    if (selectedFolder) {
      fetchFolderFolios(selectedFolder.id);
    } else {
      setFolderFolios([]);
    }
  }, [selectedFolder, fetchFolderFolios]);

  // Tome selection in Upload tab
  const handleSelectUploadTome = (tomeId: string) => {
    setSelectedUploadTomeId(tomeId);
    if (!tomeId) return;
    const tome = availableTomes.find((t) => t.id === tomeId);
    if (tome?.metadata?.template_id) {
      setSelectedTemplate(tome.metadata.template_id);
    }
  };

  // Assign selected unclassified folios to active tome
  const handleAssignFoliosToCurrentTome = async () => {
    if (!selectedFolder || selectedFolder.folder_type !== "tome") {
      alert("Por favor selecciona un Tomo en el árbol para recibir los folios.");
      return;
    }
    if (selectedUnclassifiedIds.length === 0) {
      alert("Selecciona al menos un folio sin clasificar.");
      return;
    }

    setIsMovingFolios(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("No hay sesión activa.");

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };
      if (tenantId) {
        headers["X-Tenant-ID"] = tenantId;
      }

      const res = await fetch(`/api/v1/folders/${selectedFolder.id}/assign-folios`, {
        method: "POST",
        headers,
        body: JSON.stringify({ folio_ids: selectedUnclassifiedIds }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || "Error reasignando folios.");
      }

      alert(`¡${selectedUnclassifiedIds.length} folio(s) asignados al tomo ${selectedFolder.name}!`);
      setSelectedUnclassifiedIds([]);
      fetchFolderFolios(selectedFolder.id);
      fetchUnclassifiedFolios();
      fetchFoldersTree();
    } catch (err: any) {
      alert(`Error al mover folios: ${err.message}`);
    } finally {
      setIsMovingFolios(false);
    }
  };

  // Delete folder logic
  const handleDeleteFolderClick = (folder: DocumentFolder) => {
    setFolderToDelete(folder);
    setIsDeleteFolderModalOpen(true);
  };

  const confirmDeleteFolder = async () => {
    if (!folderToDelete) return;
    setIsDeletingFolder(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || userToken;
      if (!token) throw new Error("No hay sesión activa.");

      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
      };
      if (tenantId) {
        headers["X-Tenant-ID"] = tenantId;
      }

      const res = await fetch(`/api/v1/folders/${folderToDelete.id}?reassign_to_unclassified=true`, {
        method: "DELETE",
        headers,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || "Error al eliminar la carpeta.");
      }

      // Éxito: cerrar modal, limpiar folderToDelete y si selectedFolder era la eliminada, limpiar
      setIsDeleteFolderModalOpen(false);
      if (selectedFolder?.id === folderToDelete.id) {
        setSelectedFolder(null);
      }
      setFolderToDelete(null);

      // Refrescar árbol y bandeja
      await fetchFoldersTree();
      await fetchUnclassifiedFolios();
    } catch (err: any) {
      alert(`Error al eliminar carpeta: ${err.message}`);
    } finally {
      setIsDeletingFolder(false);
    }
  };

  const toggleSelectUnclassified = (folioId: string) => {
    setSelectedUnclassifiedIds((prev) =>
      prev.includes(folioId) ? prev.filter((id) => id !== folioId) : [...prev, folioId]
    );
  };

  const toggleSelectAllUnclassified = () => {
    if (selectedUnclassifiedIds.length === unclassifiedFolios.length) {
      setSelectedUnclassifiedIds([]);
    } else {
      setSelectedUnclassifiedIds(unclassifiedFolios.map((f) => f.id));
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate) {
      alert("Debes seleccionar una plantilla antes de subir folios.");
      return;
    }
    if (files.length === 0) {
      alert("Debes seleccionar al menos un archivo.");
      return;
    }

    setIsUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || "";
      const userId = session?.user?.id;

      if (!userId || !tenantId) throw new Error("No user or tenant found.");

      const batchId = crypto.randomUUID();
      const { error: batchError } = await supabase.from("batches").insert({
        id: batchId,
        template_id: selectedTemplate,
        status: "pending",
        tenant_id: tenantId,
        uploaded_by: userId,
      });
      if (batchError) throw new Error(`Error creando lote: ${batchError.message}`);

      const uploadedKeys: string[] = [];

      for (const file of files) {
        const urlRes = await fetch(
          `/api/v1/upload/url?filename=${encodeURIComponent(file.name)}&content_type=${encodeURIComponent(file.type)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!urlRes.ok) throw new Error("Failed to get upload URL");
        const { url, key } = await urlRes.json();

        const uploadRes = await fetch(url, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file.type,
          },
        });

        if (!uploadRes.ok) throw new Error("Failed to upload file to R2");
        uploadedKeys.push(key);
      }

      const ingestRes = await fetch(`/api/v1/ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ batch_id: batchId, files: uploadedKeys }),
      });

      if (!ingestRes.ok) throw new Error("Failed to dispatch ingestion");

      // SPEC-012: If a tome was selected, assign the created folios to it
      if (selectedUploadTomeId) {
        try {
          const { data: createdFolios } = await supabase
            .from("folios")
            .select("id")
            .eq("batch_id", batchId);

          if (createdFolios && createdFolios.length > 0) {
            await fetch(`/api/v1/folders/${selectedUploadTomeId}/assign-folios`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ folio_ids: createdFolios.map((f: any) => f.id) }),
            });
          }
        } catch (tomeErr) {
          console.warn("Notice assigning uploaded batch to tome:", tomeErr);
        }
      }

      alert("¡Lote y folios subidos exitosamente!");
      setFiles([]);
      fetchRecentBatches();
      fetchFoldersTree();
    } catch (error: any) {
      alert(`Error durante la subida: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Hub de Ingesta & Archivo</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestión documental, administración de tomos y digitalización archivística
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b mb-6 text-sm font-medium">
        <button
          className={`py-2 px-4 transition-colors flex items-center space-x-2 ${
            activeTab === "folders"
              ? "border-b-2 border-blue-600 text-blue-600 font-bold"
              : "text-gray-600 hover:text-gray-900"
          }`}
          onClick={() => setActiveTab("folders")}
        >
          <Layers className="w-4 h-4" />
          <span>Tomos y Carpetas</span>
        </button>
        <button
          className={`py-2 px-4 transition-colors flex items-center space-x-2 ${
            activeTab === "upload"
              ? "border-b-2 border-blue-600 text-blue-600 font-bold"
              : "text-gray-600 hover:text-gray-900"
          }`}
          onClick={() => setActiveTab("upload")}
        >
          <span>Subir Lote</span>
        </button>
        <button
          className={`py-2 px-4 transition-colors flex items-center space-x-2 ${
            activeTab === "revision"
              ? "border-b-2 border-blue-600 text-blue-600 font-bold"
              : "text-gray-600 hover:text-gray-900"
          }`}
          onClick={() => setActiveTab("revision")}
        >
          <span>Dudosos</span>
        </button>
        {userRole !== "archivist" && (
          <button
            className={`py-2 px-4 transition-colors flex items-center space-x-2 ${
              activeTab === "templates"
                ? "border-b-2 border-blue-600 text-blue-600 font-bold"
              : "text-gray-600 hover:text-gray-900"
            }`}
            onClick={() => setActiveTab("templates")}
          >
            <span>Plantillas</span>
          </button>
        )}
      </div>

      {/* SPEC-012: TAB 1 - TOMOS Y CARPETAS */}
      {activeTab === "folders" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Panel: Tree */}
          <div className="lg:col-span-5 h-[750px]">
            <DocumentFolderTree
              tree={folderTree}
              selectedFolderId={selectedFolder?.id}
              onSelectFolder={(folder) => setSelectedFolder(folder)}
              onCreateFolder={(parent) => {
                setFolderToEdit(null);
                setParentForCreate(parent || null);
                setIsCreateModalOpen(true);
              }}
              onEditFolder={(folder) => {
                setFolderToEdit(folder);
                setParentForCreate(null);
                setIsCreateModalOpen(true);
              }}
              onDeleteFolder={handleDeleteFolderClick}
              userRole={userRole}
              loading={loadingFolders}
            />
          </div>

          {/* Right Panel: Selected Folder & Unclassified Folios */}
          <div className="lg:col-span-7 flex flex-col space-y-6">
            {/* Selected Folder Details Card */}
            <div className="bg-white border rounded-lg shadow-sm p-5">
              {selectedFolder ? (
                <div>
                  <div className="flex items-start justify-between pb-4 border-b">
                    <div>
                      {(() => {
                        const isSelectedVirtualUnclassified = Boolean(
                          selectedFolder.metadata?.is_virtual_unclassified ||
                          selectedFolder.metadata?.system_managed ||
                          selectedFolder.name?.toLowerCase().includes("sin clasificar")
                        );
                        return (
                          <>
                            <div className="flex items-center space-x-2">
                              <span className="px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800 rounded uppercase">
                                {selectedFolder.folder_type}
                              </span>
                              {isSelectedVirtualUnclassified && (
                                <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">
                                  Bandeja Virtual
                                </span>
                              )}
                              <h2 className="text-xl font-bold text-gray-900">
                                {selectedFolder.name}
                              </h2>
                            </div>
                            {selectedFolder.folder_type === "tome" && (
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600 mt-2">
                                {selectedFolder.metadata?.tome_number && (
                                  <span>
                                    <strong>Tomo:</strong> {selectedFolder.metadata.tome_number}
                                  </span>
                                )}
                                {(selectedFolder.metadata?.year_start || selectedFolder.metadata?.year_end) && (
                                  <span>
                                    <strong>Años Extremos:</strong>{" "}
                                    {selectedFolder.metadata.year_start || "?"} -{" "}
                                    {selectedFolder.metadata.year_end || "?"}
                                  </span>
                                )}
                                {selectedFolder.metadata?.location && (
                                  <span>
                                    <strong>Ubicación:</strong> {selectedFolder.metadata.location}
                                  </span>
                                )}
                                {selectedFolder.metadata?.template_id && (
                                  <span>
                                    <strong>Plantilla:</strong>{" "}
                                    {templates.find((t) => t.id === selectedFolder.metadata?.template_id)?.name ||
                                      "Asignada"}
                                  </span>
                                )}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>

                    <div className="flex items-center space-x-2">
                      {(() => {
                        const isSelectedVirtualUnclassified = Boolean(
                          selectedFolder.metadata?.is_virtual_unclassified ||
                          selectedFolder.metadata?.system_managed ||
                          selectedFolder.name?.toLowerCase().includes("sin clasificar")
                        );
                        return (
                          <>
                            {selectedFolder.folder_type === "tome" && !isSelectedVirtualUnclassified && (
                              <button
                                type="button"
                                onClick={() => setIsExportModalOpen(true)}
                                className="px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 transition flex items-center space-x-1.5 cursor-pointer shadow-2xs"
                              >
                                <Download className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Exportar DIP FamilySearch</span>
                              </button>
                            )}

                            {canManageFolders && !isSelectedVirtualUnclassified && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFolderToEdit(selectedFolder);
                                    setParentForCreate(null);
                                    setIsCreateModalOpen(true);
                                  }}
                                  className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded border transition flex items-center space-x-1 cursor-pointer"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                  <span>Editar Tomo</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteFolderClick(selectedFolder)}
                                  className="text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 text-xs font-medium rounded transition flex items-center space-x-1 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Eliminar {selectedFolder.folder_type === "tome" ? "Tomo" : "Carpeta"}</span>
                                </button>
                              </>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Folios in Selected Folder */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-800 flex items-center space-x-1.5">
                        <BookOpen className="w-4 h-4 text-emerald-600" />
                        <span>Folios Asignados a este Tomo ({folderFolios.length})</span>
                      </h3>
                    </div>

                    {loadingFolderFolios ? (
                      <div className="py-6 text-center text-xs text-gray-400">
                        Cargando folios del tomo...
                      </div>
                    ) : folderFolios.length === 0 ? (
                      <div className="p-6 text-center bg-gray-50 border border-dashed rounded text-xs text-gray-500">
                        {selectedFolder.folder_type === "tome" ? (
                          <span>
                            Este tomo aún no tiene folios asignados. Puedes seleccionarlos abajo desde la
                            bandeja sin clasificar y moverlos aquí.
                          </span>
                        ) : (
                          <span>
                            Esta carpeta es un nivel contenedor ({selectedFolder.folder_type}). Selecciona un
                            Tomo específico en el árbol para ver sus folios físicos.
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="max-h-56 overflow-y-auto border rounded divide-y text-xs">
                        <table className="w-full text-left">
                          <thead className="bg-gray-50 text-gray-600 sticky top-0">
                            <tr>
                              <th className="py-1.5 px-3 w-16">Sec.</th>
                              <th className="py-1.5 px-3">Folio ID / Lote</th>
                              <th className="py-1.5 px-3">Estado</th>
                              <th className="py-1.5 px-3 text-right">Acción</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {folderFolios.map((f) => (
                              <tr key={f.id} className="hover:bg-gray-50">
                                <td className="py-2 px-3 font-mono font-semibold text-slate-700">
                                  #{f.sequence_order || "-"}
                                </td>
                                <td className="py-2 px-3">
                                  <div className="font-mono text-gray-800" title={f.id}>
                                    {f.id.slice(0, 12)}...
                                  </div>
                                  <div className="text-[10px] text-gray-500">
                                    {f.batches?.templates?.name || (f.batch_id ? `Lote ${f.batch_id.slice(0, 8)}` : "Directo")}
                                  </div>
                                </td>
                                <td className="py-2 px-3">
                                  <span
                                    className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                      f.status === "completed"
                                        ? "bg-green-100 text-green-800"
                                        : f.status === "in_progress"
                                        ? "bg-blue-100 text-blue-800"
                                        : f.status === "revision"
                                        ? "bg-amber-100 text-amber-800"
                                        : "bg-gray-100 text-gray-700"
                                    }`}
                                  >
                                    {f.status}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => router.push(`/${subdomain}/visor?folio_id=${f.id}`)}
                                    className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-medium rounded transition inline-flex items-center space-x-1"
                                  >
                                    <span>Ver</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-gray-400 text-sm">
                  Selecciona una carpeta o tomo del árbol de la izquierda para ver sus detalles.
                </div>
              )}
            </div>

            {/* Bandeja de Folios Sin Clasificar */}
            <div className="bg-white border rounded-lg shadow-sm p-5 flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b gap-2">
                <div>
                  <h3 className="font-bold text-sm text-gray-900 flex items-center space-x-1.5">
                    <Folder className="w-4 h-4 text-amber-600" />
                    <span>Bandeja de Folios Sin Clasificar ({unclassifiedFolios.length})</span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Folios cargados que aún no han sido asignados a un tomo físico formal
                  </p>
                </div>

                {canManageFolders && (
                  <button
                    type="button"
                    disabled={
                      isMovingFolios ||
                      selectedUnclassifiedIds.length === 0 ||
                      !selectedFolder ||
                      selectedFolder.folder_type !== "tome"
                    }
                    onClick={handleAssignFoliosToCurrentTome}
                    className={`px-3 py-1.5 text-xs font-semibold rounded shadow-sm transition flex items-center space-x-1.5 ${
                      isMovingFolios ||
                      selectedUnclassifiedIds.length === 0 ||
                      !selectedFolder ||
                      selectedFolder.folder_type !== "tome"
                        ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                        : "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                    }`}
                  >
                    <MoveRight className="w-3.5 h-3.5" />
                    <span>
                      {isMovingFolios
                        ? "Moviendo..."
                        : `Mover seleccionados (${selectedUnclassifiedIds.length}) a este Tomo`}
                    </span>
                  </button>
                )}
              </div>

              {selectedFolder && selectedFolder.folder_type !== "tome" && unclassifiedFolios.length > 0 && (
                <div className="mt-2 text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                  Nota: Para mover folios, selecciona un <strong>Tomo</strong> en el árbol izquierdo como destino.
                </div>
              )}

              <div className="mt-3">
                {loadingUnclassified ? (
                  <div className="py-8 text-center text-xs text-gray-400">
                    Cargando folios sin clasificar...
                  </div>
                ) : unclassifiedFolios.length === 0 ? (
                  <div className="py-8 text-center bg-gray-50 rounded border border-dashed text-xs text-gray-500">
                    No hay folios pendientes de clasificación. ¡Todos los folios están asignados a tomos!
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-gray-500 px-1">
                      {canManageFolders ? (
                        <button
                          type="button"
                          onClick={toggleSelectAllUnclassified}
                          className="flex items-center space-x-1 text-blue-600 hover:underline"
                        >
                          {selectedUnclassifiedIds.length === unclassifiedFolios.length ? (
                            <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                          ) : (
                            <Square className="w-3.5 h-3.5 text-gray-400" />
                          )}
                          <span>
                            {selectedUnclassifiedIds.length === unclassifiedFolios.length
                              ? "Deseleccionar todos"
                              : "Seleccionar todos"}
                          </span>
                        </button>
                      ) : (
                        <span className="italic">Modo consulta (Digitador)</span>
                      )}
                      <span>Mostrando hasta 50 folios pendientes</span>
                    </div>

                    <div className="max-h-64 overflow-y-auto border rounded divide-y text-xs">
                      {unclassifiedFolios.map((folio) => {
                        const isSelected = selectedUnclassifiedIds.includes(folio.id);
                        return (
                          <div
                            key={folio.id}
                            onClick={() => canManageFolders && toggleSelectUnclassified(folio.id)}
                            className={`flex items-center justify-between p-2.5 transition-colors ${
                              isSelected ? "bg-blue-50" : "hover:bg-gray-50"
                            } ${canManageFolders ? "cursor-pointer" : ""}`}
                          >
                            <div className="flex items-center space-x-3">
                              {canManageFolders && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleSelectUnclassified(folio.id);
                                  }}
                                  className="text-gray-500"
                                >
                                  {isSelected ? (
                                    <CheckSquare className="w-4 h-4 text-blue-600" />
                                  ) : (
                                    <Square className="w-4 h-4 text-gray-400" />
                                  )}
                                </button>
                              )}
                              <div>
                                <span className="font-mono text-gray-900 font-medium">
                                  {folio.id.slice(0, 14)}...
                                </span>
                                <div className="text-[10px] text-gray-500">
                                  {folio.batches?.templates?.name
                                    ? `Plantilla: ${folio.batches.templates.name}`
                                    : "Sin plantilla predeterminada"}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center space-x-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                                  folio.status === "completed"
                                    ? "bg-green-100 text-green-800"
                                    : folio.status === "in_progress"
                                    ? "bg-blue-100 text-blue-800"
                                    : folio.status === "revision"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-gray-100 text-gray-700"
                                }`}
                              >
                                {folio.status}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/${subdomain}/visor?folio_id=${folio.id}`);
                                }}
                                className="text-blue-600 hover:text-blue-800 p-1"
                                title="Abrir en Visor"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2 - SUBIR LOTE */}
      {activeTab === "upload" && (
        <div>
          <h2 className="text-2xl font-semibold mb-4">Subir Nuevo Lote</h2>

          {templates.length === 0 && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-300 rounded-lg flex items-start space-x-3 text-amber-900 shadow-sm">
              <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-sm">
                  No tienes formularios ni plantillas configuradas todavía. Para poder subir e indexar folios,
                  primero debes crear al menos una plantilla de indexación.
                </p>
                <div className="mt-3">
                  {userRole !== "archivist" ? (
                    <button
                      type="button"
                      onClick={() => setActiveTab("templates")}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded shadow transition"
                    >
                      Crear mi Primera Plantilla
                    </button>
                  ) : (
                    <p className="text-xs text-amber-700 italic">
                      Nota: Un Administrador debe crear la plantilla de indexación para tu organización antes de que puedas subir folios.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleUpload} className="mb-8 space-y-4 max-w-md">
            {/* SPEC-012: Tome Selector with template inheritance */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Asignar al Tomo / Carpeta <span className="text-gray-400 text-xs font-normal">(Recomendado)</span>
              </label>
              <select
                value={selectedUploadTomeId}
                onChange={(e) => handleSelectUploadTome(e.target.value)}
                className="w-full border rounded p-2 text-sm bg-white"
              >
                <option value="">-- Sin asignar (Bandeja Sin Clasificar) --</option>
                {availableTomes.map((tome) => (
                  <option key={tome.id} value={tome.id}>
                    {tome.name} {tome.metadata?.year_start ? `(${tome.metadata.year_start}-${tome.metadata.year_end || "?"})` : ""}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-gray-500 mt-1">
                Al seleccionar un tomo, se hereda su plantilla de indexación predeterminada automáticamente.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Seleccionar Plantilla <span className="text-red-500 text-xs font-semibold">* Requerido</span>
              </label>
              <select
                className={`w-full border rounded p-2 transition ${
                  templates.length === 0 ? "bg-gray-100 text-gray-400 cursor-not-allowed" : ""
                }`}
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                disabled={templates.length === 0}
                required
              >
                <option value="">-- Selecciona una plantilla --</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.is_system_template ? `🛡️ [Oficial FamilySearch] ${t.name}` : t.name}
                  </option>
                ))}
              </select>
              {!selectedTemplate && templates.length > 0 && (
                <p className="text-xs text-amber-600 mt-1">Debes seleccionar una plantilla para habilitar la subida.</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Archivos</label>
              <input
                type="file"
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files || []))}
                disabled={templates.length === 0}
                className={`w-full border rounded p-2 ${
                  templates.length === 0 ? "bg-gray-100 text-gray-400 cursor-not-allowed" : ""
                }`}
              />
            </div>

            <button
              type="submit"
              disabled={isUploading || !selectedTemplate || files.length === 0 || templates.length === 0}
              className={`px-4 py-2 rounded text-white font-medium transition ${
                isUploading || !selectedTemplate || files.length === 0 || templates.length === 0
                  ? "bg-gray-400 opacity-60 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 cursor-pointer shadow"
              }`}
            >
              {isUploading ? "Subiendo..." : "Subir Archivos"}
            </button>
          </form>

          <h2 className="text-xl font-semibold mb-4">Lotes Recientes</h2>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b">
                <th className="py-2">ID</th>
                <th>Plantilla</th>
                <th>Estado</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {loadingBatches ? (
                <tr>
                  <td colSpan={4} className="py-4 text-gray-500">
                    Cargando lotes...
                  </td>
                </tr>
              ) : recentBatches.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-4 text-gray-500">
                    No hay lotes recientes.
                  </td>
                </tr>
              ) : (
                recentBatches.map((batch) => (
                  <tr key={batch.id} className="border-b">
                    <td className="py-2 font-mono text-sm" title={batch.id}>
                      {batch.id ? `${batch.id.slice(0, 8)}...` : "-"}
                    </td>
                    <td>{batch.templates?.name || "Sin plantilla"}</td>
                    <td>
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          batch.status === "completed"
                            ? "bg-green-100 text-green-800"
                            : batch.status === "processing" || batch.status === "in_progress"
                            ? "bg-blue-100 text-blue-800"
                            : batch.status === "failed"
                            ? "bg-red-100 text-red-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {batch.status}
                      </span>
                    </td>
                    <td>
                      {batch.created_at ? new Date(batch.created_at).toLocaleString() : batch.date || "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3 - DUDOSOS */}
      {activeTab === "revision" && (
        <div>
          <h2 className="text-2xl font-semibold mb-4">Folios Dudosos (Revisión)</h2>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b">
                <th className="py-2">Folio ID</th>
                <th>Lote / Plantilla</th>
                <th>Fecha</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {loadingRevision ? (
                <tr>
                  <td colSpan={4} className="py-4 text-gray-500">
                    Cargando folios en revisión...
                  </td>
                </tr>
              ) : revisionFolios.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-4 text-gray-500">
                    No hay folios en revisión.
                  </td>
                </tr>
              ) : (
                revisionFolios.map((folio) => {
                  const batchInfo = folio.batches;
                  const templateName = batchInfo?.templates?.name;
                  const batchDisplay = templateName
                    ? templateName
                    : folio.batch_id
                    ? `Lote ${folio.batch_id.slice(0, 8)}...`
                    : "-";
                  const dateDisplay = folio.created_at
                    ? new Date(folio.created_at).toLocaleString()
                    : "-";
                  return (
                    <tr key={folio.id} className="border-b">
                      <td className="py-2 font-mono text-sm" title={folio.id}>
                        {folio.id ? `${folio.id.slice(0, 8)}...` : "-"}
                      </td>
                      <td>{batchDisplay}</td>
                      <td>{dateDisplay}</td>
                      <td>
                        <button
                          onClick={() => router.push(`/${subdomain}/visor?folio_id=${folio.id}`)}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition-colors"
                        >
                          Corregir
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 4 - PLANTILLAS */}
      {activeTab === "templates" && userRole !== "archivist" && (
        <div>
          <h2 className="text-2xl font-semibold mb-4">Gestión de Plantillas</h2>
          <p className="text-gray-600 mb-4">Aquí puedes crear y editar plantillas de extracción.</p>
          <TemplateBuilder tenantId={tenantId} />
        </div>
      )}

      {/* Modal Crear / Editar Carpeta o Tomo */}
      <CreateFolderModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={(saved) => {
          fetchFoldersTree();
          setSelectedFolder(saved);
        }}
        folderToEdit={folderToEdit}
        parentFolder={parentForCreate}
        tree={folderTree}
        templates={templates}
        tenantId={tenantId}
      />

      {/* Modal Exportar DIP FamilySearch */}
      <ExportFamilySearchModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        folder={selectedFolder}
        authToken={userToken}
        tenantId={tenantId}
      />

      {/* Modal Confirmación de Eliminación de Carpeta / Tomo */}
      {isDeleteFolderModalOpen && folderToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3 text-red-600 mb-4">
              <div className="p-2 bg-red-100 rounded-full">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">
                ¿Eliminar {folderToDelete.folder_type === "tome" ? "tomo" : "carpeta"} &apos;{folderToDelete.name}&apos;?
              </h3>
            </div>

            <div className="text-sm text-gray-600 mb-6 space-y-2">
              {(folderToDelete.id === selectedFolder?.id ? folderFolios.length : (folderToDelete.total_folios || 0)) > 0 ? (
                <p>
                  Esta carpeta contiene{" "}
                  <strong className="text-gray-900">
                    {folderToDelete.id === selectedFolder?.id ? folderFolios.length : folderToDelete.total_folios} folios
                  </strong>
                  . Al eliminarla, los folios no se borrarán; serán devueltos automáticamente a la{" "}
                  <strong>Bandeja de Folios Sin Clasificar</strong> para que puedas reasignarlos a otro tomo.
                </p>
              ) : (
                <p>
                  ¿Estás seguro de eliminar esta carpeta? Esta acción no se puede deshacer.
                </p>
              )}
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                disabled={isDeletingFolder}
                onClick={() => {
                  setIsDeleteFolderModalOpen(false);
                  setFolderToDelete(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition disabled:opacity-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeletingFolder}
                onClick={confirmDeleteFolder}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md transition flex items-center space-x-2 disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {isDeletingFolder ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <span>Sí, Eliminar</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
