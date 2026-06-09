// ================================================================
// USCSS NOSTROMO v2.0 — Motor Principal de Juego
// v2-app.js — Orquestador de cinemáticas, credenciales, DnD, endings
// ================================================================
// FLUJO: audioPrompt → cinematic → credentialScreen → boot → mapa
//        → nodo: [lectura → faseSelect → práctica / minijuegoDnD]
//        → ending: good(Narcissus) | bad(xenomorfo+CRT)
// ================================================================

'use strict';

/* ================================================================
   ESTADO GLOBAL v2
   ================================================================ */
window._playerName     = '';
window._sessionDocId   = null;
window._sessionAttempts = 0;
window._sessionStart   = null;
window._docRead        = false;  // Si el PDF fue "leído"
window._videoWatched   = false;  // Si el video fue visto
window._currentNodeId  = null;   // ID del nodo actual para DnD

// Texto cinemático para el slide 3 (MADRE terminal)
const MADRE_INTRO_TEXT =
`> USCSS NOSTROMO — CARGUERO COMERCIAL CLASE M
> MATRÍCULA: 180924609 — COMPAÑÍA WEYLAND-YUTANI
> POSICIÓN: LV-426 — SECTOR ZETA-II — SISTEMA ZETA RETICULI

> COMUNICACIÓN ENCRIPTADA NIVEL OMEGA.
> ACCESO RESTRINGIDO — PERSONAL AUTORIZADO ÚNICAMENTE.

MU/TH/UR 6000: Sistema de A.I. de vuelo principal en línea.
Los servidores físicos sobrevivieron al evento de impacto.
El sistema operativo fue eliminado por sobrecalentamiento.

Las compuertas de ventilación están abiertas.
El organismo de origen desconocido ha abordado la nave.

DIRECTIVA ACTIVA: Restaurar infraestructura de TI.
Instalar Windows Server. Configurar dominio seguro.
Completar todos los módulos antes del agotamiento de O₂.

Tripulante — tu misión empieza ahora.`;

/* ================================================================
   DATOS DE DOCUMENTOS POR NODO
   (PDFs se cargan desde assets/docs/ — si no existen, HTML fallback)
   ================================================================ */
const NODE_DOCS = {
  bridge: {
    title: 'MANUAL_DESPLIEGUE_W-Y_01.pdf',
    pdfPath: '',
    learnMoreUrl: 'https://ieeexplore.ieee.org/document/6823453',
    learnMoreText: '¿Quieres aprender más? — IEEE Xplore: Infraestructura TI en Centros de Datos (ANSI/TIA-942)',
    summary: [
      'Windows Server 2022 requiere mínimo 512 MB RAM y 32 GB de almacenamiento.',
      'El Active Directory Domain Services (AD DS) centraliza la autenticación de usuarios.',
      'Un dominio FQDN define la estructura jerárquica de la red (ej. nostromo.corp).',
      'La función DNS es crítica — sin resolución de nombres, el dominio no opera.',
      'Las Políticas de Grupo (GPO) controlan la configuración de todos los equipos del dominio.',
    ]
  },
  lab: {
    title: 'MANUAL_POSTGRESQL_ASH_02.pdf',
    pdfPath: '',
    learnMoreUrl: 'https://www.postgresql.org/docs/current/',
    learnMoreText: '¿Quieres aprender más? — Documentación oficial PostgreSQL + IEEE: Gestión de Bases de Datos',
    summary: [
      'PostgreSQL es un SGBD relacional de código abierto con conformidad ACID.',
      'El comando apt-get install postgresql instala el motor en distribuciones Debian/Ubuntu.',
      'systemctl start postgresql inicia el servicio de base de datos como demonio del sistema.',
      'Las consultas SQL permiten recuperar, insertar, actualizar y eliminar datos.',
      'La redundancia en BD se logra con réplicas de streaming y respaldos periódicos.',
    ]
  },
  comms: {
    title: 'MANUAL_FIREWALL_COMMS_03.pdf',
    pdfPath: '',
    learnMoreUrl: 'https://ieeexplore.ieee.org/document/7876269',
    learnMoreText: '¿Quieres aprender más? — IEEE: Seguridad en Redes y Configuración de Firewalls',
    summary: [
      'Un Firewall filtra tráfico de red basándose en reglas de Allow/Deny por puerto y protocolo.',
      'El puerto 443 (HTTPS) es el estándar para comunicaciones web cifradas con TLS/SSL.',
      'El puerto 22 (SSH) permite administración remota segura de servidores Linux.',
      'El puerto 3389 (RDP) es el escritorio remoto de Windows — debe restringirse por defecto.',
      'Las reglas Inbound controlan tráfico entrante; Outbound controla tráfico saliente.',
    ]
  },
  engines: {
    title: 'MANUAL_SCRIPTS_MOTORES_04.pdf',
    pdfPath: '',
    learnMoreUrl: 'https://ieeexplore.ieee.org/document/9382481',
    learnMoreText: '¿Quieres aprender más? — IEEE: Automatización con Bash/PowerShell en Infraestructura',
    summary: [
      'Los scripts Bash (Linux) y PowerShell (Windows) automatizan tareas de administración.',
      'El shebang #!/bin/bash indica al sistema el intérprete a usar para el script.',
      'tar -czvf comprime archivos: c=crear, z=gzip, v=verbose, f=nombre del archivo.',
      'systemctl stop [servicio] detiene un proceso del sistema de forma ordenada.',
      'kill -9 fuerza la terminación inmediata de un proceso por su PID.',
    ]
  }
};

/* ================================================================
   CINEMÁTICA INTRODUCTORIA
   ================================================================ */
let _cinSlide = 1;
let _cinTimer = null;
let _cinTypingTimer = null;
let _cinTypingAudio = null;

let _madreShown = false;

