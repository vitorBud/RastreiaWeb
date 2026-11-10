# RastreiaWeb

O RastreiaWeb é uma plataforma open source para auditoria e diagnóstico de websites. O projeto ajudará desenvolvedores a localizar problemas técnicos, compreender sua gravidade e encontrar caminhos de correção.

> O projeto já possui a primeira auditoria funcional de uma página e segue em evolução até uma versão demonstrável completa.

## Objetivos do MVP

- Receber e validar a URL de uma página pública autorizada.
- Verificar links, imagens e recursos de uma única página.
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
packages/audit-engine    verificações Playwright e axe-core

packages/shared          contratos TypeScript compartilhados
```

O repositório usa npm workspaces para manter essas partes separadas sem exigir uma ferramenta adicional de monorepo.

## Tecnologias

- React, TypeScript e Vite
- Node.js e Express
- Playwright e axe-core
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
com JavaScript e rede bloqueados. Todos os elementos `<a href>` encontrados
nesse HTML são preservados no relatório, inclusive links repetidos e protocolos
como `mailto:` e `tel:`. Nesta fase, são verificados no máximo 20 destinos
HTTP(S) únicos e 20 recursos entre imagens, folhas de estilo e scripts. Elementos
que ultrapassam o limite continuam visíveis como “não verificados”.

Links são consultados primeiro com `HEAD`. Qualquer resposta de erro é confirmada
com um `GET` leve antes da classificação, reduzindo falsos positivos em servidores
que não oferecem suporte adequado a `HEAD`. Respostas `401`, `403` e `429` são
tratadas como inconclusivas, enquanto `404` e `410` confirmados por `GET` são
classificados como links quebrados.

Cada elemento `<img src>` sem o atributo `alt` gera uma ocorrência própria. O
relatório informa a URL exata da imagem, o domínio que a hospeda, a página onde
ela aparece e o trecho HTML encontrado. Um `alt=""` presente não é tratado como
erro automático, pois é a implementação correta para imagens apenas decorativas.

## Qualidade

```bash
npm run check
```

O comando executa lint, verificação de tipos, testes e build de todos os workspaces.

## Limitações atuais

- Apenas uma página é analisada por vez; não existe crawler de múltiplas páginas.
- O inventário representa o HTML estático recebido; links inseridos posteriormente por JavaScript ainda não aparecem.
- O histórico é armazenado localmente no navegador e ainda não possui sincronização.
- A verificação de responsividade e a integração completa com axe-core ainda não foram implementadas.
- Alguns sites podem restringir requisições automatizadas e produzir resultados inconclusivos.
- Imagens de fundo CSS, imagens inseridas por JavaScript e fontes lazy-load sem `src` ainda não entram nessa verificação inicial.
- Testes automáticos não substituem uma avaliação manual completa de acessibilidade.

## Interface atual

- Visão geral com resumo da última auditoria e lista completa das imagens sem `alt`.
- Gráfico das últimas oito auditorias, dividido por categoria e com acesso ao relatório.
- Formulário para nova auditoria.
- Relatório organizado entre “Ocorrências” e “Todos os links”.
- Inventário de links em ordem de aparição, com busca, filtro por resultado, ordenação, status HTTP, destino final e evidência HTML.
- Detalhamento de imagens sem `alt`, incluindo arquivo, domínio, página e elemento HTML.
- Distinção entre problemas confirmados, destinos indisponíveis e verificações inconclusivas.
- Exportação do relatório em JSON e impressão.
- Histórico local com seleção e exclusão de resultados.
- Configurações de limites de links, recursos e histórico.
- Área de ajuda com explicações e limitações.

## Roadmap

- **v0.1:** fundação, validação segura de URL e primeiro diagnóstico.
- **v0.2:** verificações de responsividade e capturas de tela.
- **v0.3:** integração com axe-core e regras WCAG.
- **v1.0:** dashboard consolidado, documentação e deploy.

Consulte [AGENTS.md](./AGENTS.md) para conhecer as regras de colaboração e os objetivos completos do projeto.
