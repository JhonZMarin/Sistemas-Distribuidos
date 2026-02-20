const express = require("express")
const cors = require("cors")
const path = require("path")

const app = express()
const PORT = 3000
const TIMEOUT = 5000

app.use(cors())
app.use(express.json())

// 🔥 Esto permite servir archivos estáticos
app.use(express.static(path.join(__dirname, "public")))

let servers = {}
let totalTimeouts = 0

app.post("/register", (req, res) => {
    const { id, url } = req.body

    if (!id || !url) {
        return res.status(400).json({ error: "Se requiere id y url" })
    }

    servers[id] = {
        id,
        url,
        lastPulse: Date.now(),
        pulseCount: 0
    }

    console.log(`Servidor registrado en ${id} - ${url}`)
    res.json({ message: "registrado" })
})
/*
app.get("/", (req, res) => {
    res.send("Coordinator funcionando 🚀")
})*/

app.post("/pulse", (req, res) => {
    const { id } = req.body

    if (!servers[id]) {
        return res.status(400).json({ error: "No se encuentra server" })
    }

    servers[id].lastPulse = Date.now()
    servers[id].pulseCount++
    res.json({ message: "pulso recibido" })
})

app.get("/servers", (req, res) => {
    res.json(servers)
})

app.get("/metrics", (req, res) => {
    res.json({
        totalServers: Object.keys(servers).length,
        totalTimeouts
    })
})

setInterval(() => {
    const now = Date.now()

    for (let id in servers) {
        if (now - servers[id].lastPulse > TIMEOUT) {
            delete servers[id]
            totalTimeouts++
        }
    }

}, 10000)

app.listen(PORT, () => {
    console.log(`Coordinator corriendo en ${PORT}`)
})
