const TIMEOUT = 5000
let previousServers = {}


async function loadData() {

    try {

        const servers = await (await fetch("/servers")).json()
        const metrics = await (await fetch("/metrics")).json()
        const backups = await (await fetch("/backups")).json()
        const modeData = await (await fetch("/mode")).json()

        const table = document.getElementById("serversTable")
        table.innerHTML = ""

        const now = Date.now()
        let activeCount = 0

        document.getElementById("mode").innerText = modeData.mode

        for (let id in servers) {

            const server = servers[id]
            const timeDiff = now - server.lastPulse

            let statusClass = "status-active"
            let statusText = "Activo"

            if (timeDiff > TIMEOUT) {
                statusClass = "status-dead"
                statusText = "Timeout"
            }

            if (timeDiff <= TIMEOUT) activeCount++

            const originLabel =
                server.origin === "replicated"
                    ? "🌐 Replicado"
                    : "🖥 Local"

            table.innerHTML += `
                <tr class="${server.origin === "replicated" ? "replicated-row" : ""}">
                    <td>${server.id}</td>
                    <td>${server.url}</td>
                    <td>${timeDiff} ms</td>
                    <td>${server.pulseCount || 0}</td>
                    <td>${originLabel}</td>
                    <td class="${statusClass}">
                        <span class="pulse-dot" id="dot-${server.id}"></span>
                        ${statusText}
                    </td>
                </tr>
            `

 
            if (
                previousServers[id] &&
                server.pulseCount > previousServers[id].pulseCount
            ) {
                setTimeout(() => {
                    const dot = document.getElementById(`dot-${server.id}`)
                    if (dot) {
                        dot.classList.add("pulse-animate")
                        setTimeout(() => dot.classList.remove("pulse-animate"), 400)
                    }
                }, 50)
            }
        }

        previousServers = JSON.parse(JSON.stringify(servers))

        document.getElementById("totalServers").innerText = metrics.totalServers
        document.getElementById("activeServers").innerText = activeCount
        document.getElementById("totalTimeouts").innerText = metrics.totalTimeouts
        document.getElementById("timestamp").innerText =
            new Date().toLocaleTimeString()

        document.getElementById("totalBackups").innerText = backups.length


        const backupList = document.getElementById("backupList")
        if (backupList) {
            backupList.innerHTML = ""
            backups.forEach(b => {
                backupList.innerHTML += `<li>${b}</li>`
            })
        }

    } catch (err) {
        console.error("Error cargando datos:", err)
    }
}


async function registerBackup() {

    const input = document.getElementById("backupUrl")
    const url = input.value.trim()

    if (!url) {
        alert("Debes ingresar una URL")
        return
    }

    try {

        const response = await fetch("/register-backup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url })
        })

        const data = await response.json()

        if (!response.ok) {
            alert(data.error || "Error al registrar backup")
            return
        }

        input.value = ""
        loadData()

    } catch (err) {
        console.error("Error registrando backup:", err)
        alert("No se pudo registrar el backup")
    }
}


async function forceSync() {

    try {
        await fetch("/force-sync", {
            method: "POST"
        })
        alert("Sincronización forzada ejecutada")
    } catch {
        alert("Error al sincronizar")
    }
}


setInterval(loadData, 2000)
loadData()