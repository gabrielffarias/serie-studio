// Runtime do motor no navegador: entrega os segmentos calculados no Node para
// a timeline GSAP pausada da composição. Sem lógica, sem aleatoriedade.
(function () {
  function aplicar(tl, segmentos, raiz) {
    var escopo = raiz || document;
    var vistos = {};
    for (var i = 0; i < segmentos.length; i++) {
      var s = segmentos[i];
      var alvo = escopo.querySelector(s[0]);
      if (!alvo) continue;
      var chave = s[0] + "|" + s[1];
      var de = {}, para = {};
      de[s[1]] = s[2];
      para[s[1]] = s[3];
      para.duration = s[5];
      para.ease = s[6];
      // só o primeiro segmento de cada trilha renderiza na criação
      para.immediateRender = !vistos[chave];
      vistos[chave] = true;
      if (alvo instanceof SVGElement) { de.svgOrigin = "0 0"; para.svgOrigin = "0 0"; }
      tl.fromTo(alvo, de, para, s[4]);
    }
    return tl;
  }
  window.Motor = { aplicar: aplicar };
})();
