(checks, mode = 'evidence') => {
  const display = mode === 'evidence';
  const ok = (pass) => (pass === undefined || pass === null ? '⏳' : pass ? '✅' : '❌');

  const shiftEntries = [];
  if (display) {
    try {
      new PerformanceObserver((list) => shiftEntries.push(...list.getEntries())).observe({
        type: 'layout-shift',
        buffered: true
      });
    } catch {}
  }

  const channels = (color) => (color.match(/[\d.]+/g) || []).map(Number);
  const luminance = (color) => {
    const [r, g, b] = channels(color).map((value) => {
      const s = value / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const finiteAnimations = () =>
    document
      .getAnimations()
      .filter(
        (animation) =>
          animation.playState === 'running' &&
          animation.timeline instanceof DocumentTimeline &&
          animation.effect?.getComputedTiming().endTime !== Infinity
      );
  const animating = () => finiteAnimations().length > 0;
  const settle = () =>
    new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Animations did not settle within 5s')), 5000);
      Promise.all(finiteAnimations().map((animation) => animation.finished.catch(() => {})))
        .then(() => new Promise((done) => requestAnimationFrame(done)))
        .then(() => {
          clearTimeout(timeout);
          resolve();
        });
    });
  const evaluateSettled = (evaluate) => settle().then(evaluate);

  const width = innerWidth;
  const liveChecks = [];
  const loads = [];
  const log = [];
  const results = {};

  let part = () => null;
  if (display) {
    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;left:6px;right:6px;bottom:6px;z-index:2147483647;background:rgba(15,15,20,.92);color:#eee;font:11px/1.35 ui-monospace,Menlo,monospace;padding:8px 10px;border-radius:8px;pointer-events:none;max-height:52vh;overflow:hidden;white-space:pre-wrap';
    overlay.innerHTML =
      '<div data-step style="font-weight:700;color:#ffd166;margin-bottom:4px"></div><div data-live></div><div data-log style="margin-top:4px;color:#9fe"></div><div data-table style="margin-top:4px;color:#ccc"></div><div data-summary style="margin-top:4px;color:#fff"></div>';
    document.body.append(overlay);
    part = (name) => overlay.querySelector(`[data-${name}]`);
  }

  const qa = {
    width,
    ok,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    step: (text) => {
      part('step').textContent = text;
    },
    record: (key, pass) => {
      results[key] = pass ?? null;
    },
    log: (text, pass, key) => {
      log.unshift(`${new Date().toISOString().slice(14, 23)} ${text}${pass === undefined ? '' : ` ${ok(pass)}`}`);
      log.length = Math.min(log.length, 8);
      if (key !== undefined) {
        qa.record(key, results[key] === false || pass === false ? false : pass);
      }
    },
    check: (label, evaluate) => {
      liveChecks.push({ label, evaluate });
    },
    onLoad: (key, evaluate) => {
      let result = { pass: undefined, detail: 'settling…' };
      liveChecks.push({ label: `${key} (on load)`, evaluate: () => result, onLoad: true });
      loads.push(
        evaluateSettled(evaluate)
          .then((settled) => {
            result = settled;
            qa.log(settled.detail, settled.pass, key);
          })
          .catch((error) => {
            result = { pass: false, detail: error.message };
            qa.log(error.message, false, key);
          })
      );
    },
    settle,
    logSettled: (key, evaluate) =>
      evaluateSettled(evaluate).then(({ pass, detail }) => {
        qa.log(detail, pass, key);
        return pass;
      }),
    act: (action, selector, target) => window.qaAct(action, selector, target),
    hide: (selector) => {
      document.head.insertAdjacentHTML('beforeend', `<style>${selector}{display:none!important}</style>`);
      qa.log(`hidden for evidence: ${selector}`);
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
      `${width}px results: ${Object.entries(results)
        .map(([key, pass]) => `${key}${ok(pass)}`)
        .join(' ')}`,
    summary: (text) => {
      part('summary').textContent = text;
    },
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
    }
  };
  if (!display) {
    const skip = () => {};
    Object.assign(qa, {
      step: skip,
      summary: skip,
      log: skip,
      onLoad: skip,
      hide: skip,
      focus: skip,
      logSettled: () => Promise.resolve(undefined)
    });
  }
  window.qa = qa;

  let script;
  let setupError;
  try {
    script = checks(qa);
  } catch (error) {
    setupError = error;
    qa.log(`checks failed to load: ${error.message}`, false, 'setup');
  }

  qa.run = async () => {
    try {
      if (setupError && !display) {
        throw setupError;
      }
      await Promise.all(loads);
      if (typeof script === 'function') {
        await script(qa);
      }
      if (display) {
        await qa.settle();
        for (const { label, evaluate } of liveChecks.filter((check) => !check.onLoad)) {
          try {
            const { pass, detail } = evaluate();
            qa.log(`${label}: ${detail}`, pass, label);
          } catch (error) {
            qa.log(`${label} threw ${error.message}`, false, label);
          }
        }
      }
    } catch (error) {
      qa.log(`script failed: ${error.message}`, false, 'script');
      if (!display) {
        throw error;
      }
    }
    qa.step(`${width}px · results`);
    return { ...results };
  };

  if (display) {
    const tick = () => {
      const mark = (pass) => (animating() ? '⏳' : ok(pass));
      part('live').textContent = [
        `viewport ${innerWidth}px`,
        ...liveChecks.map(({ label, evaluate }) => {
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
      requestAnimationFrame(tick);
    };
    tick();
  }
  return liveChecks.map((check) => check.label);
}
