import React, { memo, useMemo } from 'react';
import { useTheme } from '../store/ThemeContext';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { fillBlankParts, type FillPart } from '../engine/deck';

export function Screen({
  children,
  style,
  contentDense,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  /** Tighter padding/gaps so the home menu fits on large PC screens. */
  contentDense?: boolean;
}) {
  const styles = useUiStyles();

  return (
    <View style={[styles.screen, style]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          contentDense && styles.scrollDense,
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </View>
  );
}

export function Title({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: TextStyle;
}) {
  const styles = useUiStyles();

  return <Text style={[styles.title, style]}>{children}</Text>;
}

export function Subtitle({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: TextStyle;
}) {
  const styles = useUiStyles();

  return <Text style={[styles.subtitle, style]}>{children}</Text>;
}

export function Muted({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: TextStyle;
}) {
  const styles = useUiStyles();

  return <Text style={[styles.muted, style]}>{children}</Text>;
}

export function Label({ children }: { children: React.ReactNode }) {
  const styles = useUiStyles();

  return <Text style={styles.label}>{children}</Text>;
}

export function Input(props: TextInputProps) {
  const styles = useUiStyles();
  const { colors } = useTheme();

  return (
    <TextInput
      placeholderTextColor={colors.textDim}
      {...props}
      style={[styles.input, props.style]}
    />
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger' | 'outline' | 'success' | 'discard';
  disabled?: boolean;
  style?: object;
}) {
  const styles = useUiStyles();
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.btn,
        variant === 'primary' && styles.btnPrimary,
        variant === 'ghost' && styles.btnGhost,
        variant === 'danger' && styles.btnDanger,
        variant === 'outline' && styles.btnOutline,
        variant === 'success' && styles.btnSuccess,
        variant === 'discard' && styles.btnDiscard,
        variant === 'discard' &&
          (hovered || pressed) &&
          styles.btnDiscardHover,
        disabled && { opacity: 0.5 },
        !disabled &&
          pressed &&
          variant !== 'discard' && { opacity: 0.6 },
        style,
      ]}
    >
      {({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => (
        <Text
          style={[
            styles.btnText,
            (variant === 'ghost' || variant === 'outline') && {
              color: colors.text,
            },
            variant === 'discard' && styles.btnDiscardText,
            variant === 'discard' &&
              (hovered || pressed) &&
              styles.btnDiscardTextHover,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  badge,
  disabled,
  /** Greyed look without blocking presses (soft-unlock). */
  muted,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  badge?: string;
  disabled?: boolean;
  muted?: boolean;
}) {
  const styles = useUiStyles();
  const lookMuted = !!muted && !selected;

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={[
        styles.chip,
        selected && styles.chipSelected,
        (disabled || lookMuted) && styles.chipDisabled,
      ]}
    >
      <Text
        style={[
          styles.chipText,
          selected && styles.chipTextSelected,
          (disabled || lookMuted) && styles.chipTextDisabled,
        ]}
      >
        {label}
      </Text>
      {badge ? (
        <Text
          style={[
            styles.chipBadge,
            (disabled || lookMuted) && styles.chipBadgeDisabled,
          ]}
        >
          {badge}
        </Text>
      ) : null}
    </Pressable>
  );
}


export function PackTile({
  title,
  subtitle,
  group,
  selected,
  onPress,
  nsfw,
  compact,
}: {
  title: string;
  subtitle?: string;
  /** Parent group shown above (Temas Core / +18) — small, bottom-right. */
  group?: string;
  selected?: boolean;
  onPress?: () => void;
  nsfw?: boolean;
  /** Smaller tiles for dense PC menus / many columns. */
  compact?: boolean;
}) {
  const styles = useUiStyles();

  const { width: winW } = useWindowDimensions();
  const pcPack = winW >= 700;
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.packTile,
        compact && styles.packTileCompact,
        pcPack && styles.packTilePc,
        selected && styles.packTileSelected,
      ]}
    >
      <View
        style={[
          styles.packTick,
          compact && styles.packTickCompact,
          selected && styles.packTickOn,
        ]}
      >
        <Text style={[styles.packTickText, selected && styles.packTickTextOn]}>
          {selected ? '✓' : ''}
        </Text>
      </View>
      {nsfw ? (
        <Text style={[styles.packNsfw, compact && styles.packNsfwCompact]}>18+</Text>
      ) : null}
      <View style={styles.packTitleWrap}>
        <Text
          style={[
            styles.packTitle,
            compact && styles.packTitleCompact,
            pcPack && styles.packTitlePc,
            selected && styles.packTitleSelected,
          ]}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {title}
        </Text>
      </View>
      <View style={styles.packFooter}>
        {subtitle ? (
          <Text
            style={[
              styles.packSub,
              compact && styles.packSubCompact,
              pcPack && styles.packSubPc,
              selected && styles.packSubSelected,
            ]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : (
          <View />
        )}
        {group ? (
          <Text
            style={[
              styles.packGroup,
              compact && styles.packGroupCompact,
              pcPack && styles.packGroupPc,
              selected && styles.packGroupSelected,
            ]}
            numberOfLines={1}
          >
            {group}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Pick a readable font size from text length + available card width. */
export function longestWordLen(text: string): number {
  return text
    .split(/\s+/)
    .map((w) => w.replace(/[^0-9A-Za-zÀ-ÿÁÉÍÓÚÜÑáéíóúüñ]/g, '').length)
    .reduce((a, b) => Math.max(a, b), 0);
}

/** True when a single token would likely overflow the right gutter. */
export function hasLongWord(text: string, cardWidth: number): boolean {
  const lw = longestWordLen(text);
  if (lw >= 11) return true;
  // ~0.55em average glyph width for bold condensed Spanish
  return lw >= 9 && lw * (cardWidth * 0.11) * 0.58 > cardWidth * 0.72;
}

/** PC fonts — fill card height; shrink only heavy text. */
export const PC_CARD_FONT = 19;
export const PC_PROMPT_FONT = 24;
export const PC_CARD_FONT_HD = 24;
export const PC_PROMPT_FONT_HD = 30;

export function cardFontSize(
  text: string,
  cardWidth: number,
  opts?: {
    square?: boolean;
    prompt?: boolean;
    uniformPc?: boolean;
    hdPc?: boolean;
    /** Usable content height (padding already subtracted). */
    contentHeight?: number;
  }
) {
  const len = text.trim().length;
  const lw = longestWordLen(text);
  const longWord = hasLongWord(text, cardWidth) || lw >= 10;

  // Glyph width factor (bold condensed Spanish)
  const glyph = 0.58;

  const fitToBox = (startSize: number, minSize: number) => {
    let size = startSize;
    const maxH = opts?.contentHeight;
    for (let i = 0; i < 12; i++) {
      const lh = Math.round(size * 1.2);
      const cpl = Math.max(5, Math.floor(cardWidth / Math.max(size * glyph, 1)));
      // Long tokens need an extra wrap cushion
      const lines = Math.max(1, Math.ceil(len / cpl) + (longWord ? 1 : 0));
      const wordOk = lw * size * glyph <= cardWidth * 0.98;
      const heightOk = !maxH || lines * lh <= maxH;
      if (wordOk && heightOk) break;
      size = Math.max(minSize, size - 1);
      if (size <= minSize) break;
    }
    const lineHeight = Math.round(size * 1.2);
    const charsPerLine = Math.max(5, Math.floor(cardWidth / Math.max(size * glyph, 1)));
    const estLines = Math.max(1, Math.ceil(len / charsPerLine) + (longWord ? 1 : 0));
    return { size, lineHeight, estLines };
  };

  // Uniform preferred size for all cards; shrink only if it would overflow.
  if (opts?.uniformPc) {
    const start = opts.hdPc
      ? opts.prompt
        ? PC_PROMPT_FONT_HD
        : PC_CARD_FONT_HD
      : opts.prompt
        ? PC_PROMPT_FONT
        : PC_CARD_FONT;
    const minSize = opts.prompt ? 14 : opts.square ? 11 : 13;
    const fitted = fitToBox(start, minSize);
    // Prefer the uniform size; only report a smaller size when it must shrink
    const needsShrink = fitted.size < start;
    const size = needsShrink ? fitted.size : start;
    const lineHeight = Math.round(size * 1.22);
    const charsPerLine = Math.max(5, Math.floor(cardWidth / Math.max(size * glyph, 1)));
    const estLines = Math.max(1, Math.ceil(len / charsPerLine) + (longWord ? 1 : 0));
    const heavy = needsShrink || len > 110 || (longWord && lw >= 14);
    return { fontSize: size, lineHeight, longWord, estLines, len, heavy };
  }

  // Mobile / non-PC: one preferred size for hand tiles too
  const start = opts?.prompt
    ? Math.min(24, Math.max(18, Math.round(cardWidth * 0.065)))
    : opts?.square
      ? Math.min(18, Math.max(15, Math.round(cardWidth * 0.11)))
      : Math.min(22, Math.max(16, Math.round(cardWidth * 0.12)));
  const minSize = opts?.square ? (longWord ? 9 : 12) : longWord ? 12 : 15;
  const fitted = fitToBox(start, minSize);
  const needsShrink = fitted.size < start;
  const size = needsShrink ? fitted.size : start;
  const lineHeight = Math.round(size * 1.2);
  const charsPerLine = Math.max(5, Math.floor(cardWidth / Math.max(size * glyph, 1)));
  const estLines = Math.max(1, Math.ceil(len / charsPerLine) + (longWord ? 1 : 0));
  return {
    fontSize: size,
    lineHeight,
    longWord,
    estLines,
    len,
    heavy: needsShrink || len > 110 || (longWord && lw >= 14),
  };
}


function CardFaceInner({
  text,
  kind,
  selected,
  discardMarked,
  justReplaced,
  flashGreen,
  onPress,
  compact,
  square,
  dense,
  gridColumns,
  selectionIndex,
  forceFontSize,
}: {
  text: string;
  kind: 'prompt' | 'answer';
  selected?: boolean;
  /** Round-5 discard: reddish mark (not orange select). */
  discardMarked?: boolean;
  /** Slot just refilled after discard — brief “new card” cue. */
  justReplaced?: boolean;
  /** Brief green letter flash (new draws / mark). */
  flashGreen?: boolean;
  onPress?: () => void;
  compact?: boolean;
  /** Compact tile in hand grid — wide rectangle (not 1:1). */
  square?: boolean;
  /** Smaller padding/fonts for hand fan on desktop. */
  dense?: boolean;
  /** Columns used by parent hand grid (for font scaling). */
  gridColumns?: number;
  /** 1-based multipick order badge (bottom-right). */
  selectionIndex?: number;
  /** Shared hand font — one size for every tile in the grid. */
  forceFontSize?: number;
}) {
  const styles = useUiStyles();

  const isPrompt = kind === 'prompt';
  const { width: winW, height: winH } = useWindowDimensions();
  const columns = gridColumns ?? (winW >= 700 ? 6 : 2);
  const gap = dense ? 6 : 10;
  const approxTileRaw = square
    ? (winW - 40 - gap * (columns - 1)) / columns
    : Math.min(winW - 40, isPrompt ? winW - 40 : winW * 0.92);
  // Less gutter so medium phrases (…de mi hija) keep the last words
  const gutter = dense || square ? 10 : 12;
  const approxTile = Math.max(48, approxTileRaw - gutter);
  const isPc = winW >= 700;
  const hdPc = isPc && (winW >= 1600 || winH >= 1000);
  // aspectRatio 1.35 → height = width / 1.35; match real cardSquare pad (5+5)
  // so fit uses almost all vertical room inside the margins
  const padY = square || dense ? (isPc ? 5 : 6) : compact ? 16 : 20;
  const contentHeight = square
    ? Math.max(40, approxTileRaw / 1.35 - padY * 2 - (isPc ? 2 : 4))
    : undefined;
  const fitted = useMemo(
    () =>
      cardFontSize(text, approxTile, {
        square: !!square || !!compact || !!dense,
        prompt: isPrompt,
        uniformPc: isPc,
        hdPc,
        contentHeight,
      }),
    [text, approxTile, square, compact, dense, isPrompt, isPc, hdPc, contentHeight]
  );
  const longWord = !!fitted.longWord;
  const heavy = forceFontSize != null ? false : !!fitted.heavy;
  const lineCap = square || dense || compact ? 8 : 12;
  const sharedSize = forceFontSize != null ? forceFontSize : fitted.fontSize;
  const sharedLh = Math.round(sharedSize * (isPc ? 1.22 : 1.2));
  const textFit = {
    fontSize: sharedSize,
    lineHeight: sharedLh,
  };

  const handLike = !!(square || dense || compact);
  // Same base size for all; RN auto-shrink only when we already know it won't fit
  const autoFitProps = heavy
    ? {
        adjustsFontSizeToFit: true as const,
        minimumFontScale: handLike
          ? longWord
            ? 0.28
            : 0.4
          : longWord
            ? 0.32
            : 0.5,
      }
    : {};

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[
        styles.cardFace,
        isPrompt ? styles.cardPrompt : styles.cardAnswer,
        discardMarked && styles.cardDiscardMarked,
        justReplaced && styles.cardJustReplaced,
        selected && !discardMarked && styles.cardMarkedOrangeGreen,
        compact && styles.cardCompact,
        square && styles.cardSquare,
        dense && styles.cardDense,
        longWord && styles.cardLongWord,
        !square && !compact && { maxWidth: winW - 40, alignSelf: 'stretch' },
      ]}
    >
      <View style={{ flex: 1, minHeight: 0, width: '100%' }}>
        <Text
          style={[
            styles.cardText,
            isPrompt ? styles.cardPromptText : styles.cardAnswerText,
            textFit,
            {
              textAlignVertical: 'top',
              flexGrow: 1,
              flexShrink: 1,
              width: '100%',
            },
            styles.cardTextWrap,
            longWord && styles.cardTextLongWord,
            flashGreen && styles.cardTextFlashGreen,
          ]}
          numberOfLines={lineCap}
          {...autoFitProps}
        >
          {text}
        </Text>
        {discardMarked ? (
          <View style={styles.discardBadge}>
            <Text style={styles.discardBadgeText}>DESCARTE</Text>
          </View>
        ) : justReplaced ? (
          <View style={styles.replaceBadge}>
            <Text style={styles.replaceBadgeText}>NUEVA</Text>
          </View>
        ) : selectionIndex != null && selectionIndex > 0 ? (
          <View style={styles.selectionBadge}>
            <Text style={styles.selectionBadgeText}>{selectionIndex}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export const CardFace = memo(CardFaceInner);



export function FilledPromptText({
  promptText,
  answers,
  large,
  small,
}: {
  promptText: string;
  answers: string[];
  large?: boolean;
  /** Smaller question text (e.g. bot rival fills). */
  small?: boolean;
}) {
  const styles = useUiStyles();

  const parts = useMemo(
    () => fillBlankParts(promptText, answers),
    [promptText, answers]
  );
  return (
    <Text
      style={[
        styles.filledPrompt,
        large && styles.filledPromptLarge,
        small && styles.filledPromptSmall,
      ]}
    >
      {parts.map((p: FillPart, i: number) => {
        if (p.kind === 'answer') {
          return (
            <Text
              key={i}
              style={[styles.filledAnswer, small && styles.filledAnswerSmall]}
            >
              {p.text}
            </Text>
          );
        }
        if (p.kind === 'blank') {
          return (
            <Text key={i} style={styles.filledBlank}>
              {p.text}
            </Text>
          );
        }
        // Explicit prompt color — RN-web can inherit orange from answer spans
        return (
          <Text key={i} style={styles.filledPromptBody}>
            {p.text}
          </Text>
        );
      })}
    </Text>
  );
}

export function Loading() {
  const styles = useUiStyles();
  const { colors } = useTheme();

  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

function useUiStyles() {
  const { colors, fontFamily, themeId } = useTheme();
  const classic = themeId === 'classic';
  return useMemo(
    () =>
      StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    padding: 20,
    paddingBottom: 48,
    gap: 12,
  },
  scrollDense: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    paddingBottom: 28,
    gap: 8,
    maxWidth: 1100,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    color: colors.text,
    fontFamily,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 1,
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily,
    fontSize: 15,
    lineHeight: 22,
  },
  muted: {
    color: colors.textDim,
    fontFamily,
    fontSize: 13,
    lineHeight: 18,
  },
  label: {
    color: colors.textMuted,
    fontFamily,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 8,
  },
  input: {
    fontFamily,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 16,
  },
  btn: {
    borderRadius: 4,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  btnPrimary: {
    backgroundColor: colors.accent,
  },
  btnSuccess: {
    backgroundColor: colors.success,
  },
  btnGhost: {
    backgroundColor: colors.bgElevated,
  },
  btnDanger: {
    backgroundColor: colors.accentDim,
  },
  btnDiscard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E8E0F0',
  },
  btnDiscardHover: {
    backgroundColor: '#C62828',
    borderColor: '#C62828',
  },
  btnDiscardText: {
    fontFamily,
    color: '#1A1024',
    fontWeight: '800',
  },
  btnDiscardTextHover: {
    color: '#FFFFFF',
  },
  btnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnText: {
    fontFamily,
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.5,
  },
  chip: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chipSelected: {
    borderColor: colors.accent,
    backgroundColor: classic ? colors.accent : '#3B2060',
  },
  chipText: {
    color: colors.textMuted,
    fontWeight: '700',
    fontSize: 13,
  },
  chipTextSelected: {
    color: classic ? '#FFF8F0' : colors.text,
  },
  chipDisabled: {
    opacity: 0.55,
  },
  chipTextDisabled: {
    color: colors.textDim,
  },
  chipBadgeDisabled: {
    opacity: 0.9,
  },
  chipBadge: {
    color: colors.textDim,
    fontSize: 11,
  },
  cardFace: {
    borderRadius: 4,
    paddingTop: 10,
    paddingBottom: 10,
    paddingLeft: 12,
    paddingRight: 20,
    minHeight: 72,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardCompact: {
    minHeight: 64,
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 10,
    paddingRight: 18,
  },
  cardSquare: {
    // Fixed size for all answer tiles in the hand
    aspectRatio: 1.35,
    minHeight: 0,
    width: '100%',
    paddingTop: 5,
    paddingBottom: 5,
    paddingLeft: 7,
    paddingRight: 8,
    overflow: 'hidden',
  },
  cardDense: {
    paddingTop: 5,
    paddingBottom: 5,
    paddingLeft: 6,
    paddingRight: 8,
    borderRadius: 4,
    borderWidth: 1.5,
  },
  cardLongWord: {
    paddingRight: 3,
  },
  cardTextWrap: {
    ...(Platform.OS === 'web'
      ? ({
          wordBreak: 'break-word',
          overflowWrap: 'anywhere',
          whiteSpace: 'pre-wrap',
        } as object)
      : {}),
  },
  cardTextLongWord: {
    paddingRight: 0,
    ...(Platform.OS === 'web'
      ? ({ wordBreak: 'break-word', overflowWrap: 'anywhere' } as object)
      : {}),
  },
  cardPrompt: {
    backgroundColor: colors.promptBg,
    borderColor: colors.border,
  },
  cardAnswer: {
    backgroundColor: colors.answerBg,
    borderColor: classic ? colors.border : '#E07A30',
  },
  cardSelected: {
    borderColor: colors.zar,
  },
  cardDiscardMarked: {
    backgroundColor: '#5A1820',
    borderColor: '#E53935',
  },
  cardJustReplaced: {
    borderColor: '#4CAF50',
    backgroundColor: '#1B3D24',
  },
  /** Selected answer: orange rim + green body */
  cardMarkedOrangeGreen: {
    borderColor: '#E07A30',
    backgroundColor: '#2A4A28',
    borderWidth: 3,
  },
  cardText: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
    textAlign: 'left',
    width: '100%',
    paddingRight: 2,
  },
  cardPromptText: {
    color: colors.promptText,
  },
  cardTextFlashGreen: {
    color: '#4CAF50',
    textShadowColor: 'rgba(76, 175, 80, 0.55)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  cardAnswerText: {
    color: colors.answerText,
    // Classic: pequeño glow naranja detrás de las letras (cartas negras)
    textShadowColor: classic
      ? 'rgba(224, 106, 26, 0.9)'
      : 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: classic
      ? { width: 0, height: 0 }
      : { width: 0, height: 1 },
    textShadowRadius: classic ? 5 : 3,
  },
  filledPrompt: {
    color: colors.promptText,
    fontWeight: '700',
    fontSize: 18,
    lineHeight: 26,
  },
  filledPromptBody: {
    color: colors.promptText,
    fontWeight: '700',
  },
  filledPromptLarge: {
    fontSize: 26,
    lineHeight: 34,
    fontWeight: '800',
  },
  filledPromptSmall: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  filledAnswer: {
    color: classic ? '#E06A1A' : '#FF8A3D',
    textDecorationLine: 'underline',
    fontWeight: '900',
    textShadowColor: classic
      ? 'rgba(224, 106, 26, 0.55)'
      : 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: classic
      ? { width: 0, height: 0 }
      : { width: 0, height: 1 },
    textShadowRadius: classic ? 4 : 2,
  },
  filledAnswerSmall: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  filledBlank: {
    color: colors.textMuted,
    letterSpacing: 1,
  },
  packTile: {
    aspectRatio: 1.15,
    width: '100%',
    backgroundColor: colors.bgElevated,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 5,
    paddingRight: 5,
    justifyContent: 'space-between',
    alignItems: 'stretch',
    gap: 2,
    minHeight: 0,
  },
  packTileCompact: {
    borderRadius: 3,
    borderWidth: 1.5,
    paddingTop: 3,
    paddingBottom: 3,
    paddingLeft: 4,
    paddingRight: 4,
    gap: 0,
    minHeight: 0,
  },
  packTickCompact: {
    top: 3,
    right: 3,
    width: 14,
    height: 14,
    borderRadius: 3,
  },
  packTitleCompact: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '900',
    textAlign: 'center',
    alignSelf: 'center',
    maxWidth: '100%',
    paddingHorizontal: 2,
  },
  /** PC: larger pack name, uses tile height better */
  packTilePc: {
    paddingTop: 6,
    paddingBottom: 6,
  },
  packTitlePc: {
    fontSize: 16,
    lineHeight: 19,
    fontWeight: '900',
  },
  packSubPc: {
    fontSize: 11,
    lineHeight: 13,
  },
  packGroupPc: {
    fontSize: 10,
    lineHeight: 12,
  },
  packGroupCompact: {
    fontSize: 8,
    lineHeight: 9,
  },
  packSubCompact: {
    fontSize: 9,
    lineHeight: 11,
    paddingRight: 0,
  },
  packTitleWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
    paddingTop: 4,
    paddingBottom: 2,
    minHeight: 0,
  },
  packFooter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 4,
    width: '100%',
  },
  packNsfwCompact: {
    fontSize: 8,
    position: 'absolute',
    top: 3,
    left: 4,
  },
  packTileSelected: {
    borderColor: colors.accent,
    backgroundColor: classic ? colors.accent : '#3B2060',
  },
  packTick: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  packTickOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  packTickText: {
    color: 'transparent',
    fontWeight: '900',
    fontSize: 9,
    lineHeight: 10,
  },
  packTickTextOn: {
    color: '#FFF8F0',
  },
  packTitle: {
    color: colors.text,
    fontWeight: '900',
    fontSize: 15,
    lineHeight: 17,
    textAlign: 'center',
    alignSelf: 'center',
    maxWidth: '100%',
  },
  packTitleSelected: {
    color: '#FFF8F0',
  },
  packSubSelected: {
    color: 'rgba(255,248,240,0.85)',
  },
  packGroupSelected: {
    color: 'rgba(255,248,240,0.75)',
  },
  packGroup: {
    color: colors.textDim,
    fontWeight: '700',
    fontSize: 8,
    lineHeight: 9,
    textAlign: 'right',
    opacity: 0.9,
    flexShrink: 0,
  },
  packNsfw: {
    color: colors.accentSoft,
    fontWeight: '800',
    fontSize: 8,
    position: 'absolute',
    top: 4,
    left: 5,
  },
  packSub: {
    color: colors.textDim,
    fontSize: 9,
    lineHeight: 11,
    textAlign: 'left',
    flexShrink: 1,
  },
  selectionBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 22,
    height: 22,
    borderRadius: 4,
    backgroundColor: colors.bg,
    borderWidth: 1.5,
    borderColor: colors.zar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionBadgeText: {
    color: colors.text,
    fontWeight: '900',
    fontSize: 12,
    lineHeight: 14,
  },
  discardBadge: {
    position: 'absolute',
    right: 3,
    bottom: 3,
    backgroundColor: '#E53935',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    zIndex: 2,
  },
  discardBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  replaceBadge: {
    position: 'absolute',
    right: 3,
    bottom: 3,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    zIndex: 2,
  },
  replaceBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },

  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
      }),
    [colors, fontFamily, classic]
  );
}
