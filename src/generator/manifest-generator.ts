// src/generator/manifest-generator.ts

import { ModMetadata, ConvertedMod } from '../types';
import { Utils } from '../utils/uuid-generator';

export class ManifestGenerator {
  static generateBehaviorPackManifest(mod: ModMetadata, engineVersion: [number, number, number] = [1, 20, 0]): Record<string, any> {
    return {
      "format_version": 2,
      "header": {
        "name": mod.name,
        "description": mod.description || `Converted from ${mod.loader} mod`,
        "uuid": Utils.generateDeterministicUUID(`header-${mod.modId}`),
        "version": this.parseVersion(mod.version),
        "min_engine_version": engineVersion
      },
      "modules": [
        {
          "type": "script",
          "language": "javascript",
          "uuid": Utils.generateDeterministicUUID(`module-${mod.modId}`),
          "version": [1, 0, 0],
          "entry": "scripts/main.js"
        }
      ],
      "dependencies": [
        {
          "module_name": "@minecraft/server",
          "version": "1.0.0"
        }
      ]
    };
  }

  static generateResourcePackManifest(mod: ModMetadata, engineVersion: [number, number, number] = [1, 20, 0]): Record<string, any> {
    return {
      "format_version": 2,
      "header": {
        "name": `${mod.name} Resources`,
        "description": `Resources for ${mod.name}`,
        "uuid": Utils.generateDeterministicUUID(`header-${mod.modId}-resources`),
        "version": [1, 0, 0],
        "min_engine_version": engineVersion
      },
      "modules": [
        {
          "type": "resources",
          "uuid": Utils.generateDeterministicUUID(`module-${mod.modId}-resources`),
          "version": [1, 0, 0]
        }
      ]
    };
  }

  private static parseVersion(version: string): number[] {
    const parts = version.split('.').slice(0, 3);
    return parts.map(p => parseInt(p) || 0);
  }
}
