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
    requestAnimationFrame(() => this.loadInitialData());
  }

  setupNavigation() {
    const navButtons = document.querySelectorAll(".nav-btn");
    const handleClick = (e) => {
      const tab = e.target.dataset.tab;
      this.switchTab(tab);
    };
    navButtons.forEach((btn) => {
      btn.addEventListener("click", handleClick, { passive: true });
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
    await this.loadDiff();
  }


  showDiffLoading() {
    const container = document.getElementById("diff-content");
    container.innerHTML = '<div class="loading-content">Loading diff...</div>';
  }

  async loadDiff() {
    try {
      this.showDiffLoading();
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
    let currentHunk = null;

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
                      level * 20
                    }px; --level: ${level};" data-level="${level}">
                        <div class="folder-toggle">
                            <svg class="folder-arrow" width="16" height="16" viewBox="0 0 16 16">
                                <path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z"></path>
                            </svg>
                        </div>
                        <svg class="icon-directory" aria-label="Directory" aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16">
                            <path d="M1.75 1A1.75 1.75 0 0 0 0 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0 0 16 13.25v-8.5A1.75 1.75 0 0 0 14.25 3H7.5a.25.25 0 0 1-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75Z"></path>
                        </svg>
                        <span class="folder-name">${this.escapeHtml(key)}</span>
                    </div>
                `;
          html += `<div class="folder-contents" data-parent="${this.escapeHtml(key)}">`;
          html += this.renderFileTree(node.children, level + 1);
          html += `</div>`;
        } else {
          const fileIcon = this.getFileIcon(node.file);
          const statusIcon = this.getStatusIcon(node.file);
          const isActive = node.index === this.currentFileIndex;

          html += `
                    <div class="tree-file ${
                      isActive ? "active" : ""
                    }" data-file-index="${node.index}" style="padding-left: ${
            level * 20 + 20
          }px; --level: ${level};" data-level="${level}">
                        <div class="file-info">
                            ${fileIcon}
                            <span class="file-name">${this.escapeHtml(key)}</span>
                        </div>
                        ${statusIcon ? statusIcon : ''}
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

    // Use event delegation for better performance
    fileListContainer.addEventListener("click", (e) => {
      if (e.target.closest(".tree-file")) {
        e.stopPropagation();
        const fileIndex = parseInt(e.target.closest(".tree-file").dataset.fileIndex);
        this.selectFileWithoutRerender(fileIndex);
      } else if (e.target.closest(".tree-folder")) {
        e.stopPropagation();
        const folder = e.target.closest(".tree-folder");
        folder.classList.toggle("collapsed");
        const folderName = folder.querySelector(".folder-name").textContent;
        const contents = folder.nextElementSibling;
        if (contents && contents.classList.contains("folder-contents")) {
          contents.classList.toggle("hidden");
        }
      }
    }, { passive: true });
  }

  getFileIcon(file) {
    return `<svg class="icon-file" aria-label="File" aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16">
    <path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688l-.011-.013-2.914-2.914-.013-.011Z"></path>
</svg>`;
  }

  getStatusIcon(file) {
    if (file.addedLines > 0 && file.removedLines === 0) {
      return `<svg class="icon-added" title="added" aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16">
    <path d="M2.75 1h10.5c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0 1 13.25 15H2.75A1.75 1.75 0 0 1 1 13.25V2.75C1 1.784 1.784 1 2.75 1Zm10.5 1.5H2.75a.25.25 0 0 0-.25.25v10.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25V2.75a.25.25 0 0 0-.25-.25ZM8 4a.75.75 0 0 1 .75.75v2.5h2.5a.75.75 0 0 1 0 1.5h-2.5v2.5a.75.75 0 0 1-1.5 0v-2.5h-2.5a.75.75 0 0 1 0-1.5h2.5v-2.5A.75.75 0 0 1 8 4Z"></path>
</svg>`;
    }
    if (file.removedLines > 0 && file.addedLines === 0) {
      return `<svg class="icon-removed" title="removed" aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16">
    <path d="M13.25 1c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0 1 13.25 15H2.75A1.75 1.75 0 0 1 1 13.25V2.75C1 1.784 1.784 1 2.75 1ZM2.75 2.5a.25.25 0 0 0-.25.25v10.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25V2.75a.25.25 0 0 0-.25-.25Zm8.5 6.25h-6.5a.75.75 0 0 1 0-1.5h6.5a.75.75 0 0 1 0 1.5Z"></path>
</svg>`;
    }
    if (file.addedLines > 0 && file.removedLines > 0) {
      return `<svg class="icon-modified" title="modified" aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16">
    <path d="M13.25 1c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0 1 13.25 15H2.75A1.75 1.75 0 0 1 1 13.25V2.75C1 1.784 1.784 1 2.75 1ZM2.75 2.5a.25.25 0 0 0-.25.25v10.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25V2.75a.25.25 0 0 0-.25-.25ZM8 10a2 2 0 1 1-.001-3.999A2 2 0 0 1 8 10Z"></path>
</svg>`;
    }
    return null;
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

    // Use DocumentFragment for better performance
    const fragment = document.createDocumentFragment();
    this.files.forEach((file, index) => {
      const div = document.createElement('div');
      div.innerHTML = this.renderSplitDiffFile(file, index);
      fragment.appendChild(div.firstElementChild);
    });

    container.innerHTML = '';
    container.appendChild(fragment);
  }

  renderSplitDiffFile(file, index) {
    // Check if this is a deleted file or new file
    const isDeletedFile = file.addedLines === 0 && file.removedLines > 0;
    const isNewFile = file.addedLines > 0 && file.removedLines === 0;

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

    if (isNewFile) {
      return `
                <div class="diff-file diff-file-new" data-file="${
                  file.name
                }" data-file-index="${index}">
                    <div class="diff-file-header diff-file-header-new">
                        <span class="file-path">${this.escapeHtml(
                          file.name
                        )}</span>
                        <span class="file-stats-header">
                            <span class="file-new-badge">NEW</span>
                            <span class="added">+${file.addedLines}</span>
                        </span>
                    </div>
                    ${this.renderNewFileContent(file)}
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

  renderNewFileContent(file) {
    const hunkPairs = file.hunks.map((hunk) => this.renderSplitHunk(hunk));
    const newSide = hunkPairs.map((pair) => pair.new).join("");

    // For new files, we only show the new content side
    return `
                <div class="diff-split-view">
                    <div class="diff-side new">
                        ${newSide}
                    </div>
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

    // Observe all file elements with requestAnimationFrame
    requestAnimationFrame(() => {
      document.querySelectorAll("[data-file-index]").forEach((fileElement) => {
        observer.observe(fileElement);
      });
    });

    // Store observer to clean up later if needed
    this.scrollObserver = observer;
  }

  escapeHtml(text) {
    // Use a cached element for better performance
    if (!this._escapeDiv) {
      this._escapeDiv = document.createElement("div");
    }
    this._escapeDiv.textContent = text;
    return this._escapeDiv.innerHTML;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new GitPreview();
});
