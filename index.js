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
  return JSON.parse(fs.readFileSync("./accounts.json", "utf8"))
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
    version: false
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
    clearInterval(bot.jumpTimer)
    delete bots[acc.name]
    botState[acc.name].status = "OFFLINE"

    if (botState[acc.name].autoRejoin) {
      log(`${acc.name} rejoining in 10s`)
      setTimeout(() => startBot(acc), 10000)
    }
  })

  bot.on("error", e => log(`${acc.name} error: ${e.message}`))
}

function stopBot(name) {
  if (!bots[name]) return
  botState[name].autoRejoin = false
  bots[name].quit()
  delete bots[name]
  botState[name].status = "OFFLINE"
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
body{margin:0;font-family:system-ui;background:radial-gradient(1200px 600px at top,#151a30,var(--bg));color:var(--text);overflow:hidden}
.screen{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;transition:.6s}
.hidden{opacity:0;pointer-events:none;transform:scale(1.1)}
.card{background:var(--card);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.15);border-radius:20px;padding:30px;width:90%;max-width:420px;animation:glow 3s infinite alternate}
@keyframes glow{from{box-shadow:0 0 30px rgba(124,124,255,.2)}to{box-shadow:0 0 60px rgba(0,255,213,.35)}}
input,button{width:100%;padding:14px;border-radius:14px;border:none;margin-top:12px}
input{background:#0c1226;color:#fff}
button{background:linear-gradient(135deg,var(--accent),var(--accent2));font-weight:800}
.shake{animation:shake .4s;box-shadow:0 0 40px rgba(255,77,109,.8)!important}
@keyframes shake{0%{transform:translateX(0)}25%{transform:translateX(-6px)}50%{transform:translateX(6px)}75%{transform:translateX(-6px)}100%{transform:translateX(0)}}
.panel{max-width:1000px;margin:auto;padding:20px}
.bot{background:var(--card);border-radius:16px;padding:14px;display:flex;justify-content:space-between;margin-bottom:10px}
.status{font-size:12px;padding:4px 10px;border-radius:999px}
.online{background:rgba(43,255,136,.15);color:var(--ok)}
.offline{background:rgba(255,77,109,.15);color:var(--danger)}
.connecting{background:rgba(124,124,255,.15);color:var(--accent)}
#logs{background:#040712;border-radius:14px;padding:10px;height:260px;overflow:auto;font-family:monospace;font-size:12px}
</style>
</head>
<body>

<div class="screen" id="login">
  <div class="card" id="loginCard">
    <h2>🔐 AFK CONTROL</h2>
    <input id="keyInput" placeholder="API Key">
    <button onclick="login()">ACCESS</button>
  </div>
</div>

<div class="screen hidden" id="panel">
  <div class="panel">
    <h2>⚡ BOT PANEL</h2>
    <div id="bots"></div>
    <input id="bot" placeholder="Bot name">
    <input id="msg" placeholder="Message or command">
    <button onclick="sendChat()">SEND</button>
    <h3>Logs</h3>
    <div id="logs"></div>
  </div>
</div>

<script>
let KEY = sessionStorage.getItem("key")
if (KEY) showPanel()

async function login(){
  const value = document.getElementById("keyInput").value.trim()
  const r = await fetch('/status?key=' + value)
  if (!r.ok){
    loginCard.classList.add("shake")
    setTimeout(()=>loginCard.classList.remove("shake"),400)
    return
  }
  sessionStorage.setItem("key", value)
  KEY = value
  showPanel()
}

function showPanel(){
  login.classList.add("hidden")
  panel.classList.remove("hidden")
  update()
}

async function update(){
  const s = await fetch('/status?key=' + KEY).then(r=>r.json())
  bots.innerHTML=''
  for(const n in s){
    const st=s[n]
    const c=st.status==="ONLINE"?"online":st.status==="CONNECTING"?"connecting":"offline"
    bots.innerHTML+=\`
    <div class="bot">
      <div><b>\${n}</b><br><span class="status \${c}">\${st.status} · AR \${st.autoRejoin?'ON':'OFF'}</span></div>
      <div>
        <button onclick="fetch('/join/\${n}?key='+KEY)">JOIN</button>
        <button onclick="fetch('/leave/\${n}?key='+KEY)">LEAVE</button>
        <button onclick="fetch('/toggle/\${n}?key='+KEY)">AUTO</button>
      </div>
    </div>\`
  }
  logs.textContent = await fetch('/logs?key='+KEY).then(r=>r.text())
  logs.scrollTop = logs.scrollHeight
}

async function sendChat(){
  await fetch('/chat?key='+KEY,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({bot:bot.value,msg:msg.value})
  })
}

setInterval(update,1000)
</script>
</body>
</html>`)
})

/* ---------- API ---------- */
app.get("/join/:name", checkKey, (req,res)=>{
  const acc = loadAccounts().find(a=>a.name===req.params.name)
  if (acc) startBot(acc)
  res.send("OK")
})

app.get("/leave/:name", checkKey, (req,res)=>{
  stopBot(req.params.name)
  res.send("OK")
})

app.get("/toggle/:name", checkKey, (req,res)=>{
  botState[req.params.name].autoRejoin = !botState[req.params.name].autoRejoin
  res.send("OK")
})

app.post("/chat", checkKey, (req,res)=>{
  const {bot,msg} = req.body
  if (bots[bot]) bots[bot].chat(msg)
  res.send("OK")
})

app.get("/logs", checkKey, (req,res)=>res.send(logs.join("\n")))
app.get("/status", checkKey, (req,res)=>res.json(botState))

/* ---------- START ---------- */
const PORT = process.env.PORT || 3000
app.listen(PORT, ()=>log("Server running on " + PORT))
