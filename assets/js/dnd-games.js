// ================================================================
// USCSS NOSTROMO v2.0 — Motor de Minijuegos DnD
// dnd-games.js — Integra 4 minijuegos temáticos con HTML5 DnD API
// ================================================================

'use strict';

/* ================================================================
   DEFINICIÓN DE JUEGOS POR NODO
   ================================================================ */

const DND_GAMES = {

  /* --- ZONA 01: PUENTE DE MANDO ---
     "PANEL DE CONEXIONES DE EMERGENCIA"
     Arrastrar cables de fuentes de energía a nodos de servidor */
  bridge: {
    title: 'PANEL DE CONEXIONES DE EMERGENCIA',
    subtitle: '[MADRE] Conecta las fuentes de energía a los nodos del servidor para restaurar el Active Directory.',
    type: 'cable',
    sources: [
      { id: 'pwr-a', label: 'FUENTE\nPRINCIPAL', icon: '⚡', targets: ['srv-a'], color: '#ff0055' },
      { id: 'pwr-b', label: 'REDUNDANCIA\nUPS',    icon: '🔋', targets: ['srv-b'], color: '#00ccff' },
      { id: 'pwr-c', label: 'EMERGENCIA\nDC',      icon: '⚠', targets: ['net-a'], color: '#ffcc00' },
    ],
    dropZones: [
      { id: 'srv-a',  label: 'SRV-PRIMARY\n(AD DS)',  icon: '🖥',  expects: 'pwr-a' },
      { id: 'srv-b',  label: 'SRV-BACKUP\n(DNS)',     icon: '🖥',  expects: 'pwr-b' },
      { id: 'net-a',  label: 'HUB-RED\n(SWITCH)',     icon: '📡',  expects: 'pwr-c' },
    ],
    damage: 15,
    successMsg: '> ENERGÍA RESTAURADA. NOSTROMO.CORP OPERATIVO.'
  },

  /* --- ZONA 02: LABORATORIO ---
     "TERMINAL DE RECUPERACIÓN — REGISTROS DE ASH"
     Matching de comandos Linux ↔ su función */
  lab: {
    title: 'TERMINAL ASH — RECUPERACIÓN DE REGISTROS',
    subtitle: '[MADRE] Ash encriptó los comandos. Arrastra cada instrucción a su función correcta.',
    type: 'match',
    cards: [
      { id: 'cmd-1', content: '<code>sudo apt-get install postgresql</code>',   matchId: 'def-1' },
      { id: 'cmd-2', content: '<code>systemctl start postgresql</code>',        matchId: 'def-2' },
      { id: 'cmd-3', content: '<code>SELECT * FROM organismos WHERE acido=1;</code>', matchId: 'def-3' },
      { id: 'cmd-4', content: '<code>sudo apt-get update</code>',               matchId: 'def-4' },
    ],
    slots: [
      { id: 'def-1', label: 'INSTALA el motor de base de datos en el sistema',      expects: 'cmd-1' },
      { id: 'def-2', label: 'INICIA el servicio (demonio) de PostgreSQL',           expects: 'cmd-2' },
      { id: 'def-3', label: 'EXTRAE registros de organismos ácidos de la tabla',    expects: 'cmd-3' },
      { id: 'def-4', label: 'ACTUALIZA los repositorios del sistema operativo',     expects: 'cmd-4' },
    ],
    damage: 15,
    successMsg: '> REGISTROS DESCIFRADOS. BASE DE DATOS OPERATIVA.'
  },

  /* --- ZONA 03: COMUNICACIONES ---
     "CONFIGURADOR DE FIREWALL — ESCUDO ELECTROMAGNÉTICO"
     Arrastrar puertos a reglas Allow/Deny Inbound/Outbound */
  comms: {
    title: 'CONFIGURADOR DE FIREWALL — ESCUDO ELECTROMAGNÉTICO',
    subtitle: '[MADRE] Arrastra cada puerto a su regla de Firewall correcta para bloquear a Weyland-Yutani.',
    type: 'match',
    cards: [
      { id: 'port-1', content: 'TCP 443 (HTTPS)',   matchId: 'rule-1' },
      { id: 'port-2', content: 'TCP 22  (SSH)',     matchId: 'rule-2' },
      { id: 'port-3', content: 'TCP 3389 (RDP)',    matchId: 'rule-3' },
      { id: 'port-4', content: 'TCP 80  (HTTP)',    matchId: 'rule-4' },
    ],
    slots: [
      { id: 'rule-1', label: '✅ ALLOW — OUTBOUND (señal S.O.S. encriptada)',   expects: 'port-1' },
      { id: 'rule-2', label: '🚫 DENY  — INBOUND  (acceso remoto Linux W-Y)',   expects: 'port-2' },
      { id: 'rule-3', label: '🚫 DENY  — INBOUND  (escritorio remoto W-Y)',     expects: 'port-3' },
      { id: 'rule-4', label: '⚠ ALLOW — OUTBOUND (tráfico HTTP sin cifrar)',    expects: 'port-4' },
    ],
    damage: 15,
    successMsg: '> FIREWALL CONFIGURADO. SEÑAL S.O.S. TRANSMITIENDO.'
  },

  /* --- ZONA 04: SALA DE MÁQUINAS ---
     "ENSAMBLADOR DE SECUENCIA DE AUTODESTRUCCIÓN"
     Reordenar bloques de script en el orden correcto */
  engines: {
    title: 'ENSAMBLADOR DE SECUENCIA DE PURGA',
    subtitle: '[MADRE] El núcleo colapsa. Ordena los bloques del script antes de que sea demasiado tarde.',
    type: 'sort',
    blocks: [
      { id: 'blk-1', content: '<code>#!/bin/bash<br># Script de autodestrucción NOSTROMO</code>', correctPos: 0 },
      { id: 'blk-2', content: '<code>tar -czvf caja_negra.tar.gz /datos</code><br><span style="font-family:var(--font-body);font-size:0.75rem;opacity:0.6"># Comprimir registros críticos</span>', correctPos: 1 },
      { id: 'blk-3', content: '<code>systemctl stop coolant-primary</code><br><span style="font-family:var(--font-body);font-size:0.75rem;opacity:0.6"># Forzar fallo de refrigeración</span>', correctPos: 2 },
      { id: 'blk-4', content: '<code>kill -9 $(cat /var/run/core.pid)</code><br><span style="font-family:var(--font-body);font-size:0.75rem;opacity:0.6"># Purgar proceso del núcleo</span>', correctPos: 3 },
      { id: 'blk-5', content: '<code>echo "NOSTROMO DESTRUIDA. MISION CUMPLIDA."</code>', correctPos: 4 },
    ],
    damage: 20,
    successMsg: '> SCRIPT ENSAMBLADO. SECUENCIA DE AUTODESTRUCCIÓN INICIADA.'
  }
};