function initCinematic() {
  const intro = document.getElementById('cinematic-intro');
  const video1 = document.getElementById('cin-video');
  const video2 = document.getElementById('cin-video-2');
  
  if (!intro || !video1) {
    skipCinematic();
    return;
  }
  intro.classList.remove('hidden');
  
  // Ocultar scanlines y boot durante cinemática para evitar conflicto GPU con videos
  const scanlines = document.querySelector('.scanlines-global');
  const sceneBoot = document.getElementById('scene-boot');
  if (scanlines) scanlines.style.display = 'none';
  if (sceneBoot) sceneBoot.style.display = 'none';
  
  _madreShown = false;
  
  // 1. Reproducir video inicial
  if (typeof AUDIO !== 'undefined' && AUDIO.muted) {
    video1.muted = true;
  }
  
  const playPromise = video1.play();
  if (playPromise !== undefined) {
    playPromise.catch(e => {
      console.error("Video 1 bloqueado por autoplay:", e);
      skipCinematic();
    });
  }

  // --- LOGICA DE RENDERIZADO CANVAS ---
  const canvas = document.getElementById('cin-canvas');
  const ctx = canvas ? canvas.getContext('2d') : null;
  let drawFrameId;
  let activeVideo = video1;

  function drawVideoFrame() {
    if (!ctx || !activeVideo) return;
    if (!activeVideo.paused && !activeVideo.ended) {
      if (canvas.width !== activeVideo.videoWidth && activeVideo.videoWidth > 0) {
        canvas.width = activeVideo.videoWidth;
        canvas.height = activeVideo.videoHeight;
      }
      ctx.drawImage(activeVideo, 0, 0, canvas.width, canvas.height);
    }
    window._cinDrawFrameId = requestAnimationFrame(drawVideoFrame);
  }
  
  // Iniciar loop para el video 1
  drawVideoFrame();

  video1.onended = () => {
    const bridgeScene = document.getElementById('cin-bridge-scene');
    if (!bridgeScene) { skipCinematic(); return; }
    
    bridgeScene.classList.remove('hidden');
    video1.classList.add('hidden');
    
    if (typeof AUDIO !== 'undefined' && !AUDIO.muted) {
      AUDIO.play('bridge_ambient', 'assets/sounds/audio-parte-2.mp3', { loop: false, volume: 1.0 });
    }
    
    typeMadreTerminal(MADRE_INTRO_TEXT, () => {
      _cinTimer = setTimeout(() => {
        if (typeof AUDIO !== 'undefined') AUDIO.stop('bridge_ambient');
        bridgeScene.classList.add('hidden');
        
        if (!video2) { skipCinematic(); return; }
        
        // Cambiar canvas para dibujar el video 2
        if (canvas && ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          activeVideo = video2;
          canvas.style.zIndex = '6'; // Mover canvas encima de la terminal
        }

        video2.classList.remove('hidden');
        if (typeof AUDIO !== 'undefined' && AUDIO.muted) {
          video2.muted = true;
        }
        
        const playProm2 = video2.play();
        if (playProm2 !== undefined) {
          playProm2.catch(() => skipCinematic());
        }
        
        let credentialsShown = false;
        video2.ontimeupdate = () => {
          if (video2.currentTime >= 32 && !credentialsShown) {
            credentialsShown = true;
            
            const credScreen = document.getElementById('credential-screen');
            if (credScreen) {
              credScreen.style.zIndex = '20000';
              showCredentialScreen();
              
              const skipBar = document.querySelector('.cin-skip-bar');
              if (skipBar) skipBar.classList.add('hidden');
            }
          }
        };
        
        video2.onended = () => {
          if (!credentialsShown) skipCinematic();
        };
        
      }, 1000);
    });
  };
}

function typeMadreTerminal(text, callback) {
  const el = document.getElementById('cin-terminal-text');
  if (!el) { if (callback) callback(); return; }

  const cursor = document.getElementById('cin-typing-cursor');
  el.innerHTML = '';
  if (cursor) el.appendChild(cursor);

  const lines = text.split('\n');
  let li = 0, ci = 0;
  let textContent = '';

  function tick() {
    if (li >= lines.length) {
      if (callback) callback();
      return;
    }
    const line = lines[li];
    if (ci < line.length) {
      textContent += line[ci];
      ci++;
      el.innerHTML = textContent + '<span id="cin-typing-cursor" class="cin-cursor">_</span>';
    } else {
      textContent += '\n';
      li++; ci = 0;
    }
    _cinTypingTimer = setTimeout(tick, ci === 1 ? 30 : 18);
  }
  tick();
}

window.skipCinematic = function() {
  if (_cinTimer)      clearTimeout(_cinTimer);
  if (_cinTypingTimer) clearTimeout(_cinTypingTimer);
  
  // Detener el loop del canvas globalmente
  if (window._cinDrawFrameId) {
    cancelAnimationFrame(window._cinDrawFrameId);
  }
  
  if (typeof AUDIO !== 'undefined') {
    AUDIO.stop('bridge_ambient');
  }
  if (typeof _cinTypingAudio !== 'undefined' && _cinTypingAudio) {
    _cinTypingAudio.pause();
    _cinTypingAudio.currentTime = 0;
  }
  
  const video = document.getElementById('cin-video');
  if (video) {
    video.pause();
    video.currentTime = 0;
  }
  
  const video2 = document.getElementById('cin-video-2');
  if (video2) {
    video2.pause();
    video2.currentTime = 0;
  }
  
  const intro = document.getElementById('cinematic-intro');
  if (intro) {
    intro.style.opacity = '0';
    intro.style.transition = 'opacity 0.6s ease';
    setTimeout(() => {
      intro.classList.add('hidden');
      intro.style.opacity = '';
      intro.style.transition = '';
      // Restaurar scanlines y boot que se ocultaron durante cinemática
      const scanlines = document.querySelector('.scanlines-global');
      const sceneBoot = document.getElementById('scene-boot');
      if (scanlines) scanlines.style.display = '';
      if (sceneBoot) sceneBoot.style.display = '';
      showCredentialScreen();
    }, 600);
  } else {
    const scanlines = document.querySelector('.scanlines-global');
    const sceneBoot = document.getElementById('scene-boot');
    if (scanlines) scanlines.style.display = '';
    if (sceneBoot) sceneBoot.style.display = '';
    showCredentialScreen();
  }
};

/* ================================================================
   PANTALLA DE CREDENCIALES
   ================================================================ */
function showCredentialScreen() {
  const screen = document.getElementById('credential-screen');
  if (!screen) { window.showScene('boot'); startBoot(); return; }
  screen.classList.add('active');

  // Animar texto de terminal ya está en el HTML, pero podemos re-asegurar focus
  setTimeout(() => {
    const input = document.getElementById('cred-name-input');
    if (input) input.focus();
  }, 300);

  // Enter para confirmar
  const input = document.getElementById('cred-name-input');
  if (input) {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') submitCredentials();
    });
  }
}

