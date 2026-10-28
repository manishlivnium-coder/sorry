(() => {
  const M = window.MESSAGE || {};
  const C = Object.assign({
    title: 'Tumse kuch kehna hai.',
    sub: 'Bas tap karti jao, ya space dabao.',
    start: 'Shuru karo',
    yes: 'Haan, meri jaan',
    wait: 'Mujhe sochne ka waqt chahiye',
    yesReply: 'Shukriya, meri jaan.',
    waitReply: 'Tumhara waqt, tumhara haq hai. Main yahin hoon.'
  }, M.copy);

  const $ = (id) => document.getElementById(id);
  const stage = $('stage'), intro = $('intro'), reader = $('reader'), reply = $('reply');
  const tools = $('tools'), line = $('line'), answer = $('answer');
  const bar = $('bar'), progress = $('progress'), counter = $('counter');
  const hint = $('hint'), autoBtn = $('auto'), autoLabel = $('autoLabel');
  const backBtn = $('back'), nextBtn = $('next');
  const storageKey = 'tumhare-liye-reading-position-v2';

  $('introTitle').textContent = C.title;
  $('introSub').textContent = C.sub;
  $('start').querySelector('b').textContent = C.start;
  $('yes').textContent = C.yes;
  $('wait').textContent = C.wait;

  // Keep each original paragraph together; **text** remains softly emphasized.
  const lines = [];
  (M.text || '').trim().split(/\n\s*\n/).forEach((para, p) => {
    const raw = para.replace(/\s+/g, ' ').trim();
    if (!raw) return;
    const segments = [];
    const emphasis = /\*\*([\s\S]+?)\*\*/g;
    let cursor = 0, match;
    while ((match = emphasis.exec(raw))) {
      if (match.index > cursor) segments.push({ text: raw.slice(cursor, match.index), key: false });
      segments.push({ text: match[1], key: true });
      cursor = match.index + match[0].length;
    }
    if (cursor < raw.length) segments.push({ text: raw.slice(cursor), key: false });
    const text = raw.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
    lines.push({ text, segments, key: segments.length === 1 && segments[0].key, gap: p > 0 });
  });

  const last = lines.length - 1;
  const askText = (M.ask || 'shaadi karogi').toLocaleLowerCase();
  const askIndex = lines.findIndex((l) => l.text.toLocaleLowerCase().includes(askText));
  const askFrom = askIndex < 0 ? last : askIndex;
  let i = 0, auto = false, timer = 0, ignoreClickUntil = 0, screenLock = null, paragraphMotion = null;

  let savedIndex = 0;
  try {
    const saved = Number(localStorage.getItem(storageKey));
    if (Number.isInteger(saved) && saved > 0 && saved < last) savedIndex = saved;
  } catch (_) { /* Storage may be disabled; the letter still works normally. */ }
  if (savedIndex) {
    $('start').querySelector('b').textContent = 'Jaari rakhein';
    $('restartFromTop').hidden = false;
  }

  function savePosition() {
    try { localStorage.setItem(storageKey, String(i)); } catch (_) { /* Optional convenience only. */ }
  }

  function show(n) {
    clearTimeout(timer);
    if (!lines.length) return;
    const previous = i;
    i = Math.max(0, Math.min(n, last));
    const direction = i > previous ? 1 : i < previous ? -1 : 0;
    const s = lines[i];

    const frag = document.createDocumentFragment();
    let wordIndex = 0;
    s.segments.forEach((segment) => {
      segment.text.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) {
          frag.append(document.createTextNode(part));
          return;
        }
        const span = document.createElement('span');
        span.className = segment.key ? 'w w--key' : 'w';
        span.style.setProperty('--i', Math.min(wordIndex, 18));
        span.textContent = part;
        frag.append(span);
        wordIndex += 1;
      });
    });
    line.replaceChildren(frag);
    line.scrollTop = 0;
    if (line.animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      if (paragraphMotion) paragraphMotion.cancel();
      paragraphMotion = line.animate(
        [
          { opacity: 0, transform: `translate3d(${direction * 12}px, 7px, 0)` },
          { opacity: 1, transform: 'translate3d(0, 0, 0)' }
        ],
        { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' }
      );
    }
    line.classList.toggle('key', s.key);
    document.body.classList.toggle('key', s.key);
    answer.classList.toggle('on', i >= askFrom);
    bar.style.width = ((i + 1) / lines.length) * 100 + '%';
    progress.setAttribute('aria-valuenow', String(Math.round(((i + 1) / lines.length) * 100)));
    counter.textContent = `${String(i + 1).padStart(2, '0')} / ${String(lines.length).padStart(2, '0')}`;
    backBtn.disabled = i === 0;
    nextBtn.disabled = i === last;
    savePosition();
    schedule();
  }

  function schedule() {
    clearTimeout(timer);
    if (!auto) return;
    if (i >= askFrom) {
      auto = false;
      autoBtn.setAttribute('aria-pressed', 'false');
      autoLabel.textContent = 'AUTO';
      autoBtn.title = 'Auto read chalu karo';
      hint.textContent = 'Yeh sawaal tumhare liye hai';
      hint.style.opacity = 1;
      return;
    }
    if (i >= last) return;
    const s = lines[i];
    const words = s.text.split(' ').length;
    const next = lines[i + 1];
    const delay = Math.min(48000, Math.max(7500, 4200 + words * 260 + (next && next.gap ? 900 : 0)));
    timer = setTimeout(() => show(i + 1), delay);
  }

  function next() {
    hint.style.opacity = 0;
    if (i < last) show(i + 1);
  }

  function begin(fromSaved) {
    intro.hidden = true;
    reply.hidden = true;
    reader.hidden = false;
    tools.hidden = false;
    progress.hidden = false;
    show(fromSaved ? savedIndex : 0);
    if (navigator.wakeLock && navigator.wakeLock.request) {
      navigator.wakeLock.request('screen').then((lock) => {
        if (reader.hidden) lock.release().catch(() => {});
        else screenLock = lock;
      }).catch(() => {});
    }
  }

  function makeHeartBurst() {
    const burst = $('heartBurst');
    burst.replaceChildren();
    for (let n = 0; n < 14; n += 1) {
      const heart = document.createElement('span');
      heart.textContent = '♥';
      const angle = (Math.PI * 2 * n) / 14;
      const distance = 75 + (n % 4) * 17;
      heart.style.setProperty('--x', `${Math.cos(angle) * distance}px`);
      heart.style.setProperty('--y', `${Math.sin(angle) * distance}px`);
      heart.style.setProperty('--size', `${10 + (n % 3) * 4}px`);
      heart.style.setProperty('--delay', `${(n % 5) * 45}ms`);
      heart.style.setProperty('--turn', `${(n % 2 ? 1 : -1) * (15 + n * 3)}deg`);
      burst.append(heart);
    }
  }

  function respond(text, accepted) {
    clearTimeout(timer);
    if (screenLock) { screenLock.release().catch(() => {}); screenLock = null; }
    auto = false;
    autoBtn.setAttribute('aria-pressed', 'false');
    autoLabel.textContent = 'AUTO';
    reader.hidden = true;
    tools.hidden = true;
    progress.hidden = true;
    reply.hidden = false;
    reply.classList.toggle('celebrate', accepted);
    document.body.classList.add('key');
    $('replyText').textContent = text;
    $('replyEyebrow').textContent = accepted ? 'DIL KHUSH KAR DIYA' : 'TUMHARA JAWAAB';
    try { localStorage.removeItem(storageKey); } catch (_) { /* Ignore unavailable storage. */ }
    if (accepted) makeHeartBurst();
    $('readAgain').focus({ preventScroll: true });
  }

  function resetToBeginning() {
    try { localStorage.removeItem(storageKey); } catch (_) { /* Ignore unavailable storage. */ }
    savedIndex = 0;
    $('start').querySelector('b').textContent = C.start;
    $('restartFromTop').hidden = true;
    begin(false);
  }

  $('start').addEventListener('click', () => begin(savedIndex > 0));
  $('restartFromTop').addEventListener('click', resetToBeginning);
  $('yes').addEventListener('click', () => respond(C.yesReply, true));
  $('wait').addEventListener('click', () => respond(C.waitReply, false));
  $('readAgain').addEventListener('click', resetToBeginning);
  backBtn.addEventListener('click', () => show(i - 1));
  nextBtn.addEventListener('click', next);
  autoBtn.addEventListener('click', () => {
    auto = !auto;
    autoBtn.setAttribute('aria-pressed', String(auto));
    autoLabel.textContent = auto ? 'ROK' : 'AUTO';
    autoBtn.title = auto ? 'Auto read rokho' : 'Auto read chalu karo';
    schedule();
  });

  stage.addEventListener('click', (e) => {
    if (Date.now() < ignoreClickUntil || reader.hidden || e.target.closest('button')) return;
    next();
  });

  let touchStart = null;
  stage.addEventListener('touchstart', (e) => {
    if (reader.hidden || !e.changedTouches.length) return;
    touchStart = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
  }, { passive: true });
  stage.addEventListener('touchend', (e) => {
    if (reader.hidden || !touchStart || !e.changedTouches.length) return;
    const dx = e.changedTouches[0].clientX - touchStart.x;
    const dy = e.changedTouches[0].clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) > 55 && Math.abs(dy) < 85) {
      ignoreClickUntil = Date.now() + 500;
      if (dx < 0) next();
      else show(i - 1);
    }
  }, { passive: true });

  document.addEventListener('keydown', (e) => {
    if (reader.hidden || e.target.closest('button')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); show(i - 1); }
    else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); next(); }
  });
})();
