// server.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const webpush = require("web-push");

const app = express();
app.use(express.json());

// Frontend
app.use(express.static(path.join(__dirname, "public")));

// Nachrichten-Datei
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "messages.json");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "[]", "utf8");

// Push Subscriptions speichern
const SUB_FILE = path.join(DATA_DIR, "subs.json");
if (!fs.existsSync(SUB_FILE)) fs.writeFileSync(SUB_FILE, "[]", "utf8");

// --- Web Push Konfiguration ---
const VAPID_PUBLIC = "BBnld7E35g6yD0Aldz4Zpp2HxcSroSfY-HvGcxdo94oNEYEzUUn7ag-R9veP3Ih-sX3geLEqUSJj5qqGNsl8YFI";
const VAPID_PRIVATE = "Mk3iRldyGMmEWASkwGCvi45BscncUnJZZcDSpd3tpR0";

webpush.setVapidDetails(
  "mailto:info@combow.net",
  VAPID_PUBLIC,
  VAPID_PRIVATE
);

// Nachrichten holen
app.get("/messages", (req, res) => {
  try {
    const data = fs.readFileSync(DATA_FILE, "utf8");
    res.json(JSON.parse(data));
  } catch (err) {
    console.error(err);
    res.json([]);
  }
});

// Nachricht speichern + Push
app.post("/messages", (req, res) => {
  const { text, user } = req.body;
  if (!text || !user) return res.status(400).json({ error: "Missing text or user" });

  let messages = [];
  try { messages = JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); } catch {}

  const newMsg = { text, user, time: new Date().toISOString() };
  messages.push(newMsg);
  fs.writeFileSync(DATA_FILE, JSON.stringify(messages, null, 2));

  // Push an alle Subscriptions
  let subs = [];
  try { subs = JSON.parse(fs.readFileSync(SUB_FILE, "utf8")); } catch {}

  const payload = JSON.stringify({
    title: "Neue Nachricht",
    body: `${user}: ${text}`,
    tag: "new-message"
  });

  subs.forEach(s => {
    webpush.sendNotification(s, payload).catch(err => {
      console.error("Push Fehler, entferne Subscription", err);
      // Fehlerhafte Subscription entfernen
      subs = subs.filter(x => x !== s);
      fs.writeFileSync(SUB_FILE, JSON.stringify(subs, null, 2));
    });
  });

  res.json({ ok: true });
});

// Push Subscription speichern
app.post("/subscribe", (req, res) => {
  const sub = req.body;
  let subs = [];
  try { subs = JSON.parse(fs.readFileSync(SUB_FILE, "utf8")); } catch {}
  
  // Duplikate vermeiden
  if (!subs.find(s => JSON.stringify(s) === JSON.stringify(sub))) {
    subs.push(sub);
    fs.writeFileSync(SUB_FILE, JSON.stringify(subs, null, 2));
  }
  res.json({ ok: true });
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Messenger läuft auf Port ${PORT}`));
