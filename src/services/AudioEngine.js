import WaveSurfer from 'wavesurfer.js';
import * as Tone from 'tone';

class AudioEngine {
    constructor() {
        this.wavesurfer = null;
        this.player = null;
        this.pitchShiftNode = null;
        this.onTimeUpdate = null;
        this.onReady = null;
        this.onFinish = null;
        this.isInitialized = false;
        this.targetPitch = 0;

        this.isPlayingState = false;
        this.animationFrame = null;

        // Sync anchors
        this.startTime = 0; // Tone.now() when started
        this.startOffset = 0; // Offset in the buffer when started
    }

    async init(container, options = {}) {
        if (this.wavesurfer) {
            this.destroy();
        }

        const internalContainer = container || document.createElement('div');
        if (!container) {
            internalContainer.id = 'headless-audio-engine';
            internalContainer.style.position = 'absolute';
            internalContainer.style.width = '1px';
            internalContainer.style.height = '1px';
            internalContainer.style.overflow = 'hidden';
            internalContainer.style.top = '-9999px';
            internalContainer.style.left = '-9999px';
            internalContainer.style.pointerEvents = 'none';
            document.body.appendChild(internalContainer);
        }

        this.wavesurfer = WaveSurfer.create({
            container: internalContainer,
            interact: true,
            ...options
        });

        this.internalContainer = !container ? internalContainer : null;
        this._setupListeners();
    }

    async _ensureDSP() {
        if (this.isInitialized) return;

        try {
            await Tone.start();
            if (!this.player) {
                this.player = new Tone.Player().toDestination();

                this.pitchShiftNode = new Tone.PitchShift({
                    pitch: this.targetPitch,
                    windowSize: 0.1,
                    delayTime: 0,
                    feedback: 0
                });

                this.player.disconnect();
                this.player.connect(this.pitchShiftNode);
                this.pitchShiftNode.toDestination();

                this.isInitialized = true;
            }
        } catch (e) {
            console.error("AudioEngine: DSP Error", e);
        }
    }

    _setupListeners() {
        if (!this.wavesurfer) return;

        this.wavesurfer.on('interaction', (newProgress) => {
            if (this.player && this.player.buffer.loaded) {
                const duration = this.player.buffer.duration;
                const seekTime = newProgress * duration;

                if (this.isPlayingState) {
                    this.player.stop();
                    this.startTime = Tone.now();
                    this.startOffset = seekTime;
                    this.player.start(0, seekTime);
                } else {
                    this.startOffset = seekTime;
                }
            }
        });
    }

    async load(url) {
        if (!this.wavesurfer) return;

        const buffer = new Tone.ToneAudioBuffer(url, async () => {
            await this._ensureDSP();
            this.player.buffer = buffer;
            this.startOffset = 0;
            this.wavesurfer.load(url);
            if (this.onReady) this.onReady(buffer.duration);
        }, (err) => {
            alert("Error cargando audio: " + err.message);
        });
    }

    async playPause() {
        if (!this.player || !this.player.buffer.loaded) return;

        await Tone.start();
        if (Tone.context.state !== 'running') await Tone.context.resume();

        if (this.isPlayingState) {
            this.pause();
        } else {
            this.play();
        }
    }

    play() {
        if (!this.player || this.isPlayingState) return;

        // Start from current visual position or saved offset
        const seekTime = (this.wavesurfer) ? this.wavesurfer.getCurrentTime() : this.startOffset;

        this.startTime = Tone.now();
        this.startOffset = seekTime;

        this.player.start(0, seekTime);
        this.isPlayingState = true;

        this._startSyncLoop();
    }

    pause() {
        if (!this.player || !this.isPlayingState) return;

        // Save where we stopped
        this.startOffset = this.getCurrentTime();
        this.player.stop();
        this.isPlayingState = false;

        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }

    _startSyncLoop() {
        const sync = () => {
            if (!this.isPlayingState || !this.player) return;

            const currentTime = this.getCurrentTime();
            const duration = this.getDuration();

            // Notify UI
            if (this.onTimeUpdate) this.onTimeUpdate(currentTime);

            // Update WaveSurfer visual
            if (this.wavesurfer && duration > 0) {
                this.wavesurfer.setTime(currentTime);
            }

            // Check for auto-finish
            if (currentTime >= duration) {
                this.pause();
                if (this.onFinish) this.onFinish();
                return;
            }

            this.animationFrame = requestAnimationFrame(sync);
        };
        this.animationFrame = requestAnimationFrame(sync);
    }

    // Accurate time tracking for Buffer
    getCurrentTime() {
        if (!this.player || !this.player.buffer.loaded) return 0;
        if (!this.isPlayingState) return this.startOffset;

        // Current time = Offset when started + time elapsed since then
        // We multiply by playbackRate if we want to be super precise, but Tone.now() is absolute.
        // If speed is 2.0, we cover 2 seconds of buffer per 1 absolute second.
        const elapsed = Tone.now() - this.startTime;
        const speed = this.player.playbackRate;
        const calculated = this.startOffset + (elapsed * speed);

        return Math.min(calculated, this.getDuration());
    }

    getDuration() {
        return this.player?.buffer.duration || 0;
    }

    isPlaying() {
        return this.isPlayingState;
    }

    setSpeed(rate) {
        // If playing, we need to re-anchor the sync to avoid a jump
        const wasPlaying = this.isPlayingState;
        if (wasPlaying) {
            const nowTime = this.getCurrentTime();
            this.startOffset = nowTime;
            this.startTime = Tone.now();
        }

        if (this.player) {
            this.player.playbackRate = rate;
        }
    }

    setPitch(semitones) {
        this.targetPitch = semitones;
        if (this.pitchShiftNode) {
            this.pitchShiftNode.pitch = semitones;
        }
    }

    destroy() {
        this.pause();
        if (this.wavesurfer) {
            this.wavesurfer.destroy();
            this.wavesurfer = null;
        }
        if (this.player) {
            this.player.dispose();
            this.player = null;
        }
        if (this.pitchShiftNode) {
            this.pitchShiftNode.dispose();
            this.pitchShiftNode = null;
        }
        this.isInitialized = false;
    }

    seekTo(p) {
        const duration = this.getDuration();
        const seekTime = p * duration;

        if (this.isPlayingState) {
            this.player.stop();
            this.startOffset = seekTime;
            this.startTime = Tone.now();
            this.player.start(0, seekTime);
        } else {
            this.startOffset = seekTime;
        }
        this.wavesurfer?.setTime(seekTime);
    }
}

export const audioEngine = new AudioEngine();
