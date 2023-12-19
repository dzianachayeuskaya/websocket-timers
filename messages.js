const path = require("path");
const { findTimerByTimerId, findTokensByUserId, createTimer, stopTimer } = require(path.join(__dirname, "db"));
const { getTimers, processMessage, sendMessageAllClients } = require(path.join(__dirname, "utils"));

async function sendInitialState(db, userId, ws) {
  const { oldTimers, activeTimers } = await getTimers(db, userId);

  ws.send(
    JSON.stringify({
      type: "all_timers",
      oldTimers,
      activeTimers,
    })
  );
}

async function sendActiveTimers(db, userId, ws) {
  const { activeTimers } = await getTimers(db, userId);

  ws.send(
    JSON.stringify({
      type: "active_timers",
      activeTimers,
    })
  );
}

async function sendStateAfterAdd(db, userId, data, sessions, clients) {
  const newTimer = await createTimer(db, userId, data.description);
  const { activeTimers } = await getTimers(db, userId);

  sendMessageAllClients(sessions, clients, {
    type: "active_timers_after_add",
    activeTimers,
    newTimerDescr: data.description || "",
    newTimerId: newTimer.insertedId,
  });
}

async function sendStateAfterStop(db, userId, data, sessions, clients) {
  const targetTimer = await findTimerByTimerId(db, data.timerId);
  if (!targetTimer) {
    sendMessageAllClients(sessions, clients, {
      type: "error_message",
      message: `Unknown timer ID: ${data.timerId}`,
    });
    return;
  }
  if (targetTimer.isActive) await stopTimer(db, targetTimer);

  const { oldTimers, activeTimers } = await getTimers(db, userId);
  sendMessageAllClients(sessions, clients, {
    type: "all_timers_after_stop",
    oldTimers,
    activeTimers,
    timerId: data.timerId,
  });
}

async function onMessage(message, db, userId, clients, ws) {
  const text = message.toString("utf-8");
  const data = JSON.parse(text);
  const sessions = await findTokensByUserId(db, userId);

  if (data.type === "new_timer") {
    await processMessage(async () => await sendStateAfterAdd(db, userId, data, sessions, clients), ws);
  } else if (data.type === "stop_timer") {
    await processMessage(async () => await sendStateAfterStop(db, userId, data, sessions, clients), ws);
  }
}

module.exports = {
  sendInitialState,
  sendActiveTimers,
  sendStateAfterAdd,
  sendStateAfterStop,
  onMessage,
};
