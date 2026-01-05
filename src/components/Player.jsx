import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Play, Pause, SkipBack, SkipForward, Music, FileText, Settings, Upload, ArrowLeft, Save, Folder, Edit3, Check, MousePointer2, Lock, ChevronLeft, ChevronRight, X, Clock } from 'lucide-react';
import { audioEngine } from '../services/AudioEngine';
import LyricsDisplay from './LyricsDisplay';
import PDFViewer from './PDFViewer';
import { LyricsParser } from '../services/LyricsParser';
import { ProjectService } from '../services/ProjectService';
import { StorageService } from '../services/StorageService';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

// Helper to convert Blob to Base64
const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = () => {
            resolve(reader.result.split(',')[1]);
        };
        reader.readAsDataURL(blob);
    });
};

const Player = ({ initialProject, initialFolderId, onBack, isVisible = true }) => {


    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [lyrics, setLyrics] = useState(initialProject?.lyrics || []);
    const [playbackRate, setPlaybackRate] = useState(initialProject?.audioSettings?.speed || 1.0);
    const [pitchShift, setPitchShift] = useState(initialProject?.audioSettings?.pitch || 0);
    const [isSynced, setIsSynced] = useState(!!initialProject?.lyrics?.some(l => l.time !== undefined && l.time !== null));

    // Project ID tracking
    const [currentProjectId, setCurrentProjectId] = useState(initialProject?.id || null);
    const [title, setTitle] = useState(initialProject?.title || "New Project");

    // State for Audio Blob and PDF Blob
    const [audioBlob, setAudioBlob] = useState(initialProject?.audioBlobRef || null);
    const [pdfBlob, setPdfBlob] = useState(initialProject?.pdfBlob || null);
    const [viewMode, setViewMode] = useState('lyrics'); // 'lyrics' | 'pdf'
    const [pdfCurrentPage, setPdfCurrentPage] = useState(1);
    const [pdfTotalPages, setPdfTotalPages] = useState(0);
    const [pdfPageTimestamps, setPdfPageTimestamps] = useState(initialProject?.pdfPageTimestamps || {});

    // Memoized PDF URL to prevent flickering during re-renders
    const pdfUrl = useMemo(() => {
        if (!pdfBlob) return null;
        return URL.createObjectURL(pdfBlob);
    }, [pdfBlob]);

    // Cleanup PDF URL
    useEffect(() => {
        return () => {
            if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        };
    }, [pdfUrl]);

    // Sync state when project changes (for background playback navigation)
    // Visibility Ref for Event Listeners
    const shouldUpdateVisualsRef = useRef(isVisible);

    // Auto-paging logic for PDF
    useEffect(() => {
        if (viewMode !== 'pdf' || !isPlaying) return;

        // Find the correct page for the current time
        const entries = Object.entries(pdfPageTimestamps);
        if (entries.length === 0) return;

        // Sort by time
        const sorted = entries
            .map(([pg, t]) => ({ page: parseInt(pg), time: t }))
            .sort((a, b) => b.time - a.time);

        const currentEntry = sorted.find(e => e.time <= currentTime);
        if (currentEntry && currentEntry.page !== pdfCurrentPage) {
            setPdfCurrentPage(currentEntry.page);
        }
    }, [currentTime, viewMode, isPlaying, pdfPageTimestamps]);

    useEffect(() => {
        if (isVisible) {
            // Delay visual updates slightly to allow CSS transition (300ms) to finish
            // This prevents main thread blocking (audio skips) during the animation
            const timer = setTimeout(() => {
                shouldUpdateVisualsRef.current = true;
                // Sync time once transition is done
                setCurrentTime(audioEngine.getCurrentTime());
            }, 350);
            return () => clearTimeout(timer);
        } else {
            // Stop updates immediately when hidden
            shouldUpdateVisualsRef.current = false;
        }
    }, [isVisible]);

    // Sync state when project changes (for background playback navigation)
    useEffect(() => {
        if (initialProject) {
            console.log("Project changed, updating Player state...");
            setTitle(initialProject.title || "New Project");
            setLyrics(initialProject.lyrics || []);
            setPlaybackRate(initialProject.audioSettings?.speed || 1.0);
            setPitchShift(initialProject.audioSettings?.pitch || 0);
            setIsSynced(!!initialProject.lyrics?.some(l => l.time !== undefined && l.time !== null));
            setSaveTargetFolderId(initialProject.parentId || initialFolderId || null);
            setAudioBlob(initialProject.audioBlob || initialProject.audioBlobRef || null);
            setPdfBlob(initialProject.pdfBlob || null);
            setPdfPageTimestamps(initialProject.pdfPageTimestamps || {});
            setPdfCurrentPage(1);
            setCurrentProjectId(initialProject.id || null);
            setIsPlaying(false);
            if (initialProject.pdfBlob) setViewMode('pdf');
            else setViewMode('lyrics');

            // If audio engine is already initialized, load the new audio
            // Otherwise, let the mount effect handle the initial load
            const blob = initialProject.audioBlob || initialProject.audioBlobRef;
            if (blob && audioEngine.wavesurfer) {
                console.log("Loading new audio blob into existing engine...");
                const url = URL.createObjectURL(blob);
                audioEngine.load(url);
            }
        }
    }, [initialProject, initialFolderId]);

    // Save/Export Modal State
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [availableFolders, setAvailableFolders] = useState([]);
    const [saveTargetFolderId, setSaveTargetFolderId] = useState(initialProject?.parentId || initialFolderId || null);

    // Load available folders for the Save Modal
    useEffect(() => {
        if (showSaveModal) {
            const fetchFolders = async () => {
                try {
                    const items = await StorageService.getAllProjects();
                    setAvailableFolders(items.filter(i => i.type === 'folder'));
                } catch (e) {
                    console.error("Error loading folders into save modal:", e);
                }
            };
            fetchFolders();
        }
    }, [showSaveModal]);

    // Edit Mode State
    const [isEditing, setIsEditing] = useState(false);
    const [autoScroll, setAutoScroll] = useState(true);

    // --- Handlers (Stable) ---
    const togglePlay = useCallback(async () => {
        const newState = await audioEngine.playPause();
        setIsPlaying(newState);
    }, []);

    const handleFileUpload = useCallback(async (event) => {
        const file = event.target.files[0];
        if (file) {
            const url = URL.createObjectURL(file);
            setAudioBlob(file);
            audioEngine.load(url);
        }
    }, []);

    const adjustSpeed = useCallback((delta) => {
        setPlaybackRate(prev => {
            const newRate = Math.max(0.5, Math.min(1.5, prev + delta));
            audioEngine.setSpeed(newRate);
            return newRate;
        });
    }, []);

    const adjustPitch = useCallback((delta) => {
        setPitchShift(prev => {
            const newPitch = Math.max(-12, Math.min(12, prev + delta));
            audioEngine.setPitch(newPitch);
            return newPitch;
        });
    }, []);

    const handleInsertLine = useCallback((index) => {
        const text = prompt("Enter new lyric line:");
        if (text === null) return;
        setLyrics(prev => {
            const newLyrics = [...prev];
            newLyrics.splice(index + 1, 0, { text, time: null });
            return newLyrics;
        });
    }, []);

    const handleTextChange = useCallback((index, newText) => {
        setLyrics(prev => {
            const newLyrics = [...prev];
            if (typeof newLyrics[index] === 'string') {
                newLyrics[index] = { text: newText, time: null };
            } else {
                newLyrics[index] = { ...newLyrics[index], text: newText };
            }
            return newLyrics;
        });
    }, []);

    const handleLineClick = useCallback((index) => {
        if (!isEditing) return;
        setLyrics(prev => {
            const newLyrics = [...prev];
            const time = audioEngine.getCurrentTime();
            if (typeof newLyrics[index] === 'string') {
                newLyrics[index] = { text: newLyrics[index], time };
            } else {
                newLyrics[index] = { ...newLyrics[index], time };
            }

            // Sort by time, keeping unsynced items (null/undefined) at the end
            newLyrics.sort((a, b) => {
                const tA = (a.time !== null && a.time !== undefined) ? a.time : Infinity;
                const tB = (b.time !== null && b.time !== undefined) ? b.time : Infinity;
                return tA - tB;
            });

            return newLyrics;
        });
        setIsSynced(true);
    }, [isEditing]);

    const handleSyncPage = useCallback(() => {
        if (!isEditing || viewMode !== 'pdf') return;
        setPdfPageTimestamps(prev => ({
            ...prev,
            [pdfCurrentPage]: audioEngine.getCurrentTime()
        }));
    }, [isEditing, viewMode, pdfCurrentPage]);

    const handleDeleteLine = useCallback((index) => {
        if (!window.confirm("Are you sure you want to delete this line?")) return;
        setLyrics(prev => prev.filter((_, i) => i !== index));
    }, []);

    const handleImportPackage = useCallback(async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        try {
            if (file.name.endsWith('.karaoke') || file.name.endsWith('.zip')) {
                const { metadata, audioBlob: importedAudio } = await ProjectService.unpackProject(file);
                setLyrics(metadata.lyrics || []);
                setTitle(metadata.title || "Imported Project");
                setIsSynced(!!metadata.lyrics?.length && metadata.lyrics[0].hasOwnProperty('time'));
                setPlaybackRate(metadata.audioSettings?.speed || 1.0);
                audioEngine.setSpeed(metadata.audioSettings?.speed || 1.0);
                setAudioBlob(importedAudio);
                setPdfBlob(metadata.pdfBlob || null); // Load PDF from metadata if exists (though usually it's a separate file in zip, but metadata might have it)
                setPdfPageTimestamps(metadata.pdfPageTimestamps || {});
                audioEngine.load(URL.createObjectURL(importedAudio));
                setIsPlaying(false);
            } else if (file.name.endsWith('.pdf')) {
                const arrayBuffer = await file.arrayBuffer();
                const pdfLyrics = await LyricsParser.parsePDF(arrayBuffer);
                setLyrics(pdfLyrics);
                setPdfBlob(file); // Save the original file as blob
                setViewMode('pdf');
                setIsSynced(false);
            } else {
                const text = await file.text();
                if (file.name.endsWith('.json')) {
                    const project = JSON.parse(text);
                    if (project.lyrics) { setLyrics(project.lyrics); setIsSynced(true); }
                } else if (file.name.endsWith('.lrc')) {
                    setLyrics(LyricsParser.parseLRC(text)); setIsSynced(true);
                } else {
                    setLyrics(LyricsParser.parseTXT(text)); setIsSynced(false);
                }
            }
        } catch (e) {
            alert("Error importing: " + e.message);
        }
    }, []);

    const handleSeek = useCallback((e) => {
        const time = parseFloat(e.target.value);
        audioEngine.seekTo(time / duration);
        setCurrentTime(time);
    }, [duration]);

    const formatTime = useCallback((seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }, []);

    // --- Memoized Components ---
    const Header = (
        <div
            className="portrait:pt-safe landscape:pt-[20px] flex justify-between items-center bg-slate-900/50 backdrop-blur-md border-b border-white/5 z-10 transition-all portrait:scale-y-70 portrait:origin-top"
        >
            <div className={`flex items-center gap-4 landscape:gap-2 px-1.5 pt-0 pb-0.5 landscape:px-1 landscape:py-0 ${isEditing ? 'landscape:py-0' : ''}`}>
                <button onClick={onBack} className="p-2 landscape:p-1 hover:bg-slate-800 rounded-full transition text-slate-400 hover:text-white">
                    <ArrowLeft size={20} className="landscape:w-4 landscape:h-4" />
                </button>
                <h1 className="text-base landscape:text-sm font-bold tracking-tight bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent truncate max-w-[140px] landscape:max-w-[150px]">
                    {title}
                </h1>
            </div>
            <div
                className={`flex gap-3 sm:gap-4 items-center px-1.5 pt-0 pb-0.5 pr-2 landscape:px-1 landscape:py-0 landscape:pr-20 ${isEditing ? 'landscape:py-0' : ''}`}
                style={{ marginRight: isEditing ? '40px' : '20px' }}
            >
                {isEditing && (
                    <>
                        <label className="cursor-pointer p-1.5 landscape:p-1.5 hover:bg-slate-800 rounded-full transition icon-btn" title="Load Audio">
                            <Music size={18} className="landscape:w-4 landscape:h-4" />
                            <input type="file" accept="audio/*" onChange={handleFileUpload} className="hidden" />
                        </label>
                        <label className="cursor-pointer p-1.5 landscape:p-1.5 hover:bg-slate-800 rounded-full transition icon-btn" title="Import Package or Lyrics">
                            <FileText size={18} className="landscape:w-4 landscape:h-4" />
                            <input type="file" accept=".json,.lrc,.txt,.pdf,.karaoke,.zip" onChange={handleImportPackage} className="hidden" />
                        </label>
                    </>
                )}
                <button
                    onClick={() => {
                        const nextEdit = !isEditing;
                        setIsEditing(nextEdit);
                        if (nextEdit && viewMode === 'pdf') {
                            setViewMode('lyrics');
                        }
                    }}
                    className={`p-1.5 landscape:p-1.5 rounded-full transition icon-btn ${isEditing ? 'bg-amber-500/20 text-amber-400' : 'hover:bg-slate-800 text-slate-400 hover:text-white'}`}
                >
                    {isEditing ? <Check size={18} className="landscape:w-4 landscape:h-4" /> : <Edit3 size={18} className="landscape:w-4 landscape:h-4" />}
                </button>
                {isEditing && (
                    <>
                        <button onClick={() => setAutoScroll(!autoScroll)} className={`p-1.5 landscape:p-1.5 rounded-full transition icon-btn ${autoScroll ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-500'}`} title="Auto-scroll">
                            {autoScroll ? <MousePointer2 size={18} className="landscape:w-4 landscape:h-4" /> : <Lock size={18} className="landscape:w-4 landscape:h-4" />}
                        </button>
                        <button onClick={() => setShowSaveModal(true)} className="p-1.5 landscape:p-1.5 hover:bg-slate-800 rounded-full transition icon-btn" title="Save to Library">
                            <Save size={18} className="landscape:w-4 landscape:h-4" />
                        </button>
                        <button
                            onClick={() => setShowExportModal(true)}
                            className="p-1.5 landscape:p-1.5 hover:bg-slate-800 rounded-full transition icon-btn"
                            title="Export"
                        >
                            <Upload size={18} className="landscape:w-4 landscape:h-4" />
                        </button>
                    </>
                )}
            </div>
        </div>
    );

    console.log("Player Rendering. InitialProject:", initialProject);

    const Footer = useMemo(() => (
        <div className="bg-slate-900/80 backdrop-blur-lg border-t border-white/10 p-2 pb-10 landscape:p-1 landscape:pb-2 rounded-t-3xl landscape:rounded-t-xl shadow-2xl relative z-20">
            {/* Stable Timeline (Progress Bar) */}
            <div className="mb-2 px-2">
                <input
                    type="range"
                    min="0"
                    max={duration || 100}
                    step="0.1"
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-500 hover:accent-violet-400 transition-all"
                    style={{
                        background: `linear-gradient(to right, #8b5cf6 ${(currentTime / (duration || 1)) * 100}%, #1e293b 0)`
                    }}
                />
            </div>

            <div className="flex flex-col gap-0 max-w-2xl mx-auto">
                {/* Timeline info */}
                <div className="flex justify-between text-[10px] landscape:text-[8px] font-mono text-slate-400 px-1">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                </div>

                {pdfBlob && (
                    <div className="flex justify-center landscape:hidden mt-[-6px] mb-4">
                        <button
                            onClick={() => setViewMode(viewMode === 'lyrics' ? 'pdf' : 'lyrics')}
                            className={`group flex items-center gap-2 px-5 py-1.5 rounded-full transition-all duration-300 text-[9px] font-black uppercase tracking-[0.2em] border hover:scale-105 active:scale-95
                                ${viewMode === 'pdf'
                                    ? 'bg-fuchsia-800/80 text-fuchsia-100 border-fuchsia-700/50'
                                    : 'bg-slate-800/90 backdrop-blur-md text-slate-200 border-slate-600 hover:border-slate-500 shadow-black/60'}
                            `}
                        >
                            {viewMode === 'pdf' ? <FileText size={14} className="animate-bounce" /> : <FileText size={14} className="opacity-50 group-hover:opacity-100 transition-opacity" />}
                            {viewMode === 'pdf' ? 'VER LETRA' : 'VER PDF ORIGINAL'}
                        </button>
                    </div>
                )}

                {/* Playback Controls & Settings combined in Landscape */}
                <div className="flex landscape:flex-row flex-col gap-4 landscape:gap-0 items-center w-full px-4 landscape:px-0 landscape:justify-between">
                    <div className="grid grid-cols-3 items-center w-full landscape:w-auto landscape:flex landscape:gap-14">
                        <div className="flex justify-start">
                            <button
                                onClick={() => {
                                    audioEngine.seekTo(0);
                                    setCurrentTime(0);
                                }}
                                className="p-2 text-slate-400 hover:text-white transition transform hover:scale-110 active:scale-90"
                                title="Reiniciar canción"
                            >
                                <SkipBack size={24} className="landscape:w-5 landscape:h-5" />
                            </button>
                        </div>
                        <div className="flex justify-center">
                            <button
                                onClick={togglePlay}
                                className="p-3 landscape:p-2 bg-violet-600 hover:bg-violet-500 rounded-full text-white transition-all hover:scale-110 active:scale-95 border-b-2 border-violet-800 active:border-b-0"
                            >
                                {isPlaying ? <Pause size={28} className="landscape:w-5 landscape:h-5" fill="currentColor" /> : <Play size={28} className="landscape:w-5 landscape:h-5 ml-0.5" fill="currentColor" />}
                            </button>
                        </div>
                        <div className="flex justify-end landscape:hidden">
                            <div className="w-10 h-10"></div>
                        </div>
                    </div>

                    <div className="flex justify-center gap-8 landscape:gap-6">
                        {pdfBlob && (
                            <button
                                onClick={() => setViewMode(viewMode === 'lyrics' ? 'pdf' : 'lyrics')}
                                className={`landscape:flex hidden group items-center gap-2 px-3 py-1 rounded-full transition-all duration-300 text-[8px] font-black uppercase tracking-[0.15em] border hover:scale-105 active:scale-95
                                    ${viewMode === 'pdf'
                                        ? 'bg-fuchsia-800/80 text-fuchsia-100 border-fuchsia-700/50'
                                        : 'bg-slate-800/90 backdrop-blur-md text-slate-200 border-slate-600 hover:border-slate-500'}
                                `}
                            >
                                <FileText size={12} className={viewMode === 'pdf' ? 'animate-bounce' : 'opacity-50 group-hover:opacity-100 transition-opacity'} />
                                {viewMode === 'pdf' ? 'LETRA' : 'PDF'}
                            </button>
                        )}
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] landscape:hidden uppercase tracking-widest text-slate-500 font-bold">Spd</span>
                            <div className="flex items-center gap-2 bg-slate-800/80 backdrop-blur-sm rounded-full p-0.5 border border-slate-700/50">
                                <button onClick={() => adjustSpeed(-0.05)} className="p-1 hover:bg-slate-700 rounded-full text-slate-400 transition">
                                    <ChevronLeft size={16} className="landscape:w-3 landscape:h-3" />
                                </button>
                                <span className="text-xs landscape:text-[10px] font-mono w-12 landscape:w-10 text-center text-violet-400 font-black">{playbackRate.toFixed(2)}x</span>
                                <button onClick={() => adjustSpeed(0.05)} className="p-1 hover:bg-slate-700 rounded-full text-slate-400 transition">
                                    <ChevronRight size={16} className="landscape:w-3 landscape:h-3" />
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-[10px] landscape:hidden uppercase tracking-widest text-slate-500 font-bold">Pit</span>
                            <div className="flex items-center gap-2 bg-slate-800/80 backdrop-blur-sm rounded-full p-0.5 border border-slate-700/50">
                                <button onClick={() => adjustPitch(-1)} className="p-1 hover:bg-slate-700 rounded-full text-slate-400 transition">
                                    <ChevronLeft size={16} className="landscape:w-3 landscape:h-3" />
                                </button>
                                <span className="text-xs landscape:text-[10px] font-mono w-8 landscape:w-6 text-center text-fuchsia-400 font-black">{pitchShift > 0 ? '+' : ''}{pitchShift}</span>
                                <button onClick={() => adjustPitch(1)} className="p-1 hover:bg-slate-700 rounded-full text-slate-400 transition">
                                    <ChevronRight size={16} className="landscape:w-3 landscape:h-3" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    ), [isVisible, currentTime, duration, isPlaying, playbackRate, pitchShift, togglePlay, adjustSpeed, adjustPitch, formatTime, handleSeek, viewMode, pdfBlob]);

    useEffect(() => {
        console.log("Player Mounted. Initializing Headless Audio Engine...");
        try {
            // Initialize Audio Engine without a container (headless)
            audioEngine.init(null);

            audioEngine.onTimeUpdate = (time) => {
                if (shouldUpdateVisualsRef.current) {
                    setCurrentTime(time);
                }
            };
            audioEngine.onReady = (dur) => {
                setDuration(dur);
            };
            audioEngine.onFinish = () => setIsPlaying(false);

            if (initialProject) {
                const blob = initialProject.audioBlob || initialProject.audioBlobRef;
                if (blob) {
                    const url = URL.createObjectURL(blob);
                    audioEngine.load(url);
                }
            }
        } catch (error) {
            console.error("Error initializing player:", error);
        }

        return () => {
            console.log("Player Unmounting. Destroying Audio Engine");
            audioEngine.destroy();
        };
    }, []);





    return (
        <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden will-change-transform transform-gpu">
            {Header}

            {/* Save Modal */}
            {showSaveModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
                        <h3 className="text-xl font-bold mb-4">Save Project</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Project Title</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:border-violet-500 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Save Location</label>
                                <div className="max-h-[150px] overflow-y-auto bg-slate-800 rounded-lg border border-slate-700">
                                    <button
                                        onClick={() => setSaveTargetFolderId(null)}
                                        className={`w-full text-left p-2 px-3 hover:bg-slate-700 flex items-center gap-2 ${saveTargetFolderId === null ? 'text-violet-400 bg-slate-700/50' : 'text-slate-300'}`}
                                    >
                                        <Folder size={16} />
                                        <span>Library (Root)</span>
                                    </button>
                                    {availableFolders.map(f => (
                                        <button
                                            key={f.id}
                                            onClick={() => setSaveTargetFolderId(f.id)}
                                            className={`w-full text-left p-2 px-3 hover:bg-slate-700 flex items-center gap-2 ${saveTargetFolderId === f.id ? 'text-violet-400 bg-slate-700/50' : 'text-slate-300'}`}
                                        >
                                            <Folder size={16} />
                                            <span>{f.title}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowSaveModal(false)}
                                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded-full transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    try {
                                        const projectId = currentProjectId || crypto.randomUUID();
                                        const project = {
                                            id: projectId,
                                            title: title,
                                            artist: "Unknown",
                                            lyrics,
                                            audioSettings: { speed: playbackRate, pitch: pitchShift },
                                            audioBlob: audioBlob,
                                            pdfBlob: pdfBlob,
                                            pdfPageTimestamps: pdfPageTimestamps,
                                            timestamp: new Date().toISOString(),
                                            parentId: saveTargetFolderId // Use selected folder
                                        };

                                        await StorageService.saveProject(project);
                                        setCurrentProjectId(projectId);
                                        setShowSaveModal(false);
                                        alert("Project Saved!");
                                    } catch (e) {
                                        console.error(e);
                                        alert("Failed to save: " + e.message);
                                    }
                                }}
                                className="flex-1 py-2 bg-violet-600 hover:bg-violet-500 rounded-full transition font-bold shadow-lg shadow-violet-600/20"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Export Modal */}
            {showExportModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-fade-in relative">
                        <button
                            onClick={() => setShowExportModal(false)}
                            className="absolute top-4 right-4 text-slate-500 hover:text-white"
                        >
                            x
                        </button>
                        <h3 className="text-xl font-bold mb-6 text-center">Export Options</h3>



                        <div className="space-y-4">
                            <button
                                onClick={async () => {
                                    if (!lyrics.length) return alert("No lyrics to export");
                                    if (!audioBlob) return alert("No audio loaded to export");
                                    if (!lyrics.length) {
                                        // alert("No lyrics to export"); // Removed debug alert
                                        return;
                                    }
                                    if (!audioBlob) {
                                        // alert("No audio loaded to export"); // Removed debug alert
                                        return;
                                    }

                                    const metadata = {
                                        title,
                                        lyrics,
                                        audioSettings: { speed: playbackRate, pitch: pitchShift },
                                    };

                                    try {
                                        setIsExporting(true);
                                        const blob = await ProjectService.packProject(metadata, audioBlob, pdfBlob);
                                        // setIsExporting(false); // MOVED TO FINALLY to keep overlay during save

                                        const filename = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.karaoke`;

                                        if (Capacitor.isNativePlatform()) {
                                            try {
                                                const base64 = await blobToBase64(blob);

                                                // Save directly to Downloads folder
                                                const saveResult = await Filesystem.writeFile({
                                                    path: `Download/${filename}`,
                                                    data: base64,
                                                    directory: Directory.ExternalStorage,
                                                    encoding: 'base64'
                                                });

                                                alert(`¡Proyecto exportado exitosamente!\\n\\nArchivo: ${filename}\\nUbicación: Descargas`);
                                                setShowExportModal(false);
                                            } catch (err) {
                                                console.error("Native export failed", err);
                                                alert("Error al exportar: " + err.message);
                                            }
                                        } else if (window.showSaveFilePicker) {
                                            const handle = await window.showSaveFilePicker({
                                                suggestedName: filename,
                                                types: [{
                                                    description: 'KaraPlayback Package',
                                                    accept: { 'application/octet-stream': ['.karaoke'] },
                                                }],
                                            });
                                            const writable = await handle.createWritable();
                                            await writable.write(blob);
                                            await writable.close();
                                        } else {
                                            const url = URL.createObjectURL(blob);
                                            const a = document.createElement('a');
                                            a.href = url;
                                            a.download = filename;
                                            a.click();
                                            URL.revokeObjectURL(url);
                                            alert("Tu navegador no soporta elegir la carpeta de destino. El archivo se ha guardado en tu carpeta de Descargas.");
                                        }
                                        setShowExportModal(false);
                                    } catch (e) {
                                        if (e.name !== 'AbortError') {
                                            console.error(e);
                                            alert("Export failed: " + e.message);
                                        }
                                    } finally {
                                        setIsExporting(false);
                                    }
                                }}
                                className="w-full p-4 bg-slate-800 hover:bg-slate-700 rounded-xl flex items-center gap-4 transition group border border-slate-700 hover:border-violet-500/50"
                            >
                                <div className="p-3 bg-violet-500/20 rounded-full text-violet-400 group-hover:scale-110 transition">
                                    <Upload size={24} />
                                </div>
                                <div className="text-left">
                                    <div className="font-bold text-white">KaraPlayback Package</div>
                                    <div className="text-xs text-slate-400">Audio + Sync Data (.karaoke)</div>
                                </div>
                            </button>

                            <button
                                onClick={async () => {
                                    if (!lyrics.length) return alert("No lyrics to export");

                                    const lrcContent = ProjectService.generateLRC(lyrics);
                                    const blob = new Blob([lrcContent], { type: 'text/plain;charset=utf-8' });
                                    const filename = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.lrc`;

                                    try {
                                        if (Capacitor.isNativePlatform()) {
                                            try {
                                                const base64 = await blobToBase64(blob);

                                                // 1. Save to permanent location
                                                let savePath = filename;
                                                try {
                                                    await Filesystem.mkdir({
                                                        path: 'KaraPlayback',
                                                        directory: Directory.Documents,
                                                        recursive: true
                                                    });
                                                    savePath = `KaraPlayback/${filename}`;
                                                } catch (e) { }

                                                await Filesystem.writeFile({
                                                    path: savePath,
                                                    data: base64,
                                                    directory: Directory.Documents,
                                                    encoding: 'base64'
                                                });

                                                alert(`¡Letra guardada!\nUbicación: Documentos/${savePath}`);

                                                const cacheResult = await Filesystem.writeFile({
                                                    path: filename,
                                                    data: base64,
                                                    directory: Directory.Cache,
                                                    encoding: 'base64'
                                                });

                                                await Share.share({
                                                    title: 'Save Lyrics',
                                                    url: cacheResult.uri,
                                                    dialogTitle: 'Save Lyrics File'
                                                });
                                            } catch (err) {
                                                console.error("Native export failed", err);
                                                alert("Lyrics export error: " + err.message);
                                            }
                                        } else if (window.showSaveFilePicker) {
                                            const handle = await window.showSaveFilePicker({
                                                suggestedName: filename,
                                                types: [{
                                                    description: 'Cifra Club / LRC Lyrics',
                                                    accept: { 'text/plain': ['.lrc'] },
                                                }],
                                            });
                                            const writable = await handle.createWritable();
                                            await writable.write(blob);
                                            await writable.close();
                                        } else {
                                            const url = URL.createObjectURL(blob);
                                            const a = document.createElement('a');
                                            a.href = url;
                                            a.download = filename;
                                            a.click();
                                            URL.revokeObjectURL(url);
                                            alert("Tu navegador no soporta elegir la carpeta de destino. El archivo se ha guardado en tu carpeta de Descargas.");
                                        }
                                        setShowExportModal(false);
                                    } catch (e) {
                                        if (e.name !== 'AbortError') {
                                            console.error(e);
                                            alert("Export failed: " + e.message);
                                        }
                                    }
                                }}
                                className="w-full p-4 bg-slate-800 hover:bg-slate-700 rounded-xl flex items-center gap-4 transition group border border-slate-700 hover:border-fuchsia-500/50"
                            >
                                <div className="p-3 bg-fuchsia-500/20 rounded-full text-fuchsia-400 group-hover:scale-110 transition">
                                    <FileText size={24} />
                                </div>
                                <div className="text-left">
                                    <div className="font-bold text-white">Lyrics File</div>
                                    <div className="text-xs text-slate-400">Standard LRC Format (.lrc)</div>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            )}


            {/* Main Content Areas */}
            <div className="flex-1 overflow-hidden relative">
                {/* Lyrics Layer */}
                <div className={`absolute inset-0 transition-all duration-500 ${viewMode === 'lyrics' ? 'opacity-100 scale-100 z-10' : 'opacity-0 scale-95 z-0 pointer-events-none'}`}>
                    <LyricsDisplay
                        lyrics={lyrics}
                        currentTime={currentTime}
                        isSynced={isSynced}
                        isEditing={isEditing}
                        autoScroll={autoScroll}
                        onLineClick={handleLineClick}
                        onInsertLine={handleInsertLine}
                        onTextChange={handleTextChange}
                        onDeleteLine={handleDeleteLine}
                    />
                    {/* Gradient overlay for fading at top/bottom */}
                    <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-slate-950 to-transparent pointer-events-none"></div>
                    <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-slate-950 to-transparent pointer-events-none"></div>
                </div>

                {/* PDF Layer */}
                {pdfBlob && (
                    <div className={`absolute inset-0 bg-slate-900 transition-all duration-500 overflow-hidden flex flex-col ${viewMode === 'pdf' ? 'opacity-100 scale-100 z-10' : 'opacity-0 scale-105 z-0 pointer-events-none'}`}>
                        <div className="flex-1 overflow-hidden">
                            <PDFViewer
                                file={pdfBlob}
                                currentPage={pdfCurrentPage}
                                onPageLoad={setPdfTotalPages}
                            />
                        </div>

                        {/* PDF Page Controls Overlay - Semi-transparent by default */}
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-slate-950/60 backdrop-blur-md px-6 py-2 rounded-full border border-white/10 shadow-2xl z-20 transition-all duration-300 opacity-50 hover:opacity-100 hover:scale-105 hover:bg-slate-950/80">
                            <button
                                onClick={() => setPdfCurrentPage(p => Math.max(1, p - 1))}
                                className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition"
                                title="Previous Page"
                            >
                                <ChevronLeft size={20} />
                            </button>
                            <div className="flex flex-col items-center min-w-[80px]">
                                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Página</span>
                                <span className="text-sm font-mono font-black text-fuchsia-400">{pdfCurrentPage} / {pdfTotalPages || '?'}</span>
                            </div>
                            <button
                                onClick={() => setPdfCurrentPage(p => Math.min(pdfTotalPages, p + 1))}
                                className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition"
                                title="Next Page"
                            >
                                <ChevronRight size={20} />
                            </button>

                            {isEditing && (
                                <>
                                    <div className="w-px h-8 bg-white/10 mx-2"></div>
                                    <button
                                        onClick={handleSyncPage}
                                        className="flex items-center gap-2 px-4 py-1.5 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest transition shadow-lg shadow-fuchsia-600/20 active:scale-95"
                                    >
                                        <Clock size={14} />
                                        <span>Sincronizar</span>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Controls & Waveform */}
            {Footer}
            {/* Loading Overlay for Export */}
            {isExporting && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]">
                    <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl flex flex-col items-center shadow-2xl animate-fade-in">
                        <div className="animate-spin w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full mb-4"></div>
                        <p className="text-white font-medium text-lg">Exportando proyecto...</p>
                        <p className="text-slate-400 text-sm mt-1">Generando paquete .karaoke</p>
                    </div>
                </div>
            )}
        </div >
    );
};

export default Player;
