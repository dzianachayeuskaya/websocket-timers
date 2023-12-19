/*global UIkit, Vue */

(() => {
  const notification = (config) =>
    UIkit.notification({
      pos: "top-right",
      timeout: 5000,
      ...config,
    });

  const alert = (message) =>
    notification({
      message,
      status: "danger",
    });

  const info = (message) =>
    notification({
      message,
      status: "success",
    });

  new Vue({
    el: "#app",
    data: {
      desc: "",
      activeTimers: [],
      oldTimers: [],
      client: null,
    },
    methods: {
      createTimer() {
        const description = this.desc;
        this.desc = "";

        this.client.send(JSON.stringify({ type: "new_timer", description }));
      },
      stopTimer(timerId) {
        this.client.send(JSON.stringify({ type: "stop_timer", timerId }));
      },
      formatTime(ts) {
        return new Date(ts).toTimeString().split(" ")[0];
      },
      formatDuration(d) {
        d = Math.floor(d / 1000);
        const s = d % 60;
        d = Math.floor(d / 60);
        const m = d % 60;
        const h = Math.floor(d / 60);
        return [h > 0 ? h : null, m, s]
          .filter((x) => x !== null)
          .map((x) => (x < 10 ? "0" : "") + x)
          .join(":");
      },
    },
    created() {
      const wsProto = location.protocol === "https:" ? "wss" : "ws";

      this.client = new WebSocket(`${wsProto}://${location.host}?token=${AUTH_TOKEN}`);

      this.client.addEventListener("message", (message) => {
        try {
          const data = JSON.parse(message.data);
          if (data.type === "all_timers") {
            this.oldTimers = data.oldTimers;
            this.activeTimers = data.activeTimers;
          } else if (data.type === "active_timers") {
            this.activeTimers = data.activeTimers;
          } else if (data.type === "active_timers_after_add") {
            this.activeTimers = data.activeTimers;
            info(`Created new timer "${data.newTimerDescr}" [${data.newTimerId}]`);
          } else if (data.type === "all_timers_after_stop") {
            this.oldTimers = data.oldTimers;
            this.activeTimers = data.activeTimers;
            info(`Stopped the timer [${data.timerId}]`);
          } else if (data.type === "error_message") {
            alert(data.message);
          }
        } catch (err) {
          alert(String(err));
          return;
        }
      });

      this.client.addEventListener("error", (e) => {
        alert(String(e.type));
      });
    },
  });
})();
