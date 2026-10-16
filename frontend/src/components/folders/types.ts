export type FolderType = 'root' | 'parish' | 'series' | 'tome';

export interface GeographicMetadata {
  country?: string;
  state?: string;
  municipality?: string;
  city_or_locality?: string;
  diocese_name?: string;
  parish_name?: string;
}

export interface FolderMetadata extends GeographicMetadata {
  tome_number?: string;
  year_start?: number | null;
  year_end?: number | null;
  location?: string;
  template_id?: string;
  is_virtual_unclassified?: boolean;
  [key: string]: any;
}

export interface DocumentFolder {
  id: string;
  tenant_id: string;
  parent_id?: string | null;
  name: string;
  folder_type: FolderType;
  code?: string | null;
  metadata?: FolderMetadata;
  total_folios?: number;
  total_entries?: number;
  children?: DocumentFolder[];
  created_at?: string;
}

export interface FolioItem {
  id: string;
  batch_id?: string;
  folder_id?: string | null;
  sequence_order?: number;
  status: string;
  r2_url?: string;
  original_filename?: string;
  canonical_filename?: string;
  created_at?: string;
  batches?: {
    id: string;
    template_id?: string;
    templates?: {
      name: string;
    };
  };
}
