//! What the phone link keeps: whether it is on, this desktop's static key and
//! the phones paired with it (`phone-link.json` in the app's config folder,
//! readable by the player's account only), and the pairing tokens on screen.

use std::path::{Path, PathBuf};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use phone_link::crypto::{b64, unb64, TOKEN_LEN};
use phone_link::server::{PairedPhone, Registry};
use phone_link::KeyPair;
use serde::{Deserialize, Serialize};

const FILE: &str = "phone-link.json";

/// How long a QR code pairs: long enough to find the phone and open the app.
pub const TOKEN_LIFETIME: Duration = Duration::from_secs(5 * 60);
/// QR codes live at once; showing a new one retires the oldest.
const LIVE_TOKENS: usize = 4;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Phone {
    pub phone_id: String,
    /// The phone's static key, base64url.
    pub key: String,
    pub name: String,
    pub platform: String,
    /// Unix seconds.
    pub paired_at: u64,
    pub last_seen_at: u64,
}

#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct File {
    enabled: bool,
    /// This desktop's static X25519 secret, base64url. Forgetting every phone rotates it.
    secret: Option<String>,
    phones: Vec<Phone>,
}

pub struct Store {
    path: PathBuf,
    file: File,
    keys: KeyPair,
    tokens: Vec<([u8; TOKEN_LEN], Instant)>,
}

pub fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or_default()
}

impl Store {
    pub fn load(dir: &Path) -> Self {
        let path = dir.join(FILE);
        let mut file: File = std::fs::read_to_string(&path)
            .ok()
            .and_then(|text| serde_json::from_str(&text).ok())
            .unwrap_or_default();
        let keys = match file.secret.as_deref().and_then(|s| unb64::<32>(s).ok()) {
            Some(secret) => KeyPair::from_secret(secret),
            None => {
                let keys = KeyPair::generate();
                file.secret = Some(b64(&keys.secret_bytes()));
                // A desktop with a new key knows none of the old phones.
                file.phones.clear();
                keys
            }
        };
        let store = Self {
            path,
            file,
            keys,
            tokens: Vec::new(),
        };
        store.save();
        store
    }

    fn save(&self) {
        if let Err(error) = write_private(&self.path, &self.file) {
            tracing::warn!(%error, "could not save the phone link");
        }
    }

    pub fn keys(&self) -> &KeyPair {
        &self.keys
    }

    pub fn enabled(&self) -> bool {
        self.file.enabled
    }

    pub fn set_enabled(&mut self, enabled: bool) {
        self.file.enabled = enabled;
        self.save();
    }

    pub fn phones(&self) -> &[Phone] {
        &self.file.phones
    }

    pub fn forget(&mut self, phone_id: &str) -> bool {
        let before = self.file.phones.len();
        self.file.phones.retain(|p| p.phone_id != phone_id);
        let removed = self.file.phones.len() != before;
        if removed {
            self.save();
        }
        removed
    }

    /// Every phone forgotten and a new key: a QR code photographed earlier,
    /// or a phone given away, can no longer reach this desktop.
    pub fn reset(&mut self) {
        self.keys = KeyPair::generate();
        self.file.secret = Some(b64(&self.keys.secret_bytes()));
        self.file.phones.clear();
        self.tokens.clear();
        self.save();
    }

    pub fn touch(&mut self, phone_id: &str) {
        if let Some(phone) = self.file.phones.iter_mut().find(|p| p.phone_id == phone_id) {
            phone.last_seen_at = now();
            self.save();
        }
    }

    /// A fresh single-use token for a QR code.
    pub fn issue_token(&mut self) -> [u8; TOKEN_LEN] {
        self.drop_expired();
        if self.tokens.len() >= LIVE_TOKENS {
            self.tokens.remove(0);
        }
        let token = phone_link::crypto::random();
        self.tokens.push((token, Instant::now() + TOKEN_LIFETIME));
        token
    }

    fn drop_expired(&mut self) {
        let now = Instant::now();
        self.tokens.retain(|(_, expires)| *expires > now);
    }
}

impl Registry for Store {
    fn phone_key(&self, phone_id: &str) -> Option<[u8; 32]> {
        let phone = self.file.phones.iter().find(|p| p.phone_id == phone_id)?;
        unb64::<32>(&phone.key).ok()
    }

    fn spend_token(&mut self, token: &[u8; TOKEN_LEN]) -> bool {
        self.drop_expired();
        // Compared in constant time: the token is the pairing's only secret.
        let found = self.tokens.iter().position(|(live, _)| {
            live.iter()
                .zip(token)
                .fold(0u8, |diff, (a, b)| diff | (a ^ b))
                == 0
        });
        match found {
            Some(index) => {
                self.tokens.remove(index);
                true
            }
            None => false,
        }
    }

    fn pair(&mut self, phone: PairedPhone) {
        let now = now();
        self.file.phones.retain(|p| p.phone_id != phone.phone_id);
        self.file.phones.push(Phone {
            phone_id: phone.phone_id,
            key: b64(&phone.key),
            name: phone.name,
            platform: phone.platform,
            paired_at: now,
            last_seen_at: now,
        });
        self.save();
    }
}

fn write_private(path: &Path, file: &File) -> std::io::Result<()> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir)?;
    }
    let text = serde_json::to_string_pretty(file).map_err(std::io::Error::other)?;
    let temporary = path.with_extension("json.tmp");
    std::fs::write(&temporary, text)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&temporary, std::fs::Permissions::from_mode(0o600))?;
    }
    std::fs::rename(&temporary, path)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn store() -> (Store, PathBuf) {
        let dir = std::env::temp_dir().join(format!(
            "truemain-phone-link-{}",
            phone_link::crypto::b64(&phone_link::crypto::random::<8>())
        ));
        (Store::load(&dir), dir)
    }

    #[test]
    fn a_token_pairs_once() {
        let (mut store, dir) = store();
        let token = store.issue_token();
        assert!(store.spend_token(&token));
        assert!(!store.spend_token(&token));
        assert!(!store.spend_token(&[0; TOKEN_LEN]));
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn keeps_its_key_and_phones_across_launches() {
        let (mut store, dir) = store();
        store.pair(PairedPhone {
            phone_id: "p".repeat(22),
            key: [5; 32],
            name: "Pixel".into(),
            platform: "android".into(),
        });
        let public = store.keys().public();
        let again = Store::load(&dir);
        assert_eq!(again.keys().public(), public);
        assert_eq!(again.phone_key(&"p".repeat(22)), Some([5; 32]));
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn a_reset_forgets_every_phone_and_changes_the_key() {
        let (mut store, dir) = store();
        store.pair(PairedPhone {
            phone_id: "p".repeat(22),
            key: [5; 32],
            name: "Pixel".into(),
            platform: "android".into(),
        });
        let public = store.keys().public();
        store.reset();
        assert_ne!(store.keys().public(), public);
        assert!(store.phones().is_empty());
        let _ = std::fs::remove_dir_all(dir);
    }
}
