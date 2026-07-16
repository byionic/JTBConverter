// src/parser/jar-parser.ts

import AdmZip from 'adm-zip';

export interface JarContents {
  manifest: ManifestData | null;
  fabricMetadata: FabricMetadata | null;
  forgeMetadata: ForgeMetadata | null;
  classFiles: ClassFileInfo[];
  assets: AssetFile[];
}

export interface ManifestData {
  mainClass: string | null;
  version: string | null;
  extras: Record<string, string>;
}

export interface FabricMetadata {
  id: string;
  name: string;
  version: string;
  description?: string;
  authors?: string[];
  depends: Record<string, string>;
}

export interface ForgeMetadata {
  modId: string;
  name: string;
  version: string;
  description?: string;
  authors?: string[];
  dependencies: Record<string, string>;
}

export interface ClassFileInfo {
  path: string;
  className: string;
  content: Uint8Array;
}

export interface AssetFile {
  path: string;
  content: Uint8Array;
}

export class JarParser {
  static async parse(jarBuffer: ArrayBuffer): Promise<JarContents> {
    const zip = new AdmZip(Buffer.from(jarBuffer));
    const entries = zip.getEntries();

    const result: JarContents = {
      manifest: null,
      fabricMetadata: null,
      forgeMetadata: null,
      classFiles: [],
      assets: []
    };

    for (const entry of entries) {
      const path = entry.entryName;

      // Read META-INF/MANIFEST.MF
      if (path === 'META-INF/MANIFEST.MF') {
        result.manifest = this.parseManifest(entry.getData());
      }

      // Read Fabric metadata
      if (path === 'fabric.mod.json') {
        result.fabricMetadata = this.parseFabricMetadata(entry.getData());
      }

      // Read Forge metadata
      if (path === 'META-INF/mods.toml') {
        result.forgeMetadata = this.parseForgeMetadata(entry.getData());
      }

      // Collect .class files
      if (path.endsWith('.class')) {
        result.classFiles.push({
          path,
          className: path.replace('/', '.').replace('.class', ''),
          content: entry.getData()
        });
      }

      // Collect assets (textures, models, lang)
      if (
        path.startsWith('assets/') ||
        path.startsWith('data/') ||
        path.includes('.lang')
      ) {
        result.assets.push({
          path,
          content: entry.getData()
        });
      }
    }

    return result;
  }

  private static parseManifest(data: Buffer): ManifestData | null {
    try {
      const text = data.toString('utf-8');
      const lines = text.split('\n');
      const manifest: ManifestData = {
        mainClass: null,
        version: null,
        extras: {}
      };

      for (const line of lines) {
        if (line.startsWith('Main-Class:')) {
          manifest.mainClass = line.split(':')[1]?.trim() || null;
        } else if (line.startsWith('Implementation-Version:')) {
          manifest.version = line.split(':')[1]?.trim() || null;
        } else {
          manifest.extras[line.split(':')[0]] = line.split(':')[1]?.trim() || '';
        }
      }

      return manifest;
    } catch {
      return null;
    }
  }

  private static parseFabricMetadata(data: Buffer): FabricMetadata | null {
    try {
      const json = JSON.parse(data.toString('utf-8'));
      return {
        id: json.id || '',
        name: json.name || '',
        version: json.version || '',
        description: json.description,
        authors: json.authors?.map((a: any) => a.name || String(a)),
        depends: json.depends || {}
      };
    } catch {
      return null;
    }
  }

  private static parseForgeMetadata(data: Buffer): ForgeMetadata | null {
    const text = data.toString('utf-8');
    const modIdMatch = text.match(/modId\s*=\s*"([^"]+)"/);
    const versionMatch = text.match(/version\s*=\s*"([^"]+)"/);
    const nameMatch = text.match(/displayName\s*=\s*"([^"]+)"/);

    return modIdMatch ? {
      modId: modIdMatch[1],
      name: nameMatch?.[1] || '',
      version: versionMatch?.[1] || '',
      dependencies: {}
    } : null;
  }
}
