// ============================================================
//  MAIN — orchestration: preloader, smooth scroll, cursor,
//  text FX, scroll choreography, HUD feed, clock.
// ============================================================
import { initGL } from './webgl.js';
import { initArt } from './art.js';

const IS_TOUCH  = matchMedia('(pointer:coarse)').matches;
const REDUCED   = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

gsap.registerPlugin(ScrollTrigger);
document.body.classList.add('anim');

/* ==================== SMOOTH SCROLL ==================== */
let lenis = null;
if (!REDUCED && window.Lenis) {
  lenis = new Lenis({ duration: 1.15, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
}
const scrollTo = (target) => {
  if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.4 });
  else document.querySelector(target)?.scrollIntoView({ behavior: REDUCED ? 'instant' : 'smooth' });
};
$$('a[data-scroll]').forEach(a => a.addEventListener('click', e => {
  const h = a.getAttribute('href');
  if (h?.startsWith('#')) { e.preventDefault(); scrollTo(h); }
}));

/* ==================== WEBGL ==================== */
let gl = { morphTo() {} };
try { gl = initGL($('#gl')); } catch { $('#gl')?.remove(); }
const shapeNames = ['KÜRE', 'DÜĞÜM', 'GALAKSİ', 'ALAN', 'SARMAL', 'GİRDAP'];
$$('[data-shape]').forEach(button => button.addEventListener('click', () => {
  const shape = Number(button.dataset.shape);
  gl.morphTo(shape);
  $$('[data-shape]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  $('.specimen-label').textContent = `ŞEK. ${String(shape + 1).padStart(3, '0')} / ${shapeNames[shape]}`;
}));
const menu = $('.menu-toggle');
const closeMenu = () => { $('#nav').classList.remove('menu-open'); menu.setAttribute('aria-expanded', 'false'); menu.textContent = 'MENÜ +'; };
menu.addEventListener('click', () => {
  const open = $('#nav').classList.toggle('menu-open');
  menu.setAttribute('aria-expanded', String(open));
  menu.textContent = open ? 'KAPAT −' : 'MENÜ +';
});
$$('.nav-links a').forEach(link => link.addEventListener('click', closeMenu));
addEventListener('keydown', event => { if (event.key === 'Escape') { closeMenu(); menu.focus(); } });

/* ==================== TEXT SPLITTING ==================== */
$$('[data-split]').forEach(el => {
  const text = el.textContent;
  el.setAttribute('aria-label', text);
  el.textContent = '';
  for (const ch of text) {
    const s = document.createElement('span');
    s.className = 'char';
    s.setAttribute('aria-hidden', 'true');
    s.textContent = ch === ' ' ? ' ' : ch;
    el.appendChild(s);
  }
});

/* ==================== PRELOADER ==================== */
const LOG_LINES = [
  ['ok',   '> tensor çekirdekleri bağlanıyor ..... OK'],
  ['',     '> checkpoint yükleniyor yagmur_v3.safetensors'],
  ['ok',   '> gölgelendiriciler derleniyor [glsl]. OK'],
  ['',     '> 55.000 parçacık ayrılıyor'],
  ['wr',   '> üretken çalışmalar besteleniyor'],
  ['ok',   '> dikkat başlıkları 16/16 ............ OK'],
  ['',     '> hazır.'],
];
function runPreloader(done) {
  const log = $('#preLog'), count = $('#preCount'), bar = $('#preBar');
  const dur = REDUCED ? 600 : 2100;
  const t0 = performance.now();
  let li = 0;
  const logIv = setInterval(() => {
    if (li >= LOG_LINES.length) return clearInterval(logIv);
    const [cls, txt] = LOG_LINES[li++];
    const div = document.createElement('div');
    if (cls) div.className = cls;
    div.textContent = txt;
    log.appendChild(div);
  }, dur / (LOG_LINES.length + 2));

  (function tick() {
    const p = Math.min(1, (performance.now() - t0) / dur);
    const e = 1 - Math.pow(1 - p, 3);
    count.textContent = String(Math.round(e * 100)).padStart(3, '0');
    bar.style.transform = `scaleX(${e})`;
    p < 1 ? requestAnimationFrame(tick) : done();
  })();
}

function intro() {
  if (REDUCED) { $('#preloader').style.display = 'none'; document.body.removeAttribute('data-loading'); return; }
  const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
  tl.to('#preloader', { yPercent: -100, duration: REDUCED ? 0.3 : 1.05, ease: 'expo.inOut' })
    .add(() => { $('#preloader').style.display = 'none'; document.body.removeAttribute('data-loading'); lenis?.start(); })
    .from('.ht-word .char', { yPercent: 118, duration: 1.1, stagger: 0.045 }, '-=0.45')
    .from('[data-intro]', { y: 26, opacity: 0, duration: 0.9, stagger: 0.09 }, '-=0.7')
    .from('.nav', { y: -30, opacity: 0, duration: 0.8 }, '-=0.8');
}

/* ==================== CURSOR ==================== */
if (!IS_TOUCH) {
  const dot = $('#cursorDot'), ring = $('#cursorRing'), label = $('#cursorLabel');
  let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
  addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY; }, { passive: true });
  gsap.ticker.add(() => {
    rx += (mx - rx) * 0.16; ry += (my - ry) * 0.16;
    dot.style.transform = `translate(${mx - 3}px,${my - 3}px)`;
    ring.style.transform = `translate(${rx - ring.offsetWidth / 2}px,${ry - ring.offsetHeight / 2}px)`;
  });
  document.addEventListener('mouseover', e => {
    const lab = e.target.closest('[data-cursor]');
    const hov = e.target.closest('a,button,[data-cursor],.seg-btn');
    if (lab) { label.textContent = lab.dataset.cursor; ring.classList.add('is-label'); ring.classList.remove('is-hover'); }
    else if (hov) { ring.classList.add('is-hover'); ring.classList.remove('is-label'); }
    else { ring.classList.remove('is-hover', 'is-label'); }
  });
  document.addEventListener('mouseleave', () => { dot.style.opacity = ring.style.opacity = 0; });
  document.addEventListener('mouseenter', () => { dot.style.opacity = ring.style.opacity = 1; });
}

