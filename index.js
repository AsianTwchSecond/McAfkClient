const mineflayer = require("mineflayer")
const express = require("express")
const fs = require("fs")

const app = express()
app.use(express.json())

/* ========== CONFIG ========== */
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
<title>AFK Bot Panel</title>
<style>
body{
  margin:0;
  font-family:system-ui;
  background:#0b0f1a;
  color:#eaeaff;
  padding:20px
}
.card{
  background:#151a30;
  border-radius:16px;
  padding:14px;
  margin-bottom:10px
}
.bot{
  display:flex;
  justify-content:space-between;
  align-items:center
}
.status{
  font-size:12px;
  padding:4px 10px;
  border-radius:999px
}
.online{background:#1f5;color:#000}
.offline{background:#f44}
.connecting{background:#77f}
button{
  background:#7c7cff;
  border:none;
  padding:8px 12px;
  border-radius:10px;
  margin-left:4px;
  cursor:pointer
}
#logs{
  background:#000;
  height:260px;
  overflow:auto;
  padding:10px;
  font-family:monospace;
  font-size:12px
}
</style>
</head>
<body>

<h2>⚡ AFK BOT PANEL</h2>

<div id="bots"></div>

<h3>Chat</h3>
<input id="bot" placeholder="Bot name"><br><br>
<input id="msg" placeholder="Message or command"><br><br>
<button onclick="sendChat()">SEND</button>

<h3>Logs</h3>
<div id="logs"></div>

<script>
async function update(){
  const s = await fetch('/status').then(r=>r.json())
  bots.innerHTML=''
  for(const n in s){
    const st=s[n]
    const c=st.status==="ONLINE"?"online":st.status==="CONNECTING"?"connecting":"offline"
    bots.innerHTML+=\`
      <div class="card bot">
        <div>
          <b>\${n}</b><br>
          <span class="status \${c}">\${st.status} · AR \${st.autoRejoin?'ON':'OFF'}</span>
        </div>
        <div>
          <button onclick="fetch('/join/\${n}')">JOIN</button>
          <button onclick="fetch('/leave/\${n}')">LEAVE</button>
          <button onclick="fetch('/toggle/\${n}')">AUTO</button>
        </div>
      </div>\`
  }
  logs.textContent = await fetch('/logs').then(r=>r.text())
  logs.scrollTop = logs.scrollHeight
}

async function sendChat(){
  await fetch('/chat',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({bot:bot.value,msg:msg.value})
  })
}

setInterval(update,1000)
update()
</script>

</body>
</html>`)
})

/* ---------- API ---------- */
app.get("/join/:name", (req,res)=>{
  const acc = loadAccounts().find(a=>a.name===req.params.name)
  if (acc) startBot(acc)
  res.send("OK")
})

app.get("/leave/:name", (req,res)=>{
  stopBot(req.params.name)
  res.send("OK")
})

app.get("/toggle/:name", (req,res)=>{
  botState[req.params.name].autoRejoin =
    !botState[req.params.name].autoRejoin
  res.send("OK")
})

app.post("/chat", (req,res)=>{
  const {bot,msg} = req.body
  if (bots[bot]) bots[bot].chat(msg)
  res.send("OK")
})

app.get("/logs", (req,res)=>res.send(logs.join("\n")))
app.get("/status", (req,res)=>res.json(botState))

/* ---------- START ---------- */
const PORT = process.env.PORT || 3000
app.listen(PORT, ()=>log("Server running on " + PORT))
