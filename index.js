const mineflayer = require("mineflayer")
const express = require("express")
const fs = require("fs")

const app = express()
app.use(express.json())

/* ========== CONFIG ========== */
const API_KEY = "ApiKey90"
const SERVER_HOST = "bingungsmp.top"
const SERVER_COMMAND = "/server ecocpvp"
const JUMP_INTERVAL = 5000
const ACCOUNTS_FILE = "./accounts.json"
/* ============================ */

let bots = {}
let botState = {}
let logs = []

/* ---------- UTILS ---------- */
function log(msg) {
  const line = `[${new Date().toLocaleTimeString()}] ${msg}`
  console.log(line)
  logs.push(line)
  if (logs.length > 500) logs.shift()
}

function loadAccounts() {
  try {
    if (!fs.existsSync(ACCOUNTS_FILE)) {
      log("accounts.json not found. Creating empty file.")
      fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify([]))
      return []
    }
    return JSON.parse(fs.readFileSync(ACCOUNTS_FILE, "utf8"))
  } catch (e) {
    log("Error loading accounts: " + e.message)
    return []
  }
}

/* ---------- API KEY ---------- */
function checkKey(req, res, next) {
  const key = req.query.key || req.headers["x-api-key"]
  if (key !== API_KEY) return res.status(403).send("Access Denied")
  next()
}

/* ---------- BOT ---------- */
function startBot(acc) {
  if (bots[acc.name]) return

  botState[acc.name] = botState[acc.name] || { autoRejoin: true }
  botState[acc.name].status = "CONNECTING"
  log(`Starting ${acc.name}`)

  const bot = mineflayer.createBot({
    host: SERVER_HOST,
    username: acc.name,
    version: false,
    hideErrors: true
  })

  bots[acc.name] = bot

  bot.once("spawn", () => {
    botState[acc.name].status = "ONLINE"
    log(`${acc.name} spawned`)
    setTimeout(() => bot.chat(acc.loginCommand), 3000)
    setTimeout(() => bot.chat(SERVER_COMMAND), 6000)

    bot.jumpTimer = setInterval(() => {
      bot.setControlState("jump", true)
      setTimeout(() => bot.setControlState("jump", false), 200)
    }, JUMP_INTERVAL)
  })

  bot.on("chat", (u, m) => log(`<${u}> ${m}`))

  bot.on("end", () => {
    log(`${acc.name} disconnected`)
    if (bot.jumpTimer) clearInterval(bot.jumpTimer)
    delete bots[acc.name]
    
    if (botState[acc.name]) {
      botState[acc.name].status = "OFFLINE"
      if (botState[acc.name].autoRejoin) {
        log(`${acc.name} rejoining in 10s`)
        setTimeout(() => startBot(acc), 10000)
      }
    }
  })

  bot.on("error", e => log(`${acc.name} error: ${e.message}`))
}

function stopBot(name) {
  if (!bots[name]) return
  if (botState[name]) botState[name].autoRejoin = false
  bots[name].quit()
  delete bots[name]
  if (botState[name]) botState[name].status = "OFFLINE"
  log(`Stopped ${name}`)
}

