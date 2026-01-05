import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Configure worker - in some setups this needs to be global
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const PageCanvas = ({ pdf, pageNumber, scale = 1.5 }) => {
    const canvasRef = useRef(null);
    const renderTaskRef = useRef(null);
    const [rendered, setRendered] = useState(false);

    useEffect(() => {
        if (!pdf || !canvasRef.current) return;
        if (rendered) return; // Already rendered

        const renderPage = async () => {
            try {
                const page = await pdf.getPage(pageNumber);
                const viewport = page.getViewport({ scale });
                const canvas = canvasRef.current;
                const context = canvas.getContext('2d');

                canvas.height = viewport.height;
                canvas.width = viewport.width;

                const renderContext = {
                    canvasContext: context,
                    viewport: viewport
                };

                if (renderTaskRef.current) {
                    renderTaskRef.current.cancel();
                }

                renderTaskRef.current = page.render(renderContext);
                await renderTaskRef.current.promise;
                setRendered(true);
            } catch (error) {
                if (error.name !== 'RenderingCancelledException') {
                    console.error(`Error rendering page ${pageNumber}:`, error);
                }
            }
        };

        renderPage();

        return () => {
            if (renderTaskRef.current) {
                renderTaskRef.current.cancel();
            }
        };
    }, [pdf, pageNumber, scale, rendered]);

    return (
        <div className="relative shadow-2xl transition-transform duration-500 my-2 w-full flex justify-center" id={`pdf-page-${pageNumber}`} data-page-number={pageNumber}>
            <canvas
                ref={canvasRef}
                className="max-w-full h-auto rounded-sm invert brightness-90 contrast-125"
            />
        </div>
    );
};

const PDFViewer = forwardRef(({ file, onPageLoad, onPageVisible, className = "" }, ref) => {
    const [pdf, setPdf] = useState(null);
    const [numPages, setNumPages] = useState(0);
    const containerRef = useRef(null);

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
        getCurrentScroll: () => {
            if (!containerRef.current) return null;
            const container = containerRef.current;
            const containerRect = container.getBoundingClientRect();
            const pages = Array.from(container.querySelectorAll('[data-page-number]'));

            // Find the page currently at the top of the container (or closest to it)
            // We use a small offset (e.g. 50px) to determine "what I am looking at"
            const viewPoint = containerRect.top + 50;

            for (const page of pages) {
                const rect = page.getBoundingClientRect();
                if (rect.bottom >= viewPoint && rect.top <= containerRect.bottom) {
                    // This page is visible. Calculate offset relative to this page.
                    // Offset 0 = Top of page, 0.5 = Middle, 1 = Bottom
                    const relativeTop = viewPoint - rect.top;
                    const offset = Math.max(0, Math.min(1, relativeTop / rect.height));

                    return {
                        page: parseInt(page.getAttribute('data-page-number')),
                        offset: offset
                    };
                }
            }
            return { page: 1, offset: 0 };
        },
        scrollTo: ({ page, offset = 0 }) => {
            const targetElement = document.getElementById(`pdf-page-${page}`);
            if (targetElement && containerRef.current) {
                const container = containerRef.current;

                const elRect = targetElement.getBoundingClientRect();
                const containerRect = container.getBoundingClientRect();
                const currentScroll = container.scrollTop;
                const relativeTop = elRect.top - containerRect.top;

                // Calculate target position
                const targetScroll = currentScroll + relativeTop + (elRect.height * offset) - 20;

                // Custom Smooth Scroll logic
                const duration = 1500; // 1.5 seconds - Slower scroll
                const startTime = performance.now();

                const easeInOutQuad = (t) => t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

                const animateScroll = (currentTime) => {
                    const elapsed = currentTime - startTime;
                    const progress = Math.min(elapsed / duration, 1);
                    const ease = easeInOutQuad(progress);

                    container.scrollTop = currentScroll + (targetScroll - currentScroll) * ease;

                    if (progress < 1) {
                        requestAnimationFrame(animateScroll);
                    }
                };

                requestAnimationFrame(animateScroll);
            }
        }
    }));

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

    // Manual Scroll Detection (Edit Sync)
    useEffect(() => {
        if (!pdf || !onPageVisible) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const visibleEntry = entries.find(entry => entry.isIntersecting && entry.intersectionRatio > 0.5);
                if (visibleEntry) {
                    const pageNum = parseInt(visibleEntry.target.getAttribute('data-page-number'));
                    onPageVisible(pageNum);
                }
            },
            {
                root: containerRef.current,
                threshold: 0.5
            }
        );

        for (let i = 1; i <= numPages; i++) {
            const el = document.getElementById(`pdf-page-${i}`);
            if (el) observer.observe(el);
        }

        return () => observer.disconnect();
    }, [pdf, numPages, onPageVisible]);


    return (
        <div ref={containerRef} className={`flex flex-col items-center overflow-y-auto bg-slate-900 h-full w-full py-20 ${className}`}>
            {pdf && Array.from({ length: numPages }, (_, i) => (
                <PageCanvas
                    key={i + 1}
                    pdf={pdf}
                    pageNumber={i + 1}
                />
            ))}
        </div>
    );
});

export default React.memo(PDFViewer);
