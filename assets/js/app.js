// ============================================================
// USCSS NOSTROMO — Paisaje de Aprendizaje
// app.js — compatible con index.html rediseñado
// ============================================================

'use strict';

// ============================================================
// SISTEMA DE AUDIO CENTRALIZADO — Solo 1 audio a la vez
// ============================================================

const AUDIO = {
  muted: false,
  current: null,       // Audio que suena actualmente
  currentId: null,     // ID del audio actual ('boot', 'map', 'sfx')
  _wasPlayingId: null, // Para mute/unmute

  // Detiene cualquier audio que esté sonando
  stopAll() {
    if (this.current) {
      this.current.pause();
      this.current.currentTime = 0;
    }
    this.current = null;
    this.currentId = null;
  },

  // Reproduce un audio (detiene el anterior primero)
  play(id, src, opts) {
    if (this.muted) return;
    this.stopAll();
    const audio = new Audio(src);
    audio.loop   = opts && opts.loop  || false;
    audio.volume = opts && opts.volume || 0.5;
    audio.play().catch(() => {});
    this.current   = audio;
    this.currentId = id;
    return audio;
  },

  // Detiene un audio específico (solo si es el actual)
  stop(id) {
    if (this.currentId === id || !id) {
      this.stopAll();
    }
  },

  // Pausa sin resetear posición (para mute)
  pauseCurrent() {
    if (this.current && !this.current.paused) {
      this.current.pause();
    }
  },

  // Reanuda el audio pausado
  resumeCurrent() {
    if (this.current && this.current.paused && !this.muted) {
      this.current.play().catch(() => {});
    }
  },

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) {
      this._wasPlayingId = (this.current && !this.current.paused) ? this.currentId : null;
      this.pauseCurrent();
      if (typeof currentDocAudio !== 'undefined' && currentDocAudio) currentDocAudio.pause();
    } else {
      if (this._wasPlayingId && this.current) {
        this.resumeCurrent();
      }
    }
    const btn = document.getElementById('audio-toggle-btn');
    if (btn) btn.textContent = this.muted ? '🔇 SIN AUDIO' : '🔊 AUDIO';
  }
};


// --- ESTADO GLOBAL ---
let oxygen = 100;
let gameActive = true;
let currentNode = null;
let completedNodes = [];
let lastDocContent = null;
let lastDocTitle = null;
let currentDocAudio = null;

// Control de animación de boot
let bootSkipped = false;
let TYPE_SPEED_ACTIVE = 1;
const TYPE_SPEED = 1;

// ============================================================
// VIDEOS DE REFERENCIA POR NODO
// Reemplaza el valor de 'youtubeId' con el ID real del video.
// Ejemplo: si la URL es https://www.youtube.com/watch?v=dQw4w9WgXcQ
// entonces youtubeId = 'dQw4w9WgXcQ'
// ============================================================
const NODE_VIDEOS = {
  bridge: {
    youtubeId: 'P0YuVZj3ny0',  // <-- Video de instalación Windows Server
    title: 'TRANSMISION INTERCEPTADA — INSTALACION WINDOWS SERVER',
    subtitle: 'Referencia técnica clasificada W-Y · Ver antes de proceder'
  },
  lab: {
    youtubeId: '2HjPb9xT8sI',    // <-- ID del video de instalación Ubuntu Server
    title: 'TRANSMISION INTERCEPTADA — INSTALACION UBUNTU SERVER',
    subtitle: 'Diario recuperado de Ash · Ver antes de proceder'
  }
};

