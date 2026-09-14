/**
 * Pegado morfosintáctico ES para Guerrilla Cards.
 *
 * Corrige de+el / a+el / en+en / la+la y adapta mayúsculas
 * según el hueco: nombre, #hashtag, contraseña, www.url.com/ruta.
 */

export type SlotKind = 'np' | 'inf' | 'loc' | 'prep' | 'adj' | 'any';

export type SlotStyle =
  | 'plain'
  | 'proper'
  | 'hashtag'
  | 'handle'
  | 'password'
  | 'url'
  | 'upper';

export type FillPart = {
  kind: 'text' | 'answer' | 'blank';
  text: string;
};

export type GlueResult = {
  text: string;
  eatLeft?: 'de' | 'a';
};

const ARTICLES = new Set([
  'el',
  'la',
  'los',
  'las',
  'un',
  'una',
  'unos',
  'unas',
  'lo',
  'al',
  'del',
]);

const PREPS = new Set([
  'a',
  'ante',
  'bajo',
  'con',
  'contra',
  'de',
  'desde',
  'en',
  'entre',
  'hacia',
  'hasta',
  'para',
  'por',
  'según',
  'sin',
  'sobre',
  'tras',
]);

const PERIFRASIS_A = new Set([
  'ir',
  'voy',
  'vas',
  'va',
  'vamos',
  'vais',
  'van',
  'iba',
  'ibas',
  'íbamos',
  'iban',
  'iré',
  'irá',
  'iremos',
  'irán',
  'iría',
  'iríamos',
  'irse',
  'empezar',
  'empecé',
  'empezó',
  'empezamos',
  'empiezo',
  'empieza',
  'empiezan',
  'volver',
  'volví',
  'volvió',
  'vuelvo',
  'vuelve',
  'vuelven',
  'volverme',
  'aprender',
  'aprende',
  'aprenderá',
  'obligar',
  'obligaron',
  'obligaban',
  'obligado',
  'ayudar',
  'ayudó',
  'ayuda',
  'ponerse',
  'puso',
  'puse',
  'llegar',
  'llegó',
  'llegué',
  'dedicar',
  'dedico',
  'dedica',
  'acostumbrar',
  'negarse',
  'negué',
]);

