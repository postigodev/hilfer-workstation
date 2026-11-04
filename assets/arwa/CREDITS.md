# HILFER visual assets

Graphics: **Arwa**. Source visual implementation: **Altynai / april-hpxd**.

Imported selectively from [april-hpxd/WIN98-template](https://github.com/april-hpxd/WIN98-template), commit `4be592205ce2d6d3c29f604ba5af41adc78a0b08` (2026-10-26 integration). The source repository's [LICENSE](LICENSE) is preserved here; original template attribution to pollygon-dev and HTML5-Templates.com remains in the project.

| Runtime derivative | Source path | Output |
| --- | --- | --- |
| `logo.webp` | `assets/hilfer logo/hilfer_logo.png` | 512 x 512, lossless WebP |
| `wallpaper.webp` | `assets/wallpaper/aaaa.png` | 1920 x 1080, WebP quality 86 |
| `reconciliation.webp` | `assets/icons/clean version/tasks.png` | 128 x 128, lossless WebP |
| `records.webp` | `assets/icons/clean version/folder.png` | 128 x 128, lossless WebP |
| `settings.webp` | `assets/icons/clean version/settings.png` | 128 x 128, lossless WebP |

Derivatives were resized with Lanczos and encoded using Pillow/WebP; originals were not modified. The five runtime files total **46,890 bytes**, compared with **1,872,905 bytes** for their source PNGs. Original full-resolution files remain in the source repository; no unused full-resolution collection is shipped here.

Asset paths and clean/distorted aliases live in `css/assets.css`. Matching distorted artwork is not supplied for these five resources, so distorted paths currently fall back to the same artwork; the existing milestone-driven CSS contamination remains active. Camera distortion images were deliberately excluded because the prototype has no Security application.

`css/arwa.css` selectively adapts the source's burgundy title bars, rose window frames, desktop composition, shell icons, taskbar and Start menu. The wallpaper's embedded OS label is part of the artwork, not a game version declaration. Its decorative composition scales to the desktop to keep that label visible at different aspect ratios.

No source mockup JavaScript, application data, employee identities, case definitions, mail, assistant or security screens were imported. The personnel portrait remains the original neutral placeholder.

## Classroom demo pixel icons

Author: **Arwa**. Source folder: [HILFER Assets / icons / pixelated version / v1 (normal)](https://drive.google.com/drive/folders/1RWOiS3pH9OB7dtDT1f_3QP3WYxQZ1U_d). Downloaded original PNG bytes through authenticated Google Drive. Altynai's public repository also preserves the matching sources under `assets/icons/pixelated version/v1 (normal)/`.

| Original Drive file | Runtime derivative | Verified original Git blob SHA-1 |
|---|---|---|
| [15.png](https://drive.google.com/file/d/1Yr9cyiQUE-XqbZ3Nvlwfrot1HSejMzC4/view) | `icons/reconciliation-pixel.webp` | `4b3f688b017bfeb0ba9713b89c13520cb09a3909` |
| [19.png](https://drive.google.com/file/d/1g1HbXs8Apu8HTgVOpUR8tRo4ksBNAnjY/view) | `icons/records-pixel.webp` | `00e0f472cfe6b70eb1d2b0457b434827e0cd5631` |
| [4.png](https://drive.google.com/file/d/1-H9Varn3PYpDR8Tw92mSx5IPB7BP5Ixc/view) | `icons/display-pixel.webp` | `c95fc8c7cbb7cdfc8d87e9939d547c9a7f5df611` |
| [21.png](https://drive.google.com/file/d/10Z458sUuWABR9KkDJcNLkGp2G6uO8wj3/view) | `icons/hr-pixel.webp` | `ef1c022b22b7793a2d4bf06284486d02593942a0` |
| [5.png](https://drive.google.com/file/d/1OPuNqo00KmcJOvu7VRqUMSmdz_vcX_6X/view) | `icons/medical-pixel.webp` | `6a9593a7cc3dd595968d2169e653a7d1cf93cbfc` |

Each 3750 x 3750 original was verified by PNG signature, byte size and `git hash-object`, then reduced to 128 x 128 using nearest-neighbor and encoded as lossless WebP with transparency preserved. These five derivatives total **41,880 bytes**; full-size originals are not committed. They replace only application/department icons. The existing logo, wallpaper, artwork credits, upstream license, dynamic report and locked-case UI remain unchanged.

## Contextual assistant integration — 2026-11-04

Selective source: [Altynai / april-hpxd/HILFER](https://github.com/april-hpxd/HILFER), commit `7ff147e5` (latest inspected revision). The assistant's profile/correspondence arrangement and subtle portrait distortion are adapted in `js/apps/ai.js` and `css/ai.css`; contextual English copy is in `data/assistant.json`. The portrait uses the existing neutral `assets/placeholders/personnel.svg` placeholder.

- Arwa's `assets/arwa/saturated/terminal.png` becomes `assets/arwa/icons/assistant-pixel.webp`: 128 x 128, nearest-neighbor, lossless WebP, transparency retained (10,302 bytes).
- `assets/sounds/glitch.mp3` is copied unchanged from Altynai's repository (200,665 bytes); only its first 1.5 seconds are played. The upstream attribution does not identify a separate audio author.

The previously verified five pixel icon derivatives are retained. The existing logo/wallpaper and documentary styles remain unchanged. No ambient WAV, empty applications, static report mockups, additional portraits or full PNG collections are imported.

## Complete Graphite artwork — 2026-11-04

Source: Arwa's `assets/arwa/not saturated/` artwork in Altynai's `april-hpxd/HILFER` (same inspected revision `7ff147e5`). The archive theme selects these lossless, transparent WebP derivatives in `icons/`:

| Source PNG | Runtime WebP |
|---|---|
| `reconciliation.png` | `reconciliation-graphite.webp` |
| `downloads.png` | `records-graphite.webp` |
| `settings.png` | `display-graphite.webp` |
| `terminal.png` | `assistant-graphite.webp` |
| `employee_records.png` | `hr-graphite.webp` |
| `med_info.png` | `medical-graphite.webp` |
| `file.png` | `file-graphite.webp` |
| `logo_pixelated.png` | `logo-graphite.webp` |

Icons use nearest-neighbor reduction to 128 x 128; the central logo uses 512 x 512. `saturated/file.png` also supplies `file-pixel.webp` for the standard scheme. Altynai's Graphite multiply-blending treatment is retained on shell artwork, with coverage extended to the two department icons. Original full-size PNGs are not imported. The existing standard logo, wallpaper and five selected standard pixel icons are preserved.

The demo desktop-logo switch also uses `saturated/logo_pixelated.png` as `icons/logo-pixel.webp` (512 x 512, nearest-neighbor, transparent lossless WebP). The original `logo.webp` remains available. This switch affects only the large desktop logo; document and shell branding continue to follow the selected color scheme.
