// --- 1. FUNCTIES (Eerst definiëren) ---

// Functie om suggesties op te halen
async function setupSuggesties(inputId, suggestieId) {
    const input = document.getElementById(inputId);
    const lijst = document.getElementById(suggestieId);
    if (!input || !lijst) return;

    input.addEventListener('input', async (e) => {
        const waarde = e.target.value;
        if (waarde.length < 3) {
            lijst.innerHTML = '';
            return;
        }
        try {
            const response = await fetch(`/api/suggesties/${waarde}`);
            const suggesties = await response.json();
            lijst.innerHTML = '';
            suggesties.forEach(s => {
                const div = document.createElement('div');
                div.className = 'suggestie-item';
                div.innerText = s.stop_name;
                div.onclick = () => {
                    input.value = s.stop_name;
                    input.dataset.stopId = s.stop_id;
                    lijst.innerHTML = '';
                };
                lijst.appendChild(div);
            });
        } catch (err) { console.error("Suggestie fout:", err); }
    });
}

function updateProgress(percentage, statusText) {
    const statusEl = document.getElementById('tracker-status');
    const barEl = document.getElementById('progress-bar');
    if (statusEl && barEl) {
        statusEl.textContent = statusText;
        barEl.style.width = percentage + '%';
    }
}

// --- 2. EXECUTIE (Daarna uitvoeren) ---

document.addEventListener('DOMContentLoaded', () => {
    // Nu is setupSuggesties bekend en zal hij niet meer crashen
    setupSuggesties('van-input', 'van-suggesties');
    setupSuggesties('naar-input', 'naar-suggesties');

    if (typeof fetchProgress === 'function') {
        fetchProgress();
    }

    const checkinBtn = document.getElementById('btn-checkin');
    if (checkinBtn) {
        checkinBtn.addEventListener('click', async () => {
            if (typeof API !== 'undefined') {
                const result = await API.doCheckIn();
                alert(result.message);
                fetchProgress();
            }
        });
    }

    if (window.lucide) {
        lucide.createIcons();
    }

    const navItems = document.querySelectorAll('.nav-item');
    const pages = document.querySelectorAll('.page');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const target = item.getAttribute('data-target');

            // 1. Verander de actieve tab in de nav
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            // 2. Wissel de pagina-weergave
            pages.forEach(p => {
                p.classList.remove('active');
                if (p.id === target) p.classList.add('active');
            });
        });
    });

    // Wissel-knop functionaliteit (Van <-> Naar)
    const switchBtn = document.querySelector('.btn-switch');
    if (switchBtn) {
        switchBtn.addEventListener('click', () => {
            const vanInput = document.getElementById('van-input');
            const naarInput = document.getElementById('naar-input');

            // Wissel de tekstwaarden
            const tempValue = vanInput.value;
            vanInput.value = naarInput.value;
            naarInput.value = tempValue;

            // Wissel ook de data-ids (belangrijk voor de API straks)
            const tempId = vanInput.dataset.stopId;
            vanInput.dataset.stopId = naarInput.dataset.stopId;
            naarInput.dataset.stopId = tempId;

            // Geef een kleine visuele feedback (optioneel)
            console.log("Richting gewisseld");
        });
    }
});

// Zoek de knop op
const planBtn = document.getElementById('btn-plan');

if (planBtn) {
    planBtn.addEventListener('click', async () => {
        const vanInput = document.getElementById('van-input');
        const naarInput = document.getElementById('naar-input');
        const stopId = vanInput.dataset.stopId;
        const resultatenContainer = document.getElementById('rit-resultaten');

        if (!stopId) {
            alert("Selecteer eerst een vertrekhalte uit de suggesties.");
            return;
        }

        // 1. Visuele feedback: laden
        resultatenContainer.innerHTML = '<div class="loading-spinner">Dienstregeling ophalen...</div>';
        resultatenContainer.style.display = 'block';

        try {
            // 2. Data ophalen van de server
            const response = await fetch(`/api/vertrektijden/${stopId}`);
            const data = await response.json();

            // 3. Resultaten tekenen
            renderReisResultaten(data, vanInput.value, naarInput.value);

            // Scroll naar de resultaten voor mobiel gemak
            resultatenContainer.scrollIntoView({ behavior: 'smooth' });

        } catch (error) {
            resultatenContainer.innerHTML = '<p class="error">Kon geen verbinding maken met de planner.</p>';
        }
    });
}