window.submitCredentials = async function() {
  const input  = document.getElementById('cred-name-input');
  const errEl  = document.getElementById('cred-error');
  const btn    = document.getElementById('cred-submit-btn');

  const correo = (input?.value || '').trim().toLowerCase();

  // Validar que no este vacio
  if (!correo || correo.length < 5) {
    showCredError('CREDENCIALES INVALIDAS — Ingresa tu correo institucional');
    return;
  }

  // Validar formato de correo electronico basico
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(correo)) {
    showCredError('FORMATO INVALIDO — Ej: usuario@institucion.edu');
    return;
  }

  btn.disabled = true;
  btn.textContent = '[ CONECTANDO CON MU/TH/UR... ]';
  if (errEl) errEl.textContent = '';

  // Delay para Firebase
  await new Promise(r => setTimeout(r, 700));

  let isReturning = false;

  if (window.firebaseRegisterPlayer) {
    const result = await window.firebaseRegisterPlayer(correo);
    if (!result.ok) {
      btn.disabled = false;
      btn.textContent = '[ CONFIRMAR ACCESO — SISTEMA NOSTROMO ]';
      showCredError(result.error || 'ERROR DE ACCESO — Intenta de nuevo');
      return;
    }
    window._sessionDocId = result.docId;
    isReturning = result.isReturning || false;
  }

  // Detener el audio del video de fondo si sigue reproduciendose
  const video2 = document.getElementById('cin-video-2');
  if (video2) {
    video2.pause();
    video2.currentTime = 0;
  }
  const video1 = document.getElementById('cin-video');
  if (video1) {
    video1.pause();
    video1.currentTime = 0;
  }

  // Mostrar solo el prefijo del correo (antes del @) en el HUD
  const displayName = correo.split('@')[0].toUpperCase();
  window._playerName    = displayName;
  window._playerEmail   = correo;
  window._sessionStart  = Date.now();
  window._sessionAttempts = 0;

  // Actualizar HUD con el nombre
  const hudName = document.getElementById('hud-player-name');
  const hudSec  = document.getElementById('hud-player-section');
  if (hudName) hudName.textContent = displayName;
  if (hudSec)  hudSec.style.display = '';

  // Si es usuario que regresa: mostrar mensaje de bienvenida especial
  if (isReturning) {
    btn.textContent = '[ ACCESO CONCEDIDO \u2713 ]';
    btn.style.borderColor = 'var(--c-green)';
    btn.style.color = 'var(--c-green)';
    // Pausa rapida
    await new Promise(r => setTimeout(r, 600));
  } else {
    btn.textContent = '[ REGISTRO CONFIRMADO \u2713 ]';
    await new Promise(r => setTimeout(r, 400));
  }

  // Transicion suave
  const screen = document.getElementById('credential-screen');
  if (screen) {
    screen.style.opacity = '0';
    screen.style.transition = 'opacity 0.5s ease';
    
    // Ocultar de una vez la cinematica para no estorbar el juego
    const intro = document.getElementById('cinematic-intro');
    if (intro) intro.classList.add('hidden');
    
    setTimeout(() => {
      screen.classList.remove('active');
      screen.style.opacity = '';
      screen.style.transition = '';
      btn.style.borderColor = '';
      btn.style.color = '';
      btn.disabled = false;
      btn.textContent = '[ CONFIRMAR ACCESO — SISTEMA NOSTROMO ]';
    }, 500);
  } else {
    const intro = document.getElementById('cinematic-intro');
    if (intro) intro.classList.add('hidden');
  }

  // Iniciar boot
  window.showScene('boot');
  if (typeof startBoot === 'function') startBoot();
};


function showCredError(msg) {
  const errEl = document.getElementById('cred-error');
  if (errEl) {
    errEl.textContent = '⚠ ' + msg;
    errEl.style.animation = 'none';
    requestAnimationFrame(() => { errEl.style.animation = ''; });
  }
  // Flash rojo en el input
  const input = document.getElementById('cred-name-input');
  if (input) {
    input.style.borderBottomColor = 'var(--c-red)';
    setTimeout(() => { input.style.borderBottomColor = ''; }, 1500);
    input.focus();
  }
}

/* ================================================================
   INTERCEPTOR DE AUDIO PROMPT → CINEMÁTICA
   (reemplaza las funciones originales de app.js)
   ================================================================ */
window.startWithAudio = function() {
  const prompt = document.getElementById('audio-prompt');
  if (prompt) {
    prompt.style.opacity = '0';
    prompt.style.transition = 'opacity 0.4s';
    setTimeout(() => { prompt.style.display = 'none'; }, 400);
  }
  if (typeof AUDIO !== 'undefined') AUDIO.muted = false;
  initCinematic();
};

window.startWithoutAudio = function() {
  const prompt = document.getElementById('audio-prompt');
  if (prompt) {
    prompt.style.opacity = '0';
    prompt.style.transition = 'opacity 0.4s';
    setTimeout(() => { prompt.style.display = 'none'; }, 400);
  }
  if (typeof AUDIO !== 'undefined') AUDIO.muted = true;
  initCinematic();
};

/* ================================================================
   INTERCEPTOR DE enterNode — NUEVA LÓGICA DE FASE A (Lectura)
   Sobreescribe la función original de app.js para cambiar el flujo
   ================================================================ */
const _originalEnterNode = window.enterNode;
window.enterNode = function(node) {
  window._currentNodeId = typeof node === 'string' ? node : node.id;
  window._docRead = false;
  window._videoWatched = false;

  // Llamar original para configurar la escena
  if (typeof _originalEnterNode === 'function') {
    _originalEnterNode(node);
  }

  // Luego SOBREESCRIBIR los controles para nueva lógica
  // (typeScreen del original llama renderControls al terminar)
  // Lo hacemos con un pequeño delay para que typeScreen termine primero
  // La función renderControls del original mostrará los botones
  // pero nosotros necesitamos que solo aparezca UN botón: "LEER MANUAL"
};

