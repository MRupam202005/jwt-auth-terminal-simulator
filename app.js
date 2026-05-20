// Base64URL Encoding & Decoding Utilities (Pure JS)
function b64urlEncode(str) {
    try {
        return btoa(unescape(encodeURIComponent(str)))
            .replace(/=/g, '')
            .replace(/\+/g, '-')
            .replace(/\//g, '_');
    } catch (e) {
        return "";
    }
}

function b64urlDecode(str) {
    try {
        // Pad standard Base64 if needed
        let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) {
            base64 += '=';
        }
        return decodeURIComponent(escape(atob(base64)));
    } catch (e) {
        return "Invalid Base64URL string";
    }
}

// Deterministic Cryptographic Signature Simulation
// Generates a consistent, realistic 43-character token signature based on inputs and secret key.
function simulateSignature(headerB64, payloadB64, secret) {
    const input = headerB64 + "." + payloadB64 + "." + secret;
    let hash = 0;
    for (let i = 0; i < input.length; i++) {   // loop through the input string to generate a hash for the jwt signature part
        const char = input.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }

    // Convert hash to deterministic base36 combinations
    const p1 = Math.abs(hash).toString(36);
    const p2 = Math.abs(hash * 31).toString(36);
    const p3 = Math.abs(hash * 97).toString(36);

    // Assemble a realistic looking signature
    const signatureTemplate = "SflK" + p1.substring(0, 10) + "xwR" + p2.substring(0, 10) + "MeJf" + p3.substring(0, 10) + "yJV_Qss";
    return signatureTemplate.substring(0, 43);
}

// Generate a valid JWT structure
function generateJWT(payload, secret) {
    const header = {
        alg: "HS256",
        typ: "JWT"
    };

    const headerB64 = b64urlEncode(JSON.stringify(header));
    const payloadB64 = b64urlEncode(JSON.stringify(payload));
    const signature = simulateSignature(headerB64, payloadB64, secret);

    return `${headerB64}.${payloadB64}.${signature}`;
}

// App State Management
const STATE = {
    // Session states
    username: null,
    role: null,
    secretKey: "jwt-simulator-secret-key",

    // Tokens in simulated localStorage
    accessToken: null,
    accessTokenExpiresAt: 0, // epoch seconds

    refreshToken: null,
    refreshTokenExpiresAt: 0, // epoch seconds

    // Lifespans (seconds)
    accessLifespan: 30,
    refreshLifespan: 90,

    // Timer handles
    timerIntervalId: null,

    // Interactive state flags
    isProcessing: false,
    selectedTokenForDecoder: 'access', // 'access' or 'refresh'

    // Command History
    cmdHistory: [],
    historyIndex: -1
};

// HTML Elements Selection
const elements = {
    terminalLogs: document.getElementById('terminal-logs'),
    terminalInput: document.getElementById('terminal-input'),
    sessionStatusBadge: document.getElementById('session-status-badge'),

    // Controls
    btnLogin: document.getElementById('btn-login'),
    btnRequest: document.getElementById('btn-request'),
    btnExpireAccess: document.getElementById('btn-expire-access'),
    btnExpireBoth: document.getElementById('btn-expire-both'),
    btnRefresh: document.getElementById('btn-refresh'),
    btnLogout: document.getElementById('btn-logout'),

    toggleAutoRefresh: document.getElementById('toggle-auto-refresh'),
    toggleServerDelay: document.getElementById('toggle-server-delay'),

    // Storage
    accessTokenBox: document.getElementById('access-token-box'),
    accessTokenInput: document.getElementById('access-token-input'),
    accessTimer: document.getElementById('access-timer'),
    accessStatusBadge: document.getElementById('access-status-badge'),
    accessLength: document.getElementById('access-length'),
    btnTamperAccess: document.getElementById('btn-tamper-access'),

    refreshTokenBox: document.getElementById('refresh-token-box'),
    refreshTokenInput: document.getElementById('refresh-token-input'),
    refreshTimer: document.getElementById('refresh-timer'),
    refreshStatusBadge: document.getElementById('refresh-status-badge'),
    refreshLength: document.getElementById('refresh-length'),
    btnTamperRefresh: document.getElementById('btn-tamper-refresh'),

    // Tabbed education elements
    tabButtons: document.querySelectorAll('.tab-btn'),
    tabContents: document.querySelectorAll('.tab-content'),

    // Decoder highlighting
    jwtVisualizer: document.getElementById('encoded-jwt-visualizer'),
    partHeader: document.getElementById('jwt-part-header'),
    partPayload: document.getElementById('jwt-part-payload'),
    partSignature: document.getElementById('jwt-part-signature'),

    paneHeader: document.getElementById('pane-header'),
    panePayload: document.getElementById('pane-payload'),
    paneSignature: document.getElementById('pane-signature'),

    decodedHeaderJson: document.getElementById('decoded-header-json'),
    decodedPayloadJson: document.getElementById('decoded-payload-json'),
    decodedSignatureRaw: document.getElementById('decoded-signature-raw'),

    // Timeline steps
    steps: document.querySelectorAll('.timeline-step')
};

