#!/usr/bin/env python3
"""Apply 0.99.421.56 surgical edits to app/play.tsx (never full replace).

- Zar mode: Zar not in «faltan respuestas» (WaitingRoster doneIds)
- Vote HUD: sticky «Tu respuesta» filled after submit / judging
- Split vote: AdvanceRoundButton visible (host or voto dividido)
"""
from __future__ import annotations
import sys
from pathlib import Path


def apply_one(text: str) -> tuple[str, list[str]]:
    done: list[str] = []

    # --- 1) Zar WaitingRoster: mark Zar done so they don't appear in faltan ---
    old_zar_roster = (
        "          ) : zarSkipsSubmit &&\n"
        "            (isOnline ? myPlayerId === zar.id : active?.id === zar.id) ? (\n"
        "              <WaitingRoster\n"
        "              players={game.players}\n"
        "              doneIds={roundSubs.filter((s) => !s.rival).map((s) => s.playerId)}\n"
        "              meId={myPlayerId ?? active?.id}\n"
        "              verb=\"responda\"\n"
        "         />\n"
    )
    new_zar_roster = (
        "          ) : zarSkipsSubmit &&\n"
        "            (isOnline ? myPlayerId === zar.id : active?.id === zar.id) ? (\n"
        "              <WaitingRoster\n"
        "              players={game.players}\n"
        "              doneIds={[\n"
        "                ...roundSubs.filter((s) => !s.rival).map((s) => s.playerId),\n"
        "                ...(zar ? [zar.id] : []),\n"
        "              ]}\n"
        "              meId={myPlayerId ?? active?.id}\n"
        "              verb=\"responda\"\n"
        "         />\n"
    )
    if "doneIds={[\n                ...roundSubs.filter((s) => !s.rival).map((s) => s.playerId),\n                ...(zar ? [zar.id] : [])," in text:
        done.append("zar-roster-already")
    elif old_zar_roster in text:
        text = text.replace(old_zar_roster, new_zar_roster, 1)
        done.append("zar-roster")
    else:
        done.append("zar-roster-MISS")

    # --- 2) Sticky label: vote mode → «Tu respuesta» when filled ---
    old_label = (
        "            <Text style={styles.liveLabel}>\n"
        "              {soloSkipMode\n"
        "                ? `Descartar ${soloSkipCountLabel}`\n"
        "                : pickNeed > 1 && phase === 'submitting' && !alreadyAnswered\n"
        "                  ? `Elige ${pickNeed} (${picked.length}/${pickNeed})`\n"
        "                                  : phase === 'judging'\n"
        "                    ? 'Tu respuesta'\n"
        "                    : 'Pregunta'}\n"
        "            </Text>\n"
    )
    new_label = (
        "            <Text style={styles.liveLabel}>\n"
        "              {soloSkipMode\n"
        "                ? `Descartar ${soloSkipCountLabel}`\n"
        "                : pickNeed > 1 && phase === 'submitting' && !alreadyAnswered\n"
        "                  ? `Elige ${pickNeed} (${picked.length}/${pickNeed})`\n"
        "                  : phase === 'judging' ||\n"
        "                      (voteMode &&\n"
        "                        phase === 'submitting' &&\n"
        "                        alreadyAnswered)\n"
        "                    ? 'Tu respuesta'\n"
        "                    : 'Pregunta'}\n"
        "            </Text>\n"
    )
    if "voteMode &&\n                        phase === 'submitting' &&\n                        alreadyAnswered)" in text:
        done.append("vote-tu-respuesta-already")
    elif old_label in text:
        text = text.replace(old_label, new_label, 1)
        done.append("vote-tu-respuesta")
    else:
        # try looser match
        marker = "phase === 'judging'\n                    ? 'Tu respuesta'\n                    : 'Pregunta'}"
        if marker in text and "voteMode &&" not in text[text.find("liveLabel"):text.find("liveLabel")+500]:
            text = text.replace(
                marker,
                "phase === 'judging' ||\n"
                "                      (voteMode &&\n"
                "                        phase === 'submitting' &&\n"
                "                        alreadyAnswered)\n"
                "                    ? 'Tu respuesta'\n"
                "                    : 'Pregunta'}",
                1,
            )
            done.append("vote-tu-respuesta-loose")
        else:
            done.append("vote-tu-respuesta-MISS")

    # --- 3) Split / vote: show AdvanceRoundButton for host or voto dividido ---
    old_btn = (
        "                                       {isSolo || iAmNextZar || !isOnline ? (\n"
        "                      <AdvanceRoundButton\n"
        "                        isSolo={!!isSolo}\n"
        "                        isZar={!!iAmNextZar}\n"
        "                        onPress={() => continueRound()}\n"
        "                      />\n"
        "                    ) : null}\n"
    )
    new_btn = (
        "                    {isSolo ||\n"
        "                    iAmNextZar ||\n"
        "                    !isOnline ||\n"
        "                    (voteMode &&\n"
        "                      (iAmHostPlayer || !game.roundWinnerId)) ? (\n"
        "                      <AdvanceRoundButton\n"
        "                        isSolo={!!isSolo}\n"
        "                        isZar={!!iAmNextZar}\n"
        "                        onPress={() => continueRound()}\n"
        "                      />\n"
        "                    ) : null}\n"
    )
    if "voteMode &&\n                      (iAmHostPlayer || !game.roundWinnerId)" in text:
        done.append("split-advance-btn-already")
    elif old_btn in text:
        text = text.replace(old_btn, new_btn, 1)
        done.append("split-advance-btn")
    else:
        # looser
        needle = "{isSolo || iAmNextZar || !isOnline ? ("
        if needle in text and "iAmHostPlayer || !game.roundWinnerId" not in text:
            text = text.replace(
                needle,
                "{isSolo ||\n"
                "                    iAmNextZar ||\n"
                "                    !isOnline ||\n"
                "                    (voteMode &&\n"
                "                      (iAmHostPlayer || !game.roundWinnerId)) ? (",
                1,
            )
            done.append("split-advance-btn-loose")
        else:
            done.append("split-advance-btn-MISS")

    # --- 4) Waiting muted: vote split shouldn't say «próximo Zar» ---
    old_muted = (
        "                    {!isSolo ? (\n"
        "                      <Muted>\n"
        "                        {iAmNextZar\n"
        "                          ? 'Eres el próximo Zar: empieza ya o en 10 s pasa sola.'\n"
        "                          : `Esperando a que ${winnerName} (Zar) empiece la siguiente ronda…`}\n"
        "                      </Muted>\n"
        "                    ) : null}\n"
    )
    new_muted = (
        "                    {!isSolo ? (\n"
        "                      <Muted>\n"
        "                        {voteMode\n"
        "                          ? !game.roundWinnerId\n"
        "                            ? 'Voto dividido · sin puntos. Siguiente ronda…'\n"
        "                            : iAmHostPlayer\n"
        "                              ? 'Siguiente ronda: empieza ya o en 10 s pasa sola.'\n"
        "                              : 'Esperando la siguiente ronda…'\n"
        "                          : iAmNextZar\n"
        "                            ? 'Eres el próximo Zar: empieza ya o en 10 s pasa sola.'\n"
        "                            : `Esperando a que ${winnerName} (Zar) empiece la siguiente ronda…`}\n"
        "                      </Muted>\n"
        "                    ) : null}\n"
    )
    if "Voto dividido · sin puntos. Siguiente ronda…" in text:
        done.append("split-muted-already")
    elif old_muted in text:
        text = text.replace(old_muted, new_muted, 1)
        done.append("split-muted")
    else:
        done.append("split-muted-MISS")

    return text, done


def main() -> int:
    target = Path(sys.argv[1] if len(sys.argv) > 1 else "app/play.tsx")
    if not target.is_file():
        print(f"ERROR: {target} not found")
        return 1
    orig = target.read_text(encoding="utf-8")
    text, done = apply_one(orig)
    print("done:", done)
    if any(x.endswith("-MISS") for x in done):
        print("WARN: some patches missed")
    if text == orig:
        print("WARN: no text changes")
        return 2 if any(x.endswith("-MISS") for x in done) else 0
    bak = target.with_suffix(target.suffix + ".bak-42156")
    bak.write_text(orig, encoding="utf-8")
    target.write_text(text, encoding="utf-8")
    print(f"Patched {target}. Backup {bak}")
    return 0 if not any(x.endswith("-MISS") for x in done) else 2


if __name__ == "__main__":
    raise SystemExit(main())
