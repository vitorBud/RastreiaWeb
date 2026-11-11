# RastreiaWeb

O RastreiaWeb é uma plataforma open source para auditoria e diagnóstico de websites. A aplicação ajuda desenvolvedores a localizar problemas técnicos, compreender sua gravidade e encontrar caminhos de correção com evidências do próprio HTML analisado.

> Estado atual: v0.2 funcional, com foco em links quebrados, recursos, imagens sem `alt` e responsividade de uma única página.

## Objetivos do MVP

- Receber e validar a URL de uma página pública autorizada.
- Verificar links, imagens e recursos de uma única página.
- Medir overflow horizontal em resoluções de desktop, tablet e celular.
- Localizar cada imagem sem `alt` e apresentar sua origem e evidência HTML.
- Apresentar resultados com contexto, gravidade e sugestões.
- Tratar riscos de SSRF antes de acessar URLs informadas pelo usuário.
- Construir uma base testável e documentada.

## Arquitetura

```text
apps/web                 interface React
    │ HTTP
    ▼
apps/api                 API Node.js
    │ coordena
    ▼
packages/audit-engine    inventário e responsividade com Playwright

packages/shared          contratos TypeScript compartilhados
```

O repositório usa npm workspaces para manter essas partes separadas sem exigir uma ferramenta adicional de monorepo.

## Tecnologias

- React, TypeScript e Vite
- Node.js e Express
- Playwright
- Vitest e ESLint

## Pré-requisitos

- Node.js 22 ou superior
- npm 11 ou superior

## Instalação

```bash
npm install
npm exec playwright install chromium
```

## Execução local

```bash
npm run dev
```

- Interface: `http://localhost:5173`
- API: `http://localhost:3333`
- Verificação da API: `http://localhost:3333/api/health`

### Validação segura de URL

O primeiro endpoint do back-end valida uma URL sem abrir a página:

```http
POST /api/urls/validate
Content-Type: application/json

{
  "url": "https://exemplo.com.br"
}
```

Ele aceita apenas HTTP e HTTPS, bloqueia credenciais, portas fora do escopo,
hostnames locais e endereços IP privados ou reservados. A validação também
confere todos os endereços retornados pelo DNS. Esse endpoint não abre a página;
o fluxo de auditoria aplica novamente essas regras a cada redirecionamento.

### Primeira auditoria de página

```http
POST /api/audits
Content-Type: application/json

{
  "url": "https://exemplo.com.br"
}
```

A auditoria acessa uma única página, revalida redirecionamentos e conecta ao IP
público aprovado para reduzir o risco de DNS rebinding. O HTML é interpretado
com scripts da página e rede do navegador bloqueados. O inventário considera
somente navegações HTTP(S) reais declaradas em `<a href>` ou `<area href>`.
Âncoras da própria página, ações JavaScript, `mailto:`, `tel:`, placeholders de
template e destinos equivalentes ao documento atual são ignorados. Nesta fase,
são verificados por padrão até 20 destinos HTTP(S) únicos e 20 recursos entre
imagens, folhas de estilo e scripts. Links válidos acima do limite continuam no
inventário como “não verificados”.

Links são consultados primeiro com `HEAD`. Qualquer resposta de erro é confirmada
com um `GET` leve antes da classificação, reduzindo falsos positivos em servidores
que não oferecem suporte adequado a `HEAD`. Respostas `401`, `403` e `429` são
tratadas como inconclusivas, enquanto `404` e `410` confirmados por `GET` são
classificados como links quebrados.

Cada elemento `<img src>` sem o atributo `alt` gera uma ocorrência própria. O
relatório informa a URL exata da imagem, o domínio que a hospeda, a página onde
ela aparece e o trecho HTML encontrado. Um `alt=""` presente não é tratado como
erro automático, pois é a implementação correta para imagens apenas decorativas.

### Responsividade

O detector mede a página em três viewports fixas:

- Desktop: `1440 × 900`.
- Tablet: `768 × 1024`.
- Celular: `390 × 844`.

