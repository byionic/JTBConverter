// src/generator/json-generator.ts

import { BlockDefinition, ItemDefinition, EntityDefinition } from '../types';

export class JsonGenerator {
  static generateBlockJson(block: BlockDefinition): Record<string, any> {
    return {
      "format_version": "1.20.0",
      "minecraft:block": {
        "description": {
          "identifier": block.id,
          "runtime_identifier": block.id,
          "categories": ["build"]
        },
        "components": {
          "minecraft:destructible_by_mining": {
            "seconds": block.hardness ?? 2.0
          },
          "minecraft:explosion_resist": {
            "strength": block.resistance ?? 3.0
          }
        }
      }
    };
  }

  static generateItemJson(item: ItemDefinition): Record<string, any> {
    return {
      "format_version": "1.20.0",
      "minecraft:item": {
        "description": {
          "identifier": item.id
        },
        "components": {
          "minecraft:max_stack_size": {
            "size": item.maxStackSize ?? 64
          }
        }
      }
    };
  }

  static generateEntityJson(entity: EntityDefinition): Record<string, any> {
    return {
      "format_version": "1.20.0",
      "minecraft:entity": {
        "description": {
          "identifier": entity.id,
          "is_spawnable": entity.spawnable ?? true,
          "is_summonable": entity.summonable ?? true
        },
        "components": {},
        "spawn_egg": {
          "texture": `entity_${entity.name}`
        }
      }
    };
  }
}
