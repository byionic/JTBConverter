// src/utils/version-mapper.ts

export interface BedrockVersionInfo {
  java: string;
  bedrock: string[];
  engine: [number, number, number];
}

export class VersionMapper {
  /**
   * Detect Minecraft version from mod metadata
   * @param depends - Dependencies object from fabric.mod.json or mods.toml
   * @returns Detected Java version string or null
   */
  static detectVersion(depends: Record<string, string>): string | null {
    // Check for "minecraft" dependency (Fabric)
    if (depends['minecraft']) {
      const mcDep = depends['minecraft'];
      // Extract version from range like ">=1.20.1" or ">=1.20 <=1.20.4"
      const versionMatch = mcDep.match(/(\d+\.\d+(?:\.\d+)?)/);
      if (versionMatch) {
        return versionMatch[1];
      }
    }
    
    // Check for "forge" or "neoforge" dependencies
    const forgeDep = depends['forge'] || depends['neoforge'];
    if (forgeDep) {
      const versionMatch = forgeDep.match(/(\d+\.\d+(?:\.\d+)?)/);
      if (versionMatch) {
        return versionMatch[1];
      }
    }
    
    return null;
  }

  /**
   * Calculate compatible Bedrock versions from Java version
   * Uses an algorithm instead of hardcoded mappings
   * @param javaVersion - Java MC version (e.g., "1.20.1")
   * @returns Bedrock version info
   */
  static getBedrockVersions(javaVersion: string): BedrockVersionInfo {
    // Parse major.minor.patch
    const [major, minor, patch] = javaVersion.split('.').map(Number);
    
    // Algorithm: Bedrock generally trails Java by ~0-3 months
    // Bedrock uses triple-digit minor versions (1.20.x becomes 1.20.xx)
    // We calculate a reasonable range based on the version
    
    // Convert to base version number for calculation
    const baseNumber = (major - 1) * 1000 + minor * 100 + (patch || 0);
    
    // Calculate compatible Bedrock versions
    // Bedrock typically matches major.minor but with different patch numbering
    const bedrockMinor = Math.floor(baseNumber / 100);
    const bedrockPatchMin = Math.max(0, bedrockMinor % 100);
    const bedrockPatchMax = Math.min(99, bedrockPatchMin + 20);
    
    // Generate 3 versions around the calculated base
    const bedrockVersions = [
      `${major}.${minor}.${bedrockPatchMin}`,
      `${major}.${minor}.${bedrockPatchMin + 10}`,
      `${major}.${minor}.${Math.min(bedrockPatchMin + 20, 99)}`
    ].filter(v => parseInt(v.split('.')[2]) >= 0);
    
    // Calculate minimum engine version for Bedrock API
    const minEngine: [number, number, number] = [
      major,
      minor,
      bedrockPatchMin
    ];
    
    return {
      java: javaVersion,
      bedrock: bedrockVersions,
      engine: minEngine
    };
  }

  /**
   * Generate human-readable version info
   */
  static formatVersionInfo(info: BedrockVersionInfo): string {
    return `Java ${info.java} → Bedrock ${info.bedrock.join(', ')}`;
  }
}
