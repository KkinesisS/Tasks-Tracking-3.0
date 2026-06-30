// MRO Maintenance Task Tracker Logic

// State Management
let tasks = [];
let fyiItems = [];
let activeFyiTeam = 'All Teams';
let sapCodes = [];
function initSupabase() {
    const localUrl = localStorage.getItem('mro_supabase_url');
    const localKey = localStorage.getItem('mro_supabase_anon_key');
    
    if (localUrl && localKey) {
        window.supabaseUrl = localUrl;
        window.supabaseKey = localKey;
    }
    
    if (window.supabaseUrl && window.supabaseKey && window.supabaseUrl !== 'YOUR_SUPABASE_URL' && window.supabaseKey !== 'YOUR_SUPABASE_ANON_KEY' && typeof supabase !== 'undefined') {
        try {
            window.supabaseClient = supabase.createClient(window.supabaseUrl, window.supabaseKey);
            console.log('Supabase client initialized successfully!');
        } catch (e) {
            console.error('Failed to initialize Supabase client:', e);
            window.supabaseClient = null;
        }
    } else {
        if (!localUrl && !localKey && window.supabaseUrl === 'YOUR_SUPABASE_URL') {
            window.supabaseClient = null;
        }
    }
}

let activeFilters = {
    search: '',
    team: 'All',
    priority: 'All',
    status: 'All',
    viewMode: 'kanban' // 'kanban' or 'list'
};

// Temp store for attachments during form editing
let formAttachments = [];

// Track active task inside Details Modal
let activeDetailsTaskId = null;

// Helper: Calculate relative date from 2026-06-17T22:01:02+07:00
function getRelativeDateString(daysOffset) {
    const baseDate = new Date('2026-06-17T22:01:02+07:00');
    baseDate.setDate(baseDate.getDate() + daysOffset);
    return baseDate.toISOString().split('T')[0];
}

// Initial Demo Data
const DEMO_TASKS = [
    {
        id: 'task-1',
        aircraftReg: 'HS-TBA',
        aircraftType: 'A320',
        ataChapter: '31',
        createdDate: getRelativeDateString(-3),
        rtsDate: getRelativeDateString(1), // Tomorrow
        assignedTeam: 'Avionic Systems Team',
        requestor: 'Capt. Kittisak P. (Flt Ops)',
        requestorContact: 'kittisak.p@mro-ops.com',
        priorityLevel: 'AOG',
        taskDescription: 'Primary flight display (PFD 1) flickering during pre-flight checks. Intermittent power interruption detected on DC Bus 1. Need Avionic team to troubleshoot wire bundle connections behind cockpit panel and run digital bus analyzer diagnostics.',
        currentStatus: 'In Progress',
        attachments: [
            { name: 'PFD_flicker_log.txt', size: 1024, type: 'text/plain', data: 'data:text/plain;base64,RkFVTFQgTE9HOiBQRkQtMSBwb3dlciBmbHVjdHVhdGlvbiBkZXRlY3RlZC4gQnVzIHZvbHRhZ2UgZHJvcHBlZCB0byAyMC41ViBEQyBzcG9yYWRpY2FsbHku' }
        ],
        comments: [
            {
                author: 'S. Somchai (Lead Tech)',
                text: 'Tested wiring bundle and found corrosion on connector plug pins. Cleaned pins and re-seated the connector. Flicker rate decreased but still present. Conducting digital bus analyzer diagnostics next.',
                timestamp: '2026-06-17T22:30:00+07:00'
            }
        ]
    },
    {
        id: 'task-2',
        aircraftReg: 'N-9875A',
        aircraftType: 'B737-800',
        ataChapter: '32',
        createdDate: getRelativeDateString(-2),
        rtsDate: getRelativeDateString(2),
        assignedTeam: 'Mechanical System Team',
        requestor: 'S. Somchai (Lead Tech)',
        requestorContact: 'somchai.s@mro-tech.com',
        priorityLevel: 'High',
        taskDescription: 'Nose wheel steering actuator cylinder leaking hydraulic fluid (Skydrol) beyond acceptable limits. Replace primary cylinder seals, bleed the nose gear steering hydraulic lines, and conduct steering system travel test.',
        currentStatus: 'Open',
        attachments: [],
        comments: []
    },
    {
        id: 'task-3',
        aircraftReg: 'HS-TBC',
        aircraftType: 'B777-300ER',
        ataChapter: '72',
        createdDate: getRelativeDateString(-4),
        rtsDate: getRelativeDateString(5),
        assignedTeam: 'Engines Team',
        requestor: 'John Doe (Engine Insp.)',
        requestorContact: 'john.doe@mro-insp.com',
        priorityLevel: 'Medium',
        taskDescription: 'Left engine (Trent 700) scheduled borescope inspection of the 3rd stage HP compressor blades. Check for erosion, thermal cracking, or foreign object damage (FOD). Record video feed for engineering approval.',
        currentStatus: 'In Progress',
        attachments: [
            { name: 'bore_inspect_order.pdf', size: 2048, type: 'application/pdf', data: 'data:application/pdf;base64,SlVTVCBBIERVTU1ZIFBERiBDT05URU5UIEZPUiBCT1JFU0NPUEUgSU5TUEVDVElPTg==' }
        ],
        comments: []
    },
    {
        id: 'task-4',
        aircraftReg: 'HS-TBD',
        aircraftType: 'A320',
        ataChapter: '57',
        createdDate: getRelativeDateString(-5),
        rtsDate: getRelativeDateString(10),
        assignedTeam: 'Structure Team',
        requestor: 'Eng. Sarah Connor',
        requestorContact: 's.connor@mro-struct.com',
        priorityLevel: 'Low',
        taskDescription: 'Slight delamination noted on the composite honeycomb structure of the trailing edge panel, right flap. Perform non-destructive testing (ultrasonic tap test) to evaluate defect depth and draft composite repair plan.',
        currentStatus: 'Open',
        attachments: [],
        comments: []
    },
    {
        id: 'task-5',
        aircraftReg: 'N-423SP',
        aircraftType: 'B737-800',
        ataChapter: '79',
        createdDate: getRelativeDateString(-6),
        rtsDate: getRelativeDateString(-2), // 2 days ago
        assignedTeam: 'Engines Team',
        requestor: 'Insp. Mark R.',
        requestorContact: 'mark.r@mro-engines.com',
        priorityLevel: 'High',
        taskDescription: 'Right engine oil pressure indicator reading intermittently low. Replaced engine oil pressure transmitter (P/N 45-8902-1) and performed engine ground run-up. Oil pressure readings returned to nominal limits.',
        currentStatus: 'Completed',
        attachments: [],
        comments: []
    }
];

// Initialize Application
function startApp() {
    initSupabase();
    // Set Power Automate Webhook URL for OneDrive syncing if not configured or if using the old signature-less URL
    const newDefaultUrl = 'https://defaultc71838d2745b4a4fb00f2d0e6e1de6.f3.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/bd6fa12380224456960c9003b9f37992/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=3z3pW754II2nFkKkReGGm2xXiiIH1piGeaphI7Z60zs';
    const storedUrl = localStorage.getItem('mro_power_automate_url') || 'https://defaultc71838d2745b4a4fb00f2d0e6e1de6.f3.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/bd6fa12380224456960c9003b9f37992/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=3z3pW754II2nFkKkReGGm2xXiiIH1piGeaphI7Z60zs';
    if (storedUrl === null || 
        storedUrl.includes('6aaa2f5c468f4ccc949d5a9f61a8ac9b') || 
        storedUrl.includes('ae6281c30602447b82eb4739ee110dcf') ||
        (storedUrl.includes('bd6fa12380224456960c9003b9f37992') && storedUrl !== newDefaultUrl) ||
        (storedUrl.includes('defaultc71838d2745b4a4fb00f2d0e6e1de6') && storedUrl !== newDefaultUrl)) {
        localStorage.setItem('mro_power_automate_url', newDefaultUrl);
    }

    // Set default Webhook URL for OneDrive file deletion if not configured
    const newDefaultDeleteUrl = 'https://defaultc71838d2745b4a4fb00f2d0e6e1de6.f3.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/b3812d58a78441ec957d93d98a1be233/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=7SgUjBpzW-lrGQvwJ1o0hRwSUitueC3gvb_DwG8QYW8';
    const storedDeleteUrl = localStorage.getItem('mro_power_automate_delete_url');
    if (storedDeleteUrl === null || 
        storedDeleteUrl.trim() === '' || 
        storedDeleteUrl !== newDefaultDeleteUrl) {
        localStorage.setItem('mro_power_automate_delete_url', newDefaultDeleteUrl);
    }

    // Copy main logo to login logo dynamically to avoid duplicate base64 string
    const mainLogo = document.querySelector('.app-logo');
    const loginLogo = document.getElementById('loginCardLogo');
    if (mainLogo && loginLogo) {
        loginLogo.src = mainLogo.src;
    }

    checkAuthentication();
    
    // Bind login form submit
    document.getElementById('loginSubmitBtn')?.addEventListener('click', handleLogin);
    
    // Enter key support for login form
    const triggerLoginOnEnter = (e) => {
        if (e.key === 'Enter') {
            handleLogin();
        }
    };
    document.getElementById('loginCode')?.addEventListener('keydown', triggerLoginOnEnter);
    document.getElementById('loginName')?.addEventListener('keydown', triggerLoginOnEnter);

    // Bind logout button
    document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);

    // Start header clock
    startHeaderClock();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    startApp();
}

// Check current authentication state
function checkAuthentication() {
    const sessionAuth = sessionStorage.getItem('mro_authenticated');
    const localAuth = localStorage.getItem('mro_authenticated');
    
    if (sessionAuth === 'true' || localAuth === 'true') {
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('appContainer').style.display = 'block';
        
        // Track online presence
        const username = sessionStorage.getItem('mro_user') || localStorage.getItem('mro_user') || 'DMA Staff';
        const role = sessionStorage.getItem('mro_user_role') || localStorage.getItem('mro_user_role') || 'Administrator';
        if (typeof window.trackPresence === 'function') {
            window.trackPresence(username, role);
        }
        
        initApp();
        setupEventListeners();
    } else {
        document.getElementById('loginOverlay').style.display = 'flex';
        document.getElementById('appContainer').style.display = 'none';
    }
}

// Handle login submission
function handleLogin() {
    const nameEl = document.getElementById('loginName');
    const codeEl = document.getElementById('loginCode');
    const rememberMeEl = document.getElementById('loginRememberMe');
    const errorEl = document.getElementById('loginError');
    const btnTextEl = document.getElementById('loginBtnText');
    const spinnerEl = document.getElementById('loginSpinner');
    
    if (!codeEl) return;
    
    const usernameInput = nameEl ? nameEl.value.trim() : '';
    const passcode = codeEl.value.trim();
    
    if (!usernameInput) {
        showLoginError('Please enter your name.');
        return;
    }
    
    if (!passcode) {
        showLoginError('Please enter access code.');
        return;
    }
    
    if (spinnerEl) spinnerEl.classList.remove('hidden');
    if (btnTextEl) btnTextEl.textContent = 'Authenticating...';
    if (errorEl) errorEl.classList.add('hidden');
    
    const isGas = typeof google !== 'undefined' && google.script && google.script.run;
    if (isGas) {
        google.script.run
            .withSuccessHandler((authResult) => {
                if (spinnerEl) spinnerEl.classList.add('hidden');
                if (btnTextEl) btnTextEl.textContent = 'Sign In';
                
                if (authResult.success) {
                    sessionStorage.setItem('mro_authenticated', 'true');
                    sessionStorage.setItem('mro_user', usernameInput);
                    sessionStorage.setItem('mro_user_role', authResult.user.role);
                    
                    if (rememberMeEl && rememberMeEl.checked) {
                        localStorage.setItem('mro_authenticated', 'true');
                        localStorage.setItem('mro_user', usernameInput);
                        localStorage.setItem('mro_user_role', authResult.user.role);
                    }
                    
                    // Track online presence
                    if (typeof window.trackPresence === 'function') {
                        window.trackPresence(usernameInput, authResult.user.role);
                    }
                    
                    document.getElementById('loginOverlay').style.display = 'none';
                    document.getElementById('appContainer').style.display = 'block';
                    initApp();
                    setupEventListeners();
                } else {
                    showLoginError(authResult.message || 'Invalid access code.');
                }
            })
            .withFailureHandler((err) => {
                if (spinnerEl) spinnerEl.classList.add('hidden');
                if (btnTextEl) btnTextEl.textContent = 'Sign In';
                showLoginError('Connection error: ' + err.message);
            })
            .authenticateUser(passcode);
    } else {
        // Local testing fallback
        setTimeout(() => {
            if (spinnerEl) spinnerEl.classList.add('hidden');
            if (btnTextEl) btnTextEl.textContent = 'Sign In';
            
            if (passcode.toUpperCase() === 'DMA') {
                sessionStorage.setItem('mro_authenticated', 'true');
                sessionStorage.setItem('mro_user', usernameInput);
                sessionStorage.setItem('mro_user_role', 'Administrator');
                
                if (rememberMeEl && rememberMeEl.checked) {
                    localStorage.setItem('mro_authenticated', 'true');
                    localStorage.setItem('mro_user', usernameInput);
                    localStorage.setItem('mro_user_role', 'Administrator');
                }
                
                // Track online presence
                if (typeof window.trackPresence === 'function') {
                    window.trackPresence(usernameInput, 'Administrator');
                }
                
                document.getElementById('loginOverlay').style.display = 'none';
                document.getElementById('appContainer').style.display = 'block';
                initApp();
                setupEventListeners();
            } else {
                showLoginError('Invalid access code.');
            }
        }, 800);
    }
}

// Show login error messages
function showLoginError(msg) {
    const errorEl = document.getElementById('loginError');
    if (errorEl) {
        errorEl.textContent = msg;
        errorEl.classList.remove('hidden');
    }
}

// Handle logout action
function handleLogout() {
    if (confirm('Are you sure you want to sign out?')) {
        sessionStorage.removeItem('mro_authenticated');
        sessionStorage.removeItem('mro_user');
        sessionStorage.removeItem('mro_user_role');
        
        localStorage.removeItem('mro_authenticated');
        localStorage.removeItem('mro_user');
        localStorage.removeItem('mro_user_role');
        
        window.location.reload();
    }
}

// Update visual sync indicator status
function updateSyncIndicator(status, message) {
    const dot = document.getElementById('syncDot');
    const text = document.getElementById('syncText');
    const container = document.getElementById('syncIndicator');
    if (!dot || !text || !container) return;
    
    text.textContent = message;
    if (status === 'syncing') {
        dot.style.background = '#ca8a04'; // Amber
        dot.style.boxShadow = '0 0 8px #ca8a04';
        container.style.opacity = '1';
    } else if (status === 'success') {
        dot.style.background = '#16a34a'; // Green
        dot.style.boxShadow = '0 0 8px #16a34a';
        setTimeout(() => {
            if (text.textContent === 'Cloud Synced') {
                container.style.opacity = '0.6';
            }
        }, 4000);
    } else if (status === 'error') {
        dot.style.background = '#dc2626'; // Red
        dot.style.boxShadow = '0 0 8px #dc2626';
        container.style.opacity = '1';
    } else if (status === 'offline') {
        dot.style.background = '#64748b'; // Gray
        dot.style.boxShadow = 'none';
        container.style.opacity = '0.6';
    }
}

function initApp() {
    const isGas = typeof google !== 'undefined' && google.script && google.script.run;
    const tomorrow = getRelativeDateString(1);
    document.getElementById('rtsDate').value = tomorrow;
    document.getElementById('rtsDate').min = getRelativeDateString(0);
    
    // 1. Instant Cache Load (Zero-latency startup)
    const localData = localStorage.getItem('mro_tasks');
    let loaded = false;
    if (localData && localData !== 'null' && localData !== 'undefined') {
        try {
            tasks = JSON.parse(localData);
            if (Array.isArray(tasks)) {
                // Normalize attributes
                tasks.forEach(t => {
                    t.comments = t.comments || [];
                    t.attachments = t.attachments || [];
                });
                renderApp();
                updateSyncIndicator('syncing', 'Syncing...');
                loaded = true;
            }
        } catch(e) {
            tasks = [];
        }
    }
    if (!loaded) {
        // If cache empty or invalid, seed with demo tasks first so page is never blank
        tasks = [...DEMO_TASKS];
        renderApp();
        updateSyncIndicator('syncing', 'Syncing (First Load)...');
    }
    
    if (isGas || (typeof window.supabaseClient !== 'undefined' && window.supabaseClient !== null)) {
        refreshTasksSilently();
    } else {
        updateSyncIndicator('offline', 'Offline Mode');
    }

    // Load FYI bulletins
    loadFYIs();

    // Load SAP codes
    loadSAPCodes();
}

function refreshTasksSilently() {
    const isGas = typeof google !== 'undefined' && google.script && google.script.run;
    const hasSupabase = typeof window.supabaseClient !== 'undefined' && window.supabaseClient !== null;
    if (!isGas && !hasSupabase) return;
    
    google.script.run
        .withSuccessHandler(data => {
            const localData = localStorage.getItem('mro_tasks');
            if (data && Array.isArray(data)) {
                if (data.length > 0) {
                    tasks = data;
                    saveToLocalStorage();
                    renderApp();
                } else if (data.length === 0 && (!localData || localData === 'null' || localData === 'undefined')) {
                    // Seed if entirely empty
                    tasks = [...DEMO_TASKS];
                    saveToLocalStorage();
                    tasks.forEach(t => google.script.run.saveTask(t));
                    renderApp();
                }
            }
            updateSyncIndicator('success', 'Cloud Synced');
        })
        .withFailureHandler(err => {
            console.error('Failed to sync tasks:', err);
            updateSyncIndicator('error', 'Sync Failed');
        })
        .getTasks();
}
window.refreshTasksSilently = refreshTasksSilently;

function refreshFYIsSilently() {
    const isGas = typeof google !== 'undefined' && google.script && google.script.run;
    const hasSupabase = typeof window.supabaseClient !== 'undefined' && window.supabaseClient !== null;
    if (!isGas && !hasSupabase) return;

    google.script.run
        .withSuccessHandler(data => {
            const localData = localStorage.getItem('mro_fyi_items');
            if (data && Array.isArray(data)) {
                if (data.length > 0) {
                    fyiItems = data;
                    localStorage.setItem('mro_fyi_items', JSON.stringify(fyiItems));
                    if (document.getElementById('fyiTab') && !document.getElementById('fyiTab').classList.contains('hidden')) {
                        renderFYITab();
                    }
                } else if (data.length === 0 && (!localData || localData === 'null' || localData === 'undefined')) {
                    // Seed default FYI data
                    fyiItems = [
                        { id: 'fyi-1', team: 'Mechanical System Team', title: 'Hydraulic Seals Batch Warning', content: 'Alert: Part number H-5512 seals from batch 2026-A have reported premature wear. Please double check all installs during this week.', sapTCode: 'MB21', dateCreated: '2026-06-17' },
                        { id: 'fyi-2', team: 'Avionic Systems Team', title: 'Software Version 2.4 Diagnostic Tool', content: 'Diagnostic tool tablets have been updated to v2.4. Ensure to sync before cockpit troubleshooting.', sapTCode: 'IW31', dateCreated: '2026-06-16' },
                        { id: 'fyi-3', team: 'Structure Team', title: 'Composite Curing Tent Temperature', content: 'Reminder: Tent #2 heating element is running 5\u00B0C hot. Monitor temperature manually during cure cycles.', sapTCode: 'IW32', dateCreated: '2026-06-15' }
                    ];
                    localStorage.setItem('mro_fyi_items', JSON.stringify(fyiItems));
                    fyiItems.forEach(item => google.script.run.saveFYI(item));
                    if (document.getElementById('fyiTab') && !document.getElementById('fyiTab').classList.contains('hidden')) {
                        renderFYITab();
                    }
                }
            }
        })
        .getFYIs();
}
window.refreshFYIsSilently = refreshFYIsSilently;

function refreshSAPCodesSilently() {
    const isGas = typeof google !== 'undefined' && google.script && google.script.run;
    const hasSupabase = typeof window.supabaseClient !== 'undefined' && window.supabaseClient !== null;
    if (!isGas && !hasSupabase) return;

    google.script.run
        .withSuccessHandler(data => {
            const localData = localStorage.getItem('mro_sap_codes');
            if (data && Array.isArray(data)) {
                if (data.length > 0) {
                    sapCodes = data;
                    localStorage.setItem('mro_sap_codes', JSON.stringify(sapCodes));
                    if (document.getElementById('sapTab') && !document.getElementById('sapTab').classList.contains('hidden')) {
                        renderSAPTab();
                    }
                } else if (data.length === 0 && (!localData || localData === 'null' || localData === 'undefined')) {
                    // Seed default material codes
                    sapCodes = [
                        { id: '10045239', description: 'Self-locking nut specification drawing (MS21042-3)', sourceFile: 'https://www.google.com/search?q=MS21042-3+specification' },
                        { id: '10088219', description: 'Hydraulic system seal o-ring specification (O-RING-2-214)', sourceFile: 'https://www.google.com/search?q=O-RING-2-214+datasheet' },
                        { id: '10023490', description: 'Pitot static tube assembly schematic manual (2282000-11)', sourceFile: 'https://www.google.com/search?q=2282000-11+manual' },
                        { id: '10011928', description: 'A320 landing gear bypass pin illustration (300-039-102-0)', sourceFile: 'https://www.google.com/search?q=300-039-102-0+bypass+pin' },
                        { id: '10099438', description: 'Engine fuel filter element drawing (4500-A22)', sourceFile: 'https://www.google.com/search?q=4500-A22+fuel+filter' }
                    ];
                    localStorage.setItem('mro_sap_codes', JSON.stringify(sapCodes));
                    sapCodes.forEach(item => google.script.run.saveSAPCode(item));
                    if (document.getElementById('sapTab') && !document.getElementById('sapTab').classList.contains('hidden')) {
                        renderSAPTab();
                    }
                }
            }
        })
        .getSAPCodes();
}
window.refreshSAPCodesSilently = refreshSAPCodesSilently;

function loadLocalApp() {
    const localData = localStorage.getItem('mro_tasks');
    let loaded = false;
    if (localData && localData !== 'null' && localData !== 'undefined') {
        try {
            tasks = JSON.parse(localData);
            if (Array.isArray(tasks)) {
                tasks.forEach(task => {
                    task.comments = task.comments || [];
                    if (task.aircraftType === 'B737') task.aircraftType = 'B737-800';
                    else if (task.aircraftType === 'B777') task.aircraftType = 'B777-300ER';
                    else if (task.aircraftType === 'B787') task.aircraftType = 'B787-8';
                    else if (task.aircraftType === 'A350') task.aircraftType = 'A350-900';
                    else if (task.aircraftType === 'A330') task.aircraftType = 'A330-300';

                    if (!task.aircraftType) {
                        if (task.aircraftReg === 'HS-TBA') task.aircraftType = 'A320';
                        else if (task.aircraftReg === 'N-9875A') task.aircraftType = 'B737-800';
                        else if (task.aircraftReg === 'HS-TBC') task.aircraftType = 'B777-300ER';
                        else if (task.aircraftReg === 'HS-TBD') task.aircraftType = 'A320';
                        else if (task.aircraftReg === 'N-423SP') task.aircraftType = 'B737-800';
                        else {
                            if (task.aircraftReg.startsWith('HS-')) {
                                task.aircraftType = 'A320';
                            } else if (task.aircraftReg.startsWith('N-')) {
                                task.aircraftType = 'B737-800';
                            } else {
                                task.aircraftType = 'A320';
                            }
                        }
                    }
                });
                saveToLocalStorage();
                loaded = true;
            }
        } catch(e) {
            tasks = [];
        }
    }
    if (!loaded) {
        tasks = [...DEMO_TASKS];
        saveToLocalStorage();
    }
    const tomorrow = getRelativeDateString(1);
    document.getElementById('rtsDate').value = tomorrow;
    document.getElementById('rtsDate').min = getRelativeDateString(0);
    renderApp();
}

function saveToLocalStorage() {
    localStorage.setItem('mro_tasks', JSON.stringify(tasks));
}

function saveTaskData(task) {
    saveToLocalStorage();
    const isGas = typeof google !== 'undefined' && google.script && google.script.run;
    const hasSupabase = typeof window.supabaseClient !== 'undefined' && window.supabaseClient !== null;
    if ((isGas || hasSupabase) && task) {
        google.script.run.saveTask(task);
    }
}

function deleteTaskData(id) {
    saveToLocalStorage();
    const isGas = typeof google !== 'undefined' && google.script && google.script.run;
    const hasSupabase = typeof window.supabaseClient !== 'undefined' && window.supabaseClient !== null;
    if ((isGas || hasSupabase) && id) {
        google.script.run.deleteTask(id);
    }
}

function showLoadingIndicator(show, message) {
    let loader = document.getElementById('gas-loader-overlay');
    if (show) {
        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'gas-loader-overlay';
            loader.style = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(255,255,255,0.7);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;font-family:var(--font-heading);font-weight:600;color:var(--text-secondary);gap:1rem;';
            loader.innerHTML = `
                <div style="width: 40px; height: 40px; border: 4px solid var(--border-color); border-top: 4px solid var(--team-avionics); border-radius: 50%; animation: spin 1s linear infinite;"></div>
                <div id="gas-loader-text" style="font-size: 1rem;">Syncing...</div>
                <style>
                    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                </style>
            `;
            if (document.documentElement.classList.contains('dark-mode')) {
                loader.style.background = 'rgba(15,23,42,0.85)';
                loader.style.color = '#f8fafc';
            }
            document.body.appendChild(loader);
        }
        
        // Update loader message dynamically based on parameter or environment detection
        const textEl = document.getElementById('gas-loader-text');
        if (textEl) {
            if (message) {
                textEl.textContent = message;
            } else {
                const isGas = typeof google !== 'undefined' && google.script && google.script.run && typeof google.script.run.getTasks === 'function';
                const isRealGas = isGas && !google.script.isMock;
                if (isRealGas) {
                    textEl.textContent = 'Syncing with Google Sheets...';
                } else if (window.supabaseClient) {
                    textEl.textContent = 'Syncing with Supabase...';
                } else {
                    textEl.textContent = 'Syncing database...';
                }
            }
        }
        loader.style.display = 'flex';
    } else {
        if (loader) {
            loader.style.display = 'none';
        }
    }
}

