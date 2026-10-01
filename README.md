# DubPack Studio Web

Versao web/PWA do DubPack Studio, inspirada no Dub Mode do Choicer Voicer.

## Rodar local

```bash
npx serve .
```

Se `npx` não estiver no PATH:

```bash
node dev-server.js
```

Depois abra o endereço local mostrado no terminal.

## O que este MVP faz

- Importa um ou mais packs `.zip`.
- Lista audios como falas (e usa `dub_video` / JSON de linhas se existirem).
- Mostra imagem ou video quando existir no pack.
- Toca referencia, grava com countdown de 3s e permite cancelar/parar no microfone.
- Para a gravacao pelo tempo da fala.
- Mede desempenho real (cobertura e duracao vs referencia).
- Reproduz previa sequencial e guarda takes neste navegador (IndexedDB).
- Baixa o take atual ou um ZIP com todos os audios.
- Gera o vídeo final da dublagem e consome 1 crédito quando ele aparece.
- Pacotes de crédito: 1/R$3, 2/R$5, 5/R$11, 10/R$20.
- Pode ser publicado no GitHub Pages como site/PWA.

## Ensaio de atores

Importe um PDF com cenas numeradas e falas no formato `PERSONAGEM: texto`.
Escolha seu papel, a cena e as vozes dos parceiros. O PDF e suas falas ficam
na sessao local; nenhum roteiro e enviado ao servidor do DubPack.

As vozes usam a sintese do aparelho. O acompanhamento usa reconhecimento de
voz em portugues quando disponivel, que pode enviar audio ao servico do
navegador. O proximo parceiro entra apenas com resultado final, cobertura
ordenada da fala e suas palavras de encerramento. Silencio nao avanca o
dialogo. Ha conclusao manual, pausa, repeticao da deixa, ocultacao da fala
e revisao dos textos importados. PDFs escaneados nao sao suportados.

Teste do parser e acompanhamento: `node --test tests/rehearsal-core.test.mjs`.

## O que fica para a proxima etapa

- Pix/cartão reais no lugar da compra simulada.
- Conversão MP4 nativa em todos os navegadores (hoje o player já toca o vídeo final).
- Login e feed da comunidade.
