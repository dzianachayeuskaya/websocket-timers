const bcrypt = require("bcrypt");

const { ObjectId } = require("mongodb");

const findUserByUsername = async (db, username) => {
  const user = await db.collection("users").findOne({ username });
  return user ? { ...user, _id: user._id.toString() } : null;
};

const findUserByToken = async (db, token) => {
  const session = await db.collection("tokens").findOne(
    { _id: new ObjectId(token) },
    {
      projection: { userId: 1 },
    }
  );

  if (!session) return;

  const user = await db.collection("users").findOne({ _id: new ObjectId(session.userId) });
  return { ...user, _id: user._id.toString() };
};

const findTokensByUserId = async (db, userId) => {
  const tokens = await db.collection("tokens").find({ userId }).toArray();
  const formattedTokens = tokens.map((t) => ({ ...t, _id: t._id.toString() }));
  return formattedTokens;
};

const findTimersByUserId = (db, userId) => db.collection("timers").find({ userId }).toArray();

const findTimerByTimerId = (db, timerId) => db.collection("timers").findOne({ _id: new ObjectId(timerId) });

const createUser = (db, { username, password }) =>
  db.collection("users").insertOne({ username, passwordHash: bcrypt.hashSync(password, 10) });

const createToken = (db, userId) => db.collection("tokens").insertOne({ userId });

const deleteToken = (db, token) => {
  db.collection("tokens").deleteOne({ _id: new ObjectId(token) });
};

const createTimer = (db, userId, descr) =>
  db.collection("timers").insertOne({ userId, descr, start: Date.now(), end: null, duration: null, isActive: true });

const stopTimer = (db, timer) =>
  db.collection("timers").findOneAndUpdate(
    { _id: new ObjectId(timer._id) },
    {
      $set: {
        end: Date.now(),
        duration: Date.now() - timer.start,
        isActive: false,
      },
    },
    { returnDocument: "after" }
  );

module.exports = {
  findUserByUsername,
  findUserByToken,
  findTokensByUserId,
  findTimersByUserId,
  findTimerByTimerId,
  createUser,
  createToken,
  deleteToken,
  createTimer,
  stopTimer,
};
