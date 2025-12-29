import { LyricsParser } from './LyricsParser';
import JSZip from 'jszip';

export const ProjectService = {
    /**
     * Package project into a ZIP blob
     * @param {Object} metadata - { title, lyrics, audioSettings, etc }
     * @param {Blob} audioBlob - The actual audio file
     * @returns {Promise<Blob>}
     */
    packProject: async (metadata, audioBlob) => {
        const zip = new JSZip();

        // Add metadata
        zip.file("project.json", JSON.stringify(metadata, null, 2));

        // Add audio
        // Try to guess mime type from extension if possible, or just default
        let ext = 'mp3';
        if (audioBlob.type === 'audio/wav') ext = 'wav';
        if (audioBlob.type === 'audio/flac') ext = 'flac';
        if (audioBlob.type === 'audio/ogg') ext = 'ogg'; // generic

        zip.file(`audio.${ext}`, audioBlob);

        // Generate ZIP
        return await zip.generateAsync({ type: "blob" });
    },

    /**
     * Unpack a project ZIP file
     * @param {File} zipFile 
     * @returns {Promise<{metadata: Object, audioBlob: Blob}>}
     */
    unpackProject: async (zipFile) => {
        try {
            const zip = await JSZip.loadAsync(zipFile);

            // Read Metadata
            const jsonText = await zip.file("project.json").async("string");
            const metadata = JSON.parse(jsonText);

            // Read Audio
            // Find file starting with "audio."
            const audioFilename = Object.keys(zip.files).find(name => name.startsWith("audio."));
            if (!audioFilename) throw new Error("Audio file not found in package");

            const ext = audioFilename.split('.').pop();
            const mimeType = ext === 'mp3' ? 'audio/mpeg' :
                ext === 'wav' ? 'audio/wav' :
                    ext === 'flac' ? 'audio/flac' : 'audio/mpeg';

            const audioBlob = await zip.file(audioFilename).async("blob");
            const typedBlob = new Blob([audioBlob], { type: mimeType });

            console.log("Unpacked:", audioFilename, typedBlob.type);

            return { metadata, audioBlob: typedBlob };
        } catch (e) {
            console.error("Failed to unpack project", e);
            throw new Error("Invalid Project Package: " + e.message);
        }
    },

    /**
     * Parse a Project JSON string
     * @param {string} jsonString 
     * @returns {Object|null}
     */
    parseProjectJSON: (jsonString) => {
        try {
            const project = JSON.parse(jsonString);

            // Basic validation
            if (!project.lyrics && !project.title) {
                throw new Error("Invalid Project Format");
            }

            return project;
        } catch (e) {
            console.error("Failed to parse project JSON", e);
            return null;
        }
    },

    /**
     * Create a downloadable JSON blob from current state (Legacy/Metadata only)
     * @param {string} title 
     * @param {Array} lyrics 
     * @param {Object} settings 
     * @returns {Blob}
     */
    exportProjectToJSON: (title, lyrics, settings) => {
        const project = {
            id: crypto.randomUUID(),
            title: title || "Untitled Project",
            timestamp: new Date().toISOString(),
            lyrics: lyrics,
            audioSettings: settings,
            version: 1
        };

        return new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    }
};
