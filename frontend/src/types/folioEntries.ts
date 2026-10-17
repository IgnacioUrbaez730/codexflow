export interface FolioEntry {
  id?: string;
  folio_id?: string;
  entry_number: number;
  folio_number?: number | null;
  folio_side?: "recto" | "vuelto" | "unica" | string | null;
  act_number?: string | null;
  is_continued?: boolean;
  continued_from_entry_id?: string | null;
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
  country?: string | null;
  state?: string | null;
  municipality?: string | null;
  city_or_locality?: string | null;
  canonical_place?: string | null;
}
