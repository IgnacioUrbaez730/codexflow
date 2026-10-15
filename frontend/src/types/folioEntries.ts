export interface FolioEntry {
  id?: string;
  folio_id?: string;
  entry_number: number;
  status: "pending" | "completed" | "revision" | string;
  metadata: Record<string, any>;
  bounding_box?: {
    ymin?: number;
    xmin?: number;
    ymax?: number;
    xmax?: number;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  } | null;
  created_at?: string;
  updated_at?: string;
}

export interface InheritedContext {
  parish_name?: string | null;
  diocese_name?: string | null;
  tome_number?: string | null;
  year_start?: number | string | null;
  year_end?: number | string | null;
}
