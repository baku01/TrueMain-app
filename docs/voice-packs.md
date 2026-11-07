# Pacotes de voz das dicas no jogo

As dicas do overlay (Overlay → Dicas no jogo) aparecem sempre em texto. Com um
pacote de voz escolhido, o app também fala a dica, quando o pacote tem o clipe
dela. O app não traz nenhum áudio: cada pacote é um ZIP que o jogador importa
na mesma tela.

## O que vai no ZIP

- **Uma frase por dica**: `<chave>.mp3` (também `.ogg` ou `.wav`), na raiz ou
  em qualquer pasta. A lista de chaves e frases está abaixo.
- **Variações**: `<chave>.1.mp3`, `<chave>.2.mp3`… O app sorteia uma a cada
  vez. Nenhuma chave termina em número, é assim que se reconhece uma variação.
- **Nomes de campeões**: `champion/<Alias>.mp3`, pelo nome interno da Riot
  (`LeeSin`, `MonkeyKing`, `KSante`). Maiúsculas e minúsculas não importam.
- **Números**: `number/<n>.mp3`, de `0` a `30`.
- **`manifest.json`** (opcional): `{"name", "author", "language", "version"}`.
  Sem ele, o pacote leva o nome do arquivo.

O botão **Baixar modelo** entrega um ZIP com o `manifest.json` para preencher
e um `LEIA-ME.txt` com esta mesma lista.

## Frases montadas

Algumas dicas citam um campeão ou um número. Nesse caso, o app tenta primeiro
montar a frase em sequência: o nome (ou o número) e depois a parte final da
dica, por exemplo `champion/Viego.mp3` + `jungle.spotted.tail.mp3`. Se faltar
algum pedaço, toca a frase inteira (`jungle.spotted.mp3`, que fala sem o
nome). Se faltar também a frase inteira, a dica fica só no texto.

## Limites e segurança

- No máximo 5 MB por arquivo e 200 MB no total.
- O app só aceita arquivos de áudio com nome do esquema, e confere os
  primeiros bytes de cada um (MP3, OGG ou WAV de verdade). O resto do ZIP é
  ignorado sem ser aberto. Caminhos com `..`, absolutos ou com letra de
  unidade são recusados.
- Nada do pacote é executado nem exibido, fora o nome, o autor, o idioma e a
  versão do manifesto, como texto simples.
- Os pacotes ficam guardados no próprio app (IndexedDB do webview), não em
  arquivos no disco.

## Chaves e frases para gravar

A tabela é gerada de `desktop/app/app/utils/tips/voice-keys.ts`, a mesma
fonte do `LEIA-ME.txt` do modelo; um teste confere que as duas não divergem.
Um script de conversão pode ler esse arquivo direto: são só dados.

<!-- chaves -->
| Arquivo | Frase | Montada com |
| --- | --- | --- |
| `objective.dragon.60s.mp3` | Dragão daqui a um minuto! Empurra a wave e cola no rio. |  |
| `objective.dragon.30s.mp3` | Dragão em trinta segundos! Garante a visão do covil. |  |
| `objective.dragon.smite.mp3` | Dragão em dez segundos! Segura o Smite pro final. |  |
| `objective.elder.60s.mp3` | Ancião daqui a um minuto! Essa luta decide o jogo. |  |
| `objective.elder.30s.mp3` | Ancião em trinta segundos! Agrupa e limpa as wards. |  |
| `objective.elder.smite.mp3` | Ancião em dez segundos! Smite no último hit, sem errar. |  |
| `objective.grubs.60s.mp3` | Larvas daqui a um minuto! Chega primeiro no lado de cima. |  |
| `objective.grubs.30s.mp3` | Larvas em trinta segundos! Bota ward no covil. |  |
| `objective.herald.60s.mp3` | Arauto daqui a um minuto! Combina quem vai pegar. |  |
| `objective.herald.30s.mp3` | Arauto em trinta segundos! Empurra a wave antes de ir. |  |
| `objective.herald.smite.mp3` | Arauto em dez segundos! Guarda o Smite pro final. |  |
| `objective.baron.60s.mp3` | Barão daqui a um minuto! Puxa as waves laterais e agrupa. |  |
| `objective.baron.30s.mp3` | Barão em trinta segundos! Limpa a visão do rio. |  |
| `objective.baron.smite.mp3` | Barão em dez segundos! Smite pronto, não deixa roubar. |  |
| `jungle.spotted.mp3` | Caçador inimigo visto no mapa! Fica esperto. | `champion/<Alias>.mp3` + `jungle.spotted.tail.mp3` |
| `jungle.spotted.tail.mp3` | foi visto no mapa! Fica esperto. | parte final, depois do nome ou do número |
| `jungle.firstClear.mp3` | O caçador inimigo tá fechando o primeiro clear. Joga seguro! | `champion/<Alias>.mp3` + `jungle.firstClear.tail.mp3` |
| `jungle.firstClear.tail.mp3` | tá fechando o primeiro clear. Joga seguro! | parte final, depois do nome ou do número |
| `jungle.gankWindow.mp3` | Janela de gank do caçador inimigo! Olho no rio. | `champion/<Alias>.mp3` + `jungle.gankWindow.tail.mp3` |
| `jungle.gankWindow.tail.mp3` | pode estar vindo de gank. Olho no rio! | parte final, depois do nome ou do número |
| `recall.earlyGold.mp3` | Já dá pra comprar! Empurra a wave e volta pra base. |  |
| `map.minimap.mp3` | Dá uma olhada no minimapa! |  |
| `ward.redLens.mp3` | Troca o amuleto amarelo pela lente vermelha! |  |
| `ward.blueLens.mp3` | Nível nove! Troca pro amuleto azul. |  |
| `farm.great.mp3` | Farm excelente! Continua assim. |  |
| `farm.ok.mp3` | Farm razoável. Não perde as waves. |  |
| `farm.low.mp3` | Farm baixo! Cada wave conta. |  |
| `level.sixFirst.mp3` | Nível seis primeiro! Aproveita o pico. |  |
| `level.enemySixFirst.mp3` | Seu oponente chegou no seis antes! Respeita o ultimate. | `champion/<Alias>.mp3` + `level.enemySixFirst.tail.mp3` |
| `level.enemySixFirst.tail.mp3` | chegou no seis antes! Respeita o ultimate. | parte final, depois do nome ou do número |
| `kill.levelTwo.mp3` | Abate no nível dois! Que timing! |  |
| `kill.shutdown.mp3` | Shutdown! A recompensa é do time. | `champion/<Alias>.mp3` + `kill.shutdown.tail.mp3` |
| `kill.shutdown.tail.mp3` | foi parado! A recompensa é do time. | parte final, depois do nome ou do número |
| `death.streak.mp3` | Várias mortes seguidas. Respira e joga com o time. | `number/<n>.mp3` + `death.streak.tail.mp3` |
| `death.streak.tail.mp3` | mortes seguidas. Respira e joga com o time. | parte final, depois do nome ou do número |
| `death.nemesis.mp3` | Esse inimigo já te pegou três vezes. Não luta sozinho! | `champion/<Alias>.mp3` + `death.nemesis.tail.mp3` |
| `death.nemesis.tail.mp3` | já te pegou três vezes. Não luta sozinho! | parte final, depois do nome ou do número |
| `gold.ahead.mp3` | Vocês tão na frente! Pressiona os objetivos. |  |
| `gold.behind.mp3` | Vocês tão atrás. Farma e espera o erro deles. |  |
<!-- /chaves -->