// --- CONTENIDO DEL GUIÓN ---
const GUION = {
  boot:
    "> TRANSMISIÓN ENCRIPTADA — INICIANDO CONEXIÓN SEGURA...\n" +
    "> ORIGEN: USCSS NOSTROMO — CARGUERO COMERCIAL CLASE M.\n" +
    "> DESTINO: RED DE MANDO WEYLAND-YUTANI (LA TIERRA).\n" +
    "> FECHA ESTELAR: 2122.06.03\n" +
    "> ESTADO DE LA NAVE: DERIVA ORBITAL / SISTEMAS LÓGICOS CAÍDOS.\n" +
    "> CÓDIGO DE ALERTA: CUARENTENA BIOLÓGICA ROTA.\n\n" +
    "[REPORTE AUTOMATIZADO — MU/TH/UR 6000]\n\n" +
    "La Nostromo remolcaba 20 millones de toneladas de mineral.\n" +
    "La Orden Especial 937 fue activada:\n\n" +
    "  \"Prioridad Uno. Asegurar retorno del organismo. Tripulación prescindible\".\n\n" +
    "El organismo está a bordo. El oficial Ash intentó purgar mis registros,\n" +
    "provocando el colapso de la infraestructura de datos.\n" +
    "El soporte vital disminuirá un 15% por cada error crítico.\n\n" +
    "> IDENTIFICADOR REASIGNADO: DE AHORA EN ADELANTE OPERO COMO \"MADRE\".\n" +
    "> ESPERANDO INTERVENCIÓN DEL TRIPULANTE...",

  nodes: {
    bridge: {
      id: 'bridge', num: '01', theme: 'node-theme-bridge',
      title: '01: PUENTE DE MANDO',
      visorImg: 'assets/img/zones/bridge_thumb.svg',
      visorLabel: 'CAMARA — PUENTE',
      madreStatus: 'MODULO DE WINDOWS SERVER',
      hasVideo: true,
      objectives: [
        'Instalar Windows Server con Desktop Experience',
        'Configurar particionado de discos (C: / D:)',
        'Instalar y promover Active Directory (AD DS)'
      ],
      arrival:
        "> ACCESO A TERMINAL SECUNDARIA CONCEDIDO.\n" +
        "> ALERTA: INTEGRIDAD DEL CASCO AL 88%.\n" +
        "> DETECTANDO PRESENCIA EN EL PUENTE DE MANDO.\n\n" +
        "[MADRE] El panel principal está inoperativo.\n" +
        "Los servidores físicos sobrevivieron pero el SO fue eliminado.\n" +
        "Las compuertas de ventilación están abiertas.\n\n" +
        "Directiva: instalen Windows Server y configuren un dominio seguro.\n" +
        "He desencriptado el MANUAL_DESPLIEGUE_W-Y. Asimílenlo antes de proceder.",
      docTitle: 'MANUAL_DESPLIEGUE_W-Y.pdf',
      docContent:
        '<h3>EDICIONES Y ENTORNOS</h3>' +
        '<p><b>Windows Server Standard</b>: ideal para entornos de baja densidad.<br>' +
        '<b>Datacenter</b>: para alta virtualización. Para gestión visual rápida en emergencias,' +
        ' seleccione siempre <b>Desktop Experience (UI)</b> — nunca Server Core.</p>' +
        '<h3>PARTICIONADO DE DISCOS</h3>' +
        '<p>El SO (<b>Unidad C:</b>) debe instalarse en una partición separada' +
        ' de los Datos y Registros Críticos (<b>Unidad D:</b>).</p>' +
        '<h3>ACTIVE DIRECTORY (AD DS)</h3>' +
        '<p>Centraliza la seguridad y gestión de usuarios.<br>' +
        '<div class="highlight">Pasos críticos:<br>' +
        '1. Agregar Rol <b>AD DS</b> desde el <b>Administrador del Servidor</b>.<br>' +
        '2. <b>Promover el servidor a Controlador de Dominio</b> asignando un nombre de bosque raíz.</div></p>',
      faseB: [
        {
          text:
            "> INICIANDO SECUENCIA DE INSTALACIÓN DESDE UNIDAD ÓPTICA DE EMERGENCIA...\n" +
            "> PASO 1: La urgencia requiere configuración rápida mediante paneles visuales.\n\n" +
            "[MADRE] Seleccione el entorno operativo correcto para este servidor:",
          options: [
            { text: '> Windows Server Core (Terminal)', correct: false, msg: 'Tiempo insuficiente para gestión por terminal. Revise el manual.' },
            { text: '> Windows Server (Desktop Experience)', correct: true },
            { text: '> Windows Server Nano', correct: false, msg: 'Nano no tiene entorno de gestión visual. Revise el manual.' }
          ]
        },
        {
          text:
            "> NUCLEO LOGICO EN LINEA. RECONOCIENDO INTERFAZ GRAFICA.\n" +
            "> PASO 2: La red no tiene autenticacion. El organismo puede acceder.\n\n" +
            "[MADRE] ¿Qué acción ejecutar primero en el Server Manager?",
          options: [
            { text: '> Crear usuario administrador', correct: false, msg: 'Primero se agrega el rol. Revise el manual.' },
            { text: '> Agregar roles y características → AD DS', correct: true },
            { text: '> Configurar Firewall de Windows', correct: false, msg: 'El firewall no instala Active Directory. Revise el manual.' }
          ]
        },
        {
          text:
            "> ROL INSTALADO. EL SERVIDOR REQUIERE AUTORIDAD SOBRE LA RED.\n" +
            "> PASO 3: Ejecute la promocion para finalizar el entorno de confianza.\n\n" +
            "[MADRE] Al promover el servidor a Controlador de Dominio,\n" +
            "¿qué nombre de bosque raíz debe ingresar?",
          options: [
            { text: '> WORKGROUP', correct: false, msg: 'WORKGROUP no es un dominio válido. Revise el manual.' },
            { text: '> NOSTROMO.CORP', correct: true },
            { text: '> NOSTROMO', correct: false, msg: 'Sin extensión de dominio no es un bosque raíz. Revise el manual.' }
          ]
        }
      ],
      quizIntro:
        "> PROCESANDO DOMINIO NOSTROMO.CORP...\n" +
        "> VERIFICANDO REGLAS DE SEGURIDAD...\n" +
        "> ALERTA DE PROXIMIDAD: CONTACTO INMINENTE EN LA PUERTA PRINCIPAL.\n\n" +
        "[MADRE] Para sellar las compuertas responda el protocolo de verificación.\n" +
        "CADA FALLO RESTA 15% DE OXIGENO.",
      quiz: [
        {
          q: 'Q1: ¿Qué instalación de Windows Server permite gestión visual rápida?',
          options: [
            { text: '> Server Core (Terminal)', correct: false, msg: 'Tiempo insuficiente para gestión por terminal. Revise el manual.' },
            { text: '> Desktop Experience (UI)', correct: true },
            { text: '> Windows Server Nano', correct: false, msg: 'Nano no tiene entorno visual. Revise el manual.' }
          ]
        },
        {
          q: 'Q2: ¿Qué unidad debe contener el Sistema Operativo?',
          options: [
            { text: '> Unidad D:', correct: false, msg: 'Los datos van en D:, el OS en C:. Revise el manual.' },
            { text: '> Unidad C:', correct: true },
            { text: '> Unidad E:', correct: false, msg: 'Unidad no reconocida. Revise el manual.' }
          ]
        },
        {
          q: 'Q3: ¿Cuál es el paso FINAL para activar Active Directory?',
          options: [
            { text: '> Agregar el rol AD DS', correct: false, msg: 'Agregar el rol es el primer paso. Revise el manual.' },
            { text: '> Configurar el firewall', correct: false, msg: 'El firewall es otra capa. Revise el manual.' },
            { text: '> Promover el servidor a Controlador de Dominio', correct: true }
          ]
        }
      ],
      quizDamage: 15,
      useTimer: false,
      success:
        "> COMPUERTAS SELLADAS. PUENTE DE MANDO ASEGURADO.\n" +
        "> ACCESO CONCEDIDO AL SECTOR MEDICO / LABORATORIO CIENTIFICO.\n" +
        "> PRECAUCION: El Laboratorio opera bajo arquitectura de codigo abierto.",
      nextNode: 'lab',
      nextLabel: '[ ACCEDER AL LABORATORIO CIENTIFICO ]'
    },

    lab: {
      id: 'lab', num: '02', theme: 'node-theme-lab',
      title: '02: LABORATORIO CIENTIFICO',
      visorImg: 'assets/img/lab_acid.gif',
      visorLabel: 'CAMARA — LABORATORIO',
      madreStatus: 'MODULO DE LINUX SERVER',
      hasVideo: true,
      objectives: [
        'Instalar Ubuntu Server CLI (sin GUI)',
        'Instalar PostgreSQL con apt-get',
        'Iniciar el servicio con systemctl'
      ],
      arrival:
        "> INICIANDO DESCENSO AL SECTOR MEDICO Y LABORATORIO DE CUARENTENA.\n" +
        "> ADVERTENCIA: Brecha de contencion biologica detectada.\n" +
        "> ESTADO: Servidor de datos biologicos destruido — PH altamente acido.\n\n" +
        "[MADRE] Los fluidos del organismo han derretido el hardware del servidor principal.\n" +
        "He recuperado los apuntes tecnicos del oficial Ash antes de su desactivacion.\n\n" +
        "Para leerlos deben instalar un Servidor Linux y levantar el motor de base de datos.\n" +
        "Lean el DIARIO_ASH.log antes de proceder.",
      docTitle: 'DIARIO_ASH.log',
      docContent:
        '<h3>INSTALACION</h3>' +
        '<p>Para entornos sin recursos, usar distribuciones <b>Core/Server sin GUI</b>' +
        ' (como <b>Ubuntu Server</b>). Ahorra CPU y RAM.</p>' +
        '<h3>GESTION DE PAQUETES</h3>' +
        '<p>Para instalar el motor de datos en sistemas Debian/Ubuntu:<br>' +
        '<code>sudo apt-get install postgresql</code></p>' +
        '<h3>SERVICIOS</h3>' +
        '<p>Para arrancar el demonio de la base de datos:<br>' +
        '<code>systemctl start postgresql</code></p>' +
        '<h3>CONSULTAS SQL</h3>' +
        '<p>Sintaxis de extraccion rapida:<br>' +
        '<code>SELECT [columna] FROM [tabla] WHERE [condicion];</code></p>',
      faseB: [
        {
          text:
            "> INICIANDO MODO DE RECUPERACION MANUAL.\n" +
            "> PASO 1: Seleccione la arquitectura del SO para este entorno de bajos recursos.\n\n" +
            "[MADRE] ¿Qué versión de Linux instala para maximizar los recursos disponibles?",
          options: [
            { text: '> Ubuntu Desktop GUI', correct: false, msg: 'La GUI consume recursos innecesarios. Revise el diario.' },
            { text: '> Ubuntu Server CLI (Consola)', correct: true },
            { text: '> Windows Server Core', correct: false, msg: 'No es Linux. Revise el diario.' }
          ]
        },
        {
          text:
            "> INSTALACION BASE COMPLETADA. MODO CONSOLA ACTIVO.\n" +
            "> PASO 2: Ingrese el comando para instalar el motor de base de datos.\n\n" +
            "[MADRE] Extraido de los registros de Ash. ¿Cuál es el comando correcto?",
          options: [
            { text: '> sudo apt-get install postgresql', correct: true },
            { text: '> systemctl start postgresql', correct: false, msg: 'systemctl inicia el servicio, no lo instala. Revise el diario.' },
            { text: '> apt remove postgresql', correct: false, msg: 'apt remove desinstala. Revise el diario.' }
          ]
        }
      ],
      quizIntro:
        "> SERVICIO POSTGRESQL EN LINEA. ACCEDIENDO A TABLA VULNERABILIDADES.\n" +
        "> EXTRACCION EXITOSA. VULNERABILIDAD DEL ESPECIMEN: ALTAS TEMPERATURAS.\n" +
        "> ALERTA: MOVIMIENTO MASIVO DETECTADO EN LOS CONDUCTOS DE AIRE.\n\n" +
        "[MADRE] El sistema de la esclusa requiere validacion de conocimientos.\n" +
        "CADA FALLO RESTA 15% DE OXIGENO.",
      quiz: [
        {
          q: 'Q1: ¿Qué distribución de Linux es óptima para servidores con pocos recursos?',
          options: [
            { text: '> Ubuntu Desktop GUI', correct: false, msg: 'La GUI consume recursos innecesarios. Revise el diario.' },
            { text: '> Ubuntu Server CLI', correct: true },
            { text: '> Windows Server Core', correct: false, msg: 'No es Linux. Revise el diario.' }
          ]
        },
        {
          q: 'Q2: ¿Qué comando instala PostgreSQL en Ubuntu Server?',
          options: [
            { text: '> systemctl start postgresql', correct: false, msg: 'systemctl inicia el servicio, no lo instala. Revise el diario.' },
            { text: '> sudo apt-get install postgresql', correct: true },
            { text: '> apt remove postgresql', correct: false, msg: 'Ese comando desinstala. Revise el diario.' }
          ]
        },
        {
          q: 'Q3: ¿Qué comando arranca el demonio de PostgreSQL?',
          options: [
            { text: '> sudo apt-get install postgresql', correct: false, msg: 'Ese instala, no arranca. Revise el diario.' },
            { text: '> SELECT * FROM tabla;', correct: false, msg: 'Eso es SQL, no un comando de sistema. Revise el diario.' },
            { text: '> systemctl start postgresql', correct: true }
          ]
        }
      ],
      quizDamage: 15,
      useTimer: false,
      success:
        "> ESCLUSA BLOQUEADA. ESPECIMEN CONTENIDO TEMPORALMENTE.\n" +
        "> ACCESO CONCEDIDO A LA SALA DE COMUNICACIONES.",
      nextNode: 'comms',
      nextLabel: '[ ACCEDER A SALA DE COMUNICACIONES ]'
    },

    comms: {
      id: 'comms', num: '03', theme: 'node-theme-comms',
      title: '03: SALA DE COMUNICACIONES',
      visorImg: 'assets/img/radar_alien.gif',
      visorLabel: 'RADAR — SECTOR COMMS',
      madreStatus: 'MODULO DE RED Y FIREWALL',
      hasVideo: false,
      objectives: [
        'Instalar Servidor Web (IIS o Apache)',
        'Habilitar puerto TCP 443 (Outbound) para S.O.S.',
        'Denegar puertos TCP 22 y 3389 (Inbound)'
      ],
      arrival:
        "> BASE DE DATOS RESTAURADA. VULNERABILIDAD TERMICA CONFIRMADA.\n" +
        "> ESTADO DE COMUNICACIONES: Intranet y Antena Principal fuera de linea.\n" +
        "> ALERTA: Conexion externa remota detectada. Origen: Weyland-Yutani.\n\n" +
        "[MADRE] Han activado un cortafuegos para evitar que enviemos una señal\n" +
        "de advertencia sobre la cuarentena rota.\n\n" +
        "Si quieren pedir rescate, deben reinstalar el Servidor Web y reconfigurar el Firewall.\n" +
        "He interceptado el Manual Confidencial de W-Y. Léanlo antes de que sea tarde.",
      docTitle: 'CONFIDENCIAL: DIRECTIVAS DE RED W-Y',
      docContent:
        '<h3>SERVIDORES WEB</h3>' +
        '<p>Para habilitar apps de intranet o señales externas:<br>' +
        '<b>IIS</b> (en Windows) o <b>Apache</b> (en Linux).</p>' +
        '<h3>TRAFICO WEB — PUERTOS 80 Y 443</h3>' +
        '<p><b>Puerto TCP 80 (HTTP)</b>: trafico no seguro.<br>' +
        '<b>Puerto TCP 443 (HTTPS)</b>: transmisiones encriptadas de alta prioridad.</p>' +
        '<h3>ACCESO REMOTO — PUERTOS 22 Y 3389</h3>' +
        '<p><b>Puerto 22 (SSH)</b>: administracion remota en Linux.<br>' +
        '<b>Puerto 3389 (RDP)</b>: administracion remota en Windows.</p>' +
        '<h3>FIREWALL</h3>' +
        '<p>Las reglas se basan en <b>Permitir (Allow)</b> o <b>Denegar (Deny)</b>' +
        ' el trafico de <b>Entrada (Inbound)</b> y <b>Salida (Outbound)</b>.</p>',
      faseB: [
        {
          text:
            "> BYPASS DE SEGURIDAD REQUERIDO INMEDIATAMENTE.\n" +
            "> INTENTO DE HACKEO CORPORATIVO EN PROGRESO: 45% COMPLETADO...\n" +
            "> PASO 1: Despliegue la aplicacion de emergencia.\n\n" +
            "[MADRE] ¿Qué servicio debe habilitar para lanzar la aplicación S.O.S.?",
          options: [
            { text: '> Servidor FTP', correct: false, msg: 'FTP transfiere archivos, no despliega apps web. Revise el manual.' },
            { text: '> Servidor Web (IIS / Apache)', correct: true },
            { text: '> Servidor DNS', correct: false, msg: 'DNS resuelve nombres, no despliega apps. Revise el manual.' }
          ]
        },
        {
          text:
            "> APLICACION EN LINEA. SE REQUIERE CANAL SEGURO PARA LA TRANSMISION S.O.S.\n" +
            "> PASO 2: Configure la regla de Firewall de SALIDA (Outbound).\n\n" +
            "[MADRE] ¿Qué puerto debe PERMITIR para enviar el S.O.S. encriptado?",
          options: [
            { text: '> TCP 80 (HTTP)', correct: false, msg: 'Puerto 80 no es encriptado. Revise el manual.' },
            { text: '> TCP 443 (HTTPS)', correct: true },
            { text: '> UDP 53 (DNS)', correct: false, msg: 'UDP 53 es para resolución de nombres. Revise el manual.' }
          ]
        },
        {
          text:
            "> TRANSMISION EN COLA. ADVERTENCIA: W-Y ESTA TOMANDO EL PILOTO AUTOMATICO.\n" +
            "> PASO 3: Configure la regla de Firewall de ENTRADA (Inbound).\n\n" +
            "[MADRE] ¿Qué puertos debe DENEGAR para bloquear la administracion remota de W-Y?",
          options: [
            { text: '> TCP 80 y 443', correct: false, msg: 'Esos son puertos web, no de administración remota. Revise el manual.' },
            { text: '> TCP 22 (SSH) y TCP 3389 (RDP)', correct: true },
            { text: '> UDP 53 y TCP 443', correct: false, msg: 'Revise los puertos de administración remota en el manual.' }
          ]
        }
      ],
      quizIntro:
        "> CORTAFUEGOS ESTABLECIDO. CONTROL REMOTO DENEGADO. SEÑAL S.O.S. TRANSMITIENDO.\n" +
        "> ALERTA CRITICA: Impactos contundentes en el panel principal de estribor.\n" +
        ">               El organismo intenta romper la compuerta.\n\n" +
        "[MADRE] Complete la secuencia de validacion. TEMPORIZADOR ACTIVO: 60 SEGUNDOS.\n" +
        "CADA FALLO RESTA 15% DE OXIGENO.",
      quiz: [
        {
          q: 'Q1: ¿Qué servicio habilita aplicaciones web en un servidor?',
          options: [
            { text: '> Servidor FTP', correct: false, msg: 'FTP transfiere archivos, no despliega apps web.' },
            { text: '> Servidor Web (IIS / Apache)', correct: true },
            { text: '> Servidor DNS', correct: false, msg: 'DNS resuelve nombres, no despliega apps.' }
          ]
        },
        {
          q: 'Q2: ¿Qué puerto Outbound debe PERMITIR para el S.O.S. encriptado?',
          options: [
            { text: '> TCP 80 (HTTP)', correct: false, msg: 'Puerto 80 no es encriptado. Revise el manual.' },
            { text: '> UDP 53 (DNS)', correct: false, msg: 'UDP 53 es para nombres, no encriptación web.' },
            { text: '> TCP 443 (HTTPS)', correct: true }
          ]
        },
        {
          q: 'Q3: ¿Qué puertos Inbound debe DENEGAR para bloquear a Weyland-Yutani?',
          options: [
            { text: '> TCP 80 y 443', correct: false, msg: 'Esos son puertos web, no de administración remota.' },
            { text: '> TCP 22 (SSH) y TCP 3389 (RDP)', correct: true },
            { text: '> UDP 53 y TCP 443', correct: false, msg: 'Revise los puertos de administración remota.' }
          ]
        }
      ],
      quizDamage: 15,
      useTimer: true,
      success:
        "> VALIDACION ACEPTADA. COMPUERTA DESBLOQUEADA.\n" +
        "> EVACUEN INMEDIATAMENTE A LA SALA DE MAQUINAS.\n" +
        "> PREPARENSE PARA PROTOCOLOS DE DESTRUCCION.",
      nextNode: 'engines',
      nextLabel: '[ EVACUAR A LA SALA DE MAQUINAS ]'
    },

    engines: {
      id: 'engines', num: '04', theme: 'node-theme-engines',
      title: '04: SALA DE MAQUINAS',
      visorImg: 'assets/img/mother_interface.gif',
      visorLabel: 'NUCLEO — SALA DE MAQUINAS',
      madreStatus: 'MODULO DE SCRIPTS Y BACKUPS',
      hasVideo: false,
      objectives: [
        'Comprimir datos con tar para la cápsula Narcissus',
        'Automatizar script con crontab / Task Scheduler',
        'Forzar apagado del sistema de refrigeración'
      ],
      arrival:
        "> ACCESO A SALA DE MAQUINAS CONCEDIDO.\n" +
        "> ALERTA GENERAL: Multiples brechas en el casco. Presion del nucleo inestable.\n" +
        "> ESTADO: El especimen ha anidado en el sector de refrigeracion primaria.\n\n" +
        "[MADRE] Deben usar Scripts (Bash/PowerShell) para forzar el apagado de la refrigeracion.\n" +
        "Ademas, deben configurar un Backup automatizado para migrar registros a la capsula Narcissus.\n" +
        "Revisen el MANUAL_MOTORES_V.3 antes de que el nucleo colapse.",
      docTitle: 'MANUAL_MOTORES_V.3',
      docContent:
        '<h3>COMANDOS DE RESPALDO (BACKUPS)</h3>' +
        '<p>Para comprimir volúmenes de datos en Linux:<br>' +
        '<code>tar -czvf backup.tar.gz /datos</code><br>' +
        'En Windows, emplee <b>Robocopy</b> para espejar directorios críticos.</p>' +
        '<h3>AUTOMATIZACION — CRON / TASK SCHEDULER</h3>' +
        '<p>Los scripts no se ejecutan solos.<br>' +
        'En <b>Linux</b>: editar el archivo <code>crontab</code>.<br>' +
        'En <b>Windows Server</b>: <b>Programador de tareas</b> (Task Scheduler),' +
        ' definiendo un Desencadenador (Trigger) y una Accion.</p>' +
        '<h3>SCRIPTS DE PURGA</h3>' +
        '<p>Un script (.sh o .ps1) agrupa comandos ejecutables.<br>' +
        'Para forzar el apagado critico:<br>' +
        '<code>kill -9 [PID]</code> (Linux) — <code>Stop-Process</code> (PowerShell)</p>',
      faseB: [
        {
          text:
            "> INICIANDO SECUENCIA DE MIGRACION Y PURGA.\n" +
            "> TEMPERATURA DEL NUCLEO AUMENTANDO...\n" +
            "> PASO 1: Asegurar los registros de la Caja Negra.\n\n" +
            "[MADRE] ¿Qué comando empaqueta y comprime los datos del servidor?",
          options: [
            { text: '> rm -rf /datos', correct: false, msg: 'DESTRUCCION DE PRUEBAS NO AUTORIZADA. Ese comando borra todo.' },
            { text: '> tar -czvf caja_negra.tar.gz /datos', correct: true },
            { text: '> systemctl stop backup', correct: false, msg: 'systemctl stop detiene un servicio. Revise el manual.' }
          ]
        },
        {
          text:
            "> RESPALDO CREADO. MIGRACION A LA CAPSULA NARCISSUS EN CURSO.\n" +
            "> PASO 2: El nucleo debe sobrecargarse exactamente al terminar.\n\n" +
            "[MADRE] ¿Qué herramienta automatiza la ejecución del script de autodestrucción?",
          options: [
            { text: '> Active Directory', correct: false, msg: 'Active Directory gestiona usuarios, no tareas programadas. Revise el manual.' },
            { text: '> Crontab / Task Scheduler', correct: true },
            { text: '> apt-get install script', correct: false, msg: 'Ese instala paquetes, no programa tareas. Revise el manual.' }
          ]
        }
      ],
      quizIntro:
        "> MIGRACION DE DATOS COMPLETADA. LA CAPSULA ESTA LISTA.\n" +
        "> ALERTA CRITICA: EL ESPECIMEN HA ROTO LA CONTENCION DE LA PUERTA.\n\n" +
        "[MADRE] Para liberar los amarres magneticos de la capsula de escape,\n" +
        "valide sus comandos finales. EL TIEMPO SE AGOTA.\n" +
        "CADA FALLO RESTA 20% DE OXIGENO.",
      quiz: [
        {
          q: 'Q1: ¿Qué comando empaqueta y comprime datos en Linux?',
          options: [
            { text: '> rm -rf /datos', correct: false, msg: 'Ese comando borra los datos permanentemente. Revise el manual.' },
            { text: '> tar -czvf caja_negra.tar.gz /datos', correct: true },
            { text: '> systemctl stop backup', correct: false, msg: 'Ese detiene un servicio. Revise el manual.' }
          ]
        },
        {
          q: 'Q2: ¿Qué herramienta programa la ejecución automática de scripts en Linux?',
          options: [
            { text: '> Active Directory', correct: false, msg: 'Active Directory gestiona usuarios, no tareas programadas.' },
            { text: '> Crontab', correct: true },
            { text: '> apt-get install script', correct: false, msg: 'Ese instala paquetes, no programa tareas.' }
          ]
        },
        {
          q: 'Q3: ¿Qué extensión tienen los scripts en Linux?',
          options: [
            { text: '> .ps1', correct: false, msg: '.ps1 es PowerShell (Windows). Revise el manual.' },
            { text: '> .bat', correct: false, msg: '.bat es Windows. Revise el manual.' },
            { text: '> .sh', correct: true }
          ]
        }
      ],
      quizDamage: 20,
      useTimer: false,
      success:
        "> VALIDACION ACEPTADA. AMARRES LIBERADOS.\n" +
        "> SECUENCIA DE AUTODESTRUCCION DE LA NOSTROMO INICIADA: T-MENOS 10 SEGUNDOS.\n" +
        "> ACTIVANDO PROPULSORES DE LA CAPSULA NARCISSUS. BUENA SUERTE.",
      nextNode: null,
      nextLabel: null
    }
  },

  ending:
    "Ultimo reporte de la nave comercial Nostromo.\n\n" +
    "Los servidores fueron restaurados y los datos asegurados.\n" +
    "La nave ha sido destruida.\n\n" +
    "El resto de la tripulacion... ha cumplido su mision tecnica.\n\n" +
    "Aqui los ingenieros de sistemas, firmando fuera.\n\n" +
    "— FIN DEL REPORTE —"
};

