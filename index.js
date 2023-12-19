require("dotenv").config();
const express = require("express");
const path = require("path");
const { promisify } = require("util");
const bcrypt = require("bcrypt");
const nunjucks = require("nunjucks");
const bodyParser = require("body-parser");
const { MongoClient } = require("mongodb");
const http = require("http");
const WebSocket = require("ws");
const { URL } = require("url");
const { findUserByUsername, findUserByToken, createUser, createToken, deleteToken } = require(path.join(
  __dirname,
  "db"
));
const { sendInitialState, sendActiveTimers, onMessage } = require(path.join(__dirname, "messages"));
const { processMessage } = require(path.join(__dirname, "utils"));

const clientPromise = MongoClient.connect(process.env.DB_URI, {
  maxPoolSize: 10,
});
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ clientTracking: false, noServer: true });
const clients = new Map();

app.use(express.json());
app.use(express.static("public"));

app.use(async (req, res, next) => {
  try {
    const client = await clientPromise;
    req.db = client.db("users");
    next();
  } catch (err) {
    next(err);
  }
});

nunjucks.configure("views", {
  autoescape: true,
  express: app,
  tags: {
    blockStart: "[%",
    blockEnd: "%]",
    variableStart: "[[",
    variableEnd: "]]",
    commentStart: "[#",
    commentEnd: "#]",
  },
});

app.set("view engine", "njk");

app.get("/", async (req, res) => {
  const token = req.query.token;
  const user = token && (await findUserByToken(req.db, token));
  res.render("index", {
    user: user,
    userToken: user ? token : "",
    authError: req.query.authError === "true" ? "Wrong username or password" : req.query.authError,
    signupError: req.query.signupError === "true" ? "A user with the same name already exists" : req.query.signupError,
    entryError:
      req.query.entryError === "true" ? "The username and password fields are required." : req.query.entryError,
  });
});

app.post("/signup", bodyParser.urlencoded({ extended: false }), async (req, res) => {
  if (!req.body.username || !req.body.password) {
    return res.redirect("/?entryError=true");
  }

  if (await findUserByUsername(req.db, req.body.username)) return res.redirect("/?signupError=true");
  const user = await createUser(req.db, req.body);
  const token = await createToken(req.db, user.insertedId.toString());
  res.redirect(`/?token=${token.insertedId}`);
});

const compareAsync = promisify(bcrypt.compare);

app.post("/login", bodyParser.urlencoded({ extended: false }), async (req, res) => {
  if (!req.body.username || !req.body.password) {
    return res.redirect("/?entryError=true");
  }

  const { username, password } = req.body;
  const user = await findUserByUsername(req.db, username);
  if (!user || !(await compareAsync(password, user.passwordHash))) {
    return res.redirect("/?authError=true");
  }
  const { insertedId } = await createToken(req.db, user._id);
  res.redirect(`/?token=${insertedId}`);
});

server.on("upgrade", async (req, socket, head) => {
  const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
  const token = searchParams && searchParams.get("token");
  req.token = token;

  const client = await clientPromise;
  req.db = client.db("users");

  const user = token && (await findUserByToken(client.db("users"), token));
  if (!user) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  req.userId = user._id;
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
});

wss.on("connection", async (ws, req) => {
  const { db, userId, token } = req;
  clients.set(token, ws);

  await processMessage(async () => await sendInitialState(db, userId, ws), ws);

  setInterval(async () => await processMessage(async () => await sendActiveTimers(db, userId, ws), ws), 1000);

  ws.on("close", () => {
    clients.delete(token);
  });

  ws.on("message", async (message) => {
    if (ws.readyState === WebSocket.OPEN)
      await processMessage(async () => await onMessage(message, db, userId, clients, ws), ws);
  });
});

app.get("/logout", async (req, res) => {
  if (!req.query || !req.query.token) {
    return res.redirect("/");
  }
  await deleteToken(req.db, req.query.token);
  res.redirect("/");
});

app.use((err, req, res) => {
  res.status(500).send(err.message);
});

const port = process.env.PORT || 3000;

server.listen(port, () => {
  console.log(`  Listening on http://localhost:${port}`);
});
