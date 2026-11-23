# TrueMain for Android

The phone companion: queue, lobby, ready check, champion select (pick, ban, spells, skins, trades, bench, runes),
the game in progress, match history, and TrueMain's tier list and builds — on the player's phone, driving the League
client through the TrueMain desktop app on the same Wi-Fi. Kotlin + Jetpack Compose, no shared code with the Nuxt apps.

## How it reaches the client

The desktop app's **phone link** (`desktop/src-tauri/src/phone_link`, Settings → Phone) listens on port 42719 of the
local network. The phone pairs once by scanning its QR code, then resumes on its own. The protocol is defined in
`desktop/crates/phone-link` (Rust); `app/src/main/java/lol/truemain/mobile/link/` is its phone side in Kotlin:

- `Crypto.kt` — X25519, HKDF-SHA256, ChaCha20-Poly1305 (Bouncy Castle's lightweight API), the counter-nonce channel.
- `PhoneLink.kt` — the handshake state machine, a port of `phone_link::phone`.
- `LinkClient.kt` — the WebSocket (OkHttp), one queue for every touch of the link, reconnection, requests and events.
- `Discovery.kt` — finds the desktop again on the phone's /24 when its address changed.

`app/src/test/resources/link-vectors.json` is a copy of `desktop/crates/phone-link/vectors.json`: `VectorsTest`
checks the Kotlin port byte for byte against it, and the crate's own test fails while the copies differ. After a
deliberate protocol change: `PHONE_LINK_WRITE_VECTORS=1 cargo test -p phone-link --test vectors`, then copy the file.

The phone's identity (an id and a static key, the secret wrapped by an Android Keystore key) and the paired desktop
live in `store/PairingStore.kt`. What a phone may ask is the desktop's allow-list (`phone_link::allow`); a new screen
needing an endpoint adds it there first.

## Build

JDK 21 and the Android SDK (platform `android-37.2`, build-tools 36):

```sh
export JAVA_HOME=…/jbr-21 ANDROID_HOME=~/Library/Android/sdk
./gradlew :app:testDebugUnitTest   # the protocol against the vectors
./gradlew :app:assembleDebug       # app/build/outputs/apk/debug/app-debug.apk
./gradlew :app:assembleRelease     # minified, signed with the debug key for local installs
```

`-PtruemainSiteUrl=https://…` points the builds and tier list at another site (preprod).
