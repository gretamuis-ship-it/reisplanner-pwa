// Configuratie: Verander dit als je bestandsnaam anders is
const CSV_URL = '../data.csv';

async function laadPlanning() {
    const response = await fetch(CSV_URL);
    const data = await response.text();

    // Split de regels en parse de CSV (puntkomma scheiding)
    const regels = data.split('\n').map(regel => regel.split(';'));
    const headers = regels[0];
    const ritten = regels.slice(1);

    const vandaag = new Date();
    const dagType = bepaalDagType(vandaag);
    const isVakantie = checkVakantieStatus(); // Functie die kijkt naar je instelling

    // Filter de ritten
    const gefilterdeRitten = ritten.filter(rit => {
        const ritDag = rit[headers.indexOf('Dagtype')];
        const ritPakket = rit[headers.indexOf('PakketType')];

        // Match op PakketType (Normaal of Vakantie)
        if (ritPakket !== (isVakantie ? 'KorteVakantie' : 'Normaal')) return false;

        // Slimme Dagtype logica
        if (dagType === 'Vrijdag') {
            return (ritDag === 'Doordeweeks' || ritDag === 'Vrijdag');
        } else if (dagType === 'Doordeweeks') {
            return (ritDag === 'Doordeweeks' || ritDag === 'Maandag t/m donderdag');
        } else {
            return ritDag === dagType;
        }
    });

    toonRitten(gefilterdeRitten, headers);
}

function bepaalDagType(datum) {
    const dag = datum.getDay(); // 0 = zondag, 6 = zaterdag
    if (dag === 0) return 'Zondag';
    if (dag === 6) return 'Zaterdag';
    if (dag === 5) return 'Vrijdag';
    return 'Doordeweeks';
}

function toonRitten(ritten, headers) {
    const lijst = document.getElementById('rittenLijst');
    lijst.innerHTML = '';

    ritten.forEach(rit => {
        const omloop = rit[headers.indexOf('Omloop')];
        const isPOD = omloop && omloop.charAt(3) === '8'; // Check 4e cijfer voor POD
        const isMAT = rit[headers.indexOf('Lijn')] === 'MAT';

        const div = document.createElement('div');
        div.className = 'rit-item';
        div.innerHTML = `
            <span class="tijd">${rit[headers.indexOf('Start')].substring(0, 5)}</span>
            <span class="lijn">${isMAT ? '🛠️' : rit[headers.indexOf('Lijn')]}</span>
            <span class="route">${rit[headers.indexOf('Van')]} ➔ ${rit[headers.indexOf('Naar')]}</span>
            <span class="stalling">${rit[headers.indexOf('Stalling')].charAt(0)}</span>
            ${isPOD ? '<span>🚗</span>' : ''}
            <div class="vertraging" id="rit-${rit[headers.indexOf('Rit')]}">...</div>
        `;
        lijst.appendChild(div);

        // Als er een ritnummer is, haal live data op
        const ritNummer = rit[headers.indexOf('Rit')];
        if (ritNummer && !isMAT) {
            haalLiveVertragingOp(ritNummer);
        }
    });
}

// Hier komt later de koppeling met OpenOV/NDOV voor de live data
function haalLiveVertragingOp(ritNummer) {
    // Voor nu een placeholder
    console.log("Zoeken naar vertraging voor rit:", ritNummer);
}

// Start de app
laadPlanning();