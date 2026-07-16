// src/builder/addon-builder.ts

import JSZip from 'jszip';
import { ConvertedMod } from '../types';
import { ManifestGenerator } from '../generator/manifest-generator';
import { JsonGenerator } from '../generator/json-generator';

// GitHub repository info
const GITHUB_OWNER = 'byionic';
const GITHUB_REPO = 'JTBAPI';
const GITHUB_BRANCH = 'main';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/trees/${GITHUB_BRANCH}?recursive=1`;
const GITHUB_RAW_URL = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}`;

// Files we need from JTBAPI (relative to the scripts/ folder in the repo)
const JTBAPI_FILES = [
  'index.js',
  'events.js',
  'config.js',
  'storage.js',
  'utils.js',
  'datapacks_manager.js',
  'jtbapi/blocks.js',
  'jtbapi/items.js',
  'jtbapi/entities.js',
  'ui/forms.js'
];

// Cache fetched files so we don't spam GitHub
let jtbapiCache: { [key: string]: string } | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export class AddonBuilder {
  /**
   * Fetch all JTBAPI files from GitHub
   * Looks for the scripts/ folder in the repo
   */
  static async fetchJtbapiFiles(): Promise<{ [key: string]: string }> {
    // Check cache first
    const now = Date.now();
    if (jtbapiCache && (now - cacheTimestamp) < CACHE_TTL) {
      console.log('[JTB Converter] Using cached JTBAPI files');
      return jtbapiCache;
    }

    console.log('[JTB Converter] Fetching JTBAPI from GitHub...');
    const files: { [key: string]: string } = {};

    // Try to get the file tree from GitHub API
    let basePath = 'scripts/';
    let fileList: string[] = [];

    try {
      const response = await fetch(GITHUB_API_URL);
      
      if (response.ok) {
        const tree = await response.json();
        
        // Find all .js files inside scripts/ folder
        fileList = tree.tree
          .filter((item: any) => 
            item.type === 'blob' && 
            item.path.startsWith('scripts/') && 
            item.path.endsWith('.js')
          )
          .map((item: any) => item.path.replace('scripts/', ''));
        
        console.log(`[JTB Converter] Found ${fileList.length} JTBAPI files via GitHub API`);
      } else {
        console.warn('[JTB Converter] GitHub API rate limited, falling back to known file list');
        fileList = JTBAPI_FILES;
      }
    } catch (err) {
      console.warn('[JTB Converter] Failed to fetch GitHub tree, using fallback list:', err);
      fileList = JTBAPI_FILES;
    }

    // Fetch each file from raw.githubusercontent.com
    const fetchPromises = fileList.map(async (filepath) => {
      try {
        const rawUrl = `${GITHUB_RAW_URL}/scripts/${filepath}`;
        const response = await fetch(rawUrl);
        
        if (response.ok) {
          files[filepath] = await response.text();
          console.log(`[JTB Converter] Fetched: ${filepath}`);
        } else {
          console.warn(`[JTB Converter] Failed to fetch ${filepath}: ${response.status}`);
        }
      } catch (err) {
        console.warn(`[JTB Converter] Error fetching ${filepath}:`, err);
      }
    });

    await Promise.all(fetchPromises);

    if (Object.keys(files).length === 0) {
      throw new Error('Failed to fetch any JTBAPI files from GitHub. Check your connection or repo URL.');
    }

    // Update cache
    jtbapiCache = files;
    cacheTimestamp = now;

    console.log(`[JTB Converter] Successfully fetched ${Object.keys(files).length} JTBAPI files`);
    return files;
  }

  /**
   * Build the complete .mcaddon
   */
  static async build(mod: ConvertedMod): Promise<Blob> {
    const zip = new JSZip();

    // ============================================
    // 1. Create behavior pack structure
    // ============================================
    const behaviorPack = zip.folder('behavior_pack')!;

    // Generate behavior pack manifest
    const behaviorManifest = ManifestGenerator.generateBehaviorPackManifest(mod.metadata);
    behaviorPack.file('manifest.json', JSON.stringify(behaviorManifest, null, 2));

    // ============================================
    // 2. Fetch and embed JTBAPI scripts
    // ============================================
    const scriptsFolder = behaviorPack.folder('scripts')!;
    const jtbapiFolder = scriptsFolder.folder('jtbapi')!;

    const jtbapiFiles = await this.fetchJtbapiFiles();

    for (const [filepath, content] of Object.entries(jtbapiFiles)) {
      // Preserve folder structure inside jtbapi/
      // e.g., "jtbapi/blocks.js" → "jtbapi/blocks.js"
      // e.g., "ui/forms.js" → "ui/forms.js"
      jtbapiFolder.file(filepath, content);
    }

    // ============================================
    // 3. Generate main.js (converted mod logic)
    // ============================================
    const mainJs = this.generateMainJs(mod);
    scriptsFolder.file('main.js', mainJs);

    // ============================================
    // 4. Generate block/item/entity JSON files
    // ============================================
    const blocksFolder = behaviorPack.folder('blocks')!;
    for (const block of mod.blocks) {
      const json = JsonGenerator.generateBlockJson(block);
      blocksFolder.file(`${block.name}.json`, JSON.stringify(json, null, 2));
    }

    const itemsFolder = behaviorPack.folder('items')!;
    for (const item of mod.items) {
      const json = JsonGenerator.generateItemJson(item);
      itemsFolder.file(`${item.name}.json`, JSON.stringify(json, null, 2));
    }

    const entitiesFolder = behaviorPack.folder('entities')!;
    for (const entity of mod.entities) {
      const json = JsonGenerator.generateEntityJson(entity);
      entitiesFolder.file(`${entity.name}.json`, JSON.stringify(json, null, 2));
    }

    // ============================================
    // 5. Create resource pack structure
    // ============================================
    const resourcePack = zip.folder('resource_pack')!;
    const resourceManifest = ManifestGenerator.generateResourcePackManifest(mod.metadata);
    resourcePack.file('manifest.json', JSON.stringify(resourceManifest, null, 2));

    // ============================================
    // 6. Generate .mcaddon
    // ============================================
    const blob = await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/octet-stream'
    });

    console.log('[JTB Converter] .mcaddon built successfully');
    return blob;
  }

  /**
   * Generate the main.js file for the converted mod
   */
  private static generateMainJs(mod: ConvertedMod): string {
    let code = `// ============================================================\n`;
    code += `// Converted by JTB Converter\n`;
    code += `// Source: ${mod.metadata.loader} mod "${mod.metadata.name}" v${mod.metadata.version}\n`;
    code += `// JTBAPI fetched from github.com/byionic/JTBAPI\n`;
    code += `// ============================================================\n\n`;

    code += `import { API } from './jtbapi/index.js';\n\n`;
    code += `const { Registry, Events, Config, Storage, Datapacks } = API;\n\n`;
    
    code += `const MOD_ID = '${mod.metadata.modId}';\n`;
    code += `const VERSION = '${mod.metadata.version}';\n\n`;
    
    code += `console.log('[JTB] Loading ' + MOD_ID + ' v' + VERSION);\n\n`;

    // ============================================
    // Block registrations
    // ============================================
    if (mod.blocks.length > 0) {
      code += `// === Blocks (${mod.blocks.length}) ===\n`;
      for (const block of mod.blocks) {
        code += `Registry.Blocks.register('${block.id}', {\n`;
        code += `  hardness: ${block.hardness ?? 2.0},\n`;
        code += `  resistance: ${block.resistance ?? 3.0}`;
        if (block.luminance) code += `,\n  luminance: ${block.luminance}`;
        if (block.toolTier) code += `,\n  toolTier: '${block.toolTier}'`;
        code += `\n});\n`;
      }
      code += `\n`;
    }

    // ============================================
    // Item registrations
    // ============================================
    if (mod.items.length > 0) {
      code += `// === Items (${mod.items.length}) ===\n`;
      for (const item of mod.items) {
        code += `Registry.Items.register('${item.id}', {\n`;
        code += `  maxCount: ${item.maxStackSize ?? 64}`;
        if (item.durability) code += `,\n  durability: ${item.durability}`;
        if (item.category) code += `,\n  category: '${item.category}'`;
        code += `\n});\n`;
      }
      code += `\n`;
    }

    // ============================================
    // Entity registrations
    // ============================================
    if (mod.entities.length > 0) {
      code += `// === Entities (${mod.entities.length}) ===\n`;
      for (const entity of mod.entities) {
        code += `Registry.Entities.register('${entity.id}', {\n`;
        code += `  width: ${entity.width ?? 0.6},\n`;
        code += `  height: ${entity.height ?? 1.8}`;
        if (entity.spawnable !== undefined) code += `,\n  spawnable: ${entity.spawnable}`;
        if (entity.summonable !== undefined) code += `,\n  summonable: ${entity.summonable}`;
        code += `\n});\n`;
      }
      code += `\n`;
    }

    // ============================================
    // Datapack registration
    // ============================================
    code += `// === Datapack ===\n`;
    code += `Datapacks.register('${mod.metadata.modId}:features', {\n`;
    code += `  name: '${mod.metadata.name} Features',\n`;
    code += `  description: 'Converted datapack features from ${mod.metadata.name}',\n`;
    code += `  defaultEnabled: true\n`;
    code += `});\n\n`;

    // ============================================
    // Config defaults
    // ============================================
    code += `// === Config ===\n`;
    code += `Config.reset('${mod.metadata.modId}', {\n`;
    code += `  debugMode: false\n`;
    code += `});\n\n`;

    // ============================================
    // Errors and warnings
    // ============================================
    if (mod.errors.length > 0 || mod.warnings.length > 0) {
      code += `// === Conversion Notes ===\n`;
      code += `console.warn('[JTB] Conversion notes:');\n`;
      for (const err of mod.errors) {
        code += `console.error('[JTB] ERROR: ${err.replace(/'/g, "\\'")}');\n`;
      }
      for (const warn of mod.warnings) {
        code += `console.warn('[JTB] WARN: ${warn.replace(/'/g, "\\'")}');\n`;
      }
      code += `\n`;
    }

    code += `console.log('[JTB] ' + MOD_ID + ' v' + VERSION + ' loaded successfully!');\n`;

    return code;
  }
}
