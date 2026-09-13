import React, { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { getPlayablePackMeta } from '../engine/deck';
import type { Card, CardType } from '../engine/types';
import { useAdmin } from '../store/AdminContext';
import { useTheme } from '../store/ThemeContext';

type Mode =
  | 'menu'
  | 'unlock'
  | 'edit'
  | 'add'
  | 'list';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Prefill edit target (prompt or hand card) */
  editTarget?: Card | null;
  /** Pack ids of current match — preferred for adds */
  preferredPackIds?: string[];
  /** After edit/add, parent can refresh live game */
  onCardEdited?: (cardId: string, text: string, pick?: number) => void;
  onCardAdded?: (card: {
    id: string;
    type: CardType;
    text: string;
    pick: number;
    packId: string;
  }) => void;
  startMode?: Mode;
};

export function AdminPanel({
  visible,
  onClose,
  editTarget,
  preferredPackIds,
  onCardEdited,
  onCardAdded,
  startMode,
}: Props) {
  const { colors, fontFamily } = useTheme();
  const {
    unlocked,
    unlock,
    lock,
    patches,
    patchCount,
    editCard,
    addCard,
    removeEdit,
    removeAdd,
    clearAllPatches,
    getExportJson,
  } = useAdmin();

  const [mode, setMode] = useState<Mode>(
    startMode ?? (unlocked ? 'menu' : 'unlock')
  );
  const [pin, setPin] = useState('');
  const [text, setText] = useState(editTarget?.text ?? '');
  const [pick, setPick] = useState(String(editTarget?.pick ?? 1));
  const [addType, setAddType] = useState<CardType>(
    editTarget?.type === 'prompt' ? 'prompt' : 'answer'
  );
  const packs = useMemo(() => getPlayablePackMeta(), []);
  const defaultPack =
    preferredPackIds?.find((id) => packs.some((p) => p.id === id)) ??
    packs[0]?.id ??
    'core';
  const [packId, setPackId] = useState(defaultPack);

  React.useEffect(() => {
    if (!visible) return;
    setMode(startMode ?? (unlocked ? (editTarget ? 'edit' : 'menu') : 'unlock'));
    setText(editTarget?.text ?? '');
    setPick(String(editTarget?.pick ?? 1));
    if (editTarget?.type) setAddType(editTarget.type);
    setPackId(defaultPack);
    setPin('');
  }, [visible, unlocked, editTarget, startMode, defaultPack]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        backdrop: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.55)',
          justifyContent: 'center',
          padding: 16,
        },
        sheet: {
          backgroundColor: colors.bgElevated,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 6,
          maxHeight: '92%',
          padding: 14,
          gap: 10,
        },
        title: {
          color: colors.text,
          fontFamily,
          fontWeight: '900',
          fontSize: 16,
        },
        muted: { color: colors.textMuted, fontFamily, fontSize: 12 },
        input: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.bgCard,
          color: colors.text,
          fontFamily,
          borderRadius: 4,
          padding: 10,
          minHeight: 44,
          textAlignVertical: 'top',
        },
        row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
        btn: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.bgCard,
          borderRadius: 4,
          paddingHorizontal: 10,
          paddingVertical: 8,
        },
        btnPrimary: {
          backgroundColor: colors.accent,
          borderColor: colors.accent,
        },
        btnText: {
          color: colors.text,
          fontFamily,
          fontWeight: '800',
          fontSize: 12,
        },
        btnTextOn: { color: '#fff' },
        chipOn: {
          backgroundColor: colors.accent,
          borderColor: colors.accent,
        },
        listItem: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 4,
          padding: 8,
          gap: 4,
          marginBottom: 6,
        },
      }),
    [colors, fontFamily]
  );

  const tryUnlock = () => {
    if (unlock(pin)) {
      setMode(editTarget ? 'edit' : 'menu');
      setPin('');
    } else {
      Alert.alert('PIN incorrecto', 'Prueba otra vez.');
    }
  };

  const saveEdit = () => {
    if (!editTarget) {
      setMode('menu');
      return;
    }
    const p = editTarget.type === 'prompt' ? Math.max(1, parseInt(pick, 10) || 1) : undefined;
    editCard(editTarget.id, text, p);
    onCardEdited?.(editTarget.id, text.trim(), p);
    Alert.alert('Guardado', 'Parche local aplicado. Exporta cuando quieras subir al mazo live.');
    setMode('menu');
  };

  const saveAdd = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      Alert.alert('Falta texto');
      return;
    }
    const p = addType === 'prompt' ? Math.max(1, parseInt(pick, 10) || 1) : 1;
    const added = addCard({ type: addType, text: trimmed, pick: p, packId });
    onCardAdded?.(added);
    Alert.alert(
      'Añadida',
      `${addType === 'prompt' ? 'Pregunta' : 'Respuesta'} en pack «${packId}». Entra en partidas nuevas / exporta para el repo.`
    );
    setText('');
    setMode('menu');
  };

  const exportPatches = async () => {
    const json = getExportJson();
    try {
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `guerrilla-patches-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        try {
          await navigator.clipboard?.writeText(json);
        } catch {
          /* ignore */
        }
        Alert.alert('Exportado', 'JSON descargado (y copiado si el navegador lo permitió).');
        return;
      }
      await Share.share({ message: json, title: 'Parches Guerrilla Cards' });
    } catch (e) {
      Alert.alert('No se pudo exportar', String(e));
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Admin · mazo</Text>
          <Text style={styles.muted}>
            Parches solo en este navegador/dispositivo ({patchCount}). El live de Vercel no cambia hasta que
            commits el JSON exportado.
          </Text>

          <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
            {!unlocked || mode === 'unlock' ? (
              <View style={{ gap: 8 }}>
                <Text style={styles.muted}>PIN de admin</Text>
                <TextInput
                  style={styles.input}
                  value={pin}
                  onChangeText={setPin}
                  secureTextEntry
                  autoCapitalize="none"
                  placeholder="PIN"
                  placeholderTextColor={colors.textDim}
                  onSubmitEditing={tryUnlock}
                />
                <Pressable style={[styles.btn, styles.btnPrimary]} onPress={tryUnlock}>
                  <Text style={[styles.btnText, styles.btnTextOn]}>Desbloquear</Text>
                </Pressable>
              </View>
            ) : mode === 'menu' ? (
              <View style={{ gap: 8 }}>
                <View style={styles.row}>
                  <Pressable
                    style={styles.btn}
                    onPress={() => {
                      if (!editTarget) {
                        Alert.alert(
                          'Sin carta',
                          'Abre Admin desde la pregunta o una respuesta en partida para editar.'
                        );
                        return;
                      }
                      setMode('edit');
                    }}
                  >
                    <Text style={styles.btnText}>Editar carta actual</Text>
                  </Pressable>
                  <Pressable
                    style={styles.btn}
                    onPress={() => {
                      setAddType('prompt');
                      setText('');
                      setPick('1');
                      setMode('add');
                    }}
                  >
                    <Text style={styles.btnText}>Añadir pregunta</Text>
                  </Pressable>
                  <Pressable
                    style={styles.btn}
                    onPress={() => {
                      setAddType('answer');
                      setText('');
                      setPick('1');
                      setMode('add');
                    }}
                  >
                    <Text style={styles.btnText}>Añadir respuesta</Text>
                  </Pressable>
                  <Pressable style={styles.btn} onPress={() => setMode('list')}>
                    <Text style={styles.btnText}>Ver parches ({patchCount})</Text>
                  </Pressable>
                  <Pressable style={[styles.btn, styles.btnPrimary]} onPress={exportPatches}>
                    <Text style={[styles.btnText, styles.btnTextOn]}>Exportar JSON</Text>
                  </Pressable>
                  <Pressable
                    style={styles.btn}
                    onPress={() =>
                      Alert.alert('¿Borrar todos los parches?', 'No afecta al mazo live.', [
                        { text: 'Cancelar', style: 'cancel' },
                        {
                          text: 'Borrar',
                          style: 'destructive',
                          onPress: clearAllPatches,
                        },
                      ])
                    }
                  >
                    <Text style={styles.btnText}>Limpiar parches</Text>
                  </Pressable>
                  <Pressable style={styles.btn} onPress={lock}>
                    <Text style={styles.btnText}>Bloquear admin</Text>
                  </Pressable>
                </View>
              </View>
            ) : mode === 'edit' && editTarget ? (
              <View style={{ gap: 8 }}>
                <Text style={styles.muted}>
                  {editTarget.type === 'prompt' ? 'Pregunta' : 'Respuesta'} · {editTarget.id}
                </Text>
                <TextInput
                  style={[styles.input, { minHeight: 100 }]}
                  value={text}
                  onChangeText={setText}
                  multiline
                  placeholderTextColor={colors.textDim}
                />
                {editTarget.type === 'prompt' ? (
                  <>
                    <Text style={styles.muted}>Pick (huecos)</Text>
                    <TextInput
                      style={styles.input}
                      value={pick}
                      onChangeText={setPick}
                      keyboardType="number-pad"
                      placeholderTextColor={colors.textDim}
                    />
                  </>
                ) : null}
                <View style={styles.row}>
                  <Pressable style={[styles.btn, styles.btnPrimary]} onPress={saveEdit}>
                    <Text style={[styles.btnText, styles.btnTextOn]}>Guardar parche</Text>
                  </Pressable>
                  <Pressable style={styles.btn} onPress={() => setMode('menu')}>
                    <Text style={styles.btnText}>Volver</Text>
                  </Pressable>
                </View>
              </View>
            ) : mode === 'add' ? (
              <View style={{ gap: 8 }}>
                <View style={styles.row}>
                  <Pressable
                    style={[styles.btn, addType === 'prompt' && styles.chipOn]}
                    onPress={() => setAddType('prompt')}
                  >
                    <Text style={[styles.btnText, addType === 'prompt' && styles.btnTextOn]}>
                      Pregunta
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.btn, addType === 'answer' && styles.chipOn]}
                    onPress={() => setAddType('answer')}
                  >
                    <Text style={[styles.btnText, addType === 'answer' && styles.btnTextOn]}>
                      Respuesta
                    </Text>
                  </Pressable>
                </View>
                <Text style={styles.muted}>Pack</Text>
                <View style={styles.row}>
                  {packs.map((p) => (
                    <Pressable
                      key={p.id}
                      style={[styles.btn, packId === p.id && styles.chipOn]}
                      onPress={() => setPackId(p.id)}
                    >
                      <Text
                        style={[styles.btnText, packId === p.id && styles.btnTextOn]}
                      >
                        {p.title}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  style={[styles.input, { minHeight: 100 }]}
                  value={text}
                  onChangeText={setText}
                  multiline
                  placeholder={
                    addType === 'prompt'
                      ? 'Texto con _____ para huecos'
                      : 'Texto de la respuesta'
                  }
                  placeholderTextColor={colors.textDim}
                />
                {addType === 'prompt' ? (
                  <>
                    <Text style={styles.muted}>Pick</Text>
                    <TextInput
                      style={styles.input}
                      value={pick}
                      onChangeText={setPick}
                      keyboardType="number-pad"
                      placeholderTextColor={colors.textDim}
                    />
                  </>
                ) : null}
                <View style={styles.row}>
                  <Pressable style={[styles.btn, styles.btnPrimary]} onPress={saveAdd}>
                    <Text style={[styles.btnText, styles.btnTextOn]}>Añadir</Text>
                  </Pressable>
                  <Pressable style={styles.btn} onPress={() => setMode('menu')}>
                    <Text style={styles.btnText}>Volver</Text>
                  </Pressable>
                </View>
              </View>
            ) : mode === 'list' ? (
              <View>
                {patchCount === 0 ? (
                  <Text style={styles.muted}>Sin parches todavía.</Text>
                ) : null}
                {patches.edits.map((e) => (
                  <View key={`e-${e.cardId}`} style={styles.listItem}>
                    <Text style={styles.muted}>EDIT · {e.cardId}</Text>
                    <Text style={styles.btnText}>{e.text}</Text>
                    <Pressable style={styles.btn} onPress={() => removeEdit(e.cardId)}>
                      <Text style={styles.btnText}>Quitar</Text>
                    </Pressable>
                  </View>
                ))}
                {patches.adds.map((a) => (
                  <View key={`a-${a.id}`} style={styles.listItem}>
                    <Text style={styles.muted}>
                      ADD · {a.type} · {a.packId} · {a.id}
                    </Text>
                    <Text style={styles.btnText}>{a.text}</Text>
                    <Pressable style={styles.btn} onPress={() => removeAdd(a.id)}>
                      <Text style={styles.btnText}>Quitar</Text>
                    </Pressable>
                  </View>
                ))}
                <Pressable style={styles.btn} onPress={() => setMode('menu')}>
                  <Text style={styles.btnText}>Volver</Text>
                </Pressable>
              </View>
            ) : null}
          </ScrollView>

          <Pressable style={styles.btn} onPress={onClose}>
            <Text style={styles.btnText}>Cerrar</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Compact entry control when admin unlocked (or to open unlock). */
export function AdminEntryButton({
  onPress,
  label,
}: {
  onPress: () => void;
  label?: string;
}) {
  const { colors, fontFamily } = useTheme();
  const { unlocked, patchCount } = useAdmin();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.bgElevated,
        borderRadius: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
      }}
    >
      <Text
        style={{
          color: unlocked ? colors.accentSoft : colors.textDim,
          fontFamily,
          fontSize: 11,
          fontWeight: '800',
        }}
      >
        {label ?? (unlocked ? `Admin (${patchCount})` : 'Admin')}
      </Text>
    </Pressable>
  );
}
