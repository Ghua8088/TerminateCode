import os
import threading
import queue
import subprocess
import sys

# Cross-platform PTY abstraction
Spawn = None
if os.name == 'nt':
    try:
        from winpty import PtyProcess as WinSpawn
        Spawn = WinSpawn
    except ImportError:
        try:
            from pexpect.popen_spawn import PopenSpawn
            Spawn = PopenSpawn
        except ImportError:
            pass
else:
    try:
        from pexpect import spawn as PexpectSpawn
        Spawn = PexpectSpawn
    except ImportError:
        pass

class TerminalSession:
    def __init__(self, id):
        self.id = id
        self.child = None
        self.proc = None
        self.thread = None
        self.running = False
        self.output_queue = queue.Queue()
        self.on_data_cb = None
        self.history_buffer = []

    def start(self, cwd=None, cols=80, rows=24, on_data=None):
        print(f"[Terminal] Starting session {self.id} (cwd={cwd}, {cols}x{rows})")
        self.stop()
        self.on_data_cb = on_data
        self.running = True
        
        if cwd is None:
            cwd = os.getcwd()
            
        if os.name == 'nt':
            shell = os.environ.get('COMSPEC', 'cmd.exe')
        else:
            shell = os.environ.get('SHELL', '/bin/bash')
            
        print(f"[Terminal] Spawning shell: {shell}")
        
        if Spawn:
            try:
                # Standard pexpect-like API for spawning
                if os.name == 'nt' and hasattr(Spawn, 'spawn'):
                    # winpty.PtyProcess.spawn
                    self.child = Spawn.spawn([shell], cwd=cwd, dimensions=(rows, cols))
                else:
                    # pexpect.spawn or PopenSpawn
                    self.child = Spawn(shell, cwd=cwd, encoding='utf-8', dimensions=(rows, cols))
                
                self.thread = threading.Thread(target=self._read_loop, daemon=True)
                self.thread.start()
                print(f"[Terminal] PTY process started successfully.")
                return
            except Exception as e:
                print(f"[Terminal] PTY spawn failed: {e}")
        
        # Fallback to standard subprocess
        print(f"[Terminal] Falling back to standard subprocess (No PTY)")
        self._fallback_start(shell, cwd)

    def _fallback_start(self, shell, cwd):
        try:
            self.proc = subprocess.Popen(
                [shell],
                cwd=cwd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=0
            )
            self.thread = threading.Thread(target=self._proc_read_loop, daemon=True)
            self.thread.start()
            print(f"[Terminal] Fallback subprocess started.")
        except Exception as e:
            print(f"[Terminal] Fallback start failed: {e}")
            self.running = False

    def _read_loop(self):
        print(f"[Terminal] Read loop started for {self.id}")
        while self.running and self.child:
            try:
                # Check for pexpect-style read_nonblocking first
                if hasattr(self.child, 'read_nonblocking'):
                    # Use small timeout for responsiveness
                    data = self.child.read_nonblocking(size=4096, timeout=0.1)
                else:
                    # winpty.PtyProcess or PopenSpawn might use read()
                    # We assume it supports some form of non-blocking or we block in the thread
                    data = self.child.read()
                
                if data:
                    # Ensure data is string
                    if isinstance(data, bytes):
                        data = data.decode('utf-8', 'replace')
                    
                    self.history_buffer.append(data)
                    if len(self.history_buffer) > 1000:
                        self.history_buffer.pop(0)

                    if callable(self.on_data_cb):
                        self.on_data_cb(data)
                    self.output_queue.put(data)
                else:
                    # If empty but not EOF, avoid tight loop if non-blocking
                    import time
                    time.sleep(0.05)
                    
            except Exception as e:
                # Handle EOF/TIMEOUT exceptions properly if they are from pexpect
                import pexpect
                if isinstance(e, pexpect.TIMEOUT):
                    continue
                elif isinstance(e, pexpect.EOF):
                    print(f"[Terminal] EOF reached for {self.id}")
                    break
                else:
                    print(f"[Terminal] Read error for {self.id}: {e}")
                    break
        self.running = False
        print(f"[Terminal] Read loop ended for {self.id}")

    def _proc_read_loop(self):
        while self.running and self.proc and self.proc.stdout:
            try:
                line = self.proc.stdout.read(1024)
                if not line:
                    break
                    
                self.history_buffer.append(line)
                if len(self.history_buffer) > 1000:
                    self.history_buffer.pop(0)

                if callable(self.on_data_cb):
                    self.on_data_cb(line)
                self.output_queue.put(line)
            except Exception:
                break
        self.running = False

    def write(self, data):
        if self.child:
            try:
                # Both winpty.PtyProcess and pexpect have write/send
                if hasattr(self.child, 'write'):
                    self.child.write(data)
                else:
                    self.child.send(data)
            except Exception as e:
                print(f"[Terminal] Write error: {e}")
        elif self.proc and self.proc.stdin:
            try:
                self.proc.stdin.write(data)
                self.proc.stdin.flush()
            except Exception as e:
                print(f"[Terminal] Fallback write error: {e}")

    def resize(self, cols, rows):
        if self.child:
            try:
                if hasattr(self.child, 'setwinsize'):
                    self.child.setwinsize(rows, cols)
                elif hasattr(self.child, 'resize'):
                    self.child.resize(cols, rows)
            except Exception as e:
                print(f"[Terminal] Resize error: {e}")

    def read(self):
        content = ""
        while not self.output_queue.empty():
            content += self.output_queue.get()
        return content

    def stop(self):
        self.running = False
        if self.child:
            try:
                if hasattr(self.child, 'close'):
                    self.child.close()
                elif hasattr(self.child, 'terminate'):
                    self.child.terminate(force=True)
                elif hasattr(self.child, 'kill'):
                    self.child.kill()
            except Exception:
                pass
            self.child = None
        if self.proc:
            try:
                self.proc.terminate()
            except Exception:
                pass
            self.proc = None

    def get_recent_history(self, lines=50):
        # We need to peek at the output queue or maintain a rolling buffer
        # Let's add a small history buffer to the terminal session
        if not hasattr(self, 'history_buffer'):
            return ""
        return "".join(self.history_buffer[-lines:])

class TerminalManager:
    def __init__(self):
        self.sessions = {}

    def get_session(self, session_id):
        if session_id not in self.sessions:
            self.sessions[session_id] = TerminalSession(session_id)
        return self.sessions[session_id]

terminal_manager = TerminalManager()
