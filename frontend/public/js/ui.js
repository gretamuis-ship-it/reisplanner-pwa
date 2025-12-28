document.addEventListener('DOMContentLoaded', async () => {
    const btn = document.getElementById('btn-checkin');
    const status = document.getElementById('tracker-status');
    const bar = document.getElementById('progress-bar');

    async function refresh() {
        const data = await API.getStats();
        const count = data.length;
        status.innerText = `${count} van de 40 weken voldaan`;
        bar.style.width = `${(count / 40) * 100}%`;
    }

    btn.addEventListener('click', async () => {
        const res = await API.doCheckIn();
        alert(res.message);
        refresh();
    });

    refresh();
});