/* Override de renderControls para Fase A solamente */
const _originalRenderControls = window.renderControls;
window.renderControls = function(actions) {
  // Si estamos en la fase de llegada al nodo (sin practice ni quiz abierto),
  // reemplazar por el nuevo botón de lectura
  const overlay = document.getElementById('modal-practice');
  const overlayQuiz = document.getElementById('modal-quiz');
  const practiceVisible = overlay && overlay.style.display !== 'none';
  const quizVisible = overlayQuiz && overlayQuiz.style.display !== 'none';

  if (practiceVisible || quizVisible) {
    // Usar el sistema original
    _originalRenderControls(actions);
    return;
  }

  // Encontrar el nodo activo actual
  let activeNode = window._currentNodeRef || window.currentNode;
  if (!activeNode && window._currentNodeId && typeof GUION !== 'undefined' && GUION.nodes) {
    activeNode = GUION.nodes[window._currentNodeId];
  }

  // Detectar si es la fase de llegada (tiene acción de "leer doc")
  const hasDoc = actions.some(a => a.label && (a.label.includes('LEER') || a.label.includes('MANUAL')));
  if (hasDoc && activeNode) {
    // Mostrar SOLO el botón de leer manual
    renderV2DocButton(activeNode);
    return;
  }

  // En cualquier otro caso (success, quiz intro, etc.) usar el original
  _originalRenderControls(actions);
};

function renderV2DocButton(node) {
  const ctrl = document.getElementById('node-controls');
  if (!ctrl) return;
  ctrl.innerHTML = '';

  // Botón 1: LEER MANUAL
  const btnDoc = document.createElement('button');
  btnDoc.innerHTML = `📁 LEER ${node.docTitle || 'MANUAL DE DESPLIEGUE'}`;
  btnDoc.addEventListener('click', () => openDocV2(node));
  ctrl.appendChild(btnDoc);

  // Botón 2: INICIAR VERIFICACIÓN DE PROTOCOLOS (abre modal de selección)
  const btnVerif = document.createElement('button');
  btnVerif.className = 'primary';
  btnVerif.innerHTML = '[ INICIAR VERIFICACIÓN DE PROTOCOLOS ]';
  btnVerif.addEventListener('click', () => {
    window._currentNodeRef = node;
    showPhaseSelectModal(node);
  });
  ctrl.appendChild(btnVerif);
}

/* ================================================================
   VISOR DOCUMENTAL v2 — Resumen + PDF + Video + Info
   ================================================================ */
window.openDocV2 = function openDocV2(node) {
  // El documento inicia bloqueado hasta que se abra el archivo completo o se salte la teoría

  const docData = NODE_DOCS[node.id] || {};
  const overlay = document.getElementById('modal-doc');
  const summaryList = document.getElementById('doc-summary-list');
  const pdfFilename = document.getElementById('doc-pdf-filename');
  const learnText   = document.getElementById('doc-learn-more-text');
  const videoBtn    = document.getElementById('btn-open-video');
  const videoLock   = document.getElementById('doc-video-lock-status');
  const unlockDot   = document.getElementById('doc-unlock-dot');
  const unlockMsg   = document.getElementById('doc-unlock-msg');
  const pdfBtn      = document.getElementById('btn-open-pdf');

  if (!overlay) return;

  // Título
  const titleEl = document.getElementById('modal-doc-title');
  if (titleEl) titleEl.textContent = docData.title || node.docTitle || 'MANUAL CLASIFICADO';

  // Nombre del archivo
  if (pdfFilename) pdfFilename.textContent = docData.title || 'MANUAL_W-Y.pdf';

  // Resumen
  if (summaryList) {
    const points = docData.summary || [];
    summaryList.innerHTML = points.map(p => `<li>${p}</li>`).join('');
  }

  // Link de aprender más
  if (learnText) {
    if (docData.learnMoreUrl) {
      learnText.innerHTML = `${docData.learnMoreText || 'Documentación técnica IEEE'} →`;
    }
  }

  // Estado inicial: video deshabilitado
  if (videoBtn) videoBtn.disabled = !window._docRead;
  if (videoLock) videoLock.textContent = window._docRead ? '▶ DISPONIBLE' : '🔒 LEE EL DOCUMENTO PRIMERO';
  if (unlockDot) unlockDot.className = 'doc-unlock-dot' + (window._docRead ? ' unlocked' : '');
  if (unlockMsg) unlockMsg.textContent = window._docRead
    ? '✓ Documento leído — Video desbloqueado'
    : 'Abre el documento para desbloquear el video de referencia';

  // Body oculto (para IEEE patch)
  const body = document.getElementById('modal-doc-body');
  if (body) body.innerHTML = node.docContent || '';

  // Guardar nodo actual
  window._currentDocNode = node;

  // Sonido
  if (typeof AUDIO !== 'undefined' && !AUDIO.muted) {
    const s = new Audio('assets/sounds/efecto-manual.mp3');
    s.volume = 0.8; s.play().catch(() => {});
  }

  overlay.style.display = 'flex';
};

// Override openDoc original
const _originalOpenDoc = window.openDoc;
window.openDoc = function(node) {
  openDocV2(node);
};

window.openLearnMore = function() {
  const docData = NODE_DOCS[window._currentDocNode?.id] || {};
  if (docData.learnMoreUrl) {
    window.open(docData.learnMoreUrl, '_blank');
  }
};

window.openVideoFromDoc = function() {
  if (!window._currentDocNode) return;
  closeDoc();
  openVideoModal(window._currentDocNode.id);
};

/* ================================================================
   MODAL PDF — Abrir con iframe o fallback HTML
   ================================================================ */
