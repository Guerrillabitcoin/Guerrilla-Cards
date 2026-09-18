# Release — preview vs production

Production domain: https://guerrillacards.vercel.app
Vercel project: `guerrillacards`
Production branch: `main`

A push or merge to `main` **is** the public site. Do not use `main` to try an idea.

## Live test that is not production

1. Branch from current `main`: `preview/<tema>`.
2. Push the branch.
3. Vercel builds a Preview (not Production).
4. Open that preview URL on phones. Share that URL, not `guerrillacards.vercel.app`.
5. Merge to `main` only after the preview is good.

Do not run `vercel --prod` to test.

## Local (not a substitute for online rooms)

```bash
npm install
npx expo start
```

Web key `w` or Expo Go. Solo / pass-and-play work. `/api/room` does not (KV lives on Vercel).

## Rooms and KV

`/api/room` uses `KV_REST_API_*` or `UPSTASH_REDIS_REST_*`.

If Preview and Production share the same KV credentials, room codes can collide across the public site and a preview. For multi tests on a preview, use an obvious test code or a separate KV bound only to Preview.

If KV is missing, the API returns `kv_not_configured` (503). Online join will fail; Solo still works.

## Optional second Vercel project

Wishlist (`docs/ROADMAP.md`): a separate Vercel project `guerrillacardsbeta` for a stable beta URL. Until that exists, Git preview branches are the live-but-not-public path.