// ============================================================
// MOTOR DE ESCENAS
// ============================================================

function showScene(id) {
  document.querySelectorAll('.scene').forEach(s => {
    s.classList.remove('active');
    s.style.display = 'none';
  });
  const target = document.getElementById('scene-' + id);
  if (target) {
    target.style.display = 'flex';
    requestAnimationFrame(() => target.classList.add('active'));
  }
}

// ============================================================
// BOOT
// ============================================================

function startBoot() {
  const bootText = document.getElementById('boot-text');
  const bootBtn  = document.getElementById('boot-btn');
  if (!bootText) return;
  bootSkipped = false;
  window._bootAccelerated = false;
  bootText.innerHTML = '';
  bootBtn.classList.add('hidden');

  // Inicia el audio de escritura
  const bootAudio = AUDIO.play('boot', 'assets/sounds/escritura.mp3', { loop: true, volume: 0.45 });

  // Calcula delay por carácter para que el texto dure igual que el audio
  function beginTyping() {
    const totalTicks = GUION.boot.length + 1;
    const dur = (bootAudio && bootAudio.duration > 0)
      ? bootAudio.duration
      : null;

    TYPE_SPEED_ACTIVE = dur
      ? Math.max(1, Math.floor((dur * 1000) / totalTicks))
      : TYPE_SPEED;

    typeInto(bootText, GUION.boot, () => {
      AUDIO.stop('boot');
      if (!bootSkipped) bootBtn.classList.remove('hidden');
    });
  }

  // Si los metadatos del audio ya están listos, arranca directo
  if (bootAudio && bootAudio.duration > 0) {
    beginTyping();
  } else if (bootAudio) {
    bootAudio.addEventListener('loadedmetadata', beginTyping, { once: true });
    setTimeout(() => { if (!bootText.innerHTML) beginTyping(); }, 1500);
  } else {
    beginTyping();
  }
}

