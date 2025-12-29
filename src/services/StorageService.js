const DB_NAME = 'KaraokeAppDB';
const DB_VERSION = 1;
const STORE_NAME = 'projects';

export const StorageService = {
    /**
     * Open the database
     * @returns {Promise<IDBDatabase>}
     */
    openDB: () => {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = (event) => reject("IndexedDB error: " + event.target.error);

            request.onsuccess = (event) => resolve(event.target.result);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
            };
        });
    },

    /**
     * Save a project (including audio blobs)
     * @param {Object} project 
     * @returns {Promise<void>}
     */
    saveProject: async (project) => {
        const db = await StorageService.openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

            // Ensure project has an ID
            if (!project.id) project.id = crypto.randomUUID();

            const request = store.put(project);

            request.onsuccess = () => resolve();
            request.onerror = (e) => reject("Error saving project: " + e.target.error);
        });
    },

    /**
     * Get all projects (Metadata only mostly, but IDB returns full objects. 
     * For optimization we might want to use cursor to strip blobs, but for now full load is fine for < 100 songs)
     * @returns {Promise<Array>}
     */
    getAllProjects: async () => {
        const db = await StorageService.openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.openCursor();
            const results = [];

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    // Strip blob immediately!
                    const { audioBlob, ...rest } = cursor.value;
                    results.push(rest);
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
            request.onerror = (e) => reject("Error loading projects: " + e.target.error);
        });
    },

    /**
     * Get a specific project by ID
     * @param {string} id 
     * @returns {Promise<Object>}
     */
    getProject: async (id) => {
        const db = await StorageService.openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject("Error loading project: " + e.target.error);
        });
    },

    /**
     * Delete a project
     * @param {string} id 
     * @returns {Promise<void>}
     */
    deleteProject: async (id) => {
        const db = await StorageService.openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = (e) => reject("Error deleting project: " + e.target.error);
        });
    },

    /**
     * Delete a folder and its contents recursively
     * @param {string} folderId 
     */
    deleteFolder: async (folderId) => {
        const allItems = await StorageService.getAllProjects();
        // Find children
        const children = allItems.filter(i => i.parentId === folderId);

        for (const child of children) {
            if (child.type === 'folder') {
                await StorageService.deleteFolder(child.id);
            } else {
                await StorageService.deleteProject(child.id);
            }
        }

        await StorageService.deleteProject(folderId);
    },

    /**
     * Move a project or folder to a new parent folder
     * @param {string} id - The item ID
     * @param {string|null} newParentId - The new folder ID (null for root)
     */
    moveProject: async (id, newParentId) => {
        const item = await StorageService.getProject(id);
        if (!item) throw new Error("Item not found");

        // Prevent moving a folder into itself or its children (basic check)
        if (item.type === 'folder' && id === newParentId) {
            throw new Error("Cannot move folder into itself");
        }

        item.parentId = newParentId;
        await StorageService.saveProject(item);
    }
};
