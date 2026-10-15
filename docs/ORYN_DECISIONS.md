# ORYN decisions (this transformation pass)

The full decision log lives in DECISIONS.md (E1–E15). This file records the decisions taken on 2026-10-15 for the premium platform transformation.

| # | Decision | Why | Reversible |
|---|---|---|---|
| T1 | **Collections are presets over the existing material engine**, not a parallel card renderer. Three materials were added (platinum, gold, white); pearl/carbon/marble stay for existing cards and remain selectable when a card already uses them. | One renderer, one CSS set, every surface (Share, Present, Nearby, Wallet preview, public page) updates together. Zero migration: a design is still `{material, foil, finish, font, layout, base, back}`. | Yes. |
| T2 | **Block is private and symmetric; report also blocks.** Blocks live in `user_blocks`; reports in `abuse_reports` for Command Center. The blocked person is never notified; pending requests both ways are declined silently. | Safety without escalation; matches the existing "Not now is private" principle. | Yes. |
| T3 | **Duplicate copies policy and private note**, name `"<name> copy"`, never default, no shares. Plan limits apply. | Users duplicate to create a variant; carrying the policy avoids an accidentally more open copy. | Yes. |
| T4 | **No new vendors, no new runtime dependencies** in this pass. | Founders' standing rule. | — |
| T5 | **Proximity stays ORYN-to-ORYN area cells + same event** (plus QR and links). Browser BLE/UWB is not available on iOS Safari; a native app or BLE beacons would be required for true radio proximity — documented in docs/NEARBY_AND_WALLET.md. | Honest capability statement; the directive forbids claiming unverified proximity. | — |
| T6 | **No route-level `loading.tsx` skeleton.** It was built and reverted the same day: under Next 15.5 the Suspense boundary it adds made pages re-render stale after server actions (`revalidatePath` + `useActionState`), failing 15 E2E flows. Skeletons stay a P1 item, to be added per page where there is no form. | Correctness over polish; verified by the E2E suite going from 15 failures to 0 after the revert. | Yes, per page. |
