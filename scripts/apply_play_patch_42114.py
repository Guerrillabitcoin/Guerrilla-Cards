#!/usr/bin/env python3
"""Apply 0.99.421.14 surgical edits to app/play.tsx (never full replace).

Usage (repo root, branch preview/grok-docs):
  python scripts/apply_play_patch_42114.py
  python scripts/apply_play_patch_42114.py path/to/play.tsx
"""
from __future__ import annotations
import sys
from pathlib import Path

REPLACEMENTS: list[tuple[str, str]] = [
    # 1) Auto-reveal: do not bail when roundWinnerId is null (annulled vote tie)
    (
        """    if (game.phase !== 'reveal' || !game.roundWinnerId) {
      if (autoRevealTimerRef.current) {
        clearTimeout(autoRevealTimerRef.current);
        autoRevealTimerRef.current = null;
      }
      if (game?.phase !== 'reveal') autoRevealKeyRef.current = null;
      return;
    }""",
        """    // Allow reveal without roundWinnerId (vote annul «Empate: voto dividido»).
    if (game.phase !== 'reveal') {
      if (autoRevealTimerRef.current) {
        clearTimeout(autoRevealTimerRef.current);
        autoRevealTimerRef.current = null;
      }
      autoRevealKeyRef.current = null;
      return;
    }""",
    ),
    (
        """    if (game.phase !== 'reveal' || !game.roundWinnerId) {
      if (autoRevealTimerRef.current) {
        clearTimeout(autoRevealTimerRef.current);
        autoRevealTimerRef.current = null;
      }
      if (game?.phase !== 'reveal') autoRevealKeyRef.current = null;
      return;
    }""",
        """    // Allow reveal without roundWinnerId (vote annul «Empate: voto dividido»).
    if (game.phase !== 'reveal') {
      if (autoRevealTimerRef.current) {
        clearTimeout(autoRevealTimerRef.current);
        autoRevealTimerRef.current = null;
      }
      autoRevealKeyRef.current = null;
      return;
    }""",
    ),
]