const FIRST_WORD_RE = /^([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)/u;

function firstWord(s: string): string {
  const m = s.trim().match(FIRST_WORD_RE);
  return m ? m[1].toLocaleLowerCase('es-ES') : '';
}

function restAfterFirstWord(s: string): string {
  const t = s.trim();
  const m = t.match(FIRST_WORD_RE);
  if (!m) return t;
  return t.slice(m[0].length).replace(/^\s+/u, '');
}

function lastTokenBefore(promptText: string, offset: number): string {
  const before = promptText.slice(0, offset).replace(/\s+$/u, '');
  const m = before.match(/([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)$/u);
  return m ? m[1].toLocaleLowerCase('es-ES') : '';
}

function tokenBeforeLast(promptText: string, offset: number): string {
  const before = promptText.slice(0, offset).replace(/\s+$/u, '');
  const parts = before.match(
    /([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)$/u,
  );
  return parts ? parts[1].toLocaleLowerCase('es-ES') : '';
}

function stripLeading(s: string, word: string): string {
  return s.trim().replace(new RegExp(`^${word}\\s+`, 'iu'), '');
}

export function capitalizeAnswer(text: string): string {
  const t = text.trim();
  if (!t) return t;
  return t.charAt(0).toLocaleUpperCase('es-ES') + t.slice(1);
}

const NAME_SMALL = new Set([
  'de',
  'del',
  'la',
  'las',
  'los',
  'el',
  'en',
  'y',
  'e',
  'i',
  'o',
  'u',
  'da',
  'do',
  'van',
  'von',
]);

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-ES')
    .replace(/[^a-z0-9]/g, '');
}

export function toProperName(text: string): string {
  return text
    .trim()
    .split(/\s+/u)
    .filter(Boolean)
    .map((w, i) => {
      const lower = w.toLocaleLowerCase('es-ES');
      const core = lower.replace(
        /^[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+|[^\wÁÉÍÓÚÜÑáéíóúüñ]+$/gu,
        '',
      );
      if (i > 0 && NAME_SMALL.has(core)) return lower;
      if (!core) return w;
      return core.charAt(0).toLocaleUpperCase('es-ES') + core.slice(1);
    })
    .join(' ');
}

const PROPER_LEFT = new Set([
  'soy',
  'eres',
  'somos',
  'sois',
  'llamo',
  'llamas',
  'llama',
  'llamamos',
  'llaman',
  'llamaba',
  'llamaban',
  'llamará',
  'llamado',
  'llamada',
  'llamados',
  'llamadas',
  'señor',
  'señora',
  'senor',
  'senora',
  'don',
  'doña',
  'dona',
  'sr',
  'sra',
  'srta',
]);

const SECRET_RE =
  /\b(contraseñ[ao]s?|password|passwd|clave|pin|usuario|username|user|login|email|e-mail|correo|nick|nickname|alias)\b/i;

const TLD_RE =
  /^\.(com|es|org|net|io|app|dev|info|tv|me|xyz|online|site|gob|edu|eus|cat|gal)\b/i;

const URL_AROUND_RE =
  /\b(www\.|https?:\/\/|p[aá]gina web|sitio web|\burl\b|enlace|dominio|\.com\b|\.es\b|\.org\b)/i;

export function detectSlotStyle(
  promptText: string,
  offset: number,
  blankLen = 6,
): SlotStyle {
  const leftRaw = promptText.slice(0, offset);
  const rightRaw = promptText.slice(offset + blankLen);
  const left = leftRaw.replace(/\s+$/u, '');
  const right = rightRaw.replace(/^\s+/u, '');
  const around = `${leftRaw.slice(-90)} ${rightRaw.slice(0, 40)}`;

  if (/#$/.test(left)) return 'hashtag';
  if (/@$/.test(left)) return 'handle';

  if (
    /www\.$/i.test(left) ||
    /https?:\/\/$/i.test(left) ||
    TLD_RE.test(right) ||
    (/\/$/.test(left) && URL_AROUND_RE.test(`${leftRaw} ${rightRaw}`))
  ) {
    return 'url';
  }

  const wrapped = /["“”«»']$/.test(left) || /^["“”«»']/.test(right);
  if (SECRET_RE.test(around) && wrapped) return 'password';
  if (SECRET_RE.test(around)) return 'password';

  if (/\b(hashtag|trending|trending topic|en twitter|en x\.com|tuit)\b/i.test(around)) {
    return 'hashtag';
  }

  const last = lastTokenBefore(promptText, offset);
  const prev = tokenBeforeLast(promptText, offset);
  if (PROPER_LEFT.has(last)) return 'proper';
  if (
    ['llamo', 'llamas', 'llama', 'llamaba', 'llamará'].includes(last) &&
    ['me', 'te', 'se', 'nos', 'os'].includes(prev)
  ) {
    return 'proper';
  }
  if (/\b(me|te|se)\s+llama/i.test(left) || /\bhola[,.]?\s+soy$/i.test(left)) {
    return 'proper';
  }

  if (/¡[^¡]*$/.test(left) && /^!/.test(right)) return 'upper';

  return 'plain';
}

export function applySlotStyle(text: string, style: SlotStyle): string {
  const t = text.trim();
  if (!t) return t;
  switch (style) {
    case 'hashtag':
    case 'handle':
    case 'password':
    case 'url':
      return slugify(t);
    case 'proper':
      return toProperName(t);
    case 'upper':
      return t.toLocaleUpperCase('es-ES');
    default:
      return t;
  }
}

export function glueAnswer(
  promptText: string,
  offset: number,
  rawAnswer: string,
  _slot: SlotKind = 'any',
): GlueResult {
  let answer = (rawAnswer ?? '').trim();
  if (!answer) return { text: answer };

  const left = lastTokenBefore(promptText, offset);
  const left2 = tokenBeforeLast(promptText, offset);
  const head = firstWord(answer);

  if (left && PREPS.has(left) && head === left) {
    answer = stripLeading(answer, head);
  }
  if (left && ARTICLES.has(left) && ARTICLES.has(firstWord(answer))) {
    answer = stripLeading(answer, firstWord(answer));
  }
  if (left === 'de' && firstWord(answer) === 'el') {
    const rest = restAfterFirstWord(answer);
    return { text: rest ? `del ${rest}` : 'del', eatLeft: 'de' };
  }
  if (left === 'a' && firstWord(answer) === 'el' && !PERIFRASIS_A.has(left2)) {
    const rest = restAfterFirstWord(answer);
    return { text: rest ? `al ${rest}` : 'al', eatLeft: 'a' };
  }
  return { text: answer };
}

function eatLeftFromText(text: string, token: 'de' | 'a'): string {
  return text.replace(new RegExp(`\\s*${token}\\s*$`, 'iu'), ' ');
}

export function fillBlankPartsGlued(
  promptText: string,
  answers: string[],
): FillPart[] {
  const parts: FillPart[] = [];
  const re = /_+/g;
  let last = 0;
  let idx = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(promptText))) {
    let leftText = m.index > last ? promptText.slice(last, m.index) : '';
    const raw = answers[idx];
    if (raw === undefined || raw === '______') {
      if (leftText) parts.push({ kind: 'text', text: leftText });
      parts.push({ kind: 'blank', text: m[0] });
    } else {
      const style = detectSlotStyle(promptText, m.index, m[0].length);
      const glued = glueAnswer(promptText, m.index, raw);
      if (glued.eatLeft) leftText = eatLeftFromText(leftText, glued.eatLeft);
      if (style === 'hashtag' || style === 'handle' || style === 'url') {
        leftText = leftText.replace(/\s+$/u, '');
      }
      if (leftText) parts.push({ kind: 'text', text: leftText });
      const styled = applySlotStyle(glued.text, style);
      const before = promptText.slice(0, m.index).replace(/\s+$/u, '');
      const atSentenceStart =
        before.length === 0 || /[.!?…¡¿]\s*$/u.test(before);
      const skipCap =
        style === 'hashtag' ||
        style === 'handle' ||
        style === 'password' ||
        style === 'url' ||
        style === 'upper';
      parts.push({
        kind: 'answer',
        text: atSentenceStart && !skipCap ? capitalizeAnswer(styled) : styled,
      });
    }
    idx++;
    last = m.index + m[0].length;
  }
  if (last < promptText.length) {
    parts.push({ kind: 'text', text: promptText.slice(last) });
  }
  if (idx === 0 && answers.length) {
    return [
      { kind: 'text', text: `${promptText} ` },
      {
        kind: 'answer',
        text: answers
          .filter((a) => a && a !== '______')
          .map((a) => capitalizeAnswer(a))
          .join(' / '),
      },
    ];
  }
  return parts;
}

export function fillBlankGlued(promptText: string, answers: string[]): string {
  return fillBlankPartsGlued(promptText, answers)
    .map((p) => p.text)
    .join('')
    .replace(/[ \t]+/g, ' ')
    .replace(/ +([.,;:!?…])/g, '$1')
    .replace(/\s+\//g, '/')
    .replace(/www\.\s+/gi, 'www.')
    .replace(/\s+\.(com|es|org|net|io)\b/gi, '.$1');
}

export const GLUE_EXAMPLES: Array<{
  prompt: string;
  answers: string[];
  raw: string;
  glued: string;
}> = [
  {
    prompt: 'Quedé con ______ y acabamos en ______.',
    answers: ['Pepe Viyuela', 'en plena Gran Vía'],
    raw: 'Quedé con Pepe Viyuela y acabamos en en plena Gran Vía.',
    glued: 'Quedé con Pepe Viyuela y acabamos en plena Gran Vía.',
  },
  {
    prompt: 'Conseguí este reloj a cambio de ______.',
    answers: ['el metro en hora punta'],
    raw: 'Conseguí este reloj a cambio de el metro en hora punta.',
    glued: 'Conseguí este reloj a cambio del metro en hora punta.',
  },
  {
    prompt: 'Hola, soy ______.',
    answers: ['un pene más pequeño'],
    raw: 'Hola, soy un pene más pequeño.',
    glued: 'Hola, soy Un Pene Más Pequeño.',
  },
  {
    prompt: 'El peor día de mi vida #______',
    answers: ['un pene más pequeño'],
    raw: 'El peor día de mi vida #un pene más pequeño',
    glued: 'El peor día de mi vida #unpenemaspequeno',
  },
  {
    prompt: 'Mi contraseña es "______".',
    answers: ['un pene más pequeño'],
    raw: 'Mi contraseña es "un pene más pequeño".',
    glued: 'Mi contraseña es "unpenemaspequeno".',
  },
  {
    prompt: 'Visita www.______.com/______',
    answers: ['un pene más pequeño', 'el metro en hora punta'],
    raw: 'Visita www.un pene más pequeño.com/el metro en hora punta',
    glued: 'Visita www.unpenemaspequeno.com/elmetroenhorapunta',
  },
];
