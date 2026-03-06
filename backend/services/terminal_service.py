import os
import sys
import threading
import queue
import shutil
import signal
import array
import subprocess
import codecs

# Platform-specific imports
try:
    if os.name == "nt":
        from winpty import PtyProcess as WinPtyProcess
        PTY_AVAILABLE = True
    else:
        import pty
        import termios
        import tty
        import fcntl
        PTY_AVAILABLE = True
except ImportError:
    PTY_AVAILABLE = False
    # Define mocks for fcntl/termios for linting if desired, but try block handles runtime

class ShellSession:
    def __init__(self):
        self.process = None
        self.out_queue = queue.Queue(maxsize=10000)
        self.running = False
        self.thread = None
        self.lock = threading.Lock()
        self.fd = None
        self.process_pid = None
        self.on_data = None

    def start(self, cwd=None, cols=80, rows=24, on_data=None):
        with self.lock:
            if self.running:
                self.stop()

            if cwd is None or not os.path.isdir(cwd):
                cwd = os.getcwd()

            self.on_data = on_data
            env = os.environ.copy()
            env["TERM"] = "xterm-256color"
            env["COLORTERM"] = "truecolor"
            # Ensure Python uses UTF-8 for IO
            env["PYTHONIOENCODING"] = "utf-8"

            try:
                if os.name == "nt":
                    # For Windows using pywinpty (WinPtyProcess)
                    shell = "powershell.exe" if shutil.which("powershell.exe") else "cmd.exe"
                    try:
                        self.process = WinPtyProcess.spawn(
                            shell,
                            cwd=cwd,
                            env=env,
                            dimensions=(rows, cols)
                        )
                        self.fd = self.process.fd
                    except Exception as e:
                        print(f"[ShellSession] WinPty spawn failed: {e}")
                        return False
                else:
                    # For Unix using built-in pty
                    shell = os.environ.get("SHELL", "/bin/bash")
                    
                    self.process_pid, self.fd = pty.fork()
                    if self.process_pid == 0:  # Child process
                        os.chdir(cwd)
                        # Set terminal size
                        winsize = array.array("h", [rows, cols, 0, 0])
                        fcntl.ioctl(sys.stdout.fileno(), termios.TIOCSWINSZ, winsize)
                        os.execvpe(shell, [shell], env)
                    
                self.running = True
                self.thread = threading.Thread(target=self._read_output, daemon=True)
                self.thread.start()
                return True
            except Exception as e:
                print(f"[ShellSession] Start failed: {e}")
                import traceback
                traceback.print_exc()
                return False

    def _read_output(self):
        decoder = codecs.getincrementaldecoder("utf-8")(errors="replace")
        
        while self.running:
            try:
                if os.name == "nt":
                    # winpty.read() returns a string (already decoded)
                    if not self.process:
                        break
                    data_str = self.process.read(8192)
                    if data_str:
                        if self.on_data:
                            self.on_data(data_str)
                        # We store as bytes for the polling read fallback
                        self.out_queue.put(data_str.encode("utf-8"))
                    else:
                        break
                else:
                    data_bytes = os.read(self.fd, 8192)
                    if data_bytes:
                        # Use incremental decoder for smooth UTF-8 handling
                        data_str = decoder.decode(data_bytes)
                        if self.on_data:
                            self.on_data(data_str)
                        self.out_queue.put(data_bytes)
                    else:
                        break
            except (EOFError, OSError, Exception) as e:
                print(f"[ShellSession] Read thread exit: {e}")
                break
        
        # Flush decoder at the end if needed
        if os.name != "nt":
            try:
                last = decoder.decode(b"", final=True)
                if last and self.on_data:
                    self.on_data(last)
            except:
                pass
                
        self.running = False

    def write(self, data):
        if self.running:
            try:
                if os.name == "nt":
                    self.process.write(data)
                else:
                    os.write(self.fd, data.encode("utf-8"))
            except Exception as e:
                print(f"[ShellSession] Write failed: {e}")

    def read(self):
        output = b""
        try:
            # Drain the queue
            while not self.out_queue.empty():
                output += self.out_queue.get_nowait()
        except queue.Empty:
            pass
        
        if not output:
            return ""
        
        return output.decode("utf-8", errors="replace")

    def resize(self, cols, rows):
        if self.running:
            try:
                if os.name == "nt":
                    # For winpty.PtyProcess, it's setwinsize(rows, cols)
                    if hasattr(self.process, 'setwinsize'):
                        self.process.setwinsize(rows, cols)
                    elif hasattr(self.process, 'resize'):
                        self.process.resize(cols, rows)
                    elif hasattr(self.process, 'set_size'):
                        self.process.set_size(rows, cols)
                else:
                    winsize = array.array("h", [rows, cols, 0, 0])
                    fcntl.ioctl(self.fd, termios.TIOCSWINSZ, winsize)
            except Exception as e:
                print(f"[ShellSession] Resize failed: {e}")

    def stop(self):
        self.running = False
        with self.lock:
            if os.name == "nt":
                if self.process:
                    try:
                        self.process.close()
                    except Exception:
                        pass
                    self.process = None
            else:
                if self.fd:
                    try:
                        os.close(self.fd)
                    except Exception:
                        pass
                    self.fd = None
                if hasattr(self, 'process_pid') and self.process_pid:
                    try:
                        os.kill(self.process_pid, signal.SIGTERM)
                    except Exception:
                        pass
                    self.process_pid = None

# Global manager
class TerminalManager:
    def __init__(self):
        self.sessions = {}

    def get_session(self, session_id):
        if session_id not in self.sessions:
            self.sessions[session_id] = ShellSession()
        return self.sessions[session_id]

    def stop_all(self):
        for s in self.sessions.values():
            s.stop()
        self.sessions.clear()

terminal_manager = TerminalManager()
