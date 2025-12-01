import React, { useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Trash2, X } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';
import pytron from 'pytron-client';

const TerminalPanel = ({ onClose, pendingCommand, onCommandHandled }) => {
    const terminalRef = useRef(null);
    const xtermRef = useRef(null);
    const bufferRef = useRef('');

    // Function to execute command programmatically
    const executeCommand = useCallback(async (cmd) => {
        const term = xtermRef.current;
        if (!term) return;

        term.writeln(cmd); // Echo command

        try {
            const result = await pytron.run_command(cmd, null);
            if (result.success) {
                if (result.stdout) term.write(result.stdout.replace(/\n/g, '\r\n'));
                if (result.stderr) term.write(result.stderr.replace(/\n/g, '\r\n'));
            } else {
                term.write(`Error: ${result.error}\r\n`);
            }
        } catch (err) {
            term.write(`Execution failed: ${err}\r\n`);
        }
        term.write('$ ');
    }, []);

    const handleClear = () => {
        if (xtermRef.current) {
            xtermRef.current.clear();
            xtermRef.current.write('$ ');
        }
    };

    useEffect(() => {
        if (pendingCommand) {
            executeCommand(pendingCommand);
            onCommandHandled();
        }
    }, [pendingCommand, onCommandHandled, executeCommand]);

    useEffect(() => {
        if (!terminalRef.current) return;

        const term = new Terminal({
            cursorBlink: true,
            theme: {
                background: '#1e1e1e',
                foreground: '#cccccc',
            },
            fontSize: 14,
            fontFamily: 'Consolas, "Courier New", monospace',
            rows: 10,
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(terminalRef.current);
        fitAddon.fit();

        xtermRef.current = term;

        term.writeln('Welcome to Simple-IDE Terminal');
        term.write('$ ');

        term.onData(async (data) => {
            const code = data.charCodeAt(0);

            if (code === 13) { // Enter
                term.write('\r\n');
                const command = bufferRef.current.trim();
                bufferRef.current = '';

                if (command) {
                    try {
                        const result = await pytron.run_command(command, null);
                        if (result.success) {
                            if (result.stdout) term.write(result.stdout.replace(/\n/g, '\r\n'));
                            if (result.stderr) term.write(result.stderr.replace(/\n/g, '\r\n'));
                        } else {
                            term.write(`Error: ${result.error}\r\n`);
                        }
                    } catch (err) {
                        term.write(`Execution failed: ${err}\r\n`);
                    }
                }
                term.write('$ ');
            } else if (code === 127) { // Backspace
                if (bufferRef.current.length > 0) {
                    bufferRef.current = bufferRef.current.slice(0, -1);
                    term.write('\b \b');
                }
            } else {
                bufferRef.current += data;
                term.write(data);
            }
        });

        const handleResize = () => fitAddon.fit();
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            term.dispose();
        };
    }, []);

    return (
        <div style={{ height: '100px', minHeight: '100px', background: '#1e1e1e', borderTop: '1px solid #333', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '4px 8px', background: '#252526', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold' }}>TERMINAL</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <Trash2 size={14} style={{ cursor: 'pointer', color: '#ccc' }} onClick={handleClear} title="Clear Terminal" />
                    <X size={14} style={{ cursor: 'pointer', color: '#ccc' }} onClick={onClose} title="Close Panel" />
                </div>
            </div>
            <div ref={terminalRef} style={{ flex: 1, overflow: 'hidden' }} />
        </div>
    );
};

export default TerminalPanel;
