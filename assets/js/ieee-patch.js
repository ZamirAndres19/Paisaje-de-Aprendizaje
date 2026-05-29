// ============================================================
// IEEE PATCH — Inyecta citas y referencias IEEE en docContent
// Se ejecuta UNA VEZ antes de que openDoc() muestre el modal.
// Llama a patchIEEE(node) justo antes de asignar body.innerHTML.
// ============================================================

'use strict';

// Mapa de referencias IEEE por nodo
const IEEE_REFS = {
  bridge: [
    'Microsoft, "Install or Uninstall Roles, Role Services, or Features," <i>Windows Server Documentation</i>, Microsoft Learn, 2023. [En línea]. Disponible: https://learn.microsoft.com/en-us/windows-server/administration/server-manager/install-or-uninstall-roles-role-services-or-features',
    'Microsoft, "Active Directory Domain Services Overview," <i>Windows Server Documentation</i>, Microsoft Learn, 2023. [En línea]. Disponible: https://learn.microsoft.com/en-us/windows-server/identity/ad-ds/get-started/virtual-dc/active-directory-domain-services-overview',
    'Microsoft, "Disk Management Overview," <i>Windows Client Documentation</i>, Microsoft Learn, 2022. [En línea]. Disponible: https://learn.microsoft.com/en-us/windows-server/storage/disk-management/overview-of-disk-management'
  ],
  lab: [
    'Canonical Ltd., "Ubuntu Server Guide — Package Management," <i>Ubuntu Documentation</i>, 2024. [En línea]. Disponible: https://ubuntu.com/server/docs/package-management',
    'The PostgreSQL Global Development Group, "PostgreSQL 16 Documentation — Server Administration," <i>PostgreSQL Docs</i>, 2024. [En línea]. Disponible: https://www.postgresql.org/docs/current/admin.html',
    'M. Kerrisk, <i>The Linux Programming Interface</i>. San Francisco, CA, USA: No Starch Press, 2010, cap. 12.'
  ],
  comms: [
    'Internet Assigned Numbers Authority (IANA), "Service Name and Transport Protocol Port Number Registry," 2024. [En línea]. Disponible: https://www.iana.org/assignments/service-names-port-numbers',
    'Microsoft, "Internet Information Services (IIS) 10.0 Documentation," <i>Windows Server Documentation</i>, Microsoft Learn, 2023. [En línea]. Disponible: https://learn.microsoft.com/en-us/iis/get-started/introduction-to-iis/introduction-to-iis-architecture',
    'T. Ylonen y C. Lonvick, "The Secure Shell (SSH) Protocol Architecture," IETF RFC 4251, ene. 2006. [En línea]. Disponible: https://www.rfc-editor.org/rfc/rfc4251'
  ],
  engines: [
    'Free Software Foundation, "GNU tar Manual," <i>GNU Operating System</i>, 2023. [En línea]. Disponible: https://www.gnu.org/software/tar/manual/',
    'P. Vixie, "A New Cron," <i>USENIX Proceedings</i>, USENIX Association, 1994. [En línea]. Disponible: https://www.usenix.org/conference/4th-usenix-tcl-tk-workshop/new-cron',
    'Microsoft, "Task Scheduler for developers," <i>Windows App Development Documentation</i>, Microsoft Learn, 2023. [En línea]. Disponible: https://learn.microsoft.com/en-us/windows/win32/taskschd/task-scheduler-start-page'
  ]
};

// Texto de los superíndices a inyectar por nodo
// Cada entrada es [búsqueda (fragmento HTML), número de ref]
const IEEE_INLINE = {
  bridge: [
    { find: 'Desktop Experience (UI)</b>', ref: 1 },
    { find: 'Unidad D:</b>)',               ref: 3 },
    { find: 'Promover el servidor a Controlador de Dominio</b>', ref: 2 }
  ],
  lab: [
    { find: 'Ubuntu Server</b>)',          ref: 1 },
    { find: 'sudo apt-get install postgresql</code>', ref: 2 },
    { find: 'systemctl start postgresql</code>', ref: 2 },
    { find: 'SELECT [columna] FROM [tabla] WHERE [condicion];</code>', ref: 3 }
  ],
  comms: [
    { find: 'IIS</b> (en Windows) o <b>Apache</b>', ref: 2 },
    { find: 'Puerto TCP 443 (HTTPS)</b>',  ref: 1 },
    { find: 'Puerto 22 (SSH)</b>',         ref: 3 },
    { find: 'Puerto 3389 (RDP)</b>',       ref: 3 }
  ],
  engines: [
    { find: 'tar -czvf backup.tar.gz /datos</code>', ref: 1 },
    { find: '<code>crontab</code>',        ref: 2 },
    { find: 'Task Scheduler</b>',          ref: 3 },
    { find: 'kill -9 [PID]</code>',        ref: 1 }
  ]
};

/**
 * Aplica las citas IEEE al docContent del nodo.
 * @param {object} node — nodo del GUION (bridge, lab, comms, engines)
 * @returns {string} HTML del docContent con superíndices y bloque de refs
 */
function patchIEEE(node) {
  const refs  = IEEE_REFS[node.id];
  const inlines = IEEE_INLINE[node.id];
  if (!refs || !inlines) return node.docContent;

  let html = node.docContent;

  // Inserta <sup>[N]</sup> tras cada fragmento encontrado (una sola vez)
  inlines.forEach(({ find, ref }) => {
    const idx = html.indexOf(find);
    if (idx !== -1) {
      const insertAt = idx + find.length;
      html = html.slice(0, insertAt) + `<sup>[${ref}]</sup>` + html.slice(insertAt);
    }
  });

  // Bloque IEEE al final
  const refItems = refs
    .map((r, i) => `<li>[${i + 1}] ${r}</li>`)
    .join('\n');

  html +=
    '<div class="ieee-refs">' +
    '<div class="ieee-refs-title">&#x25BA; REFERENCIAS</div>' +
    `<ol>${refItems}</ol>` +
    '</div>';

  return html;
}
