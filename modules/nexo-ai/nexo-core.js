export class NexoAgent {
    constructor(apiKey, manifest) {
        this.apiKey = apiKey;
        this.manifest = manifest;
        this.actions = {};
        this.recognition = null;
        this.isListening = false;
        this.synth = window.speechSynthesis;
    }

    registerAction(nombre, callback) {
        this.actions[nombre] = callback;
    }

    listen() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.error("Speech Recognition no soportado en este navegador.");
            return;
        }

        if (this.isListening) {
            this.recognition.stop();
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.lang = 'es-ES';
        this.recognition.continuous = false;
        this.recognition.interimResults = false;

        this.recognition.onstart = () => {
            this.isListening = true;
            console.log("Nexo: Escuchando...");
        };

        this.recognition.onresult = async (event) => {
            const transcript = event.results[0][0].transcript;
            console.log("Nexo escuchó:", transcript);
            await this.processCommand(transcript);
        };

        this.recognition.onerror = (event) => {
            console.error("Error en Nexo:", event.error);
            this.isListening = false;
        };

        this.recognition.onend = () => {
            this.isListening = false;
        };

        this.synth.cancel(); // Detener cualquier habla anterior
        this.recognition.start();
    }

    async processCommand(textoUsuario, contextoDinamico = {}) {
        if (!this.apiKey) {
            console.error("Nexo: API Key no configurada.");
            return;
        }

        const systemPrompt = `
            Eres "Nexo", un Agente Universal Multimodal. Estás conectado a la siguiente aplicación:
            \${JSON.stringify(this.manifest, null, 2)}
            
            Contexto Dinámico adicional:
            \${JSON.stringify(contextoDinamico, null, 2)}
            
            Tu objetivo es procesar el comando del usuario y mapearlo a una de las funciones descritas si corresponde.
            
            REGLAS ESTRICTAS:
            1. No uses formato Markdown. No uses \`\`\`json. Solo devuelve el JSON puro ({ ... }).
            2. El JSON debe cumplir con esta estructura EXACTA:
            {
              "respuesta_hablada": "Texto corto y amigable para responderle al usuario",
              "accion": {
                "nombre": "nombre_de_funcion_o_null",
                "parametros": {
                  "clave": "valor_extraido"
                }
              }
            }
            3. Si el comando no parece invocar ninguna de las herramientas, "nombre" debe ser null.
            
            Comando del usuario: "\${textoUsuario}"
        \`;

        try {
            const bodyPayload = {
                contents: [{ parts: [{ text: systemPrompt }] }],
                generationConfig: {
                    temperature: 0.1,
                    topP: 0.8
                }
            };

            const response = await fetch(\`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=\${this.apiKey}\`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyPayload)
            });

            const data = await response.json();
            
            if (!response.ok || data.error) {
                console.error('Nexo API Error:', data.error);
                throw new Error("Pérdida de conexión con el cerebro de Gemini.");
            }

            let rawJson = data.candidates[0].content.parts[0].text.trim();
            if (rawJson.startsWith('\`\`\`json')) {
                rawJson = rawJson.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
            }

            const decision = JSON.parse(rawJson);
            console.log('Nexo Decisión:', decision);

            // 1. Hablar
            if (decision.respuesta_hablada) {
                this.speak(decision.respuesta_hablada);
                // Si existe XolvyAlert lo usamos para mostrar la respuesta (notificación visual)
                if (window.XolvyAlert) {
                    window.XolvyAlert.fire({
                        toast: true,
                        icon: 'info',
                        position: 'bottom-end',
                        title: 'Nexo te informa:',
                        text: decision.respuesta_hablada,
                        showConfirmButton: false,
                        timer: 5000,
                        timerProgressBar: true
                    });
                }
            }

            // 2. Ejecutar
            if (decision.accion && decision.accion.nombre) {
                const funcName = decision.accion.nombre;
                const params = decision.accion.parametros;

                if (this.actions[funcName]) {
                    try {
                        await this.actions[funcName](params);
                    } catch (e) {
                         console.error(\`Error ejecutando \${funcName}:\`, e);
                         this.speak("Ocurrió un error al intentar completar tu comando.");
                    }
                } else {
                    console.warn(\`Nexo: Función '\${funcName}' pedida por la IA no está registrada.\`);
                    this.speak("Mi núcleo sabe qué debe hacer, pero esa función aún no está enlazada en el sistema.");
                }
            }

            return decision;

        } catch (error) {
            console.error('Nexo processCommand error:', error);
            this.speak("Hubo un error al procesar tu instrucción.");
        }
    }

    speak(text) {
        if (!text) return;
        this.synth.cancel();
        const voiceMessage = new SpeechSynthesisUtterance(text);
        voiceMessage.lang = 'es-ES';
        
        const voices = this.synth.getVoices();
        const preferredVoice = voices.find(v => (v.lang === 'es-ES' || v.lang === 'es-MX') && v.name.includes('Google'));
        if (preferredVoice) {
            voiceMessage.voice = preferredVoice;
        }

        this.synth.speak(voiceMessage);
    }
}
