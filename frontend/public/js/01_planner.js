import { getBusStyle } from './06_buskleuren.js';

document.addEventListener('DOMContentLoaded', () => {
    const vanInput = document.getElementById('van-input');
    const vanSuggesties = document.getElementById('van-suggesties');
    const naarInput = document.getElementById('naar-input');
    const naarSuggesties = document.getElementById('naar-suggesties');
    const btnPlan = document.getElementById('btn-plan');
    const btnSwitch = document.querySelector('.btn-switch');

    herstelLaatsteReis();

    // Zorgt dat de details sluiten als je op de onderste navigatie klikt
    document.querySelectorAll('.nav-item').forEach(knop => {
        knop.addEventListener('click', () => {
            closeDetails();
        });
    });

    if (btnSwitch) {
        btnSwitch.addEventListener('click', () => {
            const tempVal = vanInput.value;
            vanInput.value = naarInput.value;
            naarInput.value = tempVal;
            localStorage.setItem('laatsteVan', vanInput.value);
            localStorage.setItem('laatsteNaar', naarInput.value);
        });
    }

    let userLocation = null;
    navigator.geolocation.getCurrentPosition(pos => {
        userLocation = { lat: pos.coords.latitude, lon: pos.coords.longitude };
    }, err => console.log("Locatie geweigerd"));

    async function setupSuggesties(inputEl, suggestieEl) {
        if (!inputEl || !suggestieEl) return;
        inputEl.addEventListener('input', async () => {
            const zoekterm = inputEl.value;
            if (zoekterm.length < 2) {
                suggestieEl.innerHTML = '';
                return;
            }
            try {
                let url = `/api/suggesties/${encodeURIComponent(zoekterm)}`;
                if (userLocation) url += `?lat=${userLocation.lat}&lon=${userLocation.lon}`;
                const response = await fetch(url);
                const haltes = await response.json();
                suggestieEl.innerHTML = haltes.map(h => `
                    <div class="suggestie-item" onclick="selecteerHalte('${inputEl.id}', '${h.stop_name}', '${suggestieEl.id}')">
                        ${h.stop_name}
                    </div>
                `).join('');
            } catch (err) {
                console.error("Fout bij ophalen suggesties:", err);
            }
        });
        document.addEventListener('click', (e) => {
            if (!inputEl.contains(e.target) && !suggestieEl.contains(e.target)) {
                suggestieEl.innerHTML = '';
            }
        });
    }

    setupSuggesties(vanInput, vanSuggesties);
    setupSuggesties(naarInput, naarSuggesties);

    if (btnPlan) {
        btnPlan.addEventListener('click', planReis);
    }
});

function selecteerHalte(inputId, naam, suggestieId) {
    document.getElementById(inputId).value = naam;
    document.getElementById(suggestieId).innerHTML = '';
}

async function planReis() {
    const van = document.getElementById('van-input').value;
    const naar = document.getElementById('naar-input').value;
    const container = document.getElementById('rit-resultaten');
    if (!van || !naar) return alert("Vul haltes in");
    container.innerHTML = '<p>Zoeken...</p>';
    container.classList.add('active');
    try {
        const url = `/api/plan?fromName=${encodeURIComponent(van)}&toName=${encodeURIComponent(naar)}`;
        const res = await fetch(url);
        const ritten = await res.json();
        if (Array.isArray(ritten)) {
            localStorage.setItem('laatsteVan', van);
            localStorage.setItem('laatsteNaar', naar);
            localStorage.setItem('laatsteRitten', JSON.stringify(ritten));
            renderPlannerResultaten(ritten);
        } else {
            container.innerHTML = `<p>Geen ritten gevonden.</p>`;
        }
    } catch (err) {
        console.error("Planner fout:", err);
        container.innerHTML = '<p>Fout bij ophalen reisadvies.</p>';
    }
}