def apply_one(text: str) -> tuple[str, list[str]]:
    done: list[str] = []
    # Auto-reveal guards (several possible spellings)
    guards = [
        "if (game.phase !== 'reveal' || !game.roundWinnerId)",
        "if (game.phase !== 'reveal' || !game.roundWinnerId) {",
    ]
    if "Allow reveal without roundWinnerId" not in text and "vote annul" not in text:
        for g in [
            "if (game.phase !== 'reveal' || !game.roundWinnerId) {",
            "if (game.phase !== 'reveal' || !game.roundWinnerId)",
        ]:
            if g in text:
                text = text.replace(g, "if (game.phase !== 'reveal') { // 421.14 annul ties", 1)
                # fix double {{ if we replaced the version with {
                text = text.replace(") { { // 421.14", ") { // 421.14", 1)
                text = text.replace(") { // 421.14 annul ties {", ") { // 421.14 annul ties", 1)
                done.append("auto-reveal-guard")
                break

    # Key string including annul
    for old_key, new_key in [
        (
            "const key = `${game.code}:${game.round}:${game.roundWinnerId}:${",
            "const key = `${game.code}:${game.round}:${game.roundWinnerId ?? 'annul'}:${(game.roundWinnerIds ?? []).join(',')}:${",
        ),
        (
            "const key = `${game.code}:${game.round}:${game.roundWinnerId}:${",
            "const key = `${game.code}:${game.round}:${game.roundWinnerId ?? 'annul'}:${(game.roundWinnerIds ?? []).join(',')}:${",
        ),
    ]:
        if old_key in text and "annul" not in text[text.find("const key = `${game.code}"):text.find("const key = `${game.code}")+120]:
            text = text.replace(old_key, new_key, 1)
            done.append("auto-reveal-key")
            break

    # Add roundWinnerIds to deps if missing near auto-reveal
    if "game?.roundWinnerIds" not in text:
        needle = "    game?.roundWinnerId,\n    game?.players,"
        alt = "    game?.roundWinnerId,\n    game?.players,"
        for n in (needle, alt):
            if n in text:
                text = text.replace(
                    n,
                    n.replace(
                        "game?.roundWinnerId,\n",
                        "game?.roundWinnerId,\n    game?.roundWinnerIds,\n",
                    ),
                    1,
                )
                done.append("deps")
                break

    # Title / subtitle / muted for ties
    ui_pairs = [
        (
            "{isTie ? 'Empate' : iWon ? '¡Puntaco!' : 'Fin de ronda'}",
            "{isTie ? (game.roundWinnerId ? 'Empate' : 'Empate: voto dividido') : iWon ? '¡Puntaco!' : 'Fin de ronda'}",
        ),
        (
            "{isTie ? 'Empate' : iWon ? '¡Puntaco!' : 'Fin de ronda'}",
            "{isTie ? (game.roundWinnerId ? 'Empate' : 'Empate: voto dividido') : iWon ? '¡Puntaco!' : 'Fin de ronda'}",
        ),
        (
            "? 'Empate · +1 cada una'\n                        : winnerIsRival",
            "? (game.roundWinnerId ? 'Empate · +1 cada una' : 'Empate: voto dividido · sin puntos')\n                        : winnerIsRival",
        ),
        (
            "? 'Empate · +1 cada una'\n                        : winnerIsRival",
            "? (game.roundWinnerId ? 'Empate · +1 cada una' : 'Empate: voto dividido · sin puntos')\n                        : winnerIsRival",
        ),
        (
            "`Empate · +1 cada una. Meta: ${game.targetScore} Puntacos.`",
            "(game.roundWinnerId\n                          ? `Empate · +1 cada una. Meta: ${game.targetScore} Puntacos.`\n                          : `Empate: voto dividido · ronda anulada. Meta: ${game.targetScore} Puntacos.`)",
        ),
        (
            "`Empate · +1 cada una. Meta: ${game.targetScore} Puntacos.`",
            "(game.roundWinnerId\n                          ? `Empate · +1 cada una. Meta: ${game.targetScore} Puntacos.`\n                          : `Empate: voto dividido · ronda anulada. Meta: ${game.targetScore} Puntacos.`)",
        ),
    ]
    for old, new in ui_pairs:
        if old in text and "Empate: voto dividido" not in text[max(0,text.find(old)-50):text.find(old)+len(old)+80]:
            text = text.replace(old, new, 1)
            done.append("ui")

    # window.alert for web on Voto / Siguiente (only if still Alert.alert)
    if "window.alert(`Voto:" not in text and "window.alert(`Voto:" not in text:
        old = "Alert.alert('Voto', e instanceof Error ? e.message : 'Error');"
        if old in text:
            text = text.replace(
                old,
                """{ const msg = e instanceof Error ? e.message : 'Error';
      if (typeof window !== 'undefined' && typeof window.alert === 'function') window.alert(`Voto: ${msg}`);
      else Alert.alert('Voto', msg); }""",
                1,
            )
            done.append("voto-alert")
        old2 = "Alert.alert('Voto', e instanceof Error ? e.message : 'Error');"
        if old2 in text:
            text = text.replace(
                old2,
                """{ const msg = e instanceof Error ? e.message : 'Error';
      if (typeof window !== 'undefined' && typeof window.alert === 'function') window.alert(`Voto: ${msg}`);
      else Alert.alert('Voto', msg); }""",
                1,
            )
            done.append("voto-alert")

    if "window.alert(`Siguiente:" not in text and "window.alert(`Siguiente:" not in text:
        for old in (
            "Alert.alert('Siguiente', msg);",
            "Alert.alert('Siguiente', msg);",
        ):
            if old in text:
                text = text.replace(
                    old,
                    """if (typeof window !== 'undefined' && typeof window.alert === 'function') window.alert(`Siguiente: ${msg}`);
        else Alert.alert('Siguiente', msg);""",
                    1,
                )
                done.append("siguiente-alert")
                break

    return text, done

def main() -> int:
    target = Path(sys.argv[1] if len(sys.argv) > 1 else "app/play.tsx")
    if not target.is_file():
        print(f"ERROR: {target} not found")
        return 1
    orig = target.read_text(encoding="utf-8")
    if "Empate: voto dividido" in orig and ("vote annul" in orig or "421.14 annul" in orig or "Allow reveal without roundWinnerId" in orig):
        print(f"OK: {target} already looks patched for 421.14")
        return 0
    text, done = apply_one(orig)
    if text == orig:
        print("WARN: no replacements matched. Port manually from box app/play.tsx (reference only).")
        print("Need: (1) reveal auto-advance without roundWinnerId (2) «Empate: voto dividido» UI")
        return 2
    bak = target.with_suffix(target.suffix + ".bak-42114")
    bak.write_text(orig, encoding="utf-8")
    target.write_text(text, encoding="utf-8")
    print(f"Patched {target}: {done}. Backup {bak}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
