document.addEventListener('DOMContentLoaded', () => {
    const vanInput = document.getElementById('van-input');
    const vanSuggesties = document.getElementById('van-suggesties');
    const naarInput = document.getElementById('naar-input');
    const naarSuggesties = document.getElementById('naar-suggesties');
    const btnPlan = document.getElementById('btn-plan');

    herstelLaatsteReis();

    async function setupSuggesties(inputEl, suggestieEl) {
        if (!inputEl || !suggestieEl) return;
        inputEl.addEventListener('input', async () => {
            const zoekterm = inputEl.value;
            if (zoekterm.length < 2) { suggestieEl.innerHTML = ''; return; }
            try {
                const response = await fetch(`/api/suggesties/${encodeURIComponent(zoekterm)}`);
                const haltes = await response.json();
                suggestieEl.innerHTML = haltes.map(h => `
                    <div class="suggestie-item" onclick="selecteerHalte('${inputEl.id}', '${h.stop_name}', '${suggestieEl.id}')">${h.stop_name}</div>
                `).join('');
            } catch (err) { console.error(err); }
        });
    }

    setupSuggesties(vanInput, vanSuggesties);
    setupSuggesties(naarInput, naarSuggesties);
    if (btnPlan) btnPlan.addEventListener('click', planReis);
});

async function planReis() {
    const van = document.getElementById('van-input').value;
    const naar = document.getElementById('naar-input').value;
    const container = document.getElementById('rit-resultaten');
    if (!van || !naar) return alert("Vul haltes in");

    container.innerHTML = '<div class="loading">Zoeken naar ritten...</div>';
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
        }
    } catch (err) { console.error(err); }
}

function renderPlannerResultaten(data) {
    const container = document.getElementById('rit-resultaten');
    if (!container) return;
    container.innerHTML = '';

    data.forEach(advies => {
        const kaartje = document.createElement('div');
        kaartje.className = 'trip-card';
        kaartje.onclick = () => openDetails(advies);

        kaartje.innerHTML = `
            <div class="card-header-row">
                <div class="time-container">
                    <span>${formatTijd(advies.vertrek1)}</span>
                    <i data-lucide="move-right"></i>
                    <span>${formatTijd(advies.aankomst_eind)}</span>
                </div>
                <div class="meta-item">
                    <div class="duration"><i data-lucide="clock"></i><span>${berekenDuur(advies.vertrek1, advies.aankomst_eind)}</span></div>
                </div>
            </div>
            <div class="card-transport-row">
                <i data-lucide="bus"></i>
                <span class="line-badge">${advies.lijn1}</span>
                ${advies.lijn2 ? `<i data-lucide="plus"></i><span class="line-badge">${advies.lijn2}</span>` : ''}
            </div>
        `;
        container.appendChild(kaartje);
    });
    if (window.lucide) lucide.createIcons();
}

async function openDetails(advies) {
    const overlay = document.getElementById('trip-details-overlay');
    const timeline = document.getElementById('details-timeline');
    const summary = document.getElementById('summary-header');
    overlay.style.display = 'block';

    summary.innerHTML = `
        <div class="details-route-header prominent">
            <span>${advies.van || document.getElementById('van-input').value}</span>
            <i data-lucide="move-right"></i>
            <span>${advies.naar || document.getElementById('naar-input').value}</span>
        </div>
    `;

    let html = renderTrajectBlok({
        tijdVertrek: advies.vertrek1,
        halteVertrek: advies.van || document.getElementById('van-input').value,
        tijdAankomst: advies.isOverstap ? advies.aankomst_over : advies.aankomst_eind,
        halteAankomst: advies.isOverstap ? advies.overstapHalte : (advies.naar || document.getElementById('naar-input').value),
        lijn: advies.lijn1,
        richting: advies.richting
    });

    if (advies.isOverstap) {
        html += renderTrajectBlok({
            tijdVertrek: advies.vertrek_over,
            halteVertrek: advies.overstapHalte,
            tijdAankomst: advies.aankomst_eind,
            halteAankomst: advies.naar || document.getElementById('naar-input').value,
            lijn: advies.lijn2,
            richting: advies.richting
        });
    }

    // Check of week al behaald is
    try {
        // Aan het einde van openDetails(advies):
        const res = await fetch('/api/historie');
        const historie = await res.json();
        const dezeWeek = (d) => {
            const jan1 = new Date(d.getFullYear(), 0, 1);
            return Math.ceil((((d - jan1) / 86400000) + jan1.getDay() + 1) / 7);
        };
        const alGeregistreerd = (historie.ritten || []).some(rit => dezeWeek(new Date(rit.datum)) === dezeWeek(new Date()));

        if (alGeregistreerd) {
            html += `<div class="status-msg success">✅ Je hebt deze week al voldaan!</div>`;
        } else {
            html += `<div class="registration-footer">
                <button class="btn-register-trip" onclick="registreerRit('${advies.van}', '${advies.naar}', '${advies.lijn1}', '${advies.vertrek1}', '${advies.aankomst_eind}')">
                    Rit registreren voor tracker
                </button>
             </div>`;
        }
    } catch (e) { }

    timeline.innerHTML = html;
    if (window.lucide) lucide.createIcons();
}

function renderTrajectBlok(t) {
    return `
        <div class="traject-card">
            <div class="time-column">
                <span class="time">${formatTijd(t.tijdVertrek)}</span>
                <div class="vertical-line"></div>
                <span class="time">${formatTijd(t.tijdAankomst)}</span>
            </div>
            <div class="info-column">
                <div class="stop-name">${t.halteVertrek}</div>
                <div class="transport-details-box">
                    <i data-lucide="bus"></i>
                    <span class="line-badge">${t.lijn}</span>
                </div>
                <div class="stop-name">${t.halteAankomst}</div>
            </div>
        </div>
    `;
}

// --- HELPERS ---
function formatTijd(t) { return t ? t.substring(0, 5) : "--:--"; }
function berekenDuur(v, a) {
    const d1 = new Date(`2000-01-01T${v}`);
    const d2 = new Date(`2000-01-01T${a}`);
    const diff = (d2 - d1) / 60000;
    return `${Math.floor(diff / 60)}u ${diff % 60}m`;
}
function selecteerHalte(id, naam, sugId) {
    document.getElementById(id).value = naam;
    document.getElementById(sugId).innerHTML = '';
}
function herstelLaatsteReis() {
    const van = localStorage.getItem('laatsteVan');
    const naar = localStorage.getItem('laatsteNaar');
    if (van) document.getElementById('van-input').value = van;
    if (naar) document.getElementById('naar-input').value = naar;
}
function closeDetails() { document.getElementById('trip-details-overlay').style.display = 'none'; }

async function registreerRit(van, naar, lijn, vertrek, aankomst) {
    const nieuweRit = { id: Date.now(), datum: new Date().toISOString().split('T')[0], van, naar, lijn, vertrek, aankomst };
    const response = await fetch('/api/historie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nieuweRit)
    });
    if (response.ok) { alert('Rit gelogd!'); closeDetails(); }
}