/* ==================== MAGNETIC ==================== */
if (!IS_TOUCH && !REDUCED) {
  $$('[data-magnetic]').forEach(el => {
    const qx = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3.out' });
    const qy = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3.out' });
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      qx((e.clientX - r.left - r.width / 2) * 0.35);
      qy((e.clientY - r.top - r.height / 2) * 0.35);
    });
    el.addEventListener('pointerleave', () => { qx(0); qy(0); });
  });
}

/* ==================== SCRAMBLE ==================== */
const CH = '!<>-_\\/[]{}—=+*^?#@%&';
function scramble(el) {
  if (el._busy) return;
  const orig = el.dataset.txt || (el.dataset.txt = el.textContent);
  el._busy = true;
  let f = 0;
  const iv = setInterval(() => {
    el.textContent = [...orig].map((c, i) => i < f ? c : (c === ' ' ? ' ' : CH[(Math.random() * CH.length) | 0])).join('');
    f += Math.max(1, Math.round(orig.length / 9));
    if (f > orig.length) { el.textContent = orig; clearInterval(iv); el._busy = false; }
  }, 28);
}
if (!REDUCED) $$('[data-scramble]').forEach(el => el.addEventListener('mouseenter', () => scramble(el)));

/* ==================== SCROLL CHOREOGRAPHY ==================== */
// section title char reveals
$$('.sec-title, .contact-title').forEach(t => {
  const chars = t.querySelectorAll('.char');
  if (!chars.length) return;
  gsap.from(chars, {
    yPercent: 120, duration: 1, ease: 'power4.out', stagger: 0.035,
    scrollTrigger: { trigger: t, start: 'top 86%' },
  });
});

// generic reveals
$$('[data-reveal]').forEach(el => {
  gsap.to(el, {
    opacity: 1, y: 0, duration: 1.1, ease: 'power3.out',
    scrollTrigger: { trigger: el, start: 'top 88%' },
  });
});

// manifesto word-by-word scrub
const man = $('#manifesto');
if (man) {
  const wrap = node => {
    [...node.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(w => {
          if (!w.trim()) { frag.appendChild(document.createTextNode(w)); return; }
          const s = document.createElement('span'); s.className = 'w'; s.textContent = w;
          frag.appendChild(s);
        });
        node.replaceChild(frag, n);
      } else if (n.nodeType === 1) wrap(n);
    });
  };
  wrap(man);
  gsap.to('#manifesto .w', {
    opacity: 1, stagger: 0.05, ease: 'none',
    scrollTrigger: { trigger: man, start: 'top 78%', end: 'bottom 45%', scrub: 0.6 },
  });
}

// counters
$$('[data-count]').forEach(el => {
  const end = parseFloat(el.dataset.count), dec = +(el.dataset.decimals || 0), suf = el.dataset.suffix || '';
  const o = { v: 0 };
  gsap.to(o, {
    v: end, duration: 2, ease: 'power2.out',
    scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    onUpdate: () => el.textContent = o.v.toFixed(dec) + suf,
  });
});

// WebGL scene morph per section
$$('[data-scene]').forEach(sec => {
  const i = +sec.dataset.scene;
  ScrollTrigger.create({
    trigger: sec, start: 'top 55%', end: 'bottom 45%',
    onEnter: () => gl.morphTo(i), onEnterBack: () => gl.morphTo(i),
  });
});

// stacked card cascade
const cards = $$('.card');
cards.forEach(c => {
  if (REDUCED) return;
  gsap.from(c, {
    y: 65, duration: 1.1, ease: 'power3.out',
    scrollTrigger: { trigger: c, start: 'top 92%', once: true },
  });
});

// marquee skew follows scroll velocity
const mq = $('.marquee');
if (mq && lenis && !IS_TOUCH && !REDUCED) {
  const q = gsap.quickTo(mq, 'skewX', { duration: 0.6, ease: 'power3.out' });
  lenis.on('scroll', e => q(gsap.utils.clamp(-9, 9, e.velocity * -0.45)));
}