// In ui.js bij de event listener voor de plan-knop:
planBtn.addEventListener('click', async () => {
    const vanId = document.getElementById('van-input').dataset.stopId;
    const naarId = document.getElementById('naar-input').dataset.stopId;

    if (!vanId || !naarId) {
        alert("Selecteer beide haltes uit de lijst.");
        return;
    }

    try {
        // We roepen nu de nieuwe /api/plan aan met TWEE IDs
        const response = await fetch(`/api/plan?from=${vanId}&to=${naarId}`);
        const ritten = await response.json();

        // Zorg dat je render-functie de nieuwe namen (vertrektijd/aankomsttijd) gebruikt
        renderReisResultaten(ritten, vanInput.value, naarInput.value);
    } catch (err) {
        console.error("Fout bij plannen:", err);
    }
});

function renderReisResultaten(ritten, van, naar) {
    const container = document.getElementById('rit-resultaten');

    if (ritten.length === 0) {
        container.innerHTML = '<p class="status-msg">Geen bussen gevonden voor deze halte.</p>';
        return;
    }

    let html = `<h3 class="results-title">Vertrek vanaf ${van}</h3>`;

    ritten.forEach(rit => {
        const vertrekTijd = rit.arrival_time.substring(0, 5);
        // We simuleren een aankomsttijd (+15 min) voor de NS-look
        const aankomstTijd = rit.arrival_time.split(':');
        const simulatedArrival = `${aankomstTijd[0]}:${(parseInt(aankomstTijd[1]) + 15).toString().padStart(2, '0')}`;

        html += `
            <div class="trip-option">
                <div class="trip-main">
                    <div class="trip-time">
                        <span class="time-start">${vertrekTijd}</span>
                        <i data-lucide="arrow-right" class="arrow-icon"></i>
                        <span class="time-end">${simulatedArrival}</span>
                    </div>
                    <div class="trip-details">
                        <span class="line-pill">${rit.route_short_name}</span>
                        <span class="headsign">${rit.trip_headsign}</span>
                    </div>
                </div>
                <div class="trip-duration">
                    <small>15 min</small>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
    lucide.createIcons(); // Herstart icoontjes voor de nieuwe elementen
}

function renderReisResultaten(ritten, van, naar) {
    const container = document.getElementById('rit-resultaten');

    if (ritten.length === 0) {
        container.innerHTML = '<p class="status-msg">Geen bussen gevonden voor deze halte.</p>';
        return;
    }

    let html = `<h3 class="results-title">Vertrek vanaf ${van}</h3>`;

    ritten.forEach(rit => {
        const vertrekTijd = rit.arrival_time.substring(0, 5);
        // We simuleren een aankomsttijd (+15 min) voor de NS-look
        const aankomstTijd = rit.arrival_time.split(':');
        const simulatedArrival = `${aankomstTijd[0]}:${(parseInt(aankomstTijd[1]) + 15).toString().padStart(2, '0')}`;

        html += `
            <div class="trip-option">
                <div class="trip-main">
                    <div class="trip-time">
                        <span class="time-start">${vertrekTijd}</span>
                        <i data-lucide="arrow-right" class="arrow-icon"></i>
                        <span class="time-end">${simulatedArrival}</span>
                    </div>
                    <div class="trip-details">
                        <span class="line-pill">${rit.route_short_name}</span>
                        <span class="headsign">${rit.trip_headsign}</span>
                    </div>
                </div>
                <div class="trip-duration">
                    <small>15 min</small>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
    lucide.createIcons(); // Herstart icoontjes voor de nieuwe elementen
}

// Hulpmiddel om de lijst op het scherm te zetten
function tekenResultaten(tijden, halteNaam) {
    const lijst = document.getElementById('rit-resultaten');

    if (tijden.length === 0) {
        lijst.innerHTML = '<p class="status-msg">Geen bussen meer voor vandaag.</p>';
        return;
    }

    let html = `<h3>Vertrektijden ${halteNaam}</h3>`;

    tijden.forEach(t => {
        const tijdKort = t.arrival_time.substring(0, 5);
        html += `
            <div class="bus-result-item">
                <div class="bus-meta">
                    <span class="line-badge">${t.route_short_name}</span>
                    <span class="destination">${t.trip_headsign}</span>
                </div>
                <div class="bus-time">${tijdKort}</div>
            </div>
        `;
    });

    lijst.innerHTML = html;
}