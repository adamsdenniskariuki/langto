// Microphone permission: ask explicitly (from a user tap) so every browser shows its prompt,
// even when SpeechRecognition would not, or when only self-recording is available.

let granted = false;
let pending = null;

const nav = () => (typeof navigator !== 'undefined' ? navigator : null);

export function micSupported() {
  return !!nav()?.mediaDevices?.getUserMedia;
}

export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return !!(window.matchMedia?.('(display-mode: standalone)').matches || nav()?.standalone);
}

/** Map a getUserMedia / recognition failure to one of our error codes. */
export function micErrorCode(err) {
  const name = typeof err === 'string' ? err : err?.name || err?.message || '';
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'not-allowed':
    case 'service-not-allowed':
      return 'not-allowed';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
    case 'audio-capture':
      return 'no-mic';
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return 'mic-busy';
    case 'SecurityError':
    case 'insecure':
      return 'insecure';
    default:
      return name || 'error';
  }
}

export function micErrorMessage(code) {
  switch (micErrorCode(code)) {
    case 'not-allowed':
      return 'Microphone access is blocked. Click the lock icon in the address bar → Microphone → Allow, then try again (see Settings for step-by-step help).';
    case 'no-mic':
      return 'No microphone was found. Plug one in (or check your headset) and try again.';
    case 'mic-busy':
      return "Your microphone couldn't be started — another app may be using it, or your system privacy settings block the browser. Close other apps that use the mic and try again.";
    case 'insecure':
      return 'The microphone only works on a secure (https) page. Open Langto over https (not http).';
    case 'unsupported':
      return "This browser can't use the microphone.";
    default:
      return 'Something went wrong with the microphone. Try again.';
  }
}

/** Remember that access was lost (e.g. recognition reported not-allowed), so the next tap asks again. */
export function forgetMicPermission() {
  granted = false;
}

/**
 * Ask for the microphone (call from a user tap). Opens and immediately closes a stream so the browser
 * shows its permission prompt; caches success. Resolves true, or rejects with Error(code).
 */
export function ensureMicPermission() {
  if (granted) return Promise.resolve(true);
  if (pending) return pending;
  const n = nav();
  if (!n?.mediaDevices?.getUserMedia) {
    if (typeof window !== 'undefined' && window.isSecureContext === false) return Promise.reject(new Error('insecure'));
    // No getUserMedia (very old browser): let SpeechRecognition ask on its own.
    return Promise.resolve(true);
  }
  pending = n.mediaDevices
    .getUserMedia({ audio: true })
    .then((stream) => {
      stream.getTracks().forEach((t) => t.stop());
      granted = true;
      return true;
    })
    .catch((e) => {
      throw new Error(micErrorCode(e));
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

/** 'granted' | 'denied' | 'prompt' | 'unknown' — via the Permissions API where available. */
export async function micPermissionState() {
  try {
    const s = await nav()?.permissions?.query({ name: 'microphone' });
    if (s?.state) {
      if (s.state !== 'granted') granted = false;
      return s.state;
    }
  } catch {
    /* e.g. Firefox doesn't know the 'microphone' permission name */
  }
  return granted ? 'granted' : 'unknown';
}

/** Call `cb(state)` whenever the permission changes. Returns an unsubscribe function. */
export function watchMicPermission(cb) {
  let status = null;
  let off = false;
  const onChange = () => {
    if (status.state !== 'granted') granted = false;
    cb(status.state);
  };
  Promise.resolve(nav()?.permissions?.query({ name: 'microphone' }))
    .then((s) => {
      if (!s || off) return;
      status = s;
      s.addEventListener?.('change', onChange);
    })
    .catch(() => {});
  return () => {
    off = true;
    status?.removeEventListener?.('change', onChange);
  };
}

export const MIC_STATE_LABEL = {
  granted: 'Allowed',
  denied: 'Blocked',
  prompt: 'Not asked yet',
  unknown: 'Not asked yet',
};

/** Browser-specific steps to unblock the microphone. */
export function unblockSteps({ ua = nav()?.userAgent || '', standalone = isStandalone() } = {}) {
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && /Mobile/.test(ua));
  const android = /Android/.test(ua);
  const firefox = /Firefox|FxiOS/.test(ua);
  const edge = /Edg\//.test(ua);
  const chrome = !edge && /Chrome|CriOS/.test(ua);
  const safari = !chrome && !edge && !firefox && /Safari/.test(ua);
  const steps = [];
  if (ios) {
    if (standalone) steps.push('Open the iPhone/iPad Settings app → Safari → Microphone → Allow (or Ask), then reopen Langto from your Home Screen.');
    else steps.push('Tap “aA” in the address bar → Website Settings → Microphone → Allow.');
    steps.push('If that doesn’t help: Settings app → Safari → Microphone → Allow.');
  } else if (android) {
    if (standalone) steps.push('Long-press the Langto icon → App info → Permissions → Microphone → Allow.');
    else steps.push('Tap the lock icon (or ⋮ → Settings → Site settings) → Microphone → Allow, then reload.');
    steps.push('Also check Android Settings → Apps → your browser → Permissions → Microphone.');
  } else if (firefox) {
    steps.push('Click the microphone/permissions icon at the left of the address bar → remove “Blocked” for the microphone, then reload and allow it.');
  } else if (safari) {
    steps.push('In the menu bar choose Safari → Settings for this website… → Microphone → Allow, then reload.');
  } else {
    if (standalone) steps.push(`In the Langto app window, open the ⋯ menu → App info (or Site settings) → Microphone → Allow.`);
    else steps.push(`Click the lock icon in the address bar → ${edge ? 'Permissions for this site' : 'Site settings'} → Microphone → Allow, then reload the page.`);
  }
  if (!ios && !android) steps.push('Still blocked? Check your system privacy settings (Windows: Settings → Privacy & security → Microphone; macOS: System Settings → Privacy & Security → Microphone) and allow your browser.');
  return steps;
}
