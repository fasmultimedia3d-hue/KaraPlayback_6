import { useState, useEffect } from 'react';
import Player from './components/Player';
import Library from './components/Library';
import Settings from './components/Settings';
import ErrorBoundary from './components/ErrorBoundary';
import { StorageService } from './services/StorageService';


function App() {
  // SPA Routing REMOVED - Reverting to Mirroring

  const [view, setView] = useState('library'); // 'library' | 'player' | 'settings'
  const [currentProject, setCurrentProject] = useState(null);
  const [targetFolderId, setTargetFolderId] = useState(null); // Which folder to save new project in
  const [libraryRefreshKey, setLibraryRefreshKey] = useState(0);
  const [navigationFolderId, setNavigationFolderId] = useState(null); // Current folder in Library view

  /* 
     Update: Library now returns 'lite' projects (no audioBlob).
     We must fetch the full project before playing.
  */
  const handleSelectProject = async (p, folderId = null) => {
    try {
      // 1. If it's a "New Project" (p is null), use a template and open player
      if (!p) {
        setCurrentProject({
          id: null, // Will be generated on save
          title: "New Project",
          lyrics: [],
          audioSettings: { speed: 1.0, pitch: 0 },
          audioBlob: null
        });
        setTargetFolderId(folderId);
        setView('player');
        return;
      }

      // 2. Optimization: If same project already active, just switch view
      if (currentProject && currentProject.id === p.id) {
        setView('player');
        return;
      }

      // 3. Load full project if needed
      let fullProject = p;
      if (p.type !== 'folder' && !p.audioBlob) {
        fullProject = await StorageService.getProject(p.id);
      }

      setCurrentProject(fullProject);
      setTargetFolderId(folderId);
      setView('player');
    } catch (e) {
      console.error("Failed to load project details", e);
      alert("Error: " + e.message);
    }
  };



  useEffect(() => {
    const handleError = (message, source, lineno, colno, error) => {
      // Ignore harmless AbortError (happens when audio loading is interrupted)
      if (message?.toLowerCase().includes('abort') || error?.name === 'AbortError') {
        console.warn("Harmless error suppressed:", message);
        return true; // suppresses the error
      }

      const msg = `Global Error: ${message} at ${source}:${lineno}:${colno}`;
      console.error(msg, error);
      alert(msg + "\n" + (error?.stack || ''));
      return false;
    };

    window.onerror = handleError;
    window.onunhandledrejection = (event) => {
      const reason = event.reason;
      if (reason?.name === 'AbortError' || reason?.message?.toLowerCase().includes('abort')) {
        console.warn("Harmless unhandled rejection suppressed:", reason);
        return;
      }
      alert("Unhandled Promise Rejection: " + reason);
    };

    return () => {
      window.onerror = null;
      window.onunhandledrejection = null;
    };
  }, []);

  const handleBackToLibrary = () => {
    setView('library');
    setLibraryRefreshKey(prev => prev + 1);
    setNavigationFolderId(null); // Force Library to Root
    // Do NOT clear currentProject, so Player stays mounted and playing
    // setCurrentProject(null);
    setTargetFolderId(null);
  };

  return (
    <ErrorBoundary>
      <div className="app-container h-screen w-full bg-slate-950 overflow-hidden relative">
        <div className={`absolute inset-0 overflow-hidden transition-opacity duration-300 ${view === 'library' ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'}`}>
          <Library
            onSelectProject={handleSelectProject}
            onOpenSettings={() => setView('settings')}
            refreshKey={libraryRefreshKey}
            folderId={navigationFolderId}
            onFolderChange={setNavigationFolderId}
            hasActiveProject={!!currentProject}
            onReturnToPlayer={() => setView('player')}
          />
        </div>

        <div className={`absolute inset-0 transition-transform duration-300 ${view === 'player' ? 'translate-y-0 opacity-100 z-20 pointer-events-auto' : 'translate-y-[100%] opacity-0 z-0 pointer-events-none'}`}>
          {/* Always render Player if we have a project, just hide it */}
          {currentProject && (
            <Player
              initialProject={currentProject}
              initialFolderId={targetFolderId}
              onBack={handleBackToLibrary}
              isVisible={view === 'player'}
            />
          )}
        </div>

        {view === 'settings' && (
          <div className="absolute inset-0 z-30">
            <Settings onBack={handleBackToLibrary} />
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}

export default App;