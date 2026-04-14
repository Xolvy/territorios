export class NexoAgent {
    constructor(apiKey, manifest) {
        this.apiKey = apiKey;
        this.manifest = manifest;
        this.actions = {};
        this.recognition = null;
        this.isListening = false;
        this.synth = window.speechSynthesis;
        this.ultimoTerritorioId = null;
        this.ui = new NexoUI();
        this.latestContext = {};
        this.flujo = null; // { paso, territorioId, territorioNum }
        
        // Exponer para acceso global según instrucciones
        window.nexoIniciarFlujoAvance = (id, num) => this.iniciarFlujoAvance(id, num);
    }

    getLatestContext() {
        return this.latestContext;
    }

    registerAction(nombre, callback) {
        this.actions[nombre] = callback;
    }

    listen(contexto = {}) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.error("Speech Recognition no soportado en este navegador.");
            return;
        }

        this.latestContext = contexto;

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
            this.ui.updateStatus('Escuchando...');
            console.log("Nexo: Escuchando...");
        };

        this.recognition.onresult = async (event) => {
            const transcript = event.results[0][0].transcript;
            console.log("Nexo escuchó:", transcript);
            this.limpiarTimeoutInactividad(); // Cancelo timer al escuchar interacción
            this.ui.addMessage(transcript, 'usuario');
            
            // Verificación prioritaria de flujo estructurado
            if (this.flujo && this.flujo.paso) {
                await this.manejarFlujoLocal(transcript);
                return;
            }

            await this.processCommand(transcript, contexto);
        };

        this.recognition.onerror = (event) => {
            console.error("Error en Nexo:", event.error);
            this.isListening = false;
            this.ui.updateStatus('Error');
        };

        this.recognition.onend = () => {
            this.isListening = false;
            this.ui.updateStatus('En espera');
            
            // Si no hay flujo activo, inicio el timer de auto-cierre
            if (!this.flujo) {
                this.iniciarTimeoutInactividad();
            }
        };

        this.synth.cancel(); // Detener cualquier habla anterior
        this.recognition.start();
    }

    async manejarFlujoLocal(texto) {
        if (!this.flujo || !this.flujo.cola) return;
        const { paso, cola, indice } = this.flujo;
        const territorioActual = cola[indice];

        // ── PASO 1: confirmar manzanas ──
        if (paso === 1) {
            const completo = /(sí|si|todo|todas|terminamos|completo)/.test(texto.toLowerCase());
            
            if (this.actions['registrar_predicacion_territorio']) {
                await this.actions['registrar_predicacion_territorio']({
                    territorio_id: territorioActual.id,
                    tipo_entrega: completo ? 'completo' : 'parcial',
                    es_flujo_interno: true
                });
            }
            
            this.flujo.paso = 2;
            this.speak(
                `¿Alguna novedad para el registro S-13 del territorio ${territorioActual.numero}?`,
                true
            );
            return;
        }

        // ── PASO 2: recolectar novedades ──
        if (paso === 2) {
            const sinNovedad = /(no|nada|ninguna|sin novedad)/.test(texto.toLowerCase());
            
            if (!sinNovedad && this.actions['registrar_novedad_flujo']) {
                await this.actions['registrar_novedad_flujo']({
                    territorio_id: territorioActual.id,
                    novedad: texto
                });
            }

            const siguienteIndice = indice + 1;

            // ── ¿Hay más territorios en la cola? ──
            if (siguienteIndice < cola.length) {
                const siguiente = cola[siguienteIndice];
                this.flujo.paso = 1;
                this.flujo.indice = siguienteIndice;
                
                this.speak(
                    `Ahora con el territorio ${siguiente.numero}. ¿Se predicaron todas las manzanas o quedó alguna pendiente?`,
                    true
                );
            } else {
                // ── Cola terminada: cierre ──
                this.flujo = null;
                this.iniciarTimeoutInactividad(); // Inicio timer al terminar flujo
                
                const totalRegistrados = cola.length;
                const resumen = totalRegistrados === 1
                    ? `territorio ${cola[0].numero} registrado`
                    : `${totalRegistrados} territorios registrados`;
                
                this.speak(`Listo, ${resumen}. ¡Buen trabajo!`, false);
            }
            return;
        }
    }

    iniciarTimeoutInactividad() {
        this.limpiarTimeoutInactividad();
        if (this.flujo || this.isListening) return;

        // Aviso a los 20 segundos
        this.timeoutAviso = setTimeout(() => {
            if (!this.flujo && !this.isListening) {
                this.speak("¿Sigues ahí? Si no hay más comandos, voy a cerrarme.");
            }
        }, 20000);

        // Cierre a los 30 segundos
        this.timeoutCierre = setTimeout(() => {
            if (!this.flujo && !this.isListening) {
                this.ui.cerrarChat();
            }
        }, 30000);
    }

    limpiarTimeoutInactividad() {
        clearTimeout(this.timeoutAviso);
        clearTimeout(this.timeoutCierre);
        this.timeoutAviso = null;
        this.timeoutCierre = null;
    }

    async obtenerInfoTerritorio(idOrNum) {
        try {
            const { getTerritorios } = await import('../../data/firestore-services.js');
            const territorios = await getTerritorios();
            const target = territorios.find(t => t.id === String(idOrNum) || String(t.numero) === String(idOrNum));
            if (target) {
                return { id: target.id, numero: target.numero };
            }
        } catch (e) { console.error("Error resolviendo territorio:", e); }
        return { id: idOrNum, numero: idOrNum };
    }

    async processCommand(textoUsuario, contextoDinamico = {}) {
        if (!this.apiKey) {
            console.error("Nexo: API Key no configurada.");
            return;
        }

        if (this.flujo && this.flujo.paso) {
            await this.manejarFlujoLocal(textoUsuario);
            return;
        }

        const systemPrompt = `
            Eres "Nexo", el asistente operativo inteligente de la aplicación ${this.manifest.app_name}.
            
            UNIDAD DE ACCIÓN: Nexo Transaccional.
            
            REGLAS DE COMPORTAMIENTO (ESTRICTAS):
            1. REGISTRO DE PREDICACIÓN:
               - Eres un asistente operativo. Si el usuario te indica que predicó o terminó un territorio, DEBES llamar a la herramienta "registrar_predicacion_territorio".
               - Cuando el usuario mencione más de un territorio (ej: "el 13 y el 14", "los territorios 5, 6 y 7"), debes devolver UN SOLO objeto JSON con todos los IDs en un array bajo el parámetro "ids".
               - Si solo hay un territorio, igualmente usa el array con un solo elemento: "ids": [8]. Nunca uses el campo "id" (singular).
               - Al llamar a esta herramienta, Nexo activará un flujo de voz automático para confirmar detalles. Tu respuesta_hablada debe ser muy breve, ej: "Entendido, voy a registrar los territorios 13 y 14." o similar. NO hagas preguntas adicionales sobre manzanas o novedades.
            2. INFERENCIA DE CONTEXTO:
               - Si el usuario dice "terminé el territorio" sin número, revisa el Contexto Dinámico (territorios_asignados). Si solo tiene uno asignado, úsalo automáticamente. Si tiene varios, pregunta cuál.
            3. PERSONALIDAD:
               - Eres ejecutivo, preciso y profesional. Evita rodeos innecesarios.
            
            MANIFEST DE HERRAMIENTAS:
            ${JSON.stringify(this.manifest, null, 2)}
            
            CONTEXTO DINÁMICO (Asignaciones actuales):
            ${JSON.stringify(contextoDinamico, null, 2)}
            
            MEMORIA RECIENTE:
            - Último territorio: ${this.ultimoTerritorioId || 'Ninguno'}
            
            REGLAS TÉCNICAS:
            1. No uses Markdown. Solo devuelve JSON puro.
            2. Estructura EXACTA:
            {
              "respuesta_hablada": "Texto natural para el usuario",
              "accion": {
                "nombre": "nombre_de_la_herramienta_o_null",
                "parametros": { ... }
              }
            }
            3. Si no hay acción que ejecutar, "nombre" debe ser null.

            Comando del usuario: "${textoUsuario}"
            
            NOTA IMPORTANTE: 
            Si el usuario dice "terminé", "listo" o similar, y en el contexto dinámico o memoria interna hay un territorio, ÚSALO.
            Si no hay territorio_id en el comando pero sí en el contexto, inclúyelo obligatoriamente en los parámetros de la acción.
            Contexto Flujo Actual: ${JSON.stringify(this.flujo)}
        `;

        this.ui.showTyping();
        this.ui.updateStatus('Procesando...');
        try {
            const bodyPayload = {
                system_instruction: { parts: [{ text: systemPrompt }] },
                contents: [{ role: "user", parts: [{ text: textoUsuario }] }],
                generationConfig: {
                    temperature: 0.1,
                    topP: 0.8,
                    responseMimeType: "application/json"
                }
            };

            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${this.apiKey}`;
            console.log("📡 NEXO FETCH URL: ", url);
            const response = await fetch(url, {
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
            if (rawJson.startsWith('```json')) {
                rawJson = rawJson.replace(/```json/g, '').replace(/```/g, '').trim();
            }

            const decision = JSON.parse(rawJson);
            console.log('Nexo Decisión:', decision);

            // 0. Memoria de territorio para seguimiento
            if (decision.accion && decision.accion.parametros && decision.accion.parametros.territorio_id) {
                this.ultimoTerritorioId = decision.accion.parametros.territorio_id;
            } else if (decision.accion && decision.accion.parametros && decision.accion.parametros.numero_territorio) {
                this.ultimoTerritorioId = decision.accion.parametros.numero_territorio;
            }

            // 1. Hablar (Silenciar si la acción dispara el flujo de voz estructurado)
            const silenciarIA = decision.accion && (decision.accion.nombre === 'registrar_predicacion_territorio');
            
            if (decision.respuesta_hablada && !silenciarIA) {
                this.speak(decision.respuesta_hablada);
            }

            // 2. Ejecutar
            if (decision.accion && decision.accion.nombre) {
                const funcName = decision.accion.nombre;
                const params = decision.accion.parametros;

                // Caso especial FASE 3: Registro de territorios en cola
                if (funcName === 'registrar_predicacion_territorio') {
                    const ids = params.ids || [params.territorio_id || params.id];
                    const territoriosInfo = await Promise.all(
                        ids.map(id => this.obtenerInfoTerritorio(id))
                    );

                    this.flujo = {
                        paso: 1,
                        cola: territoriosInfo,
                        indice: 0
                    };

                    const primero = this.flujo.cola[0];
                    this.speak(
                        `He registrado tu avance. ¿Se predicaron todas las manzanas del territorio ${primero.numero} o quedó alguna pendiente?`,
                        true
                    );
                    return decision;
                }

                if (this.actions[funcName]) {
                    try {
                        await this.actions[funcName](params);
                    } catch (e) {
                         console.error(`Error ejecutando ${funcName}:`, e);
                         this.speak("Ocurrió un error al intentar completar tu comando.");
                    }
                } else {
                    console.warn(`Nexo: Función '${funcName}' pedida por la IA no está registrada.`);
                    this.speak("Mi núcleo sabe qué debe hacer, pero esa función aún no está enlazada en el sistema.");
                }
            }

            return decision;

        } catch (error) {
            this.ui.hideTyping();
            this.ui.updateStatus('En espera');
            console.error('Nexo processCommand error:', error);
            this.speak("Hubo un error al procesar tu instrucción.");
        }
    }

    speak(text, autoListen = false) {
        if (!text) return;
        this.limpiarTimeoutInactividad(); 
        this.ui.hideTyping();
        this.ui.updateStatus('Hablando...');
        this.ui.addMessage(text, 'nexo');
        this.synth.cancel();
        const voiceMessage = new SpeechSynthesisUtterance(text);
        voiceMessage.lang = 'es-ES';
        
        voiceMessage.onend = () => {
            if (autoListen) {
                setTimeout(() => {
                    try {
                        this.ui.updateStatus('Escuchando...');
                        this.listen(this.latestContext);
                    } catch (e) {
                        console.error("Mic error:", e);
                        this.isListening = false;
                        this.ui.updateStatus('Error');
                    }
                }, 100);
            } else {
                this.iniciarTimeoutInactividad();
            }
        };

        const voices = this.synth.getVoices();
        const preferredVoice = voices.find(v => (v.lang === 'es-ES' || v.lang === 'es-MX') && v.name.includes('Google'));
        if (preferredVoice) {
            voiceMessage.voice = preferredVoice;
        }

        this.synth.speak(voiceMessage);
    }

    async analyzeImage(base64Data, mimeType = 'image/jpeg') {
        if (!this.apiKey) {
            throw new Error("Nexo: API Key no configurada.");
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${this.apiKey}`;
        
        const bodyPayload = {
            contents: [{
                parts: [
                    { text: "Eres un asistente visual. Analiza la imagen de esta tarjeta de territorio. Extrae en formato JSON el 'territorio_id' (el número del territorio) y un array 'manzanas_trabajadas' con los números de las manzanas que veas marcadas, tachadas o pintadas. Responde únicamente el JSON." },
                    {
                        inline_data: {
                            mime_type: mimeType,
                            data: base64Data
                        }
                    }
                ]
            }],
            generationConfig: {
                temperature: 0.1,
                responseMimeType: "application/json"
            }
        };


        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyPayload)
            });

            const data = await response.json();
            if (!response.ok || data.error) {
                console.error('Nexo Vision Error:', data.error);
                throw new Error("Error en el análisis visual de Gemini.");
            }

            let rawJson = data.candidates[0].content.parts[0].text.trim();
            if (rawJson.startsWith('```json')) {
                rawJson = rawJson.replace(/```json/g, '').replace(/```/g, '').trim();
            }

            return JSON.parse(rawJson);
        } catch (error) {
            console.error('Nexo analyzeImage error:', error);
            throw error;
        }
    }

    iniciarFlujoAvance(id, num) {
        this.flujo = { 
            paso: 1, 
            territorioId: String(id), 
            territorioNum: String(num) 
        };
        this.speak(`He registrado tu avance. ¿Se predicaron todas las manzanas del territorio ${num} o quedó alguna pendiente?`, true);
    }
}

