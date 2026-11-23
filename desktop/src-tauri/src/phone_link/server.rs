//! The port phones reach: `GET /truemain-link` answers who is here (a phone
//! that lost this desktop's address tries every address of its network), and
//! `GET /link/v1` upgrades to the WebSocket carrying `phone_link::server`.
//!
//! Browsers are refused outright: a page open on this computer or on the
//! network must not be able to drive the client, and a browser always says
//! where it comes from (`Origin`, `Sec-Fetch-*`) where the phone app does not.

use std::net::{IpAddr, SocketAddr};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use phone_link::server::{Connection, Host, Step};
use phone_link::Frame;
use tauri::AppHandle;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{mpsc, watch};
use tokio_tungstenite::tungstenite::handshake::server::{ErrorResponse, Request, Response};
use tokio_tungstenite::tungstenite::protocol::frame::coding::CloseCode;
use tokio_tungstenite::tungstenite::protocol::{CloseFrame, WebSocketConfig};
use tokio_tungstenite::tungstenite::Message;

use super::{Inner, Outgoing};

const DISCOVERY_PATH: &str = "/truemain-link";
/// A phone that has not finished the handshake by then is dropped.
const HANDSHAKE_TIMEOUT: Duration = Duration::from_secs(20);
/// The phone pings every 20 s; silence this long means it is gone.
const IDLE_TIMEOUT: Duration = Duration::from_secs(75);

pub async fn listen(
    app: AppHandle,
    inner: Arc<Inner>,
    listener: TcpListener,
    mut stop: watch::Receiver<bool>,
) {
    loop {
        tokio::select! {
            accepted = listener.accept() => {
                let Ok((stream, peer)) = accepted else { continue };
                if !is_local(peer.ip()) {
                    continue;
                }
                tokio::spawn(handle(app.clone(), inner.clone(), stream, peer));
            }
            _ = stop.changed() => break,
        }
    }
}

/// Loopback and private networks only: the link is for the player's own Wi-Fi.
fn is_local(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => v4.is_private() || v4.is_loopback() || v4.is_link_local(),
        IpAddr::V6(v6) => {
            v6.is_loopback()
                || v6
                    .to_ipv4_mapped()
                    .is_some_and(|v4| v4.is_private() || v4.is_loopback())
        }
    }
}

async fn handle(app: AppHandle, inner: Arc<Inner>, mut stream: TcpStream, peer: SocketAddr) {
    let mut head = [0u8; 1024];
    let Ok(Ok(read)) = tokio::time::timeout(Duration::from_secs(5), stream.peek(&mut head)).await
    else {
        return;
    };
    let head = String::from_utf8_lossy(&head[..read]).to_string();
    let request_line = head.lines().next().unwrap_or_default();

    if request_line.starts_with(&format!("GET {DISCOVERY_PATH} ")) {
        if from_browser(&head) {
            return reply(&mut stream, "403 Forbidden", "{}").await;
        }
        let body = serde_json::json!({ "app": "truemain", "v": phone_link::VERSION, "name": inner.info().name }).to_string();
        return reply(&mut stream, "200 OK", &body).await;
    }
    if !request_line.starts_with(&format!("GET {} ", phone_link::PATH)) {
        return reply(&mut stream, "404 Not Found", "{}").await;
    }

    let config = WebSocketConfig {
        max_message_size: Some(phone_link::crypto::MAX_FRAME),
        ..Default::default()
    };
    let Ok(socket) =
        tokio_tungstenite::accept_hdr_async_with_config(stream, refuse_browsers, Some(config))
            .await
    else {
        return;
    };
    tracing::debug!(%peer, "phone connected");
    session(app, inner, socket).await;
}

/// The upgrade's own check, on the parsed headers. Its signature is tungstenite's.
#[allow(clippy::result_large_err)]
fn refuse_browsers(request: &Request, response: Response) -> Result<Response, ErrorResponse> {
    let browser = request.headers().contains_key("origin")
        || request
            .headers()
            .keys()
            .any(|name| name.as_str().starts_with("sec-fetch-"));
    if browser {
        let mut refusal = ErrorResponse::new(None);
        *refusal.status_mut() = tokio_tungstenite::tungstenite::http::StatusCode::FORBIDDEN;
        return Err(refusal);
    }
    Ok(response)
}

