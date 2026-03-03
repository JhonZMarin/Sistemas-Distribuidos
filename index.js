const express = require("express")
const cors = require("cors")
const path = require("path")
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args))

const app = express()
const PORT = 3000
const TIMEOUT = 5000

app.use(cors())
app.use(express.json())

app.use(express.static(path.join(__dirname, "public")))

let servers = {}
let totalTimeouts = 0
let backups = []
let isPrimary = true


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


    replicateToBackups()
    console.log(`Servidor registrado en ${id} - ${url}`)
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

app.get("/servers", (req, res) => {
    res.json(servers)
})

app.get("/metrics", (req, res) => {
    res.json({
        totalServers: Object.keys(servers).length,
        totalTimeouts
    })
})

app.get("/backups", (req, res) => {
    res.json(backups)
})

app.post("/register-backup", (req, res) => {
    const { url } = req.body

    if (!url) {
        return res.status(400).json({ error: "URL requerida" })
    }

    if (!backups.includes(url)) {
        backups.push(url)
    }

    res.json({ message: "Backup registrado", backups })
})

app.get("/sync-workers", (req, res) => {
    res.json(Object.values(servers))
})

app.post("/replicate", (req, res) => {
    const workers = req.body

    if (!workers || !Array.isArray(workers)) {
        return res.status(400).json({
            error: "Se esperaba un array de workers"
        })
    }

    isPrimary = false

    workers.forEach(worker => {
        if (worker && worker.id) {
            servers[worker.id] = worker
        }
    })

    res.json({ message: "Replicación exitosa" })
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

app.post("/force-sync", async (req, res) => {
    await pullFromBackups()
    res.json({ message: "Sincronización desde backup ejecutada" })
})

app.listen(PORT, () => {
    console.log(`Coordinator corriendo en ${PORT}`)
})

app.get("/mode", (req, res) => {
    res.json({ mode: isPrimary ? "Primario" : "Backup" })
})

async function replicateToBackups() {
    const workers = Object.values(servers)

    for (let backup of backups) {
        try {
            await fetch(`${backup}/replicate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(workers)
            })
        } catch (error) {
            console.log("Error replicando a", backup)
        }
    }
}

async function pullFromBackups() {
    for (let backup of backups) {
        try {
            const response = await fetch(`${backup}/sync-workers`)
            const workers = await response.json()

            if (Array.isArray(workers)) {
                workers.forEach(worker => {
                    if (worker && worker.id) {
                        servers[worker.id] = worker
                    }
                })
            }

            isPrimary = true
            
            console.log("Estado recuperado desde backup")
            return
        } catch (error) {
            console.log("No se pudo sincronizar desde", backup)
        }
    }
}
