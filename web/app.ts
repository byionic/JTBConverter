// web/app.ts

import { JarParser } from '../src/parser/jar-parser';
import { RegistryTranslator } from '../src/translator/registry-translator';
import { AddonBuilder } from '../src/builder/addon-builder';
import { ConvertedMod } from '../src/types';

const jtbapiPath = './jtbapi';  // Path to bundled JTBAPI folder

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
        loader: 'unknown' as const
      };
      
      console.log('Mod detected:', modMeta);
      setStatus(`Found mod: ${modMeta.name} (${modMeta.modId})`, 'success');
      convertBtn!.disabled = false;
    } catch (err) {
      setStatus(`Error reading JAR: ${(err as Error).message}`, 'error');
    }
  }

  async function handleConvert() {
    const file = (document.getElementById('file-input') as HTMLInputElement).files?.[0];
    if (!file) return;
    
    setStatus('Parsing mod contents...', 'info');
    convertBtn!.disabled = true;
    
    try {
      const buffer = await file.arrayBuffer();
      const contents = await JarParser.parse(buffer);
      
      const modMeta = contents.fabricMetadata || contents.forgeMetadata || {
        modId: file.name.replace('.jar', '').toLowerCase(),
        name: file.name.replace('.jar', ''),
        version: '1.0.0',
        loader: 'unknown' as const
      };
      
      // Extract content
      const blocks = RegistryTranslator.extractBlocks(contents.classFiles, modMeta.modId);
      const items = RegistryTranslator.extractItems(contents.classFiles, modMeta.modId);
      const entities = RegistryTranslator.extractEntities(contents.classFiles, modMeta.modId);
      
      const convertedMod: ConvertedMod = {
        metadata: modMeta,
        blocks,
        items,
        entities,
        errors: [],
        warnings: []
      };
      
      setStatus(`Extracted ${blocks.length} blocks, ${items.length} items, ${entities.length} entities`, 'success');
      setStatus('Building Bedrock addon...', 'info');
      
      // Build addon
      const blob = await AddonBuilder.build(convertedMod, jtbapiPath);
      
      // Trigger download
      const url = URL.createObjectURL(blob);
      downloadLink.href = url;
      downloadLink.download = `${modMeta.modId}_bedrock.mcaddon`;
      downloadLinkContainer.classList.remove('hidden');
      
      setStatus('Conversion complete!', 'success');
      convertBtn!.disabled = false;
    } catch (err) {
      setStatus(`Conversion failed: ${(err as Error).message}`, 'error');
      convertBtn!.disabled = false;
    }
  }

  function setStatus(message: string, type: 'info' | 'success' | 'error') {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
  }
});
