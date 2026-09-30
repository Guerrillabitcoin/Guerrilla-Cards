/**
 * Pegado morfosintáctico ES para Guerrilla Cards.
 *
 * Corrige de+el / a+el / y+i / o+o, quita palabras repetidas
 * y adapta el display según el hueco: nombre, #hashtag, @handle,
 * email, www.url.com, archivo, «título», censura, tachado, siglas.
 *
 * Norma webs (el hueco tiene que TOCAR el truco):
 * - www._______.es  /  wwww._______.net  → url
 * - ________.com  /  www.________.madrid.es → url
 * - _____._____.com → los DOS huecos url (cadena .hueco.tld)
 * - @_______ solo (Telegram, X) → handle
 * - ______@gmail.com  /  pepito@____.com  /  ______@_____.com → email
 * - El 2º hueco de una frase (“chantajearme con ______”) se queda plano.
 * Un punto final de frase NUNCA activa título. Título solo con «______» o "______".
 */

export type SlotKind = 'np' | 'inf' | 'loc' | 'prep' | 'adj' | 'any';

export type SlotStyle =
  | 'plain'
  | 'proper'
  | 'hashtag'
  | 'handle'
  | 'password'
  | 'url'
  | 'email'
  | 'file'
  | 'upper'
  | 'censor'
  | 'strike'
  | 'acronym';

export type FillPart = {
  kind: 'text' | 'answer' | 'blank';
  text: string;
};

