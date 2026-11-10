//! TrueMain's shortcuts in the theme's icon (Windows): the Start menu's, the
//! desktop's and a pinned taskbar button's. A window launched from a shortcut
//! is shown on the taskbar under that shortcut's icon, whatever icon the
//! window sets (`chrome::set_taskbar_icon`), so the theme's icon reaches the
//! taskbar through them. The icon is written as an `.ico` under the app's data,
//! a new file per icon — the shell caches an icon by its path — and TrueMain's
//! own theme points the shortcuts back at the executable's icon.

use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};
use windows::core::{Interface, HSTRING};
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoUninitialize, IPersistFile, CLSCTX_INPROC_SERVER,
    COINIT_APARTMENTTHREADED, STGM_READWRITE,
};
use windows::Win32::UI::Shell::{
    IShellLinkW, SHChangeNotify, ShellLink, SHCNE_ASSOCCHANGED, SHCNF_IDLIST,
};

/// The theme's icon on TrueMain's shortcuts — `rgba`, a square of its side in
/// pixels — or the executable's own when None. On a thread of its own: the
/// shell's calls take a while, and want COM set up where they run.
pub fn paint(app: &AppHandle, rgba: Option<(Vec<u8>, u32)>) {
    let Ok(exe) = std::env::current_exe() else {
        return;
    };
    let icons = app
        .path()
        .app_local_data_dir()
        .ok()
        .map(|dir| dir.join("icons"));
    std::thread::spawn(move || {
        let icon = match (rgba, icons) {
            (Some((pixels, side)), Some(dir)) => match write_icon(&dir, &pixels, side) {
                Ok(path) => path,
                Err(error) => {
                    tracing::warn!(%error, "the theme's icon was not written");
                    return;
                }
            },
            _ => exe.clone(),
        };
        // SAFETY: COM is set up on this thread for its own calls only, and
        // torn down once they are done.
        unsafe {
            let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
            let changed = shortcuts()
                .iter()
                .filter(|link| repaint(link, &exe, &icon).unwrap_or(false))
                .count();
            if changed > 0 {
                SHChangeNotify(SHCNE_ASSOCCHANGED, SHCNF_IDLIST, None, None);
            }
            CoUninitialize();
        }
    });
}

/// The shortcuts that may be TrueMain's, named after it: in the user's and in
/// every user's Start menu, on the desktop, and pinned to the taskbar.
fn shortcuts() -> Vec<PathBuf> {
    let mut roots: Vec<(PathBuf, u32)> = Vec::new();
    if let Some(roaming) = dirs::data_dir() {
        roots.push((roaming.join(r"Microsoft\Windows\Start Menu\Programs"), 2));
        roots.push((
            roaming.join(r"Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar"),
            0,
        ));
    }
    if let Some(desktop) = dirs::desktop_dir() {
        roots.push((desktop, 0));
    }
    if let Some(all) = std::env::var_os("ProgramData") {
        roots.push((
            PathBuf::from(all).join(r"Microsoft\Windows\Start Menu\Programs"),
            2,
        ));
    }
    let mut found = Vec::new();
    for (root, depth) in roots {
        collect(&root, depth, &mut found);
    }
    found
}

fn collect(dir: &Path, depth: u32, found: &mut Vec<PathBuf>) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if depth > 0 {
                collect(&path, depth - 1, found);
            }
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_lowercase();
        if name.ends_with(".lnk") && name.contains("truemain") {
            found.push(path);
        }
    }
}

/// Point `link` at `icon` when it is a shortcut to `exe` showing another;
/// whether it was rewritten. A shortcut that names no icon shows the
/// executable's, so it stays as it is when that is the one wanted.
unsafe fn repaint(link: &Path, exe: &Path, icon: &Path) -> windows::core::Result<bool> {
    let shell: IShellLinkW = CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER)?;
    let file: IPersistFile = shell.cast()?;
    let path = HSTRING::from(link.as_os_str());
    file.Load(&path, STGM_READWRITE)?;
    let mut target = [0u16; 1024];
    shell.GetPath(&mut target, std::ptr::null_mut(), 0)?;
    if !same(&wide(&target), exe) {
        return Ok(false);
    }
    let mut current = [0u16; 1024];
    let mut index = 0;
    shell.GetIconLocation(&mut current, &mut index)?;
    let current = wide(&current);
    let unnamed = current.as_os_str().is_empty() && same(icon, exe);
    if unnamed || (same(&current, icon) && index == 0) {
        return Ok(false);
    }
    shell.SetIconLocation(&HSTRING::from(icon.as_os_str()), 0)?;
    file.Save(&path, true)?;
    Ok(true)
}

