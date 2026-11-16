(function verify() {
  try {
    sessionStorage.verifyWithVideo = `return (${verify.toString()})()`;
  } catch {}
  if (window.qa) {
    return 'already in store';
  }

  const ok = (pass) => (pass === undefined || pass === null ? '⏳' : pass ? '✅' : '❌');
  const store = {
    get: (key, fallback) => {
      try {
        return JSON.parse(sessionStorage.getItem(key)) ?? fallback;
      } catch {
        return fallback;
      }
    },
    set: (key, value) => {
      try {
        sessionStorage.setItem(key, JSON.stringify(value));
      } catch {}
    }
  };

  const shiftEntries = [];
  try {
    new PerformanceObserver((list) => shiftEntries.push(...list.getEntries())).observe({
      type: 'layout-shift',
      buffered: true
    });
  } catch {}

  const channels = (color) => (color.match(/[\d.]+/g) || []).map(Number);
  const luminance = (color) => {
    const [r, g, b] = channels(color).map((value) => {
      const s = value / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const finiteAnimations = () =>
    document.getAnimations().filter((animation) => animation.playState === 'running' && animation.effect?.getComputedTiming().endTime !== Infinity);
  const animating = () => finiteAnimations().some((animation) => animation.playState === 'running');
  const settle = () =>
    new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Animations did not settle within 5s')), 5000);
      Promise.all(finiteAnimations().map((animation) => animation.finished.catch(() => {})))
        .then(() => new Promise((done) => requestAnimationFrame(done)))
        .then(() => { clearTimeout(timeout); resolve(); });
    });
  const evaluateSettled = (evaluate) => settle().then(evaluate);

  const width = innerWidth;
  const checks = [];
  const loads = [];
  const log = [];

  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;left:6px;right:6px;bottom:6px;z-index:2147483647;background:rgba(15,15,20,.92);color:#eee;font:11px/1.35 ui-monospace,Menlo,monospace;padding:8px 10px;border-radius:8px;pointer-events:none;max-height:52vh;overflow:hidden;white-space:pre-wrap';
  overlay.innerHTML =
    '<div data-step style="font-weight:700;color:#ffd166;margin-bottom:4px"></div><div data-live></div><div data-log style="margin-top:4px;color:#9fe"></div><div data-table style="margin-top:4px;color:#ccc"></div>';
  document.body.append(overlay);
  const part = (name) => overlay.querySelector(`[data-${name}]`);

  const qa = {
    width,
    ok,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    step: (text) => {
      part('step').textContent = text;
    },
    record: (key, pass) => {
      const results = store.get('qaResults', {});
      results[width] = { ...(results[width] || {}), [key]: pass ?? null };
      store.set('qaResults', results);
    },
    log: (text, pass, key) => {
      log.unshift(`${new Date().toISOString().slice(14, 23)} ${text}${pass === undefined ? '' : ` ${ok(pass)}`}`);
      log.length = Math.min(log.length, 8);
      if (key !== undefined) {
        const previous = store.get('qaResults', {})[width]?.[key];
        qa.record(key, previous === false || pass === false ? false : pass);
      }
    },
    check: (label, evaluate) => {
      checks.push({ label, evaluate });
    },
    onLoad: (key, evaluate) => {
      let result = { pass: undefined, detail: 'settling…' };
      qa.check(`${key} (on load)`, () => result);
      const pending = evaluateSettled(evaluate).then((settled) => {
        result = settled;
        qa.log(settled.detail, settled.pass, key);
      });
      loads.push(pending.catch((error) => {
        result = { pass: false, detail: error.message };
        qa.log(error.message, false, key);
      }));
    },
    settle,
    logSettled: (key, evaluate) =>
      evaluateSettled(evaluate).then(({ pass, detail }) => {
        qa.log(detail, pass, key);
        return pass;
      }),
    vital: (name) => {
      const metric = window.__qaVitals?.[name];
      const limit = { LCP: 2500, INP: 200, CLS: 0.1 }[name];
      const unit = name === 'CLS' ? '' : 'ms';
      return {
        pass: metric && limit !== undefined ? metric.value <= limit : undefined,
        detail: metric
          ? `${name} ${metric.value}${unit} (local, provisional; target ≤${limit}${unit})`
          : `${name} unavailable / awaiting measurement`
      };
    },
    color: (element) => getComputedStyle(element).color,
    background: (element) => {
      for (let node = element; node; node = node.parentElement) {
        const color = getComputedStyle(node).backgroundColor;
        const [, , , alpha = 1] = channels(color);
        if (alpha === 1) {
          return color;
        }
      }
      return 'rgb(255, 255, 255)';
    },
    contrast: (foreground, background) => {
      const [high, low] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
      return (high + 0.05) / (low + 0.05);
    },
    firstFullyVisible: (scroller) => {
      const { left, right } = scroller.getBoundingClientRect();
      return [...scroller.children].findIndex((child) => {
        const rect = child.getBoundingClientRect();
        return rect.left >= left - 1 && rect.right <= right + 1;
      });
    },
    table: () =>
      `per-width results: ${Object.entries(store.get('qaResults', {}))
        .map(
          ([w, keys]) =>
            `${w}px ${Object.entries(keys)
              .map(([key, pass]) => `${key}${ok(pass)}`)
              .join(' ')}`
        )
        .join(' | ')}`,
    run: () => Promise.all(loads).then(() => qa.table()),
    shifts: (root) =>
      shiftEntries.filter((entry) => entry.sources?.some((source) => source.node && root.contains(source.node))),
    focus: (element) => {
      element.style.outline = '2px solid #0a7cff';
      const headerBottom = [...document.querySelectorAll('body *')].reduce((bottom, node) => {
        const { position } = getComputedStyle(node);
        if (position !== 'fixed' && position !== 'sticky') {
          return bottom;
        }
        const rect = node.getBoundingClientRect();
        return rect.top <= 0 && rect.bottom > 0 && rect.height < innerHeight / 2
          ? Math.max(bottom, rect.bottom)
          : bottom;
      }, 0);
      scrollTo({ top: element.getBoundingClientRect().top + scrollY - headerBottom - 60, behavior: 'instant' });
    },
    reset: () => store.set('qaResults', {})
  };
  window.qa = qa;

  try {
    const setup = sessionStorage.qaChecks;
    if (setup) {
      const script = new Function('qa', `return (${setup})(qa)`)(qa);
      if (typeof script === 'function') {
        qa.run = async () => {
          try {
            await Promise.all(loads);
            await script(qa);
            await qa.settle();
            for (const { label, evaluate } of checks) {
              const { pass, detail } = evaluate();
              qa.log(detail, pass, label);
            }
          } catch (error) {
            qa.log(`script failed: ${error.message}`, false, 'script');
          }
          return qa.table();
        };
      }
    }
  } catch (error) {
    qa.log(`checks failed to load: ${error.message}`, false, 'setup');
  }

  const tick = () => {
    const mark = (pass) => (animating() ? '⏳' : ok(pass));
    part('live').textContent = [
      `viewport ${innerWidth}px`,
      ...checks.map(({ label, evaluate }) => {
        try {
          const { pass, detail } = evaluate();
          return `${label}: ${detail} ${mark(pass)}`;
        } catch (error) {
          return `${label}: threw ${error.message} ❌`;
        }
      })
    ].join('\n');
    part('log').textContent = log.join('\n');
    part('table').textContent = qa.table();
    setTimeout(tick, 250);
  };
  tick();
  return { installed: true, width, checks: checks.map((check) => check.label) };
})();
