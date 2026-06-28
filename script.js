const FULL = 2520;
const GREEN_START = 2340;
const ORANGE_RATE = { offline: 3, trainer: 6, protection: 3 };
const GREEN_RATE = { offline: 6, trainer: 6, protection: 5 };

function timeToReachLocal(current, target, atividade) {
  if (target <= current) return 0;
  let tempo = 0;
  let stam = current;
  if (stam < GREEN_START) {
    const cap = Math.min(target, GREEN_START);
    tempo += (cap - stam) * ORANGE_RATE[atividade];
    stam = cap;
  }
  if (target > stam) {
    tempo += (target - stam) * GREEN_RATE[atividade];
  }
  return tempo;
}

function fmt(mins) {
  mins = Math.round(mins);
  const d = Math.floor(mins / 1440);
  mins %= 1440;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  let s = '';
  if (d > 0) s += d + 'd ';
  s += h + 'h ' + String(m).padStart(2, '0') + 'min';
  return s;
}

// ---------------------------------------------------------------------------
// Meter / tempo até full
// ---------------------------------------------------------------------------

const slider = document.getElementById('staminaSlider');
const meterFill = document.getElementById('meterFill');
const readoutValue = document.getElementById('readoutValue');
const zoneBadge = document.getElementById('zoneBadge');
const sourceNote = document.getElementById('sourceNote');

let debounceTimer = null;

function updateMeterVisual(current) {
  const pct = (current / FULL) * 100;
  meterFill.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
  readoutValue.textContent = fmt(current);
  const inGreen = current >= GREEN_START;
  zoneBadge.textContent = inGreen ? 'zona verde' : 'zona laranja';
  zoneBadge.className = 'zone-badge ' + (inGreen ? 'zone-badge--green' : 'zone-badge--orange');
}

async function updateResults(current) {
  const horas = Math.floor(current / 60);
  const minutos = current % 60;
  try {
    const res = await fetch(`/api/tempo-ate-full?horas=${horas}&minutos=${minutos}`);
    if (!res.ok) throw new Error('api indisponível');
    const data = await res.json();
    document.getElementById('resultOffline').textContent = data.resultados.offline.formatado;
    document.getElementById('resultTrainer').textContent = data.resultados.trainer.formatado;
    document.getElementById('resultProtection').textContent = data.resultados.protection.formatado;
    sourceNote.textContent = '';
  } catch (e) {
    document.getElementById('resultOffline').textContent = fmt(timeToReachLocal(current, FULL, 'offline'));
    document.getElementById('resultTrainer').textContent = fmt(timeToReachLocal(current, FULL, 'trainer'));
    document.getElementById('resultProtection').textContent = fmt(timeToReachLocal(current, FULL, 'protection'));
    sourceNote.textContent = 'sem conexão com a api — usando cálculo local';
  }
}

slider.addEventListener('input', () => {
  const current = parseInt(slider.value, 10);
  updateMeterVisual(current);
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => updateResults(current), 200);
});

updateMeterVisual(FULL);
updateResults(FULL);

// ---------------------------------------------------------------------------
// Planejador de caçadas
// ---------------------------------------------------------------------------

const presets = document.querySelectorAll('.preset');
const h1Input = document.getElementById('h1');
const h2Input = document.getElementById('h2');

presets.forEach((btn) => {
  btn.addEventListener('click', () => {
    presets.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    if (btn.dataset.h1 !== '') {
      h1Input.value = btn.dataset.h1;
      h2Input.value = btn.dataset.h2;
    }
  });
});
presets[0].classList.add('active');

[h1Input, h2Input].forEach((input) => {
  input.addEventListener('input', () => {
    presets.forEach((b) => b.classList.remove('active'));
    document.querySelector('.preset--custom').classList.add('active');
  });
});

document.getElementById('calcBtn').addEventListener('click', async () => {
  const horasSessao1 = parseFloat(h1Input.value) || 0;
  const horasSessao2 = parseFloat(h2Input.value) || 0;
  const staminaInicialHoras = parseFloat(document.getElementById('startH').value) || 0;
  const atividadeIntervalo = document.getElementById('activity').value;
  const usarExtension = document.getElementById('useExt').checked;

  const timeline = document.getElementById('timeline');
  const note = document.getElementById('plannerNote');

  try {
    const res = await fetch('/api/planejador-cacada', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ horasSessao1, horasSessao2, staminaInicialHoras, atividadeIntervalo, usarExtension }),
    });
    if (!res.ok) throw new Error('api indisponível');
    const data = await res.json();
    renderTimeline(data, horasSessao1, horasSessao2);
    note.textContent = data.avisos && data.avisos.length ? data.avisos.join(' ') : '';
    note.className = data.avisos && data.avisos.length ? 'warning' : 'source-note';
  } catch (e) {
    note.textContent = 'não foi possível falar com a api agora. tente novamente em alguns segundos.';
    note.className = 'warning';
    timeline.classList.remove('visible');
  }
});

function renderTimeline(data, h1, h2) {
  const timeline = document.getElementById('timeline');
  const ready = data.intervaloNecessario.minutos <= 0;
  timeline.innerHTML = `
    <div class="t-step">
      <div class="t-step-label">sessão 1 · ${h1}h</div>
      <div class="t-step-value">${data.sessao1.staminaAposFormatada}</div>
    </div>
    <div class="t-arrow">→</div>
    <div class="t-step t-step--gap ${ready ? 't-step--ready' : ''}">
      <div class="t-step-label">intervalo (${data.intervaloNecessario.atividade})</div>
      <div class="t-step-value">${data.intervaloNecessario.formatado}</div>
    </div>
    <div class="t-arrow">→</div>
    <div class="t-step">
      <div class="t-step-label">sessão 2 · ${h2}h</div>
      <div class="t-step-value">${data.sessao2.staminaAposFormatada}</div>
    </div>
  `;
  timeline.classList.add('visible');
}