window.openPdfModal = function() {
  const node = window._currentDocNode;
  if (!node) return;
  const docData = NODE_DOCS[node.id] || {};

  const pdfPath = docData.pdfPath || '';
  if (pdfPath && (pdfPath.startsWith('http://') || pdfPath.startsWith('https://'))) {
    window.open(pdfPath, '_blank');
    unlockVideoAfterRead();
    return;
  }

  const modal = document.getElementById('modal-pdf');
  const iframe = document.getElementById('pdf-iframe');
  const fallback = document.getElementById('pdf-fallback-content');
  const fallbackBody = document.getElementById('pdf-fallback-body');
  const titleEl = document.getElementById('pdf-modal-title');
  const sentinelEl = document.getElementById('pdf-scroll-sentinel');

  if (!modal) return;
  if (titleEl) titleEl.textContent = docData.title || 'MANUAL_W-Y.pdf';

  const isLocal = window.location.protocol === 'file:';
  const pdfExists = pdfPath !== '' && !isLocal;

  if (pdfExists) {
    // Usar viewer de Google Docs para PDFs (no requiere plugin)
    if (iframe) {
      iframe.src = `https://docs.google.com/viewer?url=${encodeURIComponent(window.location.origin + '/' + pdfPath)}&embedded=true`;
      iframe.style.display = 'block';
    }
    if (fallback) fallback.style.display = 'none';

    // Desbloquear video tras 8 segundos de "lectura" (simulado para PDFs)
    setTimeout(() => unlockVideoAfterRead(), 8000);
  } else {
    // Fallback: mostrar contenido HTML del nodo como documento
    if (iframe) iframe.style.display = 'none';
    if (fallback) fallback.style.display = 'flex';
    if (fallbackBody) {
      fallbackBody.innerHTML = node.docContent || `
        <div style="padding:20px;font-family:Share Tech Mono,monospace;font-size:0.88rem;line-height:1.8;color:rgba(0,255,65,0.7);">
        <div style="color:rgba(255,176,0,0.6);font-size:0.75rem;letter-spacing:3px;margin-bottom:16px;">
        ARCHIVO: ${docData.title || 'MANUAL_W-Y.pdf'} — PENDIENTE DE CARGA<br>
        Sube el PDF a assets/docs/ para activar el visor completo.<br>
        Mientras tanto, consulta el resumen ejecutivo.
        </div>
        ${(docData.summary || []).map((p, i) => `
          <div style="margin-bottom:14px;padding-left:20px;position:relative;">
            <span style="position:absolute;left:0;color:rgba(255,176,0,0.5);">${String(i+1).padStart(2,'0')}.</span>
            ${p}
          </div>
        `).join('')}
        </div>
      `;
    }

    // IntersectionObserver en el sentinel
    if (sentinelEl && fallback) {
      const obs = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting) {
          obs.disconnect();
          unlockVideoAfterRead();
        }
      }, { root: fallback, threshold: 0.5 });
      obs.observe(sentinelEl);

      // También desbloquear tras 5s de lectura (fallback time-based)
      setTimeout(() => unlockVideoAfterRead(), 5000);
    }
  }

  modal.classList.add('active');
};

function unlockVideoAfterRead() {
  if (window._docRead) return; // Ya desbloqueado
  window._docRead = true;

  // Actualizar botón de video en modal doc
  const videoBtn  = document.getElementById('btn-open-video');
  const videoLock = document.getElementById('doc-video-lock-status');
  const unlockDot = document.getElementById('doc-unlock-dot');
  const unlockMsg = document.getElementById('doc-unlock-msg');

  if (videoBtn)  videoBtn.disabled = false;
  if (videoLock) videoLock.textContent = '▶ DISPONIBLE';
  if (unlockDot) unlockDot.className = 'doc-unlock-dot unlocked';
  if (unlockMsg) unlockMsg.textContent = '✓ Documento leído — Video desbloqueado';

  // Pequeño flash en el botón
  if (videoBtn) {
    videoBtn.style.borderColor = 'var(--c-green)';
    videoBtn.style.boxShadow = '0 0 20px rgba(0,255,65,0.3)';
    setTimeout(() => { videoBtn.style.borderColor = ''; videoBtn.style.boxShadow = ''; }, 2000);
  }
}

window.closePdfModal = function() {
  const modal = document.getElementById('modal-pdf');
  const iframe = document.getElementById('pdf-iframe');
  if (modal) modal.classList.remove('active');
  if (iframe) iframe.src = '';
};

/* ================================================================
   MODAL SELECCIÓN DE FASE (después de leer doc)
   ================================================================ */
function showPhaseSelectModal(node) {
  closeDoc();
  const modal = document.getElementById('modal-phase-select');
  const title = document.getElementById('phase-select-title');
  const o2El  = document.getElementById('phase-o2-val');

  if (title) title.textContent = 'SELECCIONAR PROTOCOLO — ' + node.title;
  if (o2El)  o2El.textContent = (typeof oxygen !== 'undefined' ? oxygen : 100) + '%';

  window._currentNodeRef = node;
  if (modal) modal.style.display = 'flex';
}

window.closePhaseSelect = function() {
  const modal = document.getElementById('modal-phase-select');
  if (modal) modal.style.display = 'none';
};

window.startPracticeFromModal = function() {
  closePhaseSelect();
  if (window._currentNodeRef && typeof startFaseB === 'function') {
    startFaseB(window._currentNodeRef, 0);
  }
};

window.startQuizFromModal = function() {
  closePhaseSelect();
  if (window._currentNodeRef) {
    launchDndGame(window._currentNodeRef);
  }
};

/* ================================================================
   INTERCEPTOR CONTROLS — closeDoc → selector de fase después de leer
   ================================================================ */

// Cuando el usuario cierra el doc y quiere proceder:
// Se muestra el modal de selección de fase
window.closeDoc = function() {
  if (typeof AUDIO !== 'undefined' && !AUDIO.muted) {
    const s = new Audio('assets/sounds/botones.mp3');
    s.volume = 0.9; s.play().catch(() => {});
  }
  if (typeof currentDocAudio !== 'undefined' && currentDocAudio) {
    currentDocAudio.pause(); currentDocAudio.currentTime = 0; currentDocAudio = null;
  }
  const overlay = document.getElementById('modal-doc');
  if (overlay) overlay.style.display = 'none';

  // Mostrar selector de fase si hay un nodo activo
  if (window.currentNode && window._docRead) {
    setTimeout(() => showPhaseSelectModal(window.currentNode), 200);
  } else if (window.currentNode && !window._docRead) {
    // No leyó el doc — mostrar solo práctica (sin minijuego)
    setTimeout(() => showPhaseSelectModal(window.currentNode), 200);
  }
};

/* ================================================================
   MOTOR DnD — Integración con "Protocolo de Verificación"
   ================================================================ */
