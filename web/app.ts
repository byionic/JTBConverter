// web/app.ts

import { JarParser } from '../src/parser/jar-parser';
import { RegistryTranslator } from '../src/translator/registry-translator';
import { AddonBuilder } from '../src/builder/addon-builder';
import { ConvertedMod } from '../src/types';
import { VersionMapper } from '../src/utils/version-mapper';

document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('file-input') as HTMLInputElement;
  const convertBtn = document.getElementById('convert-btn') as HTMLButtonElement;
  const statusDiv = document.getElementById('status')!;
  const downloadLink = document.getElementById('download-url') as HTMLAnchorElement;
  const downloadLinkContainer = document.getElementById('download-link')!;

  fileInput?.addEventListener('change', handleFileSelect);
  convertBtn?.addEventListener('click', handleConvert);

  async function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (!file) return;
    
    setStatus('Reading JAR file...', 'info');
    
    try {
      const buffer = await file.arrayBuffer();
      const contents = await JarParser.parse(buffer);
      
      const modMeta = contents.fabricMetadata || contents.forgeMetadata || {
        modId: file.name.replace('.jar', '').toLowerCase(),
        name: file.name.replace('.jar', ''),
        version: '1.0.0',
        dependencies: {},
        loader: 'unknown' as const
      };
      
      // Auto-detect Minecraft version from dependencies
      const javaVersion = VersionMapper.detectVersion(modMeta.dependencies) || '1.20.1';
      const versionInfo = VersionMapper.getBedrockVersions(javaVersion);
      
      console.log('Mod detected:', modMeta);
      console.log('Java version:', javaVersion);
      console.log('Compatible Bedrock:', versionInfo.bedrock);
      
      setStatus(
        `Found mod: ${modMeta.name} (${modMeta.modId})\n` +
        `Java Version: ${javaVersion}\n` +
        `Will convert for Bedrock: ${versionInfo.bedrock.join(', ')}`,
        'success'
      );
      
      convertBtn!.disabled = false;
      // Store version info for later use
      (window as any)._detectedVersionInfo = versionInfo;
      (window as any)._modMeta = modMeta;
      (window as any)._contents = contents;
    } catch (err) {
      setStatus(`Error reading JAR: ${(err as Error).message}`, 'error');
    }
  }

  async function handleConvert() {
    const file = (document.getElementById('file-input') as HTMLInputElement).files?.[0];
    if (!file) return;
    
    // Retrieve stored data
    const versionInfo = (window as any)._detectedVersionInfo;
    const modMeta = (window as any)._modMeta;
    const contents = (window as any)._contents;
    
    if (!versionInfo || !modMeta || !contents) {
      setStatus('Please select a JAR file first.', 'error');
      return;
    }
    
    setStatus('Parsing mod contents...', 'info');
    convertBtn!.disabled = true;
    
    try {
      // Extract content
      const blocks = RegistryTranslator.extractBlocks(contents.classFiles, modMeta.modId);
      const items = RegistryTranslator.extractItems(contents.classFiles, modMeta.modId);
      const entities = RegistryTranslator.extractEntities(contents.classFiles, modMeta.modId);
      
      const convertedMod: ConvertedMod = {
        metadata: {
          ...modMeta,
          minecraftVersion: versionInfo.java
        },
        blocks,
        items,
        entities,
        versionInfo,
        errors: [],
        warnings: []
      };
      
      setStatus(
        `Extracted ${blocks.length} blocks, ${items.length} items, ${entities.length} entities\n` +
        `Bedrock Target: ${versionInfo.bedrock[0]}\n` +
        `Min Engine Version: ${versionInfo.engine.join('.')}`,
        'success'
      );
      setStatus('Building Bedrock addon...', 'info');
      
      // Build addon
      const blob = await AddonBuilder.build(convertedMod);
      
      // Trigger download
      const url = URL.createObjectURL(blob);
      downloadLink.href = url;
      downloadLink.download = `${modMeta.modId}_bedrock_${versionInfo.bedrock[0]}.mcaddon`;
      downloadLinkContainer.classList.remove('hidden');
      
      setStatus('Conversion complete!', 'success');
      convertBtn!.disabled = false;
    } catch (err) {
      setStatus(`Conversion failed: ${(err as Error).message}`, 'error');
      convertBtn!.disabled = false;
    }
  }

  function setStatus(message: string, type: 'info' | 'success' | 'error') {
    statusDiv.innerHTML = message.replace(/\n/g, '<br>');
    statusDiv.className = `status ${type}`;
  }
});
