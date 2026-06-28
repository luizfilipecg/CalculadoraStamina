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

// Stamina nunca passa de 42h, então nunca mostra "dias" — diferente de fmt(),
// que é para durações de espera (essas sim podem passar de 24h).
function fmtStamina(mins) {
  mins = Math.round(mins);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h + 'h ' + String(m).padStart(2, '0') + 'min';
}

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

// ---------------------------------------------------------------------------
// Abas
// ---------------------------------------------------------------------------

const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.tab-panel');

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    tabs.forEach((t) => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    panels.forEach((p) => p.classList.remove('active'));
    document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
  });
});

// ---------------------------------------------------------------------------
// Stamina atual / tempo até full
// ---------------------------------------------------------------------------

const curH = document.getElementById('curH');
const curM = document.getElementById('curM');
const meterFill = document.getElementById('meterFill');
const zoneBadge = document.getElementById('zoneBadge');
const sourceNote = document.getElementById('sourceNote');

let debounceTimer = null;

function readCurrentStamina() {
  let h = parseFloat(curH.value);
  let m = parseFloat(curM.value);
  if (Number.isNaN(h)) h = 0;
  if (Number.isNaN(m)) m = 0;
  return clamp(h * 60 + m, 0, FULL);
}

function updateMeterVisual(current) {
  const pct = (current / FULL) * 100;
  meterFill.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
  const inGreen = current >= GREEN_START;
  zoneBadge.textContent = inGreen ? 'zona verde' : 'zona laranja';
  zoneBadge.className = 'zone-badge ' + (inGreen ? 'zone-badge--green' : 'zone-badge--orange');
}

async function updateResults(current) {
  const horas = Math.floor(current / 60);
  const minutos = Math.round(current % 60);
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

function onStaminaInputChange() {
  const current = readCurrentStamina();
  updateMeterVisual(current);
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => updateResults(current), 200);
}

curH.addEventListener('input', onStaminaInputChange);
curM.addEventListener('input', onStaminaInputChange);

onStaminaInputChange();

// ---------------------------------------------------------------------------
// Planejador de caçadas — cada sessão precisa terminar com stamina >= 39:00
// pra ficar inteira na zona verde (bônus de +50% xp)
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

function calcPlanLocal({ horasSessao1, horasSessao2, staminaInicialHoras, atividadeIntervalo, usarExtension, manterZonaVerde }) {
  const need1 = Math.round(horasSessao1 * 60);
  const need2 = Math.round(horasSessao2 * 60);
  const req1 = manterZonaVerde ? Math.min(GREEN_START + need1, FULL) : need1;
  const req2 = manterZonaVerde ? Math.min(GREEN_START + need2, FULL) : need2;

  const avisos = [];
  if (manterZonaVerde && GREEN_START + need1 > FULL) {
    avisos.push(`A sessão 1 (${horasSessao1}h) não cabe inteira na zona verde — o máximo é ${fmtStamina(FULL - GREEN_START)}.`);
  }
  if (manterZonaVerde && GREEN_START + need2 > FULL) {
    avisos.push(`A sessão 2 (${horasSessao2}h) não cabe inteira na zona verde — o máximo é ${fmtStamina(FULL - GREEN_START)}.`);
  }

  let stam = clamp(staminaInicialHoras * 60, 0, FULL);
  if (stam < req1) {
    avisos.push(`Stamina insuficiente para a sessão 1${manterZonaVerde ? ' ficar inteira na zona verde' : ''}: faltam ${fmtStamina(req1 - stam)}.`);
  }
  const afterS1 = Math.max(stam - need1, 0);

  let staminaParaIntervalo = afterS1;
  if (usarExtension) {
    staminaParaIntervalo = Math.min(staminaParaIntervalo + 60, FULL);
  }

  const gap = timeToReachLocal(staminaParaIntervalo, req2, atividadeIntervalo);
  const staminaAntesS2 = Math.max(staminaParaIntervalo, req2);
  const afterS2 = Math.max(staminaAntesS2 - need2, 0);

  return {
    avisos,
    sessao1: { horas: horasSessao1, staminaAposMinutos: afterS1, staminaAposFormatada: fmtStamina(afterS1) },
    extensionAplicada: usarExtension,
    staminaNecessariaSessao1: { minutos: req1, formatada: fmtStamina(req1) },
    staminaNecessariaSessao2: { minutos: req2, formatada: fmtStamina(req2) },
    staminaParaIntervalo: { minutos: staminaParaIntervalo, formatada: fmtStamina(staminaParaIntervalo) },
    intervaloNecessario: {
      minutos: gap,
      formatado: gap <= 0 ? 'pode entrar na hora' : fmt(gap),
      atividade: atividadeIntervalo,
    },
    sessao2: { horas: horasSessao2, staminaAposMinutos: afterS2, staminaAposFormatada: fmtStamina(afterS2) },
    tempoTotalAteSessao2: fmt(need1 + gap),
  };
}

document.getElementById('calcBtn').addEventListener('click', async () => {
  const horasSessao1 = parseFloat(h1Input.value) || 0;
  const horasSessao2 = parseFloat(h2Input.value) || 0;
  const staminaInicialHoras = parseFloat(document.getElementById('startH').value) || 0;
  const atividadeIntervalo = document.getElementById('activity').value;
  const usarExtension = document.getElementById('useExt').checked;
  const manterZonaVerde = document.getElementById('keepGreen').checked;

  const timeline = document.getElementById('timeline');
  const note = document.getElementById('plannerNote');

  try {
    const res = await fetch('/api/planejador-cacada', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ horasSessao1, horasSessao2, staminaInicialHoras, atividadeIntervalo, usarExtension, manterZonaVerde }),
    });
    if (!res.ok) throw new Error('api indisponível');
    const data = await res.json();
    renderTimeline(data, horasSessao1, horasSessao2);
    note.textContent = data.avisos && data.avisos.length ? data.avisos.join(' ') : '';
    note.className = data.avisos && data.avisos.length ? 'warning' : 'source-note';
  } catch (e) {
    const data = calcPlanLocal({ horasSessao1, horasSessao2, staminaInicialHoras, atividadeIntervalo, usarExtension, manterZonaVerde });
    renderTimeline(data, horasSessao1, horasSessao2);
    const baseNote = 'sem conexão com a api — usando cálculo local.';
    note.textContent = data.avisos.length ? baseNote + ' ' + data.avisos.join(' ') : baseNote;
    note.className = 'warning';
  }
});

function renderTimeline(data, h1, h2) {
  const timeline = document.getElementById('timeline');
  const ready = data.intervaloNecessario.minutos <= 0;
  const req2 = data.staminaNecessariaSessao2 ? data.staminaNecessariaSessao2.formatada : '';
  timeline.innerHTML = `
    <div class="t-step">
      <div class="t-step-label">sessão 1 · ${h1}h</div>
      <div class="t-step-value">${data.sessao1.staminaAposFormatada}</div>
    </div>
    <div class="t-arrow">→</div>
    <div class="t-step t-step--gap ${ready ? 't-step--ready' : ''}">
      <div class="t-step-label">intervalo (${data.intervaloNecessario.atividade})${req2 ? ' · até ' + req2 : ''}</div>
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