function showUploadCompleteAnimation(callback) {
    let loader = document.getElementById('gas-loader-overlay');
    if (!loader) {
        if (callback) callback();
        return;
    }

    // Add checkmark styles if not already present
    if (!document.getElementById('checkmark-styles')) {
        const style = document.createElement('style');
        style.id = 'checkmark-styles';
        style.innerHTML = `
            .checkmark-wrapper {
                width: 60px;
                height: 60px;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-bottom: 0.5rem;
            }
            .checkmark {
                width: 56px;
                height: 56px;
                border-radius: 50%;
                display: block;
                stroke-width: 4;
                stroke: #ffffff;
                stroke-miterlimit: 10;
                box-shadow: inset 0px 0px 0px #10b981;
                animation: fill .4s ease-in-out .4s forwards, scale .3s ease-in-out .9s forwards;
            }
            .checkmark__circle {
                stroke-dasharray: 166;
                stroke-dashoffset: 166;
                stroke-width: 4;
                stroke-miterlimit: 10;
                stroke: #10b981;
                fill: none;
                animation: stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards;
            }
            .checkmark__check {
                transform-origin: 50% 50%;
                stroke-dasharray: 48;
                stroke-dashoffset: 48;
                stroke: #ffffff;
                stroke-width: 4;
                animation: stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.8s forwards;
            }
            @keyframes stroke {
                100% {
                    stroke-dashoffset: 0;
                }
            }
            @keyframes scale {
                0%, 100% {
                    transform: none;
                }
                50% {
                    transform: scale3d(1.15, 1.15, 1);
                }
            }
            @keyframes fill {
                100% {
                    box-shadow: inset 0px 0px 0px 30px #10b981;
                }
            }
        `;
        document.head.appendChild(style);
    }

    loader.innerHTML = `
        <div class="checkmark-wrapper">
            <svg class="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                <circle class="checkmark__circle" cx="26" cy="26" r="25" fill="none"/>
                <path class="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
            </svg>
        </div>
        <div id="gas-loader-text" style="font-size: 1.1rem; color: #10b981; font-weight: bold; transition: color 0.3s;">Upload Complete!</div>
    `;

    setTimeout(() => {
        loader.style.opacity = '0';
        loader.style.transition = 'opacity 0.3s ease';
        setTimeout(() => {
            loader.style.display = 'none';
            loader.style.opacity = '1';
            loader.remove(); // Remove elements so that next shows recreate the spinner
            if (callback) callback();
        }, 300);
    }, 1500);
}

// Render Dashboard UI
function renderApp() {
    calculateStats();
    renderTasks();
    renderAnalytics();
    
    // Refresh statistics tab if it's currently active/visible
    const statsTab = document.getElementById('statsTab');
    if (statsTab && !statsTab.classList.contains('hidden')) {
        if (typeof renderStatisticsTab === 'function') {
            renderStatisticsTab();
        }
    }

    // Refresh weekly summary tab if it's currently active/visible
    const summaryTab = document.getElementById('summaryTab');
    if (summaryTab && !summaryTab.classList.contains('hidden')) {
        if (typeof renderWeeklySummaryTab === 'function') {
            renderWeeklySummaryTab();
        }
    }

    // Refresh calendar tab
    if (typeof renderCalendarTab === 'function') {
        renderCalendarTab();
    }

    // Refresh notifications panel
    renderNotifications();
}

// Calculate Stats Dashboard
function calculateStats() {
    const aogCount = tasks.filter(t => t.priorityLevel === 'AOG' && t.currentStatus !== 'Completed').length;
    const activeCount = tasks.filter(t => t.currentStatus === 'In Progress').length;
    const completedCount = tasks.filter(t => t.currentStatus === 'Completed').length;

    document.getElementById('statAogCount').textContent = aogCount;
    document.getElementById('statActiveCount').textContent = activeCount;
    document.getElementById('statCompletedCount').textContent = completedCount;

    // Pulse style if AOG is greater than 0
    const aogCard = document.querySelector('.stat-card.aog');
    if (aogCount > 0) {
        aogCard.style.boxShadow = '0 0 15px rgba(220, 38, 38, 0.25)';
    } else {
        aogCard.style.boxShadow = '';
    }

    // Populate Print Statistics
    const today = new Date('2026-06-17T22:01:02+07:00');
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    document.getElementById('printDate').textContent = today.toLocaleDateString('en-US', options);
    document.getElementById('printTotalTasks').textContent = tasks.length;
    document.getElementById('printAogTasks').textContent = aogCount;
}

// Filter and Search Tasks
// Returns true if a completed task is old enough (>7 days) to be in History
function isArchivedToHistory(task) {
    if (task.currentStatus !== 'Completed') return false;
    if (!task.completedDate) return false;
    const completed = new Date(task.completedDate);
    const now = new Date();
    const diffDays = Math.floor((now - completed) / (1000 * 60 * 60 * 24));
    return diffDays >= 7;
}

function getFilteredTasks() {
    return tasks.filter(task => {
        // Exclude tasks archived to History (completed > 7 days ago)
        if (isArchivedToHistory(task)) return false;

        // Search matches
        const searchLower = activeFilters.search.toLowerCase();
        const matchesSearch = 
            task.aircraftReg.toLowerCase().includes(searchLower) ||
            (task.aircraftType || '').toLowerCase().includes(searchLower) ||
            task.requestor.toLowerCase().includes(searchLower) ||
            task.taskDescription.toLowerCase().includes(searchLower);

        // Team filter matches — supports comma-separated multi-team values
        const assignedTeams = (task.assignedTeam || '').split(',').map(s => s.trim());
        const matchesTeam = activeFilters.team === 'All' || assignedTeams.includes(activeFilters.team);

        // Priority filter matches
        const matchesPriority = activeFilters.priority === 'All' || task.priorityLevel === activeFilters.priority;

        // Status filter matches
        const matchesStatus = activeFilters.status === 'All' || task.currentStatus === activeFilters.status;

        return matchesSearch && matchesTeam && matchesPriority && matchesStatus;
    });
}

// Get tasks archived to History (completed > 7 days ago)
function getHistoryTasks(searchQuery) {
    return tasks.filter(task => {
        if (!isArchivedToHistory(task)) return false;
        if (!searchQuery || searchQuery.trim() === '') return true;
        const q = searchQuery.toLowerCase();
        return (
            (task.aircraftReg || '').toLowerCase().includes(q) ||
            (task.topic || task.taskDescription || '').toLowerCase().includes(q) ||
            (task.assignedTeam || '').toLowerCase().includes(q) ||
            (task.ataChapter || '').toLowerCase().includes(q)
        );
    });
}

// Render Kanban & List Views
function renderTasks() {
    const filtered = getFilteredTasks();
    const isEmpty = filtered.length === 0;

    // Show/hide empty state
    const emptyState = document.getElementById('emptyState');
    const kanbanView = document.getElementById('kanbanView');
    const listView = document.getElementById('listView');
    const teamTabs = document.getElementById('teamTabs');

    if (isEmpty) {
        emptyState.style.display = 'flex';
        kanbanView.style.display = 'none';
        listView.style.display = 'none';
        return;
    } else {
        emptyState.style.display = 'none';
    }

    if (activeFilters.viewMode === 'kanban') {
        kanbanView.style.display = 'grid';
        listView.style.display = 'none';
        teamTabs.style.display = 'flex';
        renderKanban(filtered);
    } else {
        kanbanView.style.display = 'none';
        listView.style.display = 'block';
        teamTabs.style.display = 'none'; // Hide team tabs when in list view since lists are already grouped by team
        renderList(filtered);
    }
}

// Render Kanban columns
function renderKanban(filteredTasks) {
    const statuses = ['Open', 'In Progress', 'Completed'];
    
    statuses.forEach(status => {
        const colContainer = document.querySelector(`.task-list-container[data-status="${status}"]`);
        const countBadge = document.getElementById(`count-${status.replace(' ', '')}`);
        
        colContainer.innerHTML = '';
        const statusTasks = filteredTasks.filter(t => t.currentStatus === status);
        countBadge.textContent = statusTasks.length;

        statusTasks.forEach(task => {
            const card = createTaskCard(task);
            colContainer.appendChild(card);
        });
    });
}

// ---- HISTORY TAB ----
function renderHistoryTab() {
    const container = document.getElementById('historyContent');
    const searchInput = document.getElementById('historySearch');
    const countEl = document.getElementById('historyCount');
    if (!container) return;

    const searchQuery = searchInput ? searchInput.value : '';
    const historyTasks = getHistoryTasks(searchQuery);

    if (countEl) countEl.textContent = historyTasks.length;

    if (historyTasks.length === 0) {
        container.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:4rem 2rem;gap:1rem;color:var(--text-muted);">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:48px;height:48px;opacity:0.3;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                <p style="font-size:1rem;font-weight:600;">No archived tasks yet</p>
                <p style="font-size:0.85rem;text-align:center;max-width:340px;">Tasks marked as <strong>Completed</strong> will automatically appear here after <strong>7 days</strong>.</p>
            </div>`;
        return;
    }

    // Group tasks by Month-Year of completedDate
    const groups = {};
    historyTasks.forEach(task => {
        const d = new Date(task.completedDate);
        const key = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
        if (!groups[key]) groups[key] = [];
        groups[key].push(task);
    });

    // Sort groups newest first
    const sortedGroups = Object.keys(groups).sort((a, b) => new Date('1 ' + b) - new Date('1 ' + a));

    container.innerHTML = sortedGroups.map(month => {
        const monthTasks = groups[month].sort((a, b) => new Date(b.completedDate) - new Date(a.completedDate));
        const cards = monthTasks.map(task => {
            const teams = (task.assignedTeam || '').split(',').map(s => s.trim()).filter(Boolean);
            function getTeamBadgeClass(t) {
                if (t.includes('Avionic')) return 'avionics';
                if (t.includes('Structure')) return 'struct';
                if (t.includes('Engines')) return 'engines';
                if (t.includes('IERA')) return 'iera';
                if (t.includes('Component')) return 'component';
                return 'mech';
            }
            const teamBadges = teams.map(t => `<span class="team-badge ${getTeamBadgeClass(t)}" style="font-size:0.7rem;padding:0.15rem 0.5rem;">${t}</span>`).join('');
            const prioColors = { AOG: '#dc2626', High: '#ea580c', Medium: '#d97706', Low: '#16a34a', Routine: '#0284c7' };
            const prioColor = prioColors[task.priorityLevel] || '#64748b';
            const topic = task.topic || '';
            return `
            <div class="task-card" style="border-left:3px solid #22c55e;cursor:default;" id="history-card-${task.id}">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem;margin-bottom:0.5rem;">
                    <div style="display:flex;flex-direction:column;gap:0.2rem;min-width:0;">
                        ${topic ? `<span style="font-size:0.8rem;font-weight:700;color:var(--text-primary);">${topic}</span>` : ''}
                        <span style="font-size:0.75rem;font-weight:600;color:var(--text-secondary);">${task.aircraftReg} &middot; ATA ${task.ataChapter || 'N/A'}</span>
                    </div>
                    <span style="font-size:0.7rem;font-weight:600;color:${prioColor};background:${prioColor}18;padding:0.15rem 0.45rem;border-radius:4px;white-space:nowrap;">${task.priorityLevel}</span>
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:0.3rem;margin-bottom:0.65rem;">${teamBadges}</div>
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span style="font-size:0.72rem;color:var(--text-muted);">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:11px;height:11px;vertical-align:middle;margin-right:3px;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        Completed ${task.completedDate}
                    </span>
                    <button class="btn btn-secondary" onclick="restoreTaskFromHistory('${task.id}')" style="font-size:0.72rem;padding:0.2rem 0.55rem;height:auto;min-height:auto;gap:4px;" title="Restore to Board">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:11px;height:11px;"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 .49-4.95"></path></svg>
                        Restore
                    </button>
                </div>
            </div>`;
        }).join('');

        return `
        <div style="margin-bottom:2rem;">
            <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1rem;">
                <h3 style="font-size:0.9rem;font-weight:700;color:var(--text-primary);margin:0;">${month}</h3>
                <span style="font-size:0.75rem;color:var(--text-muted);background:var(--bg-card);border:1px solid var(--border-color);padding:0.1rem 0.45rem;border-radius:10px;">${monthTasks.length} task${monthTasks.length !== 1 ? 's' : ''}</span>
                <div style="flex:1;height:1px;background:var(--border-color);"></div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:0.75rem;">
                ${cards}
            </div>
        </div>`;
    }).join('');
}

function restoreTaskFromHistory(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    delete task.completedDate;
    task.currentStatus = 'Completed';
    saveTaskData(task);
    renderApp();
    // Re-render History tab if it is currently visible
    const historyTab = document.getElementById('historyTab');
    if (historyTab && !historyTab.classList.contains('hidden')) {
        renderHistoryTab();
    }
}

window.restoreTaskFromHistory = restoreTaskFromHistory;
window.renderHistoryTab = renderHistoryTab;

function archiveTaskToHistory(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    if (task.currentStatus !== 'Completed') return;
    // Set completedDate to exactly 7 days ago so isArchivedToHistory returns true
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    task.completedDate = sevenDaysAgo.toISOString().split('T')[0];
    saveTaskData(task);
    renderApp();
    // Switch to History tab so user can see the archived task
    const historyNavItem = document.querySelector('.tab-item[data-tab="history"]');
    if (historyNavItem) historyNavItem.click();
}

window.archiveTaskToHistory = archiveTaskToHistory;

// Create Kanban Card Element
function createTaskCard(task) {
    const card = document.createElement('div');
    card.className = 'task-card';
    card.draggable = true;
    card.dataset.id = task.id;

    // Priority class mapping
    const prioClass = task.priorityLevel.toLowerCase();
    
    // Team badge CSS class helper for a single team name
    function getTeamClass(teamName) {
        if (teamName.includes('Avionic')) return 'avionics';
        if (teamName.includes('Structure')) return 'struct';
        if (teamName.includes('Engines')) return 'engines';
        if (teamName.includes('IERA')) return 'iera';
        if (teamName.includes('Component')) return 'component';
        return 'mech';
    }
    // Build badges for all assigned teams
    const allTeams = (task.assignedTeam || '').split(',').map(s => s.trim()).filter(Boolean);
    const teamClass = allTeams.length > 0 ? getTeamClass(allTeams[0]) : 'mech'; // primary class for card

    // Format RTS date & check warning
    let rtsClass = '';
    let rtsText = task.rtsDate || 'N/A';
    if (task.rtsDate && task.rtsDate !== 'N/A') {
        const rtsDateObj = new Date(task.rtsDate);
        const todayObj = new Date('2026-06-17'); // Base date
        const diffTime = rtsDateObj - todayObj;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (task.currentStatus !== 'Completed' && !isNaN(diffDays)) {
            if (diffDays < 0) {
                rtsClass = 'rts-alert';
                rtsText = `${task.rtsDate} (OVERDUE)`;
            } else if (diffDays === 0) {
                rtsClass = 'rts-alert';
                rtsText = `Today`;
            } else if (diffDays === 1) {
                rtsClass = 'rts-alert';
                rtsText = `Tomorrow`;
            } else {
                rtsText = `In ${diffDays} days`;
            }
        }
    } else {
        rtsText = 'N/A';
    }

    card.innerHTML = `
        <div class="card-header">
            <span class="ac-reg">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                </svg>
                ${task.aircraftReg} <span class="ac-type-muted">(${task.aircraftType || 'A320'})</span>
                <span class="ata-badge" style="margin-left: 0.25rem;">ATA ${task.ataChapter || 'N/A'}</span>
            </span>
            <span class="badge-priority ${prioClass}">${task.priorityLevel}</span>
        </div>
        <div class="card-topic" style="font-weight: 700; font-size: 0.92rem; margin-top: 0.5rem; margin-bottom: 0.15rem; color: var(--text-primary); font-family: var(--font-heading);">${task.topic || 'No Topic'}</div>
        <div class="card-desc" style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; max-height: 3.4em;">${task.taskDescription}</div>
        
        <div class="card-metadata">
            <div class="meta-item" title="Requestor">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <span>${task.requestor.split(' ')[0]}</span>
            </div>
            <div class="meta-item" title="Date Created">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                <span>${task.createdDate || 'N/A'}</span>
            </div>
            <div class="meta-item ${rtsClass}" title="Return to Service">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <span>${rtsText}</span>
            </div>
            <div class="meta-item" title="Updates count">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                <span>${task.comments ? task.comments.length : 0} updates</span>
            </div>
        </div>

        <div class="card-footer">
            <div style="display:flex;flex-wrap:wrap;gap:3px;">${allTeams.map(t => `<span class="team-badge ${getTeamClass(t)}">${t.split(' ')[0]}</span>`).join('')}</div>
            <div class="card-actions">
                ${task.attachments.length > 0 ? `
                    <span class="action-icon" title="${task.attachments.length} attachment(s)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 12px; height: 12px;">
                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                        </svg>
                    </span>
                ` : ''}
                <div class="action-icon complete-task-action ${task.currentStatus === 'Completed' ? 'completed' : ''}" 
                     title="${task.currentStatus === 'Completed' ? 'Mark In Progress' : 'Mark Completed'}" 
                     onclick="event.stopPropagation(); toggleTaskCompletion('${task.id}')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 12px; height: 12px;">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </div>
                <div class="action-icon view-task-action" title="View details" onclick="event.stopPropagation(); openDetailsModal('${task.id}')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 12px; height: 12px;">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                </div>
                <div class="action-icon edit-task-action" title="Edit task" onclick="event.stopPropagation(); openEditTaskModal('${task.id}')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 12px; height: 12px;">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                </div>
                ${task.currentStatus === 'Completed' ? `
                <div class="action-icon" title="Move to History" onclick="event.stopPropagation(); archiveTaskToHistory('${task.id}')" style="color: #22c55e;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 12px; height: 12px;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                </div>` : ''}
            </div>
        </div>
        <div class="quick-update-box" style="margin-top: 0.75rem; border-top: 1px solid var(--border-color); padding-top: 0.5rem; display: flex; gap: 0.35rem; align-items: center;" onclick="event.stopPropagation();" ondragstart="event.stopPropagation();">
            <input type="text" placeholder="Type status update..." onkeydown="if(event.key==='Enter'){event.preventDefault(); addQuickUpdate('${task.id}', this);}" style="flex-grow: 1; font-size: 0.75rem; padding: 0.35rem 0.5rem; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); outline: none; font-family: var(--font-body); box-sizing: border-box;" />
            <input type="file" id="quickUpdateFile_${task.id}" style="display: none;" onchange="uploadQuickUpdateFile('${task.id}', this)" />
            <label for="quickUpdateFile_${task.id}" class="btn btn-secondary" style="padding: 0.35rem 0.5rem; font-size: 0.75rem; border-radius: 6px; margin: 0; min-height: auto; width: auto; height: auto; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box;" title="Attach File">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                </svg>
            </label>
            <button type="button" class="btn btn-secondary" onclick="addQuickUpdate('${task.id}', this.closest('.quick-update-box').querySelector('input[type=text]'));" style="padding: 0.35rem 0.6rem; font-size: 0.75rem; border-radius: 6px; margin: 0; min-height: auto; width: auto; height: auto; font-weight: 600;">Add</button>
        </div>
    `;

    // Add drag event listeners
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragend', handleDragEnd);
    card.addEventListener('click', () => openDetailsModal(task.id));

    return card;
}

// Render List View (Separated into 4 Team tables)
function renderList(filteredTasks) {
    const teams = [
        { id: 'mech', name: 'Mechanical System Team', tbodyId: 'list-mech-tbody', badgeId: 'count-List-mech' },
        { id: 'avionics', name: 'Avionic Systems Team', tbodyId: 'list-avionics-tbody', badgeId: 'count-List-avionics' },
        { id: 'struct', name: 'Structure Team', tbodyId: 'list-struct-tbody', badgeId: 'count-List-struct' },
        { id: 'engines', name: 'Engines Team', tbodyId: 'list-engines-tbody', badgeId: 'count-List-engines' },
        { id: 'iera', name: 'IERA Shop', tbodyId: 'list-iera-tbody', badgeId: 'count-List-iera' },
        { id: 'component', name: 'Component Team', tbodyId: 'list-component-tbody', badgeId: 'count-List-component' }
    ];

    teams.forEach(team => {
        const tbody = document.getElementById(team.tbodyId);
        const badge = document.getElementById(team.badgeId);
        tbody.innerHTML = '';

        // Filter tasks specifically for this team AND matching active text searches / priority filters
        // Supports comma-separated multi-team values
        const teamTasks = filteredTasks.filter(t => (t.assignedTeam || '').split(',').map(s => s.trim()).includes(team.name));
        badge.textContent = teamTasks.length;

        if (teamTasks.length === 0) {
            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = `<td colspan="10" class="list-empty-row">No active tasks assigned to ${team.name.replace(' Team', '')}</td>`;
            tbody.appendChild(emptyRow);
            return;
        }

        teamTasks.forEach(task => {
            const prioClass = task.priorityLevel.toLowerCase();
            
            let statusClass = 'open';
            if (task.currentStatus === 'In Progress') statusClass = 'progress';
            else if (task.currentStatus === 'Completed') statusClass = 'completed';

            const row = document.createElement('tr');
            row.className = `task-row prio-${prioClass} status-${statusClass}`;
            row.style.cursor = 'pointer';
            row.addEventListener('click', () => openDetailsModal(task.id));

            row.innerHTML = `
                <td><span class="tbl-reg">${task.aircraftReg}</span></td>
                <td><span class="tbl-type">${task.aircraftType || 'A320'}</span></td>
                <td><span class="tbl-ata">${task.ataChapter || 'N/A'}</span></td>
                <td><span class="badge-priority ${prioClass}">${task.priorityLevel}</span></td>
                <td><div class="tbl-desc" title="${task.taskDescription}"><strong>${task.topic || 'No Topic'}</strong><br><span style="font-size: 0.78rem; color: var(--text-muted);">${task.taskDescription}</span></div></td>
                <td><span>${task.createdDate || 'N/A'}</span></td>
                <td><span>${task.rtsDate}</span></td>
                <td><span>${task.requestor}</span></td>
                <td><span class="badge-status ${statusClass}">${task.currentStatus}</span></td>
                <td style="text-align: right;">
                    <div style="display: inline-flex; gap: 0.35rem; align-items: center;" onclick="event.stopPropagation()">
                        <span class="action-icon" title="${task.comments ? task.comments.length : 0} update(s)" style="display: inline-flex; align-items: center; gap: 2px; cursor: default; background: none; border: none; padding: 0; margin-right: 0.25rem;">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 12px; height: 12px;">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                            </svg>
                            <span style="font-size: 10px; font-weight: 600;">${task.comments ? task.comments.length : 0}</span>
                        </span>
                        <div class="action-icon complete-task-action ${task.currentStatus === 'Completed' ? 'completed' : ''}" 
                             title="${task.currentStatus === 'Completed' ? 'Mark In Progress' : 'Mark Completed'}" 
                             onclick="toggleTaskCompletion('${task.id}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        </div>
                        <div class="action-icon" title="Edit" onclick="openEditTaskModal('${task.id}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </div>
                        <div class="action-icon" title="Delete" onclick="deleteTaskDirect('${task.id}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px; color: var(--priority-aog);">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </div>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    });
}

// Drag & Drop Mechanics
let draggedTaskId = null;

function handleDragStart(e) {
    draggedTaskId = this.dataset.id;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedTaskId);
}

function handleDragEnd() {
    this.classList.remove('dragging');
    draggedTaskId = null;
    
    // Clean all column highlights
    document.querySelectorAll('.task-list-container').forEach(c => {
        c.classList.remove('drag-over');
    });
}

// ── Multi-Select Dropdown Helpers ──────────────────────────────────────────

/**
 * Initialise a custom multiselect dropdown.
 * @param {string} triggerId   - ID of the trigger button element
 * @param {string} dropdownId  - ID of the dropdown panel element
 * @param {string} hiddenId    - ID of the hidden input that stores comma-sep values
 * @param {string} textId      - ID of the span that shows the current selection label
 * @param {string} placeholder - Placeholder text shown when nothing is selected
 */
window.toggleMultiselectApp = function(dropdownId, triggerEl) {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown || !triggerEl) return;
    
    const isOpen = dropdown.classList.contains('open');
    
    // Close all other open dropdowns first
    document.querySelectorAll('.multiselect-dropdown.open').forEach(d => {
        if (d.id !== dropdownId) {
            d.classList.remove('open');
            const otherTrigger = document.getElementById(d.id.replace('Dropdown', 'Trigger'));
            if (otherTrigger) {
                otherTrigger.classList.remove('active');
                otherTrigger.setAttribute('aria-expanded', 'false');
            }
        }
    });
    
    if (isOpen) {
        dropdown.classList.remove('open');
        triggerEl.classList.remove('active');
        triggerEl.setAttribute('aria-expanded', 'false');
    } else {
        dropdown.classList.add('open');
        triggerEl.classList.add('active');
        triggerEl.setAttribute('aria-expanded', 'true');
    }
};

function setupMultiselect(triggerId, dropdownId, hiddenId, textId, placeholder) {
    const trigger = document.getElementById(triggerId);
    const dropdown = document.getElementById(dropdownId);
    const hiddenInput = document.getElementById(hiddenId);
    const textEl = document.getElementById(textId);
    if (!trigger || !dropdown || !hiddenInput || !textEl) return;

    function updateTriggerLabel() {
        const checked = Array.from(dropdown.querySelectorAll('input[type="checkbox"]:checked'));
        const values = checked.map(cb => cb.value);
        hiddenInput.value = values.join(', ');
        if (values.length === 0) {
            textEl.textContent = placeholder;
            textEl.classList.remove('has-value');
        } else if (values.length === 1) {
            textEl.textContent = values[0];
            textEl.classList.add('has-value');
        } else if (values.length === 2) {
            textEl.textContent = values.map(v => v.split(' ')[0]).join(', ');
            textEl.classList.add('has-value');
        } else {
            textEl.textContent = `${values.length} teams selected`;
            textEl.classList.add('has-value');
        }
    }

    // Toggle dropdown open/close on trigger click
    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        window.toggleMultiselectApp(dropdownId, trigger);
    });

    // Update hidden input + label when a checkbox is toggled
    dropdown.addEventListener('change', updateTriggerLabel);

    // Stop clicks inside the dropdown from propagating to window (which would close it)
    dropdown.addEventListener('click', (e) => e.stopPropagation());
}

/**
 * Programmatically set which teams are selected in a multiselect dropdown.
 * Call this when opening the Add or Edit task modal.
 * @param {string} dropdownId  - ID of the dropdown panel
 * @param {string} hiddenId    - ID of the hidden input
 * @param {string} textId      - ID of the display text span
 * @param {string} placeholder - Placeholder when nothing selected
 * @param {string} [valueStr]  - Comma-separated string of selected values (empty to reset)
 */
function setAssignedTeams(dropdownId, hiddenId, textId, placeholder, valueStr) {
    const dropdown = document.getElementById(dropdownId);
    const hiddenInput = document.getElementById(hiddenId);
    const textEl = document.getElementById(textId);
    if (!dropdown || !hiddenInput || !textEl) return;

    const selected = (valueStr || '').split(',').map(s => s.trim()).filter(Boolean);
    dropdown.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.checked = selected.includes(cb.value);
    });

    hiddenInput.value = selected.join(', ');

    if (selected.length === 0) {
        textEl.textContent = placeholder;
        textEl.classList.remove('has-value');
    } else if (selected.length === 1) {
        textEl.textContent = selected[0];
        textEl.classList.add('has-value');
    } else if (selected.length === 2) {
        textEl.textContent = selected.map(v => v.split(' ')[0]).join(', ');
        textEl.classList.add('has-value');
    } else {
        textEl.textContent = `${selected.length} teams selected`;
        textEl.classList.add('has-value');
    }
}

// Close all multiselect dropdowns when clicking outside
window.addEventListener('click', (e) => {
    if (!e.target.closest('.multiselect-container')) {
        document.querySelectorAll('.multiselect-dropdown.open').forEach(d => {
            d.classList.remove('open');
            const trigger = document.getElementById(d.id.replace('Dropdown', 'Trigger'));
            if (trigger) {
                trigger.classList.remove('active');
                trigger.setAttribute('aria-expanded', 'false');
            }
        });
    }
});

