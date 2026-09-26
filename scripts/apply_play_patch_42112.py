# -*- coding: utf-8 -*-
"""Surgical patch for app/play.tsx — v0.99.421.12 host links + discard roster.
Never replaces the whole file. Usage from repo root:
  python scripts/apply_play_patch_42112.py
"""
from __future__ import annotations
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PATH = ROOT / "app" / "play.tsx"


def main() -> None:
    if not PATH.exists():
        raise SystemExit(f"No encuentro {PATH}")
    raw = PATH.read_bytes()
    # preserve newline style
    nl = "\r\n" if b"\r\n" in raw else "\n"
    t = raw.decode("utf-8")
    if nl == "\r\n":
        t = t.replace("\r\n", "\n")
    orig = t
    changes = []

    # 1) import
    if "HostRecoveryLinks" not in t:
        old = "import { WaitingRoster } from '@/src/components/WaitingRoster';"
        new = (
            "import { WaitingRoster } from '@/src/components/WaitingRoster';\n"
            "import { HostRecoveryLinks } from '@/src/components/ClaimSeat';"
        )
        if old not in t:
            raise SystemExit("No encuentro import WaitingRoster")
        t = t.replace(old, new, 1)
        changes.append("import HostRecoveryLinks")

    # 2) iAmHostPlayer
    if "const iAmHostPlayer" not in t:
        old = (
            "  const isOnline = !isSolo && onlineRoom && !!myPlayerId;\n"
            "  const onlineMissingSeat"
        )
        new = (
            "  const isOnline = !isSolo && onlineRoom && !!myPlayerId;\n"
            "  const iAmHostPlayer =\n"
            "    !!myPlayerId &&\n"
            "    !!game.players.find((p) => p.id === myPlayerId && p.isHost);\n"
            "  const onlineMissingSeat"
        )
        if old not in t:
            raise SystemExit("No encuentro bloque isOnline / onlineMissingSeat")
        t = t.replace(old, new, 1)
        changes.append("iAmHostPlayer")

    # 3) HostRecoveryLinks before isDiscarding
    if "<HostRecoveryLinks" not in t:
        old = "      {isDiscarding ? ("
        new = (
            "      {isOnline && iAmHostPlayer ? (\n"
            "        <HostRecoveryLinks\n"
            "          code={game.code}\n"
            "          players={game.players}\n"
            "          compact\n"
            "        />\n"
            "      ) : null}\n"
            "\n"
            "      {isDiscarding ? ("
        )
        if old not in t:
            raise SystemExit("No encuentro {isDiscarding ? (")
        t = t.replace(old, new, 1)
        changes.append("HostRecoveryLinks UI")

    # 4) discard WaitingRoster doneIds + verb
    m = re.search(
        r"discardDonePlayerIds\.length[\s\S]{0,900}?<WaitingRoster\s*\n"
        r"(\s*)players=\{game\.players\}\s*\n"
        r"(\s*)doneIds=\{([^}]+)\}\s*\n"
        r"(\s*)meId=\{[^}]+\}\s*\n"
        r"(\s*)verb=\"([^\"]+)\"",
        t,
    )
    if not m:
        # try single-line-ish
        m2 = re.search(
            r"(discardDonePlayerIds\.length[\s\S]{0,900}?<WaitingRoster[\s\S]{0,250}?doneIds=\{)([^}]+)(\})",
            t,
        )
        if not m2:
            print("AVISO: no encontre WaitingRoster de descarte")
        else:
            if "discardDonePlayerIds" not in m2.group(2):
                t = t[: m2.start(2)] + "game.discardDonePlayerIds" + t[m2.end(2) :]
                changes.append("discard doneIds")
            t2, n = re.subn(
                r"(doneIds=\{game\.discardDonePlayerIds\}[\s\S]{0,200}?verb=\")responda(\")",
                r"\1descarte\2",
                t,
                count=1,
            )
            if n:
                t = t2
                changes.append("verb descarte")
    else:
        done_expr = m.group(3)
        verb = m.group(6)
        if "discardDonePlayerIds" not in done_expr:
            t = t[: m.start(3)] + "game.discardDonePlayerIds" + t[m.end(3) :]
            changes.append("discard doneIds")
            # re-find verb after edit
            t2, n = re.subn(
                r"(doneIds=\{game\.discardDonePlayerIds\}[\s\S]{0,200}?verb=\")responda(\")",
                r"\1descarte\2",
                t,
                count=1,
            )
            if n:
                t = t2
                changes.append("verb descarte")
        elif verb == "responda":
            t = t[: m.start(6)] + "descarte" + t[m.end(6) :]
            changes.append("verb descarte")

    if t == orig:
        print("Sin cambios. Quizá ya aplicado.", changes)
        return

    bak = PATH.with_suffix(".tsx.bak-42112")
    bak.write_bytes(raw)
    out = t.replace("\n", nl)
    PATH.write_bytes(out.encode("utf-8"))
    print(f"OK {len(changes)} cambios: {', '.join(changes)}")
    print(f"Backup: {bak}")


if __name__ == "__main__":
    main()
