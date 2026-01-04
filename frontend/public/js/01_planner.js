// Functie voor punt 1 uit je lijst: Reis plannen
async function planReis() {
    const van = document.getElementById('van-input');
    const naar = document.getElementById('naar-input');
    const container = document.getElementById('rit-resultaten');

    if (!van.value || !naar.value) return alert("Vul haltes in");

    container.innerHTML = '<p>Zoeken...</p>';

    try {
        const res = await fetch(`/api/plan?fromName=${encodeURIComponent(van.value)}&toName=${encodeURIComponent(naar.value)}`);
        const ritten = await res.json();
        renderPlannerResultaten(ritten); // Deze functie tekent de kaartjes
    } catch (err) {
        container.innerHTML = '<p>Fout bij plannen</p>';
    }
}