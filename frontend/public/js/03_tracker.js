
document.addEventListener('DOMContentLoaded', () => {
    // Alleen uitvoeren als we op de progress pagina zijn
    if (document.getElementById('page-progress')) {
        updateTrackerUI();
    }
});

async function updateTrackerUI() {
    const statusText = document.getElementById('tracker-status');
    const progressBar = document.getElementById('progress-bar');
    const weekMsg = document.getElementById('week-status-msg'); // De extra regel voor de melding

    try {
        // 1. Haal de data op van de server (historie.json)
        const res = await fetch('/api/historie');
        const data = await res.json();
        const ritten = data.ritten || [];

        // 2. Bereken unieke weken
        const doel = 40;
        const dezeWeekNummer = (d) => {
            const jan1 = new Date(d.getFullYear(), 0, 1);
            return Math.ceil((((d - jan1) / 86400000) + jan1.getDay() + 1) / 7);
        };

        const uniekeWeken = new Set(ritten.map(rit => dezeWeekNummer(new Date(rit.datum)))).size;

        // --- HIER ZIJN DE EXTRA REGELS DIE IK BEDOELDE ---
        const alGeregistreerdDezeWeek = ritten.some(rit => dezeWeekNummer(new Date(rit.datum)) === dezeWeekNummer(new Date()));

        if (weekMsg) {
            weekMsg.innerText = alGeregistreerdDezeWeek ? "✅ Lekker bezig! Je weekdoel is behaald." : "⚠️ Vergeet niet deze week een rit te registreren.";
            weekMsg.style.color = alGeregistreerdDezeWeek ? "#27ae60" : "#e67e22";
            weekMsg.style.fontWeight = "bold";
            weekMsg.style.marginTop = "10px";
            weekMsg.style.display = "block";
        }
        // ------------------------------------------------

        const percentage = Math.min((uniekeWeken / doel) * 100, 100);

        // 3. Update de UI elementen
        if (statusText) {
            statusText.innerText = `${uniekeWeken} van de ${doel} weken behaald`;
        }
        if (progressBar) {
            progressBar.style.width = `${percentage}%`;
        }

        // 4. Update ook de lijst met ritten onderaan
        toonRecenteRitten(ritten);

    } catch (err) {
        console.error("Fout bij bijwerken tracker:", err);
        if (statusText) statusText.innerText = "Fout bij laden data...";
    }
}

function toonRecenteRitten(ritten) {
    const listContainer = document.getElementById('recent-trips-list');
    if (!listContainer) return;

    const laatsteRitten = ritten.slice(-5).reverse();

    listContainer.innerHTML = '<h3>Laatste ritten</h3>' + laatsteRitten.map(rit => `
        <div class="trip-log-item enhanced">
            <div class="trip-info">
                <div class="trip-main-line">
                    <strong>Lijn ${rit.lijn}</strong>
                    <span class="trip-date">${rit.datum}</span>
                </div>
                <div class="trip-route-detail">
                    <span class="trip-time">${rit.vertrek || '--:--'}</span> 
                    ${rit.van ? rit.van.split(',')[0] : '...'} 
                    <i data-lucide="arrow-right" style="width:12px; height:12px;"></i> 
                    <span class="trip-time">${rit.aankomst || '--:--'}</span> 
                    ${rit.naar ? rit.naar.split(',')[0] : '...'}
                </div>
            </div>
            <button onclick="bevestigVerwijderen(${rit.id})" class="btn-delete-icon">
                <i data-lucide="trash-2"></i>
            </button>
        </div>
    `).join('');

    if (window.lucide) lucide.createIcons();
}

function bevestigVerwijderen(id) {
    if (confirm("Weet je zeker dat je deze rit wilt verwijderen?")) {
        verwijderRit(id);
    }
}

async function verwijderRit(id) {
    try {
        const response = await fetch(`/api/historie/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            updateTrackerUI();
        } else {
            alert("Verwijderen mislukt op de server.");
        }
    } catch (err) {
        console.error("Fout bij verwijderen:", err);
    }
}