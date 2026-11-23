# TrueMain App (Desktop + Mobile)

> **Este projeto é um fork de [ilyanfraimbault/TrueMain](https://github.com/ilyanfraimbault/TrueMain)**, criado por Ilyan Fraimbault.
> O código-base, a ideia original (estatísticas feitas a partir de *true mains*) e a licença vêm de lá. Este fork é mantido por [baku01](https://github.com/baku01) e se concentra no **ecossistema do aplicativo** — **app desktop** (macOS e Windows), **overlay em partida** e **app companheiro para Android** — com interface em português do Brasil, múltiplas fontes de dados, identidade visual própria e recursos novos. Veja [o que este fork muda](#o-que-este-fork-muda) e [licença e créditos](#licença-e-créditos).

Um **companheiro completo para League of Legends**, em português do Brasil:
- **No computador (Desktop — Tauri + Rust + Nuxt):** conecta-se ao cliente do League of Legends, acompanha automaticamente lobby, seleção de campeões, partida e pós-partida, exibe estatísticas avançadas (*Stats for Nerds*), builds de múltiplas fontes, overlay sobre o jogo e dicas por voz.
- **No celular (Android — Kotlin + Jetpack Compose):** pareia com o app desktop na mesma rede Wi-Fi por QR Code (com criptografia ponta a ponta) para entrar na fila, aceitar partida longe do PC, escolher/banir campeões, ajustar runas/feitiços/skins, acompanhar o jogo ao vivo e consultar builds e tier list com a mesma identidade visual e tema do desktop.

![Painel do app desktop com perfil, estatísticas e histórico](docs/screenshots/dashboard.png)

---

## Como a aplicação funciona

O ecossistema roda localmente na sua máquina, sem exigir chave da API da Riot nem servidor intermediário para controlar o cliente:

```text
┌───────────────────────────┐        LCU API (local) + Live Client Data
│  Cliente do League (PC)   │ ◄──────────────────────────────────────────┐
└───────────────────────────┘                                            │
                                                                         ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                   TrueMain Desktop (Tauri: Rust + Nuxt)                    │
│  • Lê estado do cliente (lobby, draft, partida, perfil, histórico)         │
│  • Importa runas, feitiços e conjuntos de itens direto no cliente          │
│  • Desenha janelas transparentes de Overlay sobre o jogo + Dicas por voz   │
│  • Consulta builds/stats em fontes externas (TrueMain, Blitz, op.gg, etc.) │
│  • Servidor local "Phone Link" (Wi-Fi, porta 42719, X25519 + ChaCha20)     │
└───────────────────────────────────────▲────────────────────────────────────┘
                                        │ WebSocket cifrado na rede local
                                        ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                TrueMain Mobile (Android — Kotlin + Compose)                │
│  • Pareamento único por QR Code (ou link), reconexão e descoberta no /24   │
│  • Controla fila, lobby, ready-check, draft (pick/ban/runas/skins/trades)  │
│  • Acompanha partida ao vivo, histórico, tier list e builds no celular     │
│  • Recebe automaticamente o tema e paleta escolhidos no app desktop        │
└────────────────────────────────────────────────────────────────────────────┘
```

1. **Integração com o cliente do League (Rust — `desktop/crates/lcu`):** o processo nativo detecta o cliente aberto (macOS e Windows), assina os eventos do LCU em tempo real e lê a Live Client Data API durante a partida. A interface troca de tela sozinha conforme a fase do jogo (`Lobby` → `Seleção de campeões` → `Partida` → `Pós-partida`).
2. **Camada de dados multi-fonte (`desktop/app`):** builds, runas, confrontos, histórico de LP e estatísticas são lidos da fonte escolhida em Configurações (TrueMain, Blitz, op.gg, lolalytics ou Tencent), sempre com selo indicando a origem dos números.
3. **Overlay independente (`desktop/src-tauri/src/overlay`):** cada painel sobre o jogo roda numa janela leve dedicada que só atualiza durante a partida, evitando consumo de CPU/GPU fora do jogo.
4. **Phone Link seguro (`desktop/crates/phone-link` ↔ `mobile/`):** o desktop expõe um canal local opcional na porta `42719` (ligado manualmente em *Configurações → Celular*). O pareamento usa QR Code de uso único; toda comunicação trafega cifrada com **X25519 + HKDF-SHA256 + ChaCha20-Poly1305** e passa por uma *allow-list* estrita de endpoints no desktop.

---

## Principais funcionalidades

### App Desktop (`desktop/`)

- **Painel de jogador e pós-partida:** seu perfil (lido do cliente) ou de **qualquer jogador** buscado via `⌘K` (`Nome#TAG`) ou clicado em uma partida. Inclui:
  - **Abas no estilo Blitz:** *Visão geral*, *Pool de campeões* (rota por rota na temporada) e *Histórico de LP* (Solo/Duo e Flex, com início da temporada, pico, mínimo e saldo).
  - **Histórico com badges** (MVP, multiabates, mais dano, mestre do CS, imortal, primeiro abate, jogo perfeito…) e **painel completo da partida** (objetivos, ouro, dano, gráficos, probabilidade de vitória, linha do tempo e dano das runas).
  - **Estatísticas detalhadas** (~25 métricas das últimas partidas comparadas aos oponentes diretos de rota e numa régua com a mediana de cada elo, do Ferro ao Desafiante), ranking e temporadas (op.gg), maestria exata (`championmastery.gg`) e card **Jogou com**.
  - **Pós-partida automático:** abre sozinho ao fim da partida com "Como foi" (CS e visão/min contra o seu elo e onde ocorreram as mortes).
- **Stats for Nerds (`/nerd-stats`):** análise estatística aprofundada que vai além das últimas 20 partidas do cliente (combinando histórico local + Blitz), mostrando em linguagem direta o que realmente aumenta ou reduz sua taxa de vitória, com nível de confiança, distribuições, sequências, mapa de calor de horários, drivers de desempenho e a matemática completa a um clique.
- **Seleção de campeões e Swiftplay:**
  - Tela única de draft sem rolagem, com os dois times nas laterais, counters na própria rota, medidor de dano (físico/mágico/verdadeiro), card de aliado ao passar o mouse (elo, autofill, maestria, duo) e seus favoritos.
  - **Sugestões ponderadas** (presets como *Equilibrado*, *One Trick*, *Segue o meta*, *Counter puro*, *Dono da rota*, *Subir de elo*) e builds completas com importação manual ou automática de runas e item sets (respeitando apenas páginas criadas pelo TrueMain).
  - **Lobby do Swiftplay:** configura e importa builds/runas para os dois campeões escolhidos direto no lobby.
- **Confronto · Jev (`/jev` e modo Jev no draft):** usa o [Jev](https://typesafe.ai) para ler os kits inimigos e cada item/runa/feitiço e ranquear a melhor build para o draft específico (com nota de 0 a 100 e escolha por família: rota, confronto, estilo do Blitz ou one-tricks). Requer chave própria em Configurações e só dispara sob clique.
- **Campeões, Tier List, Analytics, ProBuild e Catálogos:**
  - **Página do campeão:** builds por estilo (*Bruiser*, *Lethality*…), one-tricks, sua build anterior, árvore de itens, ordem de habilidades com vídeo e valores nível a nível, **Counters** (ordenados por *pp*, com opção "só fase de rotas"), **Sinergias** e **Rotas da selva** (op.gg).
  - **Estatísticas:** *Duplas*, *Maestria* (taxa de vitória de 5+ a 100+) e variação **Δ WR** por patch na lista de campeões.
  - **Meus kits:** crie e salve suas próprias árvores de itens, runas e feitiços por campeão/rota — integradas ao draft e ao overlay.
  - **Catálogos offline-friendly:** Itens (com receita em árvore), Runas, Classes/Subclasses e Notas da atualização.
- **Partida ao vivo, Overlay e Dicas por voz:**
  - Tela da partida com divisão de dano, próximo item e receita, ordem de habilidades e ficha de cada jogador (elo, duo/trio, maestria).
  - **Overlay sobre o jogo (`/overlay`):** painéis configuráveis de próximo item, CS/min ao vivo a cada *last hit*, vantagem de ouro na rota, timers de objetivos, probabilidade de vitória, valor dos itens e **dicas em tempo real** com suporte a pacotes de voz (`voice-packs/`).
- **16 temas + Claro/Escuro + Zoom:** TrueMain (escuro e claro), 4 sabores do Catppuccin (Latte, Frappé, Macchiato, Mocha), Dracula, Nord, Gruvbox, Tokyo Night, Rosé Pine, Solarized, One Dark e União Soviética — com 14 cores de destaque aplicadas no app, no overlay, no ícone e **sincronizadas automaticamente com o celular**.

### App Mobile — Android (`mobile/`)

- **Identidade visual alinhada ao Desktop:** construído em Kotlin + Jetpack Compose com as mesmas fontes (**Sora** + **Figtree** + **Geist Mono**), marca M-check e wordmark **TrueMain**, superfícies em *tone ladder*, brasões metálicos de Tier (`TmTierBadge`), *splash arts* de campeões e sincronização ao vivo do tema ativo no PC.
- **Pareamento simples e seguro:** escaneie o QR Code exibido em *Configurações → Celular* no desktop (ou cole o link de pareamento). Depois de pareado, reconecta sozinho e encontra o PC na rede local (`/24`) mesmo que o IP mude.
- **Jogar longe do teclado:**
  - **Home:** banner do jogador com *splash art*, elos Solo/Duo e Flex (com win rate) e histórico recente de partidas.
  - **Play:** escolha de fila, gestão de lobby, seleção de rotas, convites de amigos e tempo de fila.
  - **Ready Check:** alerta em tela cheia com vibração para aceitar ou recusar partida de qualquer cômodo.
  - **Draft:** faixas de time no estilo broadcast, busca e filtro por classe, hover/lock/ban com confirmação, troca de posição/campeão, banco do ARAM, escolha de skins, feitiços e editor/aplicação de runas.
  - **Game:** placar ao vivo, relógio sincronizado, barras de vida/mana, objetivos, próximos spawns (Dragão, Vastilarvas, Arauto, Barão) e scoreboard completo.
  - **Builds & Tier List:** consulta direta à API do TrueMain com brasões de tier, builds completas por rota e botão para enviar a página de runas direto para o cliente no PC.

---

## Capturas de tela

### App Desktop

| | |
|---|---|
| ![Painel de um jogador](docs/screenshots/dashboard.png)<br>**Painel:** perfil do jogador com Visão geral, Pool de campeões e Histórico de LP | ![Estatísticas detalhadas](docs/screenshots/stats.png)<br>**Estatísticas detalhadas:** comparação por elo e contra oponentes de rota |
| ![Histórico de LP](docs/screenshots/profile-lp.png)<br>**Histórico de LP:** Solo/Duo e Flex na temporada inteira | ![Pós-partida](docs/screenshots/postmatch.png)<br>**Pós-partida:** resumo automático "Como foi" e painel da partida |
| ![Seleção de campeões](docs/screenshots/draft.png)<br>**Seleção de campeões:** times nas laterais, counters e sugestões ponderadas | ![Builds na seleção](docs/screenshots/draft-builds.png)<br>**Builds no draft:** runas, feitiços, ordem de itens e importação em um clique |
| ![Jev na seleção](docs/screenshots/draft-jev.png)<br>**Confronto · Jev:** builds avaliadas pelo Jev conforme o draft inimigo | ![Partida](docs/screenshots/ingame.png)<br>**Partida ao vivo:** dano dos times, próximo item e ficha dos jogadores |
| ![Página de um campeão](docs/screenshots/champion.png)<br>**Campeão:** builds por estilo, one-tricks, árvore de itens e divisão de dano | ![Counters](docs/screenshots/counters.png)<br>**Counters:** ordenados por *pp*, com filtro de fase de rotas |
| ![Rotas da selva](docs/screenshots/jungle.png)<br>**Rotas da selva:** limpeza inicial desenhada no mapa (op.gg) | ![Overlay](docs/screenshots/overlay-next-item.png)<br>**Overlay em partida:** próximo item, receita e ordem da build sobre o jogo |
| ![Tier list](docs/screenshots/tierlist.png)<br>**Tier list:** medalhas metálicas por tier | ![Tema claro](docs/screenshots/light.png)<br>**Tema claro:** painéis brancos de alto contraste (além de 16 temas extras) |

### App Mobile (Android)

| | | |
|---|---|---|
| ![Connect](docs/screenshots/mobile/01-connect.png)<br>**Pareamento:** QR Code ou link | ![Home Dark](docs/screenshots/mobile/02-home.png)<br>**Home (Dark):** perfil, elos com WR e histórico | ![Home Latte](docs/screenshots/mobile/02b-home-latte.png)<br>**Home (Tema claro):** sincronizado com o PC |
| ![Lobby](docs/screenshots/mobile/04-play-lobby.png)<br>**Play / Lobby:** fila, rotas e amigos | ![Ready Check](docs/screenshots/mobile/06-ready-check.png)<br>**Ready Check:** aceite com vibração | ![Draft Pick](docs/screenshots/mobile/07-draft-pick.png)<br>**Draft:** escolha e banimento |
| ![Draft Locked](docs/screenshots/mobile/09-draft-locked.png)<br>**Draft (Times):** faixas broadcast, feitiços, skins e runas | ![Live Game](docs/screenshots/mobile/11-game.png)<br>**Partida ao vivo:** placar, objetivos e timers | ![Tier List](docs/screenshots/mobile/13-builds-tier-list.png)<br>**Builds / Tier List:** brasões metálicos e builds com envio de runas |

---

## Fontes de dados (Configurações)

Em **Configurações → Fonte de dados**, todas as telas de estatísticas passam a usar a fonte escolhida:

| Fonte | O que traz |
|---|---|
| **TrueMain** | Estatísticas do projeto original, calculadas a partir dos *true mains* |
| **Blitz** | Builds, tier list, matchups, builds contra oponente e partidas recentes de pros |
| **op.gg** | API oficial (MCP): builds, runas, counters, rotas da selva e ranking por campeão |
| **lolalytics** *(experimental)* | Detalhamento fino: cada runa, item por slot, matchups, objetivos e duração de partida |
| **Tencent** *(experimental)* | Guias do `lol.qq.com` (servidores chineses, atualizados diariamente) |

Builds e runas vêm sempre da fonte escolhida, sem misturar. O que ela não mede (como histórico de LP, maestria ou one-tricks) é preenchido por outra fonte que mede, sempre identificado com um selo. Em **Configurações → Patch dos dados**, é possível escolher o patch atual, o anterior, modo automático ou um patch específico (para o lolalytics).

---

## Baixar e instalar

### Builds automáticos (Desktop — CI `latest`)

Gerados automaticamente pelo GitHub Actions (`.github/workflows/desktop-build.yml`) na branch `main`, com suporte a atualização automática dentro do app:

| Plataforma | Download |
|---|---|
| **macOS** (Apple Silicon: M1, M2, M3, M4…) | [TrueMain-macOS-AppleSilicon.dmg](https://github.com/baku01/TrueMain-app/releases/latest/download/TrueMain-macOS-AppleSilicon.dmg) |
| **macOS** (Intel) | [TrueMain-macOS-Intel.dmg](https://github.com/baku01/TrueMain-app/releases/latest/download/TrueMain-macOS-Intel.dmg) |
| **Windows** (64 bits) | [TrueMain-Windows-setup.exe](https://github.com/baku01/TrueMain-app/releases/latest/download/TrueMain-Windows-setup.exe) |

### Pre-releases (Desktop + Android / Phone Companion)

Os builds do app Android (`.apk`) e pré-lançamentos com recursos em desenvolvimento ficam em **[Releases](https://github.com/baku01/TrueMain-app/releases)**.

> **Observações de instalação (builds não assinados):**
> - **macOS:** após copiar `TrueMain.app` para `/Applications`, rode `xattr -cr /Applications/TrueMain.app`.
> - **Windows:** no aviso do SmartScreen, clique em *Mais informações* → *Executar assim mesmo*.
> - **Android:** instale `TrueMain-Android-release.apk` (permitindo instalação de fontes desconhecidas no aparelho).

---

## Como rodar e compilar localmente

### Desktop (`desktop/`)

Requisitos: **Node 24 + npm**, **Rust (stable)** e toolchain do **Tauri** (no macOS, Xcode Command Line Tools).

```bash
cd desktop/app
npm ci

# Interface no navegador com cenários de simulação (sem precisar abrir o League):
npm run dev            # http://localhost:3003

# App nativo completo conectado ao cliente do League:
npm run tauri dev

# Simulador de seleção de campeões + app no navegador, sem compilar Rust (na raiz):
./sim-lcu.sh

# Testes e verificações:
npm run test
npm run lint
npm run typecheck
cd .. && cargo test --workspace
```

Para compilar o instalador local (`.app` / `.dmg` / `.exe`):

```bash
cd desktop/app
npm run tauri -- build --config flavor.json
```

> **CI/CD e auto-update:** a CI gera versões `0.5.<run_number>` assinadas e publica o feed `latest.json` na tag `latest`. Ao gerar um build manual local, defina em `desktop/flavor.json` uma versão acima da que está em `latest.json` (com `"createUpdaterArtifacts": false`) para que o updater do Tauri não faça downgrade automático para a versão da CI ao abrir o app.

### Mobile — Android (`mobile/`)

Requisitos: **JDK 21** (`JAVA_HOME`) e **Android SDK** (`ANDROID_HOME`, platform `android-37.2`, build-tools `36`).

```bash
cd mobile
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME=~/Library/Android/sdk

# Testes de protocolo (vetores X25519 / ChaCha20 contra a crate Rust):
./gradlew :app:testDebugUnitTest --tests "lol.truemain.mobile.link.VectorsTest"

# Regerar todos os screenshots (Roborazzi):
./gradlew :app:testDebugUnitTest --tests "lol.truemain.mobile.screens.ScreenshotTest"

# Gerar APKs (saída em mobile/app/build/outputs/apk/):
./gradlew :app:assembleDebug
./gradlew :app:assembleRelease
```

---

## O que este fork muda

Em relação ao [projeto original](https://github.com/ilyanfraimbault/TrueMain):

- **App Android companheiro (`mobile/`) + Phone Link (`desktop/crates/phone-link`):** controle do cliente do League pelo celular via Wi-Fi com criptografia ponta a ponta, descoberta automática, sincronização de tema e visual alinhado ao desktop.
- **Stats for Nerds (`/nerd-stats`):** análise profunda do histórico expandido com leitura em texto simples, nível de confiança e matemática detalhada.
- **Overlay evoluído + Pacotes de voz (`voice-packs/`):** CS/min ao vivo, ouro da rota, objetivos, próximo item e dicas faladas.
- **Idioma:** app desktop e mobile em **português do Brasil** (e inglês), incluindo nomes e descrições de itens, campeões, runas e feitiços.
- **16 temas + Claro/Escuro:** com 14 cores de destaque no app, overlay, ícone e celular.
- **Identidade visual:** layout inspirado no Blitz nas cores do TrueMain — Sora nos títulos, Figtree no texto, ícones Tabler e brasões metálicos para tiers.
- **Múltiplas fontes de dados:** TrueMain, Blitz, op.gg, lolalytics e Tencent, sem exigir chave da API da Riot.
- **Confronto · Jev, Meus kits, Analytics, ProBuild, Habilidades, Classes, Itens/Runas, Notas da atualização e Swiftplay.**
- **Simulador local (`./sim-lcu.sh`)** e **atualização automática** via GitHub Releases (`.github/workflows/desktop-build.yml`).

---

## Estrutura do repositório

```text
desktop/       App desktop em Tauri (src-tauri + crates/{lcu,phone-link} em Rust, app/ em Nuxt)
mobile/        App companheiro Android (Kotlin + Jetpack Compose + testes Roborazzi)
voice-packs/   Pacotes de voz para dicas em partida no overlay
web/           Site público herdado do original; web/layers/common é compartilhado com o desktop
backend/       Solução .NET herdada do original (Api, Ingestor, Core, Data) — não implantada neste fork
admin/         Portal administrativo herdado do original — não implantado neste fork
docs/          Documentação, RFCs e capturas de tela do desktop
```

---

## De onde vêm os dados

| Fonte | Uso |
|---|---|
| API do TrueMain (`truemain.lol`) | Estatísticas na fonte TrueMain, recomendações de draft/próximo item e referências por elo |
| Blitz (`iesdev.com`) | Perfis, partidas de qualquer jogador, elos da partida, builds, pros e divisão de dano |
| op.gg (API oficial) | Ranking, temporadas, rotas da selva e estatísticas na fonte op.gg |
| lolalytics e Tencent | Estatísticas nessas fontes *(experimental)* |
| [championmastery.gg](https://championmastery.gg) | Pontos exatos de maestria no painel |
| [Jev](https://typesafe.ai) | Avaliação de builds e sugestões no modo Jev (com chave própria do usuário) |
| [Data Dragon](https://developer.riotgames.com/docs/lol) e [Community Dragon](https://www.communitydragon.org/) | Nomes, textos, ícones e *splash arts* de campeões, itens, feitiços e runas |
| Cliente do League (local) | Lobby, seleção de campeões, perfil, histórico, maestria e partida ao vivo |
| [Wiki do League](https://wiki.leagueoflegends.com/) e `leagueoflegends.com` | Subclasses de campeões e notas de atualização |

---

## Licença e créditos

- **Licença:** [PolyForm Noncommercial 1.0.0](LICENSE), a mesma do projeto original. Uso permitido para fins **não comerciais**, mantendo o aviso de `LICENSE` (*Required Notice: Copyright 2026 Ilyan Fraimbault*).
- **Projeto original:** [ilyanfraimbault/TrueMain](https://github.com/ilyanfraimbault/TrueMain), de Ilyan Fraimbault. Este repositório é um fork independente.
- **Ícones:** [Tabler](https://tabler.io/icons) (MIT), [Phosphor](https://phosphoricons.com) (MIT) e [Lucide](https://lucide.dev) (ISC).
- **Fontes:** [Sora](https://fonts.google.com/specimen/Sora), [Figtree](https://fonts.google.com/specimen/Figtree) e [Geist Mono](https://vercel.com/font) (SIL OFL).
- **Dados do jogo e arte:** Riot Games. O TrueMain **não é endossado pela Riot Games** e não reflete as opiniões da Riot Games nem de quem esteja envolvido na produção ou gerenciamento das propriedades da Riot Games. League of Legends e Riot Games são marcas registradas da Riot Games, Inc.