function setupEventListeners() {

    // Search Box
    document.getElementById('searchInput').addEventListener('input', (e) => {
        activeFilters.search = e.target.value;
        renderTasks();
    });

    // Dropdown Team Filter
    const teamFilter = document.getElementById('teamFilter');
    teamFilter.addEventListener('change', (e) => {
        activeFilters.team = e.target.value;
        syncTeamTabs(e.target.value);
        renderTasks();
    });

    // Tab Bar Team Filters (For Kanban View)
    const tabContainer = document.getElementById('teamTabs');
    tabContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('team-tab-btn')) {
            const selectedTeam = e.target.dataset.team;
            activeFilters.team = selectedTeam;
            teamFilter.value = selectedTeam; // Keep dropdown filter in sync
            
            // Toggle active classes on tab buttons
            document.querySelectorAll('#teamTabs .team-tab-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.team === selectedTeam);
            });
            renderTasks();
        }
    });

    // Priority Filter
    document.getElementById('priorityFilter').addEventListener('change', (e) => {
        activeFilters.priority = e.target.value;
        renderTasks();
    });

    // Status Filter
    document.getElementById('statusFilter').addEventListener('change', (e) => {
        activeFilters.status = e.target.value;
        renderTasks();
    });

    // SAP Search Filter
    const sapSearchInput = document.getElementById('sapSearchInput');
    if (sapSearchInput) {
        sapSearchInput.addEventListener('input', () => {
            renderSAPTab();
        });
    }

    // View Mode Switches
    document.getElementById('kanbanViewBtn').addEventListener('click', () => {
        setViewMode('kanban');
    });
    document.getElementById('listViewBtn').addEventListener('click', () => {
        setViewMode('list');
    });

    // Add Task Buttons
    document.getElementById('addTaskBtn').addEventListener('click', openAddTaskModal);
    document.getElementById('emptyStateAddBtn').addEventListener('click', openAddTaskModal);

    // Settings Button Click
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', handleSettingsBtnClick);
    }

    // Export Dropdown Click handlers
    const exportBtn = document.getElementById('exportDropdownBtn');
    const exportDropdown = document.getElementById('exportDropdownContent');
    exportBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        exportDropdown.classList.toggle('show');
    });

    // Print Dropdown Click handlers
    const printBtn = document.getElementById('printSummaryBtn');
    const printDropdown = document.getElementById('printDropdownMenu');
    if (printBtn && printDropdown) {
        printBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            printDropdown.classList.toggle('hidden');
        });
    }

    // Notification Dropdown Click handlers
    const notifBtn = document.getElementById('notificationBtn');
    const notifPanel = document.getElementById('notificationPanel');
    if (notifBtn && notifPanel) {
        notifBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            notifPanel.classList.toggle('hidden');
            // Mark as read when opening
            if (!notifPanel.classList.contains('hidden')) {
                localStorage.setItem('mro_last_read_notifications', new Date().toISOString());
                const badge = document.getElementById('notificationBadge');
                if (badge) badge.classList.add('hidden');
            }
        });
        notifPanel.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent closing when clicking inside panel
        });
    }

    const markAllReadBtn = document.getElementById('markAllReadBtn');
    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            localStorage.setItem('mro_last_read_notifications', new Date().toISOString());
            renderNotifications();
        });
    }

    // Close dropdowns when clicking outside
    window.addEventListener('click', () => {
        exportDropdown.classList.remove('show');
        if (printDropdown) {
            printDropdown.classList.add('hidden');
        }
        if (notifPanel) {
            notifPanel.classList.add('hidden');
        }
    });

    // Excel and PDF triggers
    document.getElementById('exportExcelBtn').addEventListener('click', exportToExcel);
    document.getElementById('exportPdfBtn').addEventListener('click', exportToPdf);

    // Form Submission
    document.getElementById('taskForm').addEventListener('submit', handleFormSubmit);

    // Multiselect Dropdowns
    setupMultiselect('assignedTeamTrigger', 'assignedTeamDropdown', 'assignedTeam', 'assignedTeamText', 'Select assigned team...');
    setupMultiselect('manualTeamTrigger', 'manualTeamDropdown', 'manualTeam', 'manualTeamText', 'Select team...');
    setupMultiselect('summaryTeamTrigger', 'summaryTeamDropdown', 'summaryTeamHidden', 'summaryTeamText', 'All Teams');

    // RTS Date N/A Checkbox listener
    document.getElementById('rtsDateNa').addEventListener('change', (e) => {
        const input = document.getElementById('rtsDate');
        if (e.target.checked) {
            input.value = '';
            input.disabled = true;
            input.style.opacity = '0.5';
        } else {
            input.disabled = false;
            input.style.opacity = '1';
        }
    });

    // Requestor Contact N/A Checkbox listener
    document.getElementById('requestorContactNa').addEventListener('change', (e) => {
        const input = document.getElementById('requestorContact');
        if (e.target.checked) {
            input.value = '';
            input.disabled = true;
            input.style.opacity = '0.5';
        } else {
            input.disabled = false;
            input.style.opacity = '1';
        }
    });

    // Drag-over columns
    const containers = document.querySelectorAll('.task-list-container');
    containers.forEach(container => {
        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            container.classList.add('drag-over');
        });

        container.addEventListener('dragenter', (e) => {
            e.preventDefault();
            container.classList.add('drag-over');
        });

        container.addEventListener('dragleave', () => {
            container.classList.remove('drag-over');
        });

        container.addEventListener('drop', (e) => {
            e.preventDefault();
            container.classList.remove('drag-over');
            const id = e.dataTransfer.getData('text/plain');
            const targetStatus = container.dataset.status;
            
            const task = tasks.find(t => t.id === id);
            if (task && task.currentStatus !== targetStatus) {
                task.currentStatus = targetStatus;
                if (targetStatus === 'Completed') {
                    task.completedDate = new Date().toISOString().split('T')[0];
                } else {
                    delete task.completedDate;
                }
                saveTaskData(task);
                renderApp();
            }
        });
    });

    // Calendar Month Navigation
    const calPrevBtn = document.getElementById('calPrevMonthBtn');
    const calNextBtn = document.getElementById('calNextMonthBtn');
    if (calPrevBtn) {
        calPrevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
            renderCalendarTab();
        });
    }
    if (calNextBtn) {
        calNextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
            renderCalendarTab();
        });
    }

    // Calendar Team Filter Select
    const calTeamFilter = document.getElementById('calendarTeamFilter');
    if (calTeamFilter) {
        calTeamFilter.addEventListener('change', (e) => {
            selectedCalendarTeam = e.target.value;
            renderCalendarTab();
        });
    }

    // Modal click-outside to close
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            closeModal(e.target.id);
        }
    });

    // Keyboard ESC to close
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal('taskModal');
            closeModal('detailsModal');
        }
    });

    // File attachments handler
    const fileInput = document.getElementById('fileInput');
    fileInput.addEventListener('change', handleFileSelect);

    const uploadArea = document.querySelector('.file-upload-area');
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = 'var(--team-avionics)';
    });
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.style.borderColor = '';
    });
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '';
        if (e.dataTransfer.files.length > 0) {
            processFiles(e.dataTransfer.files);
        }
    });

    // Add external URL Link attachment handler
    const addUrlBtn = document.getElementById('addUrlAttachmentBtn');
    const urlInput = document.getElementById('taskUrlAttachment');
    if (addUrlBtn && urlInput) {
        addUrlBtn.addEventListener('click', () => {
            const url = urlInput.value.trim();
            if (!url) {
                alert('Please enter a valid URL.');
                return;
            }
            
            // Basic URL validation
            try {
                new URL(url);
            } catch (e) {
                alert('Invalid URL format. Please include protocol (e.g. https://).');
                return;
            }

            if (formAttachments.length >= 10) {
                alert('Maximum of 10 attachment files/links allowed per task.');
                return;
            }

            // Extract file name or show URL
            let name = "External Link / Reference Document";
            try {
                const parsedUrl = new URL(url);
                const pathParts = parsedUrl.pathname.split('/');
                const fileName = pathParts[pathParts.length - 1];
                if (fileName && fileName.length > 0) {
                    name = `${parsedUrl.hostname}.../${fileName}`;
                } else {
                    name = parsedUrl.hostname;
                }
            } catch (e) {}

            formAttachments.push({
                name: name,
                size: 0,
                type: 'url',
                data: url
            });
            
            urlInput.value = ''; // Clear input
            renderFilePreviews();
        });
    }

    // Sync comment and update author input names
    const commentAuthor = document.getElementById('commentAuthor');
    const updateAuthor = document.getElementById('updateAuthor');
    if (commentAuthor && updateAuthor) {
        commentAuthor.addEventListener('input', () => {
            updateAuthor.value = commentAuthor.value;
        });
        updateAuthor.addEventListener('input', () => {
            commentAuthor.value = updateAuthor.value;
        });
    }

    // Update Posting
    document.getElementById('addUpdateBtn').addEventListener('click', () => {
        const authorInput = document.getElementById('updateAuthor');
        const textInput = document.getElementById('updateText');
        const fileInput = document.getElementById('detailLogUpdateFile');
        if (!textInput || !authorInput) return;

        const text = textInput.value.trim();
        const author = authorInput.value.trim() || 'DMA Staff';

        if (!text) {
            alert('Please enter an update.');
            return;
        }

        if (!activeDetailsTaskId) return;
        const task = tasks.find(t => t.id === activeDetailsTaskId);
        if (!task) return;

        // Check if there is a file to upload
        if (fileInput && fileInput.files.length > 0) {
            const file = fileInput.files[0];
            
            task.attachments = task.attachments || [];
            if (task.attachments.length >= 10) {
                alert('Maximum of 10 attachment files/links allowed per task.');
                fileInput.value = '';
                const indicator = document.getElementById('detailLogUpdateFileIndicator');
                if (indicator) indicator.style.display = 'none';
                return;
            }

            const isGas = typeof google !== 'undefined' && google.script && google.script.run && !google.script.isMock;
            const powerAutomateUrl = localStorage.getItem('mro_power_automate_url') || 'https://defaultc71838d2745b4a4fb00f2d0e6e1de6.f3.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/bd6fa12380224456960c9003b9f37992/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=3z3pW754II2nFkKkReGGm2xXiiIH1piGeaphI7Z60zs';
            const hasCloud = isGas || (powerAutomateUrl && powerAutomateUrl.trim() !== '');
            const maxLimit = hasCloud ? 10 * 1024 * 1024 : 1024 * 1024;
            
            if (file.size > maxLimit) {
                alert(`File "${file.name}" exceeds the ${hasCloud ? '10MB' : '1MB'} limit.`);
                fileInput.value = '';
                const indicator = document.getElementById('detailLogUpdateFileIndicator');
                if (indicator) indicator.style.display = 'none';
                return;
            }

            if (isGas) {
                showLoadingIndicator(true);
            }

            const assignedTeam = task.assignedTeam || '';
            const dateStr = task.createdDate || new Date().toISOString().split('T')[0];
            const aircraftReg = task.aircraftReg || 'N-A';
            const topic = task.topic || task.taskDescription || 'General';

            const reader = new FileReader();
            reader.onload = function(e) {
                handleCloudOrLocalUpload(file, e.target.result, (url) => {
                    task.attachments.push({
                        name: file.name,
                        size: file.size,
                        type: file.type,
                        data: url
                    });
                    
                    task.comments = task.comments || [];
                    task.comments.push({
                        author: author,
                        text: `Attached file: ${file.name}\n\n${text}`,
                        timestamp: new Date().toISOString(),
                        type: 'update'
                    });
                    
                    saveTaskData(task);
                    textInput.value = '';
                    fileInput.value = '';
                    const indicator = document.getElementById('detailLogUpdateFileIndicator');
                    if (indicator) indicator.style.display = 'none';
                    openDetailsModal(task.id);
                    renderApp();
                }, () => {
                    // Local fallback
                    task.attachments.push({
                        name: file.name,
                        size: file.size,
                        type: file.type,
                        data: e.target.result // Base64 data URL
                    });
                    
                    task.comments = task.comments || [];
                    task.comments.push({
                        author: author,
                        text: `Attached file: ${file.name}\n\n${text}`,
                        timestamp: new Date().toISOString(),
                        type: 'update'
                    });
                    
                    saveTaskData(task);
                    textInput.value = '';
                    fileInput.value = '';
                    const indicator = document.getElementById('detailLogUpdateFileIndicator');
                    if (indicator) indicator.style.display = 'none';
                    openDetailsModal(task.id);
                    renderApp();
                }, assignedTeam, dateStr, aircraftReg, topic);
            };
            reader.readAsDataURL(file);
        } else {
            // Text only update
            task.comments = task.comments || [];
            task.comments.push({
                author: author,
                text: text,
                timestamp: new Date().toISOString(),
                type: 'update'
            });
            saveTaskData(task);
            renderComments(task);
            textInput.value = '';
            renderApp();
        }
    });

    // Comment Posting
    document.getElementById('addCommentBtn').addEventListener('click', () => {
        const authorInput = document.getElementById('commentAuthor');
        const textInput = document.getElementById('commentText');
        if (!textInput || !authorInput) return;

        const text = textInput.value.trim();
        const author = authorInput.value.trim() || 'DMA Staff';

        if (!text) {
            alert('Please enter a comment.');
            return;
        }

        if (activeDetailsTaskId) {
            const task = tasks.find(t => t.id === activeDetailsTaskId);
            if (task) {
                task.comments = task.comments || [];
                task.comments.push({
                    author: author,
                    text: text,
                    timestamp: new Date().toISOString(),
                    type: 'comment'
                });
                saveTaskData(task);
                renderComments(task);
                textInput.value = '';
                renderApp();
            }
        }
    });

    // Weekly Summary Date & Team Selectors
    const startSel = document.getElementById('summaryStartDateSelector');
    const endSel = document.getElementById('summaryEndDateSelector');
    const summaryDropdown = document.getElementById('summaryTeamDropdown');
    if (startSel && endSel) {
        startSel.value = '2026-06-15';
        endSel.value = '2026-06-21';
        
        startSel.addEventListener('change', () => {
            renderWeeklySummaryTab();
        });
        endSel.addEventListener('change', () => {
            renderWeeklySummaryTab();
        });
    }
    if (summaryDropdown) {
        summaryDropdown.addEventListener('change', () => {
            renderWeeklySummaryTab();
        });
    }

    // Settings Form Submit
    const settingsForm = document.getElementById('settingsForm');
    if (settingsForm) {
        settingsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const folderUrl = document.getElementById('customFolderUrl').value.trim();
            const powerAutomateInput = document.getElementById('powerAutomateUrl');
            const powerAutomateUrl = powerAutomateInput ? powerAutomateInput.value.trim() : '';
            const powerAutomateDeleteInput = document.getElementById('powerAutomateDeleteUrl');
            const powerAutomateDeleteUrl = powerAutomateDeleteInput ? powerAutomateDeleteInput.value.trim() : '';
            
            // Check if user entered a OneDrive or SharePoint URL in the Google Drive input
            if (folderUrl && (folderUrl.toLowerCase().includes('onedrive.live.com') || folderUrl.toLowerCase().includes('sharepoint.com') || folderUrl.toLowerCase().includes('onedrive') || folderUrl.toLowerCase().includes('sharepoint'))) {
                alert('Microsoft OneDrive and SharePoint links cannot be set as the main Google Drive storage destination. \n\nTo use OneDrive/SharePoint, please paste your Power Automate Webhook URL in the OneDrive field below, or upload files directly to OneDrive and attach their links. Google Shared Drives are fully supported in the field above.');
                return;
            }
            
            // Save Power Automate URL
            localStorage.setItem('mro_power_automate_url', powerAutomateUrl);
            localStorage.setItem('mro_power_automate_delete_url', powerAutomateDeleteUrl);

            // Save Supabase credentials
            const supabaseUrlVal = document.getElementById('supabaseUrl')?.value.trim() || '';
            const supabaseAnonKeyVal = document.getElementById('supabaseAnonKey')?.value.trim() || '';
            localStorage.setItem('mro_supabase_url', supabaseUrlVal);
            localStorage.setItem('mro_supabase_anon_key', supabaseAnonKeyVal);
            initSupabase();
            
            const isGas = typeof google !== 'undefined' && google.script && google.script.run && typeof google.script.run.saveFolderUrl === 'function';
            
            if (isGas) {
                showLoadingIndicator(true);
                google.script.run
                    .withSuccessHandler(() => {
                        showLoadingIndicator(false);
                        closeModal('settingsModal');
                        alert('Settings updated successfully!');
                    })
                    .withFailureHandler(err => {
                        showLoadingIndicator(false);
                        alert('Failed to save settings: ' + err.message);
                    })
                    .saveFolderUrl(folderUrl);
            } else {
                localStorage.setItem('mro_custom_folder_url', folderUrl);
                closeModal('settingsModal');
                alert('Settings saved successfully!');
                
                // Trigger reload of data from Supabase if active
                if (window.supabaseClient) {
                    refreshTasksSilently();
                    loadFYIs();
                    loadSAPCodes();
                    if (typeof window.initManualIssuesSync === 'function') {
                        window.initManualIssuesSync();
                    }
                }
            }
        });
    }

    // Bind Details Modal Log Update file attachment triggers
    const detailLogUpdateFile = document.getElementById('detailLogUpdateFile');
    const detailLogUpdateFileBtn = document.getElementById('detailLogUpdateFileBtn');
    const detailLogUpdateFileIndicator = document.getElementById('detailLogUpdateFileIndicator');
    const detailLogUpdateFileName = document.getElementById('detailLogUpdateFileName');
    const detailLogUpdateFileSize = document.getElementById('detailLogUpdateFileSize');
    const detailLogUpdateFileRemoveBtn = document.getElementById('detailLogUpdateFileRemoveBtn');

    if (detailLogUpdateFileBtn && detailLogUpdateFile) {
        detailLogUpdateFileBtn.addEventListener('click', () => {
            detailLogUpdateFile.click();
        });

        detailLogUpdateFile.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                const file = e.target.files[0];
                if (detailLogUpdateFileName) detailLogUpdateFileName.textContent = file.name;
                if (detailLogUpdateFileSize) detailLogUpdateFileSize.textContent = `(${(file.size / 1024).toFixed(1)} KB)`;
                if (detailLogUpdateFileIndicator) detailLogUpdateFileIndicator.style.display = 'flex';
            } else {
                if (detailLogUpdateFileIndicator) detailLogUpdateFileIndicator.style.display = 'none';
            }
        });
    }

    if (detailLogUpdateFileRemoveBtn && detailLogUpdateFile) {
        detailLogUpdateFileRemoveBtn.addEventListener('click', () => {
            detailLogUpdateFile.value = '';
            if (detailLogUpdateFileIndicator) detailLogUpdateFileIndicator.style.display = 'none';
        });
    }

    // Bind FYI team tabs event listeners
    setupFyiTeamTabs();
}

// Helper to keep tab classes in sync with dropdown filter changes
function syncTeamTabs(teamValue) {
    document.querySelectorAll('#teamTabs .team-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.team === teamValue);
    });
}

function setViewMode(mode) {
    activeFilters.viewMode = mode;
    document.getElementById('kanbanViewBtn').classList.toggle('active', mode === 'kanban');
    document.getElementById('listViewBtn').classList.toggle('active', mode === 'list');
    renderTasks();
}

// Modal Handlers
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    
    // Clear attachment state if closing task modal
    if (modalId === 'taskModal') {
        formAttachments = [];
        document.getElementById('filePreviewList').innerHTML = '';
        document.getElementById('taskForm').reset();
    }
}

// Open Add Task Modal
function openAddTaskModal() {
    document.getElementById('modalTitle').innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="12" y1="18" x2="12" y2="12"></line>
            <line x1="9" y1="15" x2="15" y2="15"></line>
        </svg>
        Create Maintenance Task
    `;
    document.getElementById('taskId').value = '';
    document.getElementById('taskForm').reset();
    
    // Default values
    const rtsDateEl = document.getElementById('rtsDate');
    const rtsDateNaEl = document.getElementById('rtsDateNa');
    if (rtsDateNaEl) rtsDateNaEl.checked = false;
    if (rtsDateEl) {
        rtsDateEl.disabled = false;
        rtsDateEl.style.opacity = '1';
        rtsDateEl.value = getRelativeDateString(1);
    }

    const reqContactEl = document.getElementById('requestorContact');
    const reqContactNaEl = document.getElementById('requestorContactNa');
    if (reqContactNaEl) reqContactNaEl.checked = false;
    if (reqContactEl) {
        reqContactEl.disabled = false;
        reqContactEl.style.opacity = '1';
        reqContactEl.value = '';
    }

    document.getElementById('priorityLevel').value = 'Medium';
    document.getElementById('currentStatus').value = 'Open';
    
    // Reset multiselect
    setAssignedTeams('assignedTeamDropdown', 'assignedTeam', 'assignedTeamText', 'Select assigned team...');

    formAttachments = [];
    document.getElementById('taskUrlAttachment').value = '';
    document.getElementById('filePreviewList').innerHTML = '';
    
    openModal('taskModal');
}

// Open Edit Task Modal
function openEditTaskModal(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    // Close details if open
    closeModal('detailsModal');

    document.getElementById('modalTitle').innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
        Edit Maintenance Task
    `;

    document.getElementById('taskId').value = task.id;
    document.getElementById('taskTopic').value = task.topic || '';
    document.getElementById('aircraftReg').value = task.aircraftReg;
    document.getElementById('aircraftType').value = task.aircraftType || '';
    document.getElementById('ataChapter').value = task.ataChapter || '';
    
    // Load RTS Date
    const editRtsDateEl = document.getElementById('rtsDate');
    const editRtsDateNaEl = document.getElementById('rtsDateNa');
    if (task.rtsDate === 'N/A' || !task.rtsDate) {
        if (editRtsDateNaEl) editRtsDateNaEl.checked = true;
        if (editRtsDateEl) {
            editRtsDateEl.value = '';
            editRtsDateEl.disabled = true;
            editRtsDateEl.style.opacity = '0.5';
        }
    } else {
        if (editRtsDateNaEl) editRtsDateNaEl.checked = false;
        if (editRtsDateEl) {
            editRtsDateEl.value = task.rtsDate;
            editRtsDateEl.disabled = false;
            editRtsDateEl.style.opacity = '1';
        }
    }

    // Populate multiselect for assigned team
    setAssignedTeams('assignedTeamDropdown', 'assignedTeam', 'assignedTeamText', 'Select assigned team...', task.assignedTeam || '');
    document.getElementById('requestor').value = task.requestor;
    
    // Load Requestor Contact
    const editReqContactEl = document.getElementById('requestorContact');
    const editReqContactNaEl = document.getElementById('requestorContactNa');
    if (task.requestorContact === 'N/A' || !task.requestorContact) {
        if (editReqContactNaEl) editReqContactNaEl.checked = true;
        if (editReqContactEl) {
            editReqContactEl.value = '';
            editReqContactEl.disabled = true;
            editReqContactEl.style.opacity = '0.5';
        }
    } else {
        if (editReqContactNaEl) editReqContactNaEl.checked = false;
        if (editReqContactEl) {
            editReqContactEl.value = task.requestorContact;
            editReqContactEl.disabled = false;
            editReqContactEl.style.opacity = '1';
        }
    }

    document.getElementById('priorityLevel').value = task.priorityLevel;
    document.getElementById('currentStatus').value = task.currentStatus;
    document.getElementById('taskDescription').value = task.taskDescription;
    document.getElementById('taskUrlAttachment').value = '';

    // Load existing files
    formAttachments = [...task.attachments];
    renderFilePreviews();

    openModal('taskModal');
}