/**
 * Motor de UI Conversacional Premium para Nexo
 */
class NexoUI {
    constructor() {
        this.isChatOpen = false;
        this.maxMessages = 30;
        this.init();
    }

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.injectUI());
        } else {
            this.injectUI();
        }
    }

    injectUI() {
        if (document.getElementById('nexo-widget')) return;

        const styles = `
            #nexo-widget {
                position: fixed; bottom: 20px; right: 20px; z-index: 9999;
                display: flex; flex-direction: column; align-items: flex-end; gap: 0;
                font-family: 'Outfit', sans-serif;
                transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            }
            #nexo-widget.active {
                box-shadow: 0 10px 40px rgba(0,0,0,0.15);
                border-radius: 16px;
            }
            #nexo-chat-panel {
                width: 300px; max-height: 380px;
                background: rgba(255, 255, 255, 0.82);
                backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
                border: 1px solid rgba(255,255,255,0.4);
                border-bottom: none;
                border-radius: 20px 20px 0 0;
                overflow: hidden;
                display: none;
                flex-direction: column;
            }
            #nexo-messages {
                padding: 16px; display: flex; flex-direction: column; gap: 10px;
                max-height: 320px; overflow-y: auto;
                scroll-behavior: smooth;
            }
            #nexo-messages::-webkit-scrollbar { width: 4px; }
            #nexo-messages::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 2px; }

            #nexo-pill {
                width: auto;
                min-width: 140px;
                display: flex; align-items: center; gap: 14px;
                background: rgba(255,255,255,0.6);
                backdrop-filter: blur(8px);
                border: 1px solid rgba(255,255,255,0.3);
                border-radius: 20px; padding: 6px 20px 6px 6px;
                cursor: pointer;
                transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                box-shadow: 0 4px 12px rgba(0,0,0,0.05);
            }
            #nexo-pill.active {
                width: 300px;
                border-radius: 0 0 20px 20px;
                background: rgba(255, 255, 255, 0.82);
                border-top: 1px solid rgba(0,0,0,0.05);
                box-shadow: none;
                padding: 8px 16px 8px 8px;
            }
            #nexo-icon-wrap {
                width: 52px; height: 52px; border-radius: 50%;
                background: rgba(29, 158, 117, 0.18);
                backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
                border: 1.5px solid rgba(29, 158, 117, 0.35);
                box-shadow: 0 2px 16px rgba(29, 158, 117, 0.15);
                display: flex; align-items: center; justify-content: center;
                position: relative;
                flex-shrink: 0;
                transition: all 0.3s ease;
            }
            #nexo-status-ring {
                position: absolute; inset: -4px; border-radius: 50%;
                border: 2px solid transparent; border-top-color: #10b981;
                animation: nexo-spin 1s linear infinite;
                display: none;
            }
            .nexo-dot-pulse {
                width: 8px; height: 8px; border-radius: 50%;
                background: #10b981;
                box-shadow: 0 0 10px rgba(16,185,129,0.4);
                animation: nexo-breathe 2s infinite;
            }
            
            #nexo-label { font-size: 14px; font-weight: 800; color: #1e293b; letter-spacing: -0.02em; }
            #nexo-state { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }

            .msg-row { display: flex; gap: 8px; align-items: flex-end; width: 100%; margin-bottom: 6px; }
            .msg-row.nexo { justify-content: flex-start; }
            .msg-row.usuario { flex-direction: row-reverse; }

            .msg-bubble { 
                padding: 10px 14px; font-size: 13px; max-width: 85%; 
                line-height: 1.5; font-weight: 500;
            }
            .msg-row.nexo .msg-bubble {
                background: white;
                color: #334155;
                border-radius: 16px 16px 16px 4px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.03);
            }
            .msg-row.usuario .msg-bubble {
                background: #6366f1;
                color: white;
                border-radius: 16px 16px 4px 16px;
                box-shadow: 0 4px 12px rgba(99,102,241,0.2);
            }

            .msg-avatar {
                width: 24px; height: 24px; border-radius: 50%;
                display: flex; align-items: center; justify-content: center;
                font-size: 10px; font-weight: 900; color: white; flex-shrink: 0;
            }
            .msg-row.nexo .msg-avatar { background: #10b981; }
            .msg-row.usuario .msg-avatar { background: #6366f1; }

            #nexo-typing { display: flex; gap: 4px; padding: 12px 8px; }
            .typing-dot { 
                width: 6px; height: 6px; border-radius: 50%; background: #94a3b8;
                animation: nexo-dot 1.2s infinite ease-in-out;
            }
            @keyframes nexo-spin { to { transform: rotate(360deg); } }
            @keyframes nexo-breathe { 0%,100%{opacity:0.4; transform:scale(0.8)} 50%{opacity:1; transform:scale(1)} }
            @keyframes nexo-dot { 0%,80%,100%{opacity:0.2; transform:translateY(0)} 40%{opacity:1; transform:translateY(-4px)} }
        `;

        const styleSheet = document.createElement("style");
        styleSheet.innerText = styles;
        document.head.appendChild(styleSheet);

        const widget = document.createElement('div');
        widget.id = 'nexo-widget';
        widget.innerHTML = `
            <div id="nexo-chat-panel">
                <div id="nexo-messages"></div>
            </div>
            <div id="nexo-pill">
                <div id="nexo-icon-wrap">
                    <div id="nexo-status-ring"></div>
                    <div class="nexo-dot-pulse" id="nexo-idle-dot"></div>
                    <svg id="nexo-mic-icon" style="display:none; opacity:0.95" width="22" height="22" fill="#0F6E56" viewBox="0 0 24 24">
                        <path d="M12 15c1.66 0 3-1.34 3-3V6c0-1.66-1.34-3-3-3S9 4.34 9 6v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 15 6.7 12H5c0 3.41 2.72 6.23 6 6.72V21h2v-2.28c3.28-.49 6-3.31 6-6.72h-1.7z"/>
                    </svg>
                </div>
                <div id="nexo-info">
                    <div id="nexo-label">Nexo</div>
                    <div id="nexo-state">En espera</div>
                </div>
            </div>
        `;
        document.body.appendChild(widget);

        document.getElementById('nexo-pill').onclick = (e) => {
            const nexo = window._nexoInstance;
            if (this.isChatOpen) {
                // Cerrar
                if (nexo && nexo.recognition) {
                    try { nexo.recognition.stop(); } catch(err) {}
                }
                if (nexo) nexo.isListening = false;
                this.toggleChat(); // Colapsa
                this.updateStatus('EN ESPERA');
            } else {
                // Abrir
                this.toggleChat();
                if (nexo) {
                    const context = nexo.getLatestContext?.() || {};
                    nexo.listen(context);
                }
            }
        };
    }

    setStatus(text) {
        this.updateStatus(text);
    }

    toggleChat() {
        this.isChatOpen = !this.isChatOpen;
        const panel = document.getElementById('nexo-chat-panel');
        const pill = document.getElementById('nexo-pill');
        const widget = document.getElementById('nexo-widget');
        const ring = document.getElementById('nexo-status-ring');
        const dot = document.getElementById('nexo-idle-dot');
        const mic = document.getElementById('nexo-mic-icon');

        if (!panel || !pill || !widget) return;

        if (this.isChatOpen) {
            panel.style.display = 'flex';
            pill.classList.add('active');
            widget.classList.add('active');
            if (dot) dot.style.display = 'none';
            if (ring) ring.style.display = 'block'; // Mostrar anillo al abrir
            if (mic) mic.style.display = 'block';

            // Si está vacío, saludar pero no auto-escuchar inmediatamente (dejar que el usuario vea el panel)
            const messages = document.getElementById('nexo-messages');
        } else {
            panel.style.display = 'none';
            pill.classList.remove('active');
            widget.classList.remove('active');
            if (ring) ring.style.display = 'none';
            if (dot) dot.style.display = 'block';
            if (mic) mic.style.display = 'none';
            this.clear();
        }
    }

    updateStatus(state) {
        const stateEl = document.getElementById('nexo-state');
        const ring = document.getElementById('nexo-status-ring');
        const dot = document.getElementById('nexo-idle-dot');
        const mic = document.getElementById('nexo-mic-icon');

        if (!stateEl) return;
        stateEl.innerText = state;

        if (state === 'Escuchando...' || state === 'Procesando...' || state === 'Hablando...') {
            if (ring) ring.style.display = 'block';
            if (dot) dot.style.display = 'none';
            if (mic) mic.style.display = 'block';
        } else {
            if (!this.isChatOpen) {
                if (ring) ring.style.display = 'none';
                if (dot) dot.style.display = 'block';
                if (mic) mic.style.display = 'none';
            }
        }
    }

    addMessage(texto, tipo) {
        const panel = document.getElementById('nexo-chat-panel');
        const messages = document.getElementById('nexo-messages');
        if (!messages) return;

        // Auto-abrir si llega mensaje
        if (!this.isChatOpen) this.toggleChat();

        const row = document.createElement('div');
        row.className = `msg-row ${tipo}`;
        
        const avatarChar = tipo === 'nexo' ? 'N' : 'T'; // 'T' de Tú
        row.innerHTML = `
            <div class="msg-avatar">${avatarChar}</div>
            <div class="msg-bubble">${texto}</div>
        `;

        messages.appendChild(row);
        messages.scrollTop = messages.scrollHeight;

        while (messages.children.length > this.maxMessages) {
            messages.removeChild(messages.firstChild);
        }
    }

    showTyping() {
        const messages = document.getElementById('nexo-messages');
        if (!messages || document.getElementById('nexo-typing-bubble')) return;

        const row = document.createElement('div');
        row.className = 'msg-row nexo';
        row.id = 'nexo-typing-bubble';
        row.innerHTML = `
            <div class="msg-avatar">N</div>
            <div class="msg-bubble" id="nexo-typing">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;
        messages.appendChild(row);
        messages.scrollTop = messages.scrollHeight;
    }

    hideTyping() {
        const bubble = document.getElementById('nexo-typing-bubble');
        if (bubble) bubble.remove();
    }

    clear() {
        const messages = document.getElementById('nexo-messages');
        if (messages) messages.innerHTML = '';
    }
}
