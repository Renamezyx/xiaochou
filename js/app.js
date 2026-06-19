/**
 * birthday-v3 · 两幕：Screen1 状态机 + Screen2 线性流程
 * Zepto 仅用于 document ready；逻辑为原生 DOM（CDN 失败仍可运行）
 */
(function () {
  "use strict";

  var LETTER =
    "嗨，小仇\n\n" +
    "如果你看到这里，说明你配合我的演出已经结束啦。\n\n" +
    "希望新的一岁，能有更多开心的小事悄悄发生，也希望你偶尔累了的时候，别忘了停下来休息一下。\n\n" +
    "愿你喜欢的人和事都有回应，然后，继续做那个闪闪发光的自己。\n\n" +
    "生日快乐呀 🎂"

  /** 礼物屏照片：填本地路径如 "assets/gift-1.jpg"；src 留空则显示柔和占位图 */
  var GIFT_PHOTOS = [
    { src: "source/img/first_outline.jpg", caption: "第一印象，新衣服的第一观众（以后还有没有机会啊）" },

    { src: "source/img/you_sent_me_1.jpg", caption: "虽然与我无瓜 但也是分享给我的就是我的了" },
    
    { src: "source/img/you_sent_me_2.jpg", caption: "这张也是" },
    
    { src: "source/img/first_meet.jpg", caption: "第一次见面，没记录你的 哈哈 拿你拍的我的凑合下了" },
    
    { src: "source/img/movie_ticket.jpg", caption: "一起看过的电影" },
    
    { src: "source/img/budding_flower.jpg", caption: "睡眠治愈大师的奖品" },
    
    { src: "source/img/bloom_flower.jpg", caption: "居然真的养开了，真的有点感动的" },
    
    { src: "source/img/chat_checkin.jpg", caption: "日常打卡式聊天, 哈哈" }
  ];

  /** 相册到头 / 到尾再点时展示的俏皮提示 */
  var GIFT_PAGER_EDGE_MSG =
    "回忆库存快见底啦 😤 该去补充一点新的了，哼！";

  /** 默认背景音乐路径；切歌时把新路径传给 playBgmFromUser(src) */
  var BGM_DEFAULT_SRC = "source/mp3/生日快乐.mp3";

  /** 进入 Act II「小问答」面板时切换的 BGM；留空则不自动切歌 */
  var BGM_QUIZ_SRC = "source/mp3/朋友.mp3";

  /** 进入「刮刮乐」面板时切换的 BGM；留空则不自动切歌 */
  var BGM_SCRATCH_SRC = "source/mp3/你是我的女朋友.mp3";

  /** 结束时播放的 BGM；留空则不自动切歌 */
  var BGM_END_SRC = "source/mp3/多幸运.mp3";

  var QUIZ = [
    {
      q: "今天开心吗？",
      opts: ["开心", "很开心", "超级开心", "超级无敌开心"],
      err_tips: "开心要多一点哦！"
    },
    {
      q: "和我聊天是不是挺有意思的",
      opts: ["鸡同鸭讲", "差点意思", "一般般", "超有意思了"],
      err_tips: "喔↑ 再给你次机会"
    },
    {
      q: "看到这里，有没有发现有人挺用心",
      opts: ["没发现", "难说", "一点点", "不止一点点"],
      err_tips: "哼 没选到正确答案就一直选"
    }
  ];

  var phase = "enter";
  var quizIdx = 0;
  var scratchReady = false;
  var candleTimers = [];
  var blowSeqTimers = [];
  var giftPagerIndex = 0;
  var giftToastTimer = null;
  var micHoldTimer = null;
  var letterRevealTimer = null;

  function $(id) {
    return document.getElementById(id);
  }

  function haptic(ms) {
    if (navigator.vibrate) navigator.vibrate(ms || 10);
  }

  function setHidden(el, on) {
    if (!el) return;
    if (on) el.setAttribute("hidden", "hidden");
    else el.removeAttribute("hidden");
  }

  function clearBlowSeqTimers() {
    blowSeqTimers.forEach(function (t) {
      clearTimeout(t);
    });
    blowSeqTimers = [];
  }

  function resetCandleBlowState() {
    document.querySelectorAll(".cake__candles .candle").forEach(function (c) {
      c.classList.remove("is-out");
    });
  }

  function resetBlowFollowup() {
    var s1 = $("screen1");
    if (s1) s1.classList.remove("s1--blow");
    clearBlowSeqTimers();
    resetCandleBlowState();
    var m = $("s1BlowMsg");
    if (m) {
      m.setAttribute("hidden", "hidden");
      m.classList.remove("is-visible");
    }
  }

  function showS1Panel(name) {
    document.querySelectorAll(".s1-panel").forEach(function (p) {
      var show = p.getAttribute("data-show");
      if (show === name) {
        p.classList.remove("s1-panel--copy-out", "s1-panel--copy-done");
        setHidden(p, false);
        if (name === "cake") resetBlowFollowup();
      } else {
        setHidden(p, true);
      }
    });
  }

  function getS1Panel(name) {
    return document.querySelector('.s1-panel[data-show="' + name + '"]');
  }

  function concealS1CopyThen(name, done) {
    var p = getS1Panel(name);
    if (!p) {
      if (done) done();
      return;
    }
    p.classList.add("s1-panel--copy-out");
    window.setTimeout(function () {
      if (done) done();
    }, 460);
  }

  function setPhase(next) {
    phase = next;
    $("screen1").setAttribute("data-phase", next);
  }

  function fillFw() {
    var fw = $("s1-fw");
    if (!fw || fw.children.length) return;
    for (var i = 0; i < 4; i++) {
      fw.appendChild(document.createElement("span"));
    }
  }

  function ordinalEn(n) {
    var j = n % 10;
    var k = n % 100;
    if (k >= 11 && k <= 13) return "TH";
    if (j === 1) return "ST";
    if (j === 2) return "ND";
    if (j === 3) return "RD";
    return "TH";
  }

  function makePhotoPlaceholder(caption, tone) {
    var d = document.createElement("div");
    d.className = "gift-photo__ph";
    d.style.setProperty("--tone", String(tone % 4));
    d.setAttribute("role", "img");
    d.setAttribute(
      "aria-label",
      caption ? "占位图：" + caption : "待替换的照片占位"
    );
    return d;
  }

  function makeGiftBoxButton() {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "gift-box";
    btn.setAttribute("aria-label", "拆开礼盒，打开信件");
    var lid = document.createElement("span");
    lid.className = "gift-box__lid";
    lid.setAttribute("aria-hidden", "true");
    var base = document.createElement("span");
    base.className = "gift-box__base";
    base.setAttribute("aria-hidden", "true");
    var rib = document.createElement("span");
    rib.className = "gift-box__ribbon";
    rib.setAttribute("aria-hidden", "true");
    var tag = document.createElement("span");
    tag.className = "gift-box__tag";
    tag.textContent = "拆开看看";
    btn.appendChild(lid);
    btn.appendChild(base);
    btn.appendChild(rib);
    btn.appendChild(tag);
    btn.addEventListener("click", openGiftLetter);
    return btn;
  }

  function showGiftPagerSlide(idx) {
    var pager = $("giftPager");
    var nextBtn = $("giftPagerNext");
    var prevBtn = $("giftPagerPrev");
    if (!pager) return;
    var slides = pager.querySelectorAll(".gift-slide");
    var n = slides.length;
    if (n === 0) return;
    idx = Math.max(0, Math.min(idx, n - 1));
    giftPagerIndex = idx;
    slides.forEach(function (s, j) {
      s.classList.toggle("is-active", j === idx);
    });
    if (prevBtn) {
      setHidden(prevBtn, false);
      prevBtn.textContent =
        idx > 0 ? "上一页（" + idx + " / " + n + "）" : "上一页";
    }
    if (nextBtn) {
      setHidden(nextBtn, false);
      nextBtn.textContent =
        idx < n - 1 ? "下一张（" + (idx + 2) + " / " + n + "）" : "下一张";
    }
    var active = slides[idx];
    if (active && active.classList.contains("gift-slide--last")) {
      active.scrollTop = 0;
    }
    var s2 = $("screen2");
    if (s2) s2.scrollTop = 0;
  }

  function showGiftPagerToast(msg) {
    var el = $("giftToast");
    if (!el) return;
    el.textContent = msg;
    if (giftToastTimer) {
      clearTimeout(giftToastTimer);
      giftToastTimer = null;
    }
    setHidden(el, false);
    void el.offsetWidth;
    el.classList.add("is-visible");
    giftToastTimer = window.setTimeout(function () {
      giftToastTimer = null;
      el.classList.remove("is-visible");
      window.setTimeout(function () {
        setHidden(el, true);
      }, 320);
    }, 3000);
  }

  function renderGiftGallery() {
    var pager = $("giftPager");
    if (!pager || pager.getAttribute("data-filled") === "1") return;
    pager.setAttribute("data-filled", "1");
    var list = GIFT_PHOTOS.length ? GIFT_PHOTOS : [{ src: "", caption: "在 GIFT_PHOTOS 里添加照片" }];
    var n = list.length;

    function buildFigure(p, i) {
      var fig = document.createElement("figure");
      fig.className = "gift-photo";
      if (p.src) {
        var im = document.createElement("img");
        im.src = p.src;
        im.alt = p.alt || p.caption || "回忆 " + (i + 1);
        im.loading = "lazy";
        im.decoding = "async";
        im.onerror = function () {
          im.replaceWith(makePhotoPlaceholder(p.caption, i));
        };
        fig.appendChild(im);
      } else {
        fig.appendChild(makePhotoPlaceholder(p.caption, i));
      }
      if (p.caption) {
        var cap = document.createElement("figcaption");
        cap.className = "gift-photo__cap";
        cap.textContent = p.caption;
        fig.appendChild(cap);
      }
      return fig;
    }

    for (var i = 0; i < n; i++) {
      var slide = document.createElement("section");
      slide.className = "gift-slide gift-slide--f" + ((i % 3) + 1);
      slide.setAttribute("data-slide", String(i));
      slide.appendChild(buildFigure(list[i], i));
      pager.appendChild(slide);
    }
    var giftSlide = document.createElement("section");
    giftSlide.className = "gift-slide gift-slide--gift gift-slide--last";
    giftSlide.setAttribute("data-slide", String(n));
    var giftFig = document.createElement("figure");
    giftFig.className = "gift-photo gift-photo--gift";
    giftFig.appendChild(makeGiftBoxButton());
    var giftCap = document.createElement("figcaption");
    giftCap.className = "gift-photo__cap";
    giftCap.textContent = "拆开彩蛋看看是个啥 (os:不会是ipad, 口红, iphone, 花束吧 那也太不好意思啦)";
    giftFig.appendChild(giftCap);
    giftSlide.appendChild(giftFig);
    pager.appendChild(giftSlide);

    showGiftPagerSlide(0);
  }

  function clearLetterReveal() {
    if (letterRevealTimer !== null) {
      clearTimeout(letterRevealTimer);
      letterRevealTimer = null;
    }
  }

  /** 按信纸区实际宽度测量全文排版高度，用于先固定信纸占位再逐字显现 */
  function measureLetterPaperHeight(text, widthPx) {
    var w = Math.max(200, Math.floor(widthPx));
    var probe = document.createElement("div");
    probe.className = "letter-fold__inner";
    probe.setAttribute("aria-hidden", "true");
    probe.style.boxSizing = "border-box";
    probe.style.visibility = "hidden";
    probe.style.position = "absolute";
    probe.style.left = "-9999px";
    probe.style.top = "0";
    probe.style.width = w + "px";
    probe.textContent = text;
    document.body.appendChild(probe);
    var h = Math.ceil(probe.getBoundingClientRect().height);
    document.body.removeChild(probe);
    return h;
  }

  /** 信件正文逐字显现；标点、换行略加长停顿 */
  function startLetterTypewriter(el, text, onComplete) {
    clearLetterReveal();
    if (!el) {
      if (onComplete) onComplete();
      return;
    }
    el.textContent = "";
    var i = 0;
    var len = text.length;
    var baseMs = 44;
    function pauseAfter(ch) {
      if (ch === "\n") return 130;
      if (/[，。、；：！？…—]/.test(ch)) return 70;
      return 0;
    }
    function step() {
      if (i >= len) {
        letterRevealTimer = null;
        if (onComplete) onComplete();
        return;
      }
      i += 1;
      el.textContent = text.slice(0, i);
      var ch = text.charAt(i - 1);
      letterRevealTimer = window.setTimeout(step, baseMs + pauseAfter(ch));
    }
    letterRevealTimer = window.setTimeout(step, 200);
  }

  function resetGiftScreen() {
    setHidden($("giftGallery"), false);
    setHidden($("giftLetterBlock"), true);
    var s2 = $("screen2");
    if (s2) {
      s2.classList.add("s2--gift-gallery");
      s2.scrollTop = 0;
    }
    var sc = $("giftScroll");
    if (sc) sc.scrollTop = 0;
    if (giftToastTimer) {
      clearTimeout(giftToastTimer);
      giftToastTimer = null;
    }
    var gToast = $("giftToast");
    if (gToast) {
      gToast.classList.remove("is-visible");
      setHidden(gToast, true);
    }
    showGiftPagerSlide(0);
    var env = $("btnEnvelope");
    if (env) {
      env.setAttribute("data-open", "0");
      env.classList.remove("is-open");
    }
    var fold = $("letterFold");
    if (fold) {
      fold.setAttribute("hidden", "hidden");
      fold.classList.remove("is-open");
    }
    var inner = $("letterInner");
    clearLetterReveal();
    if (inner) {
      inner.textContent = "";
      inner.style.minHeight = "";
    }
    setHidden($("btnAfterLetter"), true);
    var afterLetter = $("btnAfterLetter");
    if (afterLetter) afterLetter.disabled = true;
  }

  function openGiftLetter() {
    if (giftToastTimer) {
      clearTimeout(giftToastTimer);
      giftToastTimer = null;
    }
    var gToast = $("giftToast");
    if (gToast) {
      gToast.classList.remove("is-visible");
      setHidden(gToast, true);
    }
    setHidden($("giftGallery"), true);
    setHidden($("giftLetterBlock"), false);
    var s2 = $("screen2");
    if (s2) {
      s2.classList.remove("s2--gift-gallery");
      s2.scrollTop = 0;
    }
    var afterLetter = $("btnAfterLetter");
    if (afterLetter) {
      setHidden(afterLetter, false);
      afterLetter.disabled = true;
    }
    haptic(14);
  }

  function applyCakeAge() {
    var cake = $("cake");
    var numEl = $("cakeAgeNum");
    var thEl = $("cakeAgeTh");
    if (!cake || !numEl || !thEl) return;
    var raw = cake.getAttribute("data-age");
    var n = parseInt(raw, 10);
    if (!isFinite(n) || n < 1) n = 25;
    if (n > 130) n = 130;
    numEl.textContent = String(n);
    thEl.textContent = ordinalEn(n);
    var topper = $("cakeTopper");
    if (topper) topper.setAttribute("aria-label", n + " 岁生日");
  }

  function buildCandles() {
    var w = $("candles");
    if (!w || w.children.length) return;
    for (var i = 0; i < 7; i++) {
      var c = document.createElement("div");
      c.className = "candle";
      var smoke = document.createElement("span");
      smoke.className = "candle__smoke";
      smoke.setAttribute("aria-hidden", "true");
      c.appendChild(smoke);
      var f = document.createElement("span");
      f.className = "candle__flame";
      c.appendChild(f);
      w.appendChild(c);
    }
  }

  function clearCandleTimers() {
    candleTimers.forEach(function (t) {
      clearTimeout(t);
    });
    candleTimers = [];
  }

  function runCandleStagger() {
    clearCandleTimers();
    var nodes = document.querySelectorAll(".cake__candles .candle");
    nodes.forEach(function (c) {
      c.classList.remove("is-out", "is-lit");
    });
    nodes.forEach(function (c, i) {
      candleTimers.push(
        setTimeout(function () {
          c.classList.add("is-lit");
          haptic(6);
        }, 400 + i * 320)
      );
    });
    /* 蛋糕页标题/说明保留到许愿弹窗点「好了」后，由 goBlowThenS2 的 s1-panel--copy-out 退场，不在点蜡烛阶段提前 copy-done */
  }

  /**
   * 在用户手势下播放 #bgm；可换源实现切歌。
   * @param {string} [src] 不传或空白：不换源，仅对当前曲目 play（适合继续播 / 恢复播放）。
   * @returns {Promise<void>}
   */
  function playBgmFromUser(src) {
    var audio = $("bgm");
    var fab = $("musicFab");
    if (!audio) return Promise.resolve();
    if (src != null && String(src).trim() !== "") {
      var url = String(src).trim();
      audio.pause();
      while (audio.firstChild) {
        audio.removeChild(audio.firstChild);
      }
      audio.removeAttribute("src");
      audio.src = url;
      audio.load();
    }
    return audio.play().then(
      function () {
        if (fab) fab.setAttribute("aria-pressed", "true");
      },
      function () { }
    );
  }

  function bindMusic() {
    var fab = $("musicFab");
    var audio = $("bgm");
    if (!fab || !audio) return;
    fab.addEventListener("click", function () {
      if (audio.paused) {
        playBgmFromUser().then(
          function () {
            haptic(8);
          },
          function () {
            /* 无音频文件时静默失败 */
          }
        );
      } else {
        audio.pause();
        fab.setAttribute("aria-pressed", "false");
      }
    });
  }

  function afterTalentSequence() {
    var deco = $("s1-deco");
    fillFw();
    if (deco) {
      deco.classList.add("is-on");
      requestAnimationFrame(function () {
        deco.classList.add("burst");
      });
      setTimeout(function () {
        deco.classList.remove("burst");
      }, 1200);
    }
    setTimeout(function () {
      setHidden($("musicFab"), false);
    }, 1400);
    setTimeout(function () {
      setPhase("post_talent");
      showS1Panel("post_talent");
      haptic(12);
    }, 2800);
  }

  function openWishModal() {
    setHidden($("modalWish"), false);
    haptic(10);
  }

  function closeWishModal() {
    setHidden($("modalWish"), true);
  }

  function goBlowThenS2() {
    closeWishModal();
    clearBlowSeqTimers();
    var cakeP = getS1Panel("cake");
    if (cakeP) cakeP.classList.add("s1-panel--copy-out");
    var s1 = $("screen1");
    var blowMsg = $("s1BlowMsg");
    if (blowMsg) {
      blowMsg.setAttribute("hidden", "hidden");
      blowMsg.classList.remove("is-visible");
    }

    /* 许愿确认后先收「先许个愿…」文案，淡出结束再开始灭烛（与 concealS1CopyThen 约 460ms 对齐） */
    var COPY_OUT_ANIM_MS = 480;
    var BLOW_AT = COPY_OUT_ANIM_MS + 80;
    var candles = document.querySelectorAll(".cake__candles .candle");
    var n = candles.length || 7;
    var STAGGER_MS = 520;
    var FIRST_OUT_MS = 220;
    var lastOutStart = BLOW_AT + FIRST_OUT_MS + (n - 1) * STAGGER_MS;
    var lastFlameEndMs = lastOutStart + 480;
    var MSG_SHOW_AT = lastFlameEndMs + 260;
    var S2_AT = MSG_SHOW_AT + 3200;

    window.setTimeout(function () {
      if (s1) s1.classList.add("s1--blow");
      haptic(16);
      for (var i = 0; i < n; i++) {
        (function (idx) {
          var tid = window.setTimeout(function () {
            var cd = candles[idx];
            if (cd) {
              cd.classList.remove("is-lit");
              cd.classList.add("is-out");
            }
            haptic(5);
          }, FIRST_OUT_MS + idx * STAGGER_MS);
          blowSeqTimers.push(tid);
        })(i);
      }
    }, BLOW_AT);

    window.setTimeout(function () {
      if (!blowMsg) return;
      blowMsg.removeAttribute("hidden");
      window.requestAnimationFrame(function () {
        blowMsg.classList.add("is-visible");
        try {
          blowMsg.scrollIntoView({ behavior: "smooth", block: "nearest" });
        } catch (e) {
          blowMsg.scrollIntoView(false);
        }
      });
      haptic(12);
    }, MSG_SHOW_AT);

    window.setTimeout(function () {
      if (blowMsg) {
        blowMsg.setAttribute("hidden", "hidden");
        blowMsg.classList.remove("is-visible");
      }
      setHidden($("screen1"), true);
      setHidden($("screen2"), false);
      initS2Quiz();
      updateS2Dots(0);
    }, S2_AT);
  }

  function updateS2Dots(n) {
    var host = $("s2Dots");
    if (!host) return;
    host.innerHTML = "";
    for (var i = 0; i < 4; i++) {
      var d = document.createElement("span");
      if (i === n) d.classList.add("is-on");
      host.appendChild(d);
    }
  }

  function initS2Quiz() {
    quizIdx = 0;
    renderQuiz();
    var quizEl = $("s2Quiz");
    if (!quizEl) return;
    try {
      quizEl.dispatchEvent(
        new CustomEvent("birthday:s2-quiz-visible", { bubbles: true })
      );
    } catch (e) {
      try {
        var ev = document.createEvent("CustomEvent");
        ev.initCustomEvent("birthday:s2-quiz-visible", true, false);
        quizEl.dispatchEvent(ev);
      } catch (e2) {
        /* 忽略 */
      }
    }
  }

  function renderQuiz() {
    var q = QUIZ[quizIdx];
    if (!q) return;
    $("quizTitle").textContent = "小问答 · " + (quizIdx + 1) + " / " + QUIZ.length;
    $("quizDesc").textContent = q.q;
    var opts = $("quizOpts");
    opts.innerHTML = "";
    setHidden($("quizNext"), true);
    var nextBtn = $("quizNext");
    if (nextBtn) nextBtn.disabled = true;
    var errLine = $("quizErr");
    if (errLine) {
      errLine.textContent = "";
      setHidden(errLine, true);
    }
    var lastIdx = q.opts.length - 1;
    q.opts.forEach(function (text, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "s2-opt";
      b.textContent = text;
      b.addEventListener("click", function () {
        opts.querySelectorAll(".s2-opt").forEach(function (x) {
          x.classList.remove("is-on");
        });
        b.classList.add("is-on");
        if (i !== lastIdx) {
          if (errLine) {
            errLine.textContent = q.err_tips || "再选一次哦";
            setHidden(errLine, false);
          }
          setHidden($("quizNext"), true);
          if (nextBtn) nextBtn.disabled = true;
          haptic(4);
          return;
        }
        if (errLine) {
          errLine.textContent = "";
          setHidden(errLine, true);
        }
        setHidden($("quizNext"), false);
        if (nextBtn) nextBtn.disabled = false;
        haptic(6);
      });
      opts.appendChild(b);
    });
    $("quizNext").onclick = function () {
      if ($("quizNext").disabled) return;
      quizIdx++;
      if (quizIdx < QUIZ.length) {
        renderQuiz();
      } else {
        setHidden($("s2Quiz"), true);
        setHidden($("s2Scratch"), false);
        var scratchEl = $("s2Scratch");
        if (scratchEl) {
          try {
            scratchEl.dispatchEvent(
              new CustomEvent("birthday:s2-scratch-visible", { bubbles: true })
            );
          } catch (e) {
            try {
              var sev = document.createEvent("CustomEvent");
              sev.initCustomEvent("birthday:s2-scratch-visible", true, false);
              scratchEl.dispatchEvent(sev);
            } catch (e2) {
              /* 忽略 */
            }
          }
        }
        updateS2Dots(1);
        initScratch();
      }
    };
  }

  function initScratch() {
    if (scratchReady) return;
    var canvas = $("scratchCanvas");
    var wrap = $("scratchWrap");
    var nextBtn = $("btnScratchNext");
    if (!canvas || !wrap) return;
    var ctx = canvas.getContext("2d");
    var dpr = window.devicePixelRatio || 1;

    function size() {
      var w = wrap.clientWidth;
      var h = wrap.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      var g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#e4dcd4");
      g.addColorStop(1, "#cfc4bb");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    size();
    setTimeout(size, 120);
    scratchReady = true;
    var drawing = false;
    var last = 0;

    function ratio() {
      var id = ctx.getImageData(0, 0, canvas.width, canvas.height);
      var d = id.data;
      var step = 14;
      var t = 0,
        tr = 0;
      for (var y = 0; y < canvas.height; y += step) {
        for (var x = 0; x < canvas.width; x += step) {
          t++;
          if (d[(y * canvas.width + x) * 4 + 3] < 40) tr++;
        }
      }
      return t ? tr / t : 0;
    }

    function scratch(x, y) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(x, y, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      var now = Date.now();
      if (now - last > 260) {
        last = now;
        if (ratio() > 0.36 && nextBtn) nextBtn.disabled = false;
      }
    }

    function pos(ev) {
      var r = canvas.getBoundingClientRect();
      var t = ev.touches ? ev.touches[0] : ev;
      return { x: t.clientX - r.left, y: t.clientY - r.top };
    }

    canvas.addEventListener("touchstart", function (e) {
      drawing = true;
      e.preventDefault();
      var p = pos(e);
      scratch(p.x, p.y);
    });
    canvas.addEventListener("touchmove", function (e) {
      if (!drawing) return;
      e.preventDefault();
      var p = pos(e);
      scratch(p.x, p.y);
    });
    canvas.addEventListener("touchend", function () {
      drawing = false;
    });
    canvas.addEventListener("mousedown", function (e) {
      drawing = true;
      var p = pos(e);
      scratch(p.x, p.y);
    });
    canvas.addEventListener("mousemove", function (e) {
      if (!drawing || e.buttons !== 1) return;
      scratch(pos(e).x, pos(e).y);
    });
    canvas.addEventListener("mouseup", function () {
      drawing = false;
    });

    $("btnScratchNext").onclick = function () {
      setHidden($("s2Scratch"), true);
      resetGiftScreen();
      setHidden($("s2Gift"), false);
      updateS2Dots(2);
    };
  }

  function boot() {
    fillFw();
    applyCakeAge();
    buildCandles();
    renderGiftGallery();
    bindMusic();

    var quizPanel = $("s2Quiz");
    if (quizPanel) {
      quizPanel.addEventListener("birthday:s2-quiz-visible", function () {
        if (!BGM_QUIZ_SRC || !String(BGM_QUIZ_SRC).trim()) return;
        playBgmFromUser(String(BGM_QUIZ_SRC).trim()).catch(function () { });
      });
    }

    var scratchPanel = $("s2Scratch");
    var s2GiftPanel = $("s2Gift");
    if (scratchPanel || s2GiftPanel) {
      scratchPanel.addEventListener("birthday:s2-scratch-visible", function () {
        if (!BGM_SCRATCH_SRC || !String(BGM_SCRATCH_SRC).trim()) return;
        playBgmFromUser(String(BGM_SCRATCH_SRC).trim()).catch(function () { });
      });
    }

    var giftNext = $("giftPagerNext");
    var giftPrev = $("giftPagerPrev");
    if (giftNext) {
      giftNext.addEventListener("click", function () {
        var pg = $("giftPager");
        var slides = pg ? pg.querySelectorAll(".gift-slide") : [];
        var total = slides.length;
        if (total === 0) return;
        if (giftPagerIndex >= total - 1) {
          showGiftPagerToast(GIFT_PAGER_EDGE_MSG);
          haptic(6);
          return;
        }
        showGiftPagerSlide(giftPagerIndex + 1);
        haptic(10);
      });
    }
    if (giftPrev) {
      giftPrev.addEventListener("click", function () {
        var pg = $("giftPager");
        var slides = pg ? pg.querySelectorAll(".gift-slide") : [];
        if (slides.length === 0) return;
        if (giftPagerIndex <= 0) {
          showGiftPagerToast(GIFT_PAGER_EDGE_MSG);
          haptic(6);
          return;
        }
        showGiftPagerSlide(giftPagerIndex - 1);
        haptic(10);
      });
    }

    $("btnEnter").addEventListener("click", function () {
      haptic(14);
      concealS1CopyThen("enter", function () {
        setPhase("talent");
        showS1Panel("talent");
      });
    });

    $("btnTalent").addEventListener("click", function () {
      playBgmFromUser(BGM_DEFAULT_SRC);
      var bt = $("btnTalent");
      if (bt) bt.disabled = true;
      haptic(12);
      var tp = getS1Panel("talent");
      if (tp) tp.classList.add("s1-panel--copy-out");
      setPhase("talent_anim");
      afterTalentSequence();
    });

    $("btnMore").addEventListener("click", function () {
      haptic(12);
      concealS1CopyThen("post_talent", function () {
        clearCandleTimers();
        setPhase("cake");
        showS1Panel("cake");
        runCandleStagger();
      });
    });

    var micBtn = $("btnMic");
    var WISH_HOLD_MS = 1500;
    function clearMicHold() {
      if (micHoldTimer !== null) {
        clearTimeout(micHoldTimer);
        micHoldTimer = null;
      }
      if (micBtn) micBtn.classList.remove("is-pressing");
    }
    if (micBtn) {
      micBtn.addEventListener("pointerdown", function (e) {
        if (e.button !== 0 && e.pointerType === "mouse") return;
        var modal = $("modalWish");
        if (modal && !modal.hasAttribute("hidden")) return;
        clearMicHold();
        micBtn.classList.add("is-pressing");
        try {
          micBtn.setPointerCapture(e.pointerId);
        } catch (err) { }
        micHoldTimer = window.setTimeout(function () {
          micHoldTimer = null;
          micBtn.classList.remove("is-pressing");
          haptic(14);
          openWishModal();
        }, WISH_HOLD_MS);
        haptic(6);
      });
      micBtn.addEventListener("pointerup", function (e) {
        try {
          micBtn.releasePointerCapture(e.pointerId);
        } catch (err) { }
        if (micHoldTimer !== null) {
          clearMicHold();
          haptic(4);
        }
      });
      micBtn.addEventListener("pointercancel", function (e) {
        try {
          micBtn.releasePointerCapture(e.pointerId);
        } catch (err) { }
        clearMicHold();
      });
    }

    $("modalWishBack").addEventListener("click", closeWishModal);
    $("modalWishOk").addEventListener("click", goBlowThenS2);

    $("btnEnvelope").addEventListener("click", function () {
      var env = $("btnEnvelope");
      var fold = $("letterFold");
      var inner = $("letterInner");
      var block = $("giftLetterBlock");
      if (!env || env.getAttribute("data-open") === "1") return;
      env.setAttribute("data-open", "1");
      env.classList.add("is-open");
      var afterLetter = $("btnAfterLetter");
      if (afterLetter) {
        setHidden(afterLetter, false);
        afterLetter.disabled = false;
      }
      if (inner) {
        inner.textContent = "";
        inner.style.minHeight = "";
      }
      if (fold) {
        fold.removeAttribute("hidden");
        requestAnimationFrame(function () {
          var w =
            inner && inner.offsetWidth > 0
              ? inner.offsetWidth
              : block
                ? block.getBoundingClientRect().width
                : 340;
          var paperH = measureLetterPaperHeight(LETTER, w);
          if (inner && paperH > 0) inner.style.minHeight = paperH + "px";
          requestAnimationFrame(function () {
            fold.classList.add("is-open");
            startLetterTypewriter(inner, LETTER, function () { });
          });
        });
      } else {
        startLetterTypewriter(inner, LETTER, function () { });
      }
      haptic(10);
      updateS2Dots(3);
    });

    $("btnAfterLetter").addEventListener("click", function () {
      var s2 = $("screen2");
      if (s2) s2.classList.remove("s2--gift-gallery");
      setHidden($("s2Gift"), true);
      setHidden($("s2End"), false);
      playBgmFromUser(BGM_END_SRC);
      haptic(12);
    });
  }

  if (window.Zepto) {
    window.Zepto(boot);
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.playBgmFromUser = playBgmFromUser;
  window.BGM_DEFAULT_SRC = BGM_DEFAULT_SRC;
  window.BGM_QUIZ_SRC = BGM_QUIZ_SRC;
  window.BGM_SCRATCH_SRC = BGM_SCRATCH_SRC;
})();