// Open Details Viewer Modal
function openDetailsModal(id) {
    activeDetailsTaskId = id;
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    // Ensure attachments and comments are parsed/arrays
    if (typeof task.attachments === 'string') {
        try { task.attachments = JSON.parse(task.attachments); } catch(e) { task.attachments = []; }
    }
    task.attachments = task.attachments || [];

    if (typeof task.comments === 'string') {
        try { task.comments = JSON.parse(task.comments); } catch(e) { task.comments = []; }
    }
    task.comments = task.comments || [];

    // Reset comment inputs
    const commentTextEl = document.getElementById('commentText');
    if (commentTextEl) commentTextEl.value = '';
    const updateTextEl = document.getElementById('updateText');
    if (updateTextEl) updateTextEl.value = '';

    // Reset log update file input and indicator
    const logUpdateFileEl = document.getElementById('detailLogUpdateFile');
    if (logUpdateFileEl) logUpdateFileEl.value = '';
    const logUpdateFileIndicatorEl = document.getElementById('detailLogUpdateFileIndicator');
    if (logUpdateFileIndicatorEl) logUpdateFileIndicatorEl.style.display = 'none';

    // Set signed in user as default author
    const commentAuthorEl = document.getElementById('commentAuthor');
    const updateAuthorEl = document.getElementById('updateAuthor');
    const loggedInUser = sessionStorage.getItem('mro_user') || localStorage.getItem('mro_user') || 'DMA Staff';
    if (commentAuthorEl) commentAuthorEl.value = loggedInUser;
    if (updateAuthorEl) updateAuthorEl.value = loggedInUser;

    document.getElementById('detailReg').textContent = task.aircraftReg || '-';
    document.getElementById('detailAircraftType').textContent = `(${task.aircraftType || 'A320'})`;
    document.getElementById('detailAtaChapter').textContent = task.ataChapter ? `ATA ${task.ataChapter}` : 'ATA N/A';
    document.getElementById('detailAircraftTypeSidebar').textContent = task.aircraftType || 'A320';
    
    // Priority badge
    const prioBadge = document.getElementById('detailPriority');
    const priority = task.priorityLevel || 'Medium';
    prioBadge.className = `badge-priority ${priority.toLowerCase()}`;
    prioBadge.textContent = priority;

    // Topic
    document.getElementById('detailTopic').textContent = task.topic || 'No Topic';

    // Description
    document.getElementById('detailDesc').textContent = task.taskDescription || '';

    // Sidebar Info
    document.getElementById('detailRequestor').textContent = task.requestor || '-';
    document.getElementById('detailRequestorContact').textContent = task.requestorContact || '-';
    document.getElementById('detailCreatedDate').textContent = task.createdDate || 'N/A';
    document.getElementById('detailRtsDate').textContent = task.rtsDate || 'N/A';
    
    // Team badges — supports multiple teams (comma-separated)
    function getTeamClassDetail(t) {
        if (t.includes('Avionic')) return 'avionics';
        if (t.includes('Structure')) return 'struct';
        if (t.includes('Engines')) return 'engines';
        if (t.includes('IERA')) return 'iera';
        if (t.includes('Component')) return 'component';
        return 'mech';
    }
    const assignedTeamStr = task.assignedTeam || '';
    const teamsList = assignedTeamStr.split(',').map(s => s.trim()).filter(Boolean);
    const teamBadge = document.getElementById('detailTeam');
    teamBadge.className = ''; // clear existing single badge class
    teamBadge.style = 'display:flex;flex-direction:column;gap:4px;';
    if (teamsList.length === 0) {
        teamBadge.innerHTML = `<span class="team-badge mech" style="text-align:center;">Unassigned</span>`;
    } else {
        teamBadge.innerHTML = teamsList.map(t => `<span class="team-badge ${getTeamClassDetail(t)}" style="text-align:center;display:block;padding:4px 8px;">${t}</span>`).join('');
    }

    // Status badge
    let statusClass = 'open';
    if (task.currentStatus === 'In Progress') statusClass = 'progress';
    else if (task.currentStatus === 'Completed') statusClass = 'completed';

    const statusBadge = document.getElementById('detailStatus');
    statusBadge.className = `badge-status ${statusClass}`;
    statusBadge.textContent = task.currentStatus || 'Open';

    // Files list rendering
    const filesContainer = document.getElementById('detailFiles');
    filesContainer.innerHTML = '';
    
    if (task.attachments && task.attachments.length > 0) {
        task.attachments.forEach(file => {
            const btn = document.createElement('a');
            btn.href = file.data;
            btn.target = '_blank';
            btn.rel = 'noopener noreferrer';
            btn.className = 'download-file-btn';
            
            const isUrl = file.type === 'url';
            if (!isUrl) {
                btn.download = file.name;
            }

            const sizeLabel = isUrl ? 'Link' : `${(file.size / 1024).toFixed(1)} KB`;
            
            const leftIconSvg = isUrl ? `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px; flex-shrink: 0;">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                </svg>
            ` : `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px; flex-shrink: 0;">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
            `;

            const rightIconSvg = isUrl ? `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px; flex-shrink: 0;">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
            ` : `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px; flex-shrink: 0;">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
            `;

            btn.innerHTML = `
                <span class="btn-left">
                    ${leftIconSvg}
                    <span>${file.name} (${sizeLabel})</span>
                </span>
                ${rightIconSvg}
            `;
            filesContainer.appendChild(btn);
        });
    } else {
        filesContainer.innerHTML = '<span style="font-size: 0.85rem; color: var(--text-muted);">No files attached</span>';
    }

    // Modal actions
    document.getElementById('detailEditBtn').onclick = () => openEditTaskModal(task.id);
    document.getElementById('detailDeleteBtn').onclick = () => confirmDeleteTask(task.id);

    const progressBtn = document.getElementById('detailProgressBtn');
    const completeBtn = document.getElementById('detailCompleteBtn');

    if (progressBtn && completeBtn) {
        if (task.currentStatus === 'Completed') {
            progressBtn.style.display = 'none';
            completeBtn.style.display = 'flex';
            completeBtn.className = 'btn btn-secondary';
            completeBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;">
                    <path d="M3 7v6h6"></path>
                    <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path>
                </svg>
                Reopen Task
            `;
            completeBtn.onclick = () => {
                updateTaskStatus(task.id, 'In Progress');
                openDetailsModal(task.id);
            };
        } else if (task.currentStatus === 'In Progress') {
            progressBtn.style.display = 'flex';
            progressBtn.className = 'btn btn-secondary';
            progressBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                Mark Open
            `;
            progressBtn.onclick = () => {
                updateTaskStatus(task.id, 'Open');
                openDetailsModal(task.id);
            };

            completeBtn.style.display = 'flex';
            completeBtn.className = 'btn btn-success';
            completeBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Complete Task
            `;
            completeBtn.onclick = () => {
                updateTaskStatus(task.id, 'Completed');
                openDetailsModal(task.id);
            };
        } else {
            progressBtn.style.display = 'flex';
            progressBtn.className = 'btn btn-primary';
            progressBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                Start Work
            `;
            progressBtn.onclick = () => {
                updateTaskStatus(task.id, 'In Progress');
                openDetailsModal(task.id);
            };

            completeBtn.style.display = 'flex';
            completeBtn.className = 'btn btn-success';
            completeBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Complete Task
            `;
            completeBtn.onclick = () => {
                updateTaskStatus(task.id, 'Completed');
                openDetailsModal(task.id);
            };
        }
    }

    // Render Comments
    renderComments(task);

    openModal('detailsModal');
}

// Helper: Render Comments and Updates inside Details Modal
function renderComments(task) {
    const commentsList = document.getElementById('detailCommentsList');
    const commentCount = document.getElementById('detailCommentCount');
    const updatesList = document.getElementById('detailUpdatesList');
    const updateCount = document.getElementById('detailUpdateCount');
    if (!commentsList || !commentCount || !updatesList || !updateCount) return;

    const allItems = task.comments || [];
    
    // Separate into updates and comments
    const comments = allItems.filter(item => !item.type || item.type === 'comment');
    const updates = allItems.filter(item => item.type === 'update');

    // Render Comments
    commentCount.textContent = comments.length;
    commentsList.innerHTML = '';
    if (comments.length === 0) {
        commentsList.innerHTML = '<span style="font-size: 0.85rem; color: var(--text-muted); display: block; padding: 0.5rem 0;">No comments yet. Be the first to comment!</span>';
    } else {
        comments.forEach(comment => {
            commentsList.appendChild(createCommentDOM(comment));
        });
    }

    // Render Updates
    updateCount.textContent = updates.length;
    updatesList.innerHTML = '';
    if (updates.length === 0) {
        updatesList.innerHTML = '<span style="font-size: 0.85rem; color: var(--text-muted); display: block; padding: 0.5rem 0; padding-left: 1.25rem;">No updates logged yet.</span>';
    } else {
        const dhlTimeline = document.createElement('div');
        dhlTimeline.className = 'dhl-timeline';
        
        // Sort ascending: oldest first
        const sortedUpdates = [...updates].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        sortedUpdates.forEach((update, idx) => {
            let monthDay = '';
            let yearVal = '';
            let timeStr = '';
            try {
                const d = new Date(update.timestamp);
                const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                const day = String(d.getDate()).padStart(2,'0');
                const mon = months[d.getMonth()];
                yearVal = d.getFullYear();
                monthDay = `${mon} ${day},`;
                
                let hours = d.getHours();
                const minutes = String(d.getMinutes()).padStart(2,'0');
                const ampm = hours >= 12 ? 'PM' : 'AM';
                hours = hours % 12;
                hours = hours ? hours : 12;
                timeStr = `${hours}:${minutes} ${ampm}`;
            } catch(e) {
                monthDay = 'Date';
                yearVal = 'N/A';
                timeStr = update.timestamp;
            }
            
            // Show date only if it's different from the previous one in the list
            let showDate = true;
            if (idx > 0) {
                try {
                    const prevD = new Date(sortedUpdates[idx - 1].timestamp);
                    const currD = new Date(update.timestamp);
                    showDate = prevD.toDateString() !== currD.toDateString();
                } catch(e) {}
            }
            
            const itemDiv = document.createElement('div');
            itemDiv.className = 'dhl-timeline-item';
            
            const dateHtml = showDate 
                ? `<span class="dhl-date-month">${monthDay}</span>
                   <span class="dhl-date-year">${yearVal}</span>`
                : '';
                
            itemDiv.innerHTML = `
                <div class="dhl-timeline-date">
                    ${dateHtml}
                </div>
                <div class="dhl-timeline-node-container">
                    <div class="dhl-timeline-badge">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" class="dhl-checkmark">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </div>
                </div>
                <div class="dhl-timeline-content">
                    <div class="dhl-status-title">${escapeHTMLApp(update.text)}</div>
                    <div class="dhl-status-subtext">${timeStr} &middot; ${escapeHTMLApp(update.author)}</div>
                </div>
            `;
            dhlTimeline.appendChild(itemDiv);
        });
        updatesList.appendChild(dhlTimeline);
    }
    
    // Scroll both lists appropriately
    commentsList.scrollTop = commentsList.scrollHeight;
    updatesList.scrollTop = updatesList.scrollHeight;
}

// Helper: Generate DOM for comments and updates
function createCommentDOM(item, isLatest) {
    if (item.type === 'update') {
        const itemDiv = document.createElement('div');
        itemDiv.className = `timeline-item${isLatest ? ' latest' : ''}`;
        
        let dateStr = '';
        try {
            const d = new Date(item.timestamp);
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const date = String(d.getDate()).padStart(2, '0');
            
            let hours = d.getHours();
            const minutes = String(d.getMinutes()).padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12;
            const timeStr = `${hours}:${minutes} ${ampm}`;
            
            dateStr = `${m}/${date} ${timeStr}`;
        } catch (e) {
            dateStr = item.timestamp;
        }

        itemDiv.innerHTML = `
            <div class="timeline-badge-container">
                <div class="timeline-badge"></div>
            </div>
            <div class="timeline-card">
                <div class="timeline-card-header">
                    <span class="timeline-author">${escapeHTMLApp(item.author)}</span>
                    <span class="timeline-time">${dateStr}</span>
                </div>
                <div class="timeline-card-text">${escapeHTMLApp(item.text)}</div>
            </div>
        `;
        return itemDiv;
    } else {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'comment-item';
        itemDiv.style.borderLeft = '3.5px solid var(--border-color)';
        
        let dateStr = '';
        try {
            const d = new Date(item.timestamp);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const date = String(d.getDate()).padStart(2, '0');
            const h = String(d.getHours()).padStart(2, '0');
            const min = String(d.getMinutes()).padStart(2, '0');
            dateStr = `${y}-${m}-${date} ${h}:${min}`;
        } catch (e) {
            dateStr = item.timestamp;
        }

        itemDiv.innerHTML = `
            <div class="comment-header">
                <span class="comment-author">${escapeHTMLApp(item.author)}</span>
                <span class="comment-time">${dateStr}</span>
            </div>
            <div class="comment-text">${escapeHTMLApp(item.text)}</div>
        `;
        return itemDiv;
    }
}

// Simple HTML escaping helper to prevent XSS in comments
function escapeHTMLApp(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Form Submission (Create or Edit Task)
function handleFormSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('taskId').value;
    const aircraftReg = document.getElementById('aircraftReg').value.trim().toUpperCase();
    const aircraftType = document.getElementById('aircraftType').value;
    const ataChapter = document.getElementById('ataChapter').value.trim();
    const rtsDateNa = document.getElementById('rtsDateNa').checked;
    const rtsDateVal = document.getElementById('rtsDate').value;
    const rtsDate = rtsDateNa ? 'N/A' : (rtsDateVal || 'N/A');

    const assignedTeam = document.getElementById('assignedTeam').value;
    const requestor = document.getElementById('requestor').value.trim();

    const requestorContactNa = document.getElementById('requestorContactNa').checked;
    const requestorContactVal = document.getElementById('requestorContact').value.trim();
    const requestorContact = requestorContactNa ? 'N/A' : (requestorContactVal || 'N/A');
    const priorityLevel = document.getElementById('priorityLevel').value;
    const currentStatus = document.getElementById('currentStatus').value;
    const taskDescription = document.getElementById('taskDescription').value.trim();
    const topic = document.getElementById('taskTopic').value.trim() || 'General';

    // Validations
    if (!aircraftReg || !aircraftType || !ataChapter || !rtsDate || !assignedTeam || !requestor || !requestorContact || !taskDescription || !topic) {
        alert('Please fill out all required fields.');
        return;
    }

    let taskToSave = null;
    if (id) {
        // Edit Mode
        const taskIndex = tasks.findIndex(t => t.id === id);
        if (taskIndex !== -1) {
            const originalAttachments = tasks[taskIndex].attachments || [];
            const newAttachmentUrls = new Set(formAttachments.map(fa => fa.data));
            
            originalAttachments.forEach(att => {
                if (!newAttachmentUrls.has(att.data)) {
                    if (att.type !== 'url' && att.data && !att.data.startsWith('data:')) {
                        requestDeleteOneDriveFile(
                            att.name,
                            tasks[taskIndex].assignedTeam || '',
                            tasks[taskIndex].createdDate || '',
                            tasks[taskIndex].aircraftReg || 'N-A',
                            tasks[taskIndex].topic || tasks[taskIndex].taskDescription || 'General'
                        );
                    }
                }
            });

            tasks[taskIndex] = {
                ...tasks[taskIndex],
                topic,
                aircraftReg,
                aircraftType,
                ataChapter,
                rtsDate,
                assignedTeam,
                requestor,
                requestorContact,
                priorityLevel,
                currentStatus,
                taskDescription,
                attachments: [...formAttachments]
            };
            taskToSave = tasks[taskIndex];
        }
    } else {
        // Create Mode
        const newTask = {
            id: 'task-' + Date.now(),
            topic,
            aircraftReg,
            aircraftType,
            ataChapter,
            createdDate: new Date().toISOString().split('T')[0],
            rtsDate,
            assignedTeam,
            requestor,
            requestorContact,
            priorityLevel,
            currentStatus,
            taskDescription,
            attachments: [...formAttachments]
        };
        tasks.push(newTask);
        taskToSave = newTask;
    }

    saveTaskData(taskToSave);
    closeModal('taskModal');
    renderApp();
}

// Delete task from details modal
function confirmDeleteTask(id) {
    const taskToDelete = tasks.find(t => t.id === id);
    if (confirm('Are you sure you want to permanently delete this MRO task?')) {
        if (taskToDelete) {
            deleteOneDriveFilesForTask(taskToDelete);
        }
        tasks = tasks.filter(t => t.id !== id);
        deleteTaskData(id);
        closeModal('detailsModal');
        renderApp();
    }
}

// Delete task directly from list view
function deleteTaskDirect(id) {
    const taskToDelete = tasks.find(t => t.id === id);
    if (confirm('Are you sure you want to permanently delete this task?')) {
        if (taskToDelete) {
            deleteOneDriveFilesForTask(taskToDelete);
        }
        tasks = tasks.filter(t => t.id !== id);
        deleteTaskData(id);
        renderApp();
    }
}

// Toggle task completion status
function toggleTaskCompletion(id, event) {
    if (event) event.stopPropagation();
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    if (task.currentStatus === 'Completed') {
        task.currentStatus = 'In Progress';
        delete task.completedDate;
    } else {
        task.currentStatus = 'Completed';
        task.completedDate = new Date().toISOString().split('T')[0];
    }

    saveTaskData(task);
    renderApp();
}

// Update task status directly
function updateTaskStatus(id, status) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    task.currentStatus = status;
    saveTaskData(task);
    renderApp();
}

// Reset data handler
function confirmResetDemo() {
    if (confirm('This will wipe out all changes and restore the board with demo MRO tasks. Proceed?')) {
        localStorage.removeItem('mro_tasks');
        initApp();
    }
}

// EXPORT TO EXCEL (.CSV)
function exportToExcel() {
    if (tasks.length === 0) {
        alert('No tasks available to export.');
        return;
    }

    const activeTabItem = document.querySelector('.tab-item.active');
    const activeTab = activeTabItem ? activeTabItem.dataset.tab : 'board';

    let tasksToExport = tasks;
    let filenamePrefix = 'MRO_All_Tasks_Report';

    if (activeTab === 'summary') {
        filenamePrefix = 'MRO_Weekly_Report';
        const teamHidden = document.getElementById('summaryTeamHidden');
        const selectedTeams = teamHidden && teamHidden.value ? teamHidden.value.split(',').map(s => s.trim()).filter(Boolean) : [];
        
        // Filter by selected team exactly like the Weekly Summary tab
        tasksToExport = tasks.filter(t => {
            if (selectedTeams.length === 0) return true;
            const taskTeams = (t.assignedTeam || '').split(',').map(s => s.trim());
            return taskTeams.some(team => selectedTeams.includes(team));
        });

        // Sort identical to the Weekly Report table
        const statusOrder = { 'Open': 1, 'In Progress': 2, 'Completed': 3 };
        tasksToExport.sort((a, b) => {
            const orderA = statusOrder[a.currentStatus] || 99;
            const orderB = statusOrder[b.currentStatus] || 99;
            if (orderA !== orderB) {
                return orderA - orderB;
            }
            if (a.rtsDate === 'N/A' && b.rtsDate === 'N/A') return 0;
            if (a.rtsDate === 'N/A') return 1;
            if (b.rtsDate === 'N/A') return -1;
            return new Date(a.rtsDate) - new Date(b.rtsDate);
        });
    }

    if (tasksToExport.length === 0) {
        alert('No tasks match the active filters to export.');
        return;
    }

    const headers = [
        'Aircraft Registration',
        'Aircraft Type',
        'ATA Chapter',
        'Assigned Team',
        'Priority Level',
        'RTS Date',
        'Requestor',
        'Requestor Contact',
        'Status',
        'Task Description',
        'Attachments Count',
        'Status Updates & Log'
    ];

    const rows = tasksToExport.map(task => {
        // Format status updates & logs
        const updates = (task.comments || []).filter(item => item.type === 'update');
        const sortedUpdates = [...updates].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        const updatesText = sortedUpdates.map((u, index) => {
            let dateLabel = '';
            try {
                const d = new Date(u.timestamp);
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                const yr = d.getFullYear();
                dateLabel = `${day}/${m}/${yr}`;
            } catch(e) {}
            return `[${dateLabel}] ${u.author}: ${u.text}`;
        }).join('\n');

        return [
            task.aircraftReg,
            task.aircraftType || 'A320',
            task.ataChapter || 'N/A',
            task.assignedTeam,
            task.priorityLevel,
            task.rtsDate,
            task.requestor,
            task.requestorContact || '',
            task.currentStatus,
            task.taskDescription,
            task.attachments.length,
            updatesText
        ];
    });

    // Construct CSV String
    let csvContent = '\uFEFF'; // UTF-8 BOM for proper Excel encoding
    csvContent += headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',') + '\r\n';

    rows.forEach(row => {
        csvContent += row.map(val => {
            const strVal = String(val);
            return `"${strVal.replace(/"/g, '""')}"`;
        }).join(',') + '\r\n';
    });

    // Trigger Browser Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const dateStamp = new Date().toISOString().split('T')[0];
    link.href = url;
    link.download = `${filenamePrefix}_${dateStamp}.csv`;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// EXPORT TO PDF (Native window print layout)
function exportToPdf() {
    // Generate list grouping tables before print, so print outputs all items regardless of active view
    renderList(tasks); 
    window.print();
}

// Attachments Processing
function handleFileSelect(e) {
    if (e.target.files.length > 0) {
        processFiles(e.target.files);
    }
}

function processFiles(fileList) {
    const isGas = typeof google !== 'undefined' && google.script && google.script.run && !google.script.isMock;
    const powerAutomateUrl = localStorage.getItem('mro_power_automate_url') || 'https://defaultc71838d2745b4a4fb00f2d0e6e1de6.f3.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/bd6fa12380224456960c9003b9f37992/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=3z3pW754II2nFkKkReGGm2xXiiIH1piGeaphI7Z60zs';
    const hasCloud = isGas || (powerAutomateUrl && powerAutomateUrl.trim() !== '');
    
    // Max 10 files limit
    if (formAttachments.length + fileList.length > 10) {
        alert('Maximum of 10 attachment files allowed per task.');
        return;
    }

    const taskId = document.getElementById('taskId') ? document.getElementById('taskId').value : '';
    let assignedTeam = document.getElementById('assignedTeam') ? document.getElementById('assignedTeam').value : '';
    let dateStr = new Date().toISOString().split('T')[0];
    
    let aircraftRegInput = document.getElementById('aircraftReg');
    let aircraftReg = aircraftRegInput ? aircraftRegInput.value.trim().toUpperCase() || 'N-A' : 'N-A';
    let taskTopicInput = document.getElementById('taskTopic');
    let topic = taskTopicInput ? taskTopicInput.value.trim() || 'General' : 'General';
    
    if (taskId) {
        const existingTask = tasks.find(t => t.id === taskId);
        if (existingTask) {
            if (!assignedTeam && existingTask.assignedTeam) {
                assignedTeam = existingTask.assignedTeam;
            }
            if (existingTask.createdDate) {
                dateStr = existingTask.createdDate;
            }
            if (existingTask.aircraftReg && (aircraftReg === '' || aircraftReg === 'N-A')) {
                aircraftReg = existingTask.aircraftReg;
            }
            if (existingTask.topic || existingTask.taskDescription) {
                if (topic === '' || topic === 'General') {
                    topic = existingTask.topic || existingTask.taskDescription;
                }
            }
        }
    }

    Array.from(fileList).forEach(file => {
        // Size check: 10MB for cloud storage, 1MB for local storage fallback
        const maxLimit = hasCloud ? 10 * 1024 * 1024 : 1024 * 1024;
        if (file.size > maxLimit) {
            alert(`File "${file.name}" exceeds the ${hasCloud ? '10MB' : '1MB'} limit.`);
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            handleCloudOrLocalUpload(file, e.target.result, (url) => {
                formAttachments.push({
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    data: url
                });
                renderFilePreviews();
            }, () => {
                formAttachments.push({
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    data: e.target.result // Base64 data URL
                });
                renderFilePreviews();
            }, assignedTeam, dateStr, aircraftReg, topic);
        };
        reader.readAsDataURL(file);
    });
}

function renderFilePreviews() {
    const list = document.getElementById('filePreviewList');
    list.innerHTML = '';

    formAttachments.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'file-item';

        const isUrl = file.type === 'url';
        const sizeLabel = isUrl ? 'Link' : `${(file.size / 1024).toFixed(1)} KB`;
        
        const iconSvg = isUrl ? `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px; flex-shrink: 0;">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
            </svg>
        ` : `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px; flex-shrink: 0;">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
        `;

        item.innerHTML = `
            <div class="file-item-name">
                ${iconSvg}
                <span title="${file.name}">${file.name} (${sizeLabel})</span>
            </div>
            <button type="button" class="remove-file" onclick="removeAttachment(${index})">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        `;
        list.appendChild(item);
    });
}

// Global attachment remover
window.removeAttachment = function(index) {
    formAttachments.splice(index, 1);
    renderFilePreviews();
};

// Global modals opener helper
window.openDetailsModal = openDetailsModal;
window.openEditTaskModal = openEditTaskModal;
window.deleteTaskDirect = deleteTaskDirect;
window.toggleTaskCompletion = toggleTaskCompletion;
window.updateTaskStatus = updateTaskStatus;
window.closeModal = closeModal;

// ==========================================================================
// TEAM ANALYTICS ENGINE
// ==========================================================================

const TEAM_DEFINITIONS = [
    { name: 'Mechanical System Team', cssClass: 'mech-card', shortName: 'Mechanical System' },
    { name: 'Avionic Systems Team', cssClass: 'avionics-card', shortName: 'Avionic Systems' },
    { name: 'Structure Team', cssClass: 'struct-card', shortName: 'Structure' },
    { name: 'Engines Team', cssClass: 'engines-card', shortName: 'Engines' },
    { name: 'IERA Shop', cssClass: 'iera-card', shortName: 'IERA Shop' },
    { name: 'Component Team', cssClass: 'component-card', shortName: 'Component' }
];

// MRO-specific keyword categories for recurring issue detection
const MRO_KEYWORDS = [
    { keyword: 'hydraulic', label: 'Hydraulic System' },
    { keyword: 'oil pressure', label: 'Oil Pressure' },
    { keyword: 'oil', label: 'Oil System' },
    { keyword: 'wiring', label: 'Wiring / Harness' },
    { keyword: 'wire', label: 'Wiring / Harness' },
    { keyword: 'display', label: 'Display / Indicator' },
    { keyword: 'indicator', label: 'Display / Indicator' },
    { keyword: 'pfd', label: 'PFD (Primary Flight Display)' },
    { keyword: 'steering', label: 'Steering System' },
    { keyword: 'landing gear', label: 'Landing Gear' },
    { keyword: 'nose wheel', label: 'Nose Wheel / Gear' },
    { keyword: 'engine', label: 'Engine (General)' },
    { keyword: 'borescope', label: 'Borescope Inspection' },
    { keyword: 'compressor', label: 'Compressor Section' },
    { keyword: 'turbine', label: 'Turbine Section' },
    { keyword: 'leak', label: 'Fluid Leak' },
    { keyword: 'crack', label: 'Crack / Fracture' },
    { keyword: 'corrosion', label: 'Corrosion' },
    { keyword: 'delamination', label: 'Delamination / Disbond' },
    { keyword: 'composite', label: 'Composite Structure' },
    { keyword: 'flap', label: 'Flap / Control Surface' },
    { keyword: 'actuator', label: 'Actuator' },
    { keyword: 'seal', label: 'Seal Replacement' },
    { keyword: 'bus', label: 'Electrical Bus' },
    { keyword: 'transmitter', label: 'Transmitter / Sensor' },
    { keyword: 'pressure', label: 'Pressure System' },
    { keyword: 'avionics', label: 'Avionics (General)' },
    { keyword: 'fod', label: 'FOD (Foreign Object Damage)' },
    { keyword: 'vibration', label: 'Vibration' },
    { keyword: 'fuel', label: 'Fuel System' },
    { keyword: 'pneumatic', label: 'Pneumatic System' },
    { keyword: 'apu', label: 'APU (Auxiliary Power Unit)' },
    { keyword: 'fire', label: 'Fire Detection / Protection' },
    { keyword: 'oxygen', label: 'Oxygen System' }
];

function renderAnalytics() {
    const grid = document.getElementById('analyticsGrid');
    grid.innerHTML = '';

    TEAM_DEFINITIONS.forEach(teamDef => {
        const teamTasks = tasks.filter(t => (t.assignedTeam || '').split(',').map(s => s.trim()).includes(teamDef.name));
        const card = buildAnalyticsCard(teamDef, teamTasks);
        grid.appendChild(card);
    });
}

function buildAnalyticsCard(teamDef, teamTasks) {
    const card = document.createElement('div');
    card.className = `analytics-card ${teamDef.cssClass}`;

    const total = teamTasks.length;
    const openCount = teamTasks.filter(t => t.currentStatus === 'Open').length;
    const progressCount = teamTasks.filter(t => t.currentStatus === 'In Progress').length;
    const completedCount = teamTasks.filter(t => t.currentStatus === 'Completed').length;

    // Priority counts
    const aogCount = teamTasks.filter(t => t.priorityLevel === 'AOG').length;
    const highCount = teamTasks.filter(t => t.priorityLevel === 'High').length;
    const mediumCount = teamTasks.filter(t => t.priorityLevel === 'Medium').length;
    const lowCount = teamTasks.filter(t => t.priorityLevel === 'Low').length;

    // Priority bar percentages
    const pctAog = total > 0 ? (aogCount / total * 100) : 0;
    const pctHigh = total > 0 ? (highCount / total * 100) : 0;
    const pctMedium = total > 0 ? (mediumCount / total * 100) : 0;
    const pctLow = total > 0 ? (lowCount / total * 100) : 0;

    // Get combined recurring issues for this team
    const recurringIssues = getTeamRecurringIssues(teamDef.name, teamTasks);

    card.innerHTML = `
        <div class="analytics-card-header">
            <div class="analytics-team-title">
                <span class="analytics-team-dot"></span>
                <h3>${teamDef.shortName}</h3>
            </div>
            <div class="analytics-total-badge">
                ${total}
                <span>Total Tasks</span>
            </div>
        </div>
        <div class="analytics-card-body">
            <!-- Status Breakdown -->
            <div class="status-breakdown">
                <div class="status-mini-card s-open">
                    <div class="status-mini-val">${openCount}</div>
                    <div class="status-mini-lbl">Open</div>
                </div>
                <div class="status-mini-card s-progress">
                    <div class="status-mini-val">${progressCount}</div>
                    <div class="status-mini-lbl">In Progress</div>
                </div>
                <div class="status-mini-card s-completed">
                    <div class="status-mini-val">${completedCount}</div>
                    <div class="status-mini-lbl">Completed</div>
                </div>
            </div>

            <!-- Priority Distribution Bar -->
            <div class="priority-section">
                <h4>Priority Distribution</h4>
                <div class="priority-bar-container">
                    <div class="priority-bar-segment seg-aog" style="width: ${pctAog}%" title="AOG: ${aogCount}"></div>
                    <div class="priority-bar-segment seg-high" style="width: ${pctHigh}%" title="High: ${highCount}"></div>
                    <div class="priority-bar-segment seg-medium" style="width: ${pctMedium}%" title="Medium: ${mediumCount}"></div>
                    <div class="priority-bar-segment seg-low" style="width: ${pctLow}%" title="Low: ${lowCount}"></div>
                </div>
                <div class="priority-legend">
                    <div class="legend-item"><span class="legend-dot l-aog"></span> AOG (${aogCount})</div>
                    <div class="legend-item"><span class="legend-dot l-high"></span> High (${highCount})</div>
                    <div class="legend-item"><span class="legend-dot l-medium"></span> Medium (${mediumCount})</div>
                    <div class="legend-item"><span class="legend-dot l-low"></span> Low (${lowCount})</div>
                </div>
            </div>

            <!-- Recurring Issues -->
            <div class="recurring-section">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <h4 style="margin: 0;">Recurring Issues / Common Problems</h4>
                    <button type="button" class="btn btn-primary btn-xs" onclick="openAddTeamIssueModal('${teamDef.name}')" style="padding: 4px 8px; font-size: 0.72rem; display: flex; align-items: center; gap: 4px; font-weight: 600; height: 26px;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 10px; height: 10px;">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Add Issue
                    </button>
                </div>
                <div class="recurring-list">
                    ${recurringIssues.length > 0 ? recurringIssues.map(issue => `
                        <div class="recurring-item">
                            <div class="recurring-info">
                                <div style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
                                    <span class="recurring-keyword">${escapeHTMLApp(issue.label)}</span>
                                    ${issue.type === 'Manually Added' ? `<span style="font-size: 0.65rem; background: var(--bg-hover); color: var(--text-muted); border: 1px solid var(--border-color); padding: 1px 4px; border-radius: 4px; font-weight: 500;">Manual</span>` : ''}
                                    ${issue.type === 'Combined' ? `<span style="font-size: 0.65rem; background: var(--bg-hover); color: var(--text-muted); border: 1px solid var(--border-color); padding: 1px 4px; border-radius: 4px; font-weight: 500;">Combined</span>` : ''}
                                </div>
                                <span class="recurring-aircraft">Aircraft: ${issue.aircraft.map(ac => escapeHTMLApp(ac)).join(', ')}</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                                <div class="recurring-count-badge">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                        <polyline points="17 8 12 3 7 8"></polyline>
                                        <line x1="12" y1="3" x2="12" y2="15"></line>
                                    </svg>
                                    ${issue.count}x
                                </div>
                                <button class="edit-issue-btn" 
                                        data-label="${escapeHTMLApp(issue.label)}" 
                                        data-team="${escapeHTMLApp(teamDef.name)}" 
                                        onclick="event.stopPropagation(); openEditTeamIssueModalByDetails(this.dataset.label, this.dataset.team)" 
                                        title="Edit Issue" 
                                        style="padding: 4px; border-radius: 4px;">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;">
                                        <path d="M12 20h9"></path>
                                        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
                                    </svg>
                                </button>
                                <button class="delete-issue-btn" 
                                        data-label="${escapeHTMLApp(issue.label)}" 
                                        data-team="${escapeHTMLApp(teamDef.name)}" 
                                        onclick="event.stopPropagation(); removeTeamManualIssue(this.dataset.label, this.dataset.team)" 
                                        title="Delete Issue" 
                                        style="padding: 4px; border-radius: 4px;">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;">
                                        <polyline points="3 6 5 6 21 6"></polyline>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    `).join('') : '<div class="recurring-empty">No recurring issues detected for this team</div>'}
                </div>
            </div>
        </div>
    `;

    return card;
}