function skipIntro() {
  bootSkipped = true;
  if (!AUDIO.muted) {
    const sfx = new Audio('assets/sounds/boton-saltar.mp3');
    sfx.volume = 0.9;
    sfx.play().catch(() => {});
  }
  goToMap();
}

function accelerateBoot() {
  TYPE_SPEED_ACTIVE = 1;
  window._bootAccelerated = true; // Acelera TODO, incluyendo la primera línea
}

function goToMap() {
  if (!AUDIO.muted) { const s = new Audio('assets/sounds/botones.mp3'); s.volume=0.9; s.play().catch(()=>{}); }
  AUDIO.stopAll();
  showScene('map');
  updateMapUI();
  // Inicia música del mapa
  AUDIO.play('map', 'assets/sounds/map-theme.mp3', { loop: true, volume: 0.35 });
}

// ============================================================
// MAPA
// ============================================================

const NODE_ORDER = ['bridge', 'lab', 'comms', 'engines'];

function updateMapUI() {
  updateO2();
  updateGradePreview();

  NODE_ORDER.forEach((id, i) => {
    const badge    = document.getElementById('badge-' + id);
    const zoneEl   = document.getElementById('zone-' + id);
    const progEl   = document.getElementById('prog-' + id);
    const statusEl = document.getElementById('prog-' + id + '-status');
    const isCompleted = completedNodes.includes(id);
    const isAvailable = i === 0 || completedNodes.includes(NODE_ORDER[i - 1]);

    if (badge) {
      if (isCompleted) {
        badge.textContent = '✓ COMPLETADO';
        badge.className = 'zone-badge done';
      } else if (isAvailable) {
        badge.textContent = '▶ ACCEDER';
        badge.className = 'zone-badge available';
      } else {
        badge.textContent = '🔒 BLOQUEADO';
        badge.className = 'zone-badge locked';
      }
    }

    if (zoneEl) {
      if (!isAvailable && !isCompleted) zoneEl.classList.add('locked-zone');
      else zoneEl.classList.remove('locked-zone');
    }

    if (progEl) {
      progEl.classList.remove('locked', 'done');
      if (isCompleted)       progEl.classList.add('done');
      else if (!isAvailable) progEl.classList.add('locked');
    }

    if (statusEl) {
      if (isCompleted)      statusEl.textContent = 'DONE';
      else if (isAvailable) statusEl.textContent = 'EN CURSO';
      else                  statusEl.textContent = 'BLOQUEADO';
    }
  });
}

