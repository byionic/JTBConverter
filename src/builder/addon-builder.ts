// src/builder/addon-builder.ts

import JSZip from 'jszip';
import { ConvertedMod } from '../types';
import { ManifestGenerator } from '../generator/manifest-generator';
import { JsonGenerator } from '../generator/json-generator';
import { VERSION_MAP } from './utils/version-mapper'; // No, remove this
// Actually we don't need VERSION_MAP anymore since we use algorithm

const GITHUB_OWNER = 'byionic';
const GITHUB_REPO = 'JTBAPI';
const GITHUB_BRANCH = 'main';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/trees/${GITHUB_BRANCH}?recursive=1`;
const GITHUB_RAW_URL = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}`;

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

let jtbapiCache: { [key: string]: string } | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000;

export class AddonBuilder {
  static async fetchJtbapiFiles(): Promise<{ [key: string]: string }> {
    const now = Date.now();
    if (jtbapiCache && (now - cacheTimestamp) < CACHE_TTL) {
      return jtbapiCache;
    }

    const files: { [key: string]: string } = {};

    try {
      const response = await fetch(GITHUB_API_URL);
      
      if (response.ok) {
        const tree = await response.json();
        const fileList = tree.tree
          .filter((item: any) => 
            item.type === 'blob' && 
            item.path.startsWith('scripts/') && 
            item.path.endsWith('.js')
          )
          .map((item: any) => item.path.replace('scripts/', ''));

        const fetchPromises = fileList.map(async (filepath: string) => {
          try {
            const rawUrl = `${GITHUB_RAW_URL}/scripts/${filepath}`;
            const resp = await fetch(rawUrl);
            if (resp.ok) {
              files[filepath] = await resp.text();
            }
          } catch {}
        });

        await Promise.all(fetchPromises);
      }
    } catch {
      // Fallback to hardcoded list if API fails
      const fetchPromises = JTBAPI_FILES.map(async (filepath) => {
        try {
          const rawUrl = `${GITHUB_RAW_URL}/scripts/${filepath}`;
          const resp = await fetch(rawUrl);
          if (resp.ok) {
            files[filepath] = await resp.text();
          }
        } catch {}
      });

      await Promise.all(fetchPromises);
    }

    jtbapiCache = files;
    cacheTimestamp = now;

    return files;
  }

  static async build(mod: ConvertedMod): Promise<Blob> {
    const zip = new JSZip();
    const behaviorPack = zip.folder('behavior_pack')!;
    const resourcePack = zip.folder('resource_pack')!;

    // Use version info from mod for manifest
    const engineVersion = mod.versionInfo.engine;
    const behaviorManifest = ManifestGenerator.generateBehaviorPackManifest(mod.metadata, engineVersion);
    behaviorPack.file('manifest.json', JSON.stringify(behaviorManifest, null, 2));

    const resourceManifest = ManifestGenerator.generateResourcePackManifest(mod.metadata, engineVersion);
    resourcePack.file('manifest.json', JSON.stringify(resourceManifest, null, 2));

    const scriptsFolder = behaviorPack.folder('scripts')!;
    const jtbapiFolder = scriptsFolder.folder('jtbapi')!;

    const jtbapiFiles = await this.fetchJtbapiFiles();
    for (const [filepath, content] of Object.entries(jtbapiFiles)) {
      jtbapiFolder.file(filepath, content);
    }

    const mainJs = this.generateMainJs(mod);
    scriptsFolder.file('main.js', mainJs);

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

    return await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/octet-stream'
    });
  }

  private static generateMainJs(mod: ConvertedMod): string {
    let code = `// Converted by JTB Converter\n`;
    code += `// Source: ${mod.metadata.loader} mod "${mod.metadata.name}" v${mod.metadata.version}\n`;
    code += `// Java MC Version: ${mod.versionInfo.java}\n`;
    code += `// Compatible Bedrock: ${mod.versionInfo.bedrock.join(', ')}\n\n`;

    code += `import { API } from './jtbapi/index.js';\n\n`;
    code += `const { Registry, Events, Config, Storage, Datapacks } = API;\n\n`;
    code += `const MOD_ID = '${mod.metadata.modId}';\n`;
    code += `const VERSION = '${mod.metadata.version}';\n\n`;
    code += `console.log('[JTB] Loading ' + MOD_ID + ' v' + VERSION);\n\n`;

    for (const block of mod.blocks) {
      code += `Registry.Blocks.register('${block.id}', {\n`;
      code += `  hardness: ${block.hardness ?? 2.0},\n`;
      code += `  resistance: ${block.resistance ?? 3.0}\n`;
      code += `});\n\n`;
    }

    for (const item of mod.items) {
      code += `Registry.Items.register('${item.id}', {\n`;
      code += `  maxCount: ${item.maxStackSize ?? 64}\n`;
      code += `});\n\n`;
    }

    for (const entity of mod.entities) {
      code += `Registry.Entities.register('${entity.id}', {\n`;
      code += `  width: ${entity.width ?? 0.6},\n`;
      code += `  height: ${entity.height ?? 1.8}\n`;
      code += `});\n\n`;
    }

    code += `Datapacks.register('${mod.metadata.modId}:features', {\n`;
    code += `  name: '${mod.metadata.name} Features',\n`;
    code += `  description: 'Additional features from ${mod.metadata.name}',\n`;
    code += `  defaultEnabled: true\n`;
    code += `});\n\n`;

    code += `Config.reset('${mod.metadata.modId}', {\n`;
    code += `  debugMode: false\n`;
    code += `});\n\n`;

    code += `console.log('[JTB] ' + MOD_ID + ' v' + VERSION + ' loaded successfully!');\n`;

    return code;
  }
}
