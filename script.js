/* Рисунок кровати: косая проекция, всё в сантиметрах. Один движок на герой, конструктор и карточки моделей. */
(function () {
  'use strict';
  var KX = 0.55, KY = 0.30;          // ось глубины уходит вправо-вверх
  var L = 200, HT = 9, HH = 104, HB = 6, BH = 27, MH = 22, LID = 4, INS = 3;
  var LEGS = { pad: 2.5, leg: 9, high: 17 };
  var NS = 'http://www.w3.org/2000/svg';
  var MAXW = 200;
  var VB_W = 362, VB_H = 262, FLOOR = 244; // viewBox и линия пола у переднего края

  function P(x, y, z) { return [x + z * KX, -y - z * KY]; }
  function pts(arr) { var s = ''; for (var i = 0; i < arr.length; i++) s += (i ? ' ' : '') + arr[i][0].toFixed(2) + ',' + arr[i][1].toFixed(2); return s; }
  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function rot(u, v, a) { var c = Math.cos(a), s = Math.sin(a); return [u * c - v * s, u * s + v * c]; }

  // грань из ткани: цвет + тень + две фактуры (шенилл / велюр), фактуры переключаются классом на корне
  function face(parent, d, shade, pfx, extra) {
    var g = el('g', { 'class': 'face' + (extra ? ' ' + extra : '') }, parent);
    el('path', { d: d, 'class': 'fab' }, g);
    el('path', { d: d, 'class': 'tex tex-ch', fill: 'url(#' + pfx + '-ch)' }, g);
    el('path', { d: d, 'class': 'tex tex-vel', fill: 'url(#' + pfx + '-vel)' }, g);
    if (shade) el('path', { d: d, fill: '#000', opacity: shade }, g);
    return g;
  }
  function poly(arr) { return 'M' + pts(arr).replace(/ /g, 'L') + 'Z'; }
  function rrect(x, y, w, h, r) {
    if (typeof r === 'number') r = [r, r, r, r];
    var lim = Math.min(w / 2, h / 2);
    var r1 = Math.min(r[0], lim), r2 = Math.min(r[1], lim), r3 = Math.min(r[2], lim), r4 = Math.min(r[3], lim);
    return 'M' + (x + r1) + ',' + y + 'H' + (x + w - r2) + 'A' + r2 + ',' + r2 + ' 0 0 1 ' + (x + w) + ',' + (y + r2) +
      'V' + (y + h - r3) + 'A' + r3 + ',' + r3 + ' 0 0 1 ' + (x + w - r3) + ',' + (y + h) +
      'H' + (x + r4) + 'A' + r4 + ',' + r4 + ' 0 0 1 ' + x + ',' + (y + h - r4) +
      'V' + (y + r1) + 'A' + r1 + ',' + r1 + ' 0 0 1 ' + (x + r1) + ',' + y + 'Z';
  }

  function Bed(svg, opts) {
    opts = opts || {};
    this.svg = svg;
    this.pfx = opts.prefix || ('b' + Math.floor(Math.random() * 1e6));
    this.scene = !!opts.scene; // внутри сцены героя: без своей тени/размеров
    this.state = { W: 160, model: 'kolonna', lift: 0, legs: 'pad', legH: LEGS.pad, robot: null, fabric: 'chenille', dims: !opts.scene };
    this.lastKey = '';
    this.build();
    this.render();
  }

  Bed.prototype.build = function () {
    var s = this.svg, p = this.pfx;
    if (!this.scene) { s.setAttribute('viewBox', '0 0 ' + VB_W + ' ' + VB_H); }
    s.classList.add('bed', 'che');
    var defs = el('defs', null, s);
    // шенилл: мелкая матовая штриховка
    var pat = el('pattern', { id: p + '-ch', width: 3, height: 3, patternUnits: 'userSpaceOnUse' }, defs);
    el('path', { d: 'M0,3L3,0', stroke: '#000', 'stroke-width': .35, opacity: .10 }, pat);
    el('path', { d: 'M0,0L3,3', stroke: '#fff', 'stroke-width': .3, opacity: .12 }, pat);
    // велюр: мягкий косой блик
    var g = el('linearGradient', { id: p + '-vel', x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
    el('stop', { offset: 0, 'stop-color': '#fff', 'stop-opacity': .42 }, g);
    el('stop', { offset: .42, 'stop-color': '#fff', 'stop-opacity': .06 }, g);
    el('stop', { offset: .7, 'stop-color': '#000', 'stop-opacity': .06 }, g);
    el('stop', { offset: 1, 'stop-color': '#000', 'stop-opacity': .24 }, g);
    // канал колонны: цилиндр
    var gc = el('linearGradient', { id: p + '-chan', x1: 0, y1: 0, x2: 1, y2: 0 }, defs);
    el('stop', { offset: 0, 'stop-color': '#000', 'stop-opacity': .28 }, gc);
    el('stop', { offset: .35, 'stop-color': '#fff', 'stop-opacity': .22 }, gc);
    el('stop', { offset: .7, 'stop-color': '#fff', 'stop-opacity': 0 }, gc);
    el('stop', { offset: 1, 'stop-color': '#000', 'stop-opacity': .32 }, gc);
    // мягкая панель экрана
    var gp = el('radialGradient', { id: p + '-puff', cx: .35, cy: .3, r: .9 }, defs);
    el('stop', { offset: 0, 'stop-color': '#fff', 'stop-opacity': .3 }, gp);
    el('stop', { offset: .6, 'stop-color': '#fff', 'stop-opacity': .04 }, gp);
    el('stop', { offset: 1, 'stop-color': '#000', 'stop-opacity': .22 }, gp);
    // матрас: стёжка ромбом в плоскости верха
    var pm = el('pattern', { id: p + '-quilt', width: 14, height: 14, patternUnits: 'userSpaceOnUse', patternTransform: 'matrix(1 0 ' + KX + ' ' + (-KY) + ' 0 0)' }, defs);
    el('path', { d: 'M7,0L14,7L7,14L0,7Z', fill: 'none', stroke: '#000', 'stroke-width': .5, opacity: .08 }, pm);
    el('circle', { cx: 7, cy: 7, r: .7, fill: '#000', opacity: .1 }, pm);
    var gm = el('linearGradient', { id: p + '-matt', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el('stop', { offset: 0, 'stop-color': '#FBFAF7' }, gm);
    el('stop', { offset: 1, 'stop-color': '#E9E4DB' }, gm);
    var f = el('filter', { id: p + '-blur', x: '-20%', y: '-40%', width: '140%', height: '180%' }, defs);
    el('feGaussianBlur', { stdDeviation: 5 }, f);
    var gl = el('linearGradient', { id: p + '-leg', x1: 0, y1: 0, x2: 1, y2: 0 }, defs);
    el('stop', { offset: 0, 'stop-color': '#7a4f33' }, gl);
    el('stop', { offset: .5, 'stop-color': '#a3704e' }, gl);
    el('stop', { offset: 1, 'stop-color': '#5d3a24' }, gl);

    var root = this.root = el('g', { 'class': 'bed-root' }, s);
    this.gShadow = el('g', { 'class': 'g-shadow' }, root);
    this.gHead = el('g', { 'class': 'g-head' }, root);
    this.gLegs = el('g', { 'class': 'g-legs' }, root);
    this.gRobot = el('g', { 'class': 'g-robot' }, root);
    this.gBox = el('g', { 'class': 'g-box' }, root);
    this.gBase = el('g', { 'class': 'g-base' }, root);
    this.gLid = el('g', { 'class': 'g-lid' }, root);
    this.gDims = el('g', { 'class': 'g-dims' }, root);
  };

  Bed.prototype.set = function (patch) { for (var k in patch) this.state[k] = patch[k]; this.render(); };

  Bed.prototype.render = function () {
    var st = this.state, W = st.W, p = this.pfx, lh = st.legH;
    var key = [W.toFixed(1), st.model, st.lift.toFixed(3), lh.toFixed(2), st.robot === null ? 'n' : st.robot.toFixed(1), st.dims, st.matt !== false].join('|');
    if (key === this.lastKey) return;
    this.lastKey = key;
    var self = this;
    function clear(g) { while (g.firstChild) g.removeChild(g.firstChild); }

    // центровка: ширина рисунка = W + 10 + (L+HT)*KX
    if (!this.scene) {
      var drawW = W + 10 + (L + HT) * KX;
      this.root.setAttribute('transform', 'translate(' + ((VB_W - drawW) / 2 + 5).toFixed(2) + ',' + FLOOR + ')');
    }

    /* ---------- тень на полу ---------- */
    clear(this.gShadow);
    if (!this.scene) {
      el('path', { d: poly([P(-8, 0, -10), P(W + 8, 0, -10), P(W + 8, 0, L + HT + 6), P(-8, 0, L + HT + 6)]), fill: '#000', opacity: .22, filter: 'url(#' + p + '-blur)' }, this.gShadow);
    }

    /* ---------- изголовье ---------- */
    clear(this.gHead);
    var Wh = W + 10, Hh = HH - HB;
    var m = st.model;
    var rTop = m === 'kolonna-soft' ? 16 : (m === 'ekran' || m === 'dvoynoy-ekran') ? 12 : 2.5;
    var tl = P(-5, HH, L);
    var rB = m === 'kolonna-soft' ? 2 : (m === 'ekran' || m === 'dvoynoy-ekran') ? 4 : 2;
    // фронт - в 2D группе, начало в левом верхнем углу; толщина - задняя копия контура + две прямые кромки
    var gf = el('g', { transform: 'translate(' + tl[0].toFixed(2) + ',' + tl[1].toFixed(2) + ')' }, this.gHead);
    var outer = rrect(0, 0, Wh, Hh, [rTop, rTop, rB, rB]);
    var sx = HT * KX, sy = -HT * KY;
    var gb = el('g', { transform: 'translate(' + sx.toFixed(2) + ',' + sy.toFixed(2) + ')' }, gf);
    face(gb, outer, .30, p);
    face(gf, poly([[rTop, 0], [rTop + sx, sy], [Wh - rTop + sx, sy], [Wh - rTop, 0]]), .10, p);          // верхняя кромка
    face(gf, poly([[Wh, rTop], [Wh + sx, rTop + sy], [Wh + sx, Hh - rB + sy], [Wh, Hh - rB]]), .34, p);  // боковина
    var clipId = p + '-hb';
    var cp = el('clipPath', { id: clipId }, gf);
    el('path', { d: outer }, cp);
    face(gf, outer, 0, p);
    var gi = el('g', { 'clip-path': 'url(#' + clipId + ')' }, gf);
    if (m === 'kolonna' || m === 'kolonna-soft') {
      var n = Math.max(5, Math.round(Wh / 13));
      var cw = Wh / n;
      for (var i = 0; i < n; i++) {
        el('rect', { x: i * cw, y: 0, width: cw, height: Hh, fill: 'url(#' + p + '-chan)' }, gi);
        if (i) el('line', { x1: i * cw, y1: 0, x2: i * cw, y2: Hh, stroke: '#000', 'stroke-width': .7, opacity: .35 }, gi);
      }
      el('path', { d: outer, fill: 'none', stroke: '#000', 'stroke-width': 1.2, opacity: .25 }, gi);
    } else if (m === 'ekran' || m === 'dvoynoy-ekran') {
      var fr = 9, panels = m === 'ekran' ? 1 : 2, gap = 3;
      var pw = (Wh - fr * 2 - gap * (panels - 1)) / panels;
      el('path', { d: outer, fill: '#000', opacity: .14 }, gi); // рама чуть темнее
      for (var j = 0; j < panels; j++) {
        var px = fr + j * (pw + gap);
        var d = rrect(px, fr, pw, Hh - fr * 2, 7);
        el('path', { d: d, 'class': 'fab' }, gi);
        el('path', { d: d, fill: 'url(#' + p + '-puff)' }, gi);
        el('path', { d: d, fill: 'none', stroke: '#000', 'stroke-width': .9, opacity: .3 }, gi);
      }
    } else { // классика
      el('rect', { x: 0, y: 0, width: Wh, height: Hh, fill: 'url(#' + p + '-puff)' }, gi);
      el('path', { d: rrect(2.2, 2.2, Wh - 4.4, Hh - 4.4, 2), fill: 'none', stroke: '#fff', 'stroke-width': .6, opacity: .25 }, gi);
      el('path', { d: outer, fill: 'none', stroke: '#000', 'stroke-width': 1, opacity: .22 }, gi);
    }

    /* ---------- опоры ---------- */
    clear(this.gLegs);
    var legW = st.legs === 'pad' ? 7 : st.legs === 'leg' ? 5.5 : 4.5;
    var corners = [[W, L - 6], [2, 6], [W - 2, 6]]; // задняя правая, передняя левая, передняя правая
    for (var c = 0; c < corners.length; c++) {
      var cx = corners[c][0], cz = corners[c][1];
      var a = P(cx - legW / 2, 0, cz), b = P(cx + legW / 2, 0, cz), c2 = P(cx + legW / 2, lh, cz), d2 = P(cx - legW / 2, lh, cz);
      if (st.legs === 'pad') {
        el('path', { d: rrect(a[0], d2[1], legW, lh, 1), fill: '#2a2623' }, this.gLegs);
      } else {
        var taper = st.legs === 'high' ? 1.2 : .8;
        el('path', { d: poly([[a[0] + taper, a[1]], [b[0] - taper, b[1]], c2, d2]), fill: 'url(#' + p + '-leg)' }, this.gLegs);
        el('ellipse', { cx: (a[0] + b[0]) / 2, cy: a[1], rx: legW / 2 + 1.5, ry: 1.2, fill: '#000', opacity: .25 }, this.gLegs);
      }
    }

    /* ---------- робот-пылесос ---------- */
    clear(this.gRobot);
    if (st.robot !== null) {
      var rz = 34, rx = st.robot, rr = 16;
      var rc = P(rx, 0, rz);
      el('ellipse', { cx: rc[0], cy: rc[1] + 1.5, rx: rr + 4, ry: 5.5, fill: '#000', opacity: .18 }, this.gRobot);
      var top = P(rx, 8, rz);
      el('path', { d: poly([P(rx - rr, 0, rz), P(rx + rr, 0, rz), P(rx + rr, 8, rz), P(rx - rr, 8, rz)]).replace('Z', ''), fill: 'none' }, this.gRobot);
      el('ellipse', { cx: rc[0], cy: rc[1], rx: rr, ry: rr * .42, fill: '#1f1e22' }, this.gRobot);
      el('ellipse', { cx: top[0], cy: top[1], rx: rr, ry: rr * .42, fill: '#34333a' }, this.gRobot);
      el('ellipse', { cx: top[0], cy: top[1], rx: rr * .55, ry: rr * .24, fill: 'none', stroke: '#6d6c75', 'stroke-width': .8 }, this.gRobot);
      el('circle', { cx: top[0], cy: top[1], r: 1.6, fill: '#7dd3a6', 'class': 'robot-led' }, this.gRobot);
    }

    /* ---------- бельевой ящик (виден, когда основание поднято) ---------- */
    clear(this.gBox);
    var yTop = lh + BH;
    if (st.lift > 0.001) {
      el('path', { d: poly([P(0, yTop, 0), P(W, yTop, 0), P(W, yTop, L), P(0, yTop, L)]), fill: '#2b2420' }, this.gBox);
      // внутренняя левая стенка и задняя стенка
      el('path', { d: poly([P(0, yTop, 0), P(0, yTop, L), P(4, lh + 6, L), P(4, lh + 6, 0)]), fill: '#1c1714' }, this.gBox);
      el('path', { d: poly([P(0, yTop, L), P(W, yTop, L), P(W - 4, lh + 6, L - 4), P(4, lh + 6, L - 4)]), fill: '#3a302a' }, this.gBox);
      // бельё: три стопки
      var linen = [[0.08, 0.34, 14, 62, '#E8DFD2'], [0.42, 0.72, 11, 76, '#D9CBBC'], [0.76, 0.95, 16, 70, '#C7D0D6']];
      for (var li = 0; li < linen.length; li++) {
        var ln = linen[li], x1 = W * ln[0], x2 = W * ln[1], h = ln[2], z2 = ln[3], y0 = lh + 6;
        el('path', { d: poly([P(x1, y0 + h, 30), P(x2, y0 + h, 30), P(x2, y0 + h, z2), P(x1, y0 + h, z2)]), fill: ln[4] }, this.gBox);
        el('path', { d: poly([P(x1, y0, 30), P(x2, y0, 30), P(x2, y0 + h, 30), P(x1, y0 + h, 30)]), fill: ln[4] }, this.gBox);
        el('path', { d: poly([P(x1, y0, 30), P(x2, y0, 30), P(x2, y0 + h, 30), P(x1, y0 + h, 30)]), fill: '#000', opacity: .22 }, this.gBox);
        el('path', { d: poly([P(x2, y0, 30), P(x2, y0, z2), P(x2, y0 + h, z2), P(x2, y0 + h, 30)]), fill: '#000', opacity: .34 }, this.gBox);
        el('path', { d: poly([P(x2, y0, 30), P(x2, y0, z2), P(x2, y0 + h, z2), P(x2, y0 + h, 30)]), fill: ln[4], opacity: .5 }, this.gBox);
      }
    }

    /* ---------- царга ---------- */
    clear(this.gBase);
    face(this.gBase, poly([P(W, lh, 0), P(W, lh, L), P(W, yTop, L), P(W, yTop, 0)]), .36, p);   // правый бок
    face(this.gBase, poly([P(0, lh, 0), P(W, lh, 0), P(W, yTop, 0), P(0, yTop, 0)]), .06, p);     // фронт
    el('path', { d: poly([P(0, yTop - .8, 0), P(W, yTop - .8, 0), P(W, yTop, 0), P(0, yTop, 0)]), fill: '#fff', opacity: .25 }, this.gBase);
    if (st.lift < 0.001) {
      face(this.gBase, poly([P(0, yTop, 0), P(W, yTop, 0), P(W, yTop, L), P(0, yTop, L)]), .14, p); // верх рамы под матрасом
    }

    /* ---------- основание + матрас (поворот у изголовья) ---------- */
    clear(this.gLid);
    var ang = st.lift * 0.78;
    function Q(x, u, v) { var r = rot(u, v, ang); return P(x, yTop + r[1], L - r[0]); }
    // борт рамы по периметру (тонкая доска)
    face(this.gLid, poly([Q(W, L, 0), Q(W, 0, 0), Q(W, 0, LID), Q(W, L, LID)]), .4, p);
    face(this.gLid, poly([Q(0, L, 0), Q(W, L, 0), Q(W, L, LID), Q(0, L, LID)]), .12, p);
    if (st.lift > 0.001) {
      // газлифт
      var s1 = P(W - 6, lh + 5, L - 48), s2 = Q(W - 6, 46, 0);
      el('line', { x1: s1[0], y1: s1[1], x2: s2[0], y2: s2[1], stroke: '#555', 'stroke-width': 2.2, 'stroke-linecap': 'round' }, this.gLid);
      el('line', { x1: s1[0], y1: s1[1], x2: (s1[0] + s2[0]) / 2, y2: (s1[1] + s2[1]) / 2, stroke: '#9a9a9a', 'stroke-width': 3.2, 'stroke-linecap': 'round' }, this.gLid);
    }
    if (st.matt === false) {
      // без матраса: открытое основание с ламелями
      var tv = LID;
      el('path', { d: poly([Q(INS, L - INS, tv), Q(W - INS, L - INS, tv), Q(W - INS, INS, tv), Q(INS, INS, tv)]), fill: '#3e322a' }, this.gLid);
      var nT = 14;
      for (var ti = 0; ti < nT; ti++) {
        var a1 = 8 + ti * (L - 16) / nT, a2 = a1 + (L - 16) / nT * .58;
        el('path', { d: poly([Q(INS + 2, a1, tv), Q(W / 2 - 3, a1, tv), Q(W / 2 - 3, a2, tv), Q(INS + 2, a2, tv)]), fill: '#dcb98f' }, this.gLid);
        el('path', { d: poly([Q(W / 2 + 3, a1, tv), Q(W - INS - 2, a1, tv), Q(W - INS - 2, a2, tv), Q(W / 2 + 3, a2, tv)]), fill: '#dcb98f' }, this.gLid);
      }
      el('path', { d: poly([Q(W / 2 - 2.5, 4, tv), Q(W / 2 + 2.5, 4, tv), Q(W / 2 + 2.5, L - 4, tv), Q(W / 2 - 2.5, L - 4, tv)]), fill: '#2b231d' }, this.gLid);
      // верхняя кромка рамы основания
      el('path', { d: poly([Q(0, L, tv), Q(W, L, tv), Q(W, 0, tv), Q(W - INS, INS, tv), Q(W - INS, L - INS, tv), Q(INS, L - INS, tv)]), fill: '#000', opacity: .0 }, this.gLid);
    } else {
      // матрас
      var mx1 = INS, mx2 = W - INS, mu1 = INS, mu2 = L - INS, mv1 = LID, mv2 = LID + MH;
      var mTop = poly([Q(mx1, mu2, mv2), Q(mx2, mu2, mv2), Q(mx2, mu1, mv2), Q(mx1, mu1, mv2)]);
      var mFront = poly([Q(mx1, mu2, mv1), Q(mx2, mu2, mv1), Q(mx2, mu2, mv2), Q(mx1, mu2, mv2)]);
      var mSide = poly([Q(mx2, mu2, mv1), Q(mx2, mu1, mv1), Q(mx2, mu1, mv2), Q(mx2, mu2, mv2)]);
      el('path', { d: mSide, fill: 'url(#' + p + '-matt)' }, this.gLid);
      el('path', { d: mSide, fill: '#000', opacity: .2 }, this.gLid);
      el('path', { d: mFront, fill: 'url(#' + p + '-matt)' }, this.gLid);
      el('path', { d: mFront, fill: '#000', opacity: .05 + st.lift * .08 }, this.gLid);
      el('path', { d: mTop, fill: 'url(#' + p + '-matt)' }, this.gLid);
      el('path', { d: mTop, fill: 'url(#' + p + '-quilt)' }, this.gLid);
      // кант матраса
      var e1 = Q(mx1, mu2, mv2), e2 = Q(mx2, mu2, mv2), e3 = Q(mx2, mu1, mv2);
      el('polyline', { points: pts([e1, e2, e3]), fill: 'none', stroke: '#000', 'stroke-width': .7, opacity: .18 }, this.gLid);
      var e4 = Q(mx1, mu2, mv1), e5 = Q(mx2, mu2, mv1), e6 = Q(mx2, mu1, mv1);
      el('polyline', { points: pts([e4, e5, e6]), fill: 'none', stroke: '#000', 'stroke-width': .7, opacity: .18 }, this.gLid);
    }
    if (st.lift > 0.08) {
      // низ основания закрывает матрас по мере подъёма: доска и ламели
      var under = Math.min(1, (st.lift - 0.08) / 0.3);
      var gu = el('g', { opacity: under }, this.gLid);
      var uw = poly([Q(0, L, 0), Q(W, L, 0), Q(W, 0, 0), Q(0, 0, 0)]);
      face(gu, uw, .42, p);
      el('path', { d: poly([Q(INS, L - INS, 0), Q(W - INS, L - INS, 0), Q(W - INS, INS, 0), Q(INS, INS, 0)]), fill: '#4a3b31' }, gu);
      var nS = 13;
      for (var si = 0; si < nS; si++) {
        var u1 = 8 + si * (L - 16) / nS, u2 = u1 + (L - 16) / nS * .6;
        el('path', { d: poly([Q(INS + 2, u1, 0), Q(W - INS - 2, u1, 0), Q(W - INS - 2, u2, 0), Q(INS + 2, u2, 0)]), fill: '#d2ad84' }, gu);
      }
      el('path', { d: poly([Q(W / 2 - 2.5, 4, 0), Q(W / 2 + 2.5, 4, 0), Q(W / 2 + 2.5, L - 4, 0), Q(W / 2 - 2.5, L - 4, 0)]), fill: '#5a4a3f' }, gu);
    }

    /* ---------- размерная линия ---------- */
    clear(this.gDims);
    if (st.dims) {
      var d1 = P(0, -4, -12), d2 = P(W, -4, -12);
      el('line', { x1: d1[0], y1: d1[1], x2: d2[0], y2: d2[1], stroke: 'currentColor', 'stroke-width': .6, opacity: .5 }, this.gDims);
      el('line', { x1: d1[0], y1: d1[1] - 3, x2: d1[0], y2: d1[1] + 3, stroke: 'currentColor', 'stroke-width': .6, opacity: .5 }, this.gDims);
      el('line', { x1: d2[0], y1: d2[1] - 3, x2: d2[0], y2: d2[1] + 3, stroke: 'currentColor', 'stroke-width': .6, opacity: .5 }, this.gDims);
      var t = el('text', { x: (d1[0] + d2[0]) / 2, y: d1[1] + 10, 'text-anchor': 'middle', 'class': 'dim-t' }, this.gDims);
      t.textContent = Math.round(W) + ' x 200';
      var s1d = P(W, -4, 0), s2d = P(W, -4, L);
      var sx = s1d[0] + 10, sx2 = s2d[0] + 10;
      el('line', { x1: sx, y1: s1d[1], x2: sx2, y2: s2d[1], stroke: 'currentColor', 'stroke-width': .6, opacity: .5 }, this.gDims);
    }
  };

  window.BedDraw = Bed;
  window.BedDraw.LEGS = LEGS;
  window.BedDraw.P = P;
})();
/* Кровать Тахта - логика страницы: конструктор, герой, карточки, лента, язык. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGsap = typeof window.gsap !== 'undefined';
  var NB = ' ';

  /* ---------- прайс (copy.md) ---------- */
  var PRICE = { 80: [80000, 100000], 90: [85000, 105000], 100: [95000, 110000], 120: [100000, 115000], 140: [105000, 120000], 160: [110000, 125000], 180: [115000, 130000], 200: [120000, 140000] };
  var COLORS = { belyy: '#F2F0EB', molochnyy: '#EFE6D6', bezhevyy: '#D9C7AC', kapuchino: '#B99A7A', seryy: '#9A9A98', grafit: '#4A4A4D', goluboy: '#8FA9BE', pudrovyy: '#D9A5A0', terrakota: '#C1512E', bordo: '#6E2434' };
  var PHOTOS = {
    'kolonna': { src: 'assets/photos/kolonna.webp', pos: '50% 60%', rot: '0deg', zoom: 1.02 },
    'kolonna-soft': { src: 'assets/photos/kolonna-round.webp', pos: '50% 42%', rot: '9deg', zoom: 1.32 },
    'ekran': { src: 'assets/photos/ekran-2.webp', pos: '50% 55%', rot: '-3deg', zoom: 1.1 },
    'dvoynoy-ekran': { src: 'assets/photos/dvoynoy-ekran.webp', pos: '50% 45%', rot: '0deg', zoom: 1.05 },
    'klassika': { src: 'assets/photos/klassika.webp', pos: '50% 55%', rot: '0deg', zoom: 1.04 }
  };
  var LEGH = window.BedDraw.LEGS;

  /* ---------- словарь динамических строк (RU); казахский - assets/lang/kk.js ---------- */
  var RU = {
    'model.kolonna': 'Колонна', 'model.kolonna-soft': 'Колонна Софт', 'model.ekran': 'Экран', 'model.dvoynoy-ekran': 'Двойной экран', 'model.klassika': 'Классика',
    'color.belyy': 'Белый', 'color.molochnyy': 'Молочный', 'color.bezhevyy': 'Бежевый', 'color.kapuchino': 'Капучино', 'color.seryy': 'Серый', 'color.grafit': 'Графит', 'color.goluboy': 'Голубой', 'color.pudrovyy': 'Пудровый', 'color.terrakota': 'Терракота', 'color.bordo': 'Бордо',
    'fab.chenille': 'Шенилл', 'fab.velour': 'Велюр',
    'legs.pad': 'Подпятники', 'legs.leg': 'Ножки', 'legs.high': 'Высокие ножки под робот-пылесос',
    'lift.no': 'Без механизма', 'lift.yes': 'С подъёмным механизмом',
    'sum.model': 'Модель', 'sum.size': 'Размер', 'sum.lift': 'Подъёмный механизм', 'sum.fabric': 'Ткань', 'sum.color': 'цвет', 'sum.legs': 'Опоры', 'sum.matt': 'Матрас',
    'yes': 'да', 'no': 'нет', 'matt.need': 'нужен', 'matt.noneed': 'не нужен',
    'wa.hello': 'Здравствуйте! Хочу заказать кровать.', 'wa.calc': 'Расчёт на сайте', 'wa.name': 'Имя', 'wa.phone': 'телефон', 'wa.comment': 'Комментарий', 'wa.matt': 'матрас от 30 000 ₸'
  };
  function lang() { return document.documentElement.lang === 'kk' ? 'kk' : 'ru'; }
  function t(k) { var kk = window.SITE_KK; if (lang() === 'kk' && kk && kk[k]) return kk[k]; return RU[k] || k; }
  function r(k) { return RU[k] || k; } // текст заявки владельцу - всегда по-русски
  function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, NB) + NB + '₸'; }

  /* ---------- Lenis + GSAP ---------- */
  var lenis = null;
  if (hasGsap && window.Lenis && !reduce) {
    lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true });
    if (window.ScrollTrigger) { gsap.registerPlugin(ScrollTrigger); lenis.on('scroll', ScrollTrigger.update); }
    gsap.ticker.add(function (tm) { lenis.raf(tm * 1000); });
    gsap.ticker.lagSmoothing(0);
  } else if (hasGsap && window.ScrollTrigger) { gsap.registerPlugin(ScrollTrigger); }
  function scrollTo(target, offset) {
    var el = typeof target === 'string' ? $(target) : target;
    if (!el) return;
    var off = -(parseInt(getComputedStyle(document.documentElement).getPropertyValue('--hdr')) || 76) + (offset || 0);
    if (lenis) lenis.scrollTo(el, { offset: off, duration: 1.1 });
    else window.scrollTo({ top: el.getBoundingClientRect().top + window.pageYOffset + off, behavior: reduce ? 'auto' : 'smooth' });
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href');
    if (id.length < 2 || !$(id)) return;
    e.preventDefault();
    closeMenu();
    scrollTo(id);
    history.replaceState(null, '', id);
  });

  /* ---------- шапка и меню ---------- */
  var hdr = $('#hdr'), burger = $('.burger'), mnav = $('#mnav');
  function onScroll() { hdr.classList.toggle('is-solid', window.pageYOffset > 24); }
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  function closeMenu() { if (!mnav || mnav.hidden) return; mnav.hidden = true; burger.setAttribute('aria-expanded', 'false'); document.body.classList.remove('menu-open'); if (lenis) lenis.start(); }
  if (burger) burger.addEventListener('click', function () {
    var open = mnav.hidden; mnav.hidden = !open; burger.setAttribute('aria-expanded', String(open)); document.body.classList.toggle('menu-open', open);
    if (lenis) { open ? lenis.stop() : lenis.start(); }
  });

  /* ---------- бегущая строка цветов ---------- */
  (function () {
    var track = $('#marqTrack'); if (!track) return;
    var set = track.firstElementChild;
    function fill() {
      var w = set.getBoundingClientRect().width; if (!w) return;
      while (track.children.length > 1) track.removeChild(track.lastChild);
      var need = Math.ceil((window.innerWidth * 2) / w) + 1;
      for (var i = 0; i < need; i++) track.appendChild(set.cloneNode(true));
      track.style.setProperty('--marq-w', w + 'px');
      track.style.setProperty('--marq-dur', (w / 60) + 's');
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fill); else fill();
    var tmr; window.addEventListener('resize', function () { clearTimeout(tmr); tmr = setTimeout(fill, 200); });
  })();

  /* ---------- проявление блоков ---------- */
  (function () {
    var sel = '.sec-head,.mcard,.step,.summary,.ptable,.ptable-side,.wcard,.why-it,.how-list li,.faq-list details,.cont-card,.cont-cta';
    var items = $$(sel);
    items.forEach(function (el) { el.classList.add('rv'); });
    $$('.mgrid,.why-grid,.how-list,.faq-list,.cont-grid,.strip,.steps').forEach(function (grp) {
      $$('.rv', grp).forEach(function (el, i) { el.style.transitionDelay = (Math.min(i, 8) * 70) + 'ms'; });
    });
    if (!('IntersectionObserver' in window) || reduce) { items.forEach(function (el) { el.classList.add('is-in'); }); return; }
    var io = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } }); }, { rootMargin: '0px 0px -8% 0px', threshold: .08 });
    items.forEach(function (el) { io.observe(el); });
  })();

  /* ---------- конструктор ---------- */
  var stageSvg = $('#stageBed');
  var bed = new window.BedDraw(stageSvg, { prefix: 'st' });
  var cfg = { model: 'kolonna', fabric: 'chenille', color: 'pudrovyy', size: 160, lift: 0, legs: 'pad', mattress: 0 };
  var robotTween = null, liftTween = null;
  var priceObj = { v: 110000 };
  var priceBig = $('#priceBig'), priceSum = $('#priceSum'), sumMatt = $('#sumMatt'), sumList = $('#sumList'), chips = $('#chips'), colorCur = $('#colorCur');
  var stage = $('#stage'), stagePhoto = $('#stagePhoto'), stagePhotoImg = $('#stagePhotoImg'), stagePhotoName = $('#stagePhotoName');

  function price() { return PRICE[cfg.size][cfg.lift ? 1 : 0]; }
  function tweenState(obj, to, dur, ease, onUpd) {
    if (hasGsap && !reduce) return gsap.to(obj, Object.assign({ duration: dur, ease: ease || 'power2.inOut', overwrite: 'auto', onUpdate: onUpd }, to));
    for (var k in to) obj[k] = to[k]; onUpd(); return null;
  }
  function setFab(svg, hex, dur) { if (hasGsap && !reduce) gsap.to(svg, { '--fab': hex, duration: dur || .6, ease: 'power2.out', overwrite: 'auto' }); else svg.style.setProperty('--fab', hex); }
  function swapModel(b, svg, model, cb) {
    if (b.state.model === model) { if (cb) cb(); return; }
    if (hasGsap && !reduce) {
      gsap.to(b.gHead, { opacity: 0, y: -10, duration: .28, ease: 'power2.in', overwrite: true, onComplete: function () { b.set({ model: model }); if (cb) cb(); gsap.to(b.gHead, { opacity: 1, y: 0, duration: .55, ease: 'power3.out' }); } });
    } else { b.set({ model: model }); if (cb) cb(); }
  }
  function robot(b, on) {
    if (b._robot) { b._robot.kill(); b._robot = null; }
    if (!on || !hasGsap || reduce) { b.set({ robot: null }); return; }
    var o = { x: -70 };
    b._robot = gsap.to(o, { x: function () { return b.state.W + 70; }, duration: 2.8, ease: 'power1.inOut', repeat: -1, repeatDelay: 1.2, delay: .5, onUpdate: function () { b.set({ robot: o.x }); }, onRepeat: function () { o.x = -70; } });
  }
  function legsTo(b, kind, dur) {
    b.set({ legs: kind });
    tweenState(b.state, { legH: LEGH[kind] }, dur || .6, 'power2.inOut', function () { b.render(); });
    robot(b, kind === 'high');
  }
  function liftTo(b, val, dur, ease, then) {
    return tweenState(b.state, { lift: val }, dur, ease || 'power2.inOut', function () { b.render(); }) || (then && then());
  }
  function playLift(b) {
    if (liftTween) liftTween.kill();
    if (!hasGsap || reduce) { b.set({ lift: cfg.lift ? .16 : 0 }); return; }
    if (!cfg.lift) { liftTween = gsap.to(b.state, { lift: 0, duration: .8, ease: 'power2.inOut', onUpdate: function () { b.render(); } }); return; }
    liftTween = gsap.timeline()
      .to(b.state, { lift: 1, duration: 1.2, ease: 'power2.inOut', onUpdate: function () { b.render(); } })
      .to(b.state, { lift: .16, duration: .9, ease: 'power2.inOut', onUpdate: function () { b.render(); } }, '+=1.6');
  }

  function renderSummary() {
    var pr = price();
    if (hasGsap && !reduce) gsap.to(priceObj, { v: pr, duration: .7, ease: 'power2.out', overwrite: true, onUpdate: function () { priceBig.textContent = fmt(priceObj.v); priceSum.textContent = fmt(priceObj.v); } });
    else { priceObj.v = pr; priceBig.textContent = fmt(pr); priceSum.textContent = fmt(pr); }
    sumMatt.hidden = !cfg.mattress;
    var rows = [
      [t('sum.model'), t('model.' + cfg.model)],
      [t('sum.size'), cfg.size + 'x200'],
      [t('sum.lift'), cfg.lift ? t('yes') : t('no')],
      [t('sum.fabric'), t('fab.' + cfg.fabric) + ', ' + t('sum.color') + ': ' + t('color.' + cfg.color).toLowerCase()],
      [t('sum.legs'), t('legs.' + cfg.legs)],
      [t('sum.matt'), cfg.mattress ? t('matt.need') : t('matt.noneed')]
    ];
    sumList.innerHTML = rows.map(function (r) { return '<li>' + r[0] + ': <b>' + r[1] + '</b></li>'; }).join('');
    chips.innerHTML = '<li>' + t('model.' + cfg.model) + '</li><li><i style="--c:' + COLORS[cfg.color] + '"></i>' + t('fab.' + cfg.fabric) + ' · ' + t('color.' + cfg.color).toLowerCase() + '</li><li>' + cfg.size + 'x200</li>' +
      (cfg.lift ? '<li>' + t('lift.yes') + '</li>' : '') + '<li>' + t('legs.' + cfg.legs) + '</li>' + (cfg.mattress ? '<li>' + t('sum.matt') + ': ' + t('matt.need') + '</li>' : '');
    colorCur.textContent = t('color.' + cfg.color);
    $$('#ptable tbody tr').forEach(function (tr) { tr.classList.toggle('is-cur', +tr.dataset.size === cfg.size); });
  }
  function setPhoto(model) {
    if (!stagePhoto) return;
    var ph = PHOTOS[model];
    if (stagePhotoImg.getAttribute('src') !== ph.src) { stagePhotoImg.style.opacity = 0; stagePhotoImg.onload = function () { stagePhotoImg.style.transition = 'opacity .4s'; stagePhotoImg.style.opacity = 1; }; stagePhotoImg.setAttribute('src', ph.src); }
    stagePhotoImg.alt = t('model.' + model);
    stagePhoto.style.setProperty('--pos', ph.pos); stagePhoto.style.setProperty('--rot', ph.rot); stagePhoto.style.setProperty('--zoom', ph.zoom);
  }
  function applyAll() {
    bed.set({ model: cfg.model, W: cfg.size, lift: cfg.lift ? .16 : 0, legs: cfg.legs, legH: LEGH[cfg.legs], matt: !!cfg.mattress });
    stageSvg.style.setProperty('--fab', COLORS[cfg.color]);
    stageSvg.classList.toggle('vel', cfg.fabric === 'velour'); stageSvg.classList.toggle('che', cfg.fabric !== 'velour');
    robot(bed, cfg.legs === 'high');
    setPhoto(cfg.model); renderSummary();
  }
  function onChange(name, value) {
    switch (name) {
      case 'model': cfg.model = value; swapModel(bed, stageSvg, value); setPhoto(value); break;
      case 'fabric': cfg.fabric = value; stageSvg.classList.toggle('vel', value === 'velour'); stageSvg.classList.toggle('che', value !== 'velour'); break;
      case 'color': cfg.color = value; setFab(stageSvg, COLORS[value]); break;
      case 'size': cfg.size = +value; tweenState(bed.state, { W: cfg.size }, .8, 'power3.inOut', function () { bed.render(); }); break;
      case 'lift': cfg.lift = +value; playLift(bed); break;
      case 'legs': cfg.legs = value; legsTo(bed, value); break;
      case 'mattress': cfg.mattress = +value; bed.set({ matt: !!cfg.mattress }); break;
    }
    renderSummary();
  }
  $$('.steps input[type=radio]').forEach(function (inp) {
    inp.addEventListener('change', function () { if (inp.checked) onChange(inp.name, inp.value); });
  });
  // повторный клик по уже выбранному механизму - показать подъём ещё раз
  $$('.steps input[name=lift]').forEach(function (inp) {
    inp.closest('label').addEventListener('click', function () { if (inp.checked && inp.value === '1') playLift(bed); });
  });
  // вид: рисунок / фото
  $$('.seg-b').forEach(function (b) {
    b.addEventListener('click', function () {
      $$('.seg-b').forEach(function (x) { x.classList.toggle('is-on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
      stage.classList.toggle('view-photo', b.dataset.view === 'photo');
    });
  });
  function pick(model, scroll) {
    var inp = $('.steps input[name=model][value="' + model + '"]');
    if (inp && !inp.checked) { inp.checked = true; onChange('model', model); }
    if (scroll) scrollTo('#konstruktor');
  }
  $$('[data-pick]').forEach(function (b) { b.addEventListener('click', function () { pick(b.dataset.pick, true); }); });
  window.addEventListener('load', function () { var h = location.hash.replace('#', ''); if (PHOTOS[h]) pick(h, false); });
  applyAll();

  /* ---------- форма -> WhatsApp ---------- */
  var form = $('#zayavka');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = $('#fName').value.trim(), phone = $('#fPhone').value.trim(), comment = $('#fComment').value.trim();
    var lines = [
      r('wa.hello'),
      r('sum.model') + ': ' + r('model.' + cfg.model),
      r('sum.size') + ': ' + cfg.size + 'x200',
      r('sum.lift') + ': ' + (cfg.lift ? r('yes') : r('no')),
      r('sum.fabric') + ': ' + r('fab.' + cfg.fabric) + ', ' + r('sum.color') + ': ' + r('color.' + cfg.color).toLowerCase(),
      r('sum.legs') + ': ' + r('legs.' + cfg.legs),
      r('sum.matt') + ': ' + (cfg.mattress ? r('matt.need') : r('matt.noneed')),
      r('wa.calc') + ': ' + fmt(price()).replace(/ /g, ' ') + (cfg.mattress ? ' (+ ' + r('wa.matt') + ')' : ''),
      r('wa.name') + ': ' + name + ', ' + r('wa.phone') + ': ' + phone
    ];
    if (comment) lines.push(r('wa.comment') + ': ' + comment);
    window.open('https://wa.me/77012320989?text=' + encodeURIComponent(lines.join('\n')), '_blank');
  });

  /* ---------- карточки моделей ---------- */
  $$('.mcard-bed').forEach(function (svg, i) {
    var b = new window.BedDraw(svg, { prefix: 'mc' + i });
    b.set({ model: svg.dataset.bed, W: 160, dims: false });
    var card = svg.closest('.mcard');
    card.addEventListener('mouseenter', function () { liftTo(b, 1, 1.1); });
    card.addEventListener('mouseleave', function () { liftTo(b, 0, .8); });
  });

  /* ---------- таблица цен: рисунок меняет размер под курсором ---------- */
  (function () {
    var svg = $('#priceBed'); if (!svg) return;
    var b = new window.BedDraw(svg, { prefix: 'pr' });
    b.set({ model: 'ekran', W: 160 });
    $$('#ptable tbody tr').forEach(function (tr) {
      tr.addEventListener('mouseenter', function () { tweenState(b.state, { W: +tr.dataset.size }, .6, 'power3.out', function () { b.render(); }); });
      tr.addEventListener('click', function () {
        var inp = $('.steps input[name=size][value="' + tr.dataset.size + '"]');
        if (inp && !inp.checked) { inp.checked = true; onChange('size', tr.dataset.size); }
        scrollTo('#konstruktor');
      });
      $$('td', tr).forEach(function (td, ci) { td.addEventListener('mouseenter', function () { liftTo(b, ci === 2 ? 1 : 0, .9); }); });
    });
    svg.closest('.ptable-side'); $('#ptable').addEventListener('mouseleave', function () { liftTo(b, 0, .8); });
  })();

  /* ---------- лента работ ---------- */
  (function () {
    var strip = $('#strip'), prev = $('#wPrev'), next = $('#wNext'); if (!strip) return;
    function step() { var c = strip.firstElementChild; return c.getBoundingClientRect().width + parseFloat(getComputedStyle(strip).gap || 20); }
    function upd() {
      var max = strip.scrollWidth - strip.clientWidth - 2;
      prev.disabled = strip.scrollLeft <= 2; next.disabled = strip.scrollLeft >= max;
      var fits = strip.scrollWidth <= strip.clientWidth + 2; prev.hidden = fits; next.hidden = fits;
    }
    prev.addEventListener('click', function () { strip.scrollBy({ left: -step(), behavior: 'smooth' }); });
    next.addEventListener('click', function () { strip.scrollBy({ left: step(), behavior: 'smooth' }); });
    strip.addEventListener('scroll', upd, { passive: true }); window.addEventListener('resize', upd); upd();
    strip.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight') { e.preventDefault(); next.click(); } if (e.key === 'ArrowLeft') { e.preventDefault(); prev.click(); } });
  })();

  /* ---------- герой: комната и сборка кровати ---------- */
  (function () {
    var g = $('#heroBed'), scene = $('#sceneSvg'); if (!g) return;
    var hb = new window.BedDraw(g, { prefix: 'hero', scene: true });
    hb.set({ model: 'kolonna', W: 160, dims: false });
    g.style.setProperty('--fab', reduce ? '#D9A5A0' : '#CFC8BD');
    g.classList.add('bed');
    var tag = $('#heroTag');
    // десктоп: комната прижата к правому краю и полу, кровать (от x=600) всегда правее текста
    function textRight() {
      var r = 0;
      $$('.hero-in > *').forEach(function (el) {
        var rg = document.createRange(); rg.selectNodeContents(el);
        Array.prototype.forEach.call(rg.getClientRects(), function (b) { if (b.width) r = Math.max(r, b.right); });
      });
      return r;
    }
    function mobileBox() {
      var narrow = window.innerWidth < 760;
      if (narrow) {
        scene.setAttribute('viewBox', '590 160 820 640');
        scene.setAttribute('preserveAspectRatio', 'xMidYMax slice');
        return;
      }
      var W = scene.clientWidth, H = scene.clientHeight; if (!W || !H) return;
      var s = Math.min(H / 800, (W - textRight() - 24) / 780);
      s = Math.max(s, 0.45);
      var vw = W / s, vh = H / s;
      scene.setAttribute('viewBox', (1440 - vw) + ' ' + (800 - vh) + ' ' + vw + ' ' + vh);
      scene.setAttribute('preserveAspectRatio', 'none');
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(mobileBox);
    mobileBox(); window.addEventListener('resize', mobileBox);
    if (!hasGsap || reduce) { tag.style.opacity = 1; tag.style.transform = 'none'; return; }

    // заголовок построчно
    try {
      if (window.SplitText) {
        gsap.registerPlugin(SplitText);
        var split = SplitText.create('#h1', { type: 'lines', mask: 'lines', autoSplit: true });
        gsap.from(split.lines, { yPercent: 110, duration: 1.1, ease: 'power4.out', stagger: .09, delay: .2 });
      }
    } catch (err) { /* без SplitText заголовок просто стоит */ }
    gsap.from('.hero .kicker', { opacity: 0, y: 10, duration: .8, delay: .1 });
    gsap.from('.hero .lead, .hero-cta, .hero .ig-link', { opacity: 0, y: 18, duration: .9, ease: 'power3.out', stagger: .1, delay: .6 });

    // сборка: изголовье падает, царга въезжает, основание с матрасом опускается, опоры, цвет
    gsap.set(hb.gHead, { y: -260, opacity: 0 });
    gsap.set(hb.gBase, { x: -420, opacity: 0 });
    gsap.set(hb.gLid, { y: -220, opacity: 0 });
    gsap.set([hb.gLegs, hb.gShadow], { opacity: 0 });
    gsap.set('#scWall', { opacity: 0 }); gsap.set('#scFloor', { opacity: 0, y: 30 }); gsap.set('#scFg', { opacity: 0 });
    var intro = gsap.timeline({ defaults: { ease: 'power3.out' } });
    intro.to('#scWall', { opacity: 1, duration: .9 }, 0)
      .to('#scFloor', { opacity: 1, y: 0, duration: .9 }, .15)
      .to('#scFg', { opacity: 1, duration: .9 }, .4)
      .to(hb.gShadow, { opacity: 1, duration: .6 }, .9)
      .to(hb.gHead, { y: 0, opacity: 1, duration: 1.0, ease: 'back.out(1.1)' }, .6)
      .to(hb.gBase, { x: 0, opacity: 1, duration: .9, ease: 'power3.out' }, 1.1)
      .to(hb.gLegs, { opacity: 1, duration: .4 }, 1.6)
      .to(hb.gLid, { y: 0, opacity: 1, duration: .8, ease: 'power2.in' }, 1.5)
      .to(hb.root, { y: 3, duration: .1, yoyo: true, repeat: 1, ease: 'power1.inOut' }, 2.3)
      .to(g, { '--fab': '#D9A5A0', duration: 1.1, ease: 'power2.inOut' }, 2.4)
      .to(tag, { opacity: 1, y: 0, duration: .7, ease: 'power3.out' }, 3.0);

    // демо-цикл: механизм, другая модель и цвет, другой размер, высокие ножки и робот
    var seq = [
      { model: 'ekran', color: '#D9C7AC', W: 180, legs: 'leg' },
      { model: 'dvoynoy-ekran', color: '#EFE6D6', W: 200, legs: 'high' },
      { model: 'klassika', color: '#B99A7A', W: 140, legs: 'pad' },
      { model: 'kolonna-soft', color: '#6E2434', W: 160, legs: 'high' },
      { model: 'kolonna', color: '#D9A5A0', W: 160, legs: 'leg' }
    ];
    var si = 0, demo = null, visible = true;
    function r() { hb.render(); }
    function cycle() {
      var s = seq[si]; si = (si + 1) % seq.length;
      demo = gsap.timeline({ onComplete: cycle, defaults: { ease: 'power2.inOut' } });
      demo.to(hb.state, { lift: 1, duration: 1.3, onUpdate: r })
        .to(hb.state, { lift: 0, duration: 1.0, onUpdate: r }, '+=1.5')
        .to(hb.gHead, { opacity: 0, y: -14, duration: .3, ease: 'power2.in' }, '+=.6')
        .add(function () { hb.set({ model: s.model }); gsap.to(g, { '--fab': s.color, duration: .9, ease: 'power2.inOut' }); })
        .to(hb.gHead, { opacity: 1, y: 0, duration: .6, ease: 'power3.out' })
        .to(hb.state, { W: s.W, duration: 1.1, ease: 'power3.inOut', onUpdate: r }, '+=.4')
        .add(function () { hb.set({ legs: s.legs }); }, '+=.5')
        .to(hb.state, { legH: LEGH[s.legs], duration: .7, onUpdate: r });
      if (s.legs === 'high') {
        var o = { x: -70 };
        demo.to(o, { x: s.W + 70, duration: 2.6, ease: 'power1.inOut', onUpdate: function () { hb.set({ robot: o.x }); }, onComplete: function () { hb.set({ robot: null }); } }, '+=.2');
      }
      demo.to({}, { duration: .8 });
    }
    intro.add(cycle, '+=1.2');

    // тихая жизнь сцены
    gsap.to('#scGlow', { opacity: .55, duration: 3.2, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    gsap.to('#scGlow', { opacity: .7, duration: 2.4, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    gsap.to('#scClouds', { x: 26, duration: 14, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    gsap.to('#scSheer', { scaleX: 1.06, transformOrigin: '1010px 0px', duration: 4.5, yoyo: true, repeat: -1, ease: 'sine.inOut' });

    // параллакс мышью (десктоп) и по прокрутке
    if (window.matchMedia('(hover:hover) and (min-width:900px)').matches) {
      var qx = {}, qy = {};
      [['#scWall', 6], ['#scFloor', 10], ['#scBedL', 14], ['#scFg', 26]].forEach(function (l) {
        qx[l[0]] = gsap.quickTo(l[0], 'x', { duration: 1.2, ease: 'power3.out' });
        qy[l[0]] = gsap.quickTo(l[0], 'y', { duration: 1.2, ease: 'power3.out' });
        $(l[0]).dataset.amp = l[1];
      });
      $('.hero').addEventListener('mousemove', function (e) {
        var nx = (e.clientX / window.innerWidth - .5), ny = (e.clientY / window.innerHeight - .5);
        for (var k in qx) { var amp = +$(k).dataset.amp; qx[k](-nx * amp); qy[k](-ny * amp * .6); }
      });
    }
    if (window.ScrollTrigger) {
      gsap.to('#scene', { y: 140, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
      gsap.to('.hero-in', { y: -60, opacity: 0, ease: 'none', scrollTrigger: { trigger: '.hero', start: '40% top', end: 'bottom top', scrub: true } });
      ScrollTrigger.create({ trigger: '.hero', start: 'top bottom', end: 'bottom top', onToggle: function (st) { visible = st.isActive; if (demo) { visible ? demo.play() : demo.pause(); } } });
    }
  })();

  /* ---------- язык: RU в разметке, KZ - словарь по клику ---------- */
  (function () {
    var nodes = $$('[data-i18n]');
    nodes.forEach(function (el) { el.dataset.ru = el.tagName === 'META' ? el.getAttribute('content') : el.innerHTML; });
    function apply(l) {
      var kk = window.SITE_KK || {};
      document.documentElement.lang = l;
      nodes.forEach(function (el) {
        var k = el.dataset.i18n, v = l === 'kk' ? kk[k] : null;
        if (el.tagName === 'META') el.setAttribute('content', v || el.dataset.ru);
        else el.innerHTML = v || el.dataset.ru;
      });
      $$('.lang-b').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.lang === l)); });
      try { localStorage.setItem('lang', l); } catch (err) {}
      renderSummary();
    }
    function setLang(l) {
      if (l === 'kk' && !window.SITE_KK) {
        var me = document.currentScript || $('script[src^="script.js"]');
        var v = me && /v=([\w-]+)/.exec(me.getAttribute('src') || '');
        var s = document.createElement('script');
        s.src = 'assets/lang/kk.js' + (v ? '?v=' + v[1] : '');
        s.onload = function () { apply('kk'); };
        document.head.appendChild(s);
        return;
      }
      apply(l);
    }
    $$('.lang-b').forEach(function (b) { b.addEventListener('click', function () { setLang(b.dataset.lang); }); });
    var q = /[?&]lang=(ru|kk)/.exec(location.search), saved = null;
    try { saved = localStorage.getItem('lang'); } catch (err) {}
    var init = q ? q[1] : saved;
    if (init === 'kk') setLang('kk');
  })();
})();
