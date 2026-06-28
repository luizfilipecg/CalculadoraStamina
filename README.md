# API da calculadora de stamina (deploy no Vercel)

## Estrutura

```
stamina-api-vercel/
├── api/
│   └── index.js     <- a API (Express), exportada como serverless function
├── package.json
└── vercel.json      <- manda todas as rotas pra api/index.js
```

No Vercel, cada arquivo dentro de `/api` se transforma automaticamente em uma
serverless function. O `vercel.json` aqui só garante que qualquer rota
(`/`, `/api/tempo-ate-full`, `/api/planejador-cacada`) caia no mesmo arquivo
Express, então as rotas continuam exatamente como estavam.

## Passo a passo do deploy

### Opção A — pelo site (mais simples)

1. Crie um repositório no GitHub e suba esta pasta (`stamina-api-vercel`)
   inteira nele.
2. Entre em [vercel.com](https://vercel.com), faça login (pode usar a conta
   do GitHub) e clique em **Add New → Project**.
3. Selecione o repositório que você acabou de subir.
4. O Vercel detecta automaticamente que é um projeto Node — não precisa
   mudar nada nas configurações de build. Clique em **Deploy**.
5. Em ~1 minuto você recebe uma URL do tipo
   `https://stamina-api-seuusuario.vercel.app`.

### Opção B — pela CLI (sem precisar de GitHub)

```bash
npm install -g vercel
cd stamina-api-vercel
vercel login
vercel
```

Responda as perguntas do assistente (pode aceitar os valores padrão) e ele
gera um link de preview. Para subir a versão final (produção):

```bash
vercel --prod
```

## Testando depois do deploy

Troque `SEU-DOMINIO` pela URL que o Vercel te deu:

```bash
curl "https://SEU-DOMINIO.vercel.app/api/tempo-ate-full?horas=39&minutos=0"

curl -X POST https://SEU-DOMINIO.vercel.app/api/planejador-cacada \
  -H "Content-Type: application/json" \
  -d '{"horasSessao1":3,"horasSessao2":2,"staminaInicialHoras":42,"atividadeIntervalo":"offline","usarExtension":true}'
```

## Rodando localmente antes de subir

```bash
npm install
npm start
```

Sobe em `http://localhost:3000`, com as mesmas rotas.

## Observações

- O plano gratuito do Vercel ("Hobby") é suficiente para essa API — ela é
  bem leve e não tem estado (não salva nada em banco).
- Cada chamada à API "acorda" a função (cold start de serverless), então a
  primeira requisição depois de um tempo parado pode demorar um pouco mais
  que as seguintes — isso é normal e não é erro.
- Se quiser um domínio próprio (em vez do `.vercel.app`), isso se configura
  na aba **Settings → Domains** do projeto, depois do primeiro deploy.
