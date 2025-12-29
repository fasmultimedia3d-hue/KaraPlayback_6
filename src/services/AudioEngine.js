import WaveSurfer from 'wavesurfer.js';

class AudioEngine {
    constructor() {
        this.wavesurfer = null;
        this.onTimeUpdate = null;
        this.onReady = null;
        this.onFinish = null;
    }

    /**
     * Initialize WaveSurfer instance
     * @param {HTMLElement} container 
     * @param {Object} options 
     */
    init(container, options = {}) {
        if (this.wavesurfer) {
            this.wavesurfer.destroy();
        }

        this.wavesurfer = WaveSurfer.create({
            container: container,
            waveColor: 'rgba(124, 58, 237, 0.5)', // violet-600 with opacity
            progressColor: 'rgb(124, 58, 237)', // violet-600
            cursorColor: 'rgb(255, 255, 255)',
            barWidth: 2,
            barGap: 1,
            barRadius: 2,
            height: 100,
            backend: 'MediaElement', // Better for large files/streaming
            ...options
        });

        this._setupListeners();
    }

    _setupListeners() {
        if (!this.wavesurfer) return;

        this.wavesurfer.on('timeupdate', (currentTime) => {
            if (this.onTimeUpdate) this.onTimeUpdate(currentTime);
        });

        this.wavesurfer.on('ready', () => {
            if (this.onReady) this.onReady(this.wavesurfer.getDuration());
        });

        this.wavesurfer.on('finish', () => {
            if (this.onFinish) this.onFinish();
        });
    }

    load(url) {
        if (!this.wavesurfer) return;
        this.wavesurfer.load(url);
    }

    playPause() {
        if (!this.wavesurfer) return;
        this.wavesurfer.playPause();
    }

    play() {
        if (!this.wavesurfer) return;
        this.wavesurfer.play();
    }

    pause() {
        if (!this.wavesurfer) return;
        this.wavesurfer.pause();
    }

    seekTo(progress) {
        if (!this.wavesurfer) return;
        this.wavesurfer.seekTo(progress); // 0 to 1
    }

    setTime(seconds) {
        if (!this.wavesurfer) return;
        this.wavesurfer.setTime(seconds);
    }

    /**
     * Set playback speed (tempo)
     * @param {number} rate - 0.5 to 2.0 usually
     * @param {boolean} preservePitch - Whether to preserve pitch
     */
    setSpeed(rate, preservePitch = true) {
        if (!this.wavesurfer) return;
        this.wavesurfer.setPlaybackRate(rate, preservePitch);
    }

    /**
     * Set Pitch (Simulated via playbackRate if preservePitch is false, or needing DSP)
     * Since WaveSurfer/HTML5 doesn't support pitch shifting without speed change natively easily,
     * we will implement a basic detune if WebAudio backend, or just use speed trick for now.
     * Note: Real pitch shifting requires complex DSP (SoundTouch/Rubberband).
     */
    setPitch(semitones) {
        // Placeholder: Implementing pitch shift usually requires specific DSP libraries.
        // For now, we logging this limitation or we can use the playbackRate trick if the user accepts speed change.
        console.warn("Pitch shifting without speed change requires additional DSP libraries (e.g. SoundTouch).");

        // If we want to simulate "Chipmunk" effect (Speed + Pitch up):
        // this.wavesurfer.setPlaybackRate(1.0 + (semitones * 0.05), false); 
    }

    getDuration() {
        return this.wavesurfer ? this.wavesurfer.getDuration() : 0;
    }

    getCurrentTime() {
        return this.wavesurfer ? this.wavesurfer.getCurrentTime() : 0;
    }

    isPlaying() {
        return this.wavesurfer ? this.wavesurfer.isPlaying() : false;
    }

    destroy() {
        if (this.wavesurfer) {
            this.wavesurfer.destroy();
            this.wavesurfer = null;
        }
    }
}

export const audioEngine = new AudioEngine();
