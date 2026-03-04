const express = require("express")
const cors = require("cors")
const path = require("path")
const fetch = (...args) =>
    import("node-fetch").then(({ default: fetch }) => fetch(...args))

const app = express()
const PORT = 3000
const TIMEOUT = 5000
const PUBLIC_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`

app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, "public")))

let servers = {}
let totalTimeouts = 0
let backups = []
let isPrimary = true
let primaryCoordinatorUrl = null


function normalizeUrl(url) {
    return url.trim().replace(/\/$/, "")
}


app.post("/register", (req, res) => {
    const { id, url } = req.body

    if (!id || !url) {
        return res.status(400).json({ error: "Se requiere id y url" })
    }

    servers[id] = {
        id,
        url,
        lastPulse: Date.now(),
        pulseCount: 0,
        origin: "local"
    }

    replicateToBackups()

    res.json({ message: "registrado" })
})


app.post("/pulse", (req, res) => {
    const { id } = req.body

    if (!servers[id]) {
        return res.status(400).json({ error: "No se encuentra server" })
    }

    servers[id].lastPulse = Date.now()
    servers[id].pulseCount++

    replicateToBackups()

    res.json({ message: "pulso recibido" })
})

app.post("/replicate", (req, res) => {

    let workers = []

    if (Array.isArray(req.body)) {
        workers = req.body
    } else if (Array.isArray(req.body.workers)) {
        workers = req.body.workers
    } else {
        return res.status(400).json({ error: "Formato inválido" })
    }

    isPrimary = false

    workers.forEach(worker => {
        if (!worker || !worker.id) return

  
        if (
            !servers[worker.id] ||
            worker.lastPulse > servers[worker.id].lastPulse
        ) {
            servers[worker.id] = {
                ...worker,
                origin: "replicated"
            }
        }
    })

    res.json({ message: "Replicación exitosa" })
})


app.post("/register-backup", async (req, res) => {

    let { url } = req.body

    if (!url) {
        return res.status(400).json({ error: "URL requerida" })
    }

    url = normalizeUrl(url)
    const selfUrl = normalizeUrl(PUBLIC_URL)

    if (url === selfUrl) {
        return res.status(400).json({ error: "No puedes registrarte a ti mismo" })
    }

    if (!backups.includes(url)) {
        backups.push(url)
        console.log("Backup agregado:", url)
    }

  
    fetch(`${url}/coordinator-role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            role: "backup",
            primaryUrl: selfUrl
        })
    }).catch(() => {
        console.log("⚠ No se pudo notificar al backup (puede estar apagado)")
    })

    res.json({
        message: "Backup registrado correctamente",
        backups
    })
})


app.post("/coordinator-role", (req, res) => {

    const { role, primaryUrl } = req.body

    if (role === "backup") {
        isPrimary = false
        primaryCoordinatorUrl = primaryUrl
    } else {
        isPrimary = true
        primaryCoordinatorUrl = null
    }

    res.json({ message: "Rol actualizado" })
})


app.get("/servers", (req, res) => res.json(servers))
app.get("/backups", (req, res) => res.json(backups))
app.get("/mode", (req, res) =>
    res.json({ mode: isPrimary ? "Primario" : "Backup" })
)

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
}, 2000)


async function replicateToBackups() {
    const workers = Object.values(servers)

    for (let backup of backups) {
        try {
            await fetch(`${backup}/replicate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(workers)
            })
        } catch {
            console.log("Error replicando a", backup)
        }
    }
}


app.listen(PORT, () => {
    console.log(`Coordinator corriendo en ${PORT}`)
})