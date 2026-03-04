const path = require("path");
const express = require("express");
const session = require("express-session");
const { RedisStore } = require("connect-redis");
const { createClient } = require("redis");
const bcrypt = require("bcryptjs");
const mysql = require("mysql2/promise");
require("dotenv").config();

const app = express();

const config = {
  port: Number(process.env.PORT || 3000),
  sessionSecret: process.env.SESSION_SECRET || "dev-secret",
  mysql: {
    host: process.env.MYSQL_HOST || "localhost",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "logw",
  },
  redisUrl: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  isProduction: process.env.NODE_ENV === "production",
};

let pool;
let redisClient;

async function initDb() {
  pool = mysql.createPool({
    host: config.mysql.host,
    port: config.mysql.port,
    user: config.mysql.user,
    password: config.mysql.password,
    database: config.mysql.database,
    connectionLimit: 10,
  });
  await pool.query("SELECT 1");
}

async function initRedis() {
  redisClient = createClient({ url: config.redisUrl });
  redisClient.on("error", (err) => {
    console.error("Redis error", err);
  });
  await redisClient.connect();
}

function sessionMiddleware() {
  const store = new RedisStore({
    client: redisClient,
    prefix: "logw:sess:",
  });
  return session({
    store,
    name: "logw.sid",
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: config.isProduction,
      maxAge: 1000 * 60 * 60 * 24,
    },
  });
}

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use(express.static(path.join(__dirname)));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/api/me", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ ok: false, message: "未登录" });
  }
  const [rows] = await pool.query(
    "SELECT id, email, display_name AS displayName FROM users WHERE id = ?",
    [req.session.userId]
  );
  if (!rows.length) {
    return res.status(404).json({ ok: false, message: "用户不存在" });
  }
  return res.json({ ok: true, user: rows[0] });
});

app.post("/api/login", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (!email || !password) {
    return res.status(400).json({ ok: false, message: "请输入邮箱和密码" });
  }

  const [rows] = await pool.query(
    "SELECT id, email, password_hash AS passwordHash FROM users WHERE email = ?",
    [email]
  );
  const user = rows[0];
  if (!user) {
    return res.status(401).json({ ok: false, message: "账号或密码错误" });
  }

  const matched = await bcrypt.compare(password, user.passwordHash);
  if (!matched) {
    return res.status(401).json({ ok: false, message: "账号或密码错误" });
  }

  req.session.userId = user.id;
  return res.json({ ok: true, message: "登录成功" });
});

app.post("/api/register", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const displayName = String(req.body.displayName || "").trim();

  if (!email || !password || !displayName) {
    return res
      .status(400)
      .json({ ok: false, message: "请填写邮箱、密码和昵称" });
  }

  if (password.length < 8) {
    return res.status(400).json({ ok: false, message: "密码至少 8 位" });
  }

  if (displayName.length > 120) {
    return res.status(400).json({ ok: false, message: "昵称过长" });
  }

  const [existing] = await pool.query(
    "SELECT id FROM users WHERE email = ?",
    [email]
  );
  if (existing.length) {
    return res.status(409).json({ ok: false, message: "邮箱已注册" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [result] = await pool.query(
    "INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)",
    [email, passwordHash, displayName]
  );

  req.session.userId = result.insertId;
  return res.json({ ok: true, message: "注册成功" });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ ok: false, message: "退出失败" });
    }
    res.clearCookie("logw.sid");
    return res.json({ ok: true, message: "已退出" });
  });
});

app.get("/gallery", (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/");
  }
  res.sendFile(path.join(__dirname, "gallery.html"));
});

app.use((err, req, res, next) => {
  console.error("Server error", err);
  res.status(500).json({ ok: false, message: "服务器错误" });
});

async function start() {
  await initDb();
  await initRedis();
  app.use(sessionMiddleware());

  app.listen(config.port, () => {
    console.log(`Server listening on http://localhost:${config.port}`);
  });
}

start().catch((err) => {
  console.error("Startup failed", err);
  process.exit(1);
});
