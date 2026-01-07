import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';

const ImageViewer = forwardRef(({ file, onImageLoad, className = "" }, ref) => {
    const [imageUrl, setImageUrl] = useState(null);
    const containerRef = useRef(null);
    const imageRef = useRef(null);

    // Expose methods to parent (Compatible with PDFViewer API)
    useImperativeHandle(ref, () => ({
        getCurrentScroll: () => {
            if (!containerRef.current || !imageRef.current) return null;
            const container = containerRef.current;
            const containerRect = container.getBoundingClientRect();
            const imageRect = imageRef.current.getBoundingClientRect();

            // For images, we treat it as "Page 1" always.
            // Calculate offset relative to the image height.
            // visibleTop is where the container's top edge cuts the image.

            // imageRect.top is relative to viewport. containerRect.top is viewport.
            // if imageRect.top < containerRect.top, we are scrolled down.
            const scrolledAmount = containerRect.top - imageRect.top;
            const visibleHeight = Math.min(imageRect.height, containerRect.height);

            // We want the offset of the "visual center" or "top". 
            // PDFViewer used a "viewPoint" (top + 50).
            const viewPoint = containerRect.top + 50;
            const relativeTop = viewPoint - imageRect.top;

            const offset = Math.max(0, Math.min(1, relativeTop / imageRect.height));

            return {
                page: 1, // Images are always Single Page
                offset: offset
            };
        },
        scrollTo: ({ page, offset = 0 }) => {
            if (containerRef.current && imageRef.current) {
                const container = containerRef.current;
                const image = imageRef.current;

                // Calculate target scrollTop based on offset
                // Target Scroll = Image Height * Offset - Padding
                // Assuming image is at the top of the container scroller.
                // container.scrollTop = ...

                // Robust calculation using rects
                // But simpler: if image is first child, offset * height is usually enough.
                // Let's stick to the robust relative calculation used in PDFViewer for consistency.

                const currentScroll = container.scrollTop;
                const elRect = image.getBoundingClientRect();
                const containerRect = container.getBoundingClientRect();
                const relativeTop = elRect.top - containerRect.top; // Should be negative or 0

                const targetScroll = currentScroll + relativeTop + (elRect.height * offset) - 20;

                // Custom Smooth Scroll logic
                const duration = 1500;
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

    // Load Image
    useEffect(() => {
        if (!file) return;
        const url = URL.createObjectURL(file);
        setImageUrl(url);

        // Notify parent of load (simulating generic onPageLoad)
        if (onImageLoad) onImageLoad(1); // 1 page

        return () => URL.revokeObjectURL(url);
    }, [file]);

    return (
        <div ref={containerRef} className={`flex flex-col items-center overflow-y-auto bg-slate-900 h-full w-full py-20 ${className}`}>
            <div className="relative shadow-2xl transition-transform duration-500 my-2 w-full flex justify-center max-w-4xl mx-auto">
                {imageUrl && (
                    <img
                        ref={imageRef}
                        src={imageUrl}
                        className="max-w-full h-auto rounded-sm invert pointer-events-none select-none brightness-90 contrast-125"
                        alt="Score"
                        onLoad={() => {
                            // Optional: notify size ready?
                        }}
                    />
                )}
            </div>
        </div>
    );
});

export default React.memo(ImageViewer);
