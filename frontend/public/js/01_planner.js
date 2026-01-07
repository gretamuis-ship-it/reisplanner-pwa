document.addEventListener('DOMContentLoaded', () => {
    const vanInput = document.getElementById('van-input');
    const vanSuggesties = document.getElementById('van-suggesties');
    const naarInput = document.getElementById('naar-input');
    const naarSuggesties = document.getElementById('naar-suggesties');
    const btnPlan = document.getElementById('btn-plan');
    const btnSwitch = document.querySelector('.btn-switch');

    herstelLaatsteReis();

    // Wissel-knop (Van/Naar omdraaien)
    if (btnSwitch) {
        btnSwitch.addEventListener('click', () => {
            const tempVal = vanInput.value;
            vanInput.value = naarInput.value;
            naarInput.value = tempVal;
            localStorage.setItem('laatsteVan', vanInput.value);
            localStorage.setItem('laatsteNaar', naarInput.value);
        });
    }

    // Geolocation setup
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

        // Klik buiten suggesties = lijst sluiten
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

// --- HULPFUNCTIES ---

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
    if (!data || data.length === 0) {
        container.classList.remove('active');
        container.innerHTML = '<div class="geen-resultaten">Geen ritten gevonden.</div>';
        return;
    }

    container.classList.add('active');

    data.map(advies => {
        const duurTekst = berekenDuur(advies.vertrek1, advies.aankomst_eind);

        // Zoek deze regel:
        const kaartje = document.createElement('div');
        kaartje.className = 'trip-card';

        // Voeg hieronder deze regel toe:
        kaartje.onclick = () => openDetails(advies);

        kaartje.innerHTML = `
            <div class="card-header-row">
                <div class="time-container">
                    <span>${formatTijd(advies.vertrek1)}</span>
                    <i data-lucide="move-right"></i>
                    <span>${formatTijd(advies.aankomst_eind)}</span>
                </div>
                <div class="meta-item">
                    <div class="duration">
                        <i data-lucide="clock"></i>
                        <span>${duurTekst}</span>
                    </div>
                    ${advies.isOverstap ? `
                        <div class="transfer-count">
                            <i data-lucide="shuffle"></i>
                            <span>1x</span>
                        </div>
                    ` : ''}
                </div>
            </div>
            
            <div class="card-transport-row">
                <i data-lucide="bus"></i>
                <span class="line-badge">${advies.lijn1}</span>
                ${advies.lijn2 ? `
                    <i data-lucide="plus"></i> 
                    <span class="line-badge">${advies.lijn2}</span>
                ` : ''}
            </div>
        `;
        container.appendChild(kaartje);
    });

    if (window.lucide) {
        lucide.createIcons();
    }
}

function openDetails(advies) {
    const overlay = document.getElementById('trip-details-overlay');
    const timeline = document.getElementById('details-timeline');
    const summary = document.getElementById('summary-header');

    overlay.style.display = 'block';

    // Bereken werkelijke minuten (bijv. "12 min.")
    let wachttijdTekst = "";
    if (advies.isOverstap) {
        const v = advies.vertrek_over.split(':').map(Number);
        const a = advies.aankomst_over.split(':').map(Number);
        const diff = ((v[0] * 60) + v[1]) - ((a[0] * 60) + a[1]);
        wachttijdTekst = `${diff < 0 ? diff + 1440 : diff} min. wachten`;
    }

    summary.innerHTML = `
        <div class="details-route-header prominent">
            <span class="route-node">${advies.van || document.getElementById('van-input').value}</span>
            <i data-lucide="move-right" stroke-width="3"></i>
            <span class="route-node">${advies.naar || document.getElementById('naar-input').value}</span>
        </div>
        <div class="details-summary-row">
            <div class="meta-entry">
                <i data-lucide="clock"></i>
                <span>${berekenDuur(advies.vertrek1, advies.aankomst_eind)}</span>
            </div>
            <div class="meta-entry">
                <i data-lucide="shuffle"></i>
                <span>${advies.isOverstap ? '1x' : '0x'}</span>
            </div>
            <div class="meta-entry">
                <i data-lucide="euro"></i>
                <span>Vrijvervoer</span>
            </div>
        </div>
    `;

    let html = '';
    html += renderTrajectBlok({
        tijdVertrek: advies.vertrek1,
        halteVertrek: advies.van || document.getElementById('van-input').value,
        tijdAankomst: advies.isOverstap ? advies.aankomst_over : advies.aankomst_eind,
        halteAankomst: advies.isOverstap ? "Haarlem, Delftplein" : (advies.naar || document.getElementById('naar-input').value),
        lijn: advies.lijn1 || "385",
        richting: "Station Haarlem",
        isMAT: false
    });

    if (advies.isOverstap) {
        html += `<div class="transfer-wait-centered">${wachttijdTekst}</div>`;

        html += renderTrajectBlok({
            tijdVertrek: advies.vertrek_over,
            halteVertrek: "Haarlem, Delftplein",
            tijdAankomst: advies.aankomst_eind,
            halteAankomst: advies.naar || document.getElementById('naar-input').value,
            lijn: advies.lijn2 || "2",
            richting: "Station Spaarnwoude",
            isMAT: advies.isMAT || false
        });
    }

    timeline.innerHTML = html;
    if (window.lucide) lucide.createIcons();
}

function renderTrajectBlok(t) {
    const lineClass = t.isMAT ? 'mat-line' : 'standard-line';
    return `
        <div class="traject-card">
            <div class="time-column">
                <span class="time">${formatTijd(t.tijdVertrek)}</span>
                <div class="vertical-line ${lineClass}"></div>
                <span class="time">${formatTijd(t.tijdAankomst)}</span>
            </div>
            <div class="info-column">
                <div class="stop-name">${t.halteVertrek}</div>
                <div class="transport-details-box">
                    <i data-lucide="bus"></i>
                    <span class="line-badge">${t.lijn}</span>
                    <span class="direction-text">Richting ${t.richting}</span>
                </div>
                <div class="stop-name">${t.halteAankomst}</div>
            </div>
        </div>
    `;
}

function renderTrajectBlok(t) {
    // Kleur bepalen: MAT = roze, anders de standaard blauwe kleur
    const lineClass = t.isMAT ? 'mat-line' : 'standard-line';

    return `
        <div class="traject-card">
            <div class="time-column">
                <span class="time">${formatTijd(t.tijdVertrek)}</span>
                <div class="vertical-line ${lineClass}"></div>
                <span class="time">${formatTijd(t.tijdAankomst)}</span>
            </div>
            <div class="info-column">
                <div class="stop-name">${t.halteVertrek}</div>
                <div class="transport-details">
                    <div class="line-info">
                        <i data-lucide="bus"></i>
                        <strong>${t.lijn}</strong>
                        <span>Richting ${t.richting}</span>
                    </div>
                </div>
                <div class="stop-name">${t.halteAankomst}</div>
            </div>
        </div>
    `;
}

// Helper om die witte "traject-kaarten" van NS te maken
function renderTrajectBlok(t) {
    // We forceren de class-naamgeving voor maximale CSS-compatibiliteit
    const lineExtraClass = t.isMAT ? 'mat-line' : 'standard-line';

    return `
        <div class="traject-card">
            <div class="time-column">
                <span class="time">${formatTijd(t.tijdVertrek)}</span>
                <div class="vertical-line ${lineExtraClass}"></div>
                <span class="time">${formatTijd(t.tijdAankomst)}</span>
            </div>
            <div class="info-column">
                <div class="stop-name">${t.halteVertrek}</div>
                <div class="transport-details-box">
                    <i data-lucide="bus"></i>
                    <span class="line-badge">${t.lijn}</span>
                    <span class="direction-text">Richting ${t.richting}</span>
                </div>
                <div class="stop-name">${t.halteAankomst}</div>
            </div>
        </div>
    `;
}

function closeDetails() {
    document.getElementById('trip-details-overlay').style.display = 'none';
}

const btnSwitch = document.querySelector('.btn-switch');
if (btnSwitch) {
    btnSwitch.addEventListener('click', () => {
        const van = document.getElementById('van-input');
        const naar = document.getElementById('naar-input');

        const temp = van.value;
        van.value = naar.value;
        naar.value = temp;
    });
}