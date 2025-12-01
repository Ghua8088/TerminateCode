<p align="center">
  <img src="favicon.png" alt="TerminateCode Logo" width="128" />
</p>

# TerminateCode 💻
<p align="center">
  <img src="example.png" alt="TerminateCode Screenshot" />
</p>
**An experimental, lightweight IDE built with [Pytron](https://github.com/Ghua8088/pytron).**

TerminateCode is a proof-of-concept IDE that aims to provide a VS Code-like experience using the power of Python and Web Technologies. It's currently a work in progress, slowly coming together, but it demonstrates the capabilities of the Pytron framework for building complex desktop applications.

> ⚠️ **Note:** This project is in early development. Expect bugs, missing features, and general chaos. It's not the best yet, but we're getting there!

## Why Pytron?

TerminateCode is built entirely using **Pytron**, leveraging:
- **Python Backend**: For file system operations, terminal management, and language server interactions.
- **React Frontend**: For a responsive, modern editor interface (using Monaco Editor).
- **Native Performance**: No heavy browser bundle, just a lightweight webview.

## Features (Current & Planned)

- [x] 📝 **Text Editing**: Powered by Monaco Editor (same as VS Code).
- [ ] 📂 **File Explorer**: Native file system navigation.
- [ ] 🖥️ **Integrated Terminal**: Run commands directly within the IDE.
- [ ] 🧩 **Extensions**: (Future goal) Python-based extension system.
- [ ] 🎨 **Theming**: Dark mode by default (obviously).

## Getting Started

### Prerequisites

- Python 3.7+
- Node.js & npm

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/TerminateCode.git
    cd TerminateCode
    ```

2.  **Install Python dependencies**
    ```bash
    pip install -r requirements.txt
    ```

3.  **Install Frontend dependencies**
    ```bash
    cd frontend
    npm install
    cd ..
    ```

### Running the App

Start the application in development mode. This enables **hot-reloading**, so the app automatically restarts whenever you change your Python code:

```bash
pytron run --dev
```

## Packaging & Releases

Creating a production-ready installer is incredibly simple with Pytron. It uses **NSIS** to bundle everything into a standalone executable installer.

```bash
pytron package --installer
```

This command generates a professional Windows installer (setup.exe) in the base project ready for distribution.

## Structure

- `app.py`: Main application logic and backend API.
- `frontend/`: React application containing the UI and editor components.
- `settings.json`: Pytron configuration file.

---

*Built with ❤️ and [Pytron](https://github.com/Ghua8088/pytron).*