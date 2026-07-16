// src/src/builder/addon-builder.ts

import JSZip from 'jszip';
import { ConvertedMod, ModMetadata } from '../types';
import { ManifestGenerator } from '../generator/manifest-generator';
import { JsonGenerator } from '../generator/json-generator';
import { Utils } from '../utils/uuid-generator';

export class AddonBuilder {
  static async build(mod: ConvertedMod, jtbapiPath: string): Promise<Blob> {
    const zip = new JSZip();
    const modMeta = mod.metadata;

    // Create behavior pack structure
    const behaviorPack = zip.folder('behavior_pack')!;
    
    // Generate manifest
    const behaviorManifest = ManifestGenerator.generateBehaviorPackManifest(modMeta);
    behaviorPack.file('manifest.json', JSON.stringify(behaviorManifest, null, 2));
    
    // Create scripts folder with JTBAPI
    const scriptsFolder = behaviorPack.folder('scripts')!;
    const jtbapiFolder = scriptsFolder.folder('jtbapi')!;
    
    // Read JTBAPI files from local filesystem (browser limitation - will need workaround)
    // For browser: load via fetch or embed in bundle
    const jtbapiFiles = await this.loadJtbapiFiles(jtbapiPath);
    
    for (const [filepath, content] of Object.entries(jtbapiFiles)) {
      jtbapiFolder.file(filepath, content);
    }
    
    // Add main.js with mod logic
    const mainJs = this.generateMainJs(mod);
    scriptsFolder.file('main.js', mainJs);
    
    // Create resource pack structure (optional)
    const resourcePack = zip.folder('resource_pack')!;
    const resourceManifest = ManifestGenerator.generateResourcePackManifest(modMeta);
    resourcePack.file('manifest.json', JSON.stringify(resourceManifest, null, 2));
    
    // Add textures if available
    for (const asset of modMeta.dependencies) {
      // Future: copy asset files here
    }

    // Generate .mcaddon
    return await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/octet-stream'
    });
  }

  private static async loadJtbapiFiles(path: string): Promise<{ [key: string]: string }> {
    // For browser: fetch files dynamically
    // For Node: read from filesystem
    const files: { [key: string]: string } = {};
    
    const fileList = [
      'index.js',
      'events.js',
      'config.js',
      'storage.js',
      'utils.js',
      'datapacks_manager.js'
    ];
    
    for (const file of fileList) {
      try {
        const response = await fetch(`${path}/${file}`);
        files[file] = await response.text();
      } catch (err) {
        console.warn(`Failed to load ${file}:`, err);
      }
    }
    
    // Load nested folders
    const nestedFiles = [
      'jtbapi/blocks.js',
      'jtbapi/items.js',
      'jtbapi/entities.js',
      'ui/forms.js'
    ];
    
    for (const file of nestedFiles) {
      try {
        const response = await fetch(`${path}/${file}`);
        files[file] = await response.text();
      } catch (err) {
        console.warn(`Failed to load ${file}:`, err);
      }
    }
    
    return files;
  }

  private static generateMainJs(mod: ConvertedMod): string {
    let code = `// Converted from ${mod.metadata.loader} mod: ${mod.metadata.name} v${mod.metadata.version}\n`;
    code += `import { API } from './jtbapi/index.js';\n\n`;
    code += `const { Registry, Events, Config, Storage } = API;\n\n`;
    code += `const MOD_ID = '${mod.metadata.modId}';\n`;
    code += `const VERSION = '${mod.metadata.version}';\n\n`;
    code += `console.log('[JTBAPI] Loading ' + MOD_ID + ' v' + VERSION);\n\n`;
    
    // Add block registrations
    for (const block of mod.blocks) {
      code += `Registry.Blocks.register('${block.id}', {\n`;
      code += `  hardness: ${block.hardness},\n`;
      code += `  resistance: ${block.resistance}\n`;
      code += `});\n\n`;
    }
    
    // Add item registrations
    for (const item of mod.items) {
      code += `Registry.Items.register('${item.id}', {\n`;
      code += `  maxCount: ${item.maxStackSize}\n`;
      code += `});\n\n`;
    }
    
    // Add entity registrations
    for (const entity of mod.entities) {
      code += `Registry.Entities.register('${entity.id}', {\n`;
      code += `  width: ${entity.width},\n`;
      code += `  height: ${entity.height}\n`;
      code += `});\n\n`;
    }
    
    // Add datapack registration
    code += `if (typeof Registry.Datapacks !== 'undefined') {\n`;
    code += `  Registry.Datapacks.register('${mod.metadata.modId}:features', {\n`;
    code += `    name: '${mod.metadata.name} Features',\n`;
    code += `    description: 'Additional features from ${mod.metadata.name}',\n`;
    code += `    defaultEnabled: true\n`;
    code += `  });\n`;
    code += `}\n\n`;
    
    code += `console.log('[JTBAPI] ' + MOD_ID + ' loaded successfully!');\n`;
    
    return code;
  }
}