function launchDndGame(node) {
  const modal   = document.getElementById('modal-quiz');
  const mount   = document.getElementById('dnd-game-mount');
  const labelEl = document.getElementById('quiz-label');
  const timerWrap = document.getElementById('quiz-timer-wrap');
  const progressBar = document.getElementById('quiz-progress-bar');

  if (!modal || !mount) return;

  // Configurar header
  if (labelEl) labelEl.textContent = '⚡ PROTOCOLO DE VERIFICACIÓN — ' + node.title;
  if (timerWrap) timerWrap.style.display = 'none'; // No timer en DnD
  if (progressBar) progressBar.style.width = '0%';

  mount.innerHTML = '';
  modal.style.display = 'flex';

  // Inicializar el minijuego DnD correspondiente
  const gameMap = { bridge: 'bridge', lab: 'lab', comms: 'comms', engines: 'engines' };
  const gameId = gameMap[node.id];

  if (gameId && typeof initDndGame === 'function') {
    mount.id = 'dnd-game-mount'; // asegurar ID
    initDndGame('dnd-game-mount', gameId,
      () => dndGameSuccess(node),  // onSuccess
      () => {}                      // onFail (manejado internamente con takeDamage)
    );
  } else {
    // Fallback: usar quiz original
    if (typeof openQuiz === 'function') {
      modal.style.display = 'none';
      openQuiz(node);
    }
  }
}

function dndGameSuccess(node) {
  // Cerrar modal quiz
  const modal = document.getElementById('modal-quiz');
  if (modal) modal.style.display = 'none';

  // Actualizar intentos en Firebase
  window._sessionAttempts += (window._sessionAttempts || 0);
  syncFirebaseSession();

  // Llamar al éxito del nodo
  if (typeof nodeSuccess === 'function') nodeSuccess(node);
}

function syncFirebaseSession() {
  if (!window._sessionDocId || !window.firebaseUpdateSession) return;
  const attempts = window._sessionAttempts || 0;
  const o2 = typeof oxygen !== 'undefined' ? oxygen : 100;
  const score = o2 / 10;
  window.firebaseUpdateSession(window._sessionDocId, {
    total_attempts: attempts,
    calificacion: parseFloat(score.toFixed(1)),
    oxigeno_restante: o2,
    max_score: parseFloat(score.toFixed(1)),
  });
}

/* ================================================================
   SKILL 5: XENOMORFO — Jumpscare mejorado
   ================================================================ */
