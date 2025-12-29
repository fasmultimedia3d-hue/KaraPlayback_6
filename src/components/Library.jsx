import React, { useState, useEffect } from 'react';
import { Plus, Play, Trash2, Search, Music, Folder, ArrowLeft, FolderPlus, MoveRight, Settings, X } from 'lucide-react';
import { StorageService } from '../services/StorageService';

// Simple Modal Component for Folder Selection
const FolderSelector = ({ folders, onClose, onSelect, currentParentId }) => {
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
                <h3 className="text-xl font-bold mb-4">Select Folder</h3>
                <div className="max-h-[60vh] overflow-y-auto space-y-2">
                    <button
                        onClick={() => onSelect(null)}
                        className={`w-full text-left p-3 rounded-xl transition flex items-center gap-2 ${currentParentId === null ? 'bg-violet-600' : 'bg-slate-800 hover:bg-slate-700'}`}
                    >
                        <Folder size={18} />
                        <span>Library (Root)</span>
                    </button>
                    {folders.map(f => (
                        <button
                            key={f.id}
                            onClick={() => onSelect(f.id)}
                            className={`w-full text-left p-3 rounded-xl transition flex items-center gap-2 ${currentParentId === f.id ? 'bg-violet-600' : 'bg-slate-800 hover:bg-slate-700'}`}
                            disabled={f.id === currentParentId} // Can add check for circular ref here if needed for folders
                        >
                            <Folder size={18} />
                            <span>{f.title}</span>
                        </button>
                    ))}
                </div>
                <button onClick={onClose} className="mt-4 w-full py-2 bg-slate-800 hover:bg-slate-700 rounded-full transition">
                    Cancel
                </button>
            </div>
        </div>
    );
};

