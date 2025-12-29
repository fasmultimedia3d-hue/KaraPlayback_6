import React, { useEffect, useRef, useState } from 'react';

const LyricsDisplay = ({ lyrics, currentTime, isSynced }) => {
    const containerRef = useRef(null);
    const activeLineRef = useRef(null);
    const [activeIndex, setActiveIndex] = useState(-1);

    useEffect(() => {
        if (!isSynced || !lyrics || lyrics.length === 0) return;

        // Find the active line based on current time
        // We look for the last line where lines[i].time <= currentTime
        const index = lyrics.findLastIndex(line => line.time <= currentTime);

        setActiveIndex(index);
    }, [currentTime, lyrics, isSynced]);

    useEffect(() => {
        if (activeLineRef.current && containerRef.current) {
            activeLineRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
            });
        }
    }, [activeIndex]);

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
                        className={`transition-all duration-300 ease-in-out my-4 p-2 rounded-lg 
                            ${isActive
                                ? 'text-violet-400 text-2xl font-bold bg-slate-800/50 scale-105'
                                : 'text-slate-400 text-lg hover:text-slate-200'}`}
                    >
                        {line.text}
                    </div>
                );
            })}
            {/* Spacer for bottom scrolling */}
            <div className="h-[50vh]"></div>
        </div>
    );
};

export default LyricsDisplay;