/// A path the shell wrote into `buffer`, up to its terminating zero.
fn wide(buffer: &[u16]) -> PathBuf {
    let end = buffer
        .iter()
        .position(|&unit| unit == 0)
        .unwrap_or(buffer.len());
    PathBuf::from(String::from_utf16_lossy(&buffer[..end]))
}

/// Two paths alike as Windows compares them: case aside.
fn same(a: &Path, b: &Path) -> bool {
    a.to_string_lossy().to_lowercase() == b.to_string_lossy().to_lowercase()
}

/// The icon file, under `dir` and named after its pixels; any other icon
/// written there before is removed.
fn write_icon(dir: &Path, rgba: &[u8], side: u32) -> std::io::Result<PathBuf> {
    let path = dir.join(format!("theme-{:016x}.ico", fnv(rgba)));
    std::fs::create_dir_all(dir)?;
    if !path.exists() {
        std::fs::write(&path, ico(rgba, side))?;
    }
    for entry in std::fs::read_dir(dir)?.flatten() {
        if entry.path() != path {
            let _ = std::fs::remove_file(entry.path());
        }
    }
    Ok(path)
}

/// FNV-1a: a name that changes with the icon's pixels.
fn fnv(bytes: &[u8]) -> u64 {
    bytes.iter().fold(0xcbf2_9ce4_8422_2325, |hash, &byte| {
        (hash ^ u64::from(byte)).wrapping_mul(0x0100_0000_01b3)
    })
}

/// An icon file of one 32-bit image: its header and entry, then the image as
/// a bitmap — BGRA rows bottom up, the height counting an AND mask after them,
/// left clear as the alpha draws the edges.
fn ico(rgba: &[u8], side: u32) -> Vec<u8> {
    let width = side as usize;
    let mask_row = width.div_ceil(32) * 4;
    let image = 40 + width * width * 4 + mask_row * width;
    let mut out = Vec::with_capacity(22 + image);
    // ICONDIR: reserved, an icon, one image.
    out.extend_from_slice(&[0, 0, 1, 0, 1, 0]);
    // ICONDIRENTRY: 0 stands for 256 pixels and more.
    let dimension = if side >= 256 { 0 } else { side as u8 };
    out.extend_from_slice(&[dimension, dimension, 0, 0]);
    out.extend_from_slice(&1u16.to_le_bytes());
    out.extend_from_slice(&32u16.to_le_bytes());
    out.extend_from_slice(&(image as u32).to_le_bytes());
    out.extend_from_slice(&22u32.to_le_bytes());
    // BITMAPINFOHEADER.
    out.extend_from_slice(&40u32.to_le_bytes());
    out.extend_from_slice(&(side as i32).to_le_bytes());
    out.extend_from_slice(&((side * 2) as i32).to_le_bytes());
    out.extend_from_slice(&1u16.to_le_bytes());
    out.extend_from_slice(&32u16.to_le_bytes());
    out.extend_from_slice(&[0; 24]);
    for row in (0..width).rev() {
        for pixel in rgba[row * width * 4..(row + 1) * width * 4].chunks_exact(4) {
            out.extend_from_slice(&[pixel[2], pixel[1], pixel[0], pixel[3]]);
        }
    }
    out.resize(out.len() + mask_row * width, 0);
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_icon_file_holds_one_bottom_up_bgra_image_and_its_mask() {
        // A 2×2 square: red, green on top; blue, white under them.
        let rgba = [
            255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 128,
        ];
        let file = ico(&rgba, 2);
        assert_eq!(&file[..6], &[0, 0, 1, 0, 1, 0]);
        assert_eq!(&file[6..8], &[2, 2]);
        assert_eq!(
            u32::from_le_bytes(file[14..18].try_into().unwrap()) as usize,
            file.len() - 22
        );
        assert_eq!(i32::from_le_bytes(file[30..34].try_into().unwrap()), 4);
        // The bottom row first, each pixel BGRA.
        assert_eq!(&file[62..70], &[255, 0, 0, 255, 255, 255, 255, 128]);
        assert_eq!(&file[70..78], &[0, 0, 255, 255, 0, 255, 0, 255]);
        assert_eq!(file.len(), 22 + 40 + 16 + 8);
    }
}
