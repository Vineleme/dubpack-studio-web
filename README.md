# DubPack Studio Web

Versao web/PWA do DubPack Studio, portada a partir da experiencia Android usada em desenvolvimento.

## Rodar local

```bash
npx serve .
```

Depois abra o endereço local mostrado no terminal.

## O que este MVP faz

- Importa pack `.zip`.
- Lista audios do pack como falas.
- Mostra imagem ou video quando existir no pack.
- Toca referencia.
- Grava com contagem de 3 segundos.
- Para a gravacao automaticamente pelo tempo da fala.
- Reproduz uma previa sequencial usando takes gravados.
- Guarda takes locais durante a sessao do navegador.
- Permite baixar o take gravado.
- Pode ser publicado no GitHub Pages como site/PWA.

## O que fica para a proxima etapa

- Renderizar MP4 final no navegador com FFmpeg WebAssembly ou em servidor.
- Login e comunidade.
- Pagamento/assinatura.
