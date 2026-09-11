/** Kolory do wyboru przez użytkownika (nawyki, tagi). W bazie zapisujemy klucz, np. 'green'. */
export const PALETTE = {
  green: { label: 'Zielony', light: '#30A46C', dark: '#3DD68C' },
  teal: { label: 'Morski', light: '#12A594', dark: '#0BD8B6' },
  blue: { label: 'Niebieski', light: '#0090FF', dark: '#3B9EFF' },
  indigo: { label: 'Indygo', light: '#3E63DD', dark: '#849DFF' },
  purple: { label: 'Fioletowy', light: '#8E4EC6', dark: '#BF7AF0' },
  pink: { label: 'Różowy', light: '#D6409F', dark: '#F76AC8' },
  red: { label: 'Czerwony', light: '#E5484D', dark: '#FF6369' },
  orange: { label: 'Pomarańczowy', light: '#F76B15', dark: '#FF8B3E' },
  yellow: { label: 'Żółty', light: '#C99A0A', dark: '#F5C451' },
} as const;

export type PaletteKey = keyof typeof PALETTE;

export const PALETTE_KEYS = Object.keys(PALETTE) as PaletteKey[];

export function paletteColor(key: string, dark: boolean) {
  const color = PALETTE[key as PaletteKey] ?? PALETTE.green;
  return dark ? color.dark : color.light;
}
