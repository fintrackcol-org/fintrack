import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import script from './recorrido.json';
import { FADE_IN, FADE_OUT, captionAt, entryTime, glides, jumpFor, scrollAt, segmentAt, segmentForScroll, veilAt } from './timeline';

export const TOUR_SEGMENTS = script.segments;
export const TOUR_DURATION = script.duration;

const AUDIO_SRC = '/audio/recorrido.mp3';
/** Espacio para la barra de navegación fija al bajar a cada sección. */
const NAV_OFFSET = 72;
/** Aire entre la barra de navegación y el contenido de la sección. */
const CONTENT_GAP = 24;
/** Teclas con las que la persona se mueve por su cuenta (y que pausan el recorrido). */
const SCROLL_KEYS = new Set(['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' ']);
/** Diferencia (px) entre donde el recorrido dejó la página y donde está: más que esto, la movió la persona. */
const MOVED = 8;

/** Sección, altura de scroll y color de fondo de cada frase del guion (la primera es el inicio de la página). */
function measure() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const els = TOUR_SEGMENTS.map(({ id }) => document.getElementById(id));
  return {
    els,
    tops: els.map((el, i) => {
      if (i === 0 || !el) return 0;
      // Una sección que no cabe entera en pantalla se muestra desde su contenido, no desde su
      // margen de arriba: así cabe más de ella sobre el reproductor (sobre todo en celular).
      // "Qué es" no: su espacio de arriba es del logo que viaja.
      const fits = el.offsetHeight <= window.innerHeight - NAV_OFFSET;
      const anchor = (!fits && el.dataset.stage !== 'about' && el.querySelector('.container-page')) || el;
      const gap = anchor === el ? 0 : CONTENT_GAP;
      return Math.min(max, Math.max(0, anchor.getBoundingClientRect().top + window.scrollY - NAV_OFFSET - gap));
    }),
    bgs: els.map((el) => (el ? getComputedStyle(el).backgroundColor : '#000')),
  };
}

/**
 * Recorrido con voz: un solo audio con los tiempos de cada frase, y ese audio es el único reloj.
 * De él salen la altura de la página, el velo del fundido entre secciones, los subtítulos y el
 * avance, así que nada se desincroniza al pausar, saltar o repetir.
 *
 * Si la persona hace scroll (rueda, dedo, teclado o barra), se pausa ("baja a tu ritmo"); al
 * seguir, continúa donde iba si no se movió, o desde la sección que tiene en pantalla si se movió.
 * También se pausa si la pestaña queda oculta. Si el navegador no puede reproducir el audio, el
 * recorrido sigue igual con subtítulos.
 *
 * @returns {{ status: 'idle'|'playing'|'paused'|'done', index: number, text: string, progress: number,
 *   muted: boolean, loading: boolean, veil: React.RefObject<HTMLDivElement>,
 *   start: () => void, pause: () => void, resume: () => void, stop: () => void, goTo: (index: number) => void }}
 */
export default function useGuidedTour() {
  const reduced = useReducedMotion() ?? false;
  const [status, setStatus] = useState('idle');
  const [index, setIndex] = useState(0);
  // Subtítulo: una sección puede tener varias frases, cada una con su segundo de inicio.
  const [text, setText] = useState(TOUR_SEGMENTS[0].lines[0].text);
  const [progress, setProgress] = useState(0);
  const [muted, setMuted] = useState(false);
  const [loading, setLoading] = useState(false);

  const audio = useRef(null);
  // Copia local del audio (blob): siempre se puede saltar a cualquier segundo, aunque el
  // servidor no acepte peticiones por rangos (pasa con el servidor de desarrollo).
  const blobUrl = useRef(null);
  // Segundo pedido mientras el audio termina de saltar ahí (si no, leería 0 un instante).
  const pendingFrom = useRef(null);
  const pendingAt = useRef(0);
  const measured = useRef({ els: [], tops: [], bgs: [] });
  // Guion en uso: el de siempre, salvo cuando se salta de lejos a una sección de bajada continua.
  const segs = useRef(TOUR_SEGMENTS);
  // Reloj de respaldo cuando no hay audio: segundo de inicio y momento en que arrancó.
  const silent = useRef(null);
  const raf = useRef(0);
  const veil = useRef(null);
  // Sección cuyo contenido ya entró en cascada, altura que puso el recorrido y dónde se pausó.
  const entered = useRef(-1);
  const lastY = useRef(0);
  const paused = useRef(null);
  // Velo que se retira al volver de lejos al inicio (ahí no hay pausa previa donde meter el fundido).
  const introUntil = useRef(0);
  // Sección pedida a mano: su nombre y su frase se muestran ya, sin esperar a que llegue la voz.
  const asked = useRef(-1);

  const now = useCallback(() => {
    if (silent.current) return silent.current.from + (performance.now() - silent.current.at) / 1000;
    const a = audio.current;
    if (!a) return 0;
    if (pendingFrom.current !== null) {
      if (Math.abs(a.currentTime - pendingFrom.current) < 0.5) pendingFrom.current = null;
      else if (performance.now() - pendingAt.current > 2000) {
        // No logró saltar (sin copia local y sin rangos): seguimos solo con subtítulos.
        a.pause();
        silent.current = { from: pendingFrom.current, at: performance.now() };
        pendingFrom.current = null;
        setMuted(true);
        return silent.current.from;
      } else return pendingFrom.current;
    }
    return a.currentTime;
  }, []);

  const stopLoop = () => cancelAnimationFrame(raf.current);

  /** Retira el velo y la marca de entrada: la página queda como en la navegación normal. */
  const clearEffects = () => {
    measured.current.els[entered.current]?.removeAttribute('data-tour-enter');
    entered.current = -1;
    introUntil.current = 0;
    if (veil.current) veil.current.style.opacity = '0';
  };

  const pause = useCallback(() => {
    stopLoop();
    paused.current = { t: now(), y: lastY.current };
    silent.current = null;
    audio.current?.pause();
    // Nunca se queda la pantalla tapada: si se pausa a mitad de un fundido, el velo se retira.
    clearEffects();
    setLoading(false);
    setStatus((s) => (s === 'playing' ? 'paused' : s));
  }, [now]);

  const loop = useCallback(() => {
    // La página ya no está donde la dejó el recorrido: la movió la persona (p. ej. con la barra).
    if (Math.abs(window.scrollY - lastY.current) > MOVED) {
      pause();
      return;
    }
    const t = now();
    if (t >= TOUR_DURATION) {
      clearEffects();
      setStatus('done');
      setProgress(1);
      silent.current = null;
      return;
    }
    const s = segs.current;
    const { els, tops, bgs } = measured.current;
    const i = segmentAt(t, s, reduced);
    lastY.current = scrollAt(t, s, tops, reduced);
    // `instant`: la página usa scroll suave por CSS y aquí la suavidad ya la pone el reloj.
    window.scrollTo({ top: lastY.current, behavior: 'instant' });

    if (veil.current) {
      const intro = (introUntil.current - performance.now()) / (FADE_OUT * 1000);
      veil.current.style.backgroundColor = bgs[i];
      veil.current.style.opacity = String(Math.max(veilAt(t, s, reduced), Math.min(intro, 1), 0));
    }
    // Con la página ya en su sitio bajo el velo, el contenido de la sección entra en cascada.
    if (i > 0 && entered.current !== i && !glides(s[i], reduced) && t >= entryTime(i, s, reduced) + FADE_IN) {
      els[entered.current]?.removeAttribute('data-tour-enter');
      entered.current = i;
      els[i]?.setAttribute('data-tour-enter', '');
    }

    const cap = asked.current === i ? i : captionAt(t, s);
    setIndex(cap);
    setText(s[cap].lines.reduce((shown, line) => (line.start - 0.1 <= t ? line : shown), s[cap].lines[0]).text);
    setProgress(t / TOUR_DURATION);
    raf.current = requestAnimationFrame(loop);
  }, [now, pause, reduced]);

  /**
   * Arranca (o retoma) en el segundo `from`. Con `comingFrom`, la transición hacia la sección
   * `comingFrom.index` parte de donde está la página (`comingFrom.y`) y no de la sección anterior.
   */
  const playFrom = useCallback(
    (from, comingFrom) => {
      clearEffects();
      measured.current = measure();
      if (comingFrom) measured.current.tops[comingFrom.index - 1] = comingFrom.y;
      lastY.current = window.scrollY;
      paused.current = null;
      asked.current = -1;
      if (!audio.current) {
        // La primera vez suena directo desde la URL (dentro del clic, para que el navegador lo
        // permita) y en paralelo se baja la copia local para los saltos posteriores.
        const a = new Audio(AUDIO_SRC);
        a.preload = 'auto';
        // Si la conexión no alcanza, el audio (y con él todo el recorrido) espera y se avisa.
        a.addEventListener('waiting', () => setLoading(true));
        a.addEventListener('playing', () => setLoading(false));
        audio.current = a;
        fetch(AUDIO_SRC)
          .then((r) => (r.ok ? r.blob() : null))
          .then((b) => {
            if (b) blobUrl.current = URL.createObjectURL(b);
          })
          .catch(() => {});
      }
      const a = audio.current;
      silent.current = null;
      if (from > 0 && blobUrl.current && a.src !== blobUrl.current) a.src = blobUrl.current;
      pendingFrom.current = from > 0 ? from : null;
      pendingAt.current = performance.now();
      if (a.readyState >= 1) a.currentTime = from;
      else a.addEventListener('loadedmetadata', () => (a.currentTime = from), { once: true });
      setStatus('playing');
      a.play()
        .then(() => setMuted(false))
        .catch(() => {
          // Sin audio (archivo no disponible o el navegador lo bloqueó): seguimos con subtítulos.
          silent.current = { from, at: performance.now() };
          setLoading(false);
          setMuted(true);
        });
      stopLoop();
      raf.current = requestAnimationFrame(loop);
    },
    [loop],
  );

  /** Va a la sección `index` desde donde esté la página, con su transición antes de la frase. */
  const goTo = useCallback(
    (index) => {
      const k = Math.min(Math.max(index, 0), TOUR_SEGMENTS.length - 1);
      const y = window.scrollY;
      const far = Math.abs(y - (k > 0 ? measure().tops[k - 1] : 0)) > window.innerHeight * 0.5;
      // De lejos no se baja de corrido (serían varias pantallas en un segundo): se usa el fundido.
      segs.current = far ? TOUR_SEGMENTS.map((s, j) => (j === k ? { ...s, move: undefined } : s)) : TOUR_SEGMENTS;
      playFrom(entryTime(k, segs.current, reduced), k > 0 ? { index: k, y } : undefined);
      asked.current = k;
      if (k === 0 && far) introUntil.current = performance.now() + FADE_OUT * 1000;
    },
    [playFrom, reduced],
  );

  const start = useCallback(() => goTo(0), [goTo]);

  const resume = useCallback(() => {
    const p = paused.current;
    if (!p || Math.abs(window.scrollY - p.y) > MOVED) {
      // La persona bajó por su cuenta: se retoma desde la sección que tiene en pantalla.
      goTo(segmentForScroll(window.scrollY, measure().tops, window.innerHeight));
    } else if (veilAt(p.t, segs.current, reduced) > 0) {
      // Se pausó a mitad de un fundido: se repite esa transición completa.
      goTo(segmentAt(p.t, segs.current, reduced));
    } else playFrom(p.t);
  }, [goTo, playFrom, reduced]);

  const stop = useCallback(() => {
    stopLoop();
    audio.current?.pause();
    silent.current = null;
    paused.current = null;
    clearEffects();
    setLoading(false);
    setStatus('idle');
    setProgress(0);
    setIndex(0);
    setText(TOUR_SEGMENTS[0].lines[0].text);
  }, []);

  // Un clic en el menú (o cualquier `#ancla`) mientras suena: la voz salta a esa sección; si la
  // voz no habla de esa sección, se pausa y el navegador baja normal.
  useEffect(() => {
    if (status !== 'playing') return undefined;
    const onAnchor = (event) => {
      const link = event.target.closest?.('a[href^="#"]');
      if (!link) return;
      const hash = link.getAttribute('href');
      const k = jumpFor(hash, TOUR_SEGMENTS);
      if (k < 0) {
        pause();
        return;
      }
      event.preventDefault();
      window.history.replaceState(window.history.state, '', hash);
      goTo(k);
    };
    document.addEventListener('click', onAnchor, true);
    return () => document.removeEventListener('click', onAnchor, true);
  }, [status, pause, goTo]);

  // Mientras suena: si la persona se mueve por su cuenta o la pestaña se oculta, se pausa; si
  // cambia el tamaño de la ventana, se vuelven a medir las secciones.
  useEffect(() => {
    if (status !== 'playing') return undefined;
    const onUser = (e) => {
      // Espacio o Enter sobre un botón lo activan, no mueven la página.
      if (e.type === 'keydown' && (!SCROLL_KEYS.has(e.key) || e.target.closest?.('button, a, input, textarea, select')))
        return;
      pause();
    };
    const onHide = () => {
      if (document.hidden) pause();
    };
    const onResize = () => {
      measured.current = measure();
    };
    window.addEventListener('wheel', onUser, { passive: true });
    window.addEventListener('touchmove', onUser, { passive: true });
    window.addEventListener('keydown', onUser);
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('wheel', onUser);
      window.removeEventListener('touchmove', onUser);
      window.removeEventListener('keydown', onUser);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [status, pause]);

  // Al salir de la página: se detiene el audio y el bucle, y se libera la copia local.
  useEffect(
    () => () => {
      stopLoop();
      audio.current?.pause();
      if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
    },
    [],
  );

  return { status, index, text, progress, muted, loading, veil, start, pause, resume, stop, goTo };
}
