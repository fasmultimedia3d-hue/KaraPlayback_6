import JSZip from 'jszip';
import { StorageService } from './StorageService';
import { ProjectService } from './ProjectService';

export const BackupService = {
    /**
     * Create a full backup of all projects and folders
     * @returns {Promise<Blob>} The master ZIP blob
     */
    createFullBackup: async (onProgress) => {
        const zip = new JSZip();

        // 1. Get all items
        const allItems = await StorageService.getAllProjects();
        const folders = allItems.filter(i => i.type === 'folder');
        const projectsMeta = allItems.filter(i => i.type !== 'folder');

        // 2. Save Structure (Folders)
        zip.file("hierarchy.json", JSON.stringify(folders, null, 2));

        // 3. Pack Projects
        const projectsFolder = zip.folder("projects");
        let processed = 0;
        const total = projectsMeta.length;

        for (const meta of projectsMeta) {
            try {
                // Fetch full project (with blobs)
                const fullProject = await StorageService.getProject(meta.id);
                if (!fullProject) continue;

                const { title, lyrics, audioSettings, audioBlob, pdfBlob, pdfPageTimestamps } = fullProject;

                // Include ID and ParentID in metadata so they survive the trip
                const packageBlob = await ProjectService.packProject(
                    {
                        title,
                        lyrics,
                        audioSettings,
                        pdfPageTimestamps,
                        id: fullProject.id,      // Preserve ID
                        parentId: fullProject.parentId // Preserve Folder Location
                    },
                    audioBlob,
                    pdfBlob
                );

                // Add to ZIP using ID as filename to avoid duplicates/filename issues
                projectsFolder.file(`${fullProject.title.replace(/[^a-z0-9]/gi, '_')}_${fullProject.id}.karaoke`, packageBlob);

                processed++;
                if (onProgress) onProgress(processed, total);
            } catch (e) {
                console.error(`Failed to pack project ${meta.id}:`, e);
            }
        }

        // 4. Generate Master ZIP
        return await zip.generateAsync({ type: "blob" });
    },

    /**
     * Restore a full backup from a master ZIP
     * @param {Blob} zipFile 
     * @param {Function} onProgress 
     */
    restoreFullBackup: async (zipFile, onProgress) => {
        const zip = await JSZip.loadAsync(zipFile);

        // 1. Restore Hierarchy
        const hierarchyFile = zip.file("hierarchy.json");
        if (hierarchyFile) {
            const hierarchyJson = await hierarchyFile.async("string");
            const folders = JSON.parse(hierarchyJson);

            // Save folders (merging or overwriting?)
            // For now, simple save. IDs preserve relationships.
            for (const folder of folders) {
                await StorageService.saveProject(folder);
            }
        }

        // 2. Restore Projects
        const projectsFolder = zip.folder("projects");
        if (projectsFolder) {
            const projectFiles = [];
            projectsFolder.forEach((relativePath, file) => {
                if (!file.dir) projectFiles.push(file);
            });

            let processed = 0;
            const total = projectFiles.length;

            for (const file of projectFiles) {
                try {
                    const blob = await file.async("blob");
                    // Rename blob to help unpacker logic if needed, though unpackProject reads internal json
                    // We need to inject the filename if ProjectService relies on it for detection (it doesn't heavily)

                    // Unpack
                    const { metadata, audioBlob, pdfBlob, pdfPageTimestamps } = await ProjectService.unpackProject(blob);

                    // Force ID regeneration or keep? 
                    // Best to keep ID if possible to match folder structure, 
                    // BUT ProjectService.unpackProject usually intended for new imports.

                    // Let's reconstruct the object
                    // We try to match the ID from filename if possible, OR just treat as new if collision?
                    // "Restore" implies getting back old state.
                    // The filename is "Title_ID.karaoke". We can extract ID.

                    let idToUse = null;
                    const parts = file.name.split('_');
                    if (parts.length > 1) {
                        const lastPart = parts[parts.length - 1]; // "ID.karaoke"
                        idToUse = lastPart.replace('.karaoke', '');
                    }

                    const project = {
                        id: idToUse || crypto.randomUUID(),
                        title: metadata.title,
                        lyrics: metadata.lyrics,
                        audioSettings: metadata.audioSettings,
                        audioBlob: audioBlob,
                        pdfBlob: pdfBlob,
                        pdfPageTimestamps: metadata.pdfPageTimestamps,
                        parentId: null, // Temporarily null, logic below tries to fix?
                        type: 'project',
                        timestamp: new Date().toISOString()
                    };

                    // Re-link parentId? 
                    // The "hierarchy.json" has folders. But the projects inside "archive" don't explicitly say their parent 
                    // unless we saved that metadata in `packProject`.
                    // Wait, `ProjectService.packProject` packs { title, lyrics... } but NOT paentId usually.

                    // FIX: We need to ensure parentId is preserved.
                    // Option A: `packProject` should include parentId in `project.json`.
                    // Option B: `BackupService` saves a `map.json` of ID -> ParentID.

                    // But wait, `StorageService.getAllProjects()` returns items with `parentId`.
                    // `hierarchy.json` only saves folders.
                    // We should save a `projects_manifest.json` too with IDs and ParentIDs.

                    // Let's check `project.json` inside the `.karaoke`.
                    // If we modify `packProject` to include generic metadata, that's best.
                    // But `packProject` takes `metadata` object. We can pass parentId there!

                    // For now, in Restore, let's just save.
                    // If we lost parentId, they go to root. Acceptable for V1 or fix now?
                    // FIX NOW: `createFullBackup` passes parentId to `packProject`.

                    if (metadata.parentId) project.parentId = metadata.parentId;

                    await StorageService.saveProject(project);

                    processed++;
                    if (onProgress) onProgress(processed, total);

                } catch (e) {
                    console.error("Failed to restore file:", file.name, e);
                }
            }
        }
    }
};
