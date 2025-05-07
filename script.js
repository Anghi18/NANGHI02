// Configuración Firebase
const firebaseConfig = {
    apiKey: "TU_API_KEY",
    authDomain: "TU_PROYECTO.firebaseapp.com",
    databaseURL: "https://TU_PROYECTO.firebaseio.com",
    projectId: "TU_PROYECTO",
    storageBucket: "TU_PROYECTO.appspot.com",
    messagingSenderId: "TU_SENDER_ID",
    appId: "TU_APP_ID"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();

// Variables globales
let appData = {
    source: null,
    data: [],
    charts: {},
    usuario: null,
    proyectoActual: null
};

let sCurveChart = null;
let comparacionChart = null;
let intervaloActualizacion = null;

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    setupFirebaseListeners();
    mostrarLogin();
});

// Configurar listeners de Firebase
function setupFirebaseListeners() {
    // Autenticación
    auth.onAuthStateChanged(user => {
        if (user) {
            appData.usuario = {
                uid: user.uid,
                email: user.email,
                nombre: user.displayName || user.email.split('@')[0]
            };
            cargarProyectosUsuario();
        } else {
            appData.usuario = null;
            mostrarLogin();
        }
    });

    // Escuchar cambios colaborativos
    database.ref('presencia').on('value', snapshot => {
        const usuarios = snapshot.numChildren();
        document.getElementById('collaborators').textContent = `${usuers} usuario(s) activo(s)`;
    });
}

// Configurar event listeners
function setupEventListeners() {
    // Login y Registro
    document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
    document.getElementById('registerBtn')?.addEventListener('click', mostrarRegistro);

    // Menús desplegables
    const menuButtons = ['userBtn', 'menuBtn', 'userBtnAnalisis', 'menuBtnAnalisis', 'userBtnReportes', 'menuBtnReportes'];
    menuButtons.forEach(btn => {
        document.getElementById(btn)?.addEventListener('click', () => toggleDropdown(`dropdown${btn.replace('user', '').replace('menu', '')}`));
    });

    // Navegación
    const navLinks = [
        'analisisLink', 'reportesLink', 'logoutLink',
        'presupuestoLink', 'reportesLinkAnalisis', 'logoutLinkAnalisis',
        'presupuestoLinkReportes', 'analisisLinkReportes', 'logoutLinkReportes'
    ];
    navLinks.forEach(link => {
        document.getElementById(link)?.addEventListener('click', handleNavLink);
    });

    // Botones principales
    document.getElementById('backBtn')?.addEventListener('click', () => mostrarSeccion('presupuesto'));
    document.getElementById('volverBtn')?.addEventListener('click', () => mostrarSeccion('analisis'));
    document.getElementById('closeModal')?.addEventListener('click', cerrarModal);
    document.getElementById('generateAnalysis')?.addEventListener('click', generarAnalisis);
    document.getElementById('generateReportBtn')?.addEventListener('click', () => mostrarSeccion('reportes'));
    document.getElementById('exportPdfBtn')?.addEventListener('click', exportarPDF);
    document.getElementById('sendEmailBtn')?.addEventListener('click', enviarEmailReporte);
    document.getElementById('downloadTemplate')?.addEventListener('click', descargarPlantilla);
    document.getElementById('googleSheetsBtn')?.addEventListener('click', conectarGoogleSheets);
    document.getElementById('generateAnalysisFromSheets')?.addEventListener('click', cargarDatosDesdeSheets);
    document.getElementById('refreshDataBtn')?.addEventListener('click', actualizarDatos);
    document.getElementById('excelInput')?.addEventListener('change', handleFileUpload);

    // Pestañas institucionales
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            mostrarTab(tabId);
        });
    });
}

// Manejar login con Firebase
function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    auth.signInWithEmailAndPassword(email, password)
        .then(() => {
            mostrarNotificacion('Inicio de sesión exitoso');
            mostrarSeccion('presupuesto');
        })
        .catch(error => {
            mostrarNotificacion(error.message, true);
        });
}

