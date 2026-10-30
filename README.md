# TrueMain App

> **Este projeto é um fork de [ilyanfraimbault/TrueMain](https://github.com/ilyanfraimbault/TrueMain)**, criado por Ilyan Fraimbault.
> O código-base, a ideia original (estatísticas feitas a partir de *true mains*) e a licença vêm de lá. Este fork é mantido por [baku01](https://github.com/baku01) e se concentra no **aplicativo desktop**: interface, idioma, identidade visual e algumas funções novas. Veja [o que este fork muda](#o-que-este-fork-muda) e a seção de [licença e créditos](#licença-e-créditos).

Um **companheiro para League of Legends**, em português do Brasil: lê o cliente do jogo no seu computador, acompanha a seleção de campeões e a partida, e mostra builds, runas, ordem de habilidades, confrontos e notas de atualização, tudo num app leve (Tauri + Nuxt), com tema escuro e claro.

![Painel do app com o perfil, o histórico e a evolução de PDL](docs/screenshots/dashboard.png)

## Capturas de tela

As imagens abaixo foram feitas no navegador, no modo de desenvolvimento, com os dados que o app lê da API do TrueMain e do Data Dragon. Algumas telas (painel, seleção de campeões e partida) usam *cenários de simulação* do próprio projeto, com contas e partidas fictícias, porque o League não estava aberto.

| | |
|---|---|
| ![Página de um campeão com as runas, a árvore de itens e a ordem de habilidades](docs/screenshots/champion.png)<br>**Campeão:** runas, itens, feitiços e a sequência de itens em árvore, mais a ordem de habilidades nível a nível | ![Tier list em grupos de tier](docs/screenshots/tierlist.png)<br>**Tier list:** os campeões por tier, em medalhas S, A, B, C e D |
| ![Página de classes e subclasses](docs/screenshots/classes.png)<br>**Classes:** todos os campeões por classe e subclasse, com uma explicação do papel de cada uma | ![Lista de itens com a receita do item escolhido](docs/screenshots/items.png)<br>**Itens:** todos os itens, com descrição e receita em árvore |
| ![Runas por árvore e a descrição da escolhida](docs/screenshots/runes.png)<br>**Runas:** as cinco árvores, com a descrição colorida de cada runa | ![Notas da atualização 26.21](docs/screenshots/patchnotes.png)<br>**Notas da atualização:** as notas da Riot, patch a patch, atualizadas sozinhas |
| ![Seleção de campeões com recomendações](docs/screenshots/draft.png)<br>**Seleção de campeões:** picks recomendados e a build contra o draft | ![Página da partida em andamento](docs/screenshots/ingame.png)<br>**Partida:** o placar das duas equipes, o próximo item e o que cada jogador vem fazendo |

**Tema claro:** o app tem tema escuro (o padrão) e claro, alternados pelo botão da barra superior.

![Página de um campeão no tema claro](docs/screenshots/light.png)

## O que o app faz

- **Acompanha o cliente do League** no macOS e no Windows e abre a tela certa em cada fase: a seleção de campeões abre o draft, e a partida abre a página do jogo.
- **Seleção de campeões:** recomenda picks e bans, mostra o confronto da rota e a build para o draft atual, e escreve runas e conjuntos de itens no cliente **só quando você clica**.
- **Partida:** placar das duas equipes, próximo item recomendado, ordem de compra dos componentes, timers de objetivos e painéis de overlay sobre o jogo.
- **Gravações:** grava as partidas, mostra o resumo, os momentos importantes e deixa cortar clipes.
- **Campeões, tier list, confronto, kits e favoritos:** as páginas de estatísticas e as suas próprias builds ("Meus kits").
- **Português do Brasil** em todo o app, inclusive nos nomes de itens, campeões e runas.

## O que este fork muda

Em relação ao [projeto original](https://github.com/ilyanfraimbault/TrueMain):

- **Idioma:** o app desktop inteiro fala **português do Brasil** (e inglês), escolhido num menu da barra superior. Os nomes e textos de itens, campeões, runas e feitiços acompanham o idioma. O site continua em inglês.
- **Identidade visual:** azul-marinho com um azul de destaque, **tema escuro e claro**, ícones em traço fino (Phosphor), medalhas para os tiers e um ícone novo para o app.
- **Menu lateral retrátil** (⌘B).
- **Abas novas:** **Itens e runas**, **Classes** (campeões por classe e subclasse, com explicação do papel), **Notas da atualização** (leitura das notas da Riot, com seletor de patch) e **ProBuild**.
- **Ordem de habilidades nível a nível**, derivada da prioridade de evolução, e a página do campeão reorganizada em cartões.
- **Chave da API da Riot** em Configurações: guardada no chaveiro do sistema, verificada na hora, com os limites de requisições da chave.
- **ProBuild:** uma coleta automática das partidas dos melhores jogadores (Desafiante e Grão-Mestre) para mostrar as builds e runas de cada campeão com as taxas de vitória. Veja a seção abaixo.
- **Ordem de compra e de habilidades** de partidas lidas do cliente, buscadas na timeline da Riot com a sua chave.
- **Infraestrutura:** os workflows do projeto original (CI, deploy em servidor próprio, SonarQube, etc.) foram removidos. Resta só o **build para macOS** (`.github/workflows/desktop-macos.yml`).

## ProBuild: builds de quem joga no topo

A API da Riot não permite perguntar "as partidas do Ezreal no Desafiante". O app anda pelo ranking: lê os melhores jogadores do servidor, as partidas ranqueadas recentes de cada um, e guarda as builds dos **10 jogadores** de cada partida. Daí conta, para o campeão escolhido, a escolha e a vitória de cada pedra-chave, página de runas, item e par de feitiços.

- Roda **sozinho** com o app aberto, no ritmo que os limites da sua chave permitem.
- Precisa de uma **chave da API da Riot** (gere uma em [developer.riotgames.com](https://developer.riotgames.com); a de desenvolvimento vale 24 horas).
- Com a chave pessoal (100 requisições a cada 2 minutos), uma rodada completa leva horas. Os melhores jogadores vêm primeiro, então os primeiros números aparecem em minutos.
- **Limites:** a ordem de compra dos itens ainda não é coletada (exigiria a timeline de cada partida), e menos de 30 partidas de um campeão dão porcentagens pouco confiáveis, o que a tela avisa.

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
cd ../src-tauri && cargo test --lib
```

O app lê as estatísticas de campeões da **API do TrueMain** (`https://truemain.lol`, o servidor do projeto original). Para apontar para outro servidor, defina `TRUEMAIN_SITE_URL` (veja [`desktop/README.md`](desktop/README.md)).

Para gerar o instalador: `npm run tauri build` dentro de `desktop/app`. O GitHub Actions gera o `.dmg` do macOS (`.github/workflows/desktop-macos.yml`) a cada push que mexa no app, e guarda o instalador por 14 dias.

**Ao abrir o `.dmg` no Mac,** o sistema pode avisar que o app "está danificado": ele é assinado só de forma *ad-hoc*. Resolva com `xattr -cr /Applications/TrueMain.app`.

## De onde vêm os dados

| Fonte | Para quê |
|---|---|
| API do TrueMain (`truemain.lol`) | Tier list, estatísticas e builds de campeões, ranking de Truemains, recomendações de draft e de próximo item |
| [Data Dragon](https://developer.riotgames.com/docs/lol) e [Community Dragon](https://www.communitydragon.org/) | Nomes, textos e imagens de itens, campeões, feitiços e runas, no idioma escolhido |
| Cliente do League (local) | Seleção de campeões, perfil, histórico e a partida ao vivo |
| API da Riot (sua chave) | ProBuild; ordem de compra e de habilidades de partidas antigas |
| [Wiki do League](https://wiki.leagueoflegends.com/) | Subclasses dos campeões (um retrato guardado no app) |
| leagueoflegends.com | Notas da atualização |

> **Dependência importante:** quase todas as estatísticas vêm de um servidor que não é deste fork. Se `truemain.lol` sair do ar, as telas de campeões, tier list e ranking ficam vazias; as de itens, runas, classes, notas da atualização e a partida ao vivo continuam funcionando.

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