export type GlueResult = {
  text: string;
  eatLeft?: string;
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
const LAST_WORD_RE = /([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)$/u;

function firstWord(s: string): string {
  const m = s.trim().match(FIRST_WORD_RE);
  return m ? m[1].toLocaleLowerCase('es-ES') : '';
}

function lastWord(s: string): string {
  const m = s.trim().match(LAST_WORD_RE);
  return m ? m[1].toLocaleLowerCase('es-ES') : '';
}

function restAfterFirstWord(s: string): string {
  const t = s.trim();
  const m = t.match(FIRST_WORD_RE);
  if (!m) return t;
  return t.slice(m[0].length).replace(/^\s+/u, '');
}

function restBeforeLastWord(s: string): string {
  const t = s.trim();
  const m = t.match(LAST_WORD_RE);
  if (!m) return t;
  return t.slice(0, t.length - m[0].length).replace(/\s+$/u, '');
}

function lastTokenBefore(promptText: string, offset: number): string {
  const before = promptText.slice(0, offset).replace(/\s+$/u, '');
  const m = before.match(LAST_WORD_RE);
  return m ? m[1].toLocaleLowerCase('es-ES') : '';
}

function tokenBeforeLast(promptText: string, offset: number): string {
  const before = promptText.slice(0, offset).replace(/\s+$/u, '');
  const parts = before.match(
    /([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)$/u,
  );
  return parts ? parts[1].toLocaleLowerCase('es-ES') : '';
}

function firstTokenAfter(
  promptText: string,
  offset: number,
  blankLen: number,
): string {
  const after = promptText.slice(offset + blankLen).replace(/^\s+/u, '');
  const m = after.match(FIRST_WORD_RE);
  return m ? m[1].toLocaleLowerCase('es-ES') : '';
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

export function toAcronym(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  const letters = trimmed
    .split(/\s+/u)
    .filter(Boolean)
    .map((w) => {
      const core = w.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/gu, '');
      return core ? core.charAt(0).toLocaleUpperCase('es-ES') : '';
    })
    .filter(Boolean);
  if (!letters.length) return trimmed;
  return `${letters.join('.')}. (${toProperName(trimmed)})`;
}

export function censorText(text: string): string {
  return text
    .trim()
    .split(/\s+/u)
    .map((w) => {
      const chars = Array.from(w);
      if (!chars.length) return w;
      if (chars.length === 1) return chars[0];
      return chars[0] + '*'.repeat(chars.length - 1);
    })
    .join(' ');
}

export function strikeText(text: string): string {
  return Array.from(text)
    .map((ch) => (ch === ' ' || ch === '\n' ? ch : `${ch}\u0336`))
    .join('');
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
  'san',
  'santo',
  'santa',
  'santos',
  'santas',
  'beato',
  'beata',
  'virgen',
  'calle',
  'avenida',
  'plaza',
  'paseo',
  'travesía',
  'travesia',
  'carretera',
  'ronda',
  'glorieta',
  'iglesia',
  'catedral',
  'ermita',
  'capilla',
  'basílica',
  'basilica',
  'hospital',
  'clínica',
  'clinica',
  'colegio',
  'instituto',
  'ies',
  'universidad',
  'estación',
  'estacion',
  'parada',
  'metro',
  'río',
  'rio',
  'monte',
  'pico',
  'sierra',
  'patrón',
  'patron',
  'patrona',
  'bautizado',
  'bautizada',
  'apellida',
  'apellido',
]);

const SECRET_RE =
  /\b(contraseñ[ao]s?|password|passwd|clave|pin|usuario|username|user|login|email|e-mail|correo|nick|nickname|alias)\b/i;

const TLD_CORE =
  'com|es|org|net|io|app|dev|info|tv|me|xyz|online|site|gob|edu|eus|cat|gal';

const TLD_RE = new RegExp(`^\\.(?:${TLD_CORE})\\b`, 'i');

const FILE_EXT_RE =
  /^\.(pdf|jpg|jpeg|exe|zip|mp3|xls|xlsx|txt|mp4|gif)\b/i;

const URL_AROUND_RE =
  /\b(www\.|https?:\/\/|p[aá]gina web|sitio web|\burl\b|enlace|dominio|\.com\b|\.es\b|\.org\b)/i;

const CENSOR_RE = /\b(censurad[oa]s?|censura|asteriscos?)\b/i;
const STRIKE_RE = /\b(tachad[oa]s?|tach[oó]n(?:es)?|tachar)\b/i;
const ACRONYM_RE = /\b(siglas?|acr[oó]nimos?)\b/i;

function isDomainRight(right: string): boolean {
  const r = right.replace(/^\s+/u, '');
  if (TLD_RE.test(r)) return true;
  if (FILE_EXT_RE.test(r)) return false;
  if (/^\._+\./.test(r) && new RegExp(`\\.(?:${TLD_CORE})\\b`, 'i').test(r)) {
    return true;
  }
  if (new RegExp(`^[a-z0-9-]*\\.(?:${TLD_CORE})\\b`, 'i').test(r)) return true;
  if (new RegExp(`^\\.[a-z0-9-]+\\.(?:${TLD_CORE})\\b`, 'i').test(r)) {
    return true;
  }
  return false;
}

function isUrlChainRight(right: string): boolean {
  const r = right.replace(/^\s+/u, '');
  if (TLD_RE.test(r)) return true;
  if (/^\._+\./.test(r) && new RegExp(`\\.(?:${TLD_CORE})\\b`, 'i').test(r)) {
    return true;
  }
  if (new RegExp(`^\\.[a-z0-9_-]+\\.(?:${TLD_CORE})\\b`, 'i').test(r)) {
    return true;
  }
  return false;
}

export function detectSlotStyle(
  promptText: string,
  offset: number,
  blankLen = 6,
): SlotStyle {
  const leftRaw = promptText.slice(0, offset);
  const rightRaw = promptText.slice(offset + blankLen);
  const left = leftRaw.replace(/\s+$/u, '');
  const right = rightRaw.replace(/^\s+/u, '');
  const aroundNear = `${left.split(/\s+/u).slice(-4).join(' ')} ${right.split(/\s+/u).slice(0, 3).join(' ')}`;
  const around = aroundNear;

  if (/#$/.test(left)) return 'hashtag';

  if (/^@/.test(right)) return 'email';

  if (/@$/.test(left)) {
    if (isDomainRight(right) || isUrlChainRight(right)) return 'email';
    return 'handle';
  }

  if (FILE_EXT_RE.test(right)) return 'file';

  if (
    /w{3,}\.$/i.test(left) ||
    /https?:\/\/$/i.test(left) ||
    isUrlChainRight(right) ||
    (/\/$/.test(left) && URL_AROUND_RE.test(`${leftRaw} ${rightRaw}`))
  ) {
    return 'url';
  }

  if (/\*+$/.test(left) && /^\*+/.test(right)) return 'censor';
  if (CENSOR_RE.test(around)) return 'censor';

  if (/~{1,2}$/.test(left) && /^~{1,2}/.test(right)) return 'strike';
  if (STRIKE_RE.test(around)) return 'strike';

  if (ACRONYM_RE.test(around)) return 'acronym';

  const wrapped = /["“”«»']$/.test(left) || /^["“”«»']/.test(right);
  if (SECRET_RE.test(around) && wrapped) return 'password';
  if (SECRET_RE.test(around)) return 'password';

  if (wrapped) return 'proper';

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
    case 'email':
    case 'file':
      return slugify(t);
    case 'proper':
      return toProperName(t);
    case 'upper':
      return t.toLocaleUpperCase('es-ES');
    case 'censor':
      return censorText(t);
    case 'strike':
      return strikeText(t);
    case 'acronym':
      return toAcronym(t);
    default:
      return t;
  }
}

export function glueAnswer(
  promptText: string,
  offset: number,
  rawAnswer: string,
  _slot: SlotKind = 'any',
  blankLen = 6,
): GlueResult {
  let answer = (rawAnswer ?? '').trim();
  if (!answer) return { text: answer };

  const left = lastTokenBefore(promptText, offset);
  const left2 = tokenBeforeLast(promptText, offset);
  const right = firstTokenAfter(promptText, offset, blankLen);
  const head = firstWord(answer);
  const tail = lastWord(answer);

  if (left === 'y' && /^h?i/i.test(head)) {
    return { text: `e ${answer}`, eatLeft: 'y' };
  }
  if (left === 'o' && /^h?o/i.test(head)) {
    return { text: `u ${answer}`, eatLeft: 'o' };
  }

  if (left && head && left === head) {
    const stripped = stripLeading(answer, head);
    if (stripped) answer = stripped;
  }
  if (left && ARTICLES.has(left) && ARTICLES.has(firstWord(answer))) {
    const stripped = stripLeading(answer, firstWord(answer));
    if (stripped) answer = stripped;
  }
  if (right && tail && right === tail) {
    const stripped = restBeforeLastWord(answer);
    if (stripped) answer = stripped;
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

function eatLeftFromText(text: string, token: string): string {
  return text.replace(new RegExp(`\\s*${token}\\s*$`, 'iu'), ' ');
}

const SLUG_STYLES = new Set<SlotStyle>([
  'hashtag',
  'handle',
  'url',
  'email',
  'file',
]);

const SKIP_CAP = new Set<SlotStyle>([
  'hashtag',
  'handle',
  'password',
  'url',
  'email',
  'file',
  'upper',
  'censor',
  'strike',
  'acronym',
]);

export function fillBlankPartsGlued(
  promptText: string,
  answers: string[],
): FillPart[] {
  const parts: FillPart[] = [];
  const re = /_+/g;
  let last = 0;
  let idx = 0;
  let m: RegExpExecArray | null;
  let eatRightWrap: RegExp | null = null;
  while ((m = re.exec(promptText))) {
    let leftText = m.index > last ? promptText.slice(last, m.index) : '';
    if (eatRightWrap) {
      leftText = leftText.replace(eatRightWrap, '');
      eatRightWrap = null;
    }
    const raw = answers[idx];
    if (raw === undefined || raw === '______') {
      if (leftText) parts.push({ kind: 'text', text: leftText });
      parts.push({ kind: 'blank', text: m[0] });
    } else {
      const style = detectSlotStyle(promptText, m.index, m[0].length);
      const glued = glueAnswer(promptText, m.index, raw, 'any', m[0].length);
      if (glued.eatLeft) leftText = eatLeftFromText(leftText, glued.eatLeft);
      const glueLeft = /(@|#|\/|w{3,}\.|\.)$/i.test(leftText.replace(/\s+$/u, ''));
      if (SLUG_STYLES.has(style) && glueLeft) {
        leftText = leftText.replace(/\s+$/u, '');
      }
      if (style === 'censor') {
        leftText = leftText.replace(/\*+\s*$/u, '');
        eatRightWrap = /^\s*\*+/u;
      }
      if (style === 'strike') {
        leftText = leftText.replace(/~{1,2}\s*$/u, '');
        eatRightWrap = /^\s*~{1,2}/u;
      }
      if (leftText) parts.push({ kind: 'text', text: leftText });
      const styled = applySlotStyle(glued.text, style);
      const before = promptText.slice(0, m.index).replace(/\s+$/u, '');
      const atSentenceStart =
        before.length === 0 || /[.!?…¡¿]\s*$/u.test(before);
      parts.push({
        kind: 'answer',
        text: atSentenceStart && !SKIP_CAP.has(style) ? capitalizeAnswer(styled) : styled,
      });
    }
    idx++;
    last = m.index + m[0].length;
  }
  if (last < promptText.length) {
    let tail = promptText.slice(last);
    if (eatRightWrap) tail = tail.replace(eatRightWrap, '');
    parts.push({ kind: 'text', text: tail });
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
    .replace(/w{3,}\.\s+/gi, (s) => s.replace(/\s+/g, ''))
    .replace(new RegExp(`\\s+\\.(${TLD_CORE})\\b`, 'gi'), '.$1')
    .replace(/\s+\.(pdf|jpg|jpeg|exe|zip|mp3|xls|xlsx|txt|mp4|gif)\b/gi, '.$1')
    .replace(/@\s+/g, '@');
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
  {
    prompt: 'Mi página web personal es _____._____.com',
    answers: ['un pene más pequeño', 'el metro en hora punta'],
    raw: 'Mi página web personal es un pene más pequeño.el metro en hora punta.com',
    glued: 'Mi página web personal es unpenemaspequeno.elmetroenhorapunta.com',
  },
  {
    prompt: 'Escríbeme a ______@gmail.com',
    answers: ['un pene más pequeño'],
    raw: 'Escríbeme a un pene más pequeño@gmail.com',
    glued: 'Escríbeme a unpenemaspequeno@gmail.com',
  },
  {
    prompt: 'El correo es pepito@______.com',
    answers: ['un pene más pequeño'],
    raw: 'El correo es pepito@un pene más pequeño.com',
    glued: 'El correo es pepito@unpenemaspequeno.com',
  },
  {
    prompt: 'El pack va a ______@______.com',
    answers: ['un pene más pequeño', 'el metro en hora punta'],
    raw: 'El pack va a un pene más pequeño@el metro en hora punta.com',
    glued: 'El pack va a unpenemaspequeno@elmetroenhorapunta.com',
  },
  {
    prompt: 'No abras ______.pdf',
    answers: ['un pene más pequeño'],
    raw: 'No abras un pene más pequeño.pdf',
    glued: 'No abras unpenemaspequeno.pdf',
  },
  {
    prompt: 'Película ganadora: «______».',
    answers: ['un pene más pequeño'],
    raw: 'Película ganadora: «un pene más pequeño».',
    glued: 'Película ganadora: «Un Pene Más Pequeño».',
  },
  {
    prompt: 'Versión censurada: ______.',
    answers: ['un pene más pequeño'],
    raw: 'Versión censurada: un pene más pequeño.',
    glued: 'Versión censurada: u* p*** m** p*******.',
  },
  {
    prompt: 'En el atestado, tachado: ______.',
    answers: ['un pene más pequeño'],
    raw: 'En el atestado, tachado: un pene más pequeño.',
    glued: 'STRIKE',
  },
  {
    prompt: 'Las siglas oficiales son ______.',
    answers: ['un pene más pequeño'],
    raw: 'Las siglas oficiales son un pene más pequeño.',
    glued: 'Las siglas oficiales son U.P.M.P. (Un Pene Más Pequeño).',
  },
  {
    prompt: 'Padres y ______.',
    answers: ['hijos adoptivos'],
    raw: 'Padres y hijos adoptivos.',
    glued: 'Padres e hijos adoptivos.',
  },
  {
    prompt: 'Uno o ______.',
    answers: ['otro desastre'],
    raw: 'Uno o otro desastre.',
    glued: 'Uno u otro desastre.',
  },
  {
    prompt: 'El Ayuntamiento ha lanzado la sede electrónica www.________.madrid.es.',
    answers: ['un pene más pequeño'],
    raw: 'El Ayuntamiento ha lanzado la sede electrónica www.un pene más pequeño.madrid.es.',
    glued:
      'El Ayuntamiento ha lanzado la sede electrónica www.unpenemaspequeno.madrid.es.',
  },
  {
    prompt: 'Me contactó un usuario llamado @_______ para chantajearme con ________.',
    answers: ['un pene más pequeño', 'las facturas de la luz'],
    raw: 'Me contactó un usuario llamado @un pene más pequeño para chantajearme con las facturas de la luz.',
    glued:
      'Me contactó un usuario llamado @unpenemaspequeno para chantajearme con las facturas de la luz.',
  },
];