// Manejar registro con Firebase
function handleRegister(e) {
    e.preventDefault();
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;

    if (password !== confirmPassword) {
        mostrarNotificacion('Las contraseñas no coinciden', true);
        return;
    }

    auth.createUserWithEmailAndPassword(email, password)
        .then(() => {
            mostrarNotificacion('Registro exitoso. Por favor inicia sesión');
            mostrarLogin();
        })
        .catch(error => {
            mostrarNotificacion(error.message, true);
        });
}

// Mostrar secciones
function mostrarSeccion(seccion) {
    ocularTodasSecciones();
    
    switch(seccion) {
        case 'login':
            document.getElementById('loginSection').style.display = 'flex';
            break;
        case 'presupuesto':
            document.getElementById('presupuestoSection').style.display = 'block';
            break;
        case 'analisis':
            document.getElementById('analisisSection').style.display = 'block';
            if (appData.data.length > 0) procesarDatosAnalisis(appData.data);
            break;
        case 'reportes':
            document.getElementById('reportesSection').style.display = 'block';
            if (!appData.charts.initialized && appData.data.length > 0) inicializarGraficos();
            break;
    }
}

// Procesar datos de análisis
function procesarDatosAnalisis(data) {
    const tbody = document.getElementById('analisisTableBody');
    const alertList = document.getElementById('alertList');
    
    tbody.innerHTML = '';
    alertList.innerHTML = '';
    
    data.forEach((row, index) => {
        if (index === 0 || !row.item) return;
        
        const planificado = parseFloat(row.planificado) || 0;
        const real = parseFloat(row.real) || 0;
        const desviacion = real - planificado;
        const porcentaje = planificado !== 0 ? (desviacion / planificado * 100).toFixed(1) : 0;
        const sobrecosto = desviacion > 0 ? desviacion : 0;
        
        const rowHTML = `
            <tr>
                <td>${row.item}</td>
                <td>${planificado.toLocaleString('es-PE', {style: 'currency', currency: 'PEN'})}</td>
                <td>${real.toLocaleString('es-PE', {style: 'currency', currency: 'PEN'})}</td>
                <td class="${desviacion >= 0 ? 'up' : 'down'}">
                    ${Math.abs(porcentaje)}% ${desviacion >= 0 ? '▲' : '▼'}
                </td>
                <td>${sobrecosto.toLocaleString('es-PE', {style: 'currency', currency: 'PEN'})}</td>
                <td>
                    <select class="cause-select">
                        <option value="">Seleccionar causa</option>
                        <option value="retraso">Retraso en entrega</option>
                        <option value="inflacion">Inflación de precios</option>
                        <option value="error">Error en estimación</option>
                    </select>
                </td>
                <td>
                    <input type="text" class="recommendation-input" placeholder="Ingrese recomendación">
                </td>
            </tr>
        `;
        tbody.innerHTML += rowHTML;
        
        if (Math.abs(porcentaje) > 10) {
            alertList.innerHTML += `
                <li>
                    <strong>${row.item}</strong>: ${porcentaje >= 0 ? '+' : ''}${porcentaje}%
                    (${desviacion.toLocaleString('es-PE', {style: 'currency', currency: 'PEN'})})
                </li>
            `;
        }
    });
    
    // Actualizar Firebase con los nuevos datos
    if (appData.proyectoActual) {
        database.ref(`proyectos/${appData.proyectoActual}`).update({
            data: data,
            lastUpdated: firebase.database.ServerValue.TIMESTAMP
        });
    }
}