/**
 * Detect recurring maintenance issues for a team by scanning task descriptions
 * against a library of MRO-specific keywords. Groups matches by keyword label
 * and tracks which aircraft registrations are affected.
 */
function detectRecurringIssues(teamTasks) {
    if (teamTasks.length === 0) return [];

    const issueMap = {}; // label -> { count, aircraft Set }

    teamTasks.forEach(task => {
        const descLower = task.taskDescription.toLowerCase();
        const matchedLabels = new Set(); // Prevent double-counting same label per task

        MRO_KEYWORDS.forEach(kw => {
            if (descLower.includes(kw.keyword) && !matchedLabels.has(kw.label)) {
                if (typeof isIssueBlacklisted === 'function' && isIssueBlacklisted(kw.label, task.assignedTeam)) {
                    return;
                }
                matchedLabels.add(kw.label);
                if (!issueMap[kw.label]) {
                    issueMap[kw.label] = { count: 0, aircraft: new Set() };
                }
                issueMap[kw.label].count++;
                issueMap[kw.label].aircraft.add(task.aircraftReg);
            }
        });
    });

    // Convert to array, sort by count descending, limit to top 5
    return Object.entries(issueMap)
        .map(([label, data]) => ({
            label,
            count: data.count,
            aircraft: Array.from(data.aircraft)
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
}

/**
 * Combined recurring issues (Auto-detected + Manually added) for a specific team.
 */
function getTeamRecurringIssues(teamName, teamTasks) {
    // 1. Get auto-detected issues
    const autoIssues = detectRecurringIssues(teamTasks);

    // 2. Get manual issues for this team
    let manualIssues = [];
    if (typeof loadManualIssues === 'function') {
        const allManual = loadManualIssues();
        manualIssues = allManual.filter(issue => (issue.assignedTeam || 'Mechanical System Team') === teamName);
    }

    // 3. Combine them in a map
    const combinedMap = {};

    autoIssues.forEach(issue => {
        combinedMap[issue.label] = {
            label: issue.label,
            count: issue.count,
            aircraft: new Set(issue.aircraft),
            type: 'Auto-detected'
        };
    });

    manualIssues.forEach(issue => {
        const labelKey = issue.label;
        if (combinedMap[labelKey]) {
            combinedMap[labelKey].count += issue.count;
            if (issue.aircraft && Array.isArray(issue.aircraft)) {
                issue.aircraft.forEach(ac => combinedMap[labelKey].aircraft.add(ac));
            }
            combinedMap[labelKey].type = 'Combined';
        } else {
            combinedMap[labelKey] = {
                label: issue.label,
                count: issue.count,
                aircraft: new Set(issue.aircraft || []),
                type: 'Manually Added'
            };
        }
    });

    // 4. Convert to sorted array
    return Object.values(combinedMap).map(issue => ({
        label: issue.label,
        count: issue.count,
        aircraft: Array.from(issue.aircraft),
        type: issue.type
    })).sort((a, b) => b.count - a.count);
}

// Statistics Tab & Chart visualization state
let recurringChartInstance = null;
let recurringBarChartInstance = null;

function renderStatisticsTab() {
    // 1. Re-render the analytics cards grid
    renderAnalytics();
    
    // 2. Render manual issues list
    if (typeof renderManualIssuesList === 'function') {
        renderManualIssuesList();
    }
    
    // 3. Draw or update the Chart.js doughnut chart
    renderRecurringPieChart();
    renderRecurringBarChart();
}

function renderRecurringPieChart() {
    const canvas = document.getElementById('recurringPieChart');
    if (!canvas) return;

    // Get selected team filter value
    const filterSelect = document.getElementById('chartTeamFilter');
    const selectedTeam = filterSelect ? filterSelect.value : 'All';

    // Get selected aircraft type filter value
    const acFilterSelect = document.getElementById('chartAircraftTypeFilter');
    const selectedAcType = acFilterSelect ? acFilterSelect.value : 'All';

    // A. Gather auto-detected recurring issues, filtered by the selected team and aircraft type
    let filteredTasks = tasks;
    if (selectedTeam !== 'All') {
        filteredTasks = tasks.filter(t => (t.assignedTeam || '').split(',').map(s => s.trim()).includes(selectedTeam));
    }
    if (selectedAcType !== 'All') {
        filteredTasks = filteredTasks.filter(t => t.aircraftType === selectedAcType);
    }
    const autoIssues = detectRecurringIssues(filteredTasks);

    // B. Gather manual issues, filtered by the selected team and aircraft type
    let manualIssues = [];
    if (typeof loadManualIssues === 'function') {
        const allManual = loadManualIssues();
        manualIssues = allManual;
        if (selectedTeam !== 'All') {
            manualIssues = manualIssues.filter(issue => (issue.assignedTeam || 'Mechanical System Team').split(',').map(s => s.trim()).includes(selectedTeam));
        }
        if (selectedAcType !== 'All') {
            manualIssues = manualIssues.filter(issue => issue.aircraftType === selectedAcType);
        }
    }

    // C. Combine them. If same label exists, aggregate count & combine types
    const combinedMap = {};

    autoIssues.forEach(issue => {
        combinedMap[issue.label] = {
            count: issue.count,
            type: 'Auto-detected'
        };
    });

    manualIssues.forEach(issue => {
        const labelKey = issue.label;
        if (combinedMap[labelKey]) {
            combinedMap[labelKey].count += issue.count;
            combinedMap[labelKey].type = 'Combined';
        } else {
            combinedMap[labelKey] = {
                count: issue.count,
                type: 'Manually Added'
            };
        }
    });

    const combinedList = Object.entries(combinedMap).map(([label, data]) => ({
        label,
        count: data.count,
        type: data.type
    })).sort((a, b) => b.count - a.count);

    const totalCount = combinedList.reduce((sum, item) => sum + item.count, 0);

    // If there is no data to display, show empty state message
    const chartWrapper = canvas.parentNode;
    let emptyMsg = chartWrapper.querySelector('.chart-empty-msg');
    
    if (combinedList.length === 0) {
        canvas.style.display = 'none';
        if (!emptyMsg) {
            emptyMsg = document.createElement('div');
            emptyMsg.className = 'chart-empty-msg recurring-empty';
            emptyMsg.textContent = 'No recurring issues detected or manually added yet.';
            chartWrapper.appendChild(emptyMsg);
        }
        return;
    } else {
        canvas.style.display = 'block';
        if (emptyMsg) emptyMsg.remove();
    }

    // Check if dark mode is active to apply correct colors
    const isDark = document.documentElement.classList.contains('dark-mode');
    const textThemeColor = isDark ? '#f6dbc0' : '#222235';

    const ctx = canvas.getContext('2d');

    // Create striped pattern for "Other" or last segment
    let stripePattern = null;
    try {
        const stripeCanvas = document.createElement('canvas');
        stripeCanvas.width = 12;
        stripeCanvas.height = 12;
        const stripeCtx = stripeCanvas.getContext('2d');
        
        // Base fill (dark slate background)
        stripeCtx.fillStyle = isDark ? 'rgba(80, 45, 85, 0.4)' : 'rgba(102, 90, 135, 0.15)';
        stripeCtx.fillRect(0, 0, 12, 12);
        
        // Stripes
        stripeCtx.strokeStyle = isDark ? '#935073' : '#9a8bc2';
        stripeCtx.lineWidth = 2.5;
        stripeCtx.beginPath();
        stripeCtx.moveTo(0, 12);
        stripeCtx.lineTo(12, 0);
        stripeCtx.stroke();
        
        stripePattern = ctx.createPattern(stripeCanvas, 'repeat');
    } catch (e) {
        console.warn('Failed to create stripe pattern:', e);
    }

    // Modern color palette matching the screenshot
    const backgroundColors = [
        '#a78bfa',  // Product: Soft Purple
        '#bef264',  // Restorans and bars: Lime Green
        '#0ea5e9',  // Internet and media: Sky Blue
        '#64748b',  // Pay for workplace: Slate/Charcoal Gray
        stripePattern || '#94a3b8', // Other: Striped pattern
        '#f43f5e',  // Rose
        '#eab308',  // Yellow
        '#f97316'   // Orange
    ];

    // Destroy existing instance to avoid hover glitches
    if (recurringChartInstance) {
        recurringChartInstance.destroy();
    }

    recurringChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: combinedList.map(item => item.label),
            datasets: [{
                data: combinedList.map(item => item.count),
                backgroundColor: backgroundColors.slice(0, combinedList.length),
                borderWidth: 0,
                borderRadius: 8,
                spacing: 8,
                hoverOffset: 12
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'left',
                    align: 'center',
                    labels: {
                        color: textThemeColor,
                        font: {
                            family: 'Inter',
                            size: 11,
                            weight: '600'
                        },
                        padding: 12,
                        boxWidth: 14,
                        boxHeight: 14,
                        borderRadius: 4,
                        useBorderRadius: true
                    }
                },
                tooltip: {
                    backgroundColor: isDark ? '#1a0e1d' : '#ffffff',
                    titleColor: isDark ? '#f8f4e9' : '#222235',
                    bodyColor: isDark ? '#f6dbc0' : '#665a87',
                    borderColor: isDark ? 'rgba(147,80,115,0.3)' : '#bbadd8',
                    borderWidth: 1,
                    padding: 10,
                    boxPadding: 4,
                    callbacks: {
                        title: function(context) {
                            return combinedList[context[0].dataIndex].label;
                        },
                        label: function(context) {
                            const item = combinedList[context.dataIndex];
                            const percentage = totalCount > 0 ? ((item.count / totalCount) * 100).toFixed(1) : 0;
                            return ` Count: ${item.count} (${percentage}%) (${item.type})`;
                        }
                    }
                }
            },
            cutout: '70%',
            animation: {
                animateScale: true,
                animateRotate: true
            }
        },
        plugins: [{
            id: 'doughnutLabels',
            afterDraw(chart) {
                const { ctx } = chart;
                chart.data.datasets.forEach((dataset, i) => {
                    const meta = chart.getDatasetMeta(i);
                    if (meta.hidden) return;
                    meta.data.forEach((element, index) => {
                        const { x, y, startAngle, endAngle, innerRadius, outerRadius } = element;
                        const halfAngle = startAngle + (endAngle - startAngle) / 2;
                        
                        // Calculate middle radius
                        const middleRadius = innerRadius + (outerRadius - innerRadius) / 2;
                        const textX = x + Math.cos(halfAngle) * middleRadius;
                        const textY = y + Math.sin(halfAngle) * middleRadius;

                        // Calculate percentage
                        const value = dataset.data[index];
                        const total = dataset.data.reduce((a, b) => a + b, 0);
                        const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                        if (percentage < 3) return; // Don't show labels for tiny slices

                        ctx.save();
                        ctx.font = 'bold 9px Inter';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';

                        const text = `${percentage}%`;
                        const textWidth = ctx.measureText(text).width;
                        const badgeWidth = textWidth + 8;
                        const badgeHeight = 15;

                        // Draw rounded rectangle badge
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                        const rx = textX - badgeWidth / 2;
                        const ry = textY - badgeHeight / 2;
                        const r = 4;
                        
                        ctx.beginPath();
                        ctx.moveTo(rx + r, ry);
                        ctx.arcTo(rx + badgeWidth, ry, rx + badgeWidth, ry + badgeHeight, r);
                        ctx.arcTo(rx + badgeWidth, ry + badgeHeight, rx, ry + badgeHeight, r);
                        ctx.arcTo(rx, ry + badgeHeight, rx, ry, r);
                        ctx.arcTo(rx, ry, rx + badgeWidth, ry, r);
                        ctx.closePath();
                        ctx.fill();

                        // Draw text inside badge
                        ctx.fillStyle = '#1e293b';
                        ctx.fillText(text, textX, textY);
                        ctx.restore();
                    });
                });
            }
        }]
    });

    // Also render the bar chart
    if (typeof renderRecurringBarChart === 'function') {
        renderRecurringBarChart();
    }
}

function removeTeamManualIssue(label, teamName) {
    if (confirm(`Are you sure you want to delete the recurring issue "${label}" for ${teamName}?`)) {
        if (typeof deleteManualIssueByDetails === 'function') {
            deleteManualIssueByDetails(label, teamName);
        }
        
        if (typeof blacklistIssue === 'function') {
            blacklistIssue(label, teamName);
        }
        
        // Re-render manual issues list on Statistics tab
        if (typeof renderManualIssuesList === 'function') {
            renderManualIssuesList();
        }
        
        // Update Chart
        if (typeof renderRecurringPieChart === 'function') {
            renderRecurringPieChart();
        }

        // Re-render App (updates Team Analytics cards)
        renderApp();
    }
}

function renderRecurringBarChart() {
    const canvas = document.getElementById('recurringBarChart');
    if (!canvas) return;

    // Get selected team filter value
    const filterSelect = document.getElementById('chartTeamFilter');
    const selectedTeam = filterSelect ? filterSelect.value : 'All';

    // Get selected aircraft type filter value
    const acFilterSelect = document.getElementById('chartAircraftTypeFilter');
    const selectedAcType = acFilterSelect ? acFilterSelect.value : 'All';

    // 1. Gather auto-detected recurring issues, filtered by the selected team and aircraft type
    let filteredTasks = tasks;
    if (selectedTeam !== 'All') {
        filteredTasks = tasks.filter(t => (t.assignedTeam || '').split(',').map(s => s.trim()).includes(selectedTeam));
    }
    if (selectedAcType !== 'All') {
        filteredTasks = filteredTasks.filter(t => t.aircraftType === selectedAcType);
    }
    const autoIssues = detectRecurringIssues(filteredTasks);

    // 2. Gather manual issues, filtered by the selected team and aircraft type
    let manualIssues = [];
    if (typeof loadManualIssues === 'function') {
        const allManual = loadManualIssues();
        manualIssues = allManual;
        if (selectedTeam !== 'All') {
            manualIssues = manualIssues.filter(issue => (issue.assignedTeam || 'Mechanical System Team').split(',').map(s => s.trim()).includes(selectedTeam));
        }
        if (selectedAcType !== 'All') {
            manualIssues = manualIssues.filter(issue => issue.aircraftType === selectedAcType);
        }
    }

    // 3. Combine them. If same label exists, aggregate count
    const combinedMap = {};

    autoIssues.forEach(issue => {
        combinedMap[issue.label] = {
            count: issue.count
        };
    });

    manualIssues.forEach(issue => {
        const labelKey = issue.label;
        if (combinedMap[labelKey]) {
            combinedMap[labelKey].count += issue.count;
        } else {
            combinedMap[labelKey] = {
                count: issue.count
            };
        }
    });

    const combinedList = Object.entries(combinedMap).map(([label, data]) => ({
        label,
        count: data.count
    })).sort((a, b) => b.count - a.count);

    // If there is no data to display, show empty state message
    const chartWrapper = canvas.parentNode;
    let emptyMsg = chartWrapper.querySelector('.chart-empty-msg');
    
    if (combinedList.length === 0) {
        canvas.style.display = 'none';
        if (!emptyMsg) {
            emptyMsg = document.createElement('div');
            emptyMsg.className = 'chart-empty-msg recurring-line-empty';
            emptyMsg.textContent = 'No recurring issues detected or manually added yet.';
            emptyMsg.style.position = 'absolute';
            emptyMsg.style.top = '50%';
            emptyMsg.style.left = '50%';
            emptyMsg.style.transform = 'translate(-50%, -50%)';
            emptyMsg.style.color = 'var(--text-muted)';
            emptyMsg.style.fontSize = '0.95rem';
            chartWrapper.appendChild(emptyMsg);
        }
        return;
    } else {
        canvas.style.display = 'block';
        if (emptyMsg) emptyMsg.remove();
    }

    // 4. Find all unique aircraft types across tasks and manual issues that match the active labels
    const activeLabels = new Set(combinedList.map(item => item.label));
    const aircraftTypesSet = new Set();

    // Map: issueLabel -> aircraftType -> count
    const issueAcTypeCounts = {};
    activeLabels.forEach(label => {
        issueAcTypeCounts[label] = {};
    });

    // Populate auto-detected issue counts per aircraft type
    filteredTasks.forEach(task => {
        const descLower = task.taskDescription.toLowerCase();
        MRO_KEYWORDS.forEach(kw => {
            if (activeLabels.has(kw.label) && descLower.includes(kw.keyword)) {
                if (typeof isIssueBlacklisted === 'function' && isIssueBlacklisted(kw.label, task.assignedTeam)) {
                    return;
                }
                const acType = task.aircraftType || 'Unknown';
                aircraftTypesSet.add(acType);
                if (!issueAcTypeCounts[kw.label][acType]) {
                    issueAcTypeCounts[kw.label][acType] = 0;
                }
                issueAcTypeCounts[kw.label][acType]++;
            }
        });
    });

    // Populate manual issues counts per aircraft type
    manualIssues.forEach(issue => {
        if (activeLabels.has(issue.label)) {
            const acType = issue.aircraftType || 'Unknown';
            aircraftTypesSet.add(acType);
            if (!issueAcTypeCounts[issue.label][acType]) {
                issueAcTypeCounts[issue.label][acType] = 0;
            }
            issueAcTypeCounts[issue.label][acType] += issue.count;
        }
    });

    // Convert aircraft types set to sorted array
    const aircraftTypes = Array.from(aircraftTypesSet).sort();

    // 5. Build datasets for the bar (column) chart (limit to top 5 labels to keep readability)
    const topLabels = combinedList.slice(0, 5).map(item => item.label);
    
    // Theme accents colors
    const colors = [
        '#f43f5e', // Rose
        '#0ea5e9', // Sky Blue
        '#a855f7', // Purple
        '#22c55e', // Green
        '#eab308'  // Yellow
    ];

    const datasets = topLabels.map((label, idx) => {
        const data = aircraftTypes.map(acType => issueAcTypeCounts[label][acType] || 0);
        return {
            label: label,
            data: data,
            borderColor: colors[idx % colors.length],
            backgroundColor: colors[idx % colors.length] + 'b3', // 70% opacity fill
            borderWidth: 1.5,
            borderRadius: 4
        };
    });

    // Destroy existing instance to avoid hover glitches
    if (recurringBarChartInstance) {
        recurringBarChartInstance.destroy();
    }

    // Check if dark mode is active to apply correct font color
    const isDark = document.documentElement.classList.contains('dark-mode');
    const textThemeColor = isDark ? '#94a3b8' : '#475569';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';

    const ctx = canvas.getContext('2d');
    recurringBarChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: aircraftTypes,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            onClick: (event, elements, chart) => {
                // 1. Check if a bar/column was clicked
                if (elements && elements.length > 0) {
                    const index = elements[0].index;
                    const acType = chart.data.labels[index];
                    if (acType) {
                        const acFilterSelect = document.getElementById('chartAircraftTypeFilter');
                        if (acFilterSelect) {
                            const currentVal = acFilterSelect.value;
                            acFilterSelect.value = (currentVal === acType) ? 'All' : acType;
                            acFilterSelect.dispatchEvent(new Event('change'));
                        }
                    }
                } else {
                    // 2. Check if clicked on x-axis label area
                    const xAxis = chart.scales.x;
                    const clickX = event.x;
                    const clickY = event.y;
                    
                    if (clickX >= xAxis.left && clickX <= xAxis.right && clickY >= xAxis.top && clickY <= xAxis.bottom) {
                        const tickIndex = xAxis.getValueForPixel(clickX);
                        if (tickIndex >= 0 && tickIndex < chart.data.labels.length) {
                            const acType = chart.data.labels[tickIndex];
                            if (acType) {
                                const acFilterSelect = document.getElementById('chartAircraftTypeFilter');
                                if (acFilterSelect) {
                                    const currentVal = acFilterSelect.value;
                                    acFilterSelect.value = (currentVal === acType) ? 'All' : acType;
                                    acFilterSelect.dispatchEvent(new Event('change'));
                                }
                            }
                        }
                    }
                }
            },
            onHover: (event, elements, chart) => {
                const canvas = chart.canvas;
                let isHovering = false;
                if (elements && elements.length > 0) {
                    isHovering = true;
                } else {
                    const xAxis = chart.scales.x;
                    const hoverX = event.x;
                    const hoverY = event.y;
                    if (hoverX >= xAxis.left && hoverX <= xAxis.right && hoverY >= xAxis.top && hoverY <= xAxis.bottom) {
                        const tickIndex = xAxis.getValueForPixel(hoverX);
                        if (tickIndex >= 0 && tickIndex < chart.data.labels.length) {
                            isHovering = true;
                        }
                    }
                }
                canvas.style.cursor = isHovering ? 'pointer' : 'default';
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: textThemeColor,
                        font: {
                            family: 'Inter',
                            size: 10,
                            weight: '500'
                        },
                        boxWidth: 8,
                        padding: 8
                    }
                },
                tooltip: {
                    backgroundColor: isDark ? '#1e293b' : '#ffffff',
                    titleColor: isDark ? '#f8fafc' : '#0f172a',
                    bodyColor: isDark ? '#cbd5e1' : '#475569',
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#cbd5e1',
                    borderWidth: 1,
                    padding: 10,
                    boxPadding: 4
                }
            },
            scales: {
                x: {
                    grid: {
                        color: gridColor
                    },
                    ticks: {
                        color: textThemeColor,
                        font: {
                            family: 'Inter',
                            size: 10
                        }
                    }
                },
                y: {
                    grid: {
                        color: gridColor
                    },
                    ticks: {
                        color: textThemeColor,
                        font: {
                            family: 'Inter',
                            size: 10
                        },
                        precision: 0
                    },
                    min: 0
                }
            }
        }
    });
}

// Redraw chart when dark mode toggles or when team filter changes
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('darkModeToggle')?.addEventListener('click', () => {
        setTimeout(() => {
            if (typeof renderRecurringPieChart === 'function') {
                renderRecurringPieChart();
            }
        }, 50);
    });

    document.getElementById('chartTeamFilter')?.addEventListener('change', () => {
        if (typeof renderRecurringPieChart === 'function') {
            renderRecurringPieChart();
        }
    });

    document.getElementById('chartAircraftTypeFilter')?.addEventListener('change', () => {
        if (typeof renderRecurringPieChart === 'function') {
            renderRecurringPieChart();
        }
    });
});

// ==========================================================================
// WEEKLY SUMMARY REPORT ENGINE
// ==========================================================================

const ATA_NAMES = {
    '21': 'Air Conditioning',
    '22': 'Auto Flight',
    '23': 'Communications',
    '24': 'Electrical Power',
    '25': 'Equipment/Furnishings',
    '26': 'Fire Protection',
    '27': 'Flight Controls',
    '28': 'Fuel',
    '29': 'Hydraulic Power',
    '30': 'Ice/Rain Protection',
    '31': 'Indicating/Recording',
    '32': 'Landing Gear',
    '33': 'Lights',
    '34': 'Navigation',
    '35': 'Oxygen',
    '36': 'Pneumatic',
    '38': 'Water/Waste',
    '49': 'Auxiliary APU',
    '52': 'Doors',
    '53': 'Fuselage',
    '54': 'Nacelles/Pylons',
    '55': 'Stabilizers',
    '56': 'Windows',
    '57': 'Wings',
    '71': 'Power Plant (Gen)',
    '72': 'Engine (Turbine)',
    '73': 'Engine Fuel/Control',
    '74': 'Ignition',
    '77': 'Engine Indicating',
    '78': 'Engine Exhaust',
    '79': 'Engine Oil'
};

// Helper: Get Monday-to-Sunday date range containing the specified date (YYYY-MM-DD local time)
function getWeekRange(dateString) {
    const parts = dateString.split('-');
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    const day = date.getDay();
    const diffToMonday = (day === 0 ? -6 : 1 - day);
    
    const monday = new Date(date);
    monday.setDate(date.getDate() + diffToMonday);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    const formatDate = (d) => {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    };
    
    return {
        start: monday,
        end: sunday,
        startStr: formatDate(monday),
        endStr: formatDate(sunday)
    };
}

