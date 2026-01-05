document.addEventListener('DOMContentLoaded', () => {
    const vanInput = document.getElementById('van-input');
    const vanSuggesties = document.getElementById('van-suggesties');
    const naarInput = document.getElementById('naar-input');
    const naarSuggesties = document.getElementById('naar-suggesties');
    const btnPlan = document.getElementById('btn-plan');

    herstelLaatsteReis();

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

        const kaartje = document.createElement('div');
        kaartje.className = 'trip-card';

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
                <span class="dest">
                    ${advies.isOverstap ? ` via ${advies.overstapHalte}` : ` richting ${advies.richting || 'bestemming'}`}
                </span>
            </div>
        `;
        container.appendChild(kaartje);
    });

    if (window.lucide) {
        lucide.createIcons();
    }
}