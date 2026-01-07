import React, { useState, useEffect } from 'react';
import { ArrowLeft, Trash2, Info, Volume2, ShieldAlert, CloudUpload, CloudDownload, Folder } from 'lucide-react';
import { StorageService } from '../services/StorageService';
import { BackupService } from '../services/BackupService';
import { FilePicker } from '@capawesome/capacitor-file-picker';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { blobToBase64 } from '../utils/base64';
import PinModal from './PinModal';

const Settings = ({ onBack }) => {
    const [stats, setStats] = useState({ projects: 0, folders: 0 });
    const [showPinModal, setShowPinModal] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progressMsg, setProgressMsg] = useState('');

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
                await StorageService.deleteProject(item.id);
            }
            alert("All data cleared.");
            setStats({ projects: 0, folders: 0 });
            setShowPinModal(false);
        } catch (e) {
            alert("Error clearing data: " + e.message);
        }
    };

    const handleBackup = async () => {
        if (!confirm("Esto creará un archivo ZIP con TODOS tus proyectos. Puede tardar un poco. ¿Continuar?")) return;

        setIsProcessing(true);
        setProgressMsg("Empaquetando proyectos...");

        try {
            // 1. Generate ZIP
            const blob = await BackupService.createFullBackup((current, total) => {
                setProgressMsg(`Procesando: ${current} de ${total}`);
            });

            // 2. Save/Share
            const filename = `KaraPlayback_Backup_${new Date().toISOString().slice(0, 10)}.zip`;

            if (Capacitor.isNativePlatform()) {
                setProgressMsg("Guardando archivo...");
                const base64 = await blobToBase64(blob);

                const result = await Filesystem.writeFile({
                    path: filename,
                    data: base64,
                    directory: Directory.Cache
                });

                await Share.share({
                    title: 'KaraPlayback Backup',
                    url: result.uri,
                    dialogTitle: 'Guardar Backup en Drive'
                });
            } else {
                // Web Fallback
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.click();
                URL.revokeObjectURL(url);
            }
            alert("Backup completado con éxito.");
        } catch (e) {
            console.error(e);
            alert("Error al crear backup: " + e.message);
        } finally {
            setIsProcessing(false);
            setProgressMsg('');
        }
    };

    const handleRestore = async () => {
        if (!confirm("⚠️ ATENCIÓN: Al restaurar se agregarán los proyectos del backup. Si ya existen, podrían duplicarse. ¿Continuar?")) return;

        try {
            // 1. Pick File
            const result = await FilePicker.pickFiles({
                types: ['application/zip', 'application/octet-stream'],
                multiple: false,
                readData: false
            });

            if (!result.files.length) return;

            setIsProcessing(true);
            setProgressMsg("Leyendo archivo...");

            const file = result.files[0];
            // Strategy: WebPath fetch to avoid OOM
            const fetchUrl = file.webPath || (file.path ? Capacitor.convertFileSrc(file.path) : null);

            if (!fetchUrl) throw new Error("No se pudo leer el archivo (Ruta desconocida)");

            const response = await fetch(fetchUrl);
            const blob = await response.blob();

            // 2. Restore
            setProgressMsg("Descomprimiendo y restaurando...");
            await BackupService.restoreFullBackup(blob, (current, total) => {
                setProgressMsg(`Restaurando: ${current} de ${total}`);
            });

            await loadStats(); // Refresh stats
            alert("Restauración completada. Tus proyectos han sido importados.");

        } catch (e) {
            console.error(e);
            if (e.message !== 'pickFiles canceled.') {
                alert("Error al restaurar: " + e.message);
            }
        } finally {
            setIsProcessing(false);
            setProgressMsg('');
        }
    };

    return (
        <div className="flex flex-col h-screen bg-slate-950 text-slate-100 p-6 portrait:pt-[max(2rem,env(safe-area-inset-top))] animate-fade-in overflow-y-auto">
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
            <div className="flex flex-col justify-center items-center gap-2 mb-8">
                <img
                    src="/icon.png"
                    alt="App Logo"
                    className="w-16 h-16 rounded-2xl mb-2"
                    style={{ boxShadow: '0 0 25px 5px rgba(167, 139, 250, 0.8)' }}
                />
                <div className="text-center">
                    <h2 className="text-4xl font-extrabold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent drop-shadow-sm tracking-tight">
                        KaraPlayback
                    </h2>
                    <div className="h-1 w-12 bg-violet-500 mx-auto mt-2 rounded-full opacity-50"></div>
                </div>
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

                {/* Section: Backup & Restore */}
                <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-4 text-emerald-400">
                        <Folder size={24} />
                        <h2 className="text-xl font-bold">Respaldo y Restauración</h2>
                    </div>

                    <div className="space-y-4">
                        <button
                            onClick={handleBackup}
                            disabled={isProcessing}
                            className="w-full py-4 bg-emerald-900/20 hover:bg-emerald-900/40 text-emerald-400 border border-emerald-900/50 rounded-xl transition font-medium flex items-center justify-center gap-3 group"
                        >
                            <CloudUpload size={20} className="group-hover:scale-110 transition" />
                            <div className="flex flex-col items-start">
                                <span className="font-bold">Crear Copia de Seguridad</span>
                                <span className="text-xs opacity-70">Exportar todo a Google Drive (ZIP)</span>
                            </div>
                        </button>

                        <button
                            onClick={handleRestore}
                            disabled={isProcessing}
                            className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl transition font-medium flex items-center justify-center gap-3 group"
                        >
                            <CloudDownload size={20} className="group-hover:scale-110 transition" />
                            <div className="flex flex-col items-start">
                                <span className="font-bold">Restaurar Copia</span>
                                <span className="text-xs opacity-70">Importar desde Drive (Sobreescribe)</span>
                            </div>
                        </button>
                    </div>

                    {isProcessing && (
                        <div className="mt-4 text-center text-sm text-slate-400 animate-pulse">
                            {progressMsg}
                        </div>
                    )}
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
                            <span className="text-white">0.3.0 (Beta)</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Engine</span>
                            <span className="text-white">WaveSurfer.js + React</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Creado por</span>
                            <span className="text-white font-medium">Fredy Suarez</span>
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
