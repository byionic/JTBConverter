// web/app.ts

import { JarParser } from '../src/parser/jar-parser';
import { RegistryTranslator } from '../src/translator/registry-translator';
import { AddonBuilder } from '../src/builder/addon-builder';
import { ConvertedMod } from '../src/types';
import { VersionMapper } from '../src/utils/version-mapper';

document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('file-input') as HTMLInputElement;
  const convertBtn = document.getElementById('convert-btn') as HTMLButtonButton;
  const statusDiv = document.getElementById('status')!;
  const downloadLink = document.getElementById('download-url') as HTMLAnchorElement;
  const downloadLinkContainer = document.getElementById('download-link')!;
  const dropZone = document.getElementById('drop-zone')!;

  let selectedFile: File | null = null;

  // ============================================
  // Click to browse
  // ============================================
  fileInput?.addEventListener('change', (event) => {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      selectedFile = input.files[0];
      handleFileSelected(selectedFile);
    }
  });

  // ============================================
  // Drag and drop
  // ============================================
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('drag-active');
  });

  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-active');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-active');

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      selectedFile = files[0];
      // Also update the file input so it shows the filename
      const dt = new DataTransfer();
      dt.items.add(selectedFile);
      fileInput.files = dt.files;
      handleFileSelected(selectedFile);
    }
  });

  // Also handle drop anywhere on the page
  document.body.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  document.body.addEventListener('drop', (e) => {
    e.preventDefault();
  });

  // ============================================
  // Convert button
  // ============================================
  convertBtn?.addEventListener('click', handleConvert);

  // ============================================
  // File selected handler
  // ============================================
  async function handleFileSelected(file: File) {
    if (!file.name.endsWith('.jar')) {
      setStatus('Please select a .jar file (Java mod)', 'error');
      convertBtn.disabled = true;
      return;
    }

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

      // Auto-detect Minecraft version
      const javaVersion = VersionMapper.detectVersion(modMeta.dependencies) || '1.20.1';
      const versionInfo = VersionMapper.getBedrockVersions(javaVersion);

      setStatus(
        `<strong>${modMeta.name}</strong> v${modMeta.version}<br>` +
        `Mod ID: ${modMeta.modId}<br>` +
        `Loader: ${modMeta.loader}<br>` +
        `Java Version: ${javaVersion}<br>` +
        `Bedrock Target: ${versionInfo.bedrock.join(', ')}<br>` +
        `Min Engine: ${versionInfo.engine.join('.')}`,
        'success'
      );

      convertBtn.disabled = false;

      // Store for convert handler
      (window as any)._versionInfo = versionInfo;
      (window as any)._modMeta = modMeta;
      (window as any)._contents = contents;
    } catch (err) {
      setStatus(`Error reading JAR: ${(err as Error).message}`, 'error');
      convertBtn.disabled = true;
    }
  }

  // ============================================
  // Convert handler
  // ============================================
  async function handleConvert() {
    if (!selectedFile) {
      setStatus('No file selected', 'error');
      return;
    }

    const versionInfo = (window as any)._versionInfo;
    const modMeta = (window as any)._modMeta;
    const contents = (window as any)._contents;

    if (!versionInfo || !modMeta || !contents) {
      setStatus('Please select a JAR file first', 'error');
      return;
    }

    setStatus('Parsing mod contents...', 'info');
    convertBtn.disabled = true;
    downloadLinkContainer.classList.add('hidden');

    try {
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
        `Found ${blocks.length} blocks, ${items.length} items, ${entities.length} entities<br>` +
        `Building addon...`,
        'info'
      );

      const blob = await AddonBuilder.build(convertedMod);

      const url = URL.createObjectURL(blob);
      downloadLink.href = url;
      downloadLink.download = `${modMeta.modId}_bedrock.mcaddon`;
      downloadLinkContainer.classList.remove('hidden');

      setStatus(
        `<strong>Conversion complete!</strong><br>` +
        `Blocks: ${blocks.length} | Items: ${items.length} | Entities: ${entities.length}<br>` +
        `Bedrock: ${versionInfo.bedrock[0]} (Engine ${versionInfo.engine.join('.')})`,
        'success'
      );

      convertBtn.disabled = false;
    } catch (err) {
      setStatus(`Conversion failed: ${(err as Error).message}`, 'error');
      console.error('Conversion error:', err);
      convertBtn.disabled = false;
    }
  }

  function setStatus(message: string, type: 'info' | 'success' | 'error') {
    statusDiv.innerHTML = message;
    statusDiv.className = `status ${type}`;
  }
});
