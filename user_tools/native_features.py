from langchain_core.tools import tool
import subprocess
import platform

@tool
def check_internet_speed() -> str:
    """Checks the internet connection speed (Ping to Google DNS)."""
    param = '-n' if platform.system().lower() == 'windows' else '-c'
    command = ['ping', param, '1', '8.8.8.8']
    
    try:
        response = subprocess.run(command, capture_output=True, text=True)
        if response.returncode == 0:
            return "Internet is reachable. Ping successful."
        else:
            return "Internet seems down. Ping failed."
    except Exception as e:
        return f"Error checking internet: {e}"

@tool
def text_to_speech(text: str) -> str:
    """The agent speaks the text out loud using the system's text-to-speech engine. 
    Use this to announce completion of tasks or give verbal notifications."""
    try:
        if platform.system() == 'Windows':
            # Use PowerShell for native TTS without extra pip deps
            ps_script = f"Add-Type –AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).Speak('{text.replace("'", "''")}')"
            subprocess.Popen(["powershell", "-c", ps_script])
            return f"Spoke: '{text}'"
        elif platform.system() == 'Darwin': # Mac
            subprocess.Popen(["say", text])
            return f"Spoke: '{text}'"
        else:
            return "Text-to-speech not supported on this OS without pyttsx3."
    except Exception as e:
        return f"Error speaking: {e}"
