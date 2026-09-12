import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { Button } from '@/components/button';
import { Chip, ChipRow } from '@/components/chip';
import { EmojiPicker } from '@/components/emoji-picker';
import { HeaderTextButton } from '@/components/header';
import { ScrollScreen } from '@/components/screen';
import { Section } from '@/components/section';
import { TextField } from '@/components/text-field';
import { createMeter, deleteMeter, getMeter, updateMeter } from '@/db/home';
import { METER_ICONS, METER_UNITS } from '@/features/home/home';
import { confirmDelete } from '@/lib/alerts';
import { useTheme } from '@/theme/use-theme';

/** Nowy licznik: /dom/licznik/edycja/nowy, edycja: /dom/licznik/edycja/2. */
export default function MeterEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'nowy';
  const meterId = Number(id);

  const db = useSQLiteContext();
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('kWh');
  const [icon, setIcon] = useState(METER_ICONS[0]);
  const [loaded, setLoaded] = useState(isNew);

  useEffect(() => {
    if (isNew) return;
    getMeter(db, meterId).then((meter) => {
      if (!meter) {
        router.back();
        return;
      }
      setName(meter.name);
      setUnit(meter.unit);
      setIcon(meter.icon);
      setLoaded(true);
    });
  }, [db, isNew, meterId]);

  const canSave = loaded && name.trim().length > 0 && unit.trim().length > 0;

  const save = async () => {
    if (!canSave) return;
    const input = { name: name.trim(), unit: unit.trim(), icon };
    if (isNew) {
      const created = await createMeter(db, input);
      // Nowy licznik od razu otwiera się ze szczegółami, żeby wpisać pierwszy odczyt.
      router.replace({ pathname: '/dom/licznik/[id]', params: { id: String(created) } });
    } else {
      await updateMeter(db, meterId, input);
      router.back();
    }
  };

  const remove = () =>
    confirmDelete('Usunąć licznik?', 'Wszystkie odczyty też zostaną usunięte.', async () => {
      await deleteMeter(db, meterId);
      router.back();
    });

  return (
    <ScrollScreen title={isNew ? 'Nowy licznik' : 'Licznik'} headerRight={<HeaderTextButton onPress={save} disabled={!canSave} />}>
      {loaded ? (
        <>
          <TextField label="Nazwa" value={name} onChangeText={setName} placeholder="np. Prąd, Woda zimna, Gaz" autoFocus={isNew} maxLength={40} />
          <Section title="Jednostka">
            <ChipRow>
              {METER_UNITS.map((option) => (
                <Chip key={option} label={option} selected={unit === option} onPress={() => setUnit(option)} />
              ))}
            </ChipRow>
            <TextField value={unit} onChangeText={setUnit} placeholder="albo wpisz własną" maxLength={10} autoCapitalize="none" />
          </Section>
          <Section title="Ikona">
            <EmojiPicker options={METER_ICONS} value={icon} onChange={setIcon} color={colors.notes} />
          </Section>
          {!isNew ? <Button label="Usuń licznik" variant="danger" icon="delete" onPress={remove} /> : null}
        </>
      ) : null}
    </ScrollScreen>
  );
}
