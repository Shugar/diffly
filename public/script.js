class GitPreview {
  constructor() {
    this.currentFile = null;
    this.currentFileIndex = 0;
    this.files = [];
    this.init();
  }

  init() {
    this.setupNavigation();
    this.setupFileNavigation();
    this.loadInitialData();
  }

  setupNavigation() {
    const navButtons = document.querySelectorAll(".nav-btn");
    navButtons.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const tab = e.target.dataset.tab;
        this.switchTab(tab);
      });
    });
  }

  setupFileNavigation() {
    // File navigation will be set up when files are loaded
  }

  switchTab(activeTab) {
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.classList.remove("active");
    });
    document.querySelectorAll(".tab-content").forEach((content) => {
      content.classList.remove("active");
    });

    const activeButton = document.querySelector(`[data-tab="${activeTab}"]`);
    const activeTabContent = document.getElementById(`${activeTab}-tab`);

    if (activeButton) activeButton.classList.add("active");
    if (activeTabContent) activeTabContent.classList.add("active");

    // Load content for the selected tab
    if (activeTab === "diff") {
      // Diff is already loaded, just make sure it's displayed
      if (!this.files || this.files.length === 0) {
        this.loadDiff();
      }
    } else if (activeTab === "status") {
      this.loadStatus();
    } else if (activeTab === "history") {
      this.loadHistory();
    }
  }

  async loadInitialData() {
    this.showLoading();
    await this.loadDiff();
    this.hideLoading();
  }

  showLoading() {
    document.getElementById("loading").style.display = "block";
  }

  hideLoading() {
    document.getElementById("loading").style.display = "none";
  }

  async loadDiff() {
    try {
      const response = await fetch("/api/diff");
      const data = await response.json();

      if (data.error) {
        this.showError("diff-content", data.error);
        return;
      }

      this.renderDiff(data.diff);
    } catch (error) {
      this.showError("diff-content", "Failed to load diff: " + error.message);
    }
  }

  async loadStatus() {
    try {
      const response = await fetch("/api/status");
      const data = await response.json();

      if (data.error) {
        this.showError("status-content", data.error);
        return;
      }

      this.renderStatus(data);
    } catch (error) {
      this.showError(
        "status-content",
        "Failed to load status: " + error.message
      );
    }
  }

  async loadHistory() {
    try {
      const response = await fetch("/api/log");
      const data = await response.json();

      if (data.error) {
        this.showError("history-content", data.error);
        return;
      }

      this.renderHistory(data);
    } catch (error) {
      this.showError(
        "history-content",
        "Failed to load history: " + error.message
      );
    }
  }

  renderDiff(diffText) {
    const container = document.getElementById("diff-content");
    const fileListContainer = document.getElementById("file-list");
    const fileCountElement = document.getElementById("file-count");

    if (!diffText || diffText.trim() === "") {
      container.innerHTML =
        '<div class="empty-state">No changes to display</div>';
      fileListContainer.innerHTML =
        '<div class="empty-state" style="padding: 20px; font-size: 12px;">No files changed</div>';
      fileCountElement.textContent = "0";
      return;
    }

    this.files = this.parseDiff(diffText);
    this.renderFileList();
    this.renderAllFiles();
    this.setupScrollObserver();
  }

  parseDiff(diffText) {
    const files = [];
    const lines = diffText.split("\n");
    let currentFile = null;
    let currentHunk = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith("diff --git")) {
        // Finalize previous file if it exists
        if (currentFile) {
          // Finalize any current hunk first
          if (
            currentHunk &&
            currentHunk.lines &&
            currentHunk.lines.length > 0
          ) {
            currentFile.hunks.push(currentHunk);
          }
          files.push(currentFile);
        }

        // Handle both prefixed and non-prefixed diffs
        const match =
          line.match(/diff --git (?:a\/)?(.+) (?:b\/)?(.+)/) ||
          line.match(/diff --git (.+) (.+)/);
        currentFile = {
          name: match ? match[1] : "unknown",
          hunks: [],
          addedLines: 0,
          removedLines: 0,
        };
        currentHunk = null;
      } else if (line.startsWith("@@")) {
        if (currentHunk && currentHunk.lines && currentHunk.lines.length > 0) {
          currentFile.hunks.push(currentHunk);
        }
        // More flexible regex to handle the hunk header
        const hunkMatch = line.match(/@@ -(\d+),?(\d+)? \+(\d+),?(\d+)? @@/);
        if (hunkMatch) {
          currentHunk = {
            oldStart: parseInt(hunkMatch[1]),
            oldCount: parseInt(hunkMatch[2]) || 1,
            newStart: parseInt(hunkMatch[3]),
            newCount: parseInt(hunkMatch[4]) || 1,
            lines: [],
          };
        } else {
          // Fallback - create a basic hunk even if parsing fails
          currentHunk = {
            oldStart: 1,
            oldCount: 1,
            newStart: 1,
            newCount: 1,
            lines: [],
          };
        }
      } else if (line.startsWith("+") && currentHunk && currentHunk.lines) {
        currentHunk.lines.push({ type: "added", content: line.slice(1) });
        currentFile.addedLines++;
      } else if (line.startsWith("-") && currentHunk && currentHunk.lines) {
        currentHunk.lines.push({ type: "removed", content: line.slice(1) });
        currentFile.removedLines++;
      } else if (line.startsWith(" ") && currentHunk && currentHunk.lines) {
        currentHunk.lines.push({ type: "context", content: line.slice(1) });
      } else if (
        currentHunk &&
        line.trim() !== "" &&
        !line.startsWith("index ") &&
        !line.startsWith("---") &&
        !line.startsWith("+++") &&
        !line.startsWith("\\ No newline")
      ) {
        // Sometimes lines don't start with +, -, or space but are still part of the diff
      }
    }

    if (currentFile) {
      if (currentHunk) {
      }
      if (currentHunk && currentHunk.lines && currentHunk.lines.length > 0) {
        currentFile.hunks.push(currentHunk);
      } else {
      }
      files.push(currentFile);
    }

    return files;
  }

  buildFileTree(files) {
    const tree = {};

    files.forEach((file, index) => {
      const parts = file.name.split("/");
      let current = tree;

      parts.forEach((part, partIndex) => {
        if (partIndex === parts.length - 1) {
          // This is a file
          current[part] = {
            type: "file",
            file: file,
            index: index,
          };
        } else {
          // This is a folder
          if (!current[part]) {
            current[part] = {
              type: "folder",
              children: {},
            };
          }
          current = current[part].children;
        }
      });
    });

    return tree;
  }

  renderFileTree(tree, level = 0) {
    let html = "";

    Object.keys(tree)
      .sort()
      .forEach((key) => {
        const node = tree[key];
        const indent = "  ".repeat(level);

        if (node.type === "folder") {
          html += `
                    <div class="tree-folder" style="padding-left: ${
                      level * 16
                    }px">
                        <span class="folder-icon">📁</span>
                        <span class="folder-name">${this.escapeHtml(key)}</span>
                    </div>
                `;
          html += this.renderFileTree(node.children, level + 1);
        } else {
          const icon = this.getFileIcon(node.file);
          const stats = `+${node.file.addedLines} -${node.file.removedLines}`;
          const isActive = node.index === this.currentFileIndex;

          html += `
                    <div class="tree-file ${
                      isActive ? "active" : ""
                    }" data-file-index="${node.index}" style="padding-left: ${
            level * 16
          }px">
                        <span class="file-icon">${icon}</span>
                        <span class="file-name">${this.escapeHtml(key)}</span>
                    </div>
                `;
        }
      });

    return html;
  }

  renderFileList() {
    const fileListContainer = document.getElementById("file-list");
    const fileCountElement = document.getElementById("file-count");

    fileCountElement.textContent = this.files.length;

    const tree = this.buildFileTree(this.files);
    const treeHtml = this.renderFileTree(tree);

    fileListContainer.innerHTML = treeHtml;

    // Add click handlers for files
    fileListContainer.querySelectorAll(".tree-file").forEach((item) => {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        const fileIndex = parseInt(e.currentTarget.dataset.fileIndex);
        this.selectFileWithoutRerender(fileIndex);
      });
    });

    // Add click handlers for folders (toggle)
    fileListContainer.querySelectorAll(".tree-folder").forEach((folder) => {
      folder.addEventListener("click", (e) => {
        e.stopPropagation();
        folder.classList.toggle("collapsed");
      });
    });
  }

  getFileIcon(file) {
    if (file.addedLines > 0 && file.removedLines === 0) return "+";
    if (file.removedLines > 0 && file.addedLines === 0) return "−";
    return "•";
  }

  selectFile(fileIndex) {
    this.currentFile = this.files[fileIndex];
    this.currentFileIndex = fileIndex;
    this.updateActiveFile(fileIndex);

    // Find the file element in the diff container
    const diffContainer = document.getElementById("diff-content");
    const fileElement = diffContainer.querySelector(
      `[data-file-index="${fileIndex}"]`
    );

    if (fileElement) {
      fileElement.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      // Try alternative approach
      const allFileElements = diffContainer.querySelectorAll(".diff-file");
      if (allFileElements[fileIndex]) {
        allFileElements[fileIndex].scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    }
  }

  selectFileWithoutRerender(fileIndex) {
    // Temporarily disable scroll observer to prevent interference
    this.isManualNavigation = true;

    this.currentFile = this.files[fileIndex];
    this.currentFileIndex = fileIndex;
    this.updateActiveFile(fileIndex);

    // Find the file element in the diff container
    const diffContainer = document.getElementById("diff-content");
    const fileElement = diffContainer.querySelector(
      `[data-file-index="${fileIndex}"]`
    );

    if (fileElement) {
      fileElement.scrollIntoView({ behavior: "smooth", block: "start" });

      // Re-enable scroll observer after scroll completes
      setTimeout(() => {
        this.isManualNavigation = false;
      }, 1000); // Give enough time for smooth scroll to complete
    } else {
      // Try alternative approach
      const allFileElements = diffContainer.querySelectorAll(".diff-file");
      if (allFileElements[fileIndex]) {
        allFileElements[fileIndex].scrollIntoView({
          behavior: "smooth",
          block: "start",
        });

        // Re-enable scroll observer after scroll completes
        setTimeout(() => {
          this.isManualNavigation = false;
        }, 1000);
      } else {
        this.isManualNavigation = false;
      }
    }
  }

  updateActiveFile(activeIndex) {
    // Update active state in file tree
    document.querySelectorAll(".tree-file").forEach((item) => {
      const itemIndex = parseInt(item.dataset.fileIndex);
      const shouldBeActive = itemIndex === activeIndex;
      item.classList.toggle("active", shouldBeActive);
    });
  }

  renderAllFiles() {
    const container = document.getElementById("diff-content");

    if (!this.files || this.files.length === 0) {
      container.innerHTML =
        '<div class="empty-state">No files to display</div>';
      return;
    }

    const allFilesHtml = this.files
      .map((file, index) => this.renderSplitDiffFile(file, index))
      .join("");

    container.innerHTML = allFilesHtml;
  }

  renderSplitDiffFile(file, index) {
    // Check if this is a deleted file - simplified logic
    const isDeletedFile = file.addedLines === 0 && file.removedLines > 0;

    if (isDeletedFile) {
      return `
                <div class="diff-file diff-file-deleted" data-file="${
                  file.name
                }" data-file-index="${index}">
                    <div class="diff-file-header diff-file-header-deleted">
                        <span class="file-path">${this.escapeHtml(
                          file.name
                        )}</span>
                        <span class="file-stats-header">
                            <span class="file-deleted-badge">DELETED</span>
                            <span class="removed">-${file.removedLines}</span>
                        </span>
                    </div>
                    <div class="diff-deleted-content">
                        <div class="deleted-message">
                            <span class="deleted-icon">🗑️</span>
                            <span class="deleted-text">This file was deleted</span>
                        </div>
                    </div>
                </div>
            `;
    }

    const hunkPairs = file.hunks.map((hunk) => this.renderSplitHunk(hunk));
    const oldSide = hunkPairs.map((pair) => pair.old).join("");
    const newSide = hunkPairs.map((pair) => pair.new).join("");

    // If there's no content in the diff view, show a message
    const hasContent = oldSide.trim() || newSide.trim();

    return `
            <div class="diff-file" data-file="${
              file.name
            }" data-file-index="${index}">
                <div class="diff-file-header">
                    <span class="file-path">${this.escapeHtml(file.name)}</span>
                    <span class="file-stats-header">
                        <span class="added">+${file.addedLines}</span> 
                        <span class="removed">-${file.removedLines}</span>
                    </span>
                </div>
                ${
                  hasContent
                    ? `
                <div class="diff-split-view">
                    <div class="diff-side old">
                        ${oldSide}
                    </div>
                    <div class="diff-side new">
                        ${newSide}
                    </div>
                </div>
                `
                    : `
                <div class="diff-empty-content">
                    <div class="empty-diff-message">
                        <span class="empty-icon">📄</span>
                        <span class="empty-text">No diff content available</span>
                        <span class="empty-subtext">This file may be binary, too large, or have formatting changes</span>
                    </div>
                </div>
                `
                }
            </div>
        `;
  }

  renderSplitHunk(hunk) {
    if (!hunk.lines) {
      return { old: "", new: "" };
    }

    let oldLineNum = hunk.oldStart;
    let newLineNum = hunk.newStart;
    let oldSide = "";
    let newSide = "";

    for (const line of hunk.lines) {
      if (line.type === "context") {
        oldSide += this.renderSplitLine(oldLineNum, line.content, "context");
        newSide += this.renderSplitLine(newLineNum, line.content, "context");
        oldLineNum++;
        newLineNum++;
      } else if (line.type === "removed") {
        oldSide += this.renderSplitLine(oldLineNum, line.content, "removed");
        newSide += this.renderSplitLine("", "", "empty");
        oldLineNum++;
      } else if (line.type === "added") {
        oldSide += this.renderSplitLine("", "", "empty");
        newSide += this.renderSplitLine(newLineNum, line.content, "added");
        newLineNum++;
      }
    }

    return { old: oldSide, new: newSide };
  }

  renderSplitLine(lineNum, content, type) {
    const lineNumDisplay = lineNum === "" ? "" : lineNum;
    return `
            <div class="diff-split-line ${type}">
                <span class="diff-line-number">${lineNumDisplay}</span>
                <span class="diff-line-content">${this.escapeHtml(
                  content
                )}</span>
            </div>
        `;
  }

  renderStatus(status) {
    const container = document.getElementById("status-content");
    let html = "";

    if (status.modified && status.modified.length > 0) {
      html += this.renderStatusCategory(
        "Modified",
        status.modified,
        "status-modified"
      );
    }

    if (status.not_added && status.not_added.length > 0) {
      html += this.renderStatusCategory(
        "Untracked",
        status.not_added,
        "status-added"
      );
    }

    if (status.deleted && status.deleted.length > 0) {
      html += this.renderStatusCategory(
        "Deleted",
        status.deleted,
        "status-deleted"
      );
    }

    if (status.renamed && status.renamed.length > 0) {
      html += this.renderStatusCategory(
        "Renamed",
        status.renamed,
        "status-renamed"
      );
    }

    if (html === "") {
      html = '<div class="empty-state">Working directory clean</div>';
    }

    container.innerHTML = html;
  }

  renderStatusCategory(title, files, className) {
    const fileList = files
      .map(
        (file) =>
          `<div class="status-file ${className}">${this.escapeHtml(file)}</div>`
      )
      .join("");

    return `
            <div class="status-item">
                <div class="status-category">${title} (${files.length})</div>
                ${fileList}
            </div>
        `;
  }

  renderHistory(log) {
    const container = document.getElementById("history-content");

    if (!log.all || log.all.length === 0) {
      container.innerHTML =
        '<div class="empty-state">No commit history available</div>';
      return;
    }

    const commits = log.all
      .map(
        (commit) => `
            <div class="commit-item">
                <div class="commit-hash">${commit.hash.slice(0, 7)}</div>
                <div class="commit-message">${this.escapeHtml(
                  commit.message
                )}</div>
                <div class="commit-author">
                    ${this.escapeHtml(commit.author_name)} • ${new Date(
          commit.date
        ).toLocaleDateString()}
                </div>
            </div>
        `
      )
      .join("");

    container.innerHTML = commits;
  }

  showError(containerId, message) {
    const container = document.getElementById(containerId);
    container.innerHTML = `<div class="error">Error: ${this.escapeHtml(
      message
    )}</div>`;
  }

  setupScrollObserver() {
    const diffContainer = document.getElementById("diff-content");
    if (!diffContainer) return;

    // Clean up existing observer
    if (this.scrollObserver) {
      this.scrollObserver.disconnect();
    }

    const observer = new IntersectionObserver(
      (entries) => {
        let mostVisibleEntry = null;
        let maxRatio = 0;

        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio;
            mostVisibleEntry = entry;
          }
        });

        if (mostVisibleEntry && !this.isManualNavigation) {
          const fileIndex = parseInt(mostVisibleEntry.target.dataset.fileIndex);
          if (!isNaN(fileIndex)) {
            this.currentFileIndex = fileIndex;
            this.currentFile = this.files[fileIndex];
            this.updateActiveFile(fileIndex);
          }
        }
      },
      {
        root: diffContainer,
        rootMargin: "-10% 0px -80% 0px",
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    );

    // Observe all file elements
    setTimeout(() => {
      document.querySelectorAll("[data-file-index]").forEach((fileElement) => {
        observer.observe(fileElement);
      });
    }, 100);

    // Store observer to clean up later if needed
    this.scrollObserver = observer;
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new GitPreview();
});
