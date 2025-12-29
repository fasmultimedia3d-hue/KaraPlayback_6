import { useState } from 'react';
import Player from './components/Player';
import Library from './components/Library';

function App() {
  const [view, setView] = useState('library'); // 'library' | 'player'
  const [currentProject, setCurrentProject] = useState(null);
  const [targetFolderId, setTargetFolderId] = useState(null); // Which folder to save new project in

  const handleSelectProject = (project, folderId = null) => {
    setCurrentProject(project);
    setTargetFolderId(folderId);
    setView('player');
  };

  const handleBackToLibrary = () => {
    setView('library');
    setCurrentProject(null);
    setTargetFolderId(null);
  };

  return (
    <div className="app-container h-screen w-screen bg-slate-950 overflow-hidden">
      {view === 'library' ? (
        <Library onSelectProject={handleSelectProject} />
      ) : (
        <Player
          initialProject={currentProject}
          initialFolderId={targetFolderId}
          onBack={handleBackToLibrary}
        />
      )}
    </div>
  );
}

export default App;