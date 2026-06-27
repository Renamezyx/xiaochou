(function () {
  "use strict";

  var ENDPOINT = window.TRACK_ENDPOINT || "/xiaoqiu/api/track.php";
  var STORAGE_VISITOR = "xc_vid";
  var STORAGE_SESSION = "xc_sid";

  function uuid() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function readId(storage, key) {
    try {
      var id = storage.getItem(key);
      if (!id) {
        id = uuid();
        storage.setItem(key, id);
      }
      return id;
    } catch (e) {
      return uuid();
    }
  }

  function getDeviceInfo() {
    var ua = navigator.userAgent || "";
    var tablet = /iPad|Tablet|Android(?!.*Mobile)/i.test(ua);
    var mobile = !tablet && /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua);
    var deviceType = tablet ? "tablet" : mobile ? "mobile" : "desktop";

    var os = "unknown";
    if (/iPhone|iPad|iPod/.test(ua)) os = "iOS";
    else if (/Android/.test(ua)) os = "Android";
    else if (/Windows NT/.test(ua)) os = "Windows";
    else if (/Mac OS X/.test(ua)) os = "macOS";
    else if (/Linux/.test(ua)) os = "Linux";
    else if (/CrOS/.test(ua)) os = "ChromeOS";

    var browser = "unknown";
    if (/MicroMessenger/i.test(ua)) browser = "WeChat";
    else if (/QQ\//i.test(ua)) browser = "QQ";
    else if (/Edg\//i.test(ua)) browser = "Edge";
    else if (/OPR\//i.test(ua) || /Opera/i.test(ua)) browser = "Opera";
    else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = "Chrome";
    else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";
    else if (/Firefox\//i.test(ua)) browser = "Firefox";

    var model = "";
    if (/iPhone/.test(ua)) model = "iPhone";
    else if (/iPad/.test(ua)) model = "iPad";
    else {
      var m = ua.match(/;\s*([^;)]+)\s*Build\//i);
      if (m) model = m[1].trim();
    }

    return {
      device_type: deviceType,
      os: os,
      browser: browser,
      model: model,
      platform: navigator.platform || "",
      dpr: window.devicePixelRatio || 1
    };
  }

  function basePayload() {
    var dev = getDeviceInfo();
    return {
      ts: Date.now(),
      url: location.href,
      path: location.pathname + location.search + location.hash,
      ref: document.referrer || "",
      ua: navigator.userAgent,
      lang: navigator.language || "",
      vw: window.innerWidth,
      vh: window.innerHeight,
      vid: readId(localStorage, STORAGE_VISITOR),
      sid: readId(sessionStorage, STORAGE_SESSION),
      device_type: dev.device_type,
      os: dev.os,
      browser: dev.browser,
      model: dev.model,
      platform: dev.platform,
      dpr: dev.dpr
    };
  }

  function send(event, data) {
    if (!ENDPOINT) return;
    var payload = {};
    var k;
    var base = basePayload();
    for (k in base) {
      if (Object.prototype.hasOwnProperty.call(base, k)) payload[k] = base[k];
    }
    payload.event = event;
    if (data) {
      for (k in data) {
        if (Object.prototype.hasOwnProperty.call(data, k)) payload[k] = data[k];
      }
    }
    var body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      try {
        if (
          navigator.sendBeacon(
            ENDPOINT,
            new Blob([body], { type: "application/json" })
          )
        ) {
          return;
        }
      } catch (e) {
        /* fall through */
      }
    }
    if (window.fetch) {
      fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body,
        keepalive: true
      }).catch(function () {});
    }
  }

  window.track = send;
  send("page_view", { title: document.title });
})();
