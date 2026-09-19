#!/usr/bin/env python3
"""Apply 0.99.421.15 surgical edits to app/play.tsx (never full replace).

Adds score + ronda next to nickname on reveal/tie result cards.

Usage (repo root, branch preview/grok-docs):
  python scripts/apply_play_patch_42115.py
  python scripts/apply_play_patch_42115.py path/to/play.tsx
"""
from __future__ import annotations
import sys
from pathlib import Path

def apply_one(text: str) -> tuple[str, list[str]]:
    done: list[str] = []

    old_tie = (
        "                          const nick =\n"
        "                            game.players.find((p) => p.id === sub.playerId)\n"
        "                              ?.nickname ?? '\u2014';\n"
        "                          return (\n"
        "                            <View\n"
        "                              key={`tie-${sub.playerId}`}\n"
        "                              style={styles.judgeCard}\n"
        "                            >\n"
        "                              <View style={styles.soloRivalHead}>\n"
        "                                <Text style={styles.judgeLabel}>{nick}</Text>"
    )
    # Also try ASCII em-dash variant
    old_tie_ascii = old_tie.replace("\u2014", "—")
    old_tie_plain = old_tie.replace("\u2014", "-")

    new_tie = (
        "                          const pl = game.players.find((p) => p.id === sub.playerId);\n"
        "                          const nick = pl?.nickname ?? '\u2014';\n"
        "                          const score = pl?.score ?? 0;\n"
        "                          return (\n"
        "                            <View\n"
        "                              key={`tie-${sub.playerId}`}\n"
        "                              style={styles.judgeCard}\n"
        "                            >\n"
        "                              <View style={styles.soloRivalHead}>\n"
        "                                <Text style={styles.judgeLabel}>\n"
        "                                  {`${nick} · ${score} Puntacos · ronda ${game.round}`}\n"
        "                                </Text>"
    )

    if "Puntacos · ronda ${game.round}" in text and "const score = pl?.score" in text:
        done.append("tie-reveal-meta-already")
    else:
        replaced = False
        for cand in (old_tie_ascii, old_tie, old_tie_plain):
            # Rebuild with proper dash from file
            pass
        # Flexible: locate tie key and replace nearby judgeLabel {nick}
        marker = "key={`tie-${sub.playerId}`}"
        if marker in text:
            idx = text.find(marker)
            window = text[idx : idx + 800]
            needle = "<Text style={styles.judgeLabel}>{nick}</Text>"
            if needle in window:
                repl = (
                    "<Text style={styles.judgeLabel}>\n"
                    "                                  {`${nick} · ${(game.players.find((p) => p.id === sub.playerId)?.score ?? 0)} Puntacos · ronda ${game.round}`}\n"
                    "                                </Text>"
                )
                # Prefer upgrading nick block if present
                nick_block_start = text.rfind("const nick =", 0, idx + 50)
                # simpler window replace
                new_window = window.replace(needle, repl, 1)
                text = text[:idx] + new_window + text[idx + 800 :]
                # Also upgrade const nick to include score if still old form
                if "const score = pl?.score" not in text[max(0, idx - 200) : idx + 200]:
                    old_n = (
                        "const nick =\n"
                        "                            game.players.find((p) => p.id === sub.playerId)\n"
                        "                              ?.nickname ?? "
                    )
                    # leave nick as-is; score inline in label is enough
                done.append("tie-reveal-meta")
                replaced = True
            else:
                # maybe already has multi-line judgeLabel with only nick
                needle2 = (
                    "<Text style={styles.judgeLabel}>\n"
                    "                                  {nick}\n"
                    "                                </Text>"
                )
                if needle2 in window:
                    repl2 = (
                        "<Text style={styles.judgeLabel}>\n"
                        "                                  {`${nick} · ${(game.players.find((p) => p.id === sub.playerId)?.score ?? 0)} Puntacos · ronda ${game.round}`}\n"
                        "                                </Text>"
                    )
                    new_window = window.replace(needle2, repl2, 1)
                    text = text[:idx] + new_window + text[idx + 800 :]
                    done.append("tie-reveal-meta")
                    replaced = True
        if not replaced and "Puntacos · ronda" not in text:
            done.append("tie-reveal-meta-MISS")

    old_win = (
        "                                  <Text style={styles.judgeLabel}>\n"
        "                                    {winnerName}\n"
        "                                  </Text>"
    )
    new_win = (
        "                                  <Text style={styles.judgeLabel}>\n"
        "                                    {`${winnerName} · ${\n"
        "                                      winnerIsRival\n"
        "                                        ? 0\n"
        "                                        : game.players.find((p) => p.id === game.roundWinnerId)?.score ?? 0\n"
        "                                    } Puntacos · ronda ${game.round}`}\n"
        "                                  </Text>"
    )
    if "{`${winnerName} · ${" in text or "`${winnerName} · ${" in text:
        done.append("winner-reveal-meta-already")
    elif old_win in text:
        text = text.replace(old_win, new_win, 1)
        done.append("winner-reveal-meta")
    else:
        # Try locating winnerName-only judgeLabel near winnerSub
        marker = "winnerSub.cards"
        idx = text.find("toggleFavFilled(filled, winnerSub.cards)")
        if idx < 0:
            idx = text.find("winnerSub.cards.map")
        if idx > 0:
            start = max(0, idx - 500)
            chunk = text[start:idx]
            needle = (
                "<Text style={styles.judgeLabel}>\n"
                "                                    {winnerName}\n"
                "                                  </Text>"
            )
            if needle in chunk:
                chunk2 = chunk.replace(needle, new_win, 1)
                text = text[:start] + chunk2 + text[idx:]
                done.append("winner-reveal-meta-alt")
            else:
                done.append("winner-reveal-meta-MISS")
        else:
            done.append("winner-reveal-meta-MISS")

    return text, done


def main() -> int:
    target = Path(sys.argv[1] if len(sys.argv) > 1 else "app/play.tsx")
    if not target.is_file():
        print(f"ERROR: {target} not found")
        return 1
    orig = target.read_text(encoding="utf-8")
    if (
        "Puntacos · ronda ${game.round}" in orig
        and ("`${winnerName} · ${" in orig or "{`${winnerName} · ${" in orig)
        and ("const score = pl?.score" in orig or "tie-${sub.playerId}" in orig)
    ):
        print(f"OK: {target} already looks patched for 421.15 reveal meta")
        return 0
    text, done = apply_one(orig)
    if text == orig or "MISS" in ",".join(done) and "meta" not in ",".join(done).replace("MISS", ""):
        if text == orig:
            print("WARN: no replacements matched. Port manually from box app/play.tsx (reference only).")
            print("Need: reveal card labels `NICK · N Puntacos · ronda R` on tie + winner cards")
            print("done:", done)
            return 2
    bak = target.with_suffix(target.suffix + ".bak-42115")
    bak.write_text(orig, encoding="utf-8")
    target.write_text(text, encoding="utf-8")
    print(f"Patched {target}: {done}. Backup {bak}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
