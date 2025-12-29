// 1. Functie om de tijden-container te sluiten
function sluitTijden() {
    document.getElementById('vertrektijden-container').style.display = 'none';
}

// 2. Functie om de vertrektijden mooi in de UI te tonen
async function toonVertrektijden(stopId, stopName) {
    const container = document.getElementById('vertrektijden-container');
    const lijst = document.getElementById('tijden-lijst');
    const titel = document.getElementById('halte-naam-titel');

    titel.innerText = stopName;
    lijst.innerHTML = '<p style="font-size: 0.9rem;">Laden...</p>';
    container.style.display = 'block';

    container.scrollIntoView({ behavior: 'smooth' });

    try {
        const response = await fetch(`/api/vertrektijden/${stopId}`);
        const tijden = await response.json();

        if (tijden.length === 0) {
            lijst.innerHTML = '<p style="font-size: 0.9rem; color: #e74c3c;">Geen bussen meer voor vandaag.</p>';
            return;
        }

        lijst.innerHTML = '';
        tijden.forEach(t => {
            const item = document.createElement('div');
            item.style = "display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee;";

            // Tijd inkorten naar HH:MM
            const korteTijd = t.arrival_time.substring(0, 5);

            item.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="background: #3498db; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 0.9rem;">
                        ${t.route_short_name}
                    </span>
                    <span style="font-weight: 500;">${t.trip_headsign}</span>
                </div>
                <div style="font-weight: bold; color: #2ecc71;">${korteTijd}</div>
            `;
            lijst.appendChild(item);
        });
    } catch (error) {
        lijst.innerHTML = '<p>Fout bij ophalen tijden.</p>';
    }
}

// 3. Luisteren naar de Zoek-knop
document.getElementById('btn-zoek').addEventListener('click', () => {
    const lijnNummer = document.getElementById('lijn-input').value;
    if (lijnNummer) {
        haalHaltesOp(lijnNummer);
    }
});

// 4. De hoofdfunctie om haltes op te halen
async function haalHaltesOp(nummer) {
    const lijstDiv = document.getElementById('resultaten-lijst');
    lijstDiv.innerHTML = '<p style="text-align:center;">Haltes ophalen...</p>';

    try {
        const response = await fetch(`/api/lijn/${nummer}`);
        const haltes = await response.json();

        if (haltes.length === 0) {
            lijstDiv.innerHTML = '<p>Geen haltes gevonden bij Connexxion.</p>';
            return;
        }

        lijstDiv.innerHTML = '';
        haltes.forEach(halte => {
            const halteKaart = document.createElement('div');
            halteKaart.style = "padding: 12px; border-bottom: 1px solid #eee; display: flex; align-items: center; gap: 10px; cursor: pointer;";
            halteKaart.innerHTML = `
                <span style="font-size: 1.2rem;">📍</span>
                <div>
                    <div style="font-weight: bold;">${halte.stop_name}</div>
                    <div style="font-size: 0.8rem; color: #888;">ID: ${halte.stop_id}</div>
                </div>
            `;

            // HIER IS DE AANPASSING: We roepen de nieuwe functie aan
            halteKaart.onclick = () => toonVertrektijden(halte.stop_id, halte.stop_name);

            lijstDiv.appendChild(halteKaart);
        });
    } catch (error) {
        lijstDiv.innerHTML = '<p>Fout bij verbinden met server.</p>';
    }
}

async function haalLiveTijden(stopId) {
    // We gebruiken de publieke OVapi voor echte real-time data
    const response = await fetch(`https://v0.ovapi.nl/stopareacode/${stopId}`);
    const data = await response.json();

    // De data van OVapi is heel gedetailleerd. Hier kunnen we vertragingen 
    // uitrekenen door 'TargetArrivalTime' te vergelijken met 'ExpectedArrivalTime'.
    console.log("Live data ontvangen:", data);
    return data;
}

// Functie om suggesties op te halen en te tonen
async function setupSuggesties(inputId, suggestieId) {
    const input = document.getElementById(inputId);
    const lijst = document.getElementById(suggestieId);

    input.addEventListener('input', async (e) => {
        const waarde = e.target.value;
        if (waarde.length < 3) {
            lijst.innerHTML = '';
            return;
        }

        const response = await fetch(`/api/suggesties/${waarde}`);
        const suggesties = await response.json();

        lijst.innerHTML = '';
        suggesties.forEach(s => {
            const div = document.createElement('div');
            div.className = 'suggestie-item';
            div.style = "padding: 10px; border-bottom: 1px solid #eee; cursor: pointer; background: white;";
            div.innerText = s.stop_name;
            div.onclick = () => {
                input.value = s.stop_name;
                input.dataset.stopId = s.stop_id; // Sla de ID op voor later
                lijst.innerHTML = '';
            };
            lijst.appendChild(div);
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // Activeer de suggesties pas als de HTML er echt is
    setupSuggesties('van-input', 'van-suggesties');
    setupSuggesties('naar-input', 'naar-suggesties');
});