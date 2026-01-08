// 06_buskleuren.js

export function getBusStyle(lijn, maatschappij, dbKleur, dbTekstKleur) {
    // 1. Prioriteit: Gebruik de kleur uit de database als die er is
    if (dbKleur && dbKleur !== 'null' && dbKleur !== '') {
        return {
            backgroundColor: `#${dbKleur}`,
            color: dbTekstKleur ? `#${dbTekstKleur}` : '#ffffff'
        };
    }

    // 2. Slimme R-net herkenning (Lijnen 3xx en 4xx van Connexxion/EBS/Arriva)
    // R-net rood is #E60006
    const lijnNummer = parseInt(lijn);
    if (lijnNummer >= 300 && lijnNummer <= 499) {
        return { backgroundColor: '#E60006', color: '#ffffff' };
    }

    // 3. Fallback op basis van Maatschappij
    const m = maatschappij?.toLowerCase() || '';

    if (m.includes('gvb')) {
        return { backgroundColor: '#005ca9', color: '#ffffff' };
    }
    if (m.includes('connexxion')) {
        return { backgroundColor: '#007b7f', color: '#ffffff' };
    }
    if (m.includes('ebs')) {
        return { backgroundColor: '#ffc425', color: '#000000' };
    }
    if (m.includes('ns')) {
        return { backgroundColor: '#ffc917', color: '#003082' };
    }

    // Standaard grijs
    return { backgroundColor: '#7f8c8d', color: '#ffffff' };
}