function herstelLaatsteReis() {
    const van = localStorage.getItem('laatsteVan');
    const naar = localStorage.getItem('laatsteNaar');
    const rittenRaw = localStorage.getItem('laatsteRitten');
    if (van) document.getElementById('van-input').value = van;
    if (naar) document.getElementById('naar-input').value = naar;
    if (rittenRaw) {
        try {
            const ritten = JSON.parse(rittenRaw);
            if (Array.isArray(ritten)) {
                renderPlannerResultaten(ritten);
            }
        } catch (e) {
            localStorage.removeItem('laatsteRitten');
        }
    }
}

function formatTijd(tijdString) {
    if (!tijdString) return "--:--";
    const [uren, minuten] = tijdString.split(':').map(Number);
    const genormaliseerdeUren = uren % 24;
    return `${String(genormaliseerdeUren).padStart(2, '0')}:${String(minuten).padStart(2, '0')}`;
}

function berekenDuur(vertrek, aankomst) {
    if (!vertrek || !aankomst) return "0:00";
    const v = vertrek.split(':').map(Number);
    const a = aankomst.split(':').map(Number);
    const vanMin = (v[0] * 60) + v[1];
    const naarMin = (a[0] * 60) + a[1];
    let diff = naarMin - vanMin;
    if (diff < 0) diff += 1440;
    const u = Math.floor(diff / 60);
    const m = diff % 60;
    return `${u}:${String(m).padStart(2, '0')}`;
}

function renderPlannerResultaten(data) {
    const container = document.getElementById('rit-resultaten');
    if (!container) return;
    container.innerHTML = '';
    container.classList.add('active');
    data.map(ritAdvies => {
        const stijl1 = getBusStyle(ritAdvies.lijn1, ritAdvies.maatschappij1, ritAdvies.kleur1, ritAdvies.tekstKleur1);
        const stijl2 = ritAdvies.lijn2 ? getBusStyle(ritAdvies.lijn2, ritAdvies.maatschappij2, ritAdvies.kleur2, ritAdvies.tekstKleur2) : null;
        const kaartje = document.createElement('div');
        kaartje.className = 'trip-card';
        kaartje.onclick = () => openDetails(ritAdvies);
        kaartje.innerHTML = `
            <div class="card-header-row">
                <div class="time-container">
                    <span>${formatTijd(ritAdvies.vertrek1)}</span>
                    <i data-lucide="move-right"></i>
                    <span>${formatTijd(ritAdvies.aankomst_eind)}</span>
                </div>
                <div class="meta-item">
                    <div class="duration"><i data-lucide="clock"></i><span>${berekenDuur(ritAdvies.vertrek1, ritAdvies.aankomst_eind)}</span></div>
                    ${ritAdvies.isOverstap ? `<div class="transfer-count"><i data-lucide="shuffle"></i><span>1x</span></div>` : ''}
                </div>
            </div>
            <div class="card-transport-row">
                <i data-lucide="bus"></i>
                <span class="line-badge" style="background-color: ${stijl1.backgroundColor}; color: ${stijl1.color};">
                    ${ritAdvies.lijn1}
                </span>
                ${ritAdvies.lijn2 ? `
                    <i data-lucide="plus"></i>
                    <span class="line-badge" style="background-color: ${stijl2.backgroundColor}; color: ${stijl2.color};">
                        ${ritAdvies.lijn2}
                    </span>
                ` : ''}
            </div>
        `;
        container.appendChild(kaartje);
    });
    if (window.lucide) lucide.createIcons();
}

// Functie om de juiste dienst/omloop te zoeken in jouw data.csv
const relevanteLijnen = ["2", "3", "7", "8", "14", "15", "71", "72", "73", "74", "75", "78", "80", "81", "84", "244", "382", "385", "N80"];

