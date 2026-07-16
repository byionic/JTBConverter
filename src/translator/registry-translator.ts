// src/translator/registry-translator.ts

import { ClassFileInfo } from '../parser/jar-parser';
import { BlockDefinition, ItemDefinition, EntityDefinition } from '../types';

export class RegistryTranslator {
  static extractBlocks(classes: ClassFileInfo[], namespace: string): BlockDefinition[] {
    const blocks: BlockDefinition[] = [];
    const blockPattern = /Registry\.register\(.*?Block.*?,\s*"(.*?)"/g;
    
    for (const file of classes) {
      // Try to read as text (works for decompiled sources)
      try {
        const text = new TextDecoder().decode(file.content);
        let match;
        
        while ((match = blockPattern.exec(text)) !== null) {
          const fullId = match[1];
          if (!fullId.includes(':')) continue;
          
          const [ns, name] = fullId.split(':');
          if (ns !== namespace) continue;
          
          blocks.push({
            id: fullId,
            namespace: ns,
            name: name,
            hardness: 2.0,
            resistance: 3.0
          });
        }
      } catch {
        // Binary class files skipped for now
      }
    }
    
    return blocks;
  }

  static extractItems(classes: ClassFileInfo[], namespace: string): ItemDefinition[] {
    const items: ItemDefinition[] = [];
    const itemPattern = /Registry\.register\(.*?Item.*?,\s*"(.*?)"/g;
    
    for (const file of classes) {
      try {
        const text = new TextDecoder().decode(file.content);
        let match;
        
        while ((match = itemPattern.exec(text)) !== null) {
          const fullId = match[1];
          if (!fullId.includes(':')) continue;
          
          const [ns, name] = fullId.split(':');
          if (ns !== namespace) continue;
          
          items.push({
            id: fullId,
            namespace: ns,
            name: name,
            maxStackSize: 64
          });
        }
      } catch {
        // Binary class files skipped for now
      }
    }
    
    return items;
  }

  static extractEntities(classes: ClassFileInfo[], namespace: string): EntityDefinition[] {
    const entities: EntityDefinition[] = [];
    // Entity patterns vary more by loader
    const entityPattern = /EntityType.*?"(.*?)"/g;
    
    for (const file of classes) {
      try {
        const text = new TextDecoder().decode(file.content);
        let match;
        
        while ((match = entityPattern.exec(text)) !== null) {
          const fullId = match[1];
          if (!fullId.includes(':')) continue;
          
          const [ns, name] = fullId.split(':');
          if (ns !== namespace) continue;
          
          entities.push({
            id: fullId,
            namespace: ns,
            name: name,
            width: 0.6,
            height: 1.8
          });
        }
      } catch {
        // Binary class files skipped for now
      }
    }
    
    return entities;
  }
}