/* ================================================================
   ESTADO DEL JUEGO DnD
   ================================================================ */
let dndState = {
  gameId: null,
  matches: {},      // { slotId: cardId }
  totalSlots: 0,
  correctMatches: 0,
  attempts: 0,
  onSuccess: null,
  onFail: null
};

/* ================================================================
   FUNCIÓN PRINCIPAL — Inicializar juego DnD en un contenedor
   ================================================================ */
let dndPanicInterval = null;
let dndPanicAudio = null;

function startDndPanic() {
  if (dndPanicInterval) return;

  if (typeof AUDIO !== 'undefined' && !AUDIO.muted) {
    dndPanicAudio = new Audio('assets/sounds/alarm.mp3');
    dndPanicAudio.loop = true;
    dndPanicAudio.volume = 0.5;
    dndPanicAudio.play().catch(()=>{});
  }

  dndPanicInterval = setInterval(() => {
    if (typeof oxygen !== 'undefined') {
      const quizModal = document.getElementById('modal-quiz');
      if (quizModal && quizModal.style.display !== 'none') {
         oxygen = Math.max(0, oxygen - 1);
         if (typeof updateO2 === 'function') updateO2();
         if (oxygen <= 0) {
           stopDndPanic();
           if (typeof gameActive !== 'undefined') gameActive = false;
           if (typeof showGameOver === 'function') setTimeout(showGameOver, 800);
         }
      } else {
         stopDndPanic();
      }
    }
  }, 1500);
}

