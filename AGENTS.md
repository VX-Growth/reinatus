# VX PROJECT AGENT BOOTSTRAP

Protocol version: 2026-09-08.2

> **LEITURA OBRIGATORIA ANTES DE QUALQUER ACAO NESTE REPOSITORIO.**

Este projeto faz parte da infraestrutura gerenciada da VX Growth.

Antes de diagnosticar, alterar codigo, banco, deploy, DNS, Auth, Storage, Edge Functions, cron, secrets, integracoes ou infraestrutura:

1. leia o protocolo global em `VX-Growth/infra-vps/AGENTS.md`;
2. leia a fonte unica de contexto em `VX-Growth/infra-vps/VX-MASTER-CONTEXT.md`;
3. localize e leia o manifest deste projeto em `VX-Growth/infra-vps/platform/projects/`;
4. leia a documentacao operacional especifica aplicavel em `VX-Growth/infra-vps/docs/`;
5. confira o estado live antes de assumir que GitHub e producao coincidem.

## Regras permanentes

- Nao invente infraestrutura paralela se a VX ja possui ferramenta oficial para a tarefa.
- VPS/PostgreSQL VX e a infraestrutura de destino oficial. Servicos externos usados como origem de migracao nao viram automaticamente infraestrutura oficial.
- Project Factory provisiona novos projetos e contratos gerenciados.
- Control Plane coordena operacoes gerenciadas.
- VX Executor e workflows canonicos executam mutacoes autorizadas.
- Cloudflare cuida de DNS/edge conforme o manifest e os fluxos oficiais.
- Secrets nunca devem ser expostos, copiados para documentacao ou distribuidos entre repositorios.
- Toda alteracao deve ser pequena, reversivel, validada e documentada.
- Mudanca de arquitetura, ferramenta, servico, padrao operacional ou capacidade global exige atualizar `VX-Growth/infra-vps/VX-MASTER-CONTEXT.md` no mesmo bloco de trabalho.
- Uma ferramenta nova nao esta concluida enquanto nao estiver documentada no contexto mestre.
- Antes de acao irreversivel ou de alto impacto fora do escopo autorizado, pare e solicite autorizacao.

## Regra de conclusao

```text
ENTENDER -> LER CONTEXTO VX -> AUDITAR -> EXECUTAR -> VALIDAR -> DOCUMENTAR -> CONCLUIR
```

Se este arquivo conflitar com o contexto global, nao improvise. Consulte `VX-MASTER-CONTEXT.md`, o manifest do projeto e o estado live e reporte o conflito.

---

## Existing repository agent instructions preserved

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
