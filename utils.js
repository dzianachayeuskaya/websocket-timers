const path = require("path");
const { findTimersByUserId } = require(path.join(__dirname, "db"));

async function getTimers(db, userId) {
  const timers = await findTimersByUserId(db, userId);
  const oldTimers = timers.filter((t) => !t.isActive);
  const activeTimers = timers.filter((t) => t.isActive).map((t) => ({ ...t, progress: Date.now() - t.start }));
  return { oldTimers, activeTimers };
}

async function processMessage(fn, ws) {
  try {
    await fn();
  } catch (err) {
    ws.send(
      JSON.stringify({
        type: "error_message",
        message: String(err),
      })
    );
  }
}

function sendMessageAllClients(sessions, clients, message) {
  for (let token of sessions) {
    clients.get(token._id).send(JSON.stringify(message));
  }
}
module.exports = { getTimers, processMessage, sendMessageAllClients };