function stopDndPanic() {
  if (dndPanicInterval) {
    clearInterval(dndPanicInterval);
    dndPanicInterval = null;
  }
  if (dndPanicAudio) {
    dndPanicAudio.pause();
    dndPanicAudio.currentTime = 0;
    dndPanicAudio = null;
  }
}

function initDndGame(containerId, nodeId, onSuccess, onFail) {
  const game = DND_GAMES[nodeId];
  if (!game) return;

  dndState = {
    gameId: nodeId,
    matches: {},
    totalSlots: 0,
    correctMatches: 0,
    attempts: 0,
    onSuccess,
    onFail
  };

  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = '';

  if (game.type === 'cable') {
    renderCableGame(container, game);
  } else if (game.type === 'match') {
    renderMatchGame(container, game);
  } else if (game.type === 'sort') {
    renderSortGame(container, game);
  }

}

/* ================================================================
   CABLE ROUTING GAME (Zona 01)
   ================================================================ */
function renderCableGame(container, game) {
  const shuffledSources = [...game.sources].sort(() => Math.random() - 0.5);

  const board = document.createElement('div');
  // Se añade fullscreen-dnd a la clase
  board.className = 'dnd-game-container fullscreen-dnd';

  board.innerHTML = `
    <div class="dnd-game-title">⚡ ${game.title}</div>
    <div class="dnd-game-subtitle">${game.subtitle}</div>
    <div class="dnd-progress-bar"><div class="dnd-progress-fill" id="dnd-progress" style="width:0%"></div></div>
    <div class="cable-game-board" id="cable-board" style="position:relative; z-index:10; height:100%;">
      <div class="cable-column">
        <div class="cable-column-label">◈ FUENTES DE ENERGÍA</div>
        ${shuffledSources.map(s => `
          <div class="cable-node source" 
               id="node-${s.id}" 
               data-id="${s.id}"
               data-color="${s.color || '#00ff41'}">
            <div class="cable-node-icon" style="color:${s.color || '#00ff41'}">${s.icon}</div>
            <div class="cable-node-label">${s.label}</div>
            <!-- Socket dot for visual connection -->
            <div class="cable-socket" style="position:absolute; right:-15px; top:50%; transform:translateY(-50%); width:16px; height:16px; border-radius:50%; background:${s.color || '#00ff41'}; box-shadow:0 0 10px ${s.color || '#00ff41'};"></div>
          </div>
        `).join('')}
      </div>
      <div class="cable-column" style="justify-content:center;padding-top:40px; pointer-events:none;">
        <div style="font-size:2rem;opacity:0.3;letter-spacing:4px">→→→</div>
      </div>
      <div class="cable-column">
        <div class="cable-column-label">◈ NODOS DESTINO</div>
        ${game.dropZones.map(z => `
          <div class="cable-drop-zone" 
               id="zone-${z.id}" 
               data-id="${z.id}"
               data-expects="${z.expects}"
               style="position:relative;">
            <!-- Socket dot -->
            <div class="cable-socket-dest" style="position:absolute; left:-15px; top:50%; transform:translateY(-50%); width:16px; height:16px; border-radius:50%; background:#444; border:2px solid #666;"></div>
            <div class="cable-node-icon">${z.icon}</div>
            <div style="font-size:0.7rem;font-family:var(--font-body);text-align:center;line-height:1.3">${z.label}</div>
          </div>
        `).join('')}
      </div>
    </div>
    <div class="dnd-result" id="dnd-result">
      <div class="dnd-result-icon" id="dnd-result-icon">✅</div>
      <div class="dnd-result-msg" id="dnd-result-msg"></div>
    </div>
  `;

  container.appendChild(board);
  dndState.totalSlots = game.dropZones.length;

  const svgLayer = document.getElementById('dnd-svg-layer');
  if (svgLayer) svgLayer.innerHTML = ''; // clear previous lines

  let isDragging = false;
  let activeLine = null;
  let activeSourceId = null;
  let startX = 0, startY = 0;

  function getCenter(el) {
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  // Bind mouse events for drawing cables
  board.querySelectorAll('.cable-node.source').forEach(node => {
    node.addEventListener('mousedown', e => {
      if (node.dataset.connected === 'true') return;
      isDragging = true;
      activeSourceId = node.dataset.id;
      const color = node.dataset.color || '#00ff41';
      
      const socket = node.querySelector('.cable-socket');
      const center = getCenter(socket);
      startX = center.x;
      startY = center.y;

      activeLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      activeLine.setAttribute('x1', startX);
      activeLine.setAttribute('y1', startY);
      activeLine.setAttribute('x2', e.clientX);
      activeLine.setAttribute('y2', e.clientY);
      activeLine.setAttribute('stroke', color);
      
      if (svgLayer) svgLayer.appendChild(activeLine);
    });
  });

  document.addEventListener('mousemove', e => {
    if (!isDragging || !activeLine) return;
    activeLine.setAttribute('x2', e.clientX);
    activeLine.setAttribute('y2', e.clientY);
  });

  document.addEventListener('mouseup', e => {
    if (!isDragging || !activeLine) return;
    isDragging = false;

    // Detect if mouse is over a drop zone socket
    const dropZones = Array.from(board.querySelectorAll('.cable-drop-zone'));
    let matchedZone = null;
    
    // Check intersection with mouse coords
    for (let zone of dropZones) {
      if (zone.dataset.connected === 'true') continue;
      const rect = zone.getBoundingClientRect();
      // Expand hit area slightly
      if (e.clientX >= rect.left - 30 && e.clientX <= rect.right + 30 &&
          e.clientY >= rect.top - 20 && e.clientY <= rect.bottom + 20) {
        matchedZone = zone;
        break;
      }
    }

    if (matchedZone) {
      const expects = matchedZone.dataset.expects;
      const isCorrect = activeSourceId === expects;

      if (isCorrect) {
        // Snap to center
        const destSocket = matchedZone.querySelector('.cable-socket-dest');
        const endCenter = getCenter(destSocket);
        activeLine.setAttribute('x2', endCenter.x);
        activeLine.setAttribute('y2', endCenter.y);
        
        destSocket.style.background = activeLine.getAttribute('stroke');
        destSocket.style.borderColor = activeLine.getAttribute('stroke');
        destSocket.style.boxShadow = '0 0 10px ' + activeLine.getAttribute('stroke');
        
        matchedZone.dataset.connected = 'true';
        document.getElementById('node-' + activeSourceId).dataset.connected = 'true';
        
        stopDndPanic();
        matchedZone.classList.add('filled');
        dndState.correctMatches++;
        playDndSuccess();
        updateDndProgress();

        if (dndState.correctMatches >= dndState.totalSlots) {
          showDndSuccess(game.successMsg);
        }
      } else {
        // Wrong connection
        activeLine.remove();
        matchedZone.classList.add('wrong-connect');
        setTimeout(() => matchedZone.classList.remove('wrong-connect'), 500);
        playDndError(game.damage);
      }
    } else {
      // Dropped nowhere
      activeLine.remove();
    }
    activeLine = null;
    activeSourceId = null;
  });
}

/* ================================================================
   COMMAND/PORT MATCH GAME (Zona 02 y 03)
   ================================================================ */
function renderMatchGame(container, game) {
  // Shuffle cards
  const shuffled = [...game.cards].sort(() => Math.random() - 0.5);

  const board = document.createElement('div');
  board.className = 'dnd-game-container';

  board.innerHTML = `
    <div class="dnd-game-title">🔌 ${game.title}</div>
    <div class="dnd-game-subtitle">${game.subtitle}</div>
    <div class="dnd-progress-bar"><div class="dnd-progress-fill" id="dnd-progress" style="width:0%"></div></div>
    <div class="match-game-board">
      <div class="match-column">
        <div class="match-column-header">ARRASTRAR →</div>
        <div id="cards-pool">
          ${shuffled.map(c => `
            <div class="match-card"
                 id="card-${c.id}"
                 data-id="${c.id}"
                 data-match="${c.matchId}"
                 draggable="true">
              ${c.content}
            </div>
          `).join('')}
        </div>
      </div>
      <div class="match-column">
        <div class="match-column-header">→ SOLTAR AQUÍ</div>
        ${game.slots.map(s => `
          <div class="match-drop-slot"
               id="slot-${s.id}"
               data-id="${s.id}"
               data-expects="${s.expects}">
            <span class="match-slot-label">${s.label}</span>
          </div>
        `).join('')}
      </div>
    </div>
    <div class="dnd-result" id="dnd-result">
      <div class="dnd-result-icon" id="dnd-result-icon">✅</div>
      <div class="dnd-result-msg" id="dnd-result-msg"></div>
    </div>
  `;

  container.appendChild(board);
  dndState.totalSlots = game.slots.length;

  board.querySelectorAll('.match-card').forEach(card => {
    card.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', card.dataset.id);
      card.classList.add('dragging');
      setTimeout(() => card.classList.remove('dragging'), 0);
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
  });

  board.querySelectorAll('.match-drop-slot').forEach(slot => {
    slot.addEventListener('dragover', e => { e.preventDefault(); slot.classList.add('drag-over'); });
    slot.addEventListener('dragleave', () => slot.classList.remove('drag-over'));
    slot.addEventListener('drop', e => {
      e.preventDefault();
      slot.classList.remove('drag-over');
      const cardId = e.dataTransfer.getData('text/plain');
      handleMatchDrop(cardId, slot, game);
    });
  });
}

function handleMatchDrop(cardId, slotEl, game) {
  if (slotEl.classList.contains('correct')) return; // Ya resuelto
  dndState.attempts++;
  updateAttempts();

  const expects = slotEl.dataset.expects;
  const isCorrect = cardId === expects;

  if (isCorrect) {
    stopDndPanic();
    const cardEl = document.getElementById('card-' + cardId);
    slotEl.classList.add('correct');
    slotEl.innerHTML = cardEl ? cardEl.innerHTML : '✓';
    if (cardEl) { cardEl.classList.add('matched'); cardEl.setAttribute('draggable', 'false'); }
    dndState.matches[slotEl.dataset.id] = cardId;
    dndState.correctMatches++;
    playDndSuccess();
    updateDndProgress();

    if (dndState.correctMatches >= dndState.totalSlots) {
      showDndSuccess(game.successMsg);
    }
  } else {
    slotEl.classList.add('wrong');
    setTimeout(() => slotEl.classList.remove('wrong'), 500);
    playDndError(game.damage);
  }
}

/* ================================================================
   SORT / SCRIPT ASSEMBLY GAME (Zona 04)
   ================================================================ */
function renderSortGame(container, game) {
  const shuffled = [...game.blocks].sort(() => Math.random() - 0.5);

  const board = document.createElement('div');
  board.className = 'dnd-game-container';

  board.innerHTML = `
    <div class="dnd-game-title">⚙ ${game.title}</div>
    <div class="dnd-game-subtitle">${game.subtitle}</div>
    <div class="dnd-progress-bar"><div class="dnd-progress-fill" id="dnd-progress" style="width:0%"></div></div>
    <div class="script-game-board">
      <div class="script-pool">
        <div class="script-pool-label">BLOQUES<br>DISPONIBLES</div>
        ${shuffled.map(b => `
          <div class="script-block"
               id="blk-${b.id}"
               data-id="${b.id}"
               data-correct="${b.correctPos}"
               draggable="true">
            <span class="block-num">#${shuffled.indexOf(b)+1}</span>
            <span>${b.content}</span>
          </div>
        `).join('')}
      </div>
      <div class="script-target">
        <div class="script-target-label">SCRIPT<br>ENSAMBLADO</div>
        ${game.blocks.map((_, i) => `
          <div class="script-drop-slot"
               id="sortslot-${i}"
               data-pos="${i}"
               data-expects="${game.blocks.find(b => b.correctPos === i)?.id || ''}">
            LÍNEA ${i + 1} — arrastra aquí
          </div>
        `).join('')}
      </div>
    </div>
    <div class="dnd-result" id="dnd-result">
      <div class="dnd-result-icon" id="dnd-result-icon">✅</div>
      <div class="dnd-result-msg" id="dnd-result-msg"></div>
    </div>
  `;

  container.appendChild(board);
  dndState.totalSlots = game.blocks.length;

  board.querySelectorAll('.script-block').forEach(blk => {
    blk.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', blk.dataset.id);
      blk.classList.add('dragging');
      setTimeout(() => blk.classList.remove('dragging'), 0);
    });
    blk.addEventListener('dragend', () => blk.classList.remove('dragging'));
  });

  board.querySelectorAll('.script-drop-slot').forEach(slot => {
    slot.addEventListener('dragover', e => { e.preventDefault(); slot.classList.add('drag-over'); });
    slot.addEventListener('dragleave', () => slot.classList.remove('drag-over'));
    slot.addEventListener('drop', e => {
      e.preventDefault();
      slot.classList.remove('drag-over');
      const blkId = e.dataTransfer.getData('text/plain');
      handleSortDrop(blkId, slot, game);
    });
  });
}

