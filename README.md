# TrueMain App

> **Este projeto é um fork de [ilyanfraimbault/TrueMain](https://github.com/ilyanfraimbault/TrueMain)**, criado por Ilyan Fraimbault.
> O código-base, a ideia original (estatísticas feitas a partir de *true mains*) e a licença vêm de lá. Este fork é mantido por [baku01](https://github.com/baku01) e se concentra no **aplicativo desktop**: interface, idioma, identidade visual e algumas funções novas. Veja [o que este fork muda](#o-que-este-fork-muda) e a seção de [licença e créditos](#licença-e-créditos).

Um **companheiro para League of Legends**, em português do Brasil: lê o cliente do jogo no seu computador, acompanha a seleção de campeões e a partida, e mostra builds, runas, ordem de habilidades, confrontos e notas de atualização, tudo num app leve (Tauri + Nuxt), com tema escuro e claro.

![Painel do app com o perfil de um jogador, as estatísticas e o histórico](docs/screenshots/dashboard.png)

## Capturas de tela

As imagens abaixo foram feitas no navegador, no modo de desenvolvimento, com dados reais das fontes (Blitz, lolalytics, op.gg e Data Dragon). As telas de seleção de campeões, lobby do Swiftplay, pós-partida e partida usam *cenários de simulação* do próprio projeto, com contas e partidas fictícias, porque o League não estava aberto.

| | |
|---|---|
| ![Painel de um jogador](docs/screenshots/dashboard.png)<br>**Painel:** o perfil de qualquer jogador — o seu (lido do cliente) ou o de quem você buscar ou clicar numa partida —, em abas como no Blitz: Visão geral, Pool de campeões e Histórico de LP | ![Estatísticas detalhadas](docs/screenshots/stats.png)<br>**Estatísticas detalhadas:** por elo (régua com a mediana de cada elo) e contra os oponentes de rota; ranking e temporadas do op.gg |
| ![Histórico de LP](docs/screenshots/profile-lp.png)<br>**Histórico de LP:** Solo/Duo e Flex de qualquer jogador, a temporada inteira, com o início da temporada, o pico, o mínimo e o saldo | ![Pool de campeões da temporada](docs/screenshots/profile-pool.png)<br>**Pool de campeões:** a temporada rota por rota — partidas, campanha, taxa de vitória, KDA e LP de cada campeão |
| ![Pós-partida](docs/screenshots/postmatch.png)<br>**Pós-partida:** quando a partida acaba, ela abre sozinha com "Como foi" — CS e visão por minuto contra o seu elo, as mortes e quando aconteceram — e o painel da partida aberto | ![Página de um campeão](docs/screenshots/champion.png)<br>**Campeão:** a divisão de dano, as opções medidas pela fonte e as builds por estilo (Bruiser, Lethality…), as de one-tricks e a sua anterior |
| ![Counters de um campeão](docs/screenshots/counters.png)<br>**Counters:** contra quem o campeão é forte e fraco, pelo **pp** (o quanto o confronto foge do esperado), com a opção "só a fase de rotas" | ![Sinergias de um campeão](docs/screenshots/synergies.png)<br>**Sinergias:** os melhores aliados por rota, com tier, taxa de vitória e o ganho sobre o normal |
| ![Rotas da selva](docs/screenshots/jungle.png)<br>**Rotas da selva** (op.gg): a limpeza completa mais jogada desenhada no mapa, por lado, e o acampamento inicial | ![Analytics com as rotas da selva](docs/screenshots/analytics-jungle.png)<br>**Analytics:** tudo o que a fonte mede sobre um campeão, por rota e elo — com as rotas da selva para quem joga na selva |
| ![Estatísticas · Duplas](docs/screenshots/champion-stats.png)<br>**Estatísticas · Duplas:** as duplas que mais vencem juntas em duas rotas (atirador + suporte por padrão) | ![Estatísticas · Maestria](docs/screenshots/mastery.png)<br>**Estatísticas · Maestria:** a taxa de vitória por nível de maestria (5+ a 100+) e o quanto cada campeão melhora com experiência |
| ![Lista de campeões](docs/screenshots/champions-list.png)<br>**Campeões:** a lista com runas, build principal e a coluna **Δ WR** — a variação da taxa de vitória desde o patch anterior | ![One-tricks no ProBuild](docs/screenshots/probuild-onetricks.png)<br>**ProBuild · One-tricks:** os jogadores que jogam o campeão em quase toda partida — elo, nota OTP, fatia do campeão e taxa de vitória |
| ![Confronto](docs/screenshots/matchup.png)<br>**Confronto:** a build para o draft e as partidas reais do confronto | ![Busca](docs/screenshots/search.png)<br>**Busca (⌘K):** campeões e jogadores (`Nome#TAG`), com a região e o elo |
| ![Seleção de campeões](docs/screenshots/draft.png)<br>**Seleção de campeões:** os times nas laterais com counters, seus favoritos e a tier list da rota, e as sugestões em pôsteres com os **pesos das sugestões** (os presets do Blitz) | ![Card do jogador na seleção](docs/screenshots/player-card.png)<br>**Card do jogador:** passe o mouse num aliado — elo, rota principal ou autofill, maestria no campeão, duo e mais jogados |
| ![Builds na seleção de campeões](docs/screenshots/draft-builds.png)<br>**Builds na seleção:** runas, feitiços, iniciais, ordem de itens e evolução num card só, com importação e as builds de pros | ![Jev na seleção de campeões](docs/screenshots/draft-jev.png)<br>**Jev:** escolha em qual família ele monta a build — a rota, o confronto, um estilo do Blitz ou os one-tricks |
| ![Swiftplay](docs/screenshots/lobby.png)<br>**Swiftplay:** no lobby, os dois campeões escolhidos, cada um com a sua build, importação de runas, feitiços e itens | ![Partida](docs/screenshots/ingame.png)<br>**Partida:** o dano de cada time, o próximo item, a ordem de habilidades e, por jogador, elo, duo, maestria e mais jogados |
| ![Fontes de dados](docs/screenshots/sources.png)<br>**Configurações:** a fonte de dados — TrueMain, Blitz, op.gg, lolalytics ou Tencent | ![Tier list](docs/screenshots/tierlist.png)<br>**Tier list:** os campeões por tier, em medalhas |
| ![Classes](docs/screenshots/classes.png)<br>**Classes:** campeões por classe e subclasse, com o papel de cada uma | ![Itens](docs/screenshots/items.png)<br>**Itens:** descrição e receita em árvore |
| ![Runas](docs/screenshots/runes.png)<br>**Runas:** as árvores e a descrição colorida | ![Notas da atualização](docs/screenshots/patchnotes.png)<br>**Notas da atualização:** patch a patch, atualizadas sozinhas |
| ![Overlay de próximo item](docs/screenshots/overlay-next-item.png)<br>**Overlay:** o próximo item sobre o jogo, com a receita e a ordem da build |  |

**Tema claro:** o app tem tema escuro (o padrão) e claro, alternados pelo botão da barra superior. No claro, os painéis são brancos sobre um fundo cinza-azulado, com texto e destaque escurecidos para manter o contraste; os banners sobre arte de campeão continuam escuros.

![Counters de um campeão no tema claro](docs/screenshots/light.png)

## O que o app faz

- **Acompanha o cliente do League** no macOS e no Windows e abre a tela certa em cada fase: a seleção de campeões abre o draft, e a partida abre a página do jogo.
- **Painel de jogador:** o seu perfil (lido do cliente) ou o de **qualquer jogador** — buscado por `Nome#TAG` na busca do topo (⌘K) ou clicado numa partida. Mostra elo, campeões, funções, atividade, **maestria** (o top 5 com o nível, o emblema e os pontos exatos do championmastery.gg), e:
  - **histórico no estilo Blitz:** cada partida com seus **badges** (MVP, multiabates, mais dano, mestre do CS, imortal, primeiro abate, jogo perfeito…), e o mouse sobre um badge diz a medida e o corte que ele passou;
  - **painel da partida** com abas: os bans e os objetivos de cada time, ouro e dano, o elo de cada jogador, a tabela de **Estatísticas**, **Gráficos**, **Probabilidade de vitória**, a **Linha do tempo** de abates e objetivos e o dano das runas por jogador; o que faltar na fonte vem do cliente e depois do Blitz;
  - **análise do jogador:** estilo de jogo, pontos fortes, o que melhorar (com dicas), melhores campeões e melhores parceiros;
  - **estatísticas detalhadas** das últimas 20 partidas (≈25 métricas: dano, parcela do dano do time, CS aos 10, visão, objetivos, abates solo, skillshots…), cada uma **comparada aos oponentes de rota** nas mesmas partidas, com barras e veredito por grupo;
  - **comparação por elo:** KDA, participação, CS/min, visão/min e mortes numa régua com a mediana de cada elo (Ferro a Desafiante), com qualquer elo escolhido como referência;
  - **ranking e temporadas** (op.gg): posição na ladder, pico da temporada e elos das temporadas anteriores;
  - **abas como no Blitz:** **Histórico de LP** de Solo/Duo e Flex (a temporada inteira, com pico, mínimo e saldo), **Pool de campeões** da temporada rota por rota (campanha, taxa de vitória, KDA e LP de cada campeão) e o card **Jogou com** (quem esteve no seu time em duas partidas ou mais);
  - **pós-partida:** quando a partida acaba, o app abre nela — o resultado, o painel da partida aberto e "Como foi": CS e visão por minuto contra a mediana do seu elo e as mortes, com quando aconteceram.
- **Campeões, tier list e Analytics:** builds com todas as opções medidas (runas, feitiços, iniciais, botas, núcleos e 4º/5º item com taxa de vitória), a sequência de itens em árvore, a ordem de habilidades com o vídeo, a descrição e os valores de cada uma ao passar o mouse, melhores jogadores e builds de pros, e uma página de **Analytics** com tudo o que a fonte mede sobre o campeão. A página do campeão tem ainda:
  - **Counters:** contra quem ele é forte e fraco, ordenado pelo **pp** (o quanto o confronto foge do que as taxas dos dois campeões preveem), com a opção "só a fase de rotas";
  - **Sinergias:** os melhores aliados por rota, com tier e o ganho de vitória sobre o normal;
  - **Rotas da selva** (op.gg): a limpeza completa mais jogada no mapa, por lado, as mais jogadas e o acampamento inicial — também no Analytics e na seleção de campeões;
  - **builds por estilo** (Bruiser, Lethality, AD… no Blitz), as dos **one-tricks** e a sua **build anterior** no campeão e rota.
- **Estatísticas:** **Duplas** (as duplas que mais vencem em duas rotas) e **Maestria** (a taxa de vitória de 5+ a 100+ de maestria e o quanto cada campeão melhora com experiência). Na lista de campeões, a coluna **Δ WR** mostra a variação da taxa de vitória desde o patch anterior.
- **ProBuild · One-tricks:** os jogadores que jogam o campeão em quase toda partida, com elo, nota OTP, partidas, fatia do campeão e taxa de vitória; o nome abre o perfil no app.
- **Habilidades:** cada habilidade com o vídeo da Riot e a descrição do próprio jogo, com os valores resolvidos nível a nível.
- **Meus kits:** builds suas (árvore de itens, página de runas e feitiços) para um campeão e as rotas escolhidas, oferecidas na seleção de campeões ao lado das do TrueMain; escolhido um kit, o overlay segue os itens dele.
- **Confronto:** a build para o draft e as partidas reais do confronto, com o **medidor de dano** de cada time (físico, mágico e verdadeiro, medido pelo Blitz) e um aviso quando um time é de um tipo só.
- **Confronto · Jev:** a build inteira (runas, feitiços, inicial, ordem de habilidades, botas e quando comprá-las, núcleo item a item e itens tardios) escolhida pelo [Jev](https://typesafe.ai) entre as opções medidas, ao lado da mais jogada. O Jev só lê textos — os kits inimigos e cada item, runa e feitiço, em inglês — e responde perguntas; o app faz as contas com as estatísticas do lolalytics e do Blitz somadas partida a partida. Cada opção mostra a taxa de escolha, a de vitória e as checagens que pesaram; itens situacionais respondem ao draft (penetração contra linha de frente, resistência mágica, antecura). Importa runas e item set para o cliente e segue a seleção de campeões sozinha. Na seleção de campeões, você escolhe a **família** em que o Jev monta a build — a rota toda, o confronto contra o oponente, um estilo do Blitz (Bruiser, Lethality…) ou os one-tricks — e o nome do conjunto importado acompanha (`Aatrox vs Akali · Jev Lethality`). Depois que ele responde, cada build da lista ganha uma nota de 0 a 100 do quanto responde ao draft, e a melhor fica marcada como a escolha do Jev, sem nova chamada. Precisa de uma chave do Jev em Configurações (guardada pelo app, nunca exposta à interface); cada pedido é pago, por isso o Jev só é chamado num clique.
- **Seleção de campeões:** tudo numa tela, sem rolar, como numa transmissão. Os dois times ficam nas laterais, com os counters de cada inimigo na própria rota, o medidor de dano, a tier list da rota e os counters do oponente. No centro, um card com as abas **Sugestões** (pôsteres de todas as sugestões, com a nota e o motivo) e **Builds** (runas, feitiços, iniciais, ordem de itens, botas, situacionais e ordem de evolução, as builds contra o oponente de rota e as de pros num menu). A build pesa a vitória de cada item pela amostra, responde a curas com antecura e segue o time inimigo para botas e itens (ex.: um atirador contra três magos leva Mercúrio e resistência mágica), mostrando o motivo sempre que foge da mais jogada. O seletor **Fonte | Jev** faz o Jev reordenar as sugestões (com o detalhamento da nota) e montar a build do draft. Os **pesos das sugestões** seguem os presets do Blitz (Equilibrado, One Trick, Segue o meta, Counter puro, Dono da rota, Jogador de equipe, Subir de elo) ou os seus, com uma maestria mínima; passar o mouse num aliado mostra o **card do jogador** (elo, rota principal ou autofill, maestria, duo e mais jogados); os seus **favoritos** ficam numa lista ao lado, com escolher e banir num clique. Por padrão, runas e conjuntos de itens só vão para o cliente **quando você clica**; com a **importação automática** ligada (Configurações), a build vai sozinha ao travar o campeão, como no Blitz. Só a página de runas e os conjuntos do próprio TrueMain são substituídos; com a lista de páginas cheia, o app libera a página menos usada (uma inválida primeiro), como o Blitz.
- **Swiftplay:** no lobby, os dois campeões escolhidos, cada um com a sua build; dá para trocar campeão e rota e importar runas (na página de cada campeão, como o Blitz faz), feitiços e itens.
- **Partida e overlay:** o dano de cada time, o próximo item com a receita e a ordem da build, a ordem de habilidades com o próximo ponto, e por jogador o elo, duo ou trio, maestria e mais jogados; timers de objetivos e painéis sobre o jogo.
- **Zoom:** ⌘/Ctrl + `+`, `−` e `0` ampliam o app como no navegador.
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

Builds e runas vêm **sempre da fonte escolhida**, sem misturar. O que a fonte escolhida não mede (counters com pp, sinergias, duplas, maestria, histórico de LP, pool da temporada, one-tricks, a referência do pós-partida) vem de outra que mede — o Blitz primeiro —, e um selo diz de onde vieram os números. O que ela não tiver vem do lolalytics e, depois, do Blitz, cada resposta inteira de uma fonte só; a única soma é a classificação do Confronto · Jev (lolalytics + Blitz). Os dados do TrueMain só são usados com o TrueMain escolhido.

As fontes marcadas como experimentais usam endpoints públicos que os sites não documentam e podem mudar sem aviso. Nenhuma fonte é lida contornando proteções: sites que exigem burlar anti-bot ficaram de fora.

Em **Configurações → Patch dos dados**, escolha de quais partidas as builds, a tier list, os confrontos e o Analytics são lidos: o **patch atual** (o padrão), o **anterior**, o **automático** (o atual quando já tem partidas suficientes) ou um **patch específico** entre os dez últimos. Blitz, op.gg e Tencent sempre respondem com o próprio patch mais recente; a escolha vale quando a fonte é o lolalytics.

## O que este fork muda

Em relação ao [projeto original](https://github.com/ilyanfraimbault/TrueMain):

- **Idioma:** o app desktop inteiro fala **português do Brasil** (e inglês), escolhido na barra superior. Os textos de itens, campeões, runas e feitiços acompanham o idioma. O site continua em inglês.
- **Identidade visual:** layout inspirado no Blitz nas cores do TrueMain — azul-marinho com um azul de destaque, **tema escuro e claro**, Sora nos títulos e Figtree no texto, ícones em traço fino (Tabler) e medalhas para os tiers.
- **Navegação:** menu lateral agrupado (Campeões, Builds, Em partida), recolhível, só com ícones em janelas estreitas; busca única de campeão e jogador (⌘K).
- **Abas novas:** **Analytics**, **Habilidades**, **Meus kits**, **Itens e runas**, **Classes**, **Notas da atualização** e **ProBuild** (por fonte).
- **Atualização automática:** o app se atualiza pelas releases deste fork, mostrando o progresso do download num aviso no canto.
- **Confronto · Jev:** build e runas classificadas com o [Jev](https://typesafe.ai) — ele lê os kits inimigos e cada item, o app junta isso às estatísticas do lolalytics e do Blitz — com importação de runas e item set para o cliente.
- **Medidor de dano dos times:** físico, mágico e verdadeiro de cada time, medido pelo Blitz, na seleção de campeões, no Confronto e no Confronto · Jev.
- **Do Blitz para o TrueMain:** counters com pp, sinergias, duplas, maestria, Δ WR por patch, rotas da selva (op.gg), histórico de LP e pool da temporada de qualquer jogador, pós-partida, pesos das sugestões, card do jogador, favoritos, one-tricks, builds por estilo e a anterior, e o Swiftplay.
- **Seleção de campeões nova:** tudo numa tela — times nas laterais com counters, sugestões em pôsteres, a build num card só (com a de pros a um clique) e um seletor **Fonte | Jev** para o Jev reordenar as sugestões e montar a build do draft.
- **Perfil e partidas no estilo Blitz:** badges com o motivo, painel da partida com abas e linha do tempo, maestria com os pontos exatos e análise do jogador.
- **Simulador sem compilar:** `./sim-lcu.sh` abre uma seleção de campeões simulada e o app no navegador, lado a lado.
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

# Uma seleção de campeões simulada e o app no navegador, sem compilar (na raiz):
../../sim-lcu.sh

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
| Blitz (`iesdev.com`) | Perfis e partidas de qualquer jogador, o elo de cada jogador da partida, builds, pros e a divisão de dano dos campeões; na fonte Blitz, as estatísticas |
| op.gg (API oficial) | Ranking e temporadas dos jogadores; na fonte op.gg, as estatísticas |
| lolalytics e Tencent | As estatísticas nessas fontes (experimental); o lolalytics também cobre o que faltar na fonte escolhida |
| [championmastery.gg](https://championmastery.gg) | Os pontos exatos de maestria no painel |
| [Jev](https://typesafe.ai) (TypeSafe, `api.typesafe.ai`) | As escolhas do Confronto · Jev e da seleção de campeões no modo Jev — só com a sua chave e só num clique |
| [Data Dragon](https://developer.riotgames.com/docs/lol) e [Community Dragon](https://www.communitydragon.org/) | Nomes, textos e imagens de itens, campeões, feitiços e runas, no idioma escolhido |
| Cliente do League (local) | Seleção de campeões, perfil, histórico, maestria e a partida ao vivo |
| [Wiki do League](https://wiki.leagueoflegends.com/) | Subclasses dos campeões (um retrato guardado no app) |
| leagueoflegends.com | Notas da atualização |
| CDNs da Riot e do Blitz | Vídeos das habilidades e suas miniaturas |

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
- **Ícones:** [Tabler](https://tabler.io/icons) (MIT), [Phosphor](https://phosphoricons.com) (MIT) e [Lucide](https://lucide.dev) (ISC).
- **Fontes:** [Sora](https://fonts.google.com/specimen/Sora) e [Figtree](https://fonts.google.com/specimen/Figtree) (SIL OFL), incluídas no app.
- **Dados do jogo e arte:** Riot Games. O TrueMain **não é endossado pela Riot Games** e não reflete as opiniões da Riot Games nem de quem esteja envolvido na produção ou no gerenciamento das propriedades da Riot Games. League of Legends e Riot Games são marcas ou marcas registradas da Riot Games, Inc.
