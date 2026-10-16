export interface GeographicMetadata {
  country?: string;
  state?: string;
  municipality?: string;
  city_or_locality?: string;
  diocese_name?: string;
  parish_name?: string;
}

export type FolderType = 'root' | 'parish' | 'series' | 'tome';

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

export interface GeographicSuggestionsResponse {
  countries: string[];
  states: string[];
  municipalities: string[];
  cities_or_localities: string[];
  dioceses: string[];
  parishes: string[];
}
