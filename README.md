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

## O que fica para a proxima etapa

- Pix/cartão reais no lugar da compra simulada.
- Conversão MP4 nativa em todos os navegadores (hoje o player já toca o vídeo final).
- Login e feed da comunidade.
