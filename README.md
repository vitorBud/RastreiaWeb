# RastreiaWeb

O RastreiaWeb é uma plataforma open source para auditoria e diagnóstico de websites. O projeto ajudará desenvolvedores a localizar problemas técnicos, compreender sua gravidade e encontrar caminhos de correção.

> O projeto está na fase de fundação. A auditoria de páginas ainda não foi implementada.

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

## Qualidade

```bash
npm run check
```

O comando executa lint, verificação de tipos, testes e build de todos os workspaces.

## Limitações atuais

- Nenhuma URL externa é acessada nesta fundação.
- O formulário inicial ainda não dispara uma auditoria.
- Testes automáticos não substituem uma avaliação manual completa de acessibilidade.

## Roadmap

- **v0.1:** fundação, validação segura de URL e primeiro diagnóstico.
- **v0.2:** verificações de responsividade e capturas de tela.
- **v0.3:** integração com axe-core e regras WCAG.
- **v1.0:** dashboard consolidado, documentação e deploy.

Consulte [AGENTS.md](./AGENTS.md) para conhecer as regras de colaboração e os objetivos completos do projeto.