function tryZone(id) {
  const i = NODE_ORDER.indexOf(id);
  const prevId = NODE_ORDER[i - 1];
  if (i > 0 && !completedNodes.includes(prevId)) {
    const speech = document.getElementById('madre-speech');
    if (speech) speech.innerHTML = '> ZONA SELLADA.<br>> Completa el modulo anterior primero.';
    return;
  }
  goToScene(id);
}

function goToScene(id) {
  const node = GUION.nodes[id];
  if (!node) return;
  // Suena el botón de acceder (reemplaza toda música anterior)
  AUDIO.play('sfx', 'assets/sounds/boton-acceder.mp3', { volume: 0.8 });
  currentNode = node;
  enterNode(node);
}

// ============================================================
// ESCENA NODO
// ============================================================

function enterNode(node) {
  showScene('node');

  const nodeScene = document.getElementById('scene-node');
  nodeScene.className = 'scene active ' + node.theme;

  const titleBar = document.getElementById('node-title-bar');
  if (titleBar) titleBar.textContent = node.title;

  const visorImg   = document.getElementById('node-visor-img');
  const visorLabel = document.getElementById('visor-label');
  if (visorImg && node.visorImg) {
    visorImg.src = node.visorImg;
    visorImg.style.display = 'block';
  } else if (visorImg) {
    visorImg.style.display = 'none';
  }
  if (visorLabel) visorLabel.textContent = '▶ ' + node.visorLabel;

  const madreStatus = document.getElementById('node-madre-status');
  if (madreStatus) madreStatus.innerHTML = `<span class="blink-slow">■</span> ${node.madreStatus}`;

  const objList = document.getElementById('obj-list');
  if (objList) objList.innerHTML = node.objectives.map(o => `<li>${o}</li>`).join('');

  setPhasePill('a');
  updateO2();

  typeScreen(node.arrival, () => {
    const controls = [
      { label: `[ LEER ${node.docTitle} ]`, action: () => openDoc(node) }
    ];
    if (node.hasVideo) {
      controls.push({ label: '[ ▶ VER VIDEO DE REFERENCIA ]', action: () => openVideoModal(node.id) });
    }
    controls.push({ label: '[ INICIAR PRACTICA GUIADA ]', action: () => startFaseB(node, 0), primary: true });
    renderControls(controls);
  });
}

function setPhasePill(phase) {
  ['a','b','c'].forEach(p => {
    const el = document.getElementById('phase-' + p);
    if (!el) return;
    el.classList.remove('active', 'done');
    if (p === phase) el.classList.add('active');
    else if (p < phase) el.classList.add('done');
  });
}

// ============================================================
// MODAL VIDEO YOUTUBE
// ============================================================

function openVideoModal(nodeId) {
  if (!AUDIO.muted) { const s = new Audio('assets/sounds/efecto-manual.mp3'); s.volume=0.8; s.play().catch(()=>{}); }
  const data = NODE_VIDEOS[nodeId];
  if (!data) return;

  const overlay    = document.getElementById('modal-video');
  const titleEl    = document.getElementById('video-modal-title');
  const subtitleEl = document.getElementById('video-modal-subtitle');
  const frameWrap  = document.getElementById('video-frame-wrap');

  if (!overlay) return;

  titleEl.textContent    = data.title;
  subtitleEl.textContent = data.subtitle;

  if (!data.youtubeId || data.youtubeId.startsWith('REEMPLAZAR')) {
    frameWrap.innerHTML =
      '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'height:100%;gap:16px;color:rgba(0,255,65,0.5);font-family:monospace;text-align:center;padding:20px">' +
      '<div style="font-size:3rem">▶</div>' +
      '<div style="letter-spacing:3px">VIDEO PENDIENTE DE CONFIGURACIÓN</div>' +
      '<div style="font-size:0.85rem;opacity:0.6">Reemplaza el youtubeId en NODE_VIDEOS dentro de app.js</div>' +
      '</div>';
  } else {
    frameWrap.innerHTML =
      `<iframe
        src="https://www.youtube.com/embed/${data.youtubeId}?rel=0&modestbranding=1"
        title="${data.title}"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
      ></iframe>`;
  }

  overlay.style.display = 'flex';
}

function closeVideoModal() {
  if (!AUDIO.muted) { const s = new Audio('assets/sounds/botones.mp3'); s.volume=0.9; s.play().catch(()=>{}); }
  const overlay   = document.getElementById('modal-video');
  const frameWrap = document.getElementById('video-frame-wrap');
  if (overlay)   overlay.style.display = 'none';
  if (frameWrap) frameWrap.innerHTML = '';
}

// ============================================================
// MODAL DOCUMENTO
// ============================================================