const _originalShowGameOver = window.showGameOver;
window.showGameOver = function() {
  if (typeof AUDIO !== 'undefined') AUDIO.stopAll();
  if (typeof clearQuizTimer === 'function') clearQuizTimer();

  // Cerrar cualquier modal abierto
  ['modal-doc','modal-pdf','modal-practice','modal-quiz','modal-video'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  // Omitir el jumpscare del xenomorfo y mostrar directamente el final con el video
  launchBadEnding();
};

function launchXenomorphJumpscare() {
  const modal = document.getElementById('xenomorph-modal');
  if (!modal) {
    launchBadEnding();
    return;
  }

  // Audio de terror
  if (typeof AUDIO !== 'undefined' && !AUDIO.muted) {
    const scare = new Audio('assets/sounds/alarm.mp3');
    scare.volume = 1.0;
    scare.play().catch(() => {});
    setTimeout(() => { try { scare.pause(); } catch(e) {} }, 3000);
  }

  modal.classList.add('active');

  // Texto de jumpscare
  const textEl = document.getElementById('xeno-text');
  const countdown = document.getElementById('xeno-countdown');
  const messages = [
    'EL ORGANISMO\nTE HA ENCONTRADO',
    'SOPORTE VITAL\nAGOTADO',
    'LA NOSTROMO\nCAERÁ...'
  ];

  let msgIdx = 0;
  const msgInterval = setInterval(() => {
    msgIdx = (msgIdx + 1) % messages.length;
    if (textEl) textEl.innerHTML = messages[msgIdx].replace('\n', '<br>');
  }, 800);

  // Countdown a bad ending
  let count = 4;
  const countInterval = setInterval(() => {
    count--;
    if (countdown) countdown.textContent = count > 0 ? count + '...' : '';
    if (count <= 0) {
      clearInterval(countInterval);
      clearInterval(msgInterval);
    }
  }, 1000);

  // Transición a bad ending
  setTimeout(() => {
    modal.style.opacity = '0';
    modal.style.transition = 'opacity 0.5s ease';
    setTimeout(() => {
      modal.classList.remove('active');
      modal.style.opacity = '';
      modal.style.transition = '';
      launchBadEnding();
    }, 500);
  }, 4500);

  // Firebase: registrar game over
  setTimeout(() => {
    if (window._sessionDocId && window.firebaseFinalizeSession) {
      window.firebaseFinalizeSession(window._sessionDocId, {
        calificacion: 0,
        oxigeno_restante: 0,
        status: 'game_over',
        total_attempts: window._sessionAttempts || 0
      });
    }
  }, 1000);
}

/* ================================================================
   SKILL 6: BAD ENDING — Perspectiva del gato / CRT estática
   ================================================================ */
function launchBadEnding() {
  const screen = document.getElementById('bad-ending-screen');
  if (!screen) { location.reload(); return; }

  let bgVideo = document.getElementById('v2-bad-bg-video');
  if (!bgVideo) {
    bgVideo = document.createElement('video');
    bgVideo.id = 'v2-bad-bg-video';
    bgVideo.style.position = 'absolute';
    bgVideo.style.top = '0';
    bgVideo.style.left = '0';
    bgVideo.style.width = '100%';
    bgVideo.style.height = '100%';
    bgVideo.style.objectFit = 'cover';
    bgVideo.style.zIndex = '0';
    bgVideo.style.opacity = '0.6';
    bgVideo.style.pointerEvents = 'none';
    bgVideo.autoplay = true;
    bgVideo.loop = true;
    bgVideo.muted = true;
    bgVideo.playsInline = true;
    screen.insertBefore(bgVideo, screen.firstChild);
  }

  let videoSrc = 'assets/img/FONDO.mp4'; // default
  if (window._currentNodeId === 'bridge') videoSrc = 'assets/img/PERDISTE 1.mp4';
  else if (window._currentNodeId === 'lab') videoSrc = 'assets/img/PERDISTE 2.mp4';
  else if (window._currentNodeId === 'comms') videoSrc = 'assets/img/PERDISTE 3.mp4';
  else if (window._currentNodeId === 'engines') videoSrc = 'assets/img/PERDISTE 4.mp4';
  
  bgVideo.src = videoSrc;

  screen.classList.add('active');

  const textEl = document.getElementById('bad-end-text');
  const staticEl = document.getElementById('bad-static');
  const restartBtn = document.getElementById('bad-restart-btn');

  const badEndNarrative = `> REGISTRO FINAL — CÁMARA 7-B — CONDUCTO DE VENTILACIÓN D-4

El gato Jonesy observa desde la oscuridad.
Sus pupilas se dilatan ante la penumbra de los pasillos.

Los pasos se detienen. Silencio.

Luego... el sonido.
El organismo emerge de las sombras.

Uno a uno, la tripulación de la Nostromo
desaparece en la oscuridad del carguero.

Los sistemas de TI permanecen apagados.
La misión ha fallado.

> WEYLAND-YUTANI CORP — OBJETIVO ESPECIAL 937:
> Recuperar organismo. Tripulación: prescindible.
> EJECUTADO.

La Nostromo derive en silencio hacia las estrellas.
Solo Jonesy sobrevive.

---
CALIFICACIÓN FINAL: 0.0 / 10
ESTADO: MISIÓN FALLIDA — GAME OVER`;

  // Fondo oscuro primero
  setTimeout(() => {
    if (typeof AUDIO !== 'undefined' && !AUDIO.muted) {
      const s = new Audio('assets/sounds/game-over.mp3');
      s.volume = 0.7; s.play().catch(() => {});
    }

    let charIdx = 0;
    const chars = badEndNarrative.split('');
    const typeInterval = setInterval(() => {
      if (charIdx >= chars.length) {
        clearInterval(typeInterval);
        // Mostrar estática total
        setTimeout(() => {
          if (staticEl) staticEl.classList.add('show');
          setTimeout(() => {
            if (staticEl) staticEl.classList.remove('show');
            if (restartBtn) restartBtn.style.display = 'block';
          }, 2500);
        }, 1500);
        return;
      }
      if (textEl) textEl.textContent += chars[charIdx];
      charIdx++;
    }, 28);
  }, 500);
}

/* ================================================================
   SKILL 6: GOOD ENDING — Escape en la Narcissus + Reporte Firebase
   ================================================================ */
const _originalShowEnding = window.showEnding;
window.showEnding = function() {
  // Cerrar todo
  ['modal-doc','modal-pdf','modal-practice','modal-quiz','modal-video','modal-phase-select'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  // Ir a la cinemática de good ending
  launchGoodEnding();
};

function launchGoodEnding() {
  const screen = document.getElementById('good-ending-screen');
  if (!screen) {
    // Fallback al ending original
    if (typeof _originalShowEnding === 'function') _originalShowEnding();
    return;
  }

  screen.classList.add('active');

  if (typeof AUDIO !== 'undefined' && !AUDIO.muted) {
    const s = new Audio('assets/sounds/victoria.mp3');
    s.volume = 0.9; s.play().catch(() => {});
  }

  const textEl       = document.getElementById('good-end-text');
  const reportCard   = document.getElementById('mission-report');
  const rptName      = document.getElementById('rpt-name');
  const rptGrade     = document.getElementById('rpt-grade');
  const rptO2        = document.getElementById('rpt-o2');
  const rptModules   = document.getElementById('rpt-modules');
  const rptTime      = document.getElementById('rpt-time');
  const rptAttempts  = document.getElementById('rpt-attempts');
  const restartBtn   = document.getElementById('good-restart-btn');

  // Calcular métricas finales
  const o2Final      = typeof oxygen !== 'undefined' ? oxygen : 100;
  const gradeVal     = Math.max(0, Math.min(10, o2Final / 10));
  const completedCnt = typeof completedNodes !== 'undefined' ? completedNodes.length : 4;
  const elapsed      = window._sessionStart ? Math.floor((Date.now() - window._sessionStart) / 1000) : 0;
  const elapsedStr   = `${String(Math.floor(elapsed/60)).padStart(2,'0')}:${String(elapsed%60).padStart(2,'0')}`;
  const attempts     = window._sessionAttempts || 0;
  const playerName   = window._playerName || 'TRIPULANTE';

  const goodEndNarrative =
`> SISTEMA OPERATIVO — RESTAURADO.
> DOMINIO NOSTROMO.CORP — ACTIVO.
> SECUENCIA DE ESCAPE INICIADA.

${playerName}, has completado la misión.

La cápsula Narcissus se separa de la Nostromo
a las 22:14:06, hora estelar.

A través de la ventana, las estrellas se expanden.
La Nostromo se achica en el horizonte.

Jonesy duerme en su jaula.
La capitana activa el criosueño.

Señal S.O.S. transmitida al cuadro de luz
de la constelación Orión.

La infraestructura sobrevivió.
La misión fue un éxito.

> REPORTE DE MISIÓN — TRANSMITIDO.`;

  let charIdx = 0;
  const chars = goodEndNarrative.split('');
  const typeInterval = setInterval(() => {
    if (charIdx >= chars.length) {
      clearInterval(typeInterval);
      // Mostrar reporte Firebase
      setTimeout(() => {
        if (rptName)    rptName.textContent    = playerName;
        if (rptGrade)   rptGrade.textContent   = gradeVal.toFixed(1) + ' / 10';
        if (rptO2)      rptO2.textContent       = o2Final + '%';
        if (rptModules) rptModules.textContent  = completedCnt + ' / 4';
        if (rptTime)    rptTime.textContent     = elapsedStr;
        if (rptAttempts) rptAttempts.textContent = attempts;

        if (reportCard) reportCard.classList.add('show');
        setTimeout(() => {
          if (restartBtn) restartBtn.style.display = 'block';
        }, 800);

        // Firebase: finalizar sesión con victoría
        if (window._sessionDocId && window.firebaseFinalizeSession) {
          window.firebaseFinalizeSession(window._sessionDocId, {
            calificacion: parseFloat(gradeVal.toFixed(1)),
            oxigeno_restante: o2Final,
            total_attempts: attempts,
            max_score: parseFloat(gradeVal.toFixed(1)),
            success_rate: Math.round((completedCnt / 4) * 100),
            status: 'completed'
          });
        }
      }, 800);
      return;
    }
    if (textEl) textEl.textContent += chars[charIdx];
    charIdx++;
  }, 22);
}

/* ================================================================
   FIX GRADE PREVIEW — Separar valor y denominador
   ================================================================ */
const _originalUpdateGradePreview = window.updateGradePreview;
window.updateGradePreview = function() {
  const el = document.getElementById('grade-preview');
  if (!el) return;

  const o2 = typeof oxygen !== 'undefined' ? oxygen : 100;
  const val = o2 / 10;

  const valEl = document.getElementById('grade-val');
  if (valEl) {
    valEl.textContent = val.toFixed(1);
  } else {
    // Fallback: usa dos spans
    el.innerHTML = `<span id="grade-val">${val.toFixed(1)}</span><span>&nbsp;/&nbsp;10</span>`;
  }

  const color = val >= 8 ? 'var(--c-green)' : val >= 6 ? 'var(--c-gold)' : 'var(--c-red)';
  const shadowRgb = val >= 8 ? '0,255,65' : val >= 6 ? '255,186,8' : '255,0,60';

  el.style.color = '#ffffff';
  el.style.textShadow = `0 0 10px ${color}, 0 0 20px ${color}`;
  
  const wrapper = el.closest('.grade-preview-wrapper');
  if (wrapper) {
    wrapper.style.borderColor = color;
    wrapper.style.boxShadow = `0 0 15px rgba(${shadowRgb}, 0.15) inset`;
    
    // El seudoelemento ::before no se puede modificar directamente en style, 
    // pero podemos inyectar un estilo inline o usar una variable CSS.
    wrapper.style.setProperty('--c-grade', color);
  }
};

/* ================================================================
   REWRITE typeInto — Fast forward support & leak prevention
   ================================================================ */
let _typeIntoRef = null;
window.typeInto = function(el, text, callback, useHtml, speed) {
  if (!el) { if(callback) callback(); return; }
  if (_typeIntoRef) { clearTimeout(_typeIntoRef); _typeIntoRef = null; }
  
  el.innerHTML = '';
  const parts = text.split('\n');
  let partIdx = 0, charIdx = 0;
  
  function nextTick() {
    if (!document.contains(el) && el.id !== 'boot-text' && el.id !== 'ending-text') {
      return; // Stop if element removed
    }
    
    // Si se activó acelerar, imprimir todo el texto que falta de golpe
    if (el.id === 'boot-text' && window._bootAccelerated) {
      if (useHtml) {
        el.innerHTML = text.replace(/\n/g, '<br>');
      } else {
        el.textContent = text;
      }
      if (callback) callback();
      return;
    }
    
    if (partIdx >= parts.length) {
      if (callback) callback();
      return;
    }
    
    let chars = 1;
    let delay = 25;
    
    if (el.id === 'boot-text') {
      chars = (partIdx === 0) ? 1 : 2;
      delay = (partIdx === 0) ? 75 : 8;
    } else if (el.id === 'ending-text') {
      delay = 45;
    }
    
    if (speed !== undefined) delay = speed;
    
    let lineStr = parts[partIdx];
    let toAdd = lineStr.substring(charIdx, charIdx + chars);
    
    if (useHtml) {
      el.innerHTML += toAdd;
    } else {
      el.appendChild(document.createTextNode(toAdd));
    }
    
    charIdx += chars;
    
    if (charIdx >= lineStr.length) {
      partIdx++;
      charIdx = 0;
      if (partIdx < parts.length) {
        if (useHtml) el.innerHTML += '<br>';
        else el.appendChild(document.createElement('br'));
      }
    }
    
    _typeIntoRef = setTimeout(nextTick, delay);
  }
  
  nextTick();
};

/* ================================================================
   INIT — DOMContentLoaded
   ================================================================ */
document.addEventListener('DOMContentLoaded', () => {
  // Ocultar escenas que no deben estar visibles al inicio
  const bootScene = document.getElementById('scene-boot');
  if (bootScene) {
    bootScene.classList.remove('active');
    bootScene.style.display = 'none';
  }

  // O2 inicial
  if (typeof updateO2 === 'function') updateO2();

  // Grade preview inicial
  if (typeof window.updateGradePreview === 'function') window.updateGradePreview();

  // El audio prompt ya está visible por CSS/HTML
  // No necesitamos hacer nada más aquí
  console.log('[USCSS NOSTROMO v2.0] Sistema inicializado. Esperando credenciales de tripulante...');
});

/* ================================================================
   UTILIDAD: Formatear tiempo
   ================================================================ */
function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

/* ================================================================
   EXPORTAR funciones globales necesarias
   ================================================================ */
window.openDocV2 = openDocV2;
window.unlockVideoAfterRead = unlockVideoAfterRead;
window.launchDndGame = launchDndGame;
window.launchGoodEnding = launchGoodEnding;
window.launchBadEnding = launchBadEnding;
window.launchXenomorphJumpscare = launchXenomorphJumpscare;

/* ================================================================
   V2 OVERRIDES FOR MODALS (REPLAY MANUAL & SKIP PRACTICE)
   ================================================================ */
window.reopenDoc = function() {
  const practiceOverlay = document.getElementById('modal-practice');
  if (practiceOverlay) practiceOverlay.style.display = 'none';
  const quizOverlay = document.getElementById('modal-quiz');
  if (quizOverlay) quizOverlay.style.display = 'none';

  if (window.currentNode) {
    openDocV2(window.currentNode);
  } else if (window._currentDocNode) {
    openDocV2(window._currentDocNode);
  }
};

window.skipPractice = function() {
  const overlay = document.getElementById('modal-practice');
  if (overlay) overlay.style.display = 'none';
  const node = window.currentNode || window._currentNodeRef || window._currentDocNode;
  if (node) {
    showPhaseSelectModal(node);
  }
};

window.skipTheory = function() {
  window._docRead = true;
  if (typeof unlockVideoAfterRead === 'function') unlockVideoAfterRead();
  if (typeof AUDIO !== 'undefined' && !AUDIO.muted) {
    const s = new Audio('assets/sounds/botones.mp3');
    s.volume = 0.9; s.play().catch(() => {});
  }
  closeDoc();
  const node = window.currentNode || window._currentNodeRef || window._currentDocNode;
  if (node) {
    setTimeout(() => showPhaseSelectModal(node), 200);
  }
};