/* ---------- WEBSITE ---------- */
app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AFK Control</title>
<style>
:root{
  --bg:#070b16;--card:rgba(255,255,255,.08);
  --accent:#7c7cff;--accent2:#00ffd5;
  --danger:#ff4d6d;--ok:#2bff88;--text:#eaeaff;
}
*{box-sizing:border-box}
body{margin:0;font-family:system-ui, sans-serif;background:radial-gradient(1200px 600px at top,#151a30,var(--bg));color:var(--text);overflow-x:hidden;min-height:100vh}
.screen{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;transition:.6s;z-index:10}
.hidden{opacity:0;pointer-events:none;transform:scale(1.1)}
.card{background:var(--card);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.15);border-radius:20px;padding:30px;width:90%;max-width:420px;animation:glow 3s infinite alternate}
@keyframes glow{from{box-shadow:0 0 30px rgba(124,124,255,.2)}to{box-shadow:0 0 60px rgba(0,255,213,.35)}}
input,button{width:100%;padding:14px;border-radius:14px;border:none;margin-top:12px;outline:none}
input{background:#0c1226;color:#fff;border:1px solid rgba(255,255,255,0.1)}
button{background:linear-gradient(135deg,var(--accent),var(--accent2));font-weight:800;cursor:pointer;color:#000}
button:active{transform:scale(0.98)}
.shake{animation:shake .4s;box-shadow:0 0 40px rgba(255,77,109,.8)!important}
@keyframes shake{0%{transform:translateX(0)}25%{transform:translateX(-6px)}50%{transform:translateX(6px)}75%{transform:translateX(-6px)}100%{transform:translateX(0)}}
.panel{max-width:1000px;margin:auto;padding:20px;position:relative}
.bot-item{background:var(--card);border-radius:16px;padding:14px;display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;border:1px solid rgba(255,255,255,0.05)}
.status{font-size:11px;padding:4px 10px;border-radius:999px;text-transform:uppercase;font-weight:bold}
.online{background:rgba(43,255,136,.15);color:var(--ok)}
.offline{background:rgba(255,77,109,.15);color:var(--danger)}
.connecting{background:rgba(124,124,255,.15);color:var(--accent)}
#logs{background:#040712;border-radius:14px;padding:10px;height:260px;overflow-y:auto;font-family:monospace;font-size:12px;white-space:pre-wrap;border:1px solid rgba(255,255,255,0.1)}
.btn-group button{width:auto;padding:8px 12px;font-size:11px;margin-top:0;margin-left:5px}
</style>
</head>
<body>

<div class="screen" id="loginScreen">
  <div class="card" id="loginCard">
    <h2 style="text-align:center;margin-top:0">🔐 AFK CONTROL</h2>
    <input id="keyInput" type="password" placeholder="API Key">
    <button onclick="login()">ACCESS SYSTEM</button>
  </div>
</div>

<div class="screen hidden" id="panelScreen" style="display:block;overflow-y:auto">
  <div class="panel">
    <h2>⚡ BOT DASHBOARD</h2>
    <div id="botListContainer"></div>
    
    <div style="background:var(--card);padding:15px;border-radius:16px;margin-top:20px">
      <h3>Broadcast</h3>
      <input id="targetBot" placeholder="Bot name (or leave empty)">
      <input id="chatMsg" placeholder="Message or command">
      <button onclick="sendChat()">SEND COMMAND</button>
    </div>

    <h3>System Logs</h3>
    <div id="logs"></div>
    <button style="background:#222;color:#fff;margin-bottom:50px" onclick="logout()">LOGOUT</button>
  </div>
</div>

<script>
let KEY = sessionStorage.getItem("key")
if (KEY) showPanel()

async function login(){
  const card = document.getElementById("loginCard")
  const value = document.getElementById("keyInput").value.trim()
  try {
    const r = await fetch('/status?key=' + encodeURIComponent(value))
    if (!r.ok) throw new Error()
    sessionStorage.setItem("key", value)
    KEY = value
    showPanel()
  } catch(e) {
    card.classList.add("shake")
    setTimeout(()=>card.classList.remove("shake"),400)
  }
}

function logout() {
  sessionStorage.removeItem("key")
  location.reload()
}

function showPanel(){
  document.getElementById("loginScreen").classList.add("hidden")
  document.getElementById("panelScreen").classList.remove("hidden")
  update()
  setInterval(update, 2000)
}

async function update(){
  try {
    const res = await fetch('/status?key=' + encodeURIComponent(KEY))
    if(!res.ok) return logout()
    const s = await res.json()
    
    const container = document.getElementById('botListContainer')
    container.innerHTML = ''
    
    for(const n in s){
      const st = s[n]
      const c = st.status === "ONLINE" ? "online" : st.status === "CONNECTING" ? "connecting" : "offline"
      container.innerHTML += \`
      <div class="bot-item">
        <div>
          <b>\${n}</b><br>
          <span class="status \${c}">\${st.status}</span>
          <span style="font-size:10px;opacity:0.6"> REJOIN: \${st.autoRejoin?'ON':'OFF'}</span>
        </div>
        <div class="btn-group">
          <button onclick="botAction('join', '\${n}')">JOIN</button>
          <button style="background:var(--danger)" onclick="botAction('leave', '\${n}')">STOP</button>
          <button style="background:#555" onclick="botAction('toggle', '\${n}')">AUTO</button>
        </div>
      </div>\`
    }

    const logRes = await fetch('/logs?key=' + encodeURIComponent(KEY))
    const logText = await logRes.text()
    const logDiv = document.getElementById('logs')
    logDiv.textContent = logText
    logDiv.scrollTop = logDiv.scrollHeight
  } catch(e) { console.error("Update error", e) }
}

async function botAction(type, name) {
  await fetch(\`/\${type}/\${name}?key=\${encodeURIComponent(KEY)}\`)
  update()
}

async function sendChat(){
  const bot = document.getElementById("targetBot").value
  const msg = document.getElementById("chatMsg").value
  if(!msg) return
  await fetch('/chat?key='+encodeURIComponent(KEY),{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({bot, msg})
  })
  document.getElementById("chatMsg").value = ''
}
</script>
</body>
</html>`)
})

/* ---------- API ---------- */
app.get("/join/:name", checkKey, (req,res)=>{
  const accounts = loadAccounts()
  const acc = accounts.find(a=>a.name===req.params.name)
  if (acc) startBot(acc)
  res.send("OK")
})

app.get("/leave/:name", checkKey, (req,res)=>{
  stopBot(req.params.name)
  res.send("OK")
})

app.get("/toggle/:name", checkKey, (req,res)=>{
  if(botState[req.params.name]) {
    botState[req.params.name].autoRejoin = !botState[req.params.name].autoRejoin
  }
  res.send("OK")
})

app.post("/chat", checkKey, (req,res)=>{
  const {bot, msg} = req.body
  if (bot && bots[bot]) {
    bots[bot].chat(msg)
  } else if (!bot) {
    // Broadcast to all online bots
    Object.values(bots).forEach(b => b.chat(msg))
  }
  res.send("OK")
})

app.get("/logs", checkKey, (req,res)=>res.send(logs.join("\n")))
app.get("/status", checkKey, (req,res)=>res.json(botState))

/* ---------- START ---------- */
const PORT = process.env.PORT || 3000
app.listen(PORT, ()=>log("Server running on " + PORT))