// Inicializar gráficos
function inicializarGraficos() {
    // Destruir gráficos existentes
    if (sCurveChart) sCurveChart.destroy();
    if (comparacionChart) comparacionChart.destroy();
    
    // Datos para gráficos
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'];
    const items = appData.data.slice(1, 6).map(row => row.item);
    const planificado = appData.data.slice(1, 6).map(row => parseFloat(row.planificado) || 0);
    const real = appData.data.slice(1, 6).map(row => parseFloat(row.real) || 0);
    
    // Curva S
    sCurveChart = new Chart(
        document.getElementById('sCurveChart'),
        {
            type: 'line',
            data: {
                labels: meses,
                datasets: [
                    {
                        label: 'Planificado',
                        data: [10, 25, 50, 75, 90, 100],
                        borderColor: '#4e4376',
                        backgroundColor: 'rgba(78, 67, 118, 0.1)',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Real',
                        data: [8, 20, 45, 60, 75, 82],
                        borderColor: '#2b5876',
                        backgroundColor: 'rgba(43, 88, 118, 0.1)',
                        tension: 0.4,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const label = context.dataset.label || '';
                                const value = context.parsed.y;
                                const desviacion = context.datasetIndex === 1 ? 
                                    value - context.chart.data.datasets[0].data[context.dataIndex] : 0;
                                return `${label}: ${value}% ${desviacion !== 0 ? `(Desv: ${desviacion > 0 ? '+' : ''}${desviacion}%)` : ''}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        min: 0,
                        max: 100,
                        title: {
                            display: true,
                            text: 'Porcentaje de Avance'
                        }
                    }
                }
            }
        }
    );
    
    // Gráfico de comparación
    comparacionChart = new Chart(
        document.getElementById('comparacionChart'),
        {
            type: 'bar',
            data: {
                labels: items,
                datasets: [
                    {
                        label: 'Planificado',
                        data: planificado,
                        backgroundColor: '#4e4376'
                    },
                    {
                        label: 'Real',
                        data: real,
                        backgroundColor: '#2b5876'
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const label = context.dataset.label || '';
                                const value = context.parsed.y.toLocaleString('es-PE', {style: 'currency', currency: 'PEN'});
                                const desviacion = context.datasetIndex === 1 ? 
                                    context.parsed.y - context.chart.data.datasets[0].data[context.dataIndex] : 0;
                                return `${label}: ${value} ${desviacion !== 0 ? `(Desv: ${desviacion > 0 ? '+' : ''}${desviacion.toLocaleString('es-PE', {style: 'currency', currency: 'PEN'})})` : ''}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Monto (PEN)'
                        }
                    }
                }
            }
        }
    );
    
    appData.charts.initialized = true;
}

// Exportar a PDF
function exportarPDF() {
    const element = document.getElementById('reportesSection');
    const buttons = document.querySelectorAll('.reportes-actions button');
    
    buttons.forEach(btn => btn.style.visibility = 'hidden');
    
    html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#FFFFFF'
    }).then(canvas => {
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const pdfWidth = pdf.internal.pageSize.getWidth() - 20;
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        pdf.addImage(imgData, 'JPEG', 10, 10, pdfWidth, pdfHeight);
        pdf.save(`reporte_${appData.proyectoActual || 'nanghi'}.pdf`);
    }).finally(() => {
        buttons.forEach(btn => btn.style.visibility = 'visible');
    });
}

// Enviar reporte por email
function enviarEmailReporte() {
    mostrarNotificacion('Preparando envío de reporte...');
    // Implementar integración con EmailJS o backend
}

// Resto de funciones auxiliares (toggleDropdown, mostrarNotificacion, etc.)
// ... (se mantienen similares pero actualizadas para usar Firebase)

// Inicializar presencia de usuario
function iniciarPresenciaUsuario() {
    const presenciaRef = database.ref(`presencia/${appData.usuario.uid}`);
    
    presenciaRef.onDisconnect().remove();
    presenciaRef.set({
        nombre: appData.usuario.nombre,
        email: appData.usuario.email,
        ultimaConexion: firebase.database.ServerValue.TIMESTAMP
    });
}

// Cargar proyectos del usuario
function cargarProyectosUsuario() {
    database.ref(`usuarios/${appData.usuario.uid}/proyectos`).once('value').then(snapshot => {
        const proyectos = snapshot.val() || [];
        // Actualizar UI con proyectos disponibles
    });
}
