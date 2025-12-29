import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Music, FileText, Settings, Upload, ArrowLeft, Save, Folder } from 'lucide-react';
import { audioEngine } from '../services/AudioEngine';
import LyricsDisplay from './LyricsDisplay';
import { LyricsParser } from '../services/LyricsParser';
import { ProjectService } from '../services/ProjectService';
import { StorageService } from '../services/StorageService';

const Player = ({ initialProject, initialFolderId, onBack }) => {


    const waveformRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [lyrics, setLyrics] = useState(initialProject?.lyrics || []);
    const [playbackRate, setPlaybackRate] = useState(initialProject?.audioSettings?.speed || 1.0);
    const [isSynced, setIsSynced] = useState(!!initialProject?.lyrics);

    // Title loading
    const [title, setTitle] = useState(initialProject?.title || "New Project");

    // State for Audio Blob
    const [audioBlob, setAudioBlob] = useState(initialProject?.audioBlobRef || null);

    // Save Modal State
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [availableFolders, setAvailableFolders] = useState([]);
    const [saveTargetFolderId, setSaveTargetFolderId] = useState(initialProject?.parentId || initialFolderId || null);

    useEffect(() => {
        // Load folders for the saver
        StorageService.getAllProjects().then(items => {
            setAvailableFolders(items.filter(i => i.type === 'folder'));
        });
    }, []);

    console.log("Player Rendering. InitialProject:", initialProject);

    useEffect(() => {
        console.log("Player Mounted. Initializing Audio Engine...");
        try {
            // Initialize Audio Engine
            if (waveformRef.current) {
                audioEngine.init(waveformRef.current, {
                    height: 60,
                    waveColor: 'rgba(124, 58, 237, 0.4)',
                    progressColor: 'rgb(124, 58, 237)',
                });

                audioEngine.onTimeUpdate = (time) => setCurrentTime(time);
                audioEngine.onReady = (dur) => {
                    console.log("Audio Engine Ready. Duration:", dur);
                    setDuration(dur);
                };
                audioEngine.onFinish = () => setIsPlaying(false);

                audioEngine.wavesurfer.on('error', (e) => {
                    // Ignore AbortError (happens on fast reload/unmount)
                    if (e.name === 'AbortError' || (e.message && e.message.includes('aborted'))) {
                        console.warn("Audio loading aborted (harmless).");
                        return;
                    }
                    console.error("WaveSurfer Error:", e);
                    alert("Audio Error: " + e.toString());
                });

                if (initialProject) {
                    // Check for blob stored in DB (audioBlob) or runtime ref (audioBlobRef)
                    const blob = initialProject.audioBlob || initialProject.audioBlobRef;

                    if (blob) {
                        console.log("Loading initial audio blob...", blob);
                        const url = URL.createObjectURL(blob);
                        audioEngine.load(url);
                        setAudioBlob(blob);
                    } else {
                        console.log("No audio data found in project.");
                    }
                } else {
                    console.log("No initial project.");
                }
            } else {
                console.error("Waveform container ref is missing");
            }
        } catch (error) {
            console.error("Error initializing player:", error);
            alert("Player Init Error: " + error.message);
        }

        return () => {
            console.log("Player Unmounting. Destroying Audio Engine");
            audioEngine.destroy();
        };
    }, []); // Run once on mount

    const togglePlay = () => {
        audioEngine.playPause();
        setIsPlaying(!isPlaying);
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (file) {
            const url = URL.createObjectURL(file);
            setAudioBlob(file); // Store blob for export
            audioEngine.load(url);
        }
    };

    const handleImportPackage = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        try {
            if (file.name.endsWith('.karaoke') || file.name.endsWith('.zip')) {
                const { metadata, audioBlob: importedAudio } = await ProjectService.unpackProject(file);

                // Apply Data
                const importedLyrics = metadata.lyrics || [];
                setLyrics(importedLyrics);
                setTitle(metadata.title || "Imported Project");

                // Determine if synced
                const hasTime = importedLyrics.length > 0 && importedLyrics[0].hasOwnProperty('time');
                setIsSynced(hasTime);

                setPlaybackRate(metadata.audioSettings?.speed || 1.0);
                audioEngine.setSpeed(metadata.audioSettings?.speed || 1.0);

                // Apply Audio
                setAudioBlob(importedAudio);
                const url = URL.createObjectURL(importedAudio);

                // Force reload
                audioEngine.load(url);
                setIsPlaying(false);

            } else {
                // Fallback legacy JSON/LRC handling
                handleLyricsUpload(event);
            }
        } catch (e) {
            alert("Error importing package: " + e.message);
        }
    };

    const handleLyricsUpload = async (event) => {
        const file = event.target.files[0];
        if (file) {
            const text = await file.text();

            if (file.name.endsWith('.json')) {
                // ... Existing JSON logic ...
                try {
                    const project = JSON.parse(text);
                    if (project.lyrics) {
                        setLyrics(project.lyrics);
                        setIsSynced(true);
                    }
                    if (project.audioSettings) {
                        setPlaybackRate(project.audioSettings.speed || 1.0);
                        audioEngine.setSpeed(project.audioSettings.speed || 1.0);
                    }
                } catch (e) {
                    alert("Invalid JSON file");
                }
            } else if (file.name.endsWith('.lrc')) {
                const parsed = LyricsParser.parseLRC(text);
                setLyrics(parsed);
                setIsSynced(true);
            } else {
                const parsed = LyricsParser.parseTXT(text);
                setLyrics(parsed);
                setIsSynced(false);
            }
        }
    };

    // ...

    const handleSpeedChange = (e) => {
        const rate = parseFloat(e.target.value);
        setPlaybackRate(rate);
        audioEngine.setSpeed(rate);
    };

    // Helper to format time
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden">
            {/* Header / Top Bar */}
            <div className="p-4 flex justify-between items-center bg-slate-900/50 backdrop-blur-md border-b border-white/5 z-10 transition-all">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-full transition text-slate-400 hover:text-white">
                        <ArrowLeft size={20} />
                    </button>
                    <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent truncate max-w-[200px]">
                        {title}
                    </h1>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowSaveModal(true)}
                        className="p-2 hover:bg-slate-800 rounded-full transition icon-btn"
                        title="Save to Library"
                    >
                        <Save size={20} className="text-blue-400" />
                    </button>
                    <label className="cursor-pointer p-2 hover:bg-slate-800 rounded-full transition icon-btn" title="Load Audio">
                        <Music size={20} className="text-violet-400" />
                        <input type="file" accept="audio/*" onChange={handleFileUpload} className="hidden" />
                    </label>
                    <label className="cursor-pointer p-2 hover:bg-slate-800 rounded-full transition icon-btn" title="Import Package (.zip/.karaoke) or Lyrics">
                        <FileText size={20} className="text-fuchsia-400" />
                        <input type="file" accept=".json,.lrc,.txt,.karaoke,.zip" onChange={handleImportPackage} className="hidden" />
                    </label>
                    <button
                        onClick={async () => {
                            if (!lyrics.length) return alert("No lyrics to export");
                            if (!audioBlob) return alert("No audio loaded to export");

                            const metadata = {
                                title,
                                lyrics,
                                audioSettings: { speed: playbackRate },
                            };

                            try {
                                const blob = await ProjectService.packProject(metadata, audioBlob);
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.karaoke`;
                                a.click();
                                URL.revokeObjectURL(url);
                            } catch (e) {
                                console.error(e);
                                alert("Export failed: " + e.message);
                            }
                        }}
                        className="p-2 hover:bg-slate-800 rounded-full transition icon-btn"
                        title="Export Package (.karaoke)"
                    >
                        <Upload size={20} className="text-green-400" />
                    </button>
                </div>
            </div>

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
                                        const project = {
                                            id: initialProject?.id || crypto.randomUUID(),
                                            title: title,
                                            artist: "Unknown",
                                            lyrics,
                                            audioSettings: { speed: playbackRate },
                                            audioBlob: audioBlob,
                                            timestamp: new Date().toISOString(),
                                            parentId: saveTargetFolderId // Use selected folder
                                        };

                                        await StorageService.saveProject(project);
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


            {/* Lyrics Area (Dominant) */}
            < div className="flex-1 relative overflow-hidden" >
                <LyricsDisplay lyrics={lyrics} currentTime={currentTime} isSynced={isSynced} />

                {/* Gradient overlay for fading at top/bottom */}
                <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-slate-950 to-transparent pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-slate-950 to-transparent pointer-events-none"></div>
            </div >

            {/* Controls & Waveform */}
            < div className="bg-slate-900/80 backdrop-blur-lg border-t border-white/10 p-4 pb-8 rounded-t-3xl shadow-2xl" >
                {/* Waveform Container */}
                < div ref={waveformRef} className="mb-4 w-full h-16 opacity-80" />

                <div className="flex flex-col gap-4 max-w-2xl mx-auto">
                    {/* Time & Slider */}
                    <div className="flex justify-between text-xs font-mono text-slate-400 px-1">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(duration)}</span>
                    </div>

                    {/* Main Controls */}
                    <div className="flex justify-center items-center gap-6">
                        <button className="p-2 text-slate-400 hover:text-white transition">
                            <SkipBack size={24} />
                        </button>

                        <button
                            onClick={togglePlay}
                            className="p-4 bg-violet-600 hover:bg-violet-500 rounded-full text-white shadow-lg shadow-violet-600/30 transition-all hover:scale-105 active:scale-95"
                        >
                            {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
                        </button>

                        <button className="p-2 text-slate-400 hover:text-white transition">
                            <SkipForward size={24} />
                        </button>
                    </div>

                    {/* Speed/Pitch Settings (Simplified) */}
                    <div className="flex justify-center gap-6 mt-2">
                        <div className="flex flex-col items-center gap-1">
                            <span className="text-[10px] uppercase tracking-wider text-slate-500">Speed</span>
                            <input
                                type="range"
                                min="0.5"
                                max="1.5"
                                step="0.05"
                                value={playbackRate}
                                onChange={handleSpeedChange}
                                className="w-24 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-violet-500"
                            />
                            <span className="text-xs text-slate-400">{playbackRate.toFixed(2)}x</span>
                        </div>
                        {/* Pitch Placeholder - requires DSP */}
                        <div className="flex flex-col items-center gap-1 opacity-50 cursor-not-allowed">
                            <span className="text-[10px] uppercase tracking-wider text-slate-500">Pitch</span>
                            <div className="text-xs text-slate-600">Pro Only</div>
                        </div>
                    </div>
                </div>
            </div >
        </div >
    );
};

export default Player;
