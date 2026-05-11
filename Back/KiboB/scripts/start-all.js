const { spawn } = require("child_process");

function run(name, command, args, env = {}) {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, ...env },
  });

  child.on("exit", (code) => {
    if (code !== 0) {
      console.error(`${name} finalizo con codigo ${code}`);
    }
  });

  return child;
}

const chatbot = run("chatbot", "node", ["../../KiboE/src/index.js"]);
const backend = run("backend", "node", ["src/server.js"]);

function shutdown(signal) {
  chatbot.kill(signal);
  backend.kill(signal);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