function handleSortDrop(blockId, slotEl, game) {
  if (slotEl.classList.contains('correct')) return;
  dndState.attempts++;
  updateAttempts();

  const expects = slotEl.dataset.expects;
  const isCorrect = blockId === expects;

  if (isCorrect) {
    stopDndPanic();
    const blkEl = document.getElementById('blk-' + blockId);
    slotEl.classList.add('correct');
    slotEl.innerHTML = blkEl ? blkEl.innerHTML : '✓';
    if (blkEl) { blkEl.classList.add('placed'); blkEl.setAttribute('draggable', 'false'); }
    dndState.matches[slotEl.dataset.pos] = blockId;
    dndState.correctMatches++;
    playDndSuccess();
    updateDndProgress();

    if (dndState.correctMatches >= dndState.totalSlots) {
      showDndSuccess(game.successMsg);
    }
  } else {
    slotEl.classList.add('wrong');
    setTimeout(() => slotEl.classList.remove('wrong'), 500);
    playDndError(game.damage);
  }
}

/* ================================================================
   HELPERS — Audio, Progreso, Resultado
   ================================================================ */
function playDndSuccess() {
  if (typeof AUDIO !== 'undefined' && !AUDIO.muted) {
    const s = new Audio('assets/sounds/check.mp3');
    s.volume = 0.8;
    s.play().catch(() => {});
  }
  // Estabilizar sistema al acertar
  stopDndPanic();
}

function playDndError(damage) {
  // Iniciar pánico: alarma continua y drenaje de oxígeno
  startDndPanic();

  if (typeof takeDamage === 'function') {
    takeDamage(damage, 'CONEXIÓN INCORRECTA — El organismo avanza por los conductos.');
  }
}

function updateDndProgress() {
  const fill = document.getElementById('dnd-progress');
  if (fill && dndState.totalSlots > 0) {
    fill.style.width = ((dndState.correctMatches / dndState.totalSlots) * 100) + '%';
  }
}

function updateAttempts() {
  if (typeof window._sessionAttempts !== 'undefined') {
    window._sessionAttempts = (window._sessionAttempts || 0) + 1;
  }
}

function showDndSuccess(msg) {
  const result = document.getElementById('dnd-result');
  const icon   = document.getElementById('dnd-result-icon');
  const msgEl  = document.getElementById('dnd-result-msg');

  if (result) {
    result.classList.add('show');
    if (icon)  icon.textContent  = '✅';
    if (msgEl) { msgEl.textContent = msg; msgEl.className = 'dnd-result-msg'; }
  }

  setTimeout(() => {
    if (typeof dndState.onSuccess === 'function') dndState.onSuccess();
  }, 1400);
}