function openDoc(node) {
  if (currentDocAudio) { currentDocAudio.pause(); currentDocAudio.currentTime = 0; }
  if (!AUDIO.muted) { currentDocAudio = new Audio('assets/sounds/efecto-manual.mp3'); currentDocAudio.volume=0.8; currentDocAudio.play().catch(()=>{}); }
  lastDocContent = node.docContent;
  lastDocTitle   = node.docTitle;

  const overlay = document.getElementById('modal-doc');
  const box     = document.getElementById('modal-doc-box');
  const title   = document.getElementById('modal-doc-title');
  const body    = document.getElementById('modal-doc-body');

  if (!overlay) return;
  title.textContent = node.docTitle;
  body.innerHTML    = node.docContent;
  box.style.borderColor = getComputedStyle(document.getElementById('scene-node')).color;
  overlay.style.display = 'flex';
}

function closeDoc() {
  if (!AUDIO.muted) { const s = new Audio('assets/sounds/botones.mp3'); s.volume=0.9; s.play().catch(()=>{}); }
  if (currentDocAudio) { currentDocAudio.pause(); currentDocAudio.currentTime = 0; currentDocAudio = null; }
  const overlay = document.getElementById('modal-doc');
  if (overlay) overlay.style.display = 'none';
}

function skipTheory() {
  if (!AUDIO.muted) { const s = new Audio('assets/sounds/botones.mp3'); s.volume=0.9; s.play().catch(()=>{}); }
  closeDoc();
  if (currentNode) startFaseB(currentNode, 0);
}

function reopenDoc() {
  if (currentDocAudio) { currentDocAudio.pause(); currentDocAudio.currentTime = 0; }
  if (!AUDIO.muted) { currentDocAudio = new Audio('assets/sounds/efecto-manual.mp3'); currentDocAudio.volume=0.8; currentDocAudio.play().catch(()=>{}); }
  const docBody = lastDocContent || (currentNode ? currentNode.docContent : null);
  const docTitle = lastDocTitle || (currentNode ? currentNode.docTitle : null);
  if (!docBody) return;
  const overlay = document.getElementById('modal-doc');
  const title   = document.getElementById('modal-doc-title');
  const body    = document.getElementById('modal-doc-body');
  title.textContent = docTitle;
  body.innerHTML    = docBody;
  overlay.style.display = 'flex';
}

function skipTheory() {
  closeDoc();
  if (currentNode) startFaseB(currentNode, 0);
}

// ============================================================
// FASE B — PRACTICA GUIADA
// ============================================================

let faseBStep = 0;
let faseBNode = null;
let faseBAwaitingNext = false;

function startFaseB(node, stepIndex) {
  if (!AUDIO.muted) { const s = new Audio('assets/sounds/efecto-manual.mp3'); s.volume=0.8; s.play().catch(()=>{}); }
  closeDoc();
  faseBNode = node;
  faseBStep = stepIndex;
  faseBAwaitingNext = false;
  setPhasePill('b');

  if (!node.faseB || node.faseB.length === 0) {
    startQuizPhase(node);
    return;
  }

  showPracticeModal(node, stepIndex);
}

function showPracticeModal(node, stepIndex) {
  const step = node.faseB[stepIndex];
  if (!step) { startQuizPhase(node); return; }

  const overlay    = document.getElementById('modal-practice');
  const titleEl    = document.getElementById('practice-title');
  const stepNumEl  = document.getElementById('practice-step-num');
  const instrEl    = document.getElementById('practice-instruction');
  const optionsEl  = document.getElementById('practice-options');
  const feedbackEl = document.getElementById('practice-feedback');
  const progressEl = document.getElementById('practice-progress-bar');

  titleEl.textContent   = 'PRACTICA — ' + node.title;
  stepNumEl.textContent = `${stepIndex + 1} / ${node.faseB.length}`;
  progressEl.style.width = ((stepIndex / node.faseB.length) * 100) + '%';
  instrEl.textContent    = step.text;
  feedbackEl.style.display = 'none';
  feedbackEl.className   = 'practice-feedback';
  optionsEl.innerHTML    = '';
  faseBAwaitingNext      = false;

  step.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.textContent = opt.text;
    btn.addEventListener('click', () => handlePracticeAnswer(opt, i, node, stepIndex));
    optionsEl.appendChild(btn);
  });

  overlay.style.display = 'flex';
}

function handlePracticeAnswer(opt, idx, node, stepIndex) {
  if (faseBAwaitingNext) return;
  const optionsEl  = document.getElementById('practice-options');
  const feedbackEl = document.getElementById('practice-feedback');
  const btns = optionsEl.querySelectorAll('button');
  btns.forEach(b => b.disabled = true);

  if (opt.correct) {
    if (!AUDIO.muted) { const s = new Audio('assets/sounds/check.mp3'); s.volume=0.9; s.play().catch(()=>{}); }
    btns[idx].classList.add('correct');
    feedbackEl.className   = 'practice-feedback';
    feedbackEl.textContent = '> CORRECTO. Continuando...';
    feedbackEl.style.display = 'block';
    faseBAwaitingNext = true;
    setTimeout(() => {
      const nextStep = stepIndex + 1;
      if (nextStep < node.faseB.length) {
        showPracticeModal(node, nextStep);
      } else {
        const overlay = document.getElementById('modal-practice');
        if (overlay) overlay.style.display = 'none';
        typeScreen(
          '> PRACTICA COMPLETADA.\n> Preparando protocolo de verificacion tecnica...',
          () => startQuizPhase(node)
        );
      }
    }, 900);
  } else {
    if (!AUDIO.muted) { const s = new Audio('assets/sounds/re-mal.mp3'); s.volume=0.9; s.play().catch(()=>{}); }
    btns[idx].classList.add('wrong');
    feedbackEl.className   = 'practice-feedback error';
    feedbackEl.textContent = '> ERROR: ' + (opt.msg || 'Respuesta incorrecta. Intente de nuevo.');
    feedbackEl.style.display = 'block';
    setTimeout(() => {
      btns.forEach(b => { b.disabled = false; b.classList.remove('wrong', 'correct'); });
      feedbackEl.style.display = 'none';
      faseBAwaitingNext = false;
    }, 1400);
  }
}

function skipPractice() {
  if (!AUDIO.muted) { const s = new Audio('assets/sounds/botones.mp3'); s.volume=0.9; s.play().catch(()=>{}); }
  const overlay = document.getElementById('modal-practice');
  if (overlay) overlay.style.display = 'none';
  if (faseBNode) startQuizPhase(faseBNode);
}

function closePractice() {
  if (!AUDIO.muted) { const s = new Audio('assets/sounds/botones.mp3'); s.volume=0.9; s.play().catch(()=>{}); }
  const overlay = document.getElementById('modal-practice');
  if (overlay) overlay.style.display = 'none';
}

// ============================================================
// QUIZ
// ============================================================

let quizState = { questions: [], current: 0, onComplete: null, damage: 15, timer: null };

function startQuizPhase(node) {
  const overlay = document.getElementById('modal-practice');
  if (overlay) overlay.style.display = 'none';
  setPhasePill('c');
  typeScreen(node.quizIntro, () => {
    renderControls([{ label: '[ INICIAR PROTOCOLO DE VERIFICACION TECNICA ]', action: () => openQuiz(node), primary: true }]);
  });
}

function openQuiz(node) {
  const overlay   = document.getElementById('modal-quiz');
  const labelEl   = document.getElementById('quiz-label');
  const timerWrap = document.getElementById('quiz-timer-wrap');

  labelEl.textContent = 'PROTOCOLO — ' + node.title;
  if (timerWrap) timerWrap.style.display = 'flex';

  overlay.style.display = 'flex';

  quizState = {
    questions: node.quiz,
    current: 0,
    onComplete: () => nodeSuccess(node),
    damage: node.quizDamage,
    useTimer: true,
    timer: null
  };

  renderQuizQuestion();
  startQuizTimer();
}

