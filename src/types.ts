// src/types.ts

export interface BlockDefinition {
  id: string;
  namespace: string;
  name: string;
  hardness?: number;
  resistance?: number;
  luminance?: number;
  transparent?: boolean;
  toolTier?: string;
}

export interface ItemDefinition {
  id: string;
  namespace: string;
  name: string;
  maxStackSize?: number;
  durability?: number;
  category?: string;
}

export interface EntityDefinition {
  id: string;
  namespace: string;
  name: string;
  width?: number;
  height?: number;
  spawnable?: boolean;
  summonable?: boolean;
}

export interface ModMetadata {
  modId: string;
  name: string;
  version: string;
  minecraftVersion?: string;  // Auto-detected from dependencies
  description?: string;
  authors?: string[];
  loader: 'fabric' | 'forge' | 'neoforge' | 'quilt' | 'unknown';
  dependencies: Record<string, string>;
}

export interface ConvertedMod {
  metadata: ModMetadata;
  blocks: BlockDefinition[];
  items: ItemDefinition[];
  entities: EntityDefinition[];
  versionInfo: {
    java: string;
    bedrock: string[];
    engine: [number, number, number];
  };
  errors: string[];
  warnings: string[];
}

export interface ConversionResult {
  success: boolean;
  mod: ConvertedMod | null;
  mcaddonBlob: Blob | null;
  errorMessage?: string;
}
