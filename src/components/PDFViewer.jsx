import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Configure worker
// pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const PDFViewer = ({ file, currentPage = 1, onPageLoad, className = "" }) => {
    const canvasRef = useRef(null);
    const [pdf, setPdf] = useState(null);
    const [numPages, setNumPages] = useState(0);
    const renderTaskRef = useRef(null);

    // Load PDF Document
    useEffect(() => {
        if (!file) return;

        const loadPDF = async () => {
            try {
                const arrayBuffer = await file.arrayBuffer();
                const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
                const pdfDoc = await loadingTask.promise;
                setPdf(pdfDoc);
                setNumPages(pdfDoc.numPages);
                if (onPageLoad) onPageLoad(pdfDoc.numPages);
            } catch (error) {
                console.error("Error loading PDF for viewer:", error);
            }
        };

        loadPDF();
    }, [file]);

    // Render Page
    useEffect(() => {
        if (!pdf || !canvasRef.current) return;

        const renderPage = async () => {
            // Cancel previous render task if any
            if (renderTaskRef.current) {
                renderTaskRef.current.cancel();
            }

            try {
                const page = await pdf.getPage(currentPage);
                const viewport = page.getViewport({ scale: 1.5 }); // High quality scale
                const canvas = canvasRef.current;
                const context = canvas.getContext('2d');

                canvas.height = viewport.height;
                canvas.width = viewport.width;

                const renderContext = {
                    canvasContext: context,
                    viewport: viewport
                };

                renderTaskRef.current = page.render(renderContext);
                await renderTaskRef.current.promise;
            } catch (error) {
                if (error.name === 'RenderingCancelledException') {
                    // Ignore, it's normal when changing pages fast
                } else {
                    console.error("Error rendering PDF page:", error);
                }
            }
        };

        renderPage();
    }, [pdf, currentPage]);

    return (
        <div className={`flex flex-col items-center overflow-auto bg-slate-900 h-full w-full ${className}`}>
            <div className="relative shadow-2xl m-4 transition-transform duration-500">
                <canvas
                    ref={canvasRef}
                    className="max-w-full h-auto rounded-sm invert brightness-90 contrast-125"
                />
            </div>
        </div>
    );
};

export default React.memo(PDFViewer);
