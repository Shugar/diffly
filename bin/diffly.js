#!/usr/bin/env node

const { program } = require("commander");
const path = require("path");
const fs = require("fs");
const express = require("express");
const simpleGit = require("simple-git");

program
  .name("diffly")
  .description("Preview Git repository in a GitHub-like interface")
  .version("1.0.0")
  .option("-p, --port <port>", "port to run the server on", "3000")
  .action(async (options) => {
    const currentDir = process.cwd();
    const gitDir = path.join(currentDir, ".git");

    if (!fs.existsSync(gitDir)) {
      console.error("Error: No .git directory found in current directory");
      process.exit(1);
    }

    console.log("Starting Diffly server...");

    const app = express();
    const git = simpleGit(currentDir);

    app.use(express.static(path.join(__dirname, "../public")));

    app.get("/api/status", async (req, res) => {
      try {
        const status = await git.status();
        res.json(status);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get("/api/diff", async (req, res) => {
      try {
        // Get status to identify new/untracked files
        const status = await git.status();
        
        // Get diff for modified files and staged files
        const [unstagedDiff, stagedDiff] = await Promise.all([
          git.diff(["--no-prefix"]), // Unstaged/modified files
          git.diff(["--no-prefix", "--cached"]) // Staged files
        ]);
        
        // Create pseudo-diffs for untracked files
        let untrackedDiffs = '';
        if (status.not_added && status.not_added.length > 0) {
          for (const file of status.not_added) {
            try {
              // Read untracked file content from filesystem
              const fileContent = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
              
              // Create a fake diff showing the entire file as new
              const lines = fileContent.split('\n');
              untrackedDiffs += `diff --git ${file} ${file}\n`;
              untrackedDiffs += `new file mode 100644\n`;
              untrackedDiffs += `index 0000000..${Math.random().toString(36).substr(2, 7)}\n`;
              untrackedDiffs += `--- /dev/null\n`;
              untrackedDiffs += `+++ ${file}\n`;
              untrackedDiffs += `@@ -0,0 +1,${lines.length} @@\n`;
              lines.forEach(line => {
                untrackedDiffs += `+${line}\n`;
              });
            } catch (error) {
              // Skip files that can't be read
              console.warn(`Could not read untracked file: ${file}`);
            }
          }
        }
        
        // Return separate diffs for staged and unstaged
        res.json({ 
          staged: stagedDiff,
          unstaged: unstagedDiff,
          untracked: untrackedDiffs,
          // Also send combined for backward compatibility
          diff: [unstagedDiff, stagedDiff, untrackedDiffs].filter(Boolean).join('\n')
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get("/api/log", async (req, res) => {
      try {
        const log = await git.log({ 
          maxCount: 10000,
          format: {
            hash: '%H',
            date: '%ai',
            message: '%s',
            author_name: '%an',
            author_email: '%ae'
          }
        });
        res.json(log);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get("/", (req, res) => {
      res.sendFile(path.join(__dirname, "../public/index.html"));
    });

    async function findAvailablePort(startPort) {
      return new Promise((resolve) => {
        const testServer = require('net').createServer();
        testServer.listen(startPort, () => {
          const port = testServer.address().port;
          testServer.close(() => resolve(port));
        });
        testServer.on('error', () => {
          resolve(findAvailablePort(startPort + 1));
        });
      });
    }

    const availablePort = await findAvailablePort(parseInt(options.port));
    if (availablePort !== parseInt(options.port)) {
      console.log(`Port ${options.port} is busy, using port ${availablePort} instead`);
    }

    const server = app.listen(availablePort, async () => {
      const url = `http://localhost:${availablePort}`;
      console.log(`Diffly server running at ${url}`);
      console.log("Opening browser...");
      try {
        const open = await import("open");
        await open.default(url);
      } catch (error) {
        console.log("Could not automatically open browser. Please visit:", url);
      }
    });

    process.on("SIGINT", () => {
      console.log("\nShutting down Diffly server...");
      server.close();
      process.exit(0);
    });
  });

program.parse();