function zoekDienstInfo(rit) {
    // 1. Check of de lijn in jouw lijst voorkomt
    if (!relevanteLijnen.includes(rit.lijn)) {
        return null;
    }

    // 2. We sturen dit naar de backend om in de data.csv te zoeken
    // Voor nu doen we een 'placeholder' die we later koppelen aan de CSV-hit
    // De backend gaat kijken naar rit.lijn + rit.tijd + huidige dag
    return {
        dienst: rit.dienst_nummer || "Onbekend",
        omloop: rit.omloop_nummer || "Onbekend"
    };
}

function renderTrajectBlok(t) {
    const stijl = getBusStyle(t.lijn, t.maatschappij, t.kleur, t.tekstKleur);
    const dienstInfo = zoekDienstInfo(t);

    // Check voor wisselpunten (bijv. Delftplein)
    const isWisselPunt = t.halteVertrek.includes("Delftplein") || t.halteAankomst.includes("Delftplein");
    const wisselHTML = isWisselPunt ? `<div class="wissel-indicator"><i data-lucide="arrow-left-right"></i> Chauffeurswissel</div>` : '';

    return `
        <div class="traject-card ${isWisselPunt ? 'wissel-highlight' : ''}">
            <div class="time-column">
                <span class="time">${formatTijd(t.tijdVertrek)}</span>
                <div class="vertical-line" style="background-color: ${stijl.backgroundColor}"></div>
                <span class="time">${formatTijd(t.tijdAankomst)}</span>
            </div>
            <div class="info-column">
                <div class="stop-name">${t.halteVertrek}</div>
                
                <div class="transport-details-box">
                    <div class="line-details-box">
                        <i data-lucide="bus"></i>
                        <span class="line-badge" style="background-color: ${stijl.backgroundColor}; color: ${stijl.color};">
                            ${t.lijn}
                        </span>
                        <span class="maatschappij-label">${t.maatschappij || ''}</span>
                    </div>

                    <span class="direction-text">Richting ${t.richting}</span>

                    ${dienstInfo ? `
                        <div class="rit-info-tags">
                            <div class="info-groep">
                                <span class="info-label">Dienst</span>
                                <span class="info-badge dienst-badge">${dienstInfo.dienst}</span>
                            </div>
                            <div class="info-groep">
                                <span class="info-label">Omloop</span>
                                <span class="info-badge omloop-badge">${dienstInfo.omloop}</span>
                            </div>
                        </div>
                    ` : ''}
                    
                    ${wisselHTML}
                </div>

                <div class="stop-name">${t.halteAankomst}</div>
            </div>
        </div>
    `;
}

