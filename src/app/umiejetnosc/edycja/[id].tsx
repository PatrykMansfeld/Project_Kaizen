import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip, ChipRow } from '@/components/chip';
import { ColorSwatches } from '@/components/color-swatches';
import { EmojiBadge } from '@/components/emoji-badge';
import { EmojiPicker } from '@/components/emoji-picker';
import { HeaderTextButton } from '@/components/header';
import { ScrollScreen } from '@/components/screen';
import { Section } from '@/components/section';
import { TextField } from '@/components/text-field';
import { createSkill, deleteSkill, getSkill, updateSkill } from '@/db/skills';
import { GOAL_OPTIONS, SKILL_ICONS } from '@/features/skills/skills';
import { confirmDelete } from '@/lib/alerts';
import { useEditRecord } from '@/lib/use-edit-record';
import { PALETTE, PALETTE_KEYS, paletteColor, type PaletteKey } from '@/theme/palette';
import { useTheme } from '@/theme/use-theme';

type Form = { name: string; icon: string; color: PaletteKey; goalHours: number | null };

/** Nowa umiejętność: /umiejetnosc/edycja/nowa, edycja: /umiejetnosc/edycja/3. */
export default function SkillEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'nowa';
  const skillId = Number(id);

  const db = useSQLiteContext();
  const { dark } = useTheme();
  const [form, setForm] = useState<Form>({ name: '', icon: SKILL_ICONS[0], color: 'indigo', goalHours: 100 });

  const loaded = useEditRecord(isNew ? null : skillId, () => getSkill(db, skillId), (skill) => {
    setForm({
      name: skill.name,
      icon: skill.icon,
      color: (skill.color in PALETTE ? skill.color : 'indigo') as PaletteKey,
      goalHours: skill.goal_hours,
    });
  });

  const update = (patch: Partial<Form>) => setForm((current) => ({ ...current, ...patch }));
  const canSave = loaded && form.name.trim().length > 0;
  const color = paletteColor(form.color, dark);

  const save = async () => {
    if (!canSave) return;
    const input = { name: form.name.trim(), icon: form.icon, color: form.color, goal_hours: form.goalHours };
    if (isNew) await createSkill(db, input);
    else await updateSkill(db, skillId, input);
    router.back();
  };

  const remove = () =>
    confirmDelete('Usunąć umiejętność?', 'Wszystkie zapisane sesje też zostaną usunięte.', async () => {
      await deleteSkill(db, skillId);
      // Ekran szczegółów pod spodem sam się zamknie, gdy umiejętność zniknie.
      router.back();
    });

  return (
    <ScrollScreen
      title={isNew ? 'Nowa umiejętność' : 'Umiejętność'}
      headerRight={<HeaderTextButton onPress={save} disabled={!canSave} />}>
      {loaded ? (
        <>
          <View style={styles.preview}>
            <EmojiBadge emoji={form.icon} color={color} size={72} />
          </View>
          <TextField
            label="Nazwa"
            value={form.name}
            onChangeText={(name) => update({ name })}
            placeholder="np. Gitara, Angielski, Programowanie"
            autoFocus={isNew}
            maxLength={40}
          />
          <Section title="Cel">
            <ChipRow>
              <Chip label="Bez celu" selected={form.goalHours === null} onPress={() => update({ goalHours: null })} />
              {GOAL_OPTIONS.map((hours) => (
                <Chip key={hours} label={`${hours} h`} selected={form.goalHours === hours} onPress={() => update({ goalHours: hours })} />
              ))}
            </ChipRow>
          </Section>
          <Section title="Ikona">
            <EmojiPicker options={SKILL_ICONS} value={form.icon} onChange={(icon) => update({ icon })} color={color} />
          </Section>
          <Section title="Kolor">
            <ColorSwatches
              swatches={PALETTE_KEYS.map((key) => ({ key, label: PALETTE[key].label, color: paletteColor(key, dark) }))}
              value={form.color}
              onChange={(key) => update({ color: key })}
              checkColor="#FFFFFF"
            />
          </Section>
          {!isNew ? <Button label="Usuń umiejętność" variant="danger" icon="delete" onPress={remove} /> : null}
        </>
      ) : null}
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  preview: { alignItems: 'center' },
});
