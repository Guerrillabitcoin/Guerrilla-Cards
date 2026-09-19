# -*- coding: utf-8 -*-
"""v0.99.421.13 play.tsx surgical: claim seat from URL + HostRecoveryLinks at bottom."""
from __future__ import annotations
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PATH = ROOT / "app" / "play.tsx"

def main() -> None:
    raw = PATH.read_bytes()
    nl = "\r\n" if b"\r\n" in raw else "\n"
    t = raw.decode("utf-8").replace("\r\n", "\n")
    orig = t
    ch = []

    # imports: claimSeat, setMySeat, setOnlineFlag
    if "claimSeat" not in t.split("from '@/src/store/roomSync'")[0][-400:]:
        old = """import {
  getMySeat,
  getOnlineFlag,
  pullRoom,
  pushRoom,
} from '@/src/store/roomSync';"""
        new = """import {
  claimSeat,
  getMySeat,
  getOnlineFlag,
  pullRoom,
  pushRoom,
  setMySeat,
  setOnlineFlag,
} from '@/src/store/roomSync';"""
        if old not in t:
            raise SystemExit("roomSync import block not found")
        t = t.replace(old, new, 1)
        ch.append("roomSync imports")

    # params: code + seat
    old_p = "  const { code } = useLocalSearchParams<{ code: string }>();"
    new_p = "  const { code, seat: seatParam } = useLocalSearchParams<{ code: string; seat?: string }>();"
    if old_p in t:
        t = t.replace(old_p, new_p, 1)
        ch.append("seatParam")
    elif "seat: seatParam" not in t and "seatParam" not in t:
        raise SystemExit("params line missing")

    # seat claim effect after online seat lock effect
    if "seatClaimRan" not in t:
        marker = """  // Online seat lock + room poll (async + KV)
  useEffect(() => {
    if (!gameCode) return;
    let cancelled = false;
    void (async () => {
      const [seat, online] = await Promise.all([
        getMySeat(gameCode),
        getOnlineFlag(gameCode),
      ]);
      if (cancelled) return;
      setMyPlayerId(seat);
      setOnlineRoom(online);
    })();
    return () => {
      cancelled = true;
    };
  }, [gameCode]);
"""
        # tolerate naming setMyPlayerId vs setMyPlayerId
        if marker not in t:
            # try alternate names from file
            m = re.search(
                r"  // Online seat lock[\s\S]*?  \}, \[gameCode\]\);\n",
                t,
            )
            if not m:
                raise SystemExit("seat lock effect not found")
            marker = m.group(0)
        insert = marker + """
  // Deep-link /play?code=&seat= → reclaim seat and stay on the live board
  const seatClaimRan = useRef<string | null>(null);
  useEffect(() => {
    if (!ready || !gameCode) return;
    const want = String(seatParam ?? '').trim();
    if (!want) return;
    const key = `${gameCode}:${want}`;
    if (seatClaimRan.current === key) return;
    seatClaimRan.current = key;
    let cancelled = false;
    void (async () => {
      await setOnlineFlag(gameCode, true);
      setOnlineRoom(true);
      const claimed = await claimSeat(gameCode, want);
      if (cancelled) return;
      if (claimed.ok) {
        await setMySeat(gameCode, claimed.playerId);
        setMyPlayerId(claimed.playerId);
        applyRemoteGame(claimed.state);
        return;
      }
      const pulled = await pullRoom(gameCode);
      if (cancelled || !pulled.ok) return;
      applyRemoteGame(pulled.state);
      if (pulled.state.players.some((p) => p.id === want)) {
        await setMySeat(gameCode, want);
        setMyPlayerId(want);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, gameCode, seatParam, applyRemoteGame]);
"""
        t = t.replace(marker, insert, 1)
        ch.append("seat claim effect")

    # Move HostRecoveryLinks block to before </ScrollView>
    block_re = re.compile(
        r"\n      \{isOnline && iAmHostPlayer \? \(\n"
        r"        <HostRecoveryLinks\n"
        r"          code=\{game\.code\}\n"
        r"          players=\{game\.players\}\n"
        r"          compact\n"
        r"        />\n"
        r"      \) : null\}\n",
    )
    m = block_re.search(t)
    if not m:
        raise SystemExit("HostRecoveryLinks block not found to move")
    block = m.group(0)
    t2 = block_re.sub("\n", t, count=1)
    if "</ScrollView>" not in t2:
        raise SystemExit("ScrollView close missing")
    footer = """
      {isOnline && iAmHostPlayer ? (
        <HostRecoveryLinks
          code={game.code}
          players={game.players}
          compact
        />
      ) : null}
"""
    t2 = t2.replace("      </ScrollView>", footer + "      </ScrollView>", 1)
    t = t2
    ch.append("HostRecoveryLinks → bottom")

    if t == orig:
        print("no changes", ch)
        return
    bak = PATH.with_suffix(".tsx.bak-42113")
    bak.write_bytes(raw)
    PATH.write_bytes(t.replace("\n", nl).encode("utf-8"))
    print("OK", ", ".join(ch))
    print("backup", bak)

if __name__ == "__main__":
    main()
