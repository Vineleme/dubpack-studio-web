// Google AdSense — monetização ao redor do Studio (nunca no monitor / gravação).
//
// 1) Crie conta: https://www.google.com/adsense/
// 2) Adicione o site dubpackstudio.com e aguarde aprovação.
// 3) Em Anúncios → Por unidade, crie um bloco para cada posição abaixo.
//    Sugestões de tamanho:
//    - leftTop / rightTop: Display responsivo vertical (~160×600)
//    - leftBottom / rightBottom: Retângulo médio (~300×250)
//    - railTop / railBottom: Display responsivo
//    - bottomLeader / masthead / footer: Leaderboard (~728×90) ou responsivo
//    - mobileBanner: Banner responsivo (só celular)
// 4) Copie este arquivo para ads.config.js e preencha clientId + slots.
// 5) enabled: true só depois da aprovação do AdSense.
//
window.DUBPACK_ADS = {
  enabled: false,
  clientId: 'ca-pub-XXXXXXXXXXXXXXXX',
  slots: {
    leftTop: '',
    leftBottom: '',
    rightTop: '',
    rightBottom: '',
    railTop: '',
    railBottom: '',
    bottomLeader: '',
    masthead: '',
    mobileBanner: '',
    footer: ''
  }
};
