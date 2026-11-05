# TrueMain App — o companheiro desktop

> **Fork de [ilyanfraimbault/TrueMain](https://github.com/ilyanfraimbault/TrueMain)**, de Ilyan Fraimbault. O app desktop, a ideia e a licença (PolyForm Noncommercial 1.0.0) vêm do projeto original; este fork, mantido por [baku01](https://github.com/baku01), traz o app em **português do Brasil**, uma nova identidade visual com tema escuro e claro, e abas novas. A visão geral do repositório está no [README da raiz](../README.md).

## Visão geral

Um app leve (Tauri v2 + Nuxt 4) que lê o cliente do League of Legends **somente para leitura**, acompanha a seleção de campeões e a partida, e mostra estatísticas, builds, runas e notas de atualização.

![Página de um campeão: todas as opções de build medidas pela fonte escolhida](../docs/screenshots/champion.png)

| | |
|---|---|
| ![Painel de um jogador](../docs/screenshots/dashboard.png)<br>**Painel:** o perfil de qualquer jogador — o seu (lido do cliente) ou o de quem você buscar ou clicar numa partida | ![Estatísticas detalhadas](../docs/screenshots/stats.png)<br>**Estatísticas detalhadas:** por elo (régua com a mediana de cada elo) e contra os oponentes de rota; ranking e temporadas do op.gg |
| ![Página de um campeão](../docs/screenshots/champion.png)<br>**Campeão:** todas as opções medidas pela fonte escolhida, com taxa de vitória — runas, feitiços, iniciais, botas, núcleos e melhores jogadores | ![Analytics](../docs/screenshots/analytics.png)<br>**Analytics:** tudo o que a fonte mede sobre um campeão, por rota e elo |
| ![Confronto](../docs/screenshots/matchup.png)<br>**Confronto:** a build para o draft e as partidas reais do confronto | ![Busca](../docs/screenshots/search.png)<br>**Busca (⌘K):** campeões e jogadores (`Nome#TAG`), com a região e o elo |
| ![Fontes de dados](../docs/screenshots/sources.png)<br>**Configurações:** a fonte de dados — TrueMain, Blitz, op.gg, lolalytics ou Tencent | ![ProBuild](../docs/screenshots/probuild.png)<br>**ProBuild:** as partidas recentes de pros, vitória ou derrota em destaque |
| ![Tier list](../docs/screenshots/tierlist.png)<br>**Tier list:** os campeões por tier, em medalhas | ![Classes](../docs/screenshots/classes.png)<br>**Classes:** campeões por classe e subclasse, com o papel de cada uma |
| ![Itens](../docs/screenshots/items.png)<br>**Itens:** descrição e receita em árvore | ![Runas](../docs/screenshots/runes.png)<br>**Runas:** as árvores e a descrição colorida |
| ![Seleção de campeões](../docs/screenshots/draft.png)<br>**Seleção de campeões:** os times nas laterais com counters, a tier list da rota e as sugestões em pôsteres — da fonte ou reordenadas pelo Jev | ![Builds na seleção de campeões](../docs/screenshots/draft-builds.png)<br>**Builds na seleção:** runas, feitiços, iniciais, ordem de itens e evolução num card só, com importação e as builds de pros |
| ![Partida](../docs/screenshots/ingame.png)<br>**Partida:** placar, próximo item e o que cada jogador vem fazendo | |
| ![Notas da atualização](../docs/screenshots/patchnotes.png)<br>**Notas da atualização:** patch a patch, atualizadas sozinhas | ![Overlay de próximo item](../docs/screenshots/overlay-next-item.png)<br>**Overlay:** o próximo item sobre o jogo, com a receita e a ordem da build |

As capturas foram feitas no navegador (`npm run dev`) com dados reais das fontes; as telas de seleção de campeões e partida usam cenários de simulação do projeto (contas e partidas fictícias). O app também tem **tema claro**, alternado pelo botão da barra superior:

![Página de um campeão no tema claro](../docs/screenshots/light.png)

## Novidades deste fork

- **Idioma:** português do Brasil e inglês, escolhidos na barra superior. Os textos de itens, campeões, runas e feitiços vêm do Data Dragon e do Community Dragon no idioma escolhido, e a troca recarrega a janela. O menu nativo e a bandeja seguem o idioma. As mensagens ficam em dicionários por área (`app/i18n/` aqui e `web/layers/common/app/i18n/` na camada compartilhada; `app/i18n-sources/` troca alguns textos quando outra fonte está escolhida), e o teste `tests/i18n-messages.test.ts` falha se faltar uma chave em um idioma.
- **Visual e navegação:** azul-marinho, tema escuro e claro, ícones Phosphor, medalhas de tier, menu lateral agrupado e recolhível (`AppNav`), busca única de campeão e jogador (⌘K, `ChampionSearch`).
- **Fontes de dados** (`app/utils/data-source.ts`, `app/utils/sources/`): TrueMain, Blitz, op.gg, lolalytics e Tencent. Cada fonte responde as mesmas leituras nos formatos do TrueMain (`Provider` em `utils/sources/index.ts`): `apiGet`/`apiPost` e `readChampionBuild` perguntam primeiro à fonte escolhida. No Tauri as leituras externas passam pelo Rust (`src-tauri/src/sources.rs`: bases fixas, caminhos validados, cache de 2 h limitado a 32 MB); no `npm run dev`, pelos proxies `/__blitz/*`, `/__opgg`, `/__lolalytics` e `/__tencent` (`nuxt.config.ts`).
- **Painel de qualquer jogador** (`pages/index.vue`): `?riotId=Nome%23TAG&region=br` mostra outro jogador lido do Blitz (`useViewedPlayer`), no mesmo layout do perfil próprio; os links de jogador da camada compartilhada (`/truemains/…`) e o antigo `/player` caem nele (`middleware/player-links.global.ts`). Estatísticas detalhadas contra os oponentes de rota e por elo (`utils/player-stats.ts`, `DashboardDetailedStats`, `DashboardEloLadder`) e ranking/temporadas do op.gg (`utils/sources/opgg-profile.ts`, `DashboardSeasons`).
- **Abas:** Analytics, Itens e runas, Classes, Notas da atualização (lidas de leagueoflegends.com pelo Rust), ProBuild (por fonte).
- **Overlay:** próximo item com a receita e a ordem da build (`OverlayNextItemPath`), o mesmo componente no exemplo das configurações.
- **Nativo:** barra de título no tema do app (`chrome.rs`; no macOS `titleBarStyle: Overlay` em `tauri.macos.conf.json`, com regiões de arraste na barra superior), instância única (`tauri-plugin-single-instance`), ⌘, para Configurações, fechar esconde no macOS, e `plugins/native.client.ts` tira o menu de clique direito e os atalhos de navegador na versão final.
- **Confronto · Jev** (`pages/jev.vue`, `utils/jev-*.ts`, `useJevBuild`): a build e as runas classificadas com o [Jev](https://typesafe.ai) (TypeSafe System One). O Jev só lê textos — os kits inimigos, cada item candidato, as runas, os feitiços e os iniciais, sempre em inglês (`useJevTexts`) — e responde perguntas de escala (Score) e de sim/não (Noul); o app faz as contas: o que o time inimigo joga em nós (divisão de dano medida pelo Blitz e o que se destaca de um time comum), o encaixe de cada item, as estatísticas de lolalytics e Blitz somadas (vitória puxada pela amostra e o WPA do Blitz) e a nota final, parte por parte. Mostra a build recomendada ao lado da mais jogada, cada etapa com suas opções, e importa runas e item set para o cliente. A chave fica em Configurações, guardada pelo shell (`src-tauri/src/jev.rs`), nunca devolvida à interface. Cada pedido é uma chamada paga: o Jev só é chamado num clique.
- **Seleção de campeões** (`components/draft/`): uma tela só, sem rolar — os dois times como faixas nas laterais (counters de cada inimigo na própria faixa, a divisão de dano numa barra fina, a tier list da rota e os counters do oponente embaixo) e, no centro, um card com as abas **Sugestões** (pôsteres de todas as sugestões, a nota e o motivo) e **Builds** (runas ao lado de feitiços, iniciais, ordem de itens, botas, situacionais e ordem de evolução, importação nos cabeçalhos, as builds de pros num menu). Um seletor **Fonte | Jev** no cabeçalho faz o Jev reordenar as sugestões (com o detalhamento da nota) e montar a build do draft. A página Confronto · Jev também lê o draft do cliente sozinha.
- **Perfil e partidas no estilo Blitz:** badges de partida com o motivo de cada um, painel da partida com abas, Linha do tempo, dano das runas por jogador, maestria (top 5 com os pontos exatos do championmastery.gg) e a análise do jogador nas estatísticas detalhadas.
- **Fontes e dados:** builds e runas sempre da fonte escolhida; o que ela não tiver vem do lolalytics e depois do Blitz, cada resposta inteira de uma fonte só (a única soma é a classificação do Confronto · Jev, lolalytics + Blitz). Os dados do TrueMain só são usados com o TrueMain escolhido.
- **Simulador de LCU sem compilar:** `./sim-lcu.sh` na raiz sobe o servidor de desenvolvimento e abre o simulador de seleção de campeões (os dois times já sorteados) e o app numa segunda aba, que acompanha o simulador ao vivo.
- **Zoom:** ⌘/Ctrl + `+`, `−` e `0` ampliam o app como no navegador (`zoomHotkeysEnabled`).
- **Removido:** chave da API da Riot e o coletor ProBuild que dependia dela, ranking e marcas de Truemains, gravações (crates `game-recording`, `capture-helper`, `capture-spike` e `capture/`), abas Jogador e Matchups.

## Rodando

```bash
cd desktop/app
npm ci
npm run dev            # a interface no navegador, com cenários de simulação
npm run tauri dev      # o app de verdade, com o cliente do League aberto
../../sim-lcu.sh       # uma seleção de campeões simulada no navegador, sem compilar
npm run test && npm run lint && npm run typecheck
cd .. && cargo test --workspace
```


---

# Documentação técnica (herdada do projeto original, em inglês)

# TrueMain desktop companion

A companion app for the draft phase. It reads the running League client through
its local API, and shows what to do next instead of asking what to look up.

Tracking issue: **#1671**.

## What it does today

- Finds the running client on **macOS and Windows** — process arguments first,
  lockfile as a fallback — and reconnects on its own when the client restarts on
  a new port.
- Follows the client's **WebSocket event stream**, so champion select updates as
  picks land rather than on a poll.
- **A sidebar to every section the site has** — dashboard, champions, tier list,
  matchup, truemains, favorites — plus **champion select**. The **gameflow phase still drives the screen**: champion select opens the draft on
  its own, and leaving it goes back home (only from the draft, never from a page
  the player opened by hand).
- **Draws the draft like the reference client**: each side's bans and the phase
  clock over the two teams as tall pick cards with their tier on their lane, our
  lane duel between them (champion vs opponent, and the lane win rate over the
  games behind the build).
- **Ranks the picks while ours is open**: "My pool" asks the draft endpoint
  (#1675) about the player's ten most-mastered champions played on the lane;
  off, every champion the tier list has on the lane (split into requests of 40,
  the endpoint's ceiling). Before any enemy pick or locked ally there is nothing
  to measure, so the podium shows win rates on the lane instead of "+0.0%".
- **Shows the build to run against the draft as it stands** once the pick is
  locked (or on a click), from the endpoint behind the site's matchup page
  (`POST /champions/{id}/composition-build`), fed every locked pick of both teams
  on its lane, next to the champion's lane builds and its best true mains. It
  re-asks on every lock, and a lock landing while a request is out aborts that
  request (in Rust, and through the fetch signal in a browser) rather than
  queueing behind it. A matchup never recorded falls back to the lane's
  standard build, labelled as such.
- **Reads any champion's build**: clicking a pick shows that champion's build
  from its own side of the draft; a second click comes back to ours.
- **Resolves the enemy lanes** (#1674) and lets you correct them: the lane icon
  under an enemy opens the five lanes, and picking one swaps it with whoever
  held it (dragging one enemy onto another does the same), pinned so the rest
  re-solve around the correction (#1677).
- **Reads your champion mastery** once per login, to rank your own pool
  (`championPool`, most points first) without asking what you play.
- **Opens on your profile**, read from your own client whether TrueMain tracks
  you or not: your ranked standing, the skin you chose as profile background and
  your latest 20 games (`player_record`, on demand, again after each game), with
  each game's scoreboard read once per launch for kill participation, damage
  share and both teams, and a game's timeline when its row is opened
  (`player_game`, in the site's match-detail shape). The history pages back
  through older games as it is paged (`player_history`). It is drawn with the site's
  ranked card, and rows, a compact match detail and cards derived from the
  site's (`components/dashboard/`); the LP curve and per-game LP come from
  standings the app notes on this machine (`utils/lp-history.ts`). None of it
  is sent anywhere.
- **Uses the site's own components** for everything the site already draws —
  the build tree and rune block, the game-entity tooltips, the leaderboard row,
  rank and region marks, the role picker — as labelled twin copies (see
  "Sharing with the site" below). The build's core keeps the site's blocks
  without the build path, which the tree under it draws (`build/BuildCore.vue`).
- **Shows a true main's own build** on a click in the build view's list — the
  site's player-scoped champion endpoint, through the shell.
- **Follows you into the game** (#1748): once the phase is `InProgress` the
  shell reads the game's own Live Client Data API (see "Reading the game"
  below) and the game page opens on its own — from home or from the draft the
  game started out of, never from a page you opened by hand — and its end takes
  you home. The page shows the ten players lane by lane, ours on the left and
  theirs mirrored on the right: champion and level, summoner spells, Riot ID,
  K/D/A and items, an item that just landed ringed for a few seconds, a dead
  player's portrait greyed under the seconds left before they respawn, and the
  kills of each side and the game clock above. It is the frame the in-game
  panels of #1747 land in.
- **Says what to complete next** (#1751): over the board, the legendary the
  champion's mains complete from where your build stands in a game like this
  one (`POST /champions/{id}/next-item`, #1749), with the situation behind it,
  the gold left to finish it, the components your gold buys now, two
  runners-up and the boots while you have none. Asked again whenever anyone's
  items change. Until you hold anything but potions and the trinket, the
  starter above it — the basket the draft's build opens with for the ten
  champions on their lanes, its price and its share of games — which the
  overlay shows in the next item's place.
- **Draws over the game** (#1795, macOS): five small panels, each placed on
  its own — the next item alone (the item and the gold still to earn for it, or
  that it can be bought now), a win probability estimated from the item-gold
  gap and the map (turrets, inhibitors down, drakes, Baron, Elder), your CS per
  minute with its curve and gold per minute, the neutral objectives' next
  spawns (#2078: the dragon pit — its next drake's element once the Rift has
  turned, the Elder once a side holds the soul — between the drakes each side
  took, blue side's left and red side's right, then the Voidgrubs, the Rift
  Herald and Baron: icons only, the game's minimap ones, a countdown until each
  spawns or a green dot while it stands, gone from the panel once taken for
  good; derived by the shell from the
  season's spawn rules, one table in `crates/live-client/src/timers.rs`, and the
  kills the event feed announces, so a patch that moves a timer changes that
  table; Summoner's Rift's standard game only), and, while TAB is held, each team's item gold and each lane's gap —
  once the game has started (its `GameStart` event), never over its loading screen —
  only while the game is the frontmost app, never over the client or anything
  else. Click-through and never focused, so the game keeps every click and key;
  ⌥⇧O hides them for the rest of the game. Set up on the Overlay page (each panel
  on/off and where — five spots, or anywhere by dragging it — the next item's
  moment, size, opacity), with each panel shown always, while a chord is held
  or toggled by one (#1915): the chord is recorded by key position, so it
  holds on any layout, and the page warns when its key also does something in
  game (the overlay reads keys, the game still gets them).
  The window layer is the #1673 spike's verdict, `docs/desktop-overlay-spike.md`.
  The panels go on the monitor the game runs on, read from the game's window
  while it is in front (#1914), the primary monitor before any game.
- **A window you can size** (#1914): resizable down to 960 × 640, opening
  where it was left — on a monitor still plugged in, else centred on the
  primary one, never larger than the monitor. Below 1100 px wide the sidebar
  folds into a rail of icons. Nothing pops up by itself during champion select
  or a game: an update found then waits in the sidebar, its toast after the
  phase.

## What it does not do yet

- **The ranking sees the lane opponent and our locked allies, not the rest of
  the enemy team**, and weighs the two equally. Both are backend work: #1713.
- **No win probability.** The reference apps show one out of a model we do not
  have; the draft strip carries the clock instead (#1671).
- **The rune import is written but not reachable.** Its client-side write path
  and the rule that protects the player's own pages are implemented and tested
  (`crates/lcu/src/runes.rs`); there is no button because the draft endpoint does
  not return a rune page yet (#1678).
- **The dashboard knows the player only by what the client says.** Their own
  numbers need #1682 — our database holds true mains only.
- **The Windows overlay has not met a League game yet** (#1798). CI runs it
  on a Windows desktop over a stand-in game window
  (`tools/overlay-smoke-windows.ps1`, #1806). The panels are drawn, never take
  the foreground, let clicks through, and follow TAB, a held and a toggled
  chord, Alt+Shift+O and the window in front. They are placed by a drag in the preview. What only a player can
  check: a real game in Borderless, under its anti-cheat. Over League in
  exclusive Full Screen Windows draws nothing, so the settings ask for
  Borderless.
- **No compact mode docked beside the client, no second-monitor setting yet**
  (#1914). The window sizes and remembers its monitor, and the overlay follows
  the game's monitor; docking to the client's edge, compact draft and game
  layouts, and opening on a chosen monitor during a phase are still to come.
  The game's monitor is matched from its window's frame on both platforms, but
  only CI's single-monitor runner has run it so far.
- **The next item reads the draft, not the enemies' builds yet.** What they
  have actually bought is #1750; the gold standing and the loading screen are
  #1752 and #1753.
- **Game recording on Windows has not met a League game yet.** The Windows
  helper (#1797) is tested by CI on a repainting window, on a runner with no
  GPU; a real game, the hardware encoders and the display modes wait for a
  tester (#1745's Windows half). Automatic clips (#1766) and instant replay
  (#1767) are not built.

## Sharing with the site

The pages the app renders exactly like the site — champions, tier list, matchup,
truemains, favorites — and everything they are built from (components,
composables, the design system, the Nuxt UI theme, the site's `shared/` types)
come from the Nuxt layer `web/layers/common`, which the app lists in `extends`
(#1732). Its `README.md` is the contract: the imports a shared file may use and
what each app provides (`useApiFetch`, `useChampionSlugs`, `useCanonicalIcon`,
`SkeletonImage`, `RankIcon`). The app's side lives beside its own code:

- `composables/useSiteShims.ts` answers the site composables for an app with no
  image server and no player pages;
- `utils/static-data.ts` builds the site's static-data shapes from Data Dragon
  and Community Dragon in the webview, where the site does it in Nitro.

The app's own pages (dashboard, draft, game, champion page) are not in the
layer. Where one of them still needs a site component the layer does not hold,
it takes a **twin copy** — the repo's rule for a file two apps need
(`decisions/web-frontend-rules.md`): a header names its twin, and it stays
identical to it except for lines marked app-specific. A component that moves
into the layer loses its twin.

## Reaching the API

The API has **no public host**: the site reaches it through the web app's Nitro
proxy, inside the deployment's private network. The desktop app has no Nitro
server, so it uses that same public proxy (`<site>/api`) as its entry point.

**Every build belongs to one site** (`src-tauri/src/site.rs`): the API it reads,
the pages it opens in the browser and the update feed it polls. The site is
`TRUEMAIN_SITE_URL` at build time, production (`https://truemain.lol`) when
unset. The release workflow builds `truemain-<version>.*` (named *TrueMain
Beta*, its own bundle identifier, so both install side by side) against preprod
for every app change merged to develop, and `truemain.*` against production for
every version bump — and each site's download page serves its own (`docs/ci.md`,
"Desktop releases"). The preprod
address is never in the repository: CI reads it from the
`DESKTOP_BETA_SITE_URL` secret, and a developer puts it in `desktop/.env.local`
(gitignored):

```sh
# desktop/.env.local — read by `npm run tauri` (the shell) and by nuxt.config.ts (`npm run dev`)
TRUEMAIN_SITE_URL=http://<preprod host>:3001
```

With that file, `npm run tauri dev`, `npm run tauri:sim` and a local
`npm run tauri build` all talk to preprod; without it, to production.

Those calls go through **Rust**, not the webview's `fetch`. From the webview
they would be subject to CORS against an origin the site was never configured
for, and would force the content-security policy open to a remote host. From
Rust neither applies and the CSP stays closed. The draft and build calls have a
command each; the pages' reads go through `api_get`, which forwards a short
allow-list of read-only paths (tier list, truemains leaderboard and search, and
one true main's build on a champion — `/truemains/{nameTag}/champions/{id}`,
checked segment by segment) and nothing else.

Static game data is the exception: the webview fetches Data Dragon and Community
Dragon itself (the CSP lets those two hosts through), the same files the site's
static endpoints read. A true main's page opens on the build's site in the player's
browser, through the shell's `open_on_site` command: the webview names a path,
the shell adds its own origin, so the webview cannot open any other host.

### Usage counts

The shell also reports how the app is used (#1805, `src-tauri/src/telemetry.rs`):
launches, minutes open, page views and a few features (a champion select or a
game followed, a game with the overlay drawn, a game recorded, a site page
opened), with the app's version and OS, under a random install id kept in
`telemetry.json` in the app's config folder. Nothing read from the League client
is part of it. It goes to the build's site, `POST <site>/api/desktop/telemetry`,
a minute after launch, every five minutes and at exit, and lands on the admin
portal's Desktop app page. A page counts only when its route has a key in
`app/utils/telemetry.ts` **and** in the API's `DesktopTelemetryCatalog.cs` —
add a page to both.

"Share Anonymous Usage Data" in the app menu (macOS) or the tray menu (Windows)
turns it off. A debug build (`npm run tauri dev`) counts but never sends, so a
developer's sessions stay out of production's numbers; set
`TRUEMAIN_TELEMETRY_DEV=1` to send from one, against the site it points at.

## Reading the game

While a game runs, the **game process** — not the League client — serves the
**Live Client Data API** on `https://127.0.0.1:2999/liveclientdata/`. Riot
documents it for third-party use; it needs no credentials and reads no memory.
The game page reads one endpoint, `allgamedata`: every player's champion, side,
lane, level, items, K/D/A, summoner spells, `isDead` and `respawnTimer`, the
active player's own numbers (gold, stats, runes, abilities), the event feed and
the game clock. The request goes through `lcu::LiveClient` (`crates/lcu/src/live.rs`,
the one client for this API, shared with the game recording); `crates/live-client`
derives the page's state from it:

- **When.** The shell polls only while the gameflow phase is `InProgress` — the
  same rule (`AppState::screen`) that opens the game page — and stops the
  moment the phase leaves it. A crashed game the client offers to rejoin
  (`Reconnect`) is not read.
- **How often.** Every **2 s** while the game answers. Nothing the page shows
  moves faster than a purchase, a level or a death, and the respawn timer is
  counted down on screen between readings. While it does not answer the wait
  doubles up to **5 s**, which bounds how long after loading the board appears.
- **TLS.** Riot's documentation gives one root certificate (`riotgames.pem`)
  for both the client and the game, so the game goes through the same pinned
  verifier (`lcu::tls`), not a trust-everything one.
- **What reaches the frontend.** Not the payload: a **snapshot** when a game is
  first read, then only **updates** — a player's items, a level, a K/D/A, a
  death with its respawn time, a respawn — each numbered so the frontend can
  tell a missed one and re-read the whole state (`live_client::GameFeed`,
  `useLiveGame.ts`). Creep score, gold and stats change on nearly every reading
  and are left out until a panel needs them at a pace it can justify.

### What the API is known to show about enemies

The gold standing (#1752) and the next item's enemy axes (#1750) are only
legitimate on what the player can see in game, so this has to be settled before
they read enemies. **Nothing below has been checked against a live game yet** —
the reader was written and tested against Riot's documented schema and a
synthetic tape.

| | Status |
| --- | --- |
| `allgamedata` and `playerlist` list all ten players, enemies included, with their items, level, K/D/A, spells, `isDead` and `respawnTimer` | Documented by Riot (field list and sample) |
| Riot's documentation says nothing about vision, spectating or the loading screen | Read in the documentation |
| An enemy's items update while they are out of vision (live), or only when seen (last-seen) | **To verify in a live game** |
| An enemy's `isDead` / `respawnTimer` is exposed while they die out of vision | **To verify** — the in-game scoreboard shows enemy death timers, so the API showing them would add nothing the player cannot see |
| The loading screen: the port refuses connections, answers an error status, or answers a payload with no players | **To verify** — the reader treats all three as "no game yet" and retries |
| Spectator mode: `activePlayer` is an error object rather than a player | Expected from community reports; parsed either way, with no side marked as ours |

How to verify: record a real game (`TRUEMAIN_LCU_RECORD`, below — the tape
keeps every `allgamedata` reading raw) and compare, for an enemy laner, the
reading where an item appears in their inventory with the moment they were last
in vision; note in the same game what the first readings after the loading
screen hold. Update this table with what the tape shows.

## Layout

```
desktop/
  crates/lcu/             pure Rust client for the League client API — no Tauri, no GUI
  crates/live-client/     the running game's own API, and the in-game state derived from it
  crates/shell-state/     the app's state and the screen it calls for, and the overlay's
                          settings and rules (when it shows, where)
  src-tauri/              the Tauri v2 shell: owns the connections, derives the state;
                          src/overlay/ is the overlay's windows (macOS, Windows)
  app/                    Nuxt 4 SPA (ssr: false) rendering that state
```

The crates deliberately carry no Tauri dependency, so they build and test on
any platform — including Linux CI, where the shell itself cannot build. Run
their tests with `cargo test -p lcu -p live-client -p shell-state` from
`desktop/`.

The **navigation rule lives in Rust** (`crates/shell-state/src/lib.rs`), not in the
frontend: which screen belongs to which phase is a product decision, and two
implementations of it would drift.

The main window runs with `dragDropEnabled: false`. Left on, Tauri takes every
drop at the native level to report dropped files, and the page's own HTML5
drag and drop — dragging an enemy onto another lane in champion select — never
receives its `drop`. The app reads no dropped file, so nothing is lost.

## Testing without a game

Champion select is the app's subject and the hardest state to reach: it needs a
real game, it lasts a couple of minutes, and it cannot be paused to look at a
panel. The game after it is the same problem at thirty minutes. Two ways in,
covering different depths.

### A tape — the whole Rust path, no client

A tape is one recorded champion select, replayed as often as needed. It holds
the client's own payloads, so a replay goes through the same parsing, the same
state derivation and the same navigation rule as a live session.

```sh
# Record the next session you play. Nothing to do while it runs.
TRUEMAIN_LCU_RECORD=recordings/my-draft.jsonl ./TrueMain.app/Contents/MacOS/truemain-desktop

# Play one back, at the pace it happened.
TRUEMAIN_LCU_REPLAY=fixtures/ranked-draft.jsonl ./TrueMain.app/Contents/MacOS/truemain-desktop

# `0` skips every wait, which opens the tape on its final state.
TRUEMAIN_LCU_REPLAY_SPEED=0 TRUEMAIN_LCU_REPLAY=fixtures/ranked-draft.jsonl ...
```

While replaying, the app never looks for a client: the tape stands in for it,
and the last state stays on screen when the tape ends.

`fixtures/ranked-draft.jsonl` is committed and **synthetic** — a full ranked
draft written by hand, from bans to the pick that ends it. A tape you record is
not: it carries your Riot ID and the champions of everyone in your lobby, so
`recordings/` is gitignored. Only the endpoints the app acts on are ever
recorded; the client's socket also carries your friends list, your chat and your
notifications, and none of that is written.

Tapes are JSON Lines and meant to be edited: change a champion, delete a pick,
retime an event. `lcu::tape` describes the format.

A recording made during a game also holds every `allgamedata` reading of it,
raw (`"kind": "game"` lines), and a replay hands them to the same game feed the
live poll does, at the pace they were read. `fixtures/ranked-game.jsonl` is a
committed, **synthetic** game — the draft fixture's ten champions, sixteen
readings from 0:15 to 27:32 three seconds apart, with purchases, level-ups,
kills, deaths and respawns along the way, in Riot's documented payload shape.
It opens in game and stays there, so the page is what is left on screen:

```sh
TRUEMAIN_LCU_REPLAY=fixtures/ranked-game.jsonl ./TrueMain.app/Contents/MacOS/truemain-desktop
```

A recorded game is large (a reading every two seconds, ten players each) and
names all ten players, which is one more reason `recordings/` stays out of git.

Point a replay at a backend you are editing with `TRUEMAIN_API_BASE`, which is
read at startup and overrides the build's site (a local API has no `/api`
prefix); `TRUEMAIN_SITE_URL`, read at startup too, repoints a built app at
another site as a whole:

```sh
TRUEMAIN_API_BASE=http://localhost:5008 TRUEMAIN_LCU_REPLAY=fixtures/ranked-draft.jsonl ...
```

### Dev scenarios — the UI alone, in a browser

```sh
cd desktop/app && npm run dev        # then pick a scenario at the bottom
```

`npm run dev` outside Tauri has no client and no Rust, so it opens on a picker
of states the client would have pushed — `?scenario=draft-locked#/draft` links
to one directly (the route is in the hash). This is for working on the UI with
hot reload; it proves nothing below the frontend. `app/app/fixtures/scenarios.json`
holds the states. Everything else is real data: the dev server proxies `/api`
to the site's `/api` — preprod with `desktop/.env.local`, production without
(`nuxt.config.ts`, dev only) — since there is no Rust to ask. In a production build the picker never renders — `import.meta.dev`
is false — but Nuxt still bundles it, and the fixtures sit in a small lazy chunk
that is never fetched.

The overlay's page opens the same way, alone, as the panel shows it:
`?scenario=in-game-late#/overlay/next-item` (reload after changing only the hash — the
page stands outside the app's shell from its first load), and `&preview` adds
the placing state. Its window — level, focus, click-through, the frontmost
rule, dragging — exists only in the shell; `tools/overlay-probe.swift` reads
what the window server does with it during a real game
(`docs/desktop-overlay-spike.md`).

### Simulating a champion select (development)

A champion select needs a real game. In development one can be played by hand
instead, and the app takes it for a real one — navigation, parsing and all:

Without compiling anything, from the repository root:

```sh
./sim-lcu.sh
```

starts the desktop dev server when none is running and opens two browser tabs:
the simulator (below) and the app's draft screen, which follows it over a
broadcast channel (`SIM_CHANNEL`, the board read as `DraftState` by
`useLcuSimulator`). The app's own writes to the client — Hover, Ban, Lock in —
need the shell; for those, and to exercise the Rust side:

```sh
cd desktop/app && npm run tauri:sim
```

then open **http://localhost:3003/#/dev/draft-sim** in a browser beside the
app. That page is the League client in champion select: choose the position you
play, then click any pick or ban, on either side and in any order, to put a
champion there — the picker lists the lane's champions first. Your own pick is
hovered until **Lock in**; the others lock at once. The first click starts the
champion select (a synthetic `Simulated#DEV` player, with a mastery list of each
lane's most played champions for "My pool"); **Game starts** and **Dodge** end it
the way the client does, **Clear** empties the board. The app answers every
click live — suggestions, lanes, builds.

**Our turn** (*Not ours* / *Our ban* / *Our pick*) opens our ban or our pick
as the client would, so the app's own **Hover**, **Ban** and **Lock in**
controls (#1909) can be tried: the shell sends each request it would make to
the client — the session, the pickable and bannable lists, the hover, the
completion — through the same relay the other way (`op: 'request'`), the page
answers it and applies it to the board, and refuses a write to an action that
is not open. The page has to stay open for the app's writes to be answered.

The page sends what the client would — gameflow phase, summoner, mastery, and
`/lol-champ-select/v1/session` in the client's shape — as tape readings to a
relay on the dev server (`server/routes/__sim/lcu.ts`), and the shell, started
with `TRUEMAIN_LCU_SIM`, polls it and applies each reading like a live event
(`src-tauri/src/sim.rs`). Both halves exist only in development: the page is
dropped from builds, the relay answers only under `npm run dev`, and the shell's
reader is not compiled into a release build. Like a tape, it stays above the
transport — no fake client, no TLS hole.

### Simulating a game (development)

The same relay plays a game: with `npm run tauri:sim` running, open
**http://localhost:3003/#/dev/game-sim**. **Start game** sends the phase and
the first reading of `fixtures/ranked-game.jsonl`, and the app opens its game
page; **Play** sends the next reading at the chosen pace, **Next reading** one
at a time, and any reading can be clicked to send it — an earlier one goes back
in time, items sold and levels lost. **End game** moves the phase on, which
clears the board and takes the app home. The shell hands each reading to the
game feed exactly as the live poll would.

In a plain browser, the **In game** dev scenarios show the page on the state the
feed holds at a given reading of that tape; a test in `crates/live-client`
(`tests/scenarios.rs`) keeps them equal to it.

## Building

Prerequisites: [Rust](https://rustup.rs), Node 22+, and Xcode command line tools
on macOS.

```sh
cd desktop/app && npm install
npm run tauri build        # bundles into desktop/target/release/bundle
```

For development, with hot reload and the app pointed at the Nuxt dev server:

```sh
cd desktop/app && npm run tauri dev
```

`npm run dev` alone opens the frontend in a plain browser with no client
attached — useful for working on the UI without League installed.

### Signing

Unsigned builds are quarantined by Gatekeeper and read as "damaged". Until
signing lands (#1679), a locally built `.app` runs after:

```sh
xattr -dr com.apple.quarantine /path/to/TrueMain.app
```

`minimumSystemVersion` is **13.3**, which is the floor the design system's
`oklch` and `color-mix()` usage imposes on WKWebView (Safari 16.4).

## Policy boundaries

Read-only against the client's local API. No memory reading, no injection, no
action taken on the player's behalf — no auto-accept, no instalock. Riot states
that apps on the LCU and in-game APIs are expected to keep working under
Vanguard; memory reading is what it blocks. Writing a rune page on an explicit
click is #1678, and is gated on the DevRel confirmation in #1680.

## Credits

- Menu icons: [Phosphor Icons](https://phosphoricons.com) (`@iconify-json/ph`), MIT.
- Interface icons: [Lucide](https://lucide.dev), ISC.
- Champion subclasses (Classes page): a snapshot of the [League of Legends Wiki](https://wiki.leagueoflegends.com/en-us/Module:ChampionData/data) champion data, CC BY-SA 3.0.
- Champion, item and rune names and art: Riot Games' Data Dragon and Community Dragon. TrueMain isn't endorsed by Riot Games.
