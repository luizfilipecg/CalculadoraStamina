# Stamina calc — site + API

## Estrutura

```
stamina-full/
├── index.html      <- página principal (interface)
├── style.css
├── script.js       <- chama a API em /api/...
├── api/
│   └── index.js    <- a API (Express), serverless function
├── package.json
└── vercel.json     <- só /api/* vai para a function; o resto é estático
```

O Vercel serve `index.html`, `style.css` e `script.js` como site estático
automaticamente. Só as rotas que começam com `/api/` são redirecionadas
para a função do Express em `api/index.js`. Por isso `script.js` chama os
endpoints com caminho relativo (`/api/tempo-ate-full`, `/api/planejador-cacada`)
— funciona em qualquer domínio que o Vercel te der, sem precisar configurar nada.

## Rodando localmente

```bash
npm install
npm start
```

Isso só sobe a API em `http://localhost:3000`. Para ver a página chamando essa
API localmente, abra o `index.html` direto no navegador, ou use uma extensão
tipo "Live Server" do VS Code — como o `script.js` usa caminhos relativos
(`/api/...`), ao abrir o arquivo direto pelo `file://` essas chamadas não vão
funcionar; rodando com Live Server na mesma origem onde a API está ativa, sim.
Na prática, o jeito mais simples de testar tudo junto é fazer o deploy
(`vercel` cria uma URL de preview em segundos, veja abaixo).

## Deploy no Vercel

Mesmo processo de sempre:

```bash
npm install -g vercel
cd stamina-full
vercel login
vercel
```

Para a versão final:
```bash
vercel --prod
```

Ou pelo GitHub Desktop + site do Vercel, como já vínhamos fazendo: suba esta
pasta para um repositório e importe no [vercel.com](https://vercel.com).

## O que tem na página

- **Medidor de stamina**: um slider que mostra visualmente a barra de 0 a 42h,
  com a zona laranja (0:00–38:59) e a zona verde (39:00–42:00) na proporção
  real. Ao arrastar, ele busca na API o tempo até full para as três
  atividades (offline, trainer, zona de proteção). Se a API estiver fora do
  ar, calcula localmente e avisa.
- **Planejador de caçadas**: escolha entre os presets (5h = 3h+2h, 4h = 2h+2h)
  ou valores personalizados, e veja a linha do tempo sessão 1 → intervalo →
  sessão 2 com os números calculados pela API.

## Editando o visual

As cores e fontes ficam todas em variáveis no topo do `style.css`
(`--orange`, `--green`, `--bg`, etc.) — para mudar a paleta, basta trocar os
valores ali.
