export const LyricsParser = {
    /**
     * Parse LRC content into an array of objects { time, text }
     * @param {string} content 
     * @returns {Array<{time: number, text: string}>}
     */
    parseLRC: (content) => {
        if (!content) return [];
        const lines = content.split('\n');
        const result = [];
        const timeRegExp = /\[(\d{2}):(\d{2})(\.\d{2,3})?\]/g;

        lines.forEach(line => {
            const matches = [...line.matchAll(timeRegExp)];
            const text = line.replace(timeRegExp, '').trim();

            if (matches.length > 0) {
                matches.forEach(match => {
                    const minutes = parseInt(match[1]);
                    const seconds = parseInt(match[2]);
                    const milliseconds = match[3] ? parseFloat(match[3]) : 0;
                    const time = minutes * 60 + seconds + milliseconds;
                    result.push({ time, text });
                });
            }
        });

        // Sort by time in case of multiple timestamps per line or disordered lines
        return result.sort((a, b) => a.time - b.time);
    },

    /**
     * Parse simple TXT content into an array of lines
     * @param {string} content 
     * @returns {Array<{text: string}>}
     */
    parseTXT: (content) => {
        if (!content) return [];
        return content.split('\n').map((line, index) => ({
            id: index,
            text: line.trim()
        })).filter(item => item.text.length > 0);
    }
};
