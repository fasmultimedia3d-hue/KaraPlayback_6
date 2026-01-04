import React, { useState, useEffect } from 'react';
import { ArrowLeft, Trash2, Github, Info, Volume2, ShieldAlert } from 'lucide-react';
import { StorageService } from '../services/StorageService';
import PinModal from './PinModal';

const Settings = ({ onBack }) => {
    const [stats, setStats] = useState({ projects: 0, folders: 0 });
    const [showPinModal, setShowPinModal] = useState(false);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            const items = await StorageService.getAllProjects();
            const projects = items.filter(i => i.type !== 'folder').length;
            const folders = items.filter(i => i.type === 'folder').length;
            setStats({ projects, folders });
        } catch (e) {
            console.error(e);
        }
    };

    const handleClearData = async () => {
        try {
            const items = await StorageService.getAllProjects();
            for (const item of items) {
                await StorageService.deleteProject(item.id); // Reuses delete logic which handles blobs
            }
            alert("All data cleared.");
            setStats({ projects: 0, folders: 0 });
            setShowPinModal(false);
        } catch (e) {
            alert("Error clearing data: " + e.message);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-slate-950 text-slate-100 p-6 pt-safe animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-4 mb-2">
                <button
                    onClick={onBack}
                    className="p-2 hover:bg-slate-800 rounded-full transition text-slate-400 hover:text-white"
                >
                    <ArrowLeft size={24} />
                </button>
                <h1 className="text-xl font-bold text-slate-400">
                    Settings
                </h1>
            </div>

            {/* Brand Title Centered */}
            <div className="text-center mb-8">
                <h2 className="text-4xl font-extrabold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent drop-shadow-sm tracking-tight">
                    KaraPlayback
                </h2>
                <div className="h-1 w-12 bg-violet-500 mx-auto mt-2 rounded-full opacity-50"></div>
            </div>

            <div className="max-w-2xl mx-auto w-full space-y-8">

                {/* Section: Storage */}
                <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-4 text-violet-400">
                        <Trash2 size={24} />
                        <h2 className="text-xl font-bold">Storage & Data</h2>
                    </div>

                    <div className="flex justify-between items-center mb-6 text-slate-400">
                        <span>Total Projects</span>
                        <span className="font-mono text-white">{stats.projects}</span>
                    </div>
                    <div className="flex justify-between items-center mb-6 text-slate-400">
                        <span>Total Folders</span>
                        <span className="font-mono text-white">{stats.folders}</span>
                    </div>

                    <div className="flex justify-center">
                        <button
                            onClick={() => setShowPinModal(true)}
                            className="px-4 py-2 text-sm bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/50 rounded-lg transition font-medium flex items-center justify-center gap-2 group"
                        >
                            <ShieldAlert size={14} className="group-hover:animate-pulse" />
                            Delete All Data
                        </button>
                    </div>
                    <p className="text-[10px] text-red-500/50 mt-2 text-center">This action cannot be undone.</p>
                </section>

                {/* Section: Audio */}
                <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 opacity-75">
                    <div className="flex items-center gap-3 mb-4 text-blue-400">
                        <Volume2 size={24} />
                        <h2 className="text-xl font-bold">Audio Configuration</h2>
                    </div>

                    <div className="p-4 bg-slate-950/50 rounded-xl text-center text-slate-500 text-sm">
                        No global settings available yet. <br />
                        Configure speed locally in the Player.
                    </div>
                </section>

                {/* Section: About */}
                <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-4 text-slate-300">
                        <Info size={24} />
                        <h2 className="text-xl font-bold">About</h2>
                    </div>

                    <div className="space-y-4 text-slate-400 text-sm">
                        <div className="flex justify-between">
                            <span>Version</span>
                            <span className="text-white">0.2.0 (Alpha)</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Engine</span>
                            <span className="text-white">WaveSurfer.js + React</span>
                        </div>

                    </div>
                </section>

            </div>

            <PinModal
                isOpen={showPinModal}
                onClose={() => setShowPinModal(false)}
                onSuccess={handleClearData}
            />
        </div>
    );
};

export default Settings;
