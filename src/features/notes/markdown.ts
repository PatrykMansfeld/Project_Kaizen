/**
 * Proste formatowanie notatek (podzbiór Markdown), zapisywane zwykłym tekstem:
 *   # Nagłówek   ## Podtytuł   **pogrubienie**   *kursywa*   - punkt   - [ ] zadanie   - [x] zrobione
 */

export type Block =
  | { kind: 'heading'; level: 1 | 2; text: string; line: number }
  | { kind: 'check'; done: boolean; text: string; line: number }
  | { kind: 'bullet'; text: string; line: number }
  | { kind: 'text'; text: string; line: number }
  | { kind: 'space'; line: number };

const CHECK = /^\s*[-*]\s+\[( |x|X)\]\s?(.*)$/;
const BULLET = /^\s*[-*]\s+(.*)$/;

export function parseMarkdown(body: string): Block[] {
  return body.split('\n').map((raw, line): Block => {
    if (raw.trim() === '') return { kind: 'space', line };
    let match = raw.match(/^##\s+(.*)$/);
    if (match) return { kind: 'heading', level: 2, text: match[1], line };
    match = raw.match(/^#\s+(.*)$/);
    if (match) return { kind: 'heading', level: 1, text: match[1], line };
    match = raw.match(CHECK);
    if (match) return { kind: 'check', done: match[1] !== ' ', text: match[2], line };
    match = raw.match(BULLET);
    if (match) return { kind: 'bullet', text: match[1], line };
    return { kind: 'text', text: raw, line };
  });
}

export type Inline = { text: string; bold?: boolean; italic?: boolean };

/** **pogrubienie** i *kursywa* w obrębie linii. */
export function parseInline(text: string): Inline[] {
  return text
    .split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/)
    .filter(Boolean)
    .map((part) => {
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return { text: part.slice(2, -2), bold: true };
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return { text: part.slice(1, -1), italic: true };
      return { text: part };
    });
}

/** Odhacza / odznacza zadanie z checklisty w danej linii. */
export function toggleCheckLine(body: string, line: number) {
  const lines = body.split('\n');
  lines[line] = lines[line].replace(/\[( |x|X)\]/, (box) => (box === '[ ]' ? '[x]' : '[ ]'));
  return lines.join('\n');
}

/** Tekst bez znaczników — do podglądu na liście i do wyszukiwania. */
export function stripMarkdown(text: string) {
  return text
    .split('\n')
    .map((line) =>
      line
        .replace(/^#{1,2}\s+/, '')
        .replace(CHECK, '$2')
        .replace(BULLET, '$1')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*\s][^*]*)\*/g, '$1'),
    )
    .join('\n');
}

/** Nagłówek i podgląd notatki na liście. Bez tytułu nagłówkiem jest pierwsza linia treści. */
export function notePreview(note: { title: string; body: string }) {
  const lines = stripMarkdown(note.body).split('\n').map((line) => line.trim()).filter(Boolean);
  const title = note.title.trim();
  if (title) return { headline: title, preview: lines.join(' ') };
  return { headline: lines[0] ?? 'Bez tytułu', preview: lines.slice(1).join(' ') };
}

export function checklistProgress(body: string) {
  const checks = parseMarkdown(body).filter((block) => block.kind === 'check');
  return { done: checks.filter((block) => block.kind === 'check' && block.done).length, total: checks.length };
}

export type Format = 'heading' | 'bold' | 'bullet' | 'check';
export type Selection = { start: number; end: number };

const PREFIXES: Record<Exclude<Format, 'bold'>, string> = { heading: '# ', bullet: '- ', check: '- [ ] ' };

/**
 * Przyciski paska narzędzi: nagłówek, punkt i zadanie przełączają przedrostek bieżącej linii,
 * pogrubienie otacza zaznaczenie gwiazdkami (albo wstawia je i stawia kursor w środku).
 */
export function applyFormat(body: string, selection: Selection, format: Format): { body: string; selection: Selection } {
  if (format === 'bold') {
    const { start, end } = selection;
    const inner = body.slice(start, end);
    const next = `${body.slice(0, start)}**${inner}**${body.slice(end)}`;
    return { body: next, selection: inner ? { start: start + 2, end: end + 2 } : { start: start + 2, end: start + 2 } };
  }
  const lineStart = body.lastIndexOf('\n', selection.start - 1) + 1;
  const lineEnd = body.indexOf('\n', lineStart) === -1 ? body.length : body.indexOf('\n', lineStart);
  const line = body.slice(lineStart, lineEnd);
  const prefix = PREFIXES[format];
  // Zdejmujemy każdy istniejący przedrostek; ten sam przycisk drugi raz = wyłączenie.
  const existing = line.match(/^(#{1,2}\s+|\s*[-*]\s+\[[ xX]\]\s?|\s*[-*]\s+)/)?.[0] ?? '';
  const stripped = line.slice(existing.length);
  const newLine = existing === prefix ? stripped : prefix + stripped;
  const delta = newLine.length - line.length;
  const cursor = Math.max(lineStart, selection.start + delta);
  return {
    body: body.slice(0, lineStart) + newLine + body.slice(lineEnd),
    selection: { start: cursor, end: cursor },
  };
}
