module.exports = {
  async up(db, client) {
    await db.createCollection("users");
    await db.createCollection("timers");
    await db.createCollection("tokens");
  },

  async down(db, client) {
    await db.collection("users").drop();
    await db.collection("timers").drop();
    await db.collection("tokens").drop();
  },
};
