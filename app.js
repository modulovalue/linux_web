// Global state
let editor = null;
let emulator = null;
let isReady = false;

const defaultScript = `#!/bin/bash
echo "Hello from WebAssembly Linux!"
echo "Date: $(date)"
echo "System: $(uname -a)"
echo ""
echo "Files in root:"
ls -la /
`;

// Initialize Monaco Editor
function initMonaco() {
    return new Promise((resolve) => {
        require.config({
            paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' }
        });

        require(['vs/editor/editor.main'], function () {
            editor = monaco.editor.create(document.getElementById('editor'), {
                value: defaultScript,
                language: 'shell',
                theme: 'vs-dark',
                fontSize: 14,
                fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                padding: { top: 10 },
            });

            editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, runScript);
            resolve();
        });
    });
}

// Initialize v86 emulator with 9p filesystem
function initEmulator() {
    updateStatus('Booting Linux (~30-45s)...', 'loading');

    emulator = new V86({
        wasm_path: "v86.wasm",
        memory_size: 64 * 1024 * 1024,
        vga_memory_size: 2 * 1024 * 1024,
        screen_container: document.getElementById("screen_container"),
        bios: { url: "seabios.bin" },
        vga_bios: { url: "vgabios.bin" },
        cdrom: { url: "linux4.iso" },
        autostart: true,
    });

    return new Promise((resolve) => {
        let checkCount = 0;

        const bootCheck = setInterval(() => {
            checkCount++;

            if (emulator.is_running()) {
                updateStatus(`Booting Linux... (${checkCount}s)`, 'loading');
            }

            if (checkCount >= 30) {
                clearInterval(bootCheck);
                isReady = true;
                updateStatus('Ready', 'ready');
                document.getElementById('runBtn').disabled = false;
                resolve();
            }
        }, 1000);
    });
}

function updateStatus(text, className = '') {
    const status = document.getElementById('status');
    status.textContent = text;
    status.className = 'status ' + className;
}

// Send a single Enter key
function sendEnter() {
    emulator.keyboard_send_scancodes([0x1C, 0x9C]);
}

// Send text character by character
async function sendText(text) {
    for (const char of text) {
        if (char === '\n') {
            sendEnter();
        } else {
            emulator.keyboard_send_text(char);
        }
        await new Promise(r => setTimeout(r, 15));
    }
}

// Run script by sending commands line by line
async function runScript() {
    if (!emulator || !isReady) return;

    const script = editor.getValue();
    const runBtn = document.getElementById('runBtn');

    runBtn.disabled = true;
    updateStatus('Running...', 'running');

    try {
        // Send Enter to ensure we're at prompt
        sendEnter();
        await new Promise(r => setTimeout(r, 400));

        // Clear any previous script
        await sendText("rm -f /tmp/s.sh\n");
        await new Promise(r => setTimeout(r, 300));

        // Write script line by line using echo
        const lines = script.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Escape single quotes and special chars for echo
            const escaped = line.replace(/'/g, "'\\''");
            const op = i === 0 ? '>' : '>>';
            await sendText(`echo '${escaped}' ${op} /tmp/s.sh\n`);
            await new Promise(r => setTimeout(r, 150));
        }

        await new Promise(r => setTimeout(r, 300));

        // Run the script
        await sendText("sh /tmp/s.sh\n");

    } catch (e) {
        console.error('Error:', e);
    } finally {
        runBtn.disabled = false;
        updateStatus('Ready', 'ready');
    }
}

// Clear terminal
async function clearTerminal() {
    if (emulator) {
        await sendText('clear\n');
    }
}

// Init
async function init() {
    try {
        updateStatus('Loading editor...', 'loading');
        await initMonaco();
        await initEmulator();

        document.getElementById('runBtn').addEventListener('click', runScript);
        document.getElementById('clearBtn').addEventListener('click', clearTerminal);

    } catch (error) {
        console.error(error);
        updateStatus('Error: ' + error.message, 'error');
    }
}

window.addEventListener('DOMContentLoaded', init);