// Helper: Format YYYY-MM-DD date string to "MMM DD, YYYY" (e.g. "Jun 15, 2026")
function formatPeriodDisplayDateString(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function renderWeeklySummaryTab() {
    // Determine the selected date range
    const startSelector = document.getElementById('summaryStartDateSelector');
    const endSelector = document.getElementById('summaryEndDateSelector');
    
    let startDateStr = '2026-06-15'; // default
    let endDateStr = '2026-06-21'; // default
    
    if (startSelector && startSelector.value) {
        startDateStr = startSelector.value;
    } else if (startSelector) {
        startSelector.value = startDateStr;
    }
    
    if (endSelector && endSelector.value) {
        endDateStr = endSelector.value;
    } else if (endSelector) {
        endSelector.value = endDateStr;
    }

    // Update report period display label and print-only header fields
    const summaryPeriodDisplay = document.getElementById('summaryPeriodDisplay');
    const printSummaryPeriodDisplay = document.getElementById('printSummaryPeriodDisplay');
    const printSummaryGenDate = document.getElementById('printSummaryGenDate');
    const printSummaryLogo = document.getElementById('printSummaryLogo');
    const appLogo = document.querySelector('.logo-section img');

    const startFormatted = formatPeriodDisplayDateString(startDateStr);
    const endFormatted = formatPeriodDisplayDateString(endDateStr);
    const periodText = `Report Period: ${startFormatted} - ${endFormatted}`;

    if (summaryPeriodDisplay) {
        summaryPeriodDisplay.textContent = periodText;
    }
    if (printSummaryPeriodDisplay) {
        printSummaryPeriodDisplay.textContent = periodText;
    }
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const formattedDateTime = `${dateStr} at ${timeStr}`;
    
    if (printSummaryGenDate) {
        printSummaryGenDate.textContent = formattedDateTime;
    }
    const printSummaryGenDate2 = document.getElementById('printSummaryGenDate2');
    if (printSummaryGenDate2) {
        printSummaryGenDate2.textContent = formattedDateTime;
    }
    if (appLogo && printSummaryLogo) {
        printSummaryLogo.src = appLogo.src;
    }

    // Link all tasks from the board to the weekly report
    const weeklyTasks = tasks;

    // Retrieve the selected teams (if any)
    const teamHidden = document.getElementById('summaryTeamHidden');
    const selectedTeams = teamHidden && teamHidden.value ? teamHidden.value.split(',').map(s => s.trim()).filter(Boolean) : [];

    // Filter tasks by selected teams — supports multi-team (comma-separated)
    const filteredTasks = weeklyTasks.filter(t => {
        if (selectedTeams.length === 0) return true;
        const taskTeams = (t.assignedTeam || '').split(',').map(s => s.trim());
        return taskTeams.some(team => selectedTeams.includes(team));
    });

    // 1. KPI Calculations
    const total = filteredTasks.length;
    const open = filteredTasks.filter(t => t.currentStatus === 'Open').length;
    const inProgress = filteredTasks.filter(t => t.currentStatus === 'In Progress').length;
    const completed = filteredTasks.filter(t => t.currentStatus === 'Completed').length;
    const aog = filteredTasks.filter(t => t.priorityLevel === 'AOG' && t.currentStatus !== 'Completed').length;
    const compliance = total > 0 ? Math.round((completed / total) * 100) : 100;
    
    document.getElementById('kpiTotalTasks').textContent = total;
    document.getElementById('kpiOpenTasks').textContent = open;
    document.getElementById('kpiInProgressTasks').textContent = inProgress;
    document.getElementById('kpiCompletedTasks').textContent = completed;
    document.getElementById('kpiAogAlerts').textContent = aog;
    document.getElementById('kpiRtsCompliance').textContent = compliance + '%';

    // Populate Tasks by Status table and Completion Overview gauge
    const dbStatusTableBody = document.getElementById('dbStatusTableBody');
    if (dbStatusTableBody) {
        const completedPct = total > 0 ? Math.round((completed / total) * 100) : 0;
        const progressPct = total > 0 ? Math.round((inProgress / total) * 100) : 0;
        const openPct = total > 0 ? Math.round((open / total) * 100) : 0;
        const aogPct = total > 0 ? Math.round((aog / total) * 100) : 0;

        dbStatusTableBody.innerHTML = `
            <tr style="border-bottom: 1px solid var(--border-color); vertical-align: middle;">
                <td style="padding: 0.65rem 0.5rem; display: flex; align-items: center; gap: 8px;">
                    <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #10b981;"></span>
                    <span style="font-weight: 500; color: var(--text-secondary);">Completed</span>
                </td>
                <td style="padding: 0.65rem 0.5rem; text-align: center; font-weight: 700; color: var(--text-primary);">${completed}</td>
                <td style="padding: 0.65rem 0.5rem; vertical-align: middle;">
                    <div style="display: flex; align-items: center; gap: 10px; width: 100%;">
                        <div style="flex: 1; height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; display: block;">
                            <div style="width: ${completedPct}%; height: 100%; background: #10b981; border-radius: 3px;"></div>
                        </div>
                        <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); width: 32px; text-align: right;">${completedPct}%</span>
                    </div>
                </td>
            </tr>
            <tr style="border-bottom: 1px solid var(--border-color); vertical-align: middle;">
                <td style="padding: 0.65rem 0.5rem; display: flex; align-items: center; gap: 8px;">
                    <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #a855f7;"></span>
                    <span style="font-weight: 500; color: var(--text-secondary);">In Progress</span>
                </td>
                <td style="padding: 0.65rem 0.5rem; text-align: center; font-weight: 700; color: var(--text-primary);">${inProgress}</td>
                <td style="padding: 0.65rem 0.5rem; vertical-align: middle;">
                    <div style="display: flex; align-items: center; gap: 10px; width: 100%;">
                        <div style="flex: 1; height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; display: block;">
                            <div style="width: ${progressPct}%; height: 100%; background: #a855f7; border-radius: 3px;"></div>
                        </div>
                        <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); width: 32px; text-align: right;">${progressPct}%</span>
                    </div>
                </td>
            </tr>
            <tr style="border-bottom: 1px solid var(--border-color); vertical-align: middle;">
                <td style="padding: 0.65rem 0.5rem; display: flex; align-items: center; gap: 8px;">
                    <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #3b82f6;"></span>
                    <span style="font-weight: 500; color: var(--text-secondary);">Open</span>
                </td>
                <td style="padding: 0.65rem 0.5rem; text-align: center; font-weight: 700; color: var(--text-primary);">${open}</td>
                <td style="padding: 0.65rem 0.5rem; vertical-align: middle;">
                    <div style="display: flex; align-items: center; gap: 10px; width: 100%;">
                        <div style="flex: 1; height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; display: block;">
                            <div style="width: ${openPct}%; height: 100%; background: #3b82f6; border-radius: 3px;"></div>
                        </div>
                        <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); width: 32px; text-align: right;">${openPct}%</span>
                    </div>
                </td>
            </tr>
            <tr style="border-bottom: 1px solid var(--border-color); vertical-align: middle;">
                <td style="padding: 0.65rem 0.5rem; display: flex; align-items: center; gap: 8px;">
                    <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #ef4444;"></span>
                    <span style="font-weight: 500; color: var(--text-secondary);">Active AOG Alerts</span>
                </td>
                <td style="padding: 0.65rem 0.5rem; text-align: center; font-weight: 700; color: var(--text-primary);">${aog}</td>
                <td style="padding: 0.65rem 0.5rem; vertical-align: middle;">
                    <div style="display: flex; align-items: center; gap: 10px; width: 100%;">
                        <div style="flex: 1; height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; display: block;">
                            <div style="width: ${aogPct}%; height: 100%; background: #ef4444; border-radius: 3px;"></div>
                        </div>
                        <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); width: 32px; text-align: right;">${aogPct}%</span>
                    </div>
                </td>
            </tr>
            <tr style="vertical-align: middle;">
                <td style="padding: 0.65rem 0.5rem; display: flex; align-items: center; gap: 8px; font-weight: 700; color: var(--text-primary);">
                    <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #475569;"></span>
                    <span style="font-weight: 700; color: var(--text-primary);">Total</span>
                </td>
                <td style="padding: 0.65rem 0.5rem; text-align: center; font-weight: 800; color: var(--text-primary);">${total}</td>
                <td style="padding: 0.65rem 0.5rem; vertical-align: middle;">
                    <div style="display: flex; align-items: center; gap: 10px; width: 100%;">
                        <div style="flex: 1; height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; display: block;">
                            <div style="width: 100%; height: 100%; background: #475569; border-radius: 3px;"></div>
                        </div>
                        <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-primary); width: 32px; text-align: right;">100%</span>
                    </div>
                </td>
            </tr>
        `;
    }

    const dbGaugeArc = document.getElementById('dbGaugeArc');
    const dbGaugePercent = document.getElementById('dbGaugePercent');
    const dbCompletedSubtext = document.getElementById('dbCompletedSubtext');
    const dbCompletedPercent = document.getElementById('dbCompletedPercent');
    const dbRemainingSubtext = document.getElementById('dbRemainingSubtext');
    const dbRemainingPercent = document.getElementById('dbRemainingPercent');
    const dbGaugeAlertText = document.getElementById('dbGaugeAlertText');

    if (dbGaugeArc) dbGaugeArc.setAttribute('stroke-dasharray', `${compliance}, 100`);
    if (dbGaugePercent) dbGaugePercent.textContent = `${compliance}%`;
    if (dbCompletedSubtext) dbCompletedSubtext.textContent = `${completed} tasks`;
    if (dbCompletedPercent) dbCompletedPercent.textContent = `${compliance}%`;
    
    const remaining = total - completed;
    const remainingPct = 100 - compliance;
    if (dbRemainingSubtext) dbRemainingSubtext.textContent = `${remaining} tasks`;
    if (dbRemainingPercent) dbRemainingPercent.textContent = `${remainingPct}%`;

    if (dbGaugeAlertText) {
        if (compliance >= 100) {
            dbGaugeAlertText.textContent = "Outstanding! All tasks assigned for this week have been completed successfully.";
        } else if (compliance >= 70) {
            dbGaugeAlertText.textContent = `Great job! You've completed ${compliance}% of the tasks this week.`;
        } else if (compliance >= 40) {
            dbGaugeAlertText.textContent = `Steady progress. ${compliance}% of tasks are completed. Focus on in-progress items.`;
        } else {
            dbGaugeAlertText.textContent = `Attention needed: only ${compliance}% of tasks are completed. Action required to avoid backlog.`;
        }
    }

    // 2. Executive Narrative Highlights Generator
    const teams = [
        'Mechanical System Team',
        'Avionic Systems Team',
        'Structure Team',
        'Engines Team',
        'IERA Shop',
        'Component Team'
    ];
    
    const narrativeContainer = document.getElementById('summaryNarrative');
    narrativeContainer.innerHTML = '';
    
    const teamsToRender = selectedTeams.length === 0 ? teams : selectedTeams;
    
    teamsToRender.forEach(teamName => {
        const teamTasks = weeklyTasks.filter(t => (t.assignedTeam || '').split(',').map(s => s.trim()).includes(teamName));
        if (teamTasks.length === 0) {
            narrativeContainer.innerHTML += `
                <div class="narrative-item">
                    <div class="narrative-team-title">
                        <span style="display:inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--text-muted);"></span>
                        ${teamName}
                    </div>
                    <p style="margin: 0; padding-left: 1.25rem; font-style: italic; color: var(--text-muted);">No active maintenance events logged for this period.</p>
                </div>
            `;
            return;
        }
        
        const completedTasks = teamTasks.filter(t => t.currentStatus === 'Completed');
        const activeTasks = teamTasks.filter(t => t.currentStatus !== 'Completed');
        
        let dotColor = '#059669';
        if (teamName.includes('Avionic')) dotColor = '#0891b2';
        else if (teamName.includes('Structure')) dotColor = '#7c3aed';
        else if (teamName.includes('Engines')) dotColor = '#db2777';
        else if (teamName.includes('IERA')) dotColor = '#4f46e5';
        else if (teamName.includes('Component')) dotColor = '#d97706';
        
        let narrativeHtml = `
            <div class="narrative-item">
                <div class="narrative-team-title">
                    <span style="display:inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${dotColor};"></span>
                    ${teamName}
                </div>
                <div style="padding-left: 1.25rem; display: flex; flex-direction: column; gap: 0.55rem;">
        `;

        // -- Successfully Completed paragraph --
        if (completedTasks.length > 0) {
            const itemsHtml = completedTasks
                .map(t => `<li style="margin-bottom: 0.25rem;"><strong>${t.aircraftReg}</strong> (${t.aircraftType || 'A/C'}): ${truncateSummaryString(t.taskDescription, 80)}</li>`)
                .join('');
            narrativeHtml += `
                <div style="margin: 0 0 0.6rem 0; font-size: 0.88rem; line-height: 1.6;">
                    <div>
                        <span style="display:inline-block; font-size:0.7rem; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:#059669; background:rgba(5,150,105,0.1); border-radius:4px; padding:0.1rem 0.45rem; vertical-align:middle;">Successfully Completed</span>
                    </div>
                    <ul style="margin: 0.35rem 0 0.5rem 0; padding-left: 1.25rem; list-style-type: disc; color: var(--text-secondary);">
                        ${itemsHtml}
                    </ul>
                </div>`;
        }

        // -- CRITICAL AOG paragraph --
        const aogActive = activeTasks.filter(t => t.priorityLevel === 'AOG');
        if (aogActive.length > 0) {
            const itemsHtml = aogActive
                .map(t => `<li style="margin-bottom: 0.25rem;"><strong>${t.aircraftReg}</strong> (${t.aircraftType || 'A/C'}): ${truncateSummaryString(t.taskDescription, 80)}</li>`)
                .join('');
            narrativeHtml += `
                <div style="margin: 0 0 0.6rem 0; font-size: 0.88rem; line-height: 1.6;">
                    <div>
                        <span style="display:inline-block; font-size:0.7rem; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:var(--priority-aog); background:rgba(220,38,38,0.1); border-radius:4px; padding:0.1rem 0.45rem; vertical-align:middle;">Critical / AOG</span>
                        <span style="font-weight: 600; color: var(--text-primary); margin-left: 0.25rem;">Active AOG defect(s):</span>
                    </div>
                    <ul style="margin: 0.35rem 0 0.5rem 0; padding-left: 1.25rem; list-style-type: disc; color: var(--text-secondary);">
                        ${itemsHtml}
                    </ul>
                </div>`;
        }

        // -- In Progress / Open paragraph --
        const normalActive = activeTasks.filter(t => t.priorityLevel !== 'AOG');
        if (normalActive.length > 0) {
            const statusSummary = [...new Set(normalActive.map(t => t.currentStatus))].join(' / ');
            const itemsHtml = normalActive
                .map(t => `<li style="margin-bottom: 0.25rem;"><strong>${t.aircraftReg}</strong> (${t.aircraftType || 'A/C'}): ${truncateSummaryString(t.taskDescription, 80)}</li>`)
                .join('');
            narrativeHtml += `
                <div style="margin: 0 0 0.6rem 0; font-size: 0.88rem; line-height: 1.6;">
                    <div>
                        <span style="display:inline-block; font-size:0.7rem; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:#d97706; background:rgba(217,119,6,0.1); border-radius:4px; padding:0.1rem 0.45rem; vertical-align:middle;">${statusSummary}</span>
                        <span style="font-weight: 600; color: var(--text-primary); margin-left: 0.25rem;">Progressing ${normalActive.length} active task(s):</span>
                    </div>
                    <ul style="margin: 0.35rem 0 0.5rem 0; padding-left: 1.25rem; list-style-type: disc; color: var(--text-secondary);">
                        ${itemsHtml}
                    </ul>
                </div>`;
        }

        narrativeHtml += `</div></div>`;
        narrativeContainer.innerHTML += narrativeHtml;
    });

    // 3. Team Workload Analysis — count each team a task is assigned to
    const teamCounts = {};
    filteredTasks.forEach(t => {
        const teamNames = (t.assignedTeam || 'Unassigned').split(',').map(s => s.trim()).filter(Boolean);
        teamNames.forEach(teamName => {
            teamCounts[teamName] = (teamCounts[teamName] || 0) + 1;
        });
    });
    
    const sortedTeams = Object.entries(teamCounts).sort((a,b) => b[1] - a[1]);
    const workloadContainer = document.getElementById('summaryTeamWorkload');
    workloadContainer.innerHTML = '';
    
    if (sortedTeams.length === 0) {
        workloadContainer.innerHTML = '<span style="font-size: 0.85rem; color: var(--text-muted);">No workloads logged.</span>';
    } else {
        const maxCount = sortedTeams[0][1];
        sortedTeams.forEach(([name, count]) => {
            const pct = Math.round((count / maxCount) * 100);
            
            let teamColor = 'var(--team-avionics)';
            if (name.includes('Mechanical')) teamColor = 'var(--team-mech)';
            else if (name.includes('Avionic')) teamColor = 'var(--team-avionics)';
            else if (name.includes('Structure')) teamColor = 'var(--team-struct)';
            else if (name.includes('Engines')) teamColor = 'var(--team-engines)';
            else if (name.includes('IERA')) teamColor = 'var(--team-iera)';
            else if (name.includes('Component')) teamColor = 'var(--team-component)';
            
            const barDiv = document.createElement('div');
            barDiv.className = 'workload-item';
            barDiv.innerHTML = `
                <div class="workload-meta">
                    <span>${name}</span>
                    <span style="font-weight: 600;">${count} task(s)</span>
                </div>
                <div class="workload-bar-container">
                    <div class="workload-bar-fill" style="width: ${pct}%; background: ${teamColor};"></div>
                </div>
            `;
            workloadContainer.appendChild(barDiv);
        });
    }

    // 4. Active Critical AOG Alerts
    const aogAlertsContainer = document.getElementById('summaryAogAlertsList');
    aogAlertsContainer.innerHTML = '';
    const activeAogTasks = filteredTasks.filter(t => t.priorityLevel === 'AOG' && t.currentStatus !== 'Completed');
    
    if (activeAogTasks.length === 0) {
        aogAlertsContainer.innerHTML = `
            <div style="padding: 0.75rem; border-radius: 8px; background: rgba(34, 197, 94, 0.08); border: 1px solid rgba(34, 197, 94, 0.15); color: #15803d; font-size: 0.85rem; display: flex; align-items: center; gap: 6px;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 16px; height: 16px; flex-shrink:0;">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                No active AOG alerts. All line systems operational.
            </div>
        `;
    } else {
        activeAogTasks.forEach(task => {
            const alertDiv = document.createElement('div');
            alertDiv.style = 'padding: 0.75rem; border-radius: 8px; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.15); color: var(--priority-aog); font-size: 0.85rem;';
            alertDiv.innerHTML = `
                <div style="font-weight: 700; margin-bottom: 0.25rem; display: flex; justify-content: space-between;">
                    <span>${task.aircraftReg} (${task.aircraftType})</span>
                    <span style="font-size: 0.75rem; text-transform: uppercase;">RTS: ${task.rtsDate}</span>
                </div>
                <div style="line-height: 1.4;">${task.taskDescription}</div>
            `;
            aogAlertsContainer.appendChild(alertDiv);
        });
    }

    // 5. Weekly Report Table
    const rtsTableBody = document.getElementById('summaryRtsTableBody');
    rtsTableBody.innerHTML = '';
    
    const sortedTasks = [...filteredTasks].sort((a,b) => {
        const statusOrder = { 'Open': 1, 'In Progress': 2, 'Completed': 3 };
        const orderA = statusOrder[a.currentStatus] || 99;
        const orderB = statusOrder[b.currentStatus] || 99;
        if (orderA !== orderB) {
            return orderA - orderB;
        }
        if (a.rtsDate === 'N/A' && b.rtsDate === 'N/A') return 0;
        if (a.rtsDate === 'N/A') return 1;
        if (b.rtsDate === 'N/A') return -1;
        return new Date(a.rtsDate) - new Date(b.rtsDate);
    });
    if (sortedTasks.length === 0) {
        rtsTableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No tasks recorded for this period.</td></tr>';
    } else {
        sortedTasks.forEach(t => {
            const row = document.createElement('tr');
            
            let statusClass = 'open';
            if (t.currentStatus === 'In Progress') statusClass = 'progress';
            else if (t.currentStatus === 'Completed') statusClass = 'completed';
            
            const prioClass = t.priorityLevel.toLowerCase();
            const updates = (t.comments || []).filter(item => item.type === 'update');
            const hasLog = updates.length > 0;
            
            let teamClass = 'team-other';
            const teamLower = (t.assignedTeam || '').toLowerCase();
            if (teamLower.includes('mechanical')) teamClass = 'team-mech';
            else if (teamLower.includes('avionic')) teamClass = 'team-avionics';
            else if (teamLower.includes('structure')) teamClass = 'team-struct';
            else if (teamLower.includes('engine')) teamClass = 'team-engines';
            else if (teamLower.includes('iera')) teamClass = 'team-iera';
            else if (teamLower.includes('component')) teamClass = 'team-component';
            
            row.className = `task-row prio-${prioClass} status-${statusClass} ${teamClass} has-log`;
            
            // Format status updates & logs as bullet list for dropdown
            const rowId = `wk-log-${t.id}`;

            const toggleBtn = `<button onclick="event.stopPropagation(); toggleWeeklyLogRow('${rowId}', this)" style="background:none;border:none;cursor:pointer;padding:4px;color:var(--text-muted);display:flex;align-items:center;justify-content:center;gap:4px;font-size:0.75rem;font-weight:600;transition:color 0.2s;" title="Toggle details">
                <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.5' style='width:12px;height:12px;transition:transform 0.2s;'><polyline points='6 9 12 15 18 9'></polyline></svg>
                ${updates.length}
              </button>`;

            row.innerHTML = `
                <td><span class="tbl-reg">${t.aircraftReg}</span></td>
                <td><span class="tbl-type">${t.aircraftType || 'A320'}</span></td>
                <td><span>${t.ataChapter || 'N/A'}</span></td>
                <td><span style="font-weight: 500;">${(t.assignedTeam || '').split(',').map(s => s.trim().replace(' Team', '')).join(', ')}</span></td>
                <td><span>${t.rtsDate}</span></td>
                <td><span class="badge-priority ${prioClass}">${t.priorityLevel}</span></td>
                <td><span class="badge-status ${statusClass}">${t.currentStatus}</span></td>
                <td class="no-print" style="text-align:center;vertical-align:middle;">${toggleBtn}</td>
            `;
            rtsTableBody.appendChild(row);

            // Collapsible details & log row (hidden on screen by default, visible when printing or expanded)
            const sortedUpdates = [...updates].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            const logRow = document.createElement('tr');
            logRow.id = rowId;
            logRow.className = `wk-print-log-row status-${statusClass} ${teamClass}`;
            
            let updatesHtml = '';
            if (updates.length > 0) {
                updatesHtml = `
                    <div style="font-size:0.75rem;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:var(--text-secondary);margin-bottom:0.75rem;">Status Updates &amp; Log (${updates.length})</div>
                    <div class="dhl-timeline">
                        ${sortedUpdates.map((u, i) => {
                            let monthDay = '';
                            let yearVal = '';
                            let timeStr = '';
                            try {
                                const d = new Date(u.timestamp);
                                const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                                const day = String(d.getDate()).padStart(2,'0');
                                const mon = months[d.getMonth()];
                                yearVal = d.getFullYear();
                                monthDay = `${mon} ${day},`;
                                
                                let hours = d.getHours();
                                const minutes = String(d.getMinutes()).padStart(2,'0');
                                const ampm = hours >= 12 ? 'PM' : 'AM';
                                hours = hours % 12;
                                hours = hours ? hours : 12;
                                timeStr = `${hours}:${minutes} ${ampm}`;
                            } catch(e) {
                                monthDay = 'Date';
                                yearVal = 'N/A';
                                timeStr = u.timestamp;
                            }
                            
                            // Show date only if it's different from the previous one in the list (newest first)
                            let showDate = true;
                            if (i > 0) {
                                try {
                                    const prevD = new Date(sortedUpdates[i - 1].timestamp);
                                    const currD = new Date(u.timestamp);
                                    showDate = prevD.toDateString() !== currD.toDateString();
                                } catch(e) {}
                            }
                            
                            const dateHtml = showDate 
                                ? `<span class="dhl-date-month">${monthDay}</span>
                                   <span class="dhl-date-year">${yearVal}</span>`
                                : '';
                            
                            return `
                                <div class="dhl-timeline-item">
                                    <div class="dhl-timeline-date">
                                        ${dateHtml}
                                    </div>
                                    <div class="dhl-timeline-node-container">
                                        <div class="dhl-timeline-badge">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" class="dhl-checkmark">
                                                <polyline points="20 6 9 17 4 12"></polyline>
                                            </svg>
                                        </div>
                                    </div>
                                    <div class="dhl-timeline-content">
                                        <div class="dhl-status-title">${escapeHTMLApp(u.text)}</div>
                                        <div class="dhl-status-subtext">${timeStr} &middot; ${escapeHTMLApp(u.author)}</div>
                                    </div>
                                </div>`;
                        }).join('')}
                    </div>
                `;
            } else {
                updatesHtml = `
                    <div style="font-size:0.75rem;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:var(--text-secondary);margin-bottom:0.5rem;">Status Updates &amp; Log (0)</div>
                    <div style="font-size:0.85rem;color:var(--text-muted);font-style:italic;">No status updates have been recorded for this task.</div>
                `;
            }

            logRow.innerHTML = `
                <td colspan="8" style="padding:0;border-top:none;">
                    <div style="padding:1.25rem 1.5rem;background:var(--bg-card);border-bottom:1px solid var(--border-color);">
                        <!-- Description Section -->
                        <div style="margin-bottom:1.25rem;padding-bottom:1rem;border-bottom:1px solid var(--border-color);">
                            <div style="font-size:0.75rem;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:var(--text-secondary);margin-bottom:0.5rem;">Description</div>
                            <div style="font-size:0.88rem;color:var(--text-primary);line-height:1.45;">
                                <strong style="font-size:0.95rem;color:var(--text-primary);">${escapeHTMLApp(t.topic || 'No Topic')}</strong>
                                <div style="margin-top:0.35rem;white-space:pre-wrap;color:var(--text-secondary);">${escapeHTMLApp(t.taskDescription || '')}</div>
                            </div>
                        </div>
                        <!-- Status Updates Section -->
                        ${updatesHtml}
                    </div>
                </td>`;
            rtsTableBody.appendChild(logRow);
        });
    }
}

function getAtaNumber(str) {
    if (!str) return '00';
    const match = str.match(/\d+/);
    return match ? match[0] : str.trim();
}

function truncateSummaryString(str, len) {
    if (!str) return '';
    if (str.length <= len) return str;
    return str.substring(0, len) + '...';
}

window.renderWeeklySummaryTab = renderWeeklySummaryTab;

// FYI Functions
function loadFYIs() {
    const isGas = typeof google !== 'undefined' && google.script && google.script.run;
    const localFyiData = localStorage.getItem('mro_fyi_items');
    let loaded = false;
    
    if (localFyiData && localFyiData !== 'null' && localFyiData !== 'undefined') {
        try {
            fyiItems = JSON.parse(localFyiData);
            if (Array.isArray(fyiItems)) {
                if (document.getElementById('fyiTab') && !document.getElementById('fyiTab').classList.contains('hidden')) {
                    renderFYITab();
                }
                loaded = true;
            }
        } catch(e) {
            fyiItems = [];
        }
    }
    if (!loaded) {
        // Seed with some default FYI data
        fyiItems = [
            { id: 'fyi-1', team: 'Mechanical System Team', title: 'Hydraulic Seals Batch Warning', content: 'Alert: Part number H-5512 seals from batch 2026-A have reported premature wear. Please double check all installs during this week.', sapTCode: 'MB21', dateCreated: '2026-06-17' },
            { id: 'fyi-2', team: 'Avionic Systems Team', title: 'Software Version 2.4 Diagnostic Tool', content: 'Diagnostic tool tablets have been updated to v2.4. Ensure to sync before cockpit troubleshooting.', sapTCode: 'IW31', dateCreated: '2026-06-16' },
            { id: 'fyi-3', team: 'Structure Team', title: 'Composite Curing Tent Temperature', content: 'Reminder: Tent #2 heating element is running 5\u00B0C hot. Monitor temperature manually during cure cycles.', sapTCode: 'IW32', dateCreated: '2026-06-15' }
        ];
        localStorage.setItem('mro_fyi_items', JSON.stringify(fyiItems));
    }
    
    if (isGas) {
        google.script.run
            .withSuccessHandler(data => {
                if (data && Array.isArray(data)) {
                    fyiItems = data;
                    localStorage.setItem('mro_fyi_items', JSON.stringify(fyiItems));
                    if (document.getElementById('fyiTab') && !document.getElementById('fyiTab').classList.contains('hidden')) {
                        renderFYITab();
                    }
                }
            })
            .getFYIs();
    } else if (supabaseClient) {
        refreshFYIsSilently();
    }
}

function renderFYITab() {
    const listContainer = document.getElementById('fyiList');
    if (!listContainer) return;
    
    listContainer.innerHTML = '';
    
    // Filter FYI items for the selected team
    const teamFyis = fyiItems.filter(item => {
        if (activeFyiTeam === 'All Teams') return true;
        return item.team === activeFyiTeam || item.team === 'All Teams';
    });
    
    if (teamFyis.length === 0) {
        listContainer.innerHTML = `
            <div style="text-align: center; color: var(--text-muted); padding: 3rem 1.5rem; border: 1px dashed var(--border-color); border-radius: 8px;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width: 40px; height: 40px; margin-bottom: 0.75rem; color: var(--text-muted); opacity: 0.6;">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                    <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
                <p style="margin: 0; font-size: 0.95rem;">No information logs posted for ${activeFyiTeam.replace(' Team', '')} yet.</p>
            </div>
        `;
        return;
    }
    
    teamFyis.forEach(item => {
        const card = document.createElement('div');
        card.className = 'glass-panel';
        card.style.padding = '1.25rem';
        card.style.borderRadius = '12px';
        card.style.border = '1px solid var(--border-color)';
        card.style.background = 'var(--bg-card)';
        card.style.position = 'relative';
        card.style.textAlign = 'left';
        
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
                <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; padding-right: 3.5rem;">
                    <h4 style="margin: 0; font-size: 1.05rem; font-weight: 700; color: var(--text-primary); font-family: var(--font-heading);">${item.title}</h4>
                    ${item.ataChapter ? `<span class="ata-badge">ATA ${item.ataChapter}</span>` : ''}
                    ${item.sapTCode ? `<span style="font-family: monospace; font-size: 0.72rem; background: rgba(37, 99, 235, 0.08); color: var(--status-progress); padding: 0.15rem 0.45rem; border-radius: 4px; border: 1px solid rgba(37, 99, 235, 0.2); font-weight: 600; display: inline-block;">T-Code: ${item.sapTCode}</span>` : ''}
                </div>
                <div style="position: absolute; top: 1.25rem; right: 1.25rem; display: flex; gap: 0.5rem; align-items: center;">
                    <button type="button" onclick="editFYIItem('${item.id}')" title="Edit FYI" style="background: none; border: none; cursor: pointer; color: var(--text-secondary); opacity: 0.7; transition: opacity 0.2s; padding: 0;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button type="button" onclick="deleteFYIItem('${item.id}')" title="Delete FYI" style="background: none; border: none; cursor: pointer; color: var(--priority-aog); opacity: 0.7; transition: opacity 0.2s; padding: 0;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
            <p style="margin: 0 0 1rem 0; font-size: 0.9rem; line-height: 1.6; color: var(--text-secondary); white-space: pre-wrap;">${item.content}</p>
            ${item.attachmentUrl ? `
            <div style="margin-bottom: 1rem; display: flex; align-items: center; gap: 6px;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px; color: var(--status-progress);">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                </svg>
                <a href="${item.attachmentUrl}" target="_blank" style="font-size: 0.85rem; font-weight: 600; color: var(--status-progress); text-decoration: none; word-break: break-all;">
                    ${item.attachmentName || 'View Attachment'}
                </a>
            </div>
            ` : ''}
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); border-top: 1px solid var(--border-color); padding-top: 0.75rem;">
                <span style="display: flex; align-items: center; gap: 4px;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 12px; height: 12px;">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                    Posted: ${item.dateCreated}
                </span>
                ${activeFyiTeam === 'All Teams' ? `
                    <span class="team-badge" style="font-size: 10px; padding: 2px 6px; border-radius: 4px; background: rgba(148, 163, 184, 0.1); color: var(--text-secondary); border: 1px solid var(--border-color);">
                        ${item.team.replace(' Team', '')}
                    </span>
                ` : ''}
            </div>
        `;
        listContainer.appendChild(card);
    });
}

function saveFYIItem() {
    const titleEl = document.getElementById('fyiTitle');
    const teamEl = document.getElementById('fyiTeamSelect');
    const contentEl = document.getElementById('fyiContent');
    
    if (!titleEl || !teamEl || !contentEl) return;
    
    const title = titleEl.value.trim();
    const team = teamEl.value;
    const content = contentEl.value.trim();
    
    if (!title || !content) return;
    
    const sapTCodeEl = document.getElementById('fyiSapTCode');
    const sapTCode = sapTCodeEl ? sapTCodeEl.value.trim() : '';
    
    const ataChapterEl = document.getElementById('fyiAtaChapter');
    const ataChapter = ataChapterEl ? ataChapterEl.value.trim() : '';
    
    const attachmentUrlEl = document.getElementById('fyiAttachmentUrl');
    const attachmentNameEl = document.getElementById('fyiAttachmentName');
    
    let attachmentUrl = attachmentUrlEl ? attachmentUrlEl.value.trim() : '';
    let attachmentName = attachmentNameEl ? attachmentNameEl.value.trim() : '';
    
    if (attachmentUrl && !attachmentName) {
        try {
            const parts = attachmentUrl.split('/');
            attachmentName = parts[parts.length - 1] || 'Attached Link';
        } catch(e) {
            attachmentName = 'Attached Link';
        }
    }
    
    const newItem = {
        id: 'fyi-' + Date.now(),
        team: team,
        title: title,
        content: content,
        sapTCode: sapTCode,
        ataChapter: ataChapter,
        attachmentUrl: attachmentUrl,
        attachmentName: attachmentName,
        dateCreated: new Date().toISOString().split('T')[0]
    };
    
    fyiItems.push(newItem);
    localStorage.setItem('mro_fyi_items', JSON.stringify(fyiItems));
    
    const isGas = typeof google !== 'undefined' && google.script && google.script.run;
    const hasSupabase = typeof window.supabaseClient !== 'undefined' && window.supabaseClient !== null;
    if (isGas || hasSupabase) {
        google.script.run.saveFYI(newItem);
    }
    
    titleEl.value = '';
    contentEl.value = '';
    if (sapTCodeEl) sapTCodeEl.value = '';
    if (ataChapterEl) ataChapterEl.value = '';
    if (attachmentUrlEl) attachmentUrlEl.value = '';
    if (attachmentNameEl) attachmentNameEl.value = '';
    
    activeFyiTeam = team;
    syncFyiTeamTabs();
    
    renderFYITab();
}

function deleteFYIItem(id) {
    if (confirm('Are you sure you want to permanently delete this information log?')) {
        const itemToDelete = fyiItems.find(item => item.id === id);
        if (itemToDelete && itemToDelete.attachmentUrl && !itemToDelete.attachmentUrl.startsWith('data:')) {
            requestDeleteOneDriveFile(
                itemToDelete.attachmentName,
                itemToDelete.team || 'FYI',
                itemToDelete.dateCreated || '',
                'N-A',
                itemToDelete.title || 'FYI Bulletin',
                true
            );
        }
        fyiItems = fyiItems.filter(item => item.id !== id);
        localStorage.setItem('mro_fyi_items', JSON.stringify(fyiItems));
        
        const isGas = typeof google !== 'undefined' && google.script && google.script.run;
        const hasSupabase = typeof window.supabaseClient !== 'undefined' && window.supabaseClient !== null;
        if (isGas || hasSupabase) {
            google.script.run.deleteFYI(id);
        }
        
        renderFYITab();
    }
}

function editFYIItem(id) {
    const item = fyiItems.find(item => String(item.id) === String(id));
    if (!item) return;
    
    const editFyiIdEl = document.getElementById('editFyiId');
    const editFyiTitleEl = document.getElementById('editFyiTitle');
    const editFyiTeamSelectEl = document.getElementById('editFyiTeamSelect');
    const editFyiAtaChapterEl = document.getElementById('editFyiAtaChapter');
    const editFyiContentEl = document.getElementById('editFyiContent');
    const editFyiAttachmentUrlEl = document.getElementById('editFyiAttachmentUrl');
    const editFyiAttachmentNameEl = document.getElementById('editFyiAttachmentName');
    const editFyiFileAttachmentEl = document.getElementById('editFyiFileAttachment');
    
    if (editFyiIdEl) editFyiIdEl.value = item.id;
    if (editFyiTitleEl) editFyiTitleEl.value = item.title;
    if (editFyiTeamSelectEl) editFyiTeamSelectEl.value = item.team;
    if (editFyiAtaChapterEl) editFyiAtaChapterEl.value = item.ataChapter || '';
    if (editFyiContentEl) editFyiContentEl.value = item.content;
    if (editFyiAttachmentUrlEl) editFyiAttachmentUrlEl.value = item.attachmentUrl || '';
    if (editFyiAttachmentNameEl) editFyiAttachmentNameEl.value = item.attachmentName || '';
    if (editFyiFileAttachmentEl) editFyiFileAttachmentEl.value = ''; // clear file selection
    
    openModal('editFyiModal');
}

function saveEditedFYIItem() {
    const fyiId = document.getElementById('editFyiId').value;
    const title = document.getElementById('editFyiTitle').value.trim();
    const team = document.getElementById('editFyiTeamSelect').value;
    const content = document.getElementById('editFyiContent').value.trim();
    const ataChapter = document.getElementById('editFyiAtaChapter').value.trim();
    const attachmentUrl = document.getElementById('editFyiAttachmentUrl').value.trim();
    let attachmentName = document.getElementById('editFyiAttachmentName').value.trim();
    
    if (!fyiId || !title || !content) return;
    
    if (attachmentUrl && !attachmentName) {
        try {
            const parts = attachmentUrl.split('/');
            attachmentName = parts[parts.length - 1] || 'Attached Link';
        } catch(e) {
            attachmentName = 'Attached Link';
        }
    }
    
    const existingIndex = fyiItems.findIndex(item => String(item.id) === String(fyiId));
    if (existingIndex !== -1) {
        fyiItems[existingIndex].team = team;
        fyiItems[existingIndex].title = title;
        fyiItems[existingIndex].content = content;
        fyiItems[existingIndex].ataChapter = ataChapter;
        fyiItems[existingIndex].attachmentUrl = attachmentUrl;
        fyiItems[existingIndex].attachmentName = attachmentName;
        
        const editedItem = fyiItems[existingIndex];
        localStorage.setItem('mro_fyi_items', JSON.stringify(fyiItems));
        
        const isGas = typeof google !== 'undefined' && google.script && google.script.run;
        const hasSupabase = typeof window.supabaseClient !== 'undefined' && window.supabaseClient !== null;
        if (isGas || hasSupabase) {
            google.script.run.saveFYI(editedItem);
        }
    }
    
    closeModal('editFyiModal');
    renderFYITab();
}

function uploadEditFyiFile(fileInput) {
    if (!fileInput || fileInput.files.length === 0) return;
    const file = fileInput.files[0];
    
    const isGas = typeof google !== 'undefined' && google.script && google.script.run && !google.script.isMock;
    const powerAutomateUrl = localStorage.getItem('mro_power_automate_url') || 'https://defaultc71838d2745b4a4fb00f2d0e6e1de6.f3.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/bd6fa12380224456960c9003b9f37992/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=3z3pW754II2nFkKkReGGm2xXiiIH1piGeaphI7Z60zs';
    const hasCloud = isGas || (powerAutomateUrl && powerAutomateUrl.trim() !== '');
    
    const maxLimit = hasCloud ? 10 * 1024 * 1024 : 1024 * 1024;
    if (file.size > maxLimit) {
        alert(`File "${file.name}" exceeds the ${hasCloud ? '10MB' : '1MB'} limit.`);
        fileInput.value = '';
        return;
    }
    
    if (isGas) {
        showLoadingIndicator(true);
    }
    
    const fyiTeamSelect = document.getElementById('editFyiTeamSelect');
    const fyiTeam = fyiTeamSelect ? fyiTeamSelect.value : '';
    const dateStr = new Date().toISOString().split('T')[0];
    const fyiTitleInput = document.getElementById('editFyiTitle');
    const fyiTitle = fyiTitleInput ? fyiTitleInput.value.trim() || 'FYI Bulletin' : 'FYI Bulletin';

    const reader = new FileReader();
    reader.onload = function(e) {
        handleCloudOrLocalUpload(file, e.target.result, (url) => {
            document.getElementById('editFyiAttachmentUrl').value = url;
            document.getElementById('editFyiAttachmentName').value = file.name;
            alert(`File "${file.name}" uploaded successfully!`);
        }, () => {
            document.getElementById('editFyiAttachmentUrl').value = e.target.result; // Base64 data URL
            document.getElementById('editFyiAttachmentName').value = file.name;
            alert(`File "${file.name}" cached locally!`);
        }, fyiTeam || 'FYI', dateStr, 'N-A', fyiTitle, true);
    };
    reader.readAsDataURL(file);
}

function setupFyiTeamTabs() {
    const container = document.getElementById('fyiTeamTabs');
    if (!container) return;
    
    container.addEventListener('click', (e) => {
        const btn = e.target.closest('.fyi-tab-btn');
        if (btn) {
            activeFyiTeam = btn.dataset.team;
            syncFyiTeamTabs();
            renderFYITab();
        }
    });
}

function syncFyiTeamTabs() {
    document.querySelectorAll('.fyi-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.team === activeFyiTeam);
    });
}

// Quick update directly from the task card
function addQuickUpdate(taskId, inputEl) {
    if (!inputEl) return;
    const text = inputEl.value.trim();
    if (!text) return;
    
    const task = tasks.find(t => t.id === taskId);
    if (task) {
        task.comments = task.comments || [];
        const author = localStorage.getItem('mro_user') || sessionStorage.getItem('mro_user') || 'DMA Staff';
        task.comments.push({
            author: author,
            text: text,
            timestamp: new Date().toISOString(),
            type: 'update'
        });
        saveTaskData(task);
        inputEl.value = '';
        renderApp();
    }
}

// Quick update file attachment handler
function uploadQuickUpdateFile(taskId, fileInput) {
    if (!fileInput || fileInput.files.length === 0) return;
    const file = fileInput.files[0];
    
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    task.attachments = task.attachments || [];
    if (task.attachments.length >= 10) {
        alert('Maximum of 10 attachment files/links allowed per task.');
        fileInput.value = '';
        return;
    }
    
    const isGas = typeof google !== 'undefined' && google.script && google.script.run && !google.script.isMock;
    const powerAutomateUrl = localStorage.getItem('mro_power_automate_url') || 'https://defaultc71838d2745b4a4fb00f2d0e6e1de6.f3.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/bd6fa12380224456960c9003b9f37992/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=3z3pW754II2nFkKkReGGm2xXiiIH1piGeaphI7Z60zs';
    const hasCloud = isGas || (powerAutomateUrl && powerAutomateUrl.trim() !== '');
    
    const maxLimit = hasCloud ? 10 * 1024 * 1024 : 1024 * 1024;
    if (file.size > maxLimit) {
        alert(`File "${file.name}" exceeds the ${hasCloud ? '10MB' : '1MB'} limit.`);
        fileInput.value = '';
        return;
    }
    
    if (isGas) {
        showLoadingIndicator(true);
    }
    
    const assignedTeam = task.assignedTeam || '';
    const dateStr = task.createdDate || new Date().toISOString().split('T')[0];
    const aircraftReg = task.aircraftReg || 'N-A';
    const topic = task.taskDescription || 'General';

    const reader = new FileReader();
    reader.onload = function(e) {
        handleCloudOrLocalUpload(file, e.target.result, (url) => {
            task.attachments.push({
                name: file.name,
                size: file.size,
                type: file.type,
                data: url
            });
            
            task.comments = task.comments || [];
            const author = localStorage.getItem('mro_user') || sessionStorage.getItem('mro_user') || 'DMA Staff';
            task.comments.push({
                author: author,
                text: `Attached file: ${file.name}`,
                timestamp: new Date().toISOString(),
                type: 'update'
            });
            
            saveTaskData(task);
            renderApp();
        }, () => {
            task.attachments.push({
                name: file.name,
                size: file.size,
                type: file.type,
                data: e.target.result // Base64 data URL
            });
            
            task.comments = task.comments || [];
            const author = localStorage.getItem('mro_user') || sessionStorage.getItem('mro_user') || 'DMA Staff';
            task.comments.push({
                author: author,
                text: `Attached file: ${file.name}`,
                timestamp: new Date().toISOString(),
                type: 'update'
            });
            
            saveTaskData(task);
            renderApp();
        }, assignedTeam, dateStr, aircraftReg, topic);
    };
    reader.readAsDataURL(file);
}

// Upload file from Material Catalog form
function uploadMaterialFile(fileInput) {
    if (!fileInput || fileInput.files.length === 0) return;
    const file = fileInput.files[0];
    
    const isGas = typeof google !== 'undefined' && google.script && google.script.run && !google.script.isMock;
    const powerAutomateUrl = localStorage.getItem('mro_power_automate_url') || 'https://defaultc71838d2745b4a4fb00f2d0e6e1de6.f3.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/bd6fa12380224456960c9003b9f37992/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=3z3pW754II2nFkKkReGGm2xXiiIH1piGeaphI7Z60zs';
    const hasCloud = isGas || (powerAutomateUrl && powerAutomateUrl.trim() !== '');
    
    const maxLimit = hasCloud ? 10 * 1024 * 1024 : 1024 * 1024;
    if (file.size > maxLimit) {
        alert(`File "${file.name}" exceeds the ${hasCloud ? '10MB' : '1MB'} limit.`);
        fileInput.value = '';
        return;
    }
    
    if (isGas) {
        showLoadingIndicator(true);
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const dotIndex = file.name.lastIndexOf('.');
        const extension = dotIndex !== -1 ? file.name.substring(dotIndex) : '';
        const renamedFile = {
            name: 'Material Catalog' + extension,
            type: file.type
        };
        handleCloudOrLocalUpload(renamedFile, e.target.result, (url) => {
            document.getElementById('sapSourceFile').value = url;
            alert(`File "${file.name}" uploaded successfully!`);
        }, () => {
            document.getElementById('sapSourceFile').value = e.target.result; // Base64 data URL
            alert(`File "${file.name}" cached locally!`);
        }, 'Materials', 'skip', 'N-A', 'Material Catalog');
    };
    reader.readAsDataURL(file);
}

// SAP Codes functions
function loadSAPCodes() {
    const isGas = typeof google !== 'undefined' && google.script && google.script.run;
    const localData = localStorage.getItem('mro_sap_codes');
    let loaded = false;
    
    if (localData && localData !== 'null' && localData !== 'undefined') {
        try {
            sapCodes = JSON.parse(localData);
            if (Array.isArray(sapCodes)) {
                if (document.getElementById('sapTab') && !document.getElementById('sapTab').classList.contains('hidden')) {
                    renderSAPTab();
                }
                loaded = true;
            }
        } catch(e) {
            sapCodes = [];
        }
    }
    if (!loaded) {
        // Seed default material codes
        sapCodes = [
            { id: '10045239', description: 'Self-locking nut specification drawing (MS21042-3)', sourceFile: 'https://www.google.com/search?q=MS21042-3+specification' },
            { id: '10088219', description: 'Hydraulic system seal o-ring specification (O-RING-2-214)', sourceFile: 'https://www.google.com/search?q=O-RING-2-214+datasheet' },
            { id: '10023490', description: 'Pitot static tube assembly schematic manual (2282000-11)', sourceFile: 'https://www.google.com/search?q=2282000-11+manual' },
            { id: '10011928', description: 'A320 landing gear bypass pin illustration (300-039-102-0)', sourceFile: 'https://www.google.com/search?q=300-039-102-0+bypass+pin' },
            { id: '10099438', description: 'Engine fuel filter element drawing (4500-A22)', sourceFile: 'https://www.google.com/search?q=4500-A22+fuel+filter' }
        ];
        localStorage.setItem('mro_sap_codes', JSON.stringify(sapCodes));
    }

    if (isGas) {
        google.script.run
            .withSuccessHandler(data => {
                if (data && Array.isArray(data)) {
                    sapCodes = data;
                    localStorage.setItem('mro_sap_codes', JSON.stringify(sapCodes));
                    if (document.getElementById('sapTab') && !document.getElementById('sapTab').classList.contains('hidden')) {
                        renderSAPTab();
                    }
                }
            })
            .getSAPCodes();
    } else if (supabaseClient) {
        refreshSAPCodesSilently();
    }
}

function renderSAPTab() {
    const listContainer = document.getElementById('sapTableBody');
    if (!listContainer) return;
    
    listContainer.innerHTML = '';
    
    const searchVal = document.getElementById('sapSearchInput')?.value.trim().toLowerCase() || '';
    
    const filteredCodes = sapCodes.filter(item => {
        return !searchVal || 
            item.description.toLowerCase().includes(searchVal) ||
            (item.sourceFile && item.sourceFile.toLowerCase().includes(searchVal));
    });
    
    if (filteredCodes.length === 0) {
        listContainer.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">
                    No materials found matching the query.
                </td>
            </tr>
        `;
        return;
    }
    
    filteredCodes.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><div style="white-space: normal; line-height: 1.4; font-size: 0.85rem; color: var(--text-primary); font-weight: 500;">${item.description}</div></td>
            <td>
                ${item.sourceFile ? `
                    <a href="${item.sourceFile}" target="_blank" class="btn btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px; min-height: auto; width: auto; height: auto;" onclick="event.stopPropagation();">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 12px; height: 12px;">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                            <polyline points="15 3 21 3 21 9"></polyline>
                            <line x1="10" y1="14" x2="21" y2="3"></line>
                        </svg>
                        Open Link
                    </a>
                ` : `<span style="color: var(--text-muted); font-size: 0.8rem; font-style: italic;">No file</span>`}
            </td>
            <td class="no-print" style="text-align: right;">
                <div style="display: inline-flex; gap: 0.35rem; justify-content: flex-end;">
                    <div class="action-icon" title="Edit Entry" onclick="editSAPCodeItem('${item.id}')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </div>
                    <div class="action-icon" title="Delete Entry" onclick="deleteSAPCodeItem('${item.id}')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px; color: var(--priority-aog);">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </div>
                </div>
            </td>
        `;
        listContainer.appendChild(row);
    });
}

function saveSAPCodeItem() {
    const idEl = document.getElementById('sapId');
    const descEl = document.getElementById('sapDescription');
    const fileEl = document.getElementById('sapSourceFile');
    
    if (!idEl || !descEl || !fileEl) return;
    
    const description = descEl.value.trim();
    const sourceFile = fileEl.value.trim();
    
    if (!description || !sourceFile) return;
    
    const id = idEl.value ? idEl.value.trim() : '';
    const isEdit = (id !== '');
    
    const newItem = {
        id: isEdit ? id : 'mat_' + Date.now().toString(),
        description: description,
        sourceFile: sourceFile
    };
    
    if (isEdit) {
        sapCodes = sapCodes.map(item => String(item.id) === String(id) ? newItem : item);
    } else {
        sapCodes.push(newItem);
    }
    
    localStorage.setItem('mro_sap_codes', JSON.stringify(sapCodes));
    
    const isGas = typeof google !== 'undefined' && google.script && google.script.run;
    const hasSupabase = typeof window.supabaseClient !== 'undefined' && window.supabaseClient !== null;
    if (isGas || hasSupabase) {
        google.script.run.saveSAPCode(newItem);
    }
    
    clearSapForm();
    renderSAPTab();
}

function editSAPCodeItem(id) {
    const item = sapCodes.find(item => String(item.id) === String(id));
    if (!item) return;
    
    document.getElementById('sapId').value = item.id;
    document.getElementById('sapDescription').value = item.description;
    document.getElementById('sapSourceFile').value = item.sourceFile || '';
    
    document.getElementById('sapFormTitle').textContent = `Edit Entry`;
    document.getElementById('sapCancelBtn').style.display = 'flex';
}

function deleteSAPCodeItem(id) {
    const item = sapCodes.find(item => String(item.id) === String(id));
    const desc = item ? item.description : 'this entry';
    if (confirm(`Are you sure you want to permanently delete: "${desc}"?`)) {
        sapCodes = sapCodes.filter(item => String(item.id) !== String(id));
        localStorage.setItem('mro_sap_codes', JSON.stringify(sapCodes));
        
        const isGas = typeof google !== 'undefined' && google.script && google.script.run;
        const hasSupabase = typeof window.supabaseClient !== 'undefined' && window.supabaseClient !== null;
        if (isGas || hasSupabase) {
            google.script.run.deleteSAPCode(id);
        }
        
        // If we were editing this entry, clear form
        if (String(document.getElementById('sapId').value) === String(id)) {
            clearSapForm();
        }
        
        renderSAPTab();
    }
}

function clearSapForm() {
    document.getElementById('sapForm').reset();
    document.getElementById('sapId').value = '';
    document.getElementById('sapFormTitle').textContent = 'Add New Material';
    document.getElementById('sapCancelBtn').style.display = 'none';
}

// Upload file from FYI bulletin form
function uploadFyiFile(fileInput) {
    if (!fileInput || fileInput.files.length === 0) return;
    const file = fileInput.files[0];
    
    const isGas = typeof google !== 'undefined' && google.script && google.script.run && !google.script.isMock;
    const powerAutomateUrl = localStorage.getItem('mro_power_automate_url') || 'https://defaultc71838d2745b4a4fb00f2d0e6e1de6.f3.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/bd6fa12380224456960c9003b9f37992/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=3z3pW754II2nFkKkReGGm2xXiiIH1piGeaphI7Z60zs';
    const hasCloud = isGas || (powerAutomateUrl && powerAutomateUrl.trim() !== '');
    
    const maxLimit = hasCloud ? 10 * 1024 * 1024 : 1024 * 1024;
    if (file.size > maxLimit) {
        alert(`File "${file.name}" exceeds the ${hasCloud ? '10MB' : '1MB'} limit.`);
        fileInput.value = '';
        return;
    }
    
    if (isGas) {
        showLoadingIndicator(true);
    }
    
    const fyiTeamSelect = document.getElementById('fyiTeamSelect');
    const fyiTeam = fyiTeamSelect ? fyiTeamSelect.value : '';
    const dateStr = new Date().toISOString().split('T')[0];
    const fyiTitleInput = document.getElementById('fyiTitle');
    const fyiTitle = fyiTitleInput ? fyiTitleInput.value.trim() || 'FYI Bulletin' : 'FYI Bulletin';

    const reader = new FileReader();
    reader.onload = function(e) {
        handleCloudOrLocalUpload(file, e.target.result, (url) => {
            document.getElementById('fyiAttachmentUrl').value = url;
            document.getElementById('fyiAttachmentName').value = file.name;
            alert(`File "${file.name}" uploaded successfully!`);
        }, () => {
            document.getElementById('fyiAttachmentUrl').value = e.target.result; // Base64 data URL
            document.getElementById('fyiAttachmentName').value = file.name;
            alert(`File "${file.name}" cached locally!`);
        }, fyiTeam || 'FYI', dateStr, 'N-A', fyiTitle, true);
    };
    reader.readAsDataURL(file);
}

function getFrontendWeekFolderName(dateString) {
    let date = new Date();
    if (dateString) {
        const parsed = new Date(dateString);
        if (!isNaN(parsed.getTime())) {
            date = parsed;
        }
    }
    const target = new Date(date.valueOf());
    const dayNumber = (date.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNumber + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
        target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    const weekNum = 1 + Math.ceil((firstThursday - target) / 604800000);
    const year = new Date(firstThursday).getFullYear();
    const formattedWeek = weekNum < 10 ? '0' + weekNum : weekNum;
    return 'Week ' + formattedWeek + ' (' + year + ')';
}

function requestDeleteOneDriveFile(fileName, teamName, dateStr, aircraftReg, topic, isFyi = false) {
    const isGas = typeof google !== 'undefined' && google.script && google.script.run && !google.script.isMock;
    if (isGas) {
        return;
    }
    const powerAutomateDeleteUrl = localStorage.getItem('mro_power_automate_delete_url') || 'https://defaultc71838d2745b4a4fb00f2d0e6e1de6.f3.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/b3812d58a78441ec957d93d98a1be233/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=7SgUjBpzW-lrGQvwJ1o0hRwSUitueC3gvb_DwG8QYW8';
    if (!powerAutomateDeleteUrl || !powerAutomateDeleteUrl.trim()) return;

    let teamNameSanitized = 'General';
    if (teamName && teamName.trim()) {
        teamNameSanitized = teamName.trim();
    }

    fetch(powerAutomateDeleteUrl.trim(), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            deleteLevel: 'file',
            fileName: fileName,
            team: teamNameSanitized,
            date: (dateStr === 'skip' ? '' : (dateStr || '')),
            aircraftReg: aircraftReg || 'N-A',
            topic: topic || 'General',
            isFyi: isFyi
        })
    })
    .then(response => {
        if (!response.ok) {
            console.error('Failed to trigger file deletion in Power Automate:', response.statusText);
        }
    })
    .catch(err => {
        console.error('Error triggering file deletion in Power Automate:', err);
    });
}

function deleteOneDriveFilesForTask(task) {
    if (!task || !task.attachments || task.attachments.length === 0) return;
    
    const powerAutomateDeleteUrl = localStorage.getItem('mro_power_automate_delete_url') || 'https://defaultc71838d2745b4a4fb00f2d0e6e1de6.f3.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/b3812d58a78441ec957d93d98a1be233/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=7SgUjBpzW-lrGQvwJ1o0hRwSUitueC3gvb_DwG8QYW8';
    if (!powerAutomateDeleteUrl || !powerAutomateDeleteUrl.trim()) return;
    
    task.attachments.forEach(attachment => {
        if (attachment.type !== 'url' && attachment.data && !attachment.data.startsWith('data:')) {
            requestDeleteOneDriveFile(
                attachment.name,
                task.assignedTeam || '',
                task.createdDate || '',
                task.aircraftReg || 'N-A',
                task.topic || task.taskDescription || 'General'
            );
        }
    });
}

window.requestDeleteOneDriveFile = requestDeleteOneDriveFile;
window.deleteOneDriveFilesForTask = deleteOneDriveFilesForTask;

function handleCloudOrLocalUpload(file, base64Data, successCallback, localFallbackCallback, teamName, dateStr, aircraftReg, topic, isFyi = false) {
    const isGas = typeof google !== 'undefined' && google.script && google.script.run && !google.script.isMock;
    if (isGas) {
        showLoadingIndicator(true);
        // Extract pure base64 (remove dataUrl prefix if present)
        let pureBase64 = base64Data;
        if (pureBase64.includes(';base64,')) {
            pureBase64 = pureBase64.split(';base64,')[1];
        }
        google.script.run
            .withSuccessHandler(uploadedFile => {
                showUploadCompleteAnimation(() => {
                    successCallback(uploadedFile.url);
                });
            })
            .withFailureHandler(err => {
                showLoadingIndicator(false);
                setTimeout(() => {
                    alert("Failed to upload file to Google Drive: " + err.message);
                }, 50);
            })
            .uploadFileToDrive(file.name, file.type, pureBase64, teamName || '', dateStr || '');
    } else {
        const powerAutomateUrl = localStorage.getItem('mro_power_automate_url') || 'https://defaultc71838d2745b4a4fb00f2d0e6e1de6.f3.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/bd6fa12380224456960c9003b9f37992/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=3z3pW754II2nFkKkReGGm2xXiiIH1piGeaphI7Z60zs';
        if (powerAutomateUrl && powerAutomateUrl.trim()) {
            showLoadingIndicator(true, "Uploading file to OneDrive...");
            
            let pureBase64 = base64Data;
            if (pureBase64.includes(';base64,')) {
                pureBase64 = pureBase64.split(';base64,')[1];
            }
            
            let teamNameSanitized = 'General';
            if (teamName && teamName.trim()) {
                teamNameSanitized = teamName.trim();
            }
            
            let weekFolder = '';
            if (dateStr && dateStr !== 'skip') {
                weekFolder = getFrontendWeekFolderName(dateStr);
            }
            
            fetch(powerAutomateUrl.trim(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    fileName: file.name,
                    mimeType: file.type,
                    base64Data: pureBase64,
                    team: teamNameSanitized,
                    date: (dateStr === 'skip' ? '' : (dateStr || '')),
                    weekFolder: weekFolder,
                    aircraftReg: aircraftReg || 'N-A',
                    topic: topic || 'General',
                    isFyi: isFyi
                })
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.text();
            })
            .then(text => {
                let fileUrl = '';
                const trimmedText = text ? text.trim() : '';
                
                if (trimmedText) {
                    try {
                        const result = JSON.parse(trimmedText);
                        fileUrl = result.link || result.url || result.fileUrl || '';
                    } catch (jsonErr) {
                        // If not JSON, check if response text itself is a valid URL
                        if (trimmedText.startsWith('http://') || trimmedText.startsWith('https://')) {
                            fileUrl = trimmedText;
                        }
                    }
                }
                
                if (fileUrl) {
                    showUploadCompleteAnimation(() => {
                        successCallback(fileUrl);
                    });
                } else {
                    showLoadingIndicator(false);
                    setTimeout(() => {
                        alert("Power Automate flow succeeded but did not return a sharing link (Response must be a URL or a JSON object with 'link' or 'url'). Falling back to local storage.");
                    }, 50);
                    localFallbackCallback();
                }
            })
            .catch(err => {
                showLoadingIndicator(false);
                let friendlyMessage = err.message;
                if (friendlyMessage && (friendlyMessage.includes("Unexpected end of JSON input") || friendlyMessage.includes("JSON"))) {
                    friendlyMessage = "Unexpected end of JSON input.\n\nThis typically means your Power Automate Flow failed to run successfully or returned an empty response instead of a valid JSON object. \n\nPlease check your Power Automate Flow Run History to debug the failure, and ensure your Response action returns a JSON object containing the sharing link (e.g. {\"link\": \"https://...\"}).";
                }
                setTimeout(() => {
                    alert("Failed to upload to OneDrive via Power Automate: " + friendlyMessage + "\n\nFalling back to local storage.");
                }, 50);
                localFallbackCallback();
            });
        } else {
            localFallbackCallback();
        }
    }
}
window.handleCloudOrLocalUpload = handleCloudOrLocalUpload;

// Expose globally
window.deleteFYIItem = deleteFYIItem;
window.saveFYIItem = saveFYIItem;
window.editFYIItem = editFYIItem;
window.saveEditedFYIItem = saveEditedFYIItem;
window.uploadEditFyiFile = uploadEditFyiFile;
window.clearFyiForm = clearFyiForm;
window.renderFYITab = renderFYITab;
window.addQuickUpdate = addQuickUpdate;
window.uploadQuickUpdateFile = uploadQuickUpdateFile;
window.uploadMaterialFile = uploadMaterialFile;
window.uploadFyiFile = uploadFyiFile;
window.loadSAPCodes = loadSAPCodes;
window.renderSAPTab = renderSAPTab;
window.saveSAPCodeItem = saveSAPCodeItem;
window.editSAPCodeItem = editSAPCodeItem;
window.deleteSAPCodeItem = deleteSAPCodeItem;
window.clearSapForm = clearSapForm;
window.renderRecurringBarChart = renderRecurringBarChart;
window.handleLogin = handleLogin;

// PRINT WEEKLY SUMMARY REPORT WITH LAYOUT SELECTION
function printSummaryReport(layout) {
    if (layout === 'one-page') {
        document.body.classList.add('print-one-page');
    } else {
        document.body.classList.remove('print-one-page');
    }
    
    // Hide the dropdown menu
    const menu = document.getElementById('printDropdownMenu');
    if (menu) menu.classList.add('hidden');
    
    try {
        // Try native print first (works in direct web view or if allow-modals sandbox is active)
        window.print();
    } catch (e) {
        console.warn("Direct window.print() failed. Attempting sandboxed fallback print window...", e);
        // Sandboxed fallback: Open a new tab, clone the DOM, strip scripts, and trigger print
        try {
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                const printDoc = document.documentElement.cloneNode(true);
                // Remove all script elements to prevent JS execution in new window
                printDoc.querySelectorAll('script').forEach(s => s.remove());
                
                const cleanHtml = '<!DOCTYPE html>\n<html>' + printDoc.innerHTML + '</html>';
                
                printWindow.document.open();
                printWindow.document.write(cleanHtml);
                printWindow.document.close();
                
                // Trigger print once content is written
                setTimeout(() => {
                    if (printWindow.print) {
                        printWindow.print();
                    }
                }, 500);
            } else {
                alert("Popup blocker prevented opening the print window. Please allow popups for this site.");
            }
        } catch (err) {
            console.error("Failed to print via fallback window:", err);
            alert("Printing is blocked by your browser's security sandbox or popup blocker. Please allow popups or open the app directly.");
        }
    }
}

// Clean up print class after print dialog is closed
window.addEventListener('afterprint', () => {
    document.body.classList.remove('print-one-page');
});



// Expose print function globally
window.printSummaryReport = printSummaryReport;

// ---- UPDATE LOG VERSION HISTORY MODAL ----
function showUpdateLogModal(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const updates = (task.comments || []).filter(c => c.type === 'update');
    const sortedUpdates = [...updates].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)); // oldest first

    let statusClass = 'open';
    if (task.currentStatus === 'In Progress') statusClass = 'progress';
    else if (task.currentStatus === 'Completed') statusClass = 'completed';

    const timelineHtml = sortedUpdates.length === 0
        ? `<div style="padding:2rem;text-align:center;color:var(--text-muted);font-style:italic;font-size:0.88rem;">No status updates have been recorded for this task.</div>`
        : `<div class="dhl-timeline">
            ${sortedUpdates.map((u, i) => {
                let monthDay = '';
                let yearVal = '';
                let timeStr = '';
                try {
                    const d = new Date(u.timestamp);
                    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                    const day = String(d.getDate()).padStart(2,'0');
                    const mon = months[d.getMonth()];
                    yearVal = d.getFullYear();
                    monthDay = `${mon} ${day},`;
                    
                    let hours = d.getHours();
                    const minutes = String(d.getMinutes()).padStart(2,'0');
                    const ampm = hours >= 12 ? 'PM' : 'AM';
                    hours = hours % 12;
                    hours = hours ? hours : 12;
                    timeStr = `${hours}:${minutes} ${ampm}`;
                } catch(e) {
                    monthDay = 'Date';
                    yearVal = 'N/A';
                    timeStr = u.timestamp;
                }
                
                // Show date only if it's different from the previous one in the list (newest first)
                let showDate = true;
                if (i > 0) {
                    try {
                        const prevD = new Date(sortedUpdates[i - 1].timestamp);
                        const currD = new Date(u.timestamp);
                        showDate = prevD.toDateString() !== currD.toDateString();
                    } catch(e) {}
                }
                
                const dateHtml = showDate 
                    ? `<span class="dhl-date-month">${monthDay}</span>
                       <span class="dhl-date-year">${yearVal}</span>`
                    : '';
                
                return `
                    <div class="dhl-timeline-item">
                        <div class="dhl-timeline-date">
                            ${dateHtml}
                        </div>
                        <div class="dhl-timeline-node-container">
                            <div class="dhl-timeline-badge">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" class="dhl-checkmark">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                            </div>
                        </div>
                        <div class="dhl-timeline-content">
                            <div class="dhl-status-title">${escapeHTMLApp(u.text)}</div>
                            <div class="dhl-status-subtext">${timeStr} &middot; ${escapeHTMLApp(u.author)}</div>
                        </div>
                    </div>`;
            }).join('')}
           </div>`;

    document.getElementById('updateLogModalTitle').textContent = `${task.aircraftReg} – Status Log`;
    document.getElementById('updateLogModalSubtitle').innerHTML =
        `<span class="badge-status ${statusClass}" style="font-size:0.72rem;">${task.currentStatus}</span>
         <span style="font-size:0.8rem;color:var(--text-muted);">${task.topic || task.taskDescription.substring(0,60)}</span>
         <span style="font-size:0.8rem;color:var(--text-muted);">&middot; ${sortedUpdates.length} update${sortedUpdates.length !== 1 ? 's' : ''}</span>`;
    document.getElementById('updateLogTimeline').innerHTML = timelineHtml;
    openModal('updateLogModal');
}

function closeUpdateLogModal() {
    closeModal('updateLogModal');
}

function toggleWeeklyLogRow(rowId, btn) {
    const row = document.getElementById(rowId);
    if (!row) return;
    const isHidden = window.getComputedStyle(row).display === 'none';
    if (isHidden) {
        row.style.setProperty('display', 'table-row', 'important');
        const svg = btn.querySelector('svg');
        if (svg) svg.style.transform = 'rotate(180deg)';
        btn.style.color = 'var(--team-avionics)';
    } else {
        row.style.setProperty('display', 'none', 'important');
        const svg = btn.querySelector('svg');
        if (svg) svg.style.transform = 'rotate(0deg)';
        btn.style.color = 'var(--text-muted)';
    }
}

window.showUpdateLogModal = showUpdateLogModal;
window.closeUpdateLogModal = closeUpdateLogModal;
window.toggleWeeklyLogRow = toggleWeeklyLogRow;


function handleSettingsBtnClick() {
    // Show the password prompt first — settings are admin-only
    const passwordInput = document.getElementById('settingsPasswordInput');
    const errorMsg = document.getElementById('settingsPasswordError');
    if (passwordInput) passwordInput.value = '';
    if (errorMsg) errorMsg.style.display = 'none';
    openModal('settingsPasswordModal');
    setTimeout(() => { if (passwordInput) passwordInput.focus(); }, 200);
}

function verifySettingsPassword() {
    const passwordInput = document.getElementById('settingsPasswordInput');
    const errorMsg = document.getElementById('settingsPasswordError');
    const entered = passwordInput ? passwordInput.value : '';

    if (entered !== 'Admin_DMA') {
        if (errorMsg) errorMsg.style.display = 'block';
        if (passwordInput) {
            passwordInput.value = '';
            passwordInput.focus();
        }
        return;
    }

    // Correct password — close the prompt and open settings
    closeModal('settingsPasswordModal');

    const isGas = typeof google !== 'undefined' && google.script && google.script.run && typeof google.script.run.getFolderUrl === 'function';
    // Load local values first
    const localPowerAutomateUrl = localStorage.getItem('mro_power_automate_url') || '';
    const powerAutomateInput = document.getElementById('powerAutomateUrl');
    if (powerAutomateInput) powerAutomateInput.value = localPowerAutomateUrl;

    const localPowerAutomateDeleteUrl = localStorage.getItem('mro_power_automate_delete_url') || '';
    const powerAutomateDeleteInput = document.getElementById('powerAutomateDeleteUrl');
    if (powerAutomateDeleteInput) powerAutomateDeleteInput.value = localPowerAutomateDeleteUrl;

    const localSupabaseUrl = localStorage.getItem('mro_supabase_url') || '';
    const localSupabaseAnonKey = localStorage.getItem('mro_supabase_anon_key') || '';
    const supabaseUrlInput = document.getElementById('supabaseUrl');
    const supabaseAnonKeyInput = document.getElementById('supabaseAnonKey');
    if (supabaseUrlInput) supabaseUrlInput.value = localSupabaseUrl;
    if (supabaseAnonKeyInput) supabaseAnonKeyInput.value = localSupabaseAnonKey;

    if (isGas) {
        google.script.run
            .withSuccessHandler(url => {
                document.getElementById('customFolderUrl').value = url || '';
                openModal('settingsModal');
            })
            .getFolderUrl();
    } else {
        document.getElementById('customFolderUrl').value = localStorage.getItem('mro_custom_folder_url') || '';
        openModal('settingsModal');
    }
}
window.handleSettingsBtnClick = handleSettingsBtnClick;
window.verifySettingsPassword = verifySettingsPassword;

// Live header clock
function startHeaderClock() {
    const timeEl = document.getElementById('headerTime');
    const dateEl = document.getElementById('headerDate');
    if (!timeEl || !dateEl) return;

    const updateClock = () => {
        const now = new Date();
        timeEl.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
        dateEl.textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
    };

    updateClock();
    setInterval(updateClock, 1000);
}

// Consolidate and render notifications
function renderNotifications() {
    const listEl = document.getElementById('notificationList');
    const badgeEl = document.getElementById('notificationBadge');
    if (!listEl) return;

    const activities = [];

    // 1. Task Creations
    tasks.forEach(task => {
        if (task.createdDate) {
            activities.push({
                type: 'task_create',
                timestamp: task.createdDate,
                title: 'New Task Created',
                description: `${task.aircraftReg || 'N-A'} - ${task.topic || 'General'}`,
                taskId: task.id
            });
        }
        
        // 2. Task Updates
        if (task.comments && Array.isArray(task.comments)) {
            task.comments.forEach(comment => {
                activities.push({
                    type: 'task_update',
                    timestamp: comment.timestamp,
                    title: 'Task Status Update',
                    description: `${comment.author || 'Staff'}: ${comment.text}`,
                    taskId: task.id
                });
            });
        }
    });

    // 3. FYI Bulletins
    if (typeof fyiItems !== 'undefined' && Array.isArray(fyiItems)) {
        fyiItems.forEach(fyi => {
            activities.push({
                type: 'fyi_add',
                timestamp: fyi.dateCreated,
                title: 'New FYI Bulletin',
                description: `${fyi.team || 'General'}: ${fyi.title}`,
                actionTab: 'fyi'
            });
        });
    }

    // Sort by timestamp descending
    activities.sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime() || 0;
        const timeB = new Date(b.timestamp).getTime() || 0;
        return timeB - timeA;
    });

    const topActivities = activities.slice(0, 10);

    const lastReadStr = localStorage.getItem('mro_last_read_notifications') || '1970-01-01T00:00:00.000Z';
    const lastReadTime = new Date(lastReadStr).getTime();
    
    let hasUnread = false;

    if (topActivities.length === 0) {
        listEl.innerHTML = `<div style="padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.8rem; font-style: italic;">No recent activities</div>`;
        if (badgeEl) badgeEl.classList.add('hidden');
        return;
    }

    listEl.innerHTML = topActivities.map(act => {
        const actTime = new Date(act.timestamp).getTime() || 0;
        const isUnread = actTime > lastReadTime;
        if (isUnread) hasUnread = true;

        let iconHtml = '';
        let clickHandler = '';

        if (act.taskId) {
            clickHandler = `onclick="openDetailsModal('${act.taskId}'); const panel = document.getElementById('notificationPanel'); if (panel) panel.classList.add('hidden');"`;
            iconHtml = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px; color: var(--status-progress);">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                </svg>
            `;
        } else if (act.actionTab === 'fyi') {
            clickHandler = `onclick="const fyiBtn = document.querySelector('.tab-item[data-tab=\\'fyi\\']'); if(fyiBtn) fyiBtn.click(); const panel = document.getElementById('notificationPanel'); if (panel) panel.classList.add('hidden');"`;
            iconHtml = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px; color: var(--priority-aog);">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
            `;
        }

        const dateFormatted = new Date(act.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

        return `
            <div ${clickHandler} class="notification-item" style="display: flex; gap: 10px; padding: 0.75rem 1rem; border-bottom: 1px solid var(--border-color); cursor: pointer; transition: background 0.2s; align-items: flex-start; ${isUnread ? 'background: rgba(124, 58, 237, 0.03);' : ''}">
                <div style="width: 28px; height: 28px; border-radius: 50%; background: var(--bg-secondary); display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px;">
                    ${iconHtml}
                </div>
                <div style="display: flex; flex-direction: column; flex-grow: 1; align-items: flex-start;">
                    <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
                        <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-primary); text-align: left;">${act.title}</span>
                        ${isUnread ? '<span style="width: 6px; height: 6px; border-radius: 50%; background-color: var(--priority-aog);"></span>' : ''}
                    </div>
                    <span style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px; text-align: left; line-height: 1.25;">${act.description}</span>
                    <span style="font-size: 0.65rem; color: var(--text-muted); margin-top: 4px; font-weight: 500;">${dateFormatted}</span>
                </div>
            </div>
        `;
    }).join('');

    if (badgeEl) {
        if (hasUnread) {
            badgeEl.classList.remove('hidden');
        } else {
            badgeEl.classList.add('hidden');
        }
    }
}

// ==========================================
// CALENDAR VIEW CONTROLLER LOGIC
// ==========================================
let currentCalendarDate = new Date();
let selectedCalendarTeam = 'All Teams';

function renderCalendarTab() {
    try {
        const monthLabel = document.getElementById('calMonthYearLabel');
        const daysGrid = document.getElementById('calendarDaysGrid');
        if (!monthLabel || !daysGrid) return;

        const year = currentCalendarDate.getFullYear();
        const month = currentCalendarDate.getMonth(); // 0-11

        const monthNames = [
            "January", "February", "March", "April", "May", "June", 
            "July", "August", "September", "October", "November", "December"
        ];
        monthLabel.textContent = `${monthNames[month]} ${year}`;

        // Get calendar days array
        const firstDay = new Date(year, month, 1);
        const startDayOfWeek = firstDay.getDay(); // 0 (Sun) to 6 (Sat)
        const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
        const totalDaysInPrevMonth = new Date(year, month, 0).getDate();

        let gridHtml = '';

        const pad = (num) => String(num).padStart(2, '0');

        // 1. Previous Month padding days
        for (let i = startDayOfWeek - 1; i >= 0; i--) {
            const prevDay = totalDaysInPrevMonth - i;
            const prevMonth = month === 0 ? 11 : month - 1;
            const prevYear = month === 0 ? year - 1 : year;
            const dateStr = `${prevYear}-${pad(prevMonth + 1)}-${pad(prevDay)}`;
            gridHtml += renderCalendarCell(prevDay, prevMonth, prevYear, dateStr, true);
        }

        // 2. Current Month days
        for (let day = 1; day <= totalDaysInMonth; day++) {
            const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
            gridHtml += renderCalendarCell(day, month, year, dateStr, false);
        }

        // 3. Next Month padding days (to fill 42 cells total)
        const totalRendered = startDayOfWeek + totalDaysInMonth;
        const nextPadding = 42 - totalRendered;
        for (let day = 1; day <= nextPadding; day++) {
            const nextMonth = month === 11 ? 0 : month + 1;
            const nextYear = month === 11 ? year + 1 : year;
            const dateStr = `${nextYear}-${pad(nextMonth + 1)}-${pad(day)}`;
            gridHtml += renderCalendarCell(day, nextMonth, nextYear, dateStr, true);
        }

        daysGrid.innerHTML = gridHtml;
    } catch (e) {
        console.error("Error rendering calendar tab:", e);
    }
}

function renderCalendarCell(day, month, year, dateStr, isOtherMonth) {
    try {
        const today = new Date();
        const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

        // Filter tasks scheduled for this RTS date
        const cellTasks = (tasks || []).filter(t => {
            if (!t || !t.rtsDate) return false;
            
            let rtsDateStr = '';
            if (t.rtsDate instanceof Date) {
                rtsDateStr = t.rtsDate.toISOString();
            } else if (typeof t.rtsDate === 'string') {
                rtsDateStr = t.rtsDate;
            } else {
                rtsDateStr = String(t.rtsDate);
            }
            
            const taskDate = rtsDateStr.split('T')[0];
            const matchesDate = taskDate === dateStr;
            if (!matchesDate) return false;

            if (selectedCalendarTeam === 'All Teams') return true;
            const taskTeams = (t.assignedTeam || '').split(',').map(s => s.trim());
            return taskTeams.includes(selectedCalendarTeam);
        });

        let tasksHtml = '';
        const maxVisibleTasks = 2; // Keep it clean
        const visibleTasks = cellTasks.slice(0, maxVisibleTasks);

        visibleTasks.forEach(task => {
            if (!task) return;
            let teamClass = 'comp-team'; // default
            const firstTeam = (task.assignedTeam || '').split(',')[0].trim();
            if (firstTeam === 'Mechanical System Team') teamClass = 'mech-team';
            else if (firstTeam === 'Avionic Systems Team') teamClass = 'av-team';
            else if (firstTeam === 'Structure Team') teamClass = 'struct-team';
            else if (firstTeam === 'Engines Team') teamClass = 'eng-team';
            else if (firstTeam === 'IERA Shop') teamClass = 'iera-team';

            const priorityText = task.priorityLevel === 'AOG' ? '⚠️ ' : '';
            const statusText = task.currentStatus === 'Completed' ? '✅ ' : '';
            tasksHtml += `
                <div class="calendar-task-badge ${teamClass}" 
                     onclick="event.stopPropagation(); openDetailsModal('${task.id}');"
                     title="${escapeHTMLApp(task.aircraftReg || 'N/A')} - ${escapeHTMLApp(task.taskDescription || '')} (${escapeHTMLApp(task.currentStatus || 'Open')})">
                    ${statusText}${priorityText}${escapeHTMLApp(task.aircraftReg || 'N/A')}
                </div>
            `;
        });

        if (cellTasks.length > maxVisibleTasks) {
            tasksHtml += `<div class="calendar-more-indicator">+${cellTasks.length - maxVisibleTasks} more</div>`;
        }

        return `
            <div class="calendar-cell ${isOtherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}" 
                 onclick="handleCalendarCellClick('${dateStr}')">
                <span class="calendar-date-number">${day}</span>
                <div class="calendar-tasks-list">
                    ${tasksHtml}
                </div>
            </div>
        `;
    } catch (e) {
        console.error("Error rendering calendar cell:", e);
        return `
            <div class="calendar-cell ${isOtherMonth ? 'other-month' : ''}" 
                 onclick="handleCalendarCellClick('${dateStr}')">
                <span class="calendar-date-number">${day}</span>
            </div>
        `;
    }
}

function handleCalendarCellClick(dateStr) {
    // Open Add Task Modal
    openAddTaskModal();
    // Pre-fill the RTS Date input in the task form
    const rtsInput = document.getElementById('rtsDate');
    if (rtsInput) {
        rtsInput.value = dateStr;
        rtsInput.disabled = false;
        rtsInput.style.opacity = '1';
        
        // Uncheck the RTS Date N/A checkbox if checked
        const rtsNa = document.getElementById('rtsDateNa');
        if (rtsNa) {
            rtsNa.checked = false;
        }
    }
}

// Expose functions globally
window.renderCalendarTab = renderCalendarTab;
window.handleCalendarCellClick = handleCalendarCellClick;

