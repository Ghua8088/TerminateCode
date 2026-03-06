import os
import subprocess
import sys

def get_subprocess_kwargs():
    kwargs = {}
    if os.name == "nt":
        startupinfo = subprocess.STARTUPINFO()
        startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        kwargs["startupinfo"] = startupinfo
        kwargs["creationflags"] = subprocess.CREATE_NO_WINDOW
    return kwargs

def register_utils_routes(app):
    
    @app.expose
    def test_regex(pattern, text, flags=0):
        """Test a regex pattern against text using Python's re module."""
        import re

        try:
            matches = []
            for m in re.finditer(pattern, text, flags):
                matches.append(
                    {
                        "start": m.start(),
                        "end": m.end(),
                        "match": m.group(),
                        "groups": m.groups(),
                        "groupdict": m.groupdict(),
                    }
                )
            return {"success": True, "matches": matches}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @app.expose
    def install_package(package_name):
        """Install a package using pip."""
        try:
            subprocess.check_call(
                [sys.executable, "-m", "pip", "install", package_name],
                **get_subprocess_kwargs(),
            )
            return {"success": True}
        except subprocess.CalledProcessError as e:
            return {"success": False, "error": str(e)}
        except Exception as e:
            return {"success": False, "error": str(e)}
