document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialiseer Lucide Iconen
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // 2. Suggesties Functionaliteit
    setupSuggesties('van-input', 'van-suggesties');
    setupSuggesties('naar-input', 'naar-suggesties');

    // 3. Plan mijn reis
    const planBtn = document.getElementById('btn-plan');
    if (planBtn) {
        planBtn.addEventListener('click', planReis);
    }

    // 4. Wissel-knop
    const switchBtn = document.querySelector('.btn-switch');
    if (switchBtn) {
        switchBtn.addEventListener('click', wisselRichting);
    }
});

function setupSuggesties(inputId, listId) {
    const input = document.getElementById(inputId);
    const list = document.getElementById(listId);
    let debounceTimer;

    input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        const query = input.value.trim();

        if (query.length < 2) {
            list.innerHTML = '';
            return;
        }

        // Wacht 200ms na de laatste toetsaanslag
        debounceTimer = setTimeout(async () => {
            console.group(`🔍 Zoeken naar: "${query}"`);
            const startTime = performance.now();

            try {
                const res = await fetch(`/api/suggesties/${encodeURIComponent(query)}`);
                const data = await res.json();

                const duration = (performance.now() - startTime).toFixed(0);
                console.log(`✅ Server antwoordde in ${duration}ms`);
                console.log(`📊 Aantal resultaten: ${data.length}`);

                list.innerHTML = '';
                data.forEach(item => {
                    const div = document.createElement('div');
                    div.textContent = item.stop_name;
                    div.addEventListener('click', () => {
                        console.log(`📍 Geselecteerd: ${item.stop_name} (ID: ${item.stop_id})`);
                        input.value = item.stop_name;
                        input.dataset.stopId = item.stop_id;
                        list.innerHTML = '';
                    });
                    list.appendChild(div);
                });
            } catch (err) {
                console.error("❌ Fout bij ophalen suggesties:", err);
            }
            console.groupEnd();
        }, 200);
    });

    document.addEventListener('click', (e) => {
        if (e.target !== input) list.innerHTML = '';
    });
}

async function planReis() {
    const vanInput = document.getElementById('van-input');
    const naarInput = document.getElementById('naar-input');
    const container = document.getElementById('rit-resultaten');

    if (!vanInput.value || !naarInput.value) {
        alert("Vul beide haltes in.");
        return;
    }

    container.innerHTML = '<p class="status-msg">Dienstregeling laden...</p>';
    container.style.display = 'block';

    try {
        // We sturen nu de namen mee ipv de ID's voor een betere match
        const url = `/api/plan?fromName=${encodeURIComponent(vanInput.value)}&toName=${encodeURIComponent(naarInput.value)}`;
        const res = await fetch(url);
        const ritten = await res.json();

        renderReisResultaten(ritten, vanInput.value);
    } catch (err) {
        container.innerHTML = '<p class="error">Er ging iets mis bij het zoeken.</p>';
    }
}

function renderReisResultaten(ritten, vanNaam) {
    const container = document.getElementById('rit-resultaten');
    if (ritten.length === 0) {
        container.innerHTML = '<p class="status-msg">Geen bussen gevonden voor deze route.</p>';
        return;
    }

    let html = `<h3 class="results-title">Vertrek vanaf ${vanNaam}</h3>`;
    ritten.forEach(rit => {
        const vTijd = rit.vertrektijd.substring(0, 5);
        const aTijd = rit.aankomsttijd.substring(0, 5);

        html += `
            <div class="trip-option">
                <div class="trip-main">
                    <div class="trip-time">
                        <span class="time-start">${vTijd}</span>
                        <span class="time-arrow">→</span>
                        <span class="time-end">${aTijd}</span>
                    </div>
                    <div class="trip-details">
                        <span class="line-pill">${rit.route_short_name}</span>
                        <span class="headsign">${rit.trip_headsign}</span>
                    </div>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

function wisselRichting() {
    const van = document.getElementById('van-input');
    const naar = document.getElementById('naar-input');

    const tempVal = van.value;
    const tempId = van.dataset.stopId;

    van.value = naar.value;
    van.dataset.stopId = naar.dataset.stopId;

    naar.value = tempVal;
    naar.dataset.stopId = tempId;
}