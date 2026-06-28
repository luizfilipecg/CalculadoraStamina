const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// Constantes do jogo (em minutos)
// ---------------------------------------------------------------------------
const FULL = 42 * 60;        // 2520 min -> stamina cheia (42h)
const GREEN_START = 39 * 60; // 2340 min -> início da zona verde (39:00)

// minutos de tempo real necessários para ganhar 1 minuto de stamina
const ORANGE_RATE = { offline: 3, trainer: 6, protection: 3 };
const GREEN_RATE = { offline: 6, trainer: 6, protection: 5 };

const ATIVIDADES = ['offline', 'trainer', 'protection'];

// ---------------------------------------------------------------------------
// Funções de cálculo
// ---------------------------------------------------------------------------

/**
 * Calcula quantos minutos de tempo real são necessários para a stamina
 * sair de `current` e chegar em `target` (em minutos), usando a atividade dada.
 * Atravessa corretamente a fronteira laranja -> verde (39:00).
 */
function timeToReach(current, target, atividade) {
  if (!ATIVIDADES.includes(atividade)) {
    throw new Error(`Atividade inválida: ${atividade}. Use uma de: ${ATIVIDADES.join(', ')}`);
  }
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

function zona(minutos) {
  return minutos >= GREEN_START ? 'verde' : 'laranja';
}

/** Converte minutos totais em string "Dd Hh Mmin" (omite D se for 0). */
function formatarMinutos(minutos) {
  minutos = Math.round(minutos);
  const dias = Math.floor(minutos / 1440);
  minutos %= 1440;
  const horas = Math.floor(minutos / 60);
  const min = minutos % 60;
  let s = '';
  if (dias > 0) s += `${dias}d `;
  s += `${horas}h ${String(min).padStart(2, '0')}min`;
  return s;
}

function horasParaMinutos(h) {
  return Math.round(h * 60);
}

// ---------------------------------------------------------------------------
// Endpoint 1: tempo até a stamina ficar full
// GET /api/tempo-ate-full?horas=10&minutos=30&atividade=offline
// `atividade` é opcional; se omitida, retorna as 3 atividades.
// ---------------------------------------------------------------------------
app.get('/api/tempo-ate-full', (req, res) => {
  try {
    const horas = parseFloat(req.query.horas ?? '0');
    const minutos = parseFloat(req.query.minutos ?? '0');
    const atividade = req.query.atividade;

    if (Number.isNaN(horas) || Number.isNaN(minutos)) {
      return res.status(400).json({ erro: 'Parâmetros "horas" e "minutos" precisam ser números.' });
    }

    let staminaAtual = horas * 60 + minutos;
    if (staminaAtual < 0) staminaAtual = 0;
    if (staminaAtual > FULL) staminaAtual = FULL;

    const base = {
      staminaAtualMinutos: Math.round(staminaAtual),
      staminaAtualFormatada: formatarMinutos(staminaAtual),
      zonaAtual: zona(staminaAtual),
    };

    if (atividade) {
      if (!ATIVIDADES.includes(atividade)) {
        return res.status(400).json({ erro: `Atividade inválida. Use uma de: ${ATIVIDADES.join(', ')}` });
      }
      const minutosNecessarios = timeToReach(staminaAtual, FULL, atividade);
      return res.json({
        ...base,
        atividade,
        tempoNecessarioMinutos: Math.round(minutosNecessarios),
        tempoNecessarioFormatado: formatarMinutos(minutosNecessarios),
      });
    }

    const resultados = {};
    for (const a of ATIVIDADES) {
      const m = timeToReach(staminaAtual, FULL, a);
      resultados[a] = {
        minutos: Math.round(m),
        formatado: formatarMinutos(m),
      };
    }

    return res.json({ ...base, resultados });
  } catch (e) {
    return res.status(500).json({ erro: e.message });
  }
});

// ---------------------------------------------------------------------------
// Endpoint 2: planejador de caçadas (2 sessões por dia)
// POST /api/planejador-cacada
// ---------------------------------------------------------------------------
app.post('/api/planejador-cacada', (req, res) => {
  try {
    const {
      horasSessao1,
      horasSessao2,
      staminaInicialHoras = 42,
      atividadeIntervalo = 'offline',
      usarExtension = false,
      manterZonaVerde = true,
    } = req.body ?? {};

    if (typeof horasSessao1 !== 'number' || typeof horasSessao2 !== 'number') {
      return res.status(400).json({ erro: '"horasSessao1" e "horasSessao2" são obrigatórios e devem ser números.' });
    }
    if (!ATIVIDADES.includes(atividadeIntervalo)) {
      return res.status(400).json({ erro: `"atividadeIntervalo" inválida. Use uma de: ${ATIVIDADES.join(', ')}` });
    }

    const need1 = horasParaMinutos(horasSessao1);
    const need2 = horasParaMinutos(horasSessao2);

    // Se a sessão precisa ficar inteira na zona verde (bônus de +50% xp),
    // ela tem que TERMINAR com stamina >= GREEN_START (39:00). Isso define
    // a stamina mínima necessária antes de cada sessão começar.
    const req1 = manterZonaVerde ? Math.min(GREEN_START + need1, FULL) : need1;
    const req2 = manterZonaVerde ? Math.min(GREEN_START + need2, FULL) : need2;

    const avisos = [];
    if (manterZonaVerde && GREEN_START + need1 > FULL) {
      avisos.push(`A sessão 1 (${horasSessao1}h) não cabe inteira na zona verde — o máximo é ${formatarMinutos(FULL - GREEN_START)}.`);
    }
    if (manterZonaVerde && GREEN_START + need2 > FULL) {
      avisos.push(`A sessão 2 (${horasSessao2}h) não cabe inteira na zona verde — o máximo é ${formatarMinutos(FULL - GREEN_START)}.`);
    }

    let stam = Math.min(horasParaMinutos(staminaInicialHoras), FULL);
    if (stam < req1) {
      avisos.push(`Stamina insuficiente para a sessão 1${manterZonaVerde ? ' ficar inteira na zona verde' : ''}: faltam ${formatarMinutos(req1 - stam)}.`);
    }
    const afterS1 = Math.max(stam - need1, 0);

    let staminaParaIntervalo = afterS1;
    if (usarExtension) {
      staminaParaIntervalo = Math.min(staminaParaIntervalo + 60, FULL);
    }

    const gap = timeToReach(staminaParaIntervalo, req2, atividadeIntervalo);
    const staminaAntesS2 = Math.max(staminaParaIntervalo, req2);
    const afterS2 = Math.max(staminaAntesS2 - need2, 0);

    return res.json({
      avisos,
      sessao1: {
        horas: horasSessao1,
        staminaAposMinutos: Math.round(afterS1),
        staminaAposFormatada: formatarMinutos(afterS1),
      },
      extensionAplicada: usarExtension,
      staminaNecessariaSessao1: {
        minutos: Math.round(req1),
        formatada: formatarMinutos(req1),
      },
      staminaNecessariaSessao2: {
        minutos: Math.round(req2),
        formatada: formatarMinutos(req2),
      },
      staminaParaIntervalo: {
        minutos: Math.round(staminaParaIntervalo),
        formatada: formatarMinutos(staminaParaIntervalo),
      },
      intervaloNecessario: {
        minutos: Math.round(gap),
        formatado: gap <= 0 ? 'pode entrar na hora' : formatarMinutos(gap),
        atividade: atividadeIntervalo,
      },
      sessao2: {
        horas: horasSessao2,
        staminaAposMinutos: Math.round(afterS2),
        staminaAposFormatada: formatarMinutos(afterS2),
      },
      tempoTotalAteSessao2: formatarMinutos(need1 + gap),
    });
  } catch (e) {
    return res.status(500).json({ erro: e.message });
  }
});

app.get('/', (req, res) => {
  res.json({
    mensagem: 'API da calculadora de stamina',
    endpoints: [
      'GET /api/tempo-ate-full?horas=&minutos=&atividade=(opcional)',
      'POST /api/planejador-cacada',
    ],
  });
});

// No Vercel, a plataforma chama o app exportado diretamente (serverless),
// então só chamamos app.listen quando o arquivo é executado localmente.
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`API de stamina rodando em http://localhost:${PORT}`);
  });
}

module.exports = app;