const Library = ({ onSelectProject, onOpenSettings, refreshKey, folderId, onFolderChange, hasActiveProject, onReturnToPlayer }) => {
    const [allItems, setAllItems] = useState([]); // All items (folders + projects)
    const currentFolderId = folderId || null;
    const setCurrentFolderId = onFolderChange;
    const [searchTerm, setSearchTerm] = useState('');

    // Move Logic
    const [itemToMove, setItemToMove] = useState(null); // ID of item being moved
    const [showMoveModal, setShowMoveModal] = useState(false);

    useEffect(() => {
        loadItems();
    }, [refreshKey]);

    const loadItems = async () => {
        try {
            const data = await StorageService.getAllProjects();
            setAllItems(data);
        } catch (e) {
            console.error("Failed to load library", e);
        }
    };

    const handleCreateFolder = async () => {
        const name = prompt("Folder Name:");
        if (!name) return;

        const folder = {
            id: crypto.randomUUID(),
            title: name,
            type: 'folder',
            parentId: currentFolderId,
            timestamp: new Date().toISOString()
        };

        await StorageService.saveProject(folder);
        loadItems();
    };

    const handleDelete = async (id, type, e) => {
        e.stopPropagation();
        const msg = type === 'folder'
            ? "Are you sure? This will delete the folder and ALL contents inside!"
            : "Are you sure you want to delete this song?";

        if (confirm(msg)) {
            if (type === 'folder') {
                await StorageService.deleteFolder(id);
            } else {
                await StorageService.deleteProject(id);
            }
            loadItems();
        }
    };

    const initiateMove = (e, item) => {
        e.stopPropagation();
        setItemToMove(item);
        setShowMoveModal(true);
    };

    const handleMove = async (targetFolderId) => {
        if (!itemToMove) return;
        try {
            // Prevent moving folder into itself (basic check)
            if (itemToMove.id === targetFolderId) {
                alert("Cannot move folder into itself");
                return;
            }
            await StorageService.moveProject(itemToMove.id, targetFolderId);
            loadItems();
            setShowMoveModal(false);
            setItemToMove(null);
        } catch (e) {
            alert(e.message);
        }
    };

    // Filter logic
    const displayedItems = allItems.filter(item => {
        // If searching, ignore current folder and search globally
        if (searchTerm) {
            return item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (item.artist && item.artist.toLowerCase().includes(searchTerm.toLowerCase()));
        }

        // Otherwise, must match current Folder
        return item.parentId === currentFolderId || (item.parentId === undefined && currentFolderId === null);
    });

    // Sort: Folders first, then Newest Projects
    displayedItems.sort((a, b) => {
        if (a.type === 'folder' && b.type !== 'folder') return -1;
        if (a.type !== 'folder' && b.type === 'folder') return 1;
        return new Date(b.timestamp) - new Date(a.timestamp);
    });

    // Get current folder name for header
    const currentFolderName = currentFolderId
        ? allItems.find(i => i.id === currentFolderId)?.title || "Unknown Folder"
        : "Library";

    // Get all folders for the selector (flattened list for now)
    // Exclude current item if it is a folder to prevent self-nesting
    const availableFolders = allItems.filter(i =>
        i.type === 'folder' &&
        (!itemToMove || i.id !== itemToMove.id)
    );

    return (
        <div className="flex flex-col h-screen bg-slate-950 text-slate-100 relative">
            <div className="pt-safe flex flex-col h-full overflow-hidden">
                {showMoveModal && (
                    <FolderSelector
                        folders={availableFolders}
                        onClose={() => setShowMoveModal(false)}
                        onSelect={handleMove}
                        currentParentId={itemToMove?.parentId || null}
                    />
                )}

                {/* Header */}
                <div className="flex justify-between items-center px-6 py-4 landscape:py-2">
                    <div className="flex items-center gap-4">
                        {currentFolderId && (
                            <button
                                onClick={() => setCurrentFolderId(null)} // For now only go to Root. ideal: stack
                                className="p-2 hover:bg-slate-800 rounded-full transition text-slate-400 hover:text-white"
                            >
                                <ArrowLeft size={24} />
                            </button>
                        )}
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent truncate max-w-[300px]">
                            {currentFolderName}
                        </h1>
                    </div>

                    <div className="flex gap-2 items-center">
                        {hasActiveProject && (
                            <button
                                onClick={onReturnToPlayer}
                                className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-fuchsia-600/20 active:scale-95"
                                title="Ir al Reproductor"
                            >
                                <Play size={14} fill="currentColor" />
                                <span className="hidden sm:inline">En Reproducción</span>
                            </button>
                        )}
                        <button
                            onClick={onOpenSettings}
                            className="p-2 hover:bg-slate-800 rounded-full transition text-slate-400 hover:text-white mr-2"
                            title="Settings"
                        >
                            <Settings size={24} />
                        </button>

                        <button
                            onClick={handleCreateFolder}
                            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-full font-medium transition"
                        >
                            <FolderPlus size={20} className="text-blue-400" />
                            <span className="hidden md:inline">New Folder</span>
                        </button>
                        <button
                            onClick={() => onSelectProject(null, currentFolderId)} // New Project in this folder
                            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 px-4 py-2 rounded-full font-medium transition shadow-lg shadow-violet-600/20"
                        >
                            <Plus size={20} />
                            <span className="hidden md:inline">New Project</span>
                        </button>
                    </div>
                </div>

                {/* Search */}
                <div className="relative mb-6">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500" size={20} />
                    <input
                        type="text"
                        placeholder="Search in entire library..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-10 pr-12 text-slate-200 focus:outline-none focus:border-violet-500 transition"
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-slate-800 rounded-full text-slate-500 hover:text-white transition"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>

                {/* List */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pb-20">
                    {displayedItems.map(item => (
                        <div
                            key={item.id}
                            onClick={() => {
                                if (item.type === 'folder') {
                                    setCurrentFolderId(item.id);
                                    setSearchTerm('');
                                } else {
                                    onSelectProject(item);
                                }
                            }}
                            className={`group border border-white/5 rounded-2xl p-4 cursor-pointer transition-all duration-300 relative overflow-hidden
                            ${item.type === 'folder'
                                    ? 'bg-slate-800/40 hover:bg-slate-800/60 border-blue-500/10 hover:border-blue-500/30'
                                    : 'bg-slate-900/50 hover:bg-slate-800 hover:border-violet-500/30'}
                        `}
                        >
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center transition
                                    ${item.type === 'folder'
                                            ? 'bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20'
                                            : 'bg-slate-800 text-slate-400 group-hover:bg-violet-500/20 group-hover:text-violet-400'}
                                `}>
                                        {item.type === 'folder' ? <Folder size={24} /> : <Music size={24} />}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-lg truncate max-w-[150px]">{item.title}</h3>
                                        <p className="text-sm text-slate-500">
                                            {item.type === 'folder'
                                                ? 'Folder'
                                                : (searchTerm && item.parentId
                                                    ? `in ${allItems.find(i => i.id === item.parentId)?.title || 'Unknown'}`
                                                    : (item.artist || 'Unknown Artist'))}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                                    <button
                                        onClick={(e) => initiateMove(e, item)}
                                        className="p-2 hover:text-blue-400 transition"
                                        title="Move to..."
                                    >
                                        <MoveRight size={18} />
                                    </button>
                                    <button
                                        onClick={(e) => handleDelete(item.id, item.type, e)}
                                        className="p-2 hover:text-red-400 transition"
                                        title="Delete"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center text-xs text-slate-500">
                                <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                                {item.type !== 'folder' && (
                                    <div className="flex items-center gap-1 group-hover:text-violet-400 transition">
                                        <span>Open</span>
                                        <Play size={12} />
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {displayedItems.length === 0 && (
                        <div className="col-span-full text-center py-12 text-slate-600">
                            <p>Empty folder</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Library;