fn from_browser(head: &str) -> bool {
    head.lines().any(|line| {
        let line = line.to_ascii_lowercase();
        line.starts_with("origin:") || line.starts_with("sec-fetch-")
    })
}

async fn reply(stream: &mut TcpStream, status: &str, body: &str) {
    // The request was only peeked at: read it off before answering.
    let mut sink = [0u8; 1024];
    let _ = tokio::time::timeout(Duration::from_millis(200), stream.read(&mut sink)).await;
    let response = format!(
        "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    let _ = stream.write_all(response.as_bytes()).await;
    let _ = stream.shutdown().await;
}

async fn session(
    app: AppHandle,
    inner: Arc<Inner>,
    socket: tokio_tungstenite::WebSocketStream<TcpStream>,
) {
    let (mut sink, mut source) = socket.split();
    let (outbox, mut queue) = mpsc::unbounded_channel::<Outgoing>();
    let connection = Arc::new(Mutex::new(Connection::new()));
    let id = inner.register(connection.clone(), outbox.clone());

    let writer = tokio::spawn(async move {
        while let Some(outgoing) = queue.recv().await {
            let message = match outgoing {
                Outgoing::Frame(Frame::Text(text)) => Message::Text(text),
                Outgoing::Frame(Frame::Binary(bytes)) => Message::Binary(bytes),
                Outgoing::Close(code) => {
                    let frame = CloseFrame {
                        code: CloseCode::Normal,
                        reason: code.into(),
                    };
                    let _ = sink.send(Message::Close(Some(frame))).await;
                    let _ = sink.close().await;
                    break;
                }
            };
            if sink.send(message).await.is_err() {
                break;
            }
        }
    });

    // Who this desktop is, read once: the addresses do not change mid-session.
    let info = inner.info();
    let started = tokio::time::Instant::now();
    loop {
        let open = connection.lock().expect("connection poisoned").is_open();
        let wait = if open {
            IDLE_TIMEOUT
        } else {
            HANDSHAKE_TIMEOUT.saturating_sub(started.elapsed())
        };
        let message = match tokio::time::timeout(wait, source.next()).await {
            Ok(Some(Ok(message))) => message,
            _ => break,
        };
        let frame = match message {
            Message::Text(text) => Frame::Text(text),
            Message::Binary(bytes) => Frame::Binary(bytes),
            Message::Close(_) => break,
            _ => continue,
        };

        // The connection's frames are queued while it is locked, so the order
        // they were sealed in is the order they leave in — the counter nonce
        // makes any other order fatal.
        let steps = {
            let mut connection = connection.lock().expect("connection poisoned");
            let mut store = inner.store.lock().expect("phone store poisoned");
            let keys = store.keys().clone();
            let steps = connection.receive(
                frame,
                &mut Host {
                    keys: &keys,
                    info: &info,
                    registry: &mut *store,
                },
            );
            for step in &steps {
                if let Step::Send(frame) = step {
                    let _ = outbox.send(Outgoing::Frame(frame.clone()));
                }
            }
            steps
        };

        let mut closing = None;
        for step in steps {
            match step {
                Step::Send(_) => {}
                Step::Opened {
                    phone_id, paired, ..
                } => {
                    inner.opened(id, &phone_id, paired);
                }
                Step::Request {
                    id: request,
                    method,
                    path,
                    body,
                } => {
                    let (app, connection, outbox) =
                        (app.clone(), connection.clone(), outbox.clone());
                    tokio::spawn(async move {
                        let (status, body) =
                            super::relay::run(&app, &method, &path, body.as_ref()).await;
                        let mut connection = connection.lock().expect("connection poisoned");
                        if let Some(frame) = connection.respond(request, status, body) {
                            let _ = outbox.send(Outgoing::Frame(frame));
                        }
                    });
                }
                Step::Close { code } => {
                    tracing::debug!(%code, "phone link closed");
                    closing = Some(code);
                }
            }
        }
        if let Some(code) = closing {
            let _ = outbox.send(Outgoing::Close(code));
            break;
        }
    }

    let _ = outbox.send(Outgoing::Close("closed".into()));
    inner.unregister(id);
    let _ = tokio::time::timeout(Duration::from_secs(2), writer).await;
}
