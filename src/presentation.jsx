import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import PDFViewer from './components/PDFViewer';
import ImageViewer from './components/ImageViewer';
import LyricsDisplay from './components/LyricsDisplay';
import { blobToBase64 } from './utils/base64';
import { CapacitorPresentation } from 'presentation-capacitor';

// Helper to convert Base64 back to Blob
const base64ToBlob = async (base64, type) => {
    const response = await fetch(`data:${type};base64,${base64}`);
    return response.blob();
};

const PresentationApp = () => {
    const [data, setData] = useState(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [pdfBlob, setPdfBlob] = useState(null);
    const pdfViewerRef = useRef(null);

    useEffect(() => {
        const handleMessage = async (type, payload) => {
            if (type === 'INIT_DATA') {
                if (payload && payload.pdfBase64) {
                    const blob = await base64ToBlob(payload.pdfBase64, payload.pdfType);
                    setPdfBlob(blob);
                } else {
                    setPdfBlob(null);
                }
                setData(payload);
            }
            else if (type === 'UPDATE_TIME') {
                setCurrentTime(payload.time);
            }
            else if (type === 'SCROLL_TO') {
                if (pdfViewerRef.current) {
                    pdfViewerRef.current.scrollTo(payload);
                }
            }
            else if (type === 'RESET') {
                setData(null);
                setPdfBlob(null);
            }
        };

        // 1. Native Plugin Listener
        const setupNative = async () => {
            try {
                await CapacitorPresentation.addListener('presentationMessage', (data) => {
                    let msg = data;
                    if (msg && msg.message) {
                        try { msg = JSON.parse(msg.message); } catch (e) { }
                    }
                    if (msg && msg.type) {
                        handleMessage(msg.type, msg.payload);
                    }
                });
            } catch (e) {
                console.error("Presentation Listener Error", e);
            }
        };
        setupNative();

        // 2. Window Message Fallback
        window.addEventListener('message', (event) => {
            const msg = event.data;
            if (msg && msg.type) {
                handleMessage(msg.type, msg.payload);
            }
        });


        // 3. LocalStorage Polling (Fallback for when Plugin/PostMessage fails)
        // This is critical since 'sendMessage' crashed the bridge.
        const checkLocalStorage = () => {
            try {
                const storedPayload = localStorage.getItem('kara_sync_payload');
                if (storedPayload) {
                    const parsed = JSON.parse(storedPayload);
                    // Only update if actually different (skipping deep compare for speed, relying on react)
                    handleMessage('INIT_DATA', parsed);
                }
                const storedTime = localStorage.getItem('kara_sync_time');
                if (storedTime) {
                    setCurrentTime(parseFloat(storedTime));
                }
                const scroll = localStorage.getItem('kara_sync_scroll');
                if (scroll) {
                    if (pdfViewerRef.current) pdfViewerRef.current.scrollTo(JSON.parse(scroll));
                }

            } catch (e) { }
        };

        const intervalId = setInterval(checkLocalStorage, 500); // Check every 500ms

        return () => clearInterval(intervalId);

    }, []);

    if (!data) {
        return (
            <div className="flex items-center justify-center h-screen bg-red-900 border-[20px] border-yellow-500 flex-col gap-4 z-[99999] relative">
                <div className="animate-pulse flex flex-col items-center">
                    <h1 className="text-white text-4xl font-bold mb-2">
                        TV CONNECTED
                    </h1>
                    <p className="text-yellow-300 text-xl font-mono">Waiting for Data...</p>
                    <p className="text-white text-sm mt-4">If you see this, React is Running!</p>
                </div>
            </div>
        );
    }

    const isVisual = data.viewMode === 'pdf';

    return (
        <div className="h-screen w-screen bg-black overflow-hidden relative">
            {/* Top Mask (Simulates Header) */}
            <div className="fixed top-0 left-0 w-full h-16 bg-black z-[9999] pointer-events-none"></div>

            {/* Content Container */}
            <div className="h-full w-full pt-16 pb-32 relative z-[1]">
                {isVisual && pdfBlob ? (
                    data.visualType === 'image' ? (
                        <ImageViewer
                            ref={pdfViewerRef}
                            file={pdfBlob}
                            className="!py-0 h-full"
                        />
                    ) : (
                        <PDFViewer
                            ref={pdfViewerRef}
                            file={pdfBlob}
                            className="!py-0 h-full"
                        />
                    )
                ) : (
                    <div className="px-12 py-8 h-full flex items-center justify-center">
                        <LyricsDisplay
                            lyrics={data.lyrics || []}
                            currentTime={currentTime}
                            playbackRate={1}
                            pitchShift={0}
                            isEditing={false}
                            onLineClick={() => { }}
                            viewMode="lyrics"
                            className="text-center"
                        />
                    </div>
                )}
            </div>

            {/* Bottom Mask (Simulates Footer Controls) */}
            <div className="fixed bottom-0 left-0 w-full h-32 bg-black z-[9999] pointer-events-none border-t border-white/5"></div>
        </div>
    );
};

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <PresentationApp />
    </React.StrictMode>,
);
