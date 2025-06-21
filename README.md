# Diffly

A GitHub-like Git preview tool that opens repository diffs in your browser.

<img width="1726" alt="image" src="https://github.com/user-attachments/assets/e4cc7db2-f430-4042-bc72-1cff0ecf1554" />


## Installation

### Global Installation from NPM (Recommended)
```bash
npm install -g diffly
```

### Or install locally for development
```bash
git clone https://github.com/shugar/diffly.git
cd diffly
npm install
npm start
```

## Usage

1. Navigate to any Git repository in your terminal:
```bash
cd /path/to/your/git/project
```

2. Run Diffly:
```bash
diffly
```

3. The tool will automatically:
   - Start a local web server
   - Open your browser to view the Git preview
   - Display uncommitted changes, repository status, and commit history

## Features

- **Changes Tab**: View uncommitted changes with before/after diff visualization
- **Status Tab**: See modified, added, deleted, and untracked files
- **History Tab**: Browse recent commit history
- **GitHub-like UI**: Dark theme interface similar to GitHub
- **Real-time**: Live updates as you make changes to your repository

## CLI Options

- `-p, --port <port>`: Specify the port to run the server on (default: 3000)

Example:
```bash
diffly --port 8080
```

## Requirements

- Node.js 14.0.0 or higher
- A Git repository (must contain a .git folder)

## How it works

1. Diffly detects the .git folder in your current directory
2. Starts an Express server with API endpoints for Git operations
3. Serves a web interface that calls these APIs to display Git information
4. Automatically opens your browser to the preview page

## Keyboard Shortcuts

- `Ctrl+C` (or `Cmd+C` on Mac): Stop the server
