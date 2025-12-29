import React, { useEffect, useRef, useState } from 'react';

const LyricsDisplay = ({ lyrics, currentTime, isSynced, isEditing, result, autoScroll, onLineClick, onInsertLine, onTextChange }) => {
    // ... (rest of code)


    const containerRef = useRef(null);
    const activeLineRef = useRef(null);
    const [activeIndex, setActiveIndex] = useState(-1);

    useEffect(() => {
        // If editing, we might not want to auto-scroll aggressively, or maybe we do?
        // Let's keep auto-scroll but maybe user needs manual control.
        if (!isSynced || !lyrics || lyrics.length === 0) return;

        // Find the active line based on current time
        // We look for the last line where lines[i].time <= currentTime
        const index = lyrics.findLastIndex(line => line.time <= currentTime);

        setActiveIndex(index);
    }, [currentTime, lyrics, isSynced]);

    useEffect(() => {
        if (activeLineRef.current && containerRef.current) {
            // If not editing, always scroll. 
            // If editing, only scroll if autoScroll is true.
            if (!isEditing || (isEditing && autoScroll)) {
                try {
                    activeLineRef.current.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center',
                    });
                } catch (e) {
                    // Ignore scroll errors (happens if element is detached/hidden)
                    console.warn("Scroll failed (harmless during background play)", e);
                }
            }
        }
    }, [activeIndex, isEditing, autoScroll]);

    if (!lyrics || lyrics.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-slate-500">
                <p>No lyrics available</p>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className="w-full h-full overflow-y-auto px-4 py-8 text-center scrollbar-hide"
            style={{ scrollBehavior: 'smooth' }}
        >
            {lyrics.map((line, idx) => {
                const isActive = idx === activeIndex;


                return (
                    <div
                        key={idx}
                        ref={isActive ? activeLineRef : null}
                        className={`transition-all duration-300 ease-in-out my-4 p-2 rounded-lg flex items-center justify-center gap-4 group
                            ${isActive
                                ? 'text-violet-400 text-2xl font-bold bg-slate-800/50 scale-105'
                                : 'text-slate-400 text-lg hover:text-slate-200'}
                        `}
                    >
                        {isEditing ? (
                            <input
                                type="text"
                                value={line.text}
                                onChange={(e) => onTextChange && onTextChange(idx, e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className="bg-transparent text-center border-b border-violet-500/50 focus:border-violet-500 focus:outline-none min-w-[200px] w-full max-w-xl"
                            />
                        ) : (
                            <span className="">
                                {line.text}
                            </span>
                        )}

                        {/* Edit Mode Controls */}
                        {isEditing && (
                            <div className="flex gap-2">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onLineClick && onLineClick(idx);
                                    }}
                                    className="p-2 bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white rounded-full transition opacity-50 group-hover:opacity-100"
                                    title="Set current time"
                                >
                                    <div className="text-[10px] font-mono font-bold">
                                        {line.time ? line.time.toFixed(1) + 's' : 'SYNC'}
                                    </div>
                                </button>

                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onInsertLine && onInsertLine(idx);
                                    }}
                                    className="p-2 bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white rounded-full transition opacity-50 group-hover:opacity-100"
                                    title="Insert line below"
                                >
                                    <div className="text-[10px] font-bold h-4 w-4 flex items-center justify-center">
                                        +
                                    </div>
                                </button>
                            </div>
                        )}
                    </div>
                );
            })}
            {/* Spacer for bottom scrolling */}
            <div className="h-[50vh]"></div>
        </div>
    );
};

export default React.memo(LyricsDisplay);