function openDetails(ritAdvies) {
    const overlay = document.getElementById('trip-details-overlay');
    const timeline = document.getElementById('details-timeline');
    const summary = document.getElementById('summary-header');
    const backBtn = document.getElementById('back-container');

    // Toon de terug-knop in de header
    if (backBtn) backBtn.style.display = 'flex';

    // Toon het detailscherm
    overlay.style.display = 'block';

    let wachttijdTekst = "";
    if (ritAdvies.isOverstap) {
        const v = ritAdvies.vertrek_over.split(':').map(Number);
        const a = ritAdvies.aankomst_over.split(':').map(Number);
        const diff = ((v[0] * 60) + v[1]) - ((a[0] * 60) + a[1]);
        wachttijdTekst = `${diff < 0 ? diff + 1440 : diff} min. wachten`;
    }

    summary.innerHTML = `
        <div class="details-route-header prominent">
            <span class="route-node">${ritAdvies.van || document.getElementById('van-input').value}</span>
            <i data-lucide="move-right" stroke-width="3"></i>
            <span class="route-node">${ritAdvies.naar || document.getElementById('naar-input').value}</span>
        </div>
        <div class="details-summary-row">
            <div class="meta-entry"><i data-lucide="clock"></i><span>${berekenDuur(ritAdvies.vertrek1, ritAdvies.aankomst_eind)}</span></div>
            <div class="meta-entry"><i data-lucide="shuffle"></i><span>${ritAdvies.isOverstap ? '1x' : '0x'}</span></div>
            <div class="meta-entry"><i data-lucide="euro"></i><span>Vrijvervoer</span></div>
        </div>
    `;

    let html = renderTrajectBlok({
        tijdVertrek: ritAdvies.vertrek1,
        halteVertrek: ritAdvies.van || document.getElementById('van-input').value,
        tijdAankomst: ritAdvies.isOverstap ? ritAdvies.aankomst_over : ritAdvies.aankomst_eind,
        halteAankomst: ritAdvies.isOverstap ? ritAdvies.overstapHalte : (ritAdvies.naar || document.getElementById('naar-input').value),
        lijn: ritAdvies.lijn1,
        richting: ritAdvies.richting1,
        maatschappij: ritAdvies.maatschappij1,
        kleur: ritAdvies.kleur1,
        tekstKleur: ritAdvies.tekstKleur1,
        isMAT: false
    });

    if (ritAdvies.isOverstap) {
        html += `<div class="transfer-wait-centered">${wachttijdTekst}</div>`;
        html += renderTrajectBlok({
            tijdVertrek: ritAdvies.vertrek_over,
            halteVertrek: ritAdvies.overstapHalte,
            tijdAankomst: ritAdvies.aankomst_eind,
            halteAankomst: ritAdvies.naar || document.getElementById('naar-input').value,
            lijn: ritAdvies.lijn2,
            richting: ritAdvies.richting2,
            maatschappij: ritAdvies.maatschappij2,
            kleur: ritAdvies.kleur2,
            tekstKleur: ritAdvies.tekstKleur2,
            isMAT: false
        });
    }

    timeline.innerHTML = html;
    if (window.lucide) lucide.createIcons();
    checkWeekStatusEnToonKnop(ritAdvies, timeline);
}

function closeDetails() {
    const overlay = document.getElementById('trip-details-overlay');
    const backBtn = document.getElementById('back-container');

    if (overlay) overlay.style.display = 'none';
    if (backBtn) backBtn.style.display = 'none';
}

async function checkWeekStatusEnToonKnop(ritAdvies, container) {
    try {
        const res = await fetch('/api/historie');
        const data = await res.json();
        const ritten = data.ritten || [];
        const dezeWeekNummer = (d) => {
            const jan1 = new Date(d.getFullYear(), 0, 1);
            return Math.ceil((((d - jan1) / 86400000) + jan1.getDay() + 1) / 7);
        };
        const alGeregistreerd = ritten.some(rit => dezeWeekNummer(new Date(rit.datum)) === dezeWeekNummer(new Date()));
        if (alGeregistreerd) {
            container.innerHTML += `
                <div class="status-msg success">
                    <i data-lucide="check-circle"></i> Je hebt deze week al voldaan!
                </div>`;
        } else {
            container.innerHTML += `
                <div class="registration-footer">
                    <button class="btn-primary" onclick="registreerRit('${ritAdvies.van}', '${ritAdvies.naar}', '${ritAdvies.lijn1}', '${ritAdvies.vertrek1}', '${ritAdvies.aankomst_eind}')">
                        Rit registreren voor tracker
                    </button>
                </div>`;
        }
        if (window.lucide) lucide.createIcons();
    } catch (e) { console.error(e); }
}

async function registreerRit(van, naar, lijn, vertrek, aankomst) {
    const nieuweRit = {
        id: Date.now(),
        datum: new Date().toISOString().split('T')[0],
        van: van || document.getElementById('van-input').value,
        naar: naar || document.getElementById('naar-input').value,
        lijn: lijn,
        vertrek: vertrek,
        aankomst: aankomst
    };
    try {
        const response = await fetch('/api/historie', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nieuweRit)
        });
        if (response.ok) {
            alert('Rit succesvol bewaard!');
            closeDetails();
        }
    } catch (err) { console.error("Opslaan mislukt:", err); }
}

// Global exposure voor HTML onclicks
window.selecteerHalte = selecteerHalte;
window.registreerRit = registreerRit;
window.closeDetails = closeDetails;