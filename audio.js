// Audio synthesis engine using Web Audio API for Spinner Wheels.
// This avoids external mp3 assets, ensuring offline capability and speed.

let audioCtx = null;

function getAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

// Global volume setting (0 to 1)
let masterVolume = 0.5;

export function setMasterVolume(vol) {
    masterVolume = Math.max(0, Math.min(1, vol));
}

// Utility to create a gain node connected to destination
function createOutput(ctx, duration, volumeMultiplier = 1) {
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(masterVolume * volumeMultiplier, ctx.currentTime);
    gainNode.connect(ctx.destination);
    return gainNode;
}

// Play tick sound (plastic clicker)
export function playTick(type = 'plastic', volume = 0.5) {
    try {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') return;

        const gainNode = createOutput(ctx, 0.05, volume);
        
        if (type === 'none') return;

        if (type === 'electronic') {
            // Short high-pitched beep
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(2000, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.02);
            
            gainNode.gain.setValueAtTime(masterVolume * volume, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
            
            osc.connect(gainNode);
            osc.start();
            osc.stop(ctx.currentTime + 0.03);
        } else if (type === 'woodblock') {
            // High pitch, short organic decay
            const osc = ctx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(1200, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.03);

            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(1000, ctx.currentTime);
            filter.Q.setValueAtTime(3, ctx.currentTime);

            gainNode.gain.setValueAtTime(masterVolume * volume, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

            osc.connect(filter);
            filter.connect(gainNode);
            osc.start();
            osc.stop(ctx.currentTime + 0.05);
        } else {
            // Default 'plastic' clicker: sharp sweep
            const osc = ctx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(1500, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.015);

            gainNode.gain.setValueAtTime(masterVolume * volume, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.015);

            osc.connect(gainNode);
            osc.start();
            osc.stop(ctx.currentTime + 0.015);
        }
    } catch (e) {
        console.error("Failed to play tick sound:", e);
    }
}

// Play winner sound
export function playWinner(type = 'applause', volume = 0.8) {
    try {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') return;

        const gainNode = createOutput(ctx, 3.0, volume);
        const now = ctx.currentTime;

        if (type === 'none') return;

        if (type === 'applause') {
            // Synthesize applause using filtered white noise
            const bufferSize = ctx.sampleRate * 2.5; // 2.5 seconds
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            
            // Generate white noise
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            const noiseNode = ctx.createBufferSource();
            noiseNode.buffer = buffer;

            // Bandpass filter to make it sound like claps/hiss
            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(1000, now);
            filter.frequency.linearRampToValueAtTime(1200, now + 1.0);
            filter.Q.setValueAtTime(1.5, now);

            // Envelope: Fade in, fluctuate, fade out
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(masterVolume * volume, now + 0.3);
            
            // Add volume fluctuation for crowd density
            for (let t = 0.3; t < 2.0; t += 0.1) {
                const fluctuation = (Math.random() * 0.3 + 0.75) * masterVolume * volume;
                gainNode.gain.linearRampToValueAtTime(fluctuation, now + t);
            }
            
            gainNode.gain.linearRampToValueAtTime(0.001, now + 2.5);

            noiseNode.connect(filter);
            filter.connect(gainNode);
            noiseNode.start();
            noiseNode.stop(now + 2.5);

            // Overlay quick randomized pop chimes for individual claps
            for (let i = 0; i < 25; i++) {
                const delay = Math.random() * 2.0;
                setTimeout(() => {
                    playTick('woodblock', volume * 0.4);
                }, delay * 1000);
            }

        } else if (type === 'tada') {
            // Chime arpeggio chord: C5 -> E5 -> G5 -> C6 -> E6
            const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
            notes.forEach((freq, index) => {
                const osc = ctx.createOscillator();
                const noteGain = ctx.createGain();
                
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + index * 0.08);

                noteGain.gain.setValueAtTime(0, now + index * 0.08);
                noteGain.gain.linearRampToValueAtTime(masterVolume * volume * 0.3, now + index * 0.08 + 0.02);
                noteGain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.08 + 1.2);

                osc.connect(noteGain);
                noteGain.connect(ctx.destination);
                
                osc.start(now + index * 0.08);
                osc.stop(now + index * 0.08 + 1.3);
            });
        } else if (type === 'fanfare') {
            // A brassy chord progression
            const chords = [
                { time: 0, notes: [261.63, 392.00, 523.25], duration: 0.4 },
                { time: 0.4, notes: [349.23, 440.00, 698.46], duration: 0.4 },
                { time: 0.8, notes: [392.00, 493.88, 587.33, 783.99], duration: 1.5 }
            ];

            chords.forEach(chord => {
                chord.notes.forEach(freq => {
                    const osc = ctx.createOscillator();
                    const noteGain = ctx.createGain();
                    
                    osc.type = 'triangle'; // Brassy warmth
                    osc.frequency.setValueAtTime(freq, now + chord.time);

                    // Slightly detune to sound like multiple brass players
                    osc.detune.setValueAtTime(Math.random() * 10 - 5, now + chord.time);

                    // Low pass filter for a brassy "wah" effect
                    const filter = ctx.createBiquadFilter();
                    filter.type = 'lowpass';
                    filter.frequency.setValueAtTime(100, now + chord.time);
                    filter.frequency.exponentialRampToValueAtTime(2000, now + chord.time + 0.1);
                    filter.frequency.exponentialRampToValueAtTime(800, now + chord.time + chord.duration);

                    noteGain.gain.setValueAtTime(0, now + chord.time);
                    noteGain.gain.linearRampToValueAtTime(masterVolume * volume * 0.2, now + chord.time + 0.05);
                    noteGain.gain.exponentialRampToValueAtTime(0.001, now + chord.time + chord.duration);

                    osc.connect(filter);
                    filter.connect(noteGain);
                    noteGain.connect(ctx.destination);

                    osc.start(now + chord.time);
                    osc.stop(now + chord.time + chord.duration);
                });
            });
        } else if (type === 'gong') {
            // Deep resonant metallic bell
            const fundamental = 110; // A2
            const partials = [1, 1.414, 1.732, 2.31, 2.65, 3.11, 3.94]; // Non-harmonic frequencies for metal resonance
            
            partials.forEach((ratio, index) => {
                const osc = ctx.createOscillator();
                const noteGain = ctx.createGain();
                
                osc.type = index % 2 === 0 ? 'sine' : 'sawtooth';
                osc.frequency.setValueAtTime(fundamental * ratio, now);

                // Filters to damp high harmonics faster than the fundamental
                const filter = ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(1000, now);
                filter.frequency.exponentialRampToValueAtTime(200, now + 1.0);

                const oscVol = (1 / ratio) * 0.15; // Higher partials are quieter
                noteGain.gain.setValueAtTime(masterVolume * volume * oscVol, now);
                noteGain.gain.exponentialRampToValueAtTime(0.001, now + 3.5 / ratio); // Higher partials decay faster

                osc.connect(filter);
                filter.connect(noteGain);
                noteGain.connect(ctx.destination);

                osc.start(now);
                osc.stop(now + 4.0);
            });
        }
    } catch (e) {
        console.error("Failed to play winner sound:", e);
    }
}
