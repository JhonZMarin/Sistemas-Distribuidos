const TIMEOUT = 5000
let previousServers = {}

function showNotification(message) {
    const container = document.getElementById("notifications")

    const notif = document.createElement("div")
    notif.className = "notification"
    notif.innerText = message

    container.appendChild(notif)

    setTimeout(() => {
        notif.classList.add("fade-out")
        setTimeout(() => notif.remove(), 500)
    }, 3000)
}

async function loadData() {
    try {
        const serversRes = await fetch("/servers")
        const metricsRes = await fetch("/metrics")

        const servers = await serversRes.json()
        const metrics = await metricsRes.json()

        const table = document.getElementById("serversTable")
        table.innerHTML = ""

        const now = Date.now()
        let activeCount = 0

        
        for (let id in previousServers) {
            if (!servers[id]) {
                showNotification(`⚠ Servidor ${id} ha muerto tragicamente`)
            }
        }

        for (let id in servers) {
            const server = servers[id]
            const timeDiff = now - server.lastPulse

            let statusClass = "status-active"
            let statusText = "Activo"

            if (timeDiff > TIMEOUT * 0.7) {
                statusClass = "status-warning"
                statusText = "Inestable"
            }

            if (timeDiff > TIMEOUT) {
                statusClass = "status-dead"
                statusText = "Timeout"
            }

            if (timeDiff <= TIMEOUT) activeCount++

            const percentage = Math.min((timeDiff / TIMEOUT) * 100, 100)

            table.innerHTML += `
                <tr>
                    <td>${server.id}</td>
                    <td>${server.url}</td>
                    <td>
                        ${timeDiff.toLocaleString()} ms
                        <div class="progress-bar">
                            <div class="progress-fill" style="width:${percentage}%"></div>
                        </div>
                    </td>
                    <td>${server.pulseCount}</td>
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
        document.getElementById("timestamp").innerText = new Date().toLocaleTimeString()

    } catch (error) {
        console.error("Error cargando datos:", error)
    }
}

loadData()
setInterval(loadData, 2000)