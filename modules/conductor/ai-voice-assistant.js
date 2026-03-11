import { AppStore } from '../services/store.js';
import { updateTelefonoStatus } from '../../data/firestore-services.js';
import { showNotification } from '../utils/helpers.js';

export const AIVoiceAssistant = {
    isListening: false,
    isProcessing: false,
    recognition: null,
    
    // Configurable state
    mountPoint: null,
    conductorName: null,
    
    initialize(containerId = 'ai-assistant-mount', conductorName = 'Conductor') {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.error("Browser not compatible with SpeechRecognition");
            return;
        }

        this.conductorName = conductorName;

        this.recognition = new SpeechRecognition();
        // ... (rest of config unchanged)
        this.recognition.lang = 'es-ES';
        this.recognition.continuous = false;
        this.recognition.interimResults = false;

        this.recognition.onstart = () => {
            this.isListening = true;
            this.updateUI();
        };

        this.recognition.onend = () => {
            this.isListening = false;
            this.updateUI();
        };

        this.recognition.onresult = async (event) => {
            const transcript = event.results[0][0].transcript;
            console.log("🎤 Final Transcription:", transcript);
            await this.processWithAI(transcript);
        };

        this.recognition.onerror = (event) => {
            console.error("Speech Error:", event.error);
            this.isListening = false;
            this.updateUI();
            showNotification(`Error de voz: ${event.error}`, "warning");
        };

        this.mountPoint = document.getElementById(containerId);
        if (this.mountPoint) this.render();
    },

    toggle() {
        if (!this.recognition || this.isProcessing) return;
        
        if (this.isListening) {
            this.recognition.stop();
        } else {
            this.recognition.start();
        }
    },

    async processWithAI(text) {
        this.isProcessing = true;
        this.updateUI();

        const state = AppStore.get();
        const config = state.configuracion;
        const apiKey = config?.gemini_key;

        if (!apiKey) {
            showNotification("IA desactivada: No se encontró Gemini Key.", "error");
            this.isProcessing = false;
            this.updateUI();
            return;
        }

        const SYSTEM_PROMPT = `
        Eres el cerebro lógico del "Live Pool" de App Territorios JW.
        Tu misión es analizar reportes de voz de conductores y extraer un objeto JSON estructurado.

        INTENCIONES PERMITIDAS:
        - "no_esta": Nadie respondió o la llamada falló.
        - "volver": Hubo interés moderado, pidió llamar otro día o en otro horario.
        - "no_llamar": Solicitud expresa de no volver a llamar o molestia.
        - "estudio": Se inició o continuó un curso bíblico.
        - "numero_invalido": El número ya no existe o es incorrecto.

        REGLAS DE EXTRACCIÓN:
        1. Identifica el número de teléfono (formato limpio, ej: 0991234567).
        2. Clasifica la intención en uno de los valores permitidos arriba.
        3. Genera una nota corta, profesional y descriptiva en tercera persona.

        REQUISITO TÉCNICO:
        - Responde UNICAMENTE con un JSON puro.
        - Estructura:
        {
          "telefono": "string",
          "estado": "string_de_intencion",
          "nota": "string",
          "alerta": boolean
        }
        `;

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
                    contents: [{ role: "user", parts: [{ text }] }],
                    generationConfig: {
                        response_mime_type: "application/json",
                        temperature: 0.1
                    }
                })
            });

            const data = await response.json();
            const aiResult = JSON.parse(data.candidates[0].content.parts[0].text);
            
            console.log("🧠 AI Response:", aiResult);
            await this.commitResult(aiResult);
            
            showNotification("IA: Reporte procesado correctamente.", "success");
        } catch (err) {
            console.error("AI Error:", err);
            showNotification("IA falló al procesar el audio.", "error");
        } finally {
            this.isProcessing = false;
            this.updateUI();
        }
    },

    async commitResult(result) {
        const { telefono, estado, nota, alerta } = result;
        if (!telefono) return;

        const state = AppStore.get();
        // Resolve ID from current phone session data
        const phoneEntry = (state.misTelefonos || []).find(p => String(p.numero).includes(telefono) || telefono.includes(String(p.numero)));
        
        if (!phoneEntry) {
            showNotification(`Número ${telefono} no encontrado en tu sesión actual.`, "warning");
            return;
        }

        // Atomic update to Firestore
        await updateTelefonoStatus(phoneEntry.id, estado, this.conductorName, nota, alerta || false);
        
        // Final reactive update to AppStore for local UI reaction
        const updatedPhones = (state.misTelefonos || []).map(p => 
            p.id === phoneEntry.id ? { ...p, estado: 'Completado', notas: nota } : p
        );
        AppStore.set({ misTelefonos: updatedPhones });
    },

    updateUI() {
        if (!this.mountPoint) return;
        this.render();
    },

    render() {
        const isActive = this.isListening;
        const processing = this.isProcessing;

        this.mountPoint.innerHTML = `
            <div class="flex flex-col items-center gap-4 animate-fade-in group pointer-events-auto">
                <button id="ai-mic-btn" 
                        class="w-20 h-20 rounded-[2rem] flex items-center justify-center transition-all duration-500 shadow-2xl relative overflow-hidden active:scale-90
                        ${processing ? 'bg-teal-500 scale-90' : (isActive ? 'bg-rose-500 scale-110 shadow-rose-500/50' : 'bg-slate-900 dark:bg-primary/80 hover:bg-primary')}">
                    
                    <!-- Background ripple -->
                    ${isActive ? `<span class="absolute inset-0 bg-white/30 animate-ping rounded-full"></span>` : ''}
                    
                    <!-- Status Icon -->
                    <div class="relative z-10 text-white text-3xl">
                        ${processing 
                            ? `<i class="fas fa-circle-notch animate-spin"></i>` 
                            : `<i class="fas ${isActive ? 'fa-stop' : 'fa-microphone'} ${isActive ? 'animate-pulse' : ''}"></i>`}
                    </div>
                </button>
                
                <div class="flex flex-col items-center">
                    <span class="text-[8px] font-black uppercase tracking-[0.4em] mb-1 ${isActive ? 'text-rose-500 animate-pulse' : 'text-slate-400 opacity-60'}">
                        ${processing ? 'Cerebro Procesando...' : (isActive ? 'Escuchando Voz...' : 'Reporte IA por Voz')}
                    </span>
                    <div class="h-1 w-12 rounded-full overflow-hidden bg-slate-100 dark:bg-white/5">
                         <div class="h-full bg-primary transition-all duration-1000 ${isActive ? 'w-full' : 'w-0'}"></div>
                    </div>
                </div>
            </div>
        `;

        this.mountPoint.querySelector('#ai-mic-btn').onclick = () => this.toggle();
    }
};
