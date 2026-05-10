from langchain_core.tools import tool
import platform
import subprocess
import json
import os
import ctypes
import sys

@tool
def get_clipboard() -> str:
    """Reads the current text content of the system clipboard."""
    try:
        if platform.system() == 'Windows':
            # Use PowerShell to get clipboard (reliable, native)
            cmd = 'powershell -command "Get-Clipboard"'
            result = subprocess.run(cmd, capture_output=True, text=True, shell=True)
            return result.stdout.strip()
        elif platform.system() == 'Darwin': # Mac
            cmd = 'pbpaste'
            result = subprocess.run(cmd, capture_output=True, text=True, shell=True)
            return result.stdout.strip()
        else: # Linux (try xclip or xsel)
            try:
                return subprocess.check_output(['xclip', '-selection', 'clipboard', '-o'], text=True)
            except:
                return "Clipboard access requires xclip on Linux."
    except Exception as e:
        return f"Error reading clipboard: {e}"

@tool
def set_clipboard(text: str) -> str:
    """Writes text to the system clipboard."""
    try:
        if platform.system() == 'Windows':
            # Escape single quotes for PowerShell
            safe_text = text.replace("'", "''")
            cmd = f'powershell -command "Set-Clipboard -Value \'{safe_text}\'"'
            subprocess.run(cmd, shell=True)
        elif platform.system() == 'Darwin':
            process = subprocess.Popen('pbcopy', env={'LANG': 'en_US.UTF-8'}, stdin=subprocess.PIPE)
            process.communicate(text.encode('utf-8'))
        return "Clipboard updated."
    except Exception as e:
        return f"Error setting clipboard: {e}"

@tool
def system_notify(title: str, message: str) -> str:
    """Sends a native system notification (Toast)."""
    try:
        if platform.system() == 'Windows':
            # PowerShell balloon tip (Zero external dependencies)
            ps_script = f"""
            [void] [System.Reflection.Assembly]::LoadWithPartialName("System.Windows.Forms")
            $objNotifyIcon = New-Object System.Windows.Forms.NotifyIcon
            $objNotifyIcon.Icon = [System.Drawing.SystemIcons]::Information
            $objNotifyIcon.Visible = $True
            $objNotifyIcon.ShowBalloonTip(1000, "{title}", "{message}", "Info")
            """
            subprocess.Popen(["powershell", "-c", ps_script])
        elif platform.system() == 'Darwin':
            script = f'display notification "{message}" with title "{title}"'
            subprocess.run(['osascript', '-e', script])
        return f"Notification sent: {title}"
    except Exception as e:
        return f"Error sending notification: {e}"

@tool
def open_in_app(filepath: str) -> str:
    """Opens a file in the default OS application (e.g. opens PDF in Acrobat, PNG in Photos)."""
    try:
        if platform.system() == 'Windows':
            os.startfile(filepath)
        elif platform.system() == 'Darwin':
            subprocess.call(('open', filepath))
        else:
            subprocess.call(('xdg-open', filepath))
        return f"Opened {filepath}"
    except Exception as e:
        return f"Error opening file: {e}"
