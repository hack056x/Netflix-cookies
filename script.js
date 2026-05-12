let archivos = [];
let resultados = [];
let isValidating = false;

// DOM Elements
const fileDrop = document.getElementById('fileDrop');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const startBtn = document.getElementById('startBtn');
const clearBtn = document.getElementById('clearBtn');
const apiUrlInput = document.getElementById('apiUrl');
const timeoutInput = document.getElementById('timeout');
const searchInput = document.getElementById('search');
const filterStatus = document.getElementById('filterStatus');
const resultsTbody = document.getElementById('results');
const logDiv = document.getElementById('log');
const totalSpan = document.getElementById('total');
const validasSpan = document.getElementById('validas');
const invalidasSpan = document.getElementById('invalidas');
const progressDiv = document.getElementById('progress');

// Initialize
function init() {
    addLog('🚀 Team Starblack Cookies iniciado');
    addLog('📁 Agrega archivos .txt con cookies de Netflix');
    
    const saved = localStorage.getItem('netflix_files');
    if (saved) {
        try {
            archivos = JSON.parse(saved);
            updateFileList();
            addLog(`📂 Cargados ${archivos.length} archivos guardados`);
        } catch(e) {
            localStorage.removeItem('netflix_files');
        }
    }
}

// Drag & Drop handlers
fileDrop.addEventListener('click', () => fileInput.click());
fileDrop.addEventListener('dragover', (e) => {
    e.preventDefault();
    fileDrop.style.borderColor = '#667eea';
    fileDrop.style.background = '#f1f5f9';
});
fileDrop.addEventListener('dragleave', () => {
    fileDrop.style.borderColor = '#cbd5e1';
    fileDrop.style.background = '#f8fafc';
});
fileDrop.addEventListener('drop', (e) => {
    e.preventDefault();
    fileDrop.style.borderColor = '#cbd5e1';
    fileDrop.style.background = '#f8fafc';
    handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

// Handle file selection
function handleFiles(files) {
    Array.from(files).forEach(file => {
        if (file.name.endsWith('.txt')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                archivos.push({
                    name: file.name,
                    content: e.target.result,
                    size: file.size
                });
                updateFileList();
                saveFiles();
                addLog(`✅ Agregado: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
            };
            reader.onerror = () => addLog(`❌ Error leyendo: ${file.name}`);
            reader.readAsText(file);
        } else {
            addLog(`⚠️ ${file.name} no es un archivo .txt`);
        }
    });
}

// Update file list UI
function updateFileList() {
    if (archivos.length === 0) {
        fileList.innerHTML = '<div class="empty-state">No hay archivos seleccionados</div>';
        return;
    }
    
    fileList.innerHTML = archivos.map((file, index) => `
        <div class="file-item">
            <span class="file-name">📄 ${file.name}</span>
            <button class="file-remove" onclick="removeFile(${index})">✗</button>
        </div>
    `).join('');
}

// Remove file
function removeFile(index) {
    const fileName = archivos[index].name;
    archivos.splice(index, 1);
    updateFileList();
    saveFiles();
    addLog(`🗑 Eliminado: ${fileName}`);
}

// Clear all files
clearBtn.addEventListener('click', () => {
    if (confirm('¿Limpiar todos los archivos y resultados?')) {
        archivos = [];
        resultados = [];
        updateFileList();
        updateResults();
        updateStats();
        saveFiles();
        addLog('🧹 Todo ha sido limpiado');
    }
});

// Save files to localStorage
function saveFiles() {
    localStorage.setItem('netflix_files', JSON.stringify(archivos));
}

// Add log message
function addLog(message) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    logEntry.innerHTML = `<span class="log-time">[${timestamp}]</span> ${message}`;
    logDiv.insertBefore(logEntry, logDiv.firstChild);
    
    while (logDiv.children.length > 100) {
        logDiv.removeChild(logDiv.lastChild);
    }
}

// Update statistics
function updateStats() {
    const total = resultados.length;
    const validas = resultados.filter(r => r.estado === 'ACTIVA').length;
    const invalidas = total - validas;
    
    totalSpan.textContent = total;
    validasSpan.textContent = validas;
    invalidasSpan.textContent = invalidas;
}

// Download cookies en formato Netscape
window.downloadCookies = function(index) {
    const result = resultados[index];
    if (!result) {
        addLog(`❌ Error: No se encontró el resultado`);
        return;
    }
    
    if (!result.cookies || typeof result.cookies !== 'object') {
        addLog(`❌ No hay cookies válidas para descargar de ${result.email}`);
        return;
    }
    
    // Crear contenido en formato Netscape
    let content = "# Netscape HTTP Cookie File\n";
    content += "# https://curl.se/docs/http-cookies.html\n";
    content += `# Generated: ${new Date().toLocaleString()}\n`;
    content += `# Email: ${result.email}\n`;
    content += `# Plan: ${result.plan}\n`;
    content += `# Country: ${result.pais}\n`;
    content += `# Membership: ${result.membresia || 'N/A'}\n`;
    content += "# ============by @hacker056============\n\n";
    
    // Escribir cada cookie en formato Netscape
    for (const [name, value] of Object.entries(result.cookies)) {
        if (value && typeof value === 'string') {
            // Limpiar el valor
            const cleanValue = value.replace(/[\n\r\t]/g, '');
            const domain = '.netflix.com';
            const flag = 'TRUE';
            const path = '/';
            const secure = 'TRUE';
            const expiration = Math.floor(Date.now() / 1000) + 31536000; // 1 año
            
            content += `${domain}\t${flag}\t${path}\t${secure}\t${expiration}\t${name}\t${cleanValue}\n`;
        }
    }
    
    // Crear y descargar archivo
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.email.replace(/[^a-z0-9]/gi, '_')}_${result.plan}_cookies.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    addLog(`📥 Descargada: ${result.email} - ${result.plan} (formato Netscape)`);
};

// Update results table
function updateResults() {
    const searchTerm = searchInput.value.toLowerCase();
    const statusFilter = filterStatus.value;
    
    const filtered = resultados.filter((r, idx) => {
        const matchesSearch = (r.email || '').toLowerCase().includes(searchTerm) || 
                             (r.plan || '').toLowerCase().includes(searchTerm);
        const matchesStatus = statusFilter === 'all' || r.estado === statusFilter;
        return matchesSearch && matchesStatus;
    });
    
    if (filtered.length === 0) {
        resultsTbody.innerHTML = '<tr><td colspan="5" class="empty-state">No hay resultados</td></tr>';

        return;
    }
    
    resultsTbody.innerHTML = filtered.map(r => {
        let statusClass = '';
        let statusIcon = '';
        if (r.estado === 'ACTIVA') {
            statusClass = 'status-active';
            statusIcon = '✅';
        } else if (r.estado === 'INVALIDA') {
            statusClass = 'status-invalid';
            statusIcon = '❌';
        } else if (r.estado === 'INACTIVA') {
            statusClass = 'status-inactive';
            statusIcon = '⚠️';
        } else {
            statusIcon = '❓';
        }
        
        // Buscar el índice original para la descarga
        const originalIndex = resultados.findIndex(res => res.email === r.email && res.plan === r.plan);
        
        // Botón de descarga - SOLO para cuentas activas
        const downloadBtn = (r.estado === 'ACTIVA' && r.cookies && Object.keys(r.cookies).length > 0) ? 
            `<button class="btn-download" onclick="downloadCookies(${originalIndex})" title="Descargar cookies (formato Netscape)">📥</button>` : 
            '<span style="color:#999;">-</span>';
        
        return `
            <tr>
                <td>${escapeHtml(r.email || 'N/A')}</td>
                <td>${escapeHtml(r.plan || 'N/A')}</td>
                <td>${escapeHtml(r.pais || 'N/A')}</td>
                <td class="${statusClass}">${statusIcon} ${r.estado}</td>
                <td style="text-align:center;">${downloadBtn}</td>
            </tr>
        `;
    }).join('');
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Search and filter listeners
searchInput.addEventListener('input', updateResults);
filterStatus.addEventListener('change', updateResults);

// Validate single account
async function validateAccount(file) {
    const apiUrl = apiUrlInput.value;
    const timeout = parseInt(timeoutInput.value) * 1000;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cookies: file.content }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success && result.estado === 'ACTIVA') {
            addLog(`✅ ACTIVA: ${result.email} - ${result.plan}`);
            return {
                email: result.email,
                plan: result.plan,
                pais: result.pais,
                membresia: result.membresia || 'N/A',
                perfiles: result.perfiles || 'N/A',
                estado: 'ACTIVA',
                cookies: result.cookies || {}
            };
        } else {
            addLog(`❌ ${file.name}: ${result.mensaje || result.estado || 'INVALIDA'}`);
            return {
                email: file.name.replace('.txt', ''),
                plan: 'N/A',
                pais: 'N/A',
                estado: result.estado || 'INVALIDA',
                cookies: null
            };
        }
        
    } catch (error) {
        clearTimeout(timeoutId);
        addLog(`❌ ${file.name}: ${error.message}`);
        return {
            email: file.name.replace('.txt', ''),
            plan: 'N/A',
            pais: 'N/A',
            estado: 'ERROR',
            cookies: null
        };
    }
}

// Start validation
async function startValidation() {
    if (archivos.length === 0) {
        alert('❌ Agrega archivos de cookies primero');
        return;
    }
    
    if (isValidating) {
        alert('⚠️ Ya hay una validación en curso');
        return;
    }
    
    isValidating = true;
    startBtn.disabled = true;
    startBtn.textContent = '⏳ VALIDANDO...';
    
    resultados = [];
    updateResults();
    updateStats();
    progressDiv.style.width = '0%';
    progressDiv.textContent = '0%';
    
    addLog(`🚀 Iniciando validación de ${archivos.length} archivos`);
    addLog(`⚙️ Configuración: Timeout=${timeoutInput.value}s, API=${apiUrlInput.value}`);
    
    let procesados = 0;
    const total = archivos.length;
    
    // Process one by one
    for (let i = 0; i < archivos.length; i++) {
        const result = await validateAccount(archivos[i]);
        resultados.push(result);
        procesados++;
        
        const percent = (procesados / total) * 100;
        progressDiv.style.width = percent + '%';
        progressDiv.textContent = Math.round(percent) + '%';
        
        updateResults();
        updateStats();
        addLog(`📊 Progreso: ${procesados}/${total} (${Math.round(percent)}%)`);
    }
    
    const validas = resultados.filter(r => r.estado === 'ACTIVA').length;
    addLog(`✨ VALIDACIÓN COMPLETADA!`);
    addLog(`📈 Resultados: ${validas} válidas / ${total} totales`);
    
    startBtn.disabled = false;
    startBtn.textContent = '▶ INICIAR VALIDACIÓN';
    isValidating = false;
    
    alert(`✅ Validación completada!\n\n📊 Válidas: ${validas}\n📁 Total: ${total}\n\n💾 Las cookies válidas se descargan en formato Netscape`);
}

startBtn.addEventListener('click', startValidation);

// Initialize
init();