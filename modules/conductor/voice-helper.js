import { showNotification } from '../utils/helpers.js';

export const VoiceDictationHelper = {
    isListening: false,
    recognition: null,

    init(onResult, onStatusChange) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn("Speech recognition not supported in this browser.");
            return false;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.lang = 'es-ES';
        this.recognition.continuous = false;
        this.recognition.interimResults = false;

        this.recognition.onstart = () => {
            this.isListening = true;
            if (onStatusChange) onStatusChange(true);
        };

        this.recognition.onend = () => {
            this.isListening = false;
            if (onStatusChange) onStatusChange(false);
        };

        this.recognition.onresult = (event) => {
            const text = event.results[0][0].transcript;
            if (onResult) onResult(text);
        };

        this.recognition.onerror = (event) => {
            console.error("Speech recognition error", event.error);
            this.isListening = false;
            if (onStatusChange) onStatusChange(false);
            showNotification("Error en dictado de voz: " + event.error, "warning");
        };

        return true;
    },

    toggle() {
        if (!this.recognition) return;
        if (this.isListening) {
            this.recognition.stop();
        } else {
            this.recognition.start();
        }
    }
};