// progress + nav state
ScrollTrigger.create({
  start: 0, end: () => document.documentElement.scrollHeight - innerHeight,
  onUpdate: self => $('#progressBar').style.transform = `scaleX(${self.progress})`,
});
ScrollTrigger.create({
  start: 60, onEnter: () => $('#nav').classList.add('scrolled'),
  onLeaveBack: () => $('#nav').classList.remove('scrolled'),
});

// capability cells — cursor-tracked glow
$$('.cap').forEach(c => c.addEventListener('pointermove', e => {
  const r = c.getBoundingClientRect();
  c.style.setProperty('--mx', `${e.clientX - r.left}px`);
  c.style.setProperty('--my', `${e.clientY - r.top}px`);
}));

/* ==================== HUD FEED ==================== */
{
  const el = $('#feedText');
  let ep = 1077, loss = 0.413;
  setInterval(() => {
    if (document.hidden) return;
    ep += 1 + ((Math.random() * 7) | 0);
    loss = Math.max(0.011, loss * 0.996 + (Math.random() - 0.48) * 0.006);
    const acc = Math.min(99.4, 96.2 + (0.45 - loss) * 8 + Math.random() * 0.4);
    el.textContent = `SİMÜLASYON · EPOCH ${String(ep).padStart(4, '0')} · LOSS ${loss.toFixed(4)} · ACC ${acc.toFixed(1)}%`;
  }, 170);
}

/* ==================== CLOCK ==================== */
{
  const el = $('#clock');
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const tick = () => el.textContent = `İST ${fmt.format(new Date())}`;
  tick(); setInterval(tick, 1000);
}

/* ==================== BOOT ==================== */
const studies = [
  'Gürültü giderme ile gizli uzay geometrisi arasındaki ilişkiyi keşfeder. Tohumlu bir akış alanı, difüzyon sürecindeki olası yörüngeleri çiziyor.',
  'Bir dikkat matrisi çalışması: parlak köşegen hücreler yerel dikkati, köşegen dışı sinyaller uzun menzilli token ilişkilerini temsil ediyor.',
  'Öğrenilmiş temsillerin görsel bir keşfi. Renkli kümeler, bir kodlayıcının anlamsal kategorileri gömme uzayında nasıl ayırabileceğini tasvir ediyor.',
  'Konturlar, yerel bir minimum etrafındaki optimizasyon yüzeyini çiziyor. İllüstrasyon prosedürel; deneysel bir eğitim sonucu değil.',
  'Katmanlı dalga formları, zamansal özniteliklerin farklı frekanslarda nasıl ortaya çıktığını araştırıyor. Üretken bir sinyal çalışması; klinik veri değil.'
];
const categories = ['vision', 'language', 'vision', 'systems', 'systems'];
$$('.card').forEach((card, index) => {
  card.dataset.category = categories[index];
  const details = document.createElement('details');
  details.className = 'card-details';
  const summary = document.createElement('summary');
  summary.textContent = 'KONSEPTİ KEŞFET';
  const description = document.createElement('p');
  description.textContent = studies[index];
  details.append(summary, description);
  card.querySelector('.card-info').append(details);
  details.addEventListener('toggle', () => ScrollTrigger.refresh());
});
initArt();
$$('[data-filter]').forEach(button => button.addEventListener('click', () => {
  $$('[data-filter]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  cards.forEach(card => { card.hidden = button.dataset.filter !== 'all' && card.dataset.category !== button.dataset.filter; });
  ScrollTrigger.refresh();
  window.dispatchEvent(new Event('resize'));
}));
$$('.bento').forEach(card => card.addEventListener('pointermove', event => {
  const box = card.getBoundingClientRect();
  card.style.setProperty('--mx', `${event.clientX - box.left}px`);
  card.style.setProperty('--my', `${event.clientY - box.top}px`);
}));
const copyEmail = $('.copy-email');
copyEmail.addEventListener('click', async () => {
  const email = $('.btn-big').getAttribute('href').replace('mailto:', '');
  try { await navigator.clipboard.writeText(email); copyEmail.textContent = 'E-POSTA KOPYALANDI'; }
  catch { copyEmail.textContent = email; }
  setTimeout(() => { copyEmail.textContent = 'E-POSTAYI KOPYALA'; }, 3500);
});
const navigationObserver = new IntersectionObserver(entries => {
  const current = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
  if (!current) return;
  $$('.nav-links a').forEach(link => {
    if (link.hash === `#${current.target.id}`) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
}, { rootMargin: '-15% 0px -45% 0px' });
$$('main section[id]').forEach(section => navigationObserver.observe(section));
runPreloader(intro);
document.fonts.ready.then(() => ScrollTrigger.refresh());
if (REDUCED) {
  ScrollTrigger.getAll().forEach(trigger => { if (trigger.animation) trigger.animation.progress(1); });
  gsap.set('[data-reveal], .char, #manifesto .w', { opacity: 1, y: 0, yPercent: 0 });
}
