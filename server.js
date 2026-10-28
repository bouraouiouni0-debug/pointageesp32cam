const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

let pending = false;   // ordre "prendre photo" en attente
let lastSeen = 0;      // dernier contact de l'ESP32
let photos = [];       // { id, date, time, name, data }
let nextId = 1;
const MAX_PHOTOS = 50;

// ESP32 : demande s'il doit prendre une photo
app.get("/api/command", (req, res) => {
  lastSeen = Date.now();
  const p = pending;
  pending = false;
  res.json({ capture: p });
});

// ESP32 : envoie la photo
app.post("/api/upload", express.raw({ type: "image/jpeg", limit: "5mb" }), (req, res) => {
  lastSeen = Date.now();
  photos.push({
    id: nextId++,
    date: req.query.date || "--",
    time: req.query.time || "--",
    name: req.query.name || "",
    data: req.body,
  });
  if (photos.length > MAX_PHOTOS) photos.shift();
  res.json({ ok: true });
});

// Page web : bouton
app.post("/api/capture", (req, res) => {
  pending = true;
  res.json({ ok: true });
});

app.get("/api/list", (req, res) => {
  res.json({
    online: Date.now() - lastSeen < 8000,
    pending,
    rows: photos.map(p => ({ id: p.id, date: p.date, time: p.time })).reverse(),
  });
});

app.get("/photo/:id", (req, res) => {
  const p = photos.find(x => x.id == req.params.id);
  if (!p) return res.status(404).send("Introuvable");
  res.set("Content-Type", "image/jpeg").send(p.data);
});

app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ESP32-CAM</title>
<style>
body{font-family:Arial;text-align:center;margin:20px;background:#f4f4f4}
button{padding:14px 30px;font-size:18px;background:#1976d2;color:#fff;border:none;border-radius:8px;cursor:pointer}
button:disabled{background:#999}
table{margin:25px auto;border-collapse:collapse;background:#fff}
th,td{border:1px solid #999;padding:8px 14px}
th{background:#1976d2;color:#fff}
img{width:160px;border-radius:4px}
#st{font-weight:bold;margin:10px}
</style></head><body>
<h2>ESP32-CAM - Journal photos</h2>
<div id="st">...</div>
<button id="btn" onclick="snap()">Prendre une photo</button>
<table><thead><tr><th>Date</th><th>Temps</th><th>Photo</th></tr></thead><tbody id="tb"></tbody></table>
<script>
let last = "";
async function snap(){
  await fetch("/api/capture",{method:"POST"});
  document.getElementById("btn").disabled = true;
}
async function refresh(){
  try{
    const r = await (await fetch("/api/list")).json();
    const st = document.getElementById("st");
    st.textContent = r.online ? "ESP32 : en ligne" : "ESP32 : hors ligne";
    st.style.color = r.online ? "green" : "red";
    document.getElementById("btn").disabled = r.pending;
    const key = r.rows.map(x=>x.id).join(",");
    if(key !== last){
      last = key;
      document.getElementById("tb").innerHTML = r.rows.map(x =>
        "<tr><td>"+x.date+"</td><td>"+x.time+"</td><td><a href='/photo/"+x.id+"' target='_blank'><img src='/photo/"+x.id+"'></a></td></tr>"
      ).join("");
    }
  }catch(e){}
}
setInterval(refresh, 2000); refresh();
</script></body></html>`);
});

app.listen(PORT, () => console.log("Serveur sur port " + PORT));