O relatório informa a largura testada, a largura encontrada, o excesso em pixels,
o seletor e o trecho HTML dos elementos que ultrapassam a viewport. Folhas CSS
públicas são carregadas pela mesma camada segura da API. A análise não usa
capturas de tela e não promete identificar todo problema visual automaticamente.

### Acessibilidade

A verificação de acessibilidade do MVP é propositalmente objetiva: identifica
cada elemento `<img src>` sem o atributo `alt`. O relatório mostra a URL exata
da imagem, domínio de hospedagem, página de origem, elemento HTML e orientação
para diferenciar imagens informativas de imagens decorativas.

O RastreiaWeb não classifica contraste, teclado, leitores de tela, semântica ou
compreensão do conteúdo nesta versão. Esses pontos exigem avaliação humana e não
são apresentados como erros automáticos, evitando ruído fora do foco do produto.

### Progresso real

A API transmite eventos NDJSON durante download, inventário, verificação de
destinos, responsividade e geração do relatório. A interface
mostra a porcentagem e a etapa real em andamento, em vez de simular carregamento.

## Qualidade

```bash
npm run check
```

O comando compila os pacotes internos, executa lint, verificação de tipos, testes
automatizados e os builds de produção da API e da interface.

Na validação atual, a suíte possui 96 testes aprovados: 52 na API, 36 na
interface e 8 no motor de auditoria.

## Estrutura do repositório

```text
apps/
  api/                 API HTTP, segurança de URLs e coordenação da auditoria
  web/                 dashboard React e armazenamento local do histórico
packages/
  audit-engine/        inventário e responsividade com Playwright
  shared/              contratos TypeScript compartilhados
```

## Capturas de tela

A captura atual do dashboard será adicionada em `docs/screenshots/` após a
validação visual local. Nenhuma imagem de referência externa é apresentada como
se fosse uma captura real do produto.

## Limitações atuais

- Apenas uma página é analisada por vez; não existe crawler de múltiplas páginas.
- O inventário representa o HTML estático recebido; links inseridos posteriormente por JavaScript ainda não aparecem.
- O histórico é armazenado localmente no navegador e ainda não possui sincronização.
- A responsividade mede três larguras fixas; problemas entre elas podem exigir teste manual.
- A verificação de acessibilidade automática está limitada a imagens sem atributo `alt`.
- Alguns sites podem restringir requisições automatizadas e produzir resultados inconclusivos.
- Imagens de fundo CSS, imagens inseridas por JavaScript e fontes lazy-load sem `src` ainda não entram nessa verificação inicial.
- Testes automáticos não substituem uma avaliação manual completa de acessibilidade.

## Interface atual

- Visão geral com resumo da última auditoria e lista completa das imagens sem `alt`.
- Gráfico das últimas oito auditorias, dividido por categoria e com acesso ao relatório.
- Formulário para nova auditoria.
- Relatório separado em Links, Responsividade, Acessibilidade e Recursos.
- Resultado responsivo por viewport, com excesso em pixels e elemento responsável.
- Inventário de links em ordem de aparição, com busca, filtro por resultado, ordenação, status HTTP, destino final e evidência HTML.
- Detalhamento de imagens sem `alt`, incluindo arquivo, domínio, página e elemento HTML.
- Distinção entre problemas confirmados, destinos indisponíveis e verificações inconclusivas.
- Exportação do relatório em JSON e impressão.
- Histórico local com seleção e exclusão de resultados.
- Configurações de limites de links, recursos e histórico.
- Área de ajuda com explicações e limitações.

## Roadmap

- **v0.1 — concluída:** fundação, validação segura de URL e primeiro diagnóstico.
- **v0.2 — concluída:** verificação de responsividade por viewport e detalhamento em pixels.
- **v0.3 — próxima:** validação visual final, captura real do dashboard e testes manuais autorizados.
- **v1.0:** documentação de deploy, publicação e validação em produção.

### Depois da v1.0

- Auditoria controlada de múltiplas páginas do mesmo domínio.
- Histórico sincronizado e comparação entre auditorias.
- Exportação de relatórios em PDF.
- Integração com Lighthouse e pipelines de CI/CD.

Consulte [AGENTS.md](./AGENTS.md) para conhecer as regras de colaboração e os objetivos completos do projeto.