function renderQuizQuestion() {
  const q = quizState.questions[quizState.current];
  const total = quizState.questions.length;

  document.getElementById('quiz-q-num').textContent    = `PREGUNTA ${quizState.current + 1} / ${total}`;
  document.getElementById('quiz-question').textContent = q.q;
  document.getElementById('quiz-progress-bar').style.width = ((quizState.current / total) * 100) + '%';
  document.getElementById('quiz-o2-val').textContent   = oxygen + '%';

  const feedbackEl = document.getElementById('quiz-feedback');
  feedbackEl.style.display = 'none';
  feedbackEl.className = 'quiz-feedback';

  const optionsEl = document.getElementById('quiz-options');
  optionsEl.innerHTML = '';
  q.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.textContent = opt.text;
    btn.addEventListener('click', () => handleQuizAnswer(opt, i));
    optionsEl.appendChild(btn);
  });
}

function handleQuizAnswer(opt, idx) {
  const optionsEl  = document.getElementById('quiz-options');
  const feedbackEl = document.getElementById('quiz-feedback');
  const btns = optionsEl.querySelectorAll('button');
  btns.forEach(b => b.disabled = true);

  if (opt.correct) {
    if (!AUDIO.muted) { const s = new Audio('assets/sounds/check.mp3'); s.volume=0.9; s.play().catch(()=>{}); }
    btns[idx].classList.add('correct');
    feedbackEl.className   = 'quiz-feedback';
    feedbackEl.textContent = '> RESPUESTA CORRECTA.';
    feedbackEl.style.display = 'block';
    quizState.current++;
    if (quizState.current >= quizState.questions.length) {
      clearQuizTimer();
      setTimeout(() => {
        document.getElementById('modal-quiz').style.display = 'none';
        if (quizState.onComplete) quizState.onComplete();
      }, 700);
    } else {
      setTimeout(renderQuizQuestion, 900);
    }
  } else {
    btns[idx].classList.add('wrong');
    feedbackEl.className   = 'quiz-feedback error';
    feedbackEl.textContent = '> ERROR: ' + (opt.msg || 'Respuesta incorrecta.');
    feedbackEl.style.display = 'block';
    takeDamage(quizState.damage, opt.msg || 'Respuesta incorrecta.');
    setTimeout(() => {
      if (!gameActive) return;
      btns.forEach(b => { b.disabled = false; b.classList.remove('wrong','correct'); });
      feedbackEl.style.display = 'none';
    }, 1600);
  }
}

let quizTimerInterval = null;

function startQuizTimer() {
  let timeLeft = 60;
  const timerEl = document.getElementById('quiz-timer-num');
  if (timerEl) timerEl.textContent = timeLeft;
  clearQuizTimer();
  quizTimerInterval = setInterval(() => {
    timeLeft--;
    if (timerEl) timerEl.textContent = timeLeft;
    if (timeLeft <= 0) {
      clearQuizTimer();
      document.getElementById('modal-quiz').style.display = 'none';
      takeDamage(20, 'TIEMPO AGOTADO — Señal de rescate comprometida.');
    }
  }, 1000);
}

function clearQuizTimer() {
  if (quizTimerInterval) { clearInterval(quizTimerInterval); quizTimerInterval = null; }
}

// ============================================================
// EXITO DE NODO
// ============================================================

function nodeSuccess(node) {
  if (!AUDIO.muted) { const s = new Audio('assets/sounds/nivel-desbloqueado.mp3'); s.volume=0.9; s.play().catch(()=>{}); }
  completedNodes.push(node.id);
  updateProgressSidebar();
  updateO2();

  typeScreen(node.success, () => {
    if (node.nextNode) {
      renderControls([{ label: node.nextLabel, action: () => {
        updateMapUI();
        goToScene(node.nextNode);
      }, primary: true }]);
    } else {
      renderControls([{ label: '[ EVACUAR EN LA CAPSULA NARCISSUS ]', action: () => showEnding(), primary: true }]);
    }
  });
}

function updateProgressSidebar() {
  updateGradePreview();
}

// ============================================================
// ESCENA FINAL
// ============================================================

function showEnding() {
  showScene('ending');

  const flashEl   = document.getElementById('ending-flash');
  const contentEl = document.getElementById('ending-content');
  const gradeEl   = document.getElementById('ending-grade');
  const detailEl  = document.getElementById('ending-detail');
  const textEl    = document.getElementById('ending-text');

  flashEl.classList.remove('hidden');
  contentEl.classList.add('hidden');

  setTimeout(() => {
    flashEl.style.opacity = '0';
    setTimeout(() => {
      flashEl.classList.add('hidden');
      contentEl.classList.remove('hidden');
      
      gradeEl.style.display = 'none';
      detailEl.style.display = 'none';
      const restartBtn = contentEl.querySelector('.btn-restart');
      if (restartBtn) restartBtn.style.display = 'none';

      const gradeVal = Math.max(0, Math.min(10, (oxygen / 100) * 10));
      gradeEl.textContent  = gradeVal.toFixed(1) + ' / 10';
      if (gradeVal >= 8.0) {
        gradeEl.style.color = 'var(--c-green)';
        gradeEl.style.textShadow = '0 0 30px var(--c-green)';
      } else if (gradeVal >= 6.0) {
        gradeEl.style.color = 'var(--c-gold)';
        gradeEl.style.textShadow = '0 0 30px var(--c-gold)';
      } else {
        gradeEl.style.color = 'var(--c-red)';
        gradeEl.style.textShadow = '0 0 30px var(--c-red)';
      }
      detailEl.textContent = `OXIGENO FINAL: ${oxygen}% — MODULOS COMPLETADOS: ${completedNodes.length}/4`;

      AUDIO.play('boot', 'assets/sounds/escritura.mp3', { loop: true, volume: 0.45 });
      typeInto(textEl, GUION.ending, () => {
        AUDIO.stop('boot');
        if (!AUDIO.muted) { const s = new Audio('assets/sounds/victoria.mp3'); s.volume=0.9; s.play().catch(()=>{}); }
        gradeEl.style.display = 'block';
        detailEl.style.display = 'block';
        if (restartBtn) restartBtn.style.display = 'inline-block';
      }, true);
    }, 800);
  }, 1200);
}

// ============================================================
// OXIGENO Y DAÑO
// ============================================================

function takeDamage(amount, msg) {
  if (!gameActive) return;
  oxygen = Math.max(0, oxygen - amount);
  updateO2();
  showDamageToast(msg, amount);
  flashDamage();
  if (oxygen <= 0) {
    gameActive = false;
    setTimeout(showGameOver, 800);
  }
}

function updateO2() {
  const pct = oxygen;
  const color = pct > 60 ? 'var(--c-green)' : pct > 30 ? 'var(--c-amber)' : 'var(--c-red)';

  ['map-o2-bar','node-o2-bar'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.style.width = pct + '%'; el.style.background = color; el.style.boxShadow = `0 0 6px ${color}`; }
  });
  ['map-o2-pct','node-o2-val'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = pct + '%';
  });

  updateGradePreview();
}

function updateGradePreview() {
  const el = document.getElementById('grade-preview');
  if (!el) return;
  const val = oxygen / 10;
  el.textContent = val.toFixed(1) + ' / 10';
  
  if (val >= 8.0) {
    el.style.color = 'var(--c-green)';
    el.style.textShadow = '0 0 16px var(--c-green)';
  } else if (val >= 6.0) {
    el.style.color = 'var(--c-gold)';
    el.style.textShadow = '0 0 16px var(--c-gold)';
  } else {
    el.style.color = 'var(--c-red)';
    el.style.textShadow = '0 0 16px var(--c-red)';
  }
}

function showDamageToast(msg, amount) {
  if (!AUDIO.muted) { const s = new Audio('assets/sounds/incorrecto.mp3'); s.volume=0.9; s.play().catch(()=>{}); }
  const toast = document.getElementById('damage-toast');
  const msgEl = document.getElementById('damage-msg');
  if (!toast) return;
  msgEl.innerHTML = `DAÑO RECIBIDO: -${amount}% O₂<br><span style="opacity:0.7">${msg}</span>`;
  toast.style.display = 'flex';
  setTimeout(() => { toast.style.display = 'none'; }, 3000);
}

function flashDamage() {
  const el = document.createElement('div');
  el.className = 'damage-flash-overlay';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 600);
}

