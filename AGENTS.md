# AGENTS.md - Reinatus

Este documento define o contrato operacional e técnico do projeto **Reinatus** (Super Poten Max).

## 1. Identidade e Registro

```text
Project ID: reinatus
Nome Humano: Reinatus
Repositório: VX-Growth/reinatus
Domínio Público: https://reinatus.vx.dev.br
Domínio Customizado: https://reinatus.com.br
Executor de Deploy: central-executor
Porta do Container: 3000
Healthcheck: /
Banco de Dados: PostgreSQL dedicado (reinatus)
Rede: vx-project-reinatus
```

## 2. Identidade Visual da Marca

- **Produto Principal:** Super Poten Max Africano (Cápsulas 500mg e Gotas Sublinguais 30ml)
- **Paleta de Cores:**
  - `#060913` (Obsidian Deep Navy)
  - `#0B1120` (Midnight Slate)
  - `#06B6D4` (Ciano Atlético de Conversão)
  - `#2563EB` (Azul Royal)
  - `#F59E0B` (Dourado de Oferta e Escassez)
  - `#10B981` (Verde Esmeralda de Checkout / WhatsApp)
- **Tipografia:** Plus Jakarta Sans & Inter
- **Ativos:** Frascos originais em `public/assets/images/`

## 3. Arquitetura da Aplicação

- Runtime: Node.js 22 LTS (Alpine)
- Servidor: Express (`server.js`)
- Persistência: PostgreSQL dedicado via variável de ambiente `DATABASE_URL`
- Healthcheck: `GET /health` e `GET /api/health`
- Frontend: HTML5 Semântico / Modern CSS / Vanilla JS com seletor interativo de kits, FAQ accordion, sticky mobile bar, WhatsApp floating concierge e integração direta aos checkouts Yampi.

## 4. Deploy Canônico

Novas versões devem ser commitadas na branch `main` e o deploy é disparado centralmente pelo repositório `VX-Growth/infra-vps` via issue `[VX DEPLOY] reinatus`.
