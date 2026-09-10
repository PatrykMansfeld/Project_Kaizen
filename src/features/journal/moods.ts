export const MOODS = [
  { value: 1, emoji: '😞', label: 'Źle' },
  { value: 2, emoji: '😕', label: 'Słabo' },
  { value: 3, emoji: '😐', label: 'Tak sobie' },
  { value: 4, emoji: '🙂', label: 'Dobrze' },
  { value: 5, emoji: '😄', label: 'Świetnie' },
] as const;

export function moodOf(value: number | null) {
  return MOODS.find((mood) => mood.value === value) ?? null;
}