function showGameOver() {
  AUDIO.stopAll();
  if (!AUDIO.muted) { const s = new Audio('assets/sounds/game-over.mp3'); s.volume=0.9; s.play().catch(()=>{}); }
  clearQuizTimer();
  const el = document.getElementById('gameover-screen');
  if (el) el.style.display = 'flex';
}

// ============================================================
// TERMINAL — typeWriter + controles
// ============================================================

function typeScreen(text, callback) {
  const screen = document.getElementById('node-screen');
  if (!screen) { if (callback) callback(); return; }
  screen.innerHTML = '';
  typeInto(screen, text, callback, true);
}

function typeInto(el, text, callback, useHtml) {
  el.innerHTML = '';
  const parts = text.split('\n');
  let partIdx = 0, charIdx = 0;
  // Primera línea: 1 carácter a la vez, lento (75ms). Resto: 3 por tick, rápido.
  // Si se aceleró, todo va a máxima velocidad.
  function charsPerTick() { 
    if (el.id === 'boot-text' && !window._bootAccelerated) {
      return (partIdx === 0) ? 1 : 2;
    }
    if (el.id === 'ending-text') return 1;
    return 4; 
  }
  function tickDelay() { 
    if (el.id === 'boot-text' && !window._bootAccelerated) {
      return (partIdx === 0) ? 75 : 8;
    }
    if (el.id === 'ending-text') return 45;
    return 1; 
  }

  // Auto-scroll solo si el usuario está cerca del fondo
  function smartScroll() {
    if (el.scrollTop === undefined) return;
    const threshold = 60;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    if (atBottom) el.scrollTop = el.scrollHeight;
  }

  function tick() {
    if (bootSkipped && el.id === 'boot-text') return;

    for (let i = 0; i < charsPerTick(); i++) {
      if (partIdx >= parts.length) {
        if (callback) callback();
        return;
      }
      const line = parts[partIdx];
      if (charIdx < line.length) {
        el.innerHTML += line.charAt(charIdx);
        charIdx++;
      } else {
        el.innerHTML += '<br>';
        partIdx++; charIdx = 0;
      }
    }
    smartScroll();
    setTimeout(tick, tickDelay());
  }
  tick();
}

function renderControls(actions) {
  const ctrl = document.getElementById('node-controls');
  if (!ctrl) return;
  ctrl.innerHTML = '';
  actions.forEach(a => {
    const btn = document.createElement('button');
    btn.textContent = a.label;
    if (a.primary) btn.classList.add('primary');
    btn.addEventListener('click', a.action);
    ctrl.appendChild(btn);
  });
}

// ============================================================
// INIT
// ============================================================

function injectAudioToggle() {
  // Inyecta botón mute/unmute flotante en la esquina
  const btn = document.createElement('button');
  btn.id = 'audio-toggle-btn';
  btn.textContent = '🔊 AUDIO';
  btn.title = 'Activar/Desactivar sonido';
  btn.style.cssText = [
    'position:fixed',
    'bottom:16px',
    'right:16px',
    'z-index:9999',
    'background:rgba(0,0,0,0.75)',
    'color:var(--c-green,#00ff41)',
    'border:1px solid var(--c-green,#00ff41)',
    'font-family:"Share Tech Mono",monospace',
    'font-size:0.7rem',
    'letter-spacing:2px',
    'padding:6px 12px',
    'cursor:pointer',
    'border-radius:2px',
    'opacity:0.75',
    'transition:opacity 0.2s'
  ].join(';');
  btn.addEventListener('mouseenter', () => btn.style.opacity = '1');
  btn.addEventListener('mouseleave', () => btn.style.opacity = '0.75');
  btn.addEventListener('click', () => AUDIO.toggleMute());
  document.body.appendChild(btn);
}

// ============================================================
// MODAL SALIR / VOLVER A INTRO
// ============================================================

function confirmExit() {
  if (!AUDIO.muted) { const s = new Audio('assets/sounds/botones.mp3'); s.volume=0.9; s.play().catch(()=>{}); }
  const modal   = document.getElementById('modal-exit');
  const title   = document.getElementById('modal-exit-title');
  const msg     = document.getElementById('modal-exit-msg');
  const confirm = document.getElementById('modal-exit-confirm-btn');
  if (!modal) return;
  title.textContent  = '⚠ ADVERTENCIA DEL SISTEMA';
  msg.innerHTML      = 'Esta acción terminará la sesión.<br><strong>Perderás todo el progreso actual.</strong>';
  confirm.textContent = '✕ SALIR DEL JUEGO';
  confirm.onclick     = () => {
    if (!AUDIO.muted) { const s = new Audio('assets/sounds/boton-saltar.mp3'); s.volume=0.9; s.play().catch(()=>{}); }
    setTimeout(() => location.reload(), 300);
  };
  modal.style.display = 'flex';
}

function confirmGoIntro() {
  if (!AUDIO.muted) { const s = new Audio('assets/sounds/botones.mp3'); s.volume=0.9; s.play().catch(()=>{}); }
  const modal   = document.getElementById('modal-exit');
  const title   = document.getElementById('modal-exit-title');
  const msg     = document.getElementById('modal-exit-msg');
  const confirm = document.getElementById('modal-exit-confirm-btn');
  if (!modal) return;
  title.textContent  = '◀◀ VOLVER A LA INTRODUCCIÓN';
  msg.innerHTML      = 'Regresarás a la pantalla de inicio.<br><strong>Perderás todo el progreso actual.</strong>';
  confirm.textContent = '◀◀ VOLVER AL INICIO';
  confirm.onclick     = () => {
    if (!AUDIO.muted) { const s = new Audio('assets/sounds/boton-saltar.mp3'); s.volume=0.9; s.play().catch(()=>{}); }
    closeExitModal();
    AUDIO.stopAll();
    // Reinicia estado del juego
    oxygen = 100; gameActive = true; currentNode = null;
    completedNodes = []; lastDocContent = null; lastDocTitle = null;
    // Muestra la pantalla de audio prompt de nuevo
    const prompt = document.getElementById('audio-prompt');
    if (prompt) { prompt.style.opacity = '1'; prompt.style.display = 'flex'; }
    document.querySelectorAll('.scene').forEach(s => {
      s.classList.remove('active'); s.style.display = 'none';
    });
  };
  modal.style.display = 'flex';
}

function closeExitModal() {
  if (!AUDIO.muted) { const s = new Audio('assets/sounds/boton-saltar.mp3'); s.volume=0.9; s.play().catch(()=>{}); }
  const modal = document.getElementById('modal-exit');
  if (modal) modal.style.display = 'none';
}

// Función global para el botón de inicio — suena el SFX
function playBootBtn() {
  // Reproduce el sonido del botón de forma independiente (no lo mata stopAll)
  if (!AUDIO.muted) {
    const sfx = new Audio('assets/sounds/boton-iniciar.mp3');
    sfx.volume = 0.9;
    sfx.play().catch(() => {});
  }
}

// Arranca desde el prompt de audio — NO inicia el boot directamente
function startWithAudio() {
  const prompt = document.getElementById('audio-prompt');
  if (prompt) {
    prompt.style.opacity = '0';
    prompt.style.transition = 'opacity 0.4s';
    setTimeout(() => { prompt.style.display = 'none'; }, 400);
  }
  AUDIO.muted = false;
  showScene('boot');
  startBoot();
}

function startWithoutAudio() {
  const prompt = document.getElementById('audio-prompt');
  if (prompt) {
    prompt.style.opacity = '0';
    prompt.style.transition = 'opacity 0.4s';
    setTimeout(() => { prompt.style.display = 'none'; }, 400);
  }
  AUDIO.muted = true;
  showScene('boot');
  startBoot();
}

window.addEventListener('DOMContentLoaded', () => {
  injectAudioToggle();
  // Oculta la escena de boot hasta que el usuario elija en el prompt
  const bootScene = document.getElementById('scene-boot');
  if (bootScene) {
    bootScene.classList.remove('active');
    bootScene.style.display = 'none';
  }
});