// Initialize Application
function init() {
    setupEventListeners();
    startStorageClock();
    addSystemLog("Welcome to the JWT Interactive Terminal Simulation.");
    addSystemLog("Use the buttons below or type terminal commands to learn.");
    updateTimelineUI(1);
    updateDecoderUI();
}

// Setup Keyboard & Click Events
function setupEventListeners() {
    // Command input submission
    elements.terminalInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            const command = this.value.trim();
            if (command) {
                executeCommand(command);
                STATE.cmdHistory.push(command);
                STATE.historyIndex = STATE.cmdHistory.length;
            }
            this.value = '';
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (STATE.historyIndex > 0) {
                STATE.historyIndex--;
                this.value = STATE.cmdHistory[STATE.historyIndex];
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (STATE.historyIndex < STATE.cmdHistory.length - 1) {
                STATE.historyIndex++;
                this.value = STATE.cmdHistory[STATE.historyIndex];
            } else {
                STATE.historyIndex = STATE.cmdHistory.length;
                this.value = '';
            }
        }
    });

    // Control buttons clicks
    elements.btnLogin.addEventListener('click', () => executeCommand('login'));
    elements.btnRequest.addEventListener('click', () => executeCommand('request /api/user'));
    elements.btnExpireAccess.addEventListener('click', () => executeCommand('expire-access'));
    elements.btnExpireBoth.addEventListener('click', () => executeCommand('expire-refresh'));
    elements.btnRefresh.addEventListener('click', () => executeCommand('refresh-token'));
    elements.btnLogout.addEventListener('click', () => executeCommand('logout'));

    // Token manual edits and tampering
    elements.accessTokenInput.addEventListener('input', function () {
        const value = this.value.trim();
        elements.accessLength.textContent = `${value.length} chars`;
        if (value) {
            elements.btnTamperAccess.disabled = false;
            STATE.accessToken = value;
            syncDecodedTokenDetails('access');
        } else {
            clearTokenState('access');
        }
    });

    elements.refreshTokenInput.addEventListener('input', function () {
        const value = this.value.trim();
        elements.refreshLength.textContent = `${value.length} chars`;
        if (value) {
            elements.btnTamperRefresh.disabled = false;
            STATE.refreshToken = value;
            syncDecodedTokenDetails('refresh');
        } else {
            clearTokenState('refresh');
        }
    });

    elements.btnTamperAccess.addEventListener('click', () => tamperToken('access'));
    elements.btnTamperRefresh.addEventListener('click', () => tamperToken('refresh'));

    // Select token box to load it into the interactive decoder
    elements.accessTokenBox.addEventListener('click', () => selectTokenForDecoder('access'));
    elements.refreshTokenBox.addEventListener('click', () => selectTokenForDecoder('refresh'));

    // Setup tab clicks
    elements.tabButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            elements.tabButtons.forEach(b => b.classList.remove('active'));
            elements.tabContents.forEach(c => c.classList.remove('active'));

            this.classList.add('active');
            const tabId = this.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
        });
    });

    // Interactive Hover/Click Highlighting in Decoder Tab
    const parts = [
        { el: elements.partHeader, pane: elements.paneHeader },
        { el: elements.partPayload, pane: elements.panePayload },
        { el: elements.partSignature, pane: elements.paneSignature }
    ];

    parts.forEach(part => {
        part.el.addEventListener('mouseover', () => {
            parts.forEach(p => p.pane.classList.remove('highlight'));
            part.pane.classList.add('highlight');
        });
        part.el.addEventListener('click', () => {
            parts.forEach(p => p.pane.classList.remove('highlight'));
            part.pane.classList.add('highlight');
            part.pane.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
    });
}

// ----------------- Terminal Emulator Logs & Execution -----------------

function addLog(text, type = 'client') {
    const timestampStr = new Date().toLocaleTimeString();
    const logLine = document.createElement('div');
    logLine.className = `log-line log-${type}`;

    let prefix = '';
    if (type === 'client') prefix = `<span class="badge-log tag-client">CLIENT</span> <span class="timestamp">[${timestampStr}]</span> `;
    else if (type === 'server') prefix = `<span class="badge-log tag-server">SERVER</span> <span class="timestamp">[${timestampStr}]</span> `;
    else if (type === 'middleware') prefix = `<span class="badge-log tag-middleware">MIDDLEWARE</span> <span class="timestamp">[${timestampStr}]</span> `;
    else if (type === 'success') prefix = `<span class="badge-log tag-system">SUCCESS</span> <span class="timestamp">[${timestampStr}]</span> `;
    else if (type === 'warning') prefix = `<span class="badge-log tag-system">WARNING</span> <span class="timestamp">[${timestampStr}]</span> `;
    else if (type === 'danger') prefix = `<span class="badge-log tag-system">ERROR</span> <span class="timestamp">[${timestampStr}]</span> `;
    else prefix = `<span class="badge-log tag-system">SYSTEM</span> <span class="timestamp">[${timestampStr}]</span> `;

    logLine.innerHTML = `${prefix}${text}`;
    elements.terminalLogs.appendChild(logLine);
    elements.terminalLogs.scrollTop = elements.terminalLogs.scrollHeight;
}

function addSystemLog(text) {
    addLog(text, 'system');
}

function clearTerminal() {
    elements.terminalLogs.innerHTML = '';
    addSystemLog("Terminal buffer cleared.");
}

// Core Router for commands typed in terminal or clicked as actions
function executeCommand(rawCommand) {
    if (STATE.isProcessing) return;

    const parts = rawCommand.trim().split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    // Print command entered to the terminal screen
    const cmdLine = document.createElement('div');
    cmdLine.className = 'log-line log-client';
    cmdLine.innerHTML = `<span class="terminal-prompt">rupam@jwt-sim:~$</span> <strong>${rawCommand}</strong>`;
    elements.terminalLogs.appendChild(cmdLine);
    elements.terminalLogs.scrollTop = elements.terminalLogs.scrollHeight;

    const delay = elements.toggleServerDelay.checked ? 500 : 0;

    if (command === 'help') {
        showHelp();
    } else if (command === 'clear') {
        clearTerminal();
    } else if (command === 'login') {
        STATE.isProcessing = true;
        const user = args[0] || 'rupam_dev';
        addLog(`Initiating HTTP POST /api/login for user: "${user}"...`, 'client');

        setTimeout(() => {
            performLogin(user);
            STATE.isProcessing = false;
        }, delay);
    } else if (command === 'request') {
        const path = args[0] || '/api/user';
        if (path !== '/api/user') {
            addLog(`404 Not Found: Cannot GET ${path}`, 'danger');
            return;
        }
        STATE.isProcessing = true;
        addLog(`Sending HTTP GET ${path} with Bearer Access Token...`, 'client');

        setTimeout(() => {
            performProtectedRequest(path);
            STATE.isProcessing = false;
        }, delay);
    } else if (command === 'refresh-token' || command === 'refresh') {
        STATE.isProcessing = true;
        addLog(`Sending HTTP POST /api/refresh with Refresh Token...`, 'client');

        setTimeout(() => {
            performTokenRefresh(false);
            STATE.isProcessing = false;
        }, delay);
    } else if (command === 'expire-access') {
        STATE.accessTokenExpiresAt = Math.floor(Date.now() / 1000) - 5; // Set 5s in the past
        addSystemLog("Access Token lifespan set to EXPIRED in local storage.");
        updateTimelineUI(3);
    } else if (command === 'expire-refresh') {
        STATE.accessTokenExpiresAt = Math.floor(Date.now() / 1000) - 5;
        STATE.refreshTokenExpiresAt = Math.floor(Date.now() / 1000) - 5;
        addSystemLog("Both Access and Refresh Token lifespans set to EXPIRED.");
        updateTimelineUI(5);
    } else if (command === 'logout') {
        STATE.isProcessing = true;
        addLog("Sending logout API request and clearing client storage...", 'client');

        setTimeout(() => {
            performLogout();
            STATE.isProcessing = false;
        }, delay);
    } else {
        addSystemLog(`Command not found: "${command}". Type <span class="cmd-highlight">help</span> for a list of commands.`);
    }
}

function showHelp() {
    addSystemLog("Available Simulation Commands:");
    addSystemLog("  <span class=\"cmd-highlight\">login [username]</span>   Authenticate and issue access & refresh tokens.");
    addSystemLog("  <span class=\"cmd-highlight\">request /api/user</span>  Make a protected request using the active access token.");
    addSystemLog("  <span class=\"cmd-highlight\">refresh-token</span>      Force a token refresh manually using the refresh token.");
    addSystemLog("  <span class=\"cmd-highlight\">expire-access</span>      Manually expire the access token to test expiration.");
    addSystemLog("  <span class=\"cmd-highlight\">expire-refresh</span>     Manually expire both tokens to force re-authentication.");
    addSystemLog("  <span class=\"cmd-highlight\">logout</span>             Clear tokens and end the session.");
    addSystemLog("  <span class=\"cmd-highlight\">clear</span>              Clear terminal logs screen.");
}

// ----------------- Authentication Lifecycle Logic -----------------

// LOGIN COMMAND
function performLogin(username) {
    // Simulated database query success. We issue standard credentials
    STATE.username = username;
    STATE.role = username === 'admin' ? 'admin' : 'developer';

    addLog(`POST /api/login - credentials verified in database.`, 'server');

    const now = Math.floor(Date.now() / 1000);
    STATE.accessTokenExpiresAt = now + STATE.accessLifespan;
    STATE.refreshTokenExpiresAt = now + STATE.refreshLifespan;

    // Build Payloads
    const accessPayload = {
        sub: "usr_55621",
        username: STATE.username,
        role: STATE.role,
        type: "access",
        iat: now,
        exp: STATE.accessTokenExpiresAt
    };

    const refreshPayload = {
        sub: "usr_55621",
        type: "refresh",
        iat: now,
        exp: STATE.refreshTokenExpiresAt
    };

    // Encrypt/Generate tokens
    STATE.accessToken = generateJWT(accessPayload, STATE.secretKey);
    STATE.refreshToken = generateJWT(refreshPayload, STATE.secretKey);

    // Save to HTML LocalStorage Simulation Inputs
    elements.accessTokenInput.value = STATE.accessToken;
    elements.accessLength.textContent = `${STATE.accessToken.length} chars`;
    elements.btnTamperAccess.disabled = false;

    elements.refreshTokenInput.value = STATE.refreshToken;
    elements.refreshLength.textContent = `${STATE.refreshToken.length} chars`;
    elements.btnTamperRefresh.disabled = false;

    // Update Badges & UI
    elements.sessionStatusBadge.textContent = `LOGGED IN: ${STATE.username.toUpperCase()}`;
    elements.sessionStatusBadge.className = "session-badge status-logged-in";

    addLog(`Tokens generated successfully:`, 'server');
    addLog(` - Access Token: Issued (lifespan: ${STATE.accessLifespan}s). Placed in localStorage.`, 'server');
    addLog(` - Refresh Token: Issued (lifespan: ${STATE.refreshLifespan}s). Placed in secure HTTP-only Cookie simulation.`, 'server');
    addLog(`HTTP 200 OK. Login Completed!`, 'client');

    updateTimelineUI(2);
    selectTokenForDecoder('access');
}

// PROTECTED API REQUEST COMMAND
function performProtectedRequest(path) {
    if (!STATE.accessToken) {
        addLog(`API Middleware check: Missing token in Authorization Header!`, 'middleware');
        addLog(`HTTP 401 Unauthorized - Access Denied. No bearer token found.`, 'server');
        updateTimelineUI(1);
        return;
    }

    // Parse current access token
    const tokenParts = STATE.accessToken.split('.');
    if (tokenParts.length !== 3) {
        addLog(`API Middleware check: Invalid token format! Expected 3 dotted segments.`, 'middleware');
        addLog(`HTTP 400 Bad Request - Malformed Authorization Token.`, 'server');
        return;
    }

    const [headerB64, payloadB64, signature] = tokenParts;

    // CRYPTOGRAPHIC SIGNATURE CHECK
    addLog(`Middleware verifying token signature...`, 'middleware');
    const computedSignature = simulateSignature(headerB64, payloadB64, STATE.secretKey);

    if (signature !== computedSignature) {
        addLog(`[SECURITY ALERT] Token signature verification failed!`, 'middleware');
        addLog(`  -> Signature in token: "${signature.substring(0, 10)}..."`, 'middleware');
        addLog(`  -> Signature expected:  "${computedSignature.substring(0, 10)}..."`, 'middleware');
        addLog(`HTTP 401 Unauthorized - Access Token has been tampered with or modified!`, 'server');
        return;
    }

    // TIMESTAMP EXPY CHECK
    let payload = {};
    try {
        payload = JSON.parse(b64urlDecode(payloadB64));
    } catch (e) {
        addLog(`API Middleware check: JSON decoding payload failed!`, 'middleware');
        addLog(`HTTP 400 Bad Request`, 'server');
        return;
    }

    const now = Math.floor(Date.now() / 1000);
    addLog(`Middleware verifying claims: Checking expiration time (exp)...`, 'middleware');
    addLog(`  -> Current simulated clock: ${new Date(now * 1000).toLocaleTimeString()}`, 'middleware');
    addLog(`  -> Token expiration claim: ${new Date(payload.exp * 1000).toLocaleTimeString()}`, 'middleware');

    if (now > payload.exp) {
        addLog(`[EXPIRED TOKEN] Verification Failed: Expired by ${now - payload.exp} seconds!`, 'middleware');
        addLog(`HTTP 401 Unauthorized (Access Token Expired)`, 'server');

        // DETAILED AUTO-REFRESH RETRY SIMULATION (Perfect for User's request)
        if (elements.toggleAutoRefresh.checked) {
            addLog(`[Auto-Refresh Engine] Expired token intercepted on 401 response!`, 'client');
            addLog(`[Auto-Refresh Engine] Attempting silent session recovery using Refresh Token...`, 'client');

            // Execute simulated silent refresh
            setTimeout(() => {
                performSilentAutoRefreshRetry(path);
            }, elements.toggleServerDelay.checked ? 600 : 100);
        } else {
            addLog(`Silent Auto-Refresh is DISABLED. User must manually click "Refresh Session" or log in again.`, 'client');
            updateTimelineUI(4);
        }
        return;
    }

    // Success response
    addLog(`Token verification SUCCESS. Subject verified: ${payload.sub} (role: ${payload.role}).`, 'middleware');
    addLog(`GET ${path} - 200 OK. Fetching user profile information...`, 'server');
    addLog(`Success! User Profile Data: { username: "${payload.username}", role: "${payload.role}", status: "Active", timestamp: "${new Date().toISOString()}" }`, 'client');
    updateTimelineUI(3);
}

// SILENT AUTO-REFRESH FLOW (Triggered automatically on 401 Unauthorized)
function performSilentAutoRefreshRetry(originalPath) {
    if (!STATE.refreshToken) {
        addLog(`[Auto-Refresh Engine] Recovery Failed: No Refresh Token found in cookies/localStorage.`, 'client');
        addLog(`[Auto-Refresh Engine] Silent refresh aborted. User must perform forced login.`, 'client');
        updateTimelineUI(5);
        return;
    }

    addLog(`POST /api/refresh - Received token renewal request. Verifying Refresh Token...`, 'server');

    const tokenParts = STATE.refreshToken.split('.');
    if (tokenParts.length !== 3) {
        addLog(`POST /api/refresh - Verification Failed: Malformed refresh token structure.`, 'server');
        addLog(`HTTP 400 Bad Request.`, 'server');
        return;
    }

    const [headerB64, payloadB64, signature] = tokenParts;

    // Check refresh signature
    const computedSignature = simulateSignature(headerB64, payloadB64, STATE.secretKey);
    if (signature !== computedSignature) {
        addLog(`POST /api/refresh - Cryptographic signature check FAILED for Refresh Token!`, 'server');
        addLog(`HTTP 401 Unauthorized - Refresh token signature invalid.`, 'server');
        addLog(`[Auto-Refresh Engine] Recovery failed due to token signature error.`, 'client');
        return;
    }

    // Check refresh expiry
    let payload = {};
    try {
        payload = JSON.parse(b64urlDecode(payloadB64));
    } catch (e) {
        addLog(`POST /api/refresh - JSON decode payload failed!`, 'server');
        addLog(`HTTP 400 Bad Request.`, 'server');
        return;
    }

    const now = Math.floor(Date.now() / 1000);
    if (now > payload.exp) {
        addLog(`POST /api/refresh - Verification Failed: Refresh Token expired at ${new Date(payload.exp * 1000).toLocaleTimeString()}!`, 'server');
        addLog(`HTTP 401 Unauthorized (Refresh Session Expired).`, 'server');
        addLog(`[Auto-Refresh Engine] Silent refresh failed: session fully expired. Forced re-authentication required!`, 'client');

        // Log out immediately
        performLogout();
        updateTimelineUI(5);
        return;
    }

    // Success - Renew Access Token!
    addLog(`POST /api/refresh - Refresh Token verified. Generating new Access Token...`, 'server');

    STATE.accessTokenExpiresAt = now + STATE.accessLifespan;
    const newAccessPayload = {
        sub: payload.sub,
        username: STATE.username,
        role: STATE.role,
        type: "access",
        iat: now,
        exp: STATE.accessTokenExpiresAt
    };

    STATE.accessToken = generateJWT(newAccessPayload, STATE.secretKey);

    // Update Storage UI
    elements.accessTokenInput.value = STATE.accessToken;
    elements.accessLength.textContent = `${STATE.accessToken.length} chars`;
    elements.btnTamperAccess.disabled = false;

    addLog(`HTTP 200 OK. Issued new Access Token (expires in ${STATE.accessLifespan}s).`, 'server');
    addLog(`[Auto-Refresh Engine] New Access Token successfully retrieved and saved!`, 'client');
    addLog(`[Auto-Refresh Engine] Retrying original API request GET ${originalPath}...`, 'client');

    // Retry the original request with the fresh token
    setTimeout(() => {
        performProtectedRequest(originalPath);
        updateTimelineUI(4);
    }, elements.toggleServerDelay.checked ? 500 : 50);
}

// MANUAL REFRESH COMMAND
function performTokenRefresh(isSilent = false) {
    if (!STATE.refreshToken) {
        addLog("POST /api/refresh - No Refresh Token is present in localStorage.", 'server');
        addLog("HTTP 400 Bad Request - Refresh Session empty.", 'server');
        return;
    }

    const tokenParts = STATE.refreshToken.split('.');
    if (tokenParts.length !== 3) {
        addLog("POST /api/refresh - Refresh Token is structurally invalid.", 'server');
        addLog("HTTP 401 Unauthorized", 'server');
        return;
    }

    const [headerB64, payloadB64, signature] = tokenParts;

    // Verify signature
    const computedSignature = simulateSignature(headerB64, payloadB64, STATE.secretKey);
    if (signature !== computedSignature) {
        addLog("POST /api/refresh - Cryptographic signature check FAILED!", 'server');
        addLog("HTTP 401 Unauthorized", 'server');
        return;
    }

    let payload = {};
    try {
        payload = JSON.parse(b64urlDecode(payloadB64));
    } catch (e) {
        addLog("POST /api/refresh - JSON decode payload failed!", 'server');
        addLog("HTTP 400 Bad Request", 'server');
        return;
    }
    const now = Math.floor(Date.now() / 1000);

    if (now > payload.exp) {
        addLog(`POST /api/refresh - Expired refresh token! Expiry time was: ${new Date(payload.exp * 1000).toLocaleTimeString()}`, 'server');
        addLog("HTTP 401 Unauthorized - Refresh Token Expired.", 'server');
        performLogout();
        updateTimelineUI(5);
        return;
    }

    // Refresh successful, issue new access token
    STATE.accessTokenExpiresAt = now + STATE.accessLifespan;
    const accessPayload = {
        sub: payload.sub,
        username: STATE.username,
        role: STATE.role,
        type: "access",
        iat: now,
        exp: STATE.accessTokenExpiresAt
    };

    STATE.accessToken = generateJWT(accessPayload, STATE.secretKey);
    elements.accessTokenInput.value = STATE.accessToken;
    elements.accessLength.textContent = `${STATE.accessToken.length} chars`;
    elements.btnTamperAccess.disabled = false;

    addLog(`POST /api/refresh - Refresh Token verified. Generating new Access Token...`, 'server');
    addLog(`HTTP 200 OK - Access Token refreshed. Expiry in ${STATE.accessLifespan}s.`, 'server');
    addLog("Session refreshed successfully!", 'client');

    updateTimelineUI(4);
    selectTokenForDecoder('access');
}

// LOGOUT COMMAND
function performLogout() {
    // Reset server/session info
    STATE.username = null;
    STATE.role = null;

    // Clear storage variables
    clearTokenState('access');
    clearTokenState('refresh');

    elements.sessionStatusBadge.textContent = "NO ACTIVE SESSION";
    elements.sessionStatusBadge.className = "session-badge status-logged-out";

    addLog("POST /api/logout - session cleared on backend database.", 'server');
    addLog("HTTP 200 OK. Tokens deleted from client storage. Session Terminated.", 'client');

    updateTimelineUI(1);
    updateDecoderUI();
}

function clearTokenState(type) {
    if (type === 'access') {
        STATE.accessToken = null;
        STATE.accessTokenExpiresAt = 0;
        elements.accessTokenInput.value = '';
        elements.accessTimer.textContent = '--:--';
        elements.accessTimer.className = 'token-timer';
        elements.accessStatusBadge.textContent = 'Empty';
        elements.accessStatusBadge.className = 'token-box-status';
        elements.accessLength.textContent = '0 chars';
        elements.btnTamperAccess.disabled = true;
    } else {
        STATE.refreshToken = null;
        STATE.refreshTokenExpiresAt = 0;
        elements.refreshTokenInput.value = '';
        elements.refreshTimer.textContent = '--:--';
        elements.refreshTimer.className = 'token-timer';
        elements.refreshStatusBadge.textContent = 'Empty';
        elements.refreshStatusBadge.className = 'token-box-status';
        elements.refreshLength.textContent = '0 chars';
        elements.btnTamperRefresh.disabled = true;
    }
}

// ----------------- Token Tampering & Editing Engine -----------------

function tamperToken(type) {
    let token = type === 'access' ? STATE.accessToken : STATE.refreshToken;
    if (!token) return;

    const parts = token.split('.');
    if (parts.length !== 3) return;

    let [header, payload, signature] = parts;

    // Break the signature by appending a character or changing it
    signature = signature.slice(0, -4) + "Z9x1";

    const tamperedToken = `${header}.${payload}.${signature}`;

    if (type === 'access') {
        STATE.accessToken = tamperedToken;
        elements.accessTokenInput.value = tamperedToken;
        addSystemLog("[TAMPER ALERT] Access Token signature was altered. API requests will fail verification.");
    } else {
        STATE.refreshToken = tamperedToken;
        elements.refreshTokenInput.value = tamperedToken;
        addSystemLog("[TAMPER ALERT] Refresh Token signature was altered. Renewal requests will fail.");
    }

    syncDecodedTokenDetails(type);
}

// Load token details into variables when user manually writes/pastes/edits inside boxes
function syncDecodedTokenDetails(type) {
    const value = type === 'access' ? STATE.accessToken : STATE.refreshToken;
    const parts = value.split('.');

    if (parts.length === 3) {
        const [headerB64, payloadB64, signature] = parts;
        try {
            const payload = JSON.parse(b64urlDecode(payloadB64));

            // Sync exp timer epoch
            if (payload.exp) {
                if (type === 'access') {
                    STATE.accessTokenExpiresAt = payload.exp;
                } else {
                    STATE.refreshTokenExpiresAt = payload.exp;
                }
            }
        } catch (e) {
            // Decoded content invalid
        }
    }

    selectTokenForDecoder(type);
}

// ----------------- Real-Time Countdown & UI Update Clock -----------------

function startStorageClock() {
    if (STATE.timerIntervalId) clearInterval(STATE.timerIntervalId);

    STATE.timerIntervalId = setInterval(() => {
        const now = Math.floor(Date.now() / 1000);

        // 1. Access Token Timer update
        if (STATE.accessToken) {
            const timeDiff = STATE.accessTokenExpiresAt - now;
            updateTokenTimerUI('access', timeDiff);
        }

        // 2. Refresh Token Timer update
        if (STATE.refreshToken) {
            const timeDiff = STATE.refreshTokenExpiresAt - now;
            updateTokenTimerUI('refresh', timeDiff);
        }
    }, 1000);
}

function updateTokenTimerUI(type, diff) {
    const timerEl = type === 'access' ? elements.accessTimer : elements.refreshTimer;
    const statusEl = type === 'access' ? elements.accessStatusBadge : elements.refreshStatusBadge;
    const boxEl = type === 'access' ? elements.accessTokenBox : elements.refreshTokenBox;
    const tokenVal = type === 'access' ? STATE.accessToken : STATE.refreshToken;

    // Check for signature tampering status before writing active
    const parts = tokenVal.split('.');
    if (parts.length !== 3) {
        timerEl.textContent = "INVALID";
        timerEl.className = "token-timer expired";
        statusEl.textContent = "Invalid JWT Format";
        statusEl.className = "token-box-status tampered";
        boxEl.classList.remove('active');
        return;
    }

    let signatureTampered = false;
    const [header, payload, sig] = parts;
    const expected = simulateSignature(header, payload, STATE.secretKey);
    if (sig !== expected) {
        signatureTampered = true;
    }

    if (signatureTampered) {
        timerEl.textContent = "BAD SIG";
        timerEl.className = "token-timer expired";
        statusEl.textContent = "Invalid Signature";
        statusEl.className = "token-box-status tampered";
        boxEl.classList.remove('active');
        return;
    }

    if (diff > 10) {
        timerEl.textContent = `00:${diff.toString().padStart(2, '0')}`;
        timerEl.className = "token-timer";
        statusEl.textContent = "Active & Valid";
        statusEl.className = "token-box-status active";
        boxEl.classList.add('active');
    } else if (diff > 0) {
        timerEl.textContent = `00:${diff.toString().padStart(2, '0')}`;
        timerEl.className = "token-timer expiring";
        statusEl.textContent = "Expiring Soon";
        statusEl.className = "token-box-status expiring";
        boxEl.classList.add('active');
    } else {
        timerEl.textContent = "EXPIRED";
        timerEl.className = "token-timer expired";
        statusEl.textContent = "Expired";
        statusEl.className = "token-box-status expired";
        boxEl.classList.remove('active');
    }
}

// ----------------- Interactive Decoder Tab Linking -----------------

function selectTokenForDecoder(type) {
    STATE.selectedTokenForDecoder = type;

    // Highlight selected box border
    if (type === 'access') {
        elements.accessTokenBox.style.borderColor = "rgba(6, 182, 212, 0.5)";
        elements.refreshTokenBox.style.borderColor = "rgba(255, 255, 255, 0.08)";
    } else {
        elements.accessTokenBox.style.borderColor = "rgba(255, 255, 255, 0.08)";
        elements.refreshTokenBox.style.borderColor = "rgba(192, 132, 252, 0.5)";
    }

    updateDecoderUI();
}

function updateDecoderUI() {
    const activeToken = STATE.selectedTokenForDecoder === 'access' ? STATE.accessToken : STATE.refreshToken;

    if (!activeToken) {
        // Fallback display if storage empty
        elements.partHeader.textContent = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
        elements.partPayload.textContent = "eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ";
        elements.partSignature.textContent = "SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

        elements.decodedHeaderJson.textContent = JSON.stringify({ alg: "HS256", typ: "JWT" }, null, 2);
        elements.decodedPayloadJson.textContent = JSON.stringify({ sub: "no_active_session", info: "Click login to generate real tokens" }, null, 2);
        elements.decodedSignatureRaw.textContent = `HMACSHA256(\n  base64UrlEncode(header) + "." +\n  base64UrlEncode(payload),\n  "${STATE.secretKey}"\n)`;
        return;
    }

    const parts = activeToken.split('.');
    if (parts.length !== 3) {
        elements.partHeader.textContent = "INVALID";
        elements.partPayload.textContent = "INVALID";
        elements.partSignature.textContent = "INVALID";
        elements.decodedHeaderJson.textContent = "Error: Invalid JWT structure.\nMust contain 3 parts separated by dots (header.payload.signature).";
        elements.decodedPayloadJson.textContent = "Error: Invalid JWT structure.\nMust contain 3 parts separated by dots (header.payload.signature).";
        elements.decodedSignatureRaw.textContent = "Error: Cannot verify signature of an invalid JWT structure.";
        return;
    }

    const [headerB64, payloadB64, signature] = parts;

    elements.partHeader.textContent = headerB64;
    elements.partPayload.textContent = payloadB64;
    elements.partSignature.textContent = signature;

    // Decode header
    try {
        const decodedHeader = JSON.parse(b64urlDecode(headerB64));
        elements.decodedHeaderJson.textContent = JSON.stringify(decodedHeader, null, 2);
    } catch (e) {
        elements.decodedHeaderJson.textContent = "Error: Invalid JSON Header!";
    }

    // Decode payload
    try {
        const decodedPayload = JSON.parse(b64urlDecode(payloadB64));
        elements.decodedPayloadJson.textContent = JSON.stringify(decodedPayload, null, 2);
    } catch (e) {
        elements.decodedPayloadJson.textContent = "Error: Invalid JSON Payload!";
    }

    // Signature formula
    elements.decodedSignatureRaw.textContent = `HMACSHA256(\n  base64UrlEncode(header) + "." +\n  base64UrlEncode(payload),\n  "${STATE.secretKey}"\n) // Signature: ${signature.substring(0, 12)}...`;
}

// ----------------- Interactive Timeline Stages -----------------

function updateTimelineUI(activeStepNum) {
    elements.steps.forEach(step => {
        const stepNum = parseInt(step.getAttribute('data-step'));
        step.classList.remove('active', 'completed');

        if (stepNum === activeStepNum) {
            step.classList.add('active');
        } else if (stepNum < activeStepNum) {
            step.classList.add('completed');
        }
    });
}

// Start app
window.onload = init;
