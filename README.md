# TrueMain App

> **Este projeto é um fork de [ilyanfraimbault/TrueMain](https://github.com/ilyanfraimbault/TrueMain)**, criado por Ilyan Fraimbault.
> O código-base, a ideia original (estatísticas feitas a partir de *true mains*) e a licença vêm de lá. Este fork é mantido por [baku01](https://github.com/baku01) e se concentra no **aplicativo desktop**: interface, idioma, identidade visual e algumas funções novas. Veja [o que este fork muda](#o-que-este-fork-muda) e a seção de [licença e créditos](#licença-e-créditos).

Um **companheiro para League of Legends**, em português do Brasil: lê o cliente do jogo no seu computador, acompanha a seleção de campeões e a partida, e mostra builds, runas, ordem de habilidades, confrontos e notas de atualização, tudo num app leve (Tauri + Nuxt), com tema escuro e claro.

![Painel do app com o perfil de um jogador, as estatísticas e o histórico](docs/screenshots/dashboard.png)

## Capturas de tela

As imagens abaixo foram feitas no navegador, no modo de desenvolvimento, com dados reais das fontes (Blitz, lolalytics, op.gg e Data Dragon). As telas de seleção de campeões e partida usam *cenários de simulação* do próprio projeto, com contas e partidas fictícias, porque o League não estava aberto.

| | |
|---|---|
| ![Painel de um jogador](docs/screenshots/dashboard.png)<br>**Painel:** o perfil de qualquer jogador — o seu (lido do cliente) ou o de quem você buscar ou clicar numa partida | ![Estatísticas detalhadas](docs/screenshots/stats.png)<br>**Estatísticas detalhadas:** por elo (régua com a mediana de cada elo) e contra os oponentes de rota; ranking e temporadas do op.gg |
| ![Página de um campeão](docs/screenshots/champion.png)<br>**Campeão:** todas as opções medidas pela fonte escolhida, com taxa de vitória — runas, feitiços, iniciais, botas, núcleos e melhores jogadores | ![Analytics](docs/screenshots/analytics.png)<br>**Analytics:** tudo o que a fonte mede sobre um campeão, por rota e elo |
| ![Confronto](docs/screenshots/matchup.png)<br>**Confronto:** a build para o draft e as partidas reais do confronto | ![Busca](docs/screenshots/search.png)<br>**Busca (⌘K):** campeões e jogadores (`Nome#TAG`), com a região e o elo |
| ![Fontes de dados](docs/screenshots/sources.png)<br>**Configurações:** a fonte de dados — TrueMain, Blitz, op.gg, lolalytics ou Tencent | ![ProBuild](docs/screenshots/probuild.png)<br>**ProBuild:** as partidas recentes de pros, vitória ou derrota em destaque |
| ![Tier list](docs/screenshots/tierlist.png)<br>**Tier list:** os campeões por tier, em medalhas | ![Classes](docs/screenshots/classes.png)<br>**Classes:** campeões por classe e subclasse, com o papel de cada uma |
| ![Itens](docs/screenshots/items.png)<br>**Itens:** descrição e receita em árvore | ![Runas](docs/screenshots/runes.png)<br>**Runas:** as árvores e a descrição colorida |
| ![Seleção de campeões](docs/screenshots/draft.png)<br>**Seleção de campeões:** picks e a build contra o draft | ![Partida](docs/screenshots/ingame.png)<br>**Partida:** placar, próximo item e o que cada jogador vem fazendo |
| ![Notas da atualização](docs/screenshots/patchnotes.png)<br>**Notas da atualização:** patch a patch, atualizadas sozinhas | ![Overlay de próximo item](docs/screenshots/overlay-next-item.png)<br>**Overlay:** o próximo item sobre o jogo, com a receita e a ordem da build |

**Tema claro:** o app tem tema escuro (o padrão) e claro, alternados pelo botão da barra superior.

![Página de um campeão no tema claro](docs/screenshots/light.png)

## O que o app faz

- **Acompanha o cliente do League** no macOS e no Windows e abre a tela certa em cada fase: a seleção de campeões abre o draft, e a partida abre a página do jogo.
- **Painel de jogador:** o seu perfil (lido do cliente) ou o de **qualquer jogador** — buscado por `Nome#TAG` na busca do topo (⌘K) ou clicado numa partida. Mostra elo, histórico com o detalhe de cada partida, campeões, funções, atividade, e:
  - **estatísticas detalhadas** das últimas 20 partidas (≈25 métricas: dano, parcela do dano do time, CS aos 10, visão, objetivos, abates solo, skillshots…), cada uma **comparada aos oponentes de rota** nas mesmas partidas, com barras e veredito por grupo;
  - **comparação por elo:** KDA, participação, CS/min, visão/min e mortes numa régua com a mediana de cada elo (Ferro a Desafiante), com qualquer elo escolhido como referência;
  - **ranking e temporadas** (op.gg): posição na ladder, pico da temporada e elos das temporadas anteriores.
- **Campeões, tier list e Analytics:** builds com todas as opções medidas (runas, feitiços, iniciais, botas, núcleos e 4º/5º item com taxa de vitória), melhores jogadores e builds de pros, e uma página de **Analytics** com tudo o que a fonte mede sobre o campeão.
- **Confronto:** a build para o draft e as partidas reais do confronto.
- **Seleção de campeões:** picks, bans e a build para o draft, com **itens sugeridos pela composição inimiga** (ex.: Mercúrio contra muito controle de grupo). Runas e conjuntos de itens só vão para o cliente **quando você clica**.
- **Partida e overlay:** placar das duas equipes, próximo item com a receita e a ordem da build, timers de objetivos e painéis sobre o jogo.
- **Português do Brasil** em todo o app, inclusive nos nomes de itens, campeões e runas.

## Fontes de dados (Configurações)

Em **Configurações → Fonte de dados**, todas as telas de estatísticas passam a vir da fonte escolhida (a troca recarrega a janela):

| Fonte | O que traz |
|---|---|
| **TrueMain** | As estatísticas do projeto original, a partir dos *true mains* |
| **Blitz** | Builds, tier list, matchups, builds contra um oponente e as partidas recentes de pros |
| **op.gg** | A API oficial (servidor MCP) do op.gg: builds, runas, counters, ranking por campeão |
| **lolalytics** *(experimental)* | A mais detalhada: cada runa, item por slot, matchups, objetivos, duração de partida |
| **Tencent** *(experimental)* | Os guias do lol.qq.com (servidores chineses, atualizados diariamente): páginas de runa completas, núcleos, ordem de habilidades e matchups |

As fontes marcadas como experimentais usam endpoints públicos que os sites não documentam e podem mudar sem aviso. Nenhuma fonte é lida contornando proteções: sites que exigem burlar anti-bot ficaram de fora.

## O que este fork muda

Em relação ao [projeto original](https://github.com/ilyanfraimbault/TrueMain):

- **Idioma:** o app desktop inteiro fala **português do Brasil** (e inglês), escolhido na barra superior. Os textos de itens, campeões, runas e feitiços acompanham o idioma. O site continua em inglês.
- **Identidade visual:** azul-marinho com um azul de destaque, **tema escuro e claro**, ícones em traço fino (Phosphor) e medalhas para os tiers.
- **Navegação:** menu lateral agrupado (Campeões, Builds, Em partida), recolhível, só com ícones em janelas estreitas; busca única de campeão e jogador (⌘K).
- **Abas novas:** **Analytics**, **Itens e runas**, **Classes**, **Notas da atualização** e **ProBuild** (por fonte).
- **Várias fontes de dados** (acima) e o **painel para qualquer jogador**, lido do Blitz e do op.gg — sem chave da API da Riot.
- **Cara de app nativo:** barra de título no tema do app (no macOS, integrada à barra superior), uma única instância, ⌘, abre Configurações, fechar a janela no macOS só a esconde, e na versão final sem menu de clique direito nem atalhos de navegador.
- **Desempenho:** o app só processa os eventos do cliente que usa, o overlay fica parado fora da partida, a busca pelo cliente desacelera quando ele está fechado, e os caches têm limite.
- **Removido:** a chave da API da Riot, o ranking de Truemains, as gravações de partidas (e o helper de captura), a aba Jogador e a aba Matchups.
- **Infraestrutura:** os workflows do projeto original (deploy, SonarQube, etc.) foram removidos. Resta só o **build do app para macOS e Windows** (`.github/workflows/desktop-build.yml`).

## Baixar

Os instaladores mais recentes, gerados pelo GitHub Actions a partir da branch `main`:

| Sistema | Download |
|---|---|
| **macOS** (Apple Silicon e Intel) | [TrueMain-macOS.dmg](https://github.com/baku01/TrueMain-app/releases/latest/download/TrueMain-macOS.dmg) |
| **Windows** (64 bits) | [TrueMain-Windows-setup.exe](https://github.com/baku01/TrueMain-app/releases/latest/download/TrueMain-Windows-setup.exe) |

Todas as versões: [Releases](https://github.com/baku01/TrueMain-app/releases). Os instaladores **não são assinados**: no **macOS**, depois de copiar o app para Aplicativos, rode `xattr -cr /Applications/TrueMain.app`; no **Windows**, o SmartScreen avisa de "editor desconhecido" (clique em *Mais informações* e *Executar assim mesmo*).

## Como rodar

Requisitos: Node 24 e npm, Rust (estável) e, para o app nativo, o toolchain do Tauri. Para o macOS, o Xcode Command Line Tools.

```bash
cd desktop/app
npm ci

# Só a interface, no navegador (sem cliente do League; usa cenários de simulação):
npm run dev            # http://localhost:3003

# O app de verdade, com o cliente do League aberto:
npm run tauri dev

# Testes e verificações:
npm run test
npm run lint
npm run typecheck
cd .. && cargo test --workspace
```

O app lê as estatísticas de campeões da **API do TrueMain** (`https://truemain.lol`, o servidor do projeto original). Para apontar para outro servidor, defina `TRUEMAIN_SITE_URL` (veja [`desktop/README.md`](desktop/README.md)).

Para gerar o instalador: `npm run tauri build` dentro de `desktop/app`. O GitHub Actions gera os instaladores (`.github/workflows/desktop-build.yml`) a cada push que mexa no app.

## De onde vêm os dados

| Fonte | Para quê |
|---|---|
| API do TrueMain (`truemain.lol`) | Estatísticas na fonte TrueMain, recomendações de draft e de próximo item, referências por elo |
| Blitz (`iesdev.com`) | Perfis e partidas de qualquer jogador, builds e pros; na fonte Blitz, as estatísticas |
| op.gg (API oficial) | Ranking e temporadas dos jogadores; na fonte op.gg, as estatísticas |
| lolalytics e Tencent | As estatísticas nessas fontes (experimental) |
| [Data Dragon](https://developer.riotgames.com/docs/lol) e [Community Dragon](https://www.communitydragon.org/) | Nomes, textos e imagens de itens, campeões, feitiços e runas, no idioma escolhido |
| Cliente do League (local) | Seleção de campeões, perfil, histórico e a partida ao vivo |
| [Wiki do League](https://wiki.leagueoflegends.com/) | Subclasses dos campeões (um retrato guardado no app) |
| leagueoflegends.com | Notas da atualização |

> **Dependências:** as estatísticas vêm de servidores que não são deste fork. Com a fonte TrueMain, se `truemain.lol` sair do ar as telas de campeões e tier list ficam vazias — basta escolher outra fonte em Configurações. Itens, runas, classes, notas da atualização e a partida ao vivo não dependem de nenhuma.

## Sobre o projeto original

O TrueMain original é um site de análise de League of Legends, e este repositório ainda traz o código dele: um backend em .NET (`backend/`: `Api`, `Ingestor`, `Core`, `Data`), o site em Nuxt (`web/`) e o portal administrativo (`admin/`). A ideia central é identificar os *true mains* de cada campeão (jogadores com uma relação sustentada entre partidas jogadas e maestria) e calcular as estatísticas só a partir das partidas deles. A descrição completa da arquitetura está no [repositório original](https://github.com/ilyanfraimbault/TrueMain).

```
backend/   solução .NET: Api, Ingestor, Core, Data e testes
web/       site público (Nuxt); web/layers/common é a camada que o site e o app desktop compartilham
admin/     portal administrativo (Nuxt)
desktop/   o app desktop (Tauri: src-tauri em Rust, app em Nuxt)
docs/      documentação, RFCs e as capturas de tela deste README
```

Este fork **não faz deploy** do backend, do site nem do portal: os arquivos de `compose*.yaml` e `docs/` de infraestrutura são herdados do original e estão aí só como referência.

## Licença e créditos

- **Licença:** [PolyForm Noncommercial 1.0.0](LICENSE), a mesma do projeto original. Pode ler, rodar, modificar e compartilhar o código para fins **não comerciais**; uso comercial exige outra licença do detentor dos direitos. O aviso do arquivo `LICENSE` (*Required Notice: Copyright 2026 Ilyan Fraimbault*) deve ser mantido em qualquer cópia.
- **Projeto original e autoria:** [ilyanfraimbault/TrueMain](https://github.com/ilyanfraimbault/TrueMain), de Ilyan Fraimbault. Este repositório é um fork e não tem relação oficial com o projeto de origem.
- **Ícones:** [Phosphor](https://phosphoricons.com) (MIT) e [Lucide](https://lucide.dev) (ISC).
- **Dados do jogo e arte:** Riot Games. O TrueMain **não é endossado pela Riot Games** e não reflete as opiniões da Riot Games nem de quem esteja envolvido na produção ou no gerenciamento das propriedades da Riot Games. League of Legends e Riot Games são marcas ou marcas registradas da Riot Games, Inc.
