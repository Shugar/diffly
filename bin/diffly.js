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
        const diff = await git.diff(["--no-prefix"]);
        res.json({ diff });
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
