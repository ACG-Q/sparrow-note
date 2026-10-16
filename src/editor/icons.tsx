const S = { width: 20, height: 20, viewBox: "0 0 20 20", fill: "none", xmlns: "http://www.w3.org/2000/svg" } as const;

export function BlockIcon({ type }: { type: string }) {
  switch (type) {
    case "mood":
      return (
        <svg {...S}>
          <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="7.2" cy="8.2" r="1" fill="currentColor" />
          <circle cx="12.8" cy="8.2" r="1" fill="currentColor" />
          <path d="M6.8 12c.8 1.2 1.9 1.8 3.2 1.8s2.4-.6 3.2-1.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "anniversary":
      return (
        <svg {...S}>
          <rect x="2.75" y="4.25" width="14.5" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M2.75 8.25h14.5M6.5 2.75v3M13.5 2.75v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M10 11.2v3.6M8.2 13h3.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "contact":
      return (
        <svg {...S}>
          <circle cx="10" cy="7" r="3.25" stroke="currentColor" strokeWidth="1.5" />
          <path d="M4 16.5c.6-2.8 2.9-4.25 6-4.25s5.4 1.45 6 4.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "location":
      return (
        <svg {...S}>
          <path d="M10 17.5s5.5-4.6 5.5-9a5.5 5.5 0 1 0-11 0c0 4.4 5.5 9 5.5 9Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <circle cx="10" cy="8.4" r="2" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case "checklist":
      return (
        <svg {...S}>
          <rect x="2.75" y="2.75" width="14.5" height="14.5" rx="3" stroke="currentColor" strokeWidth="1.5" />
          <path d="M6.4 10.2l2.4 2.4 4.8-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "bookmark":
      return (
        <svg {...S}>
          <path d="M8.4 11.6l3.2-3.2M7.1 13.6l-1 .9a3 3 0 0 1-4.2-4.2l2.5-2.5a3 3 0 0 1 4.2 0M12.9 6.4l1-.9a3 3 0 1 1 4.2 4.2l-2.5 2.5a3 3 0 0 1-4.2 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "account":
      return (
        <svg {...S}>
          <circle cx="7" cy="10" r="3.75" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10.75 10h6.5M15 10v2.4M17.25 10v1.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "bankcard":
      return (
        <svg {...S}>
          <rect x="2.25" y="4.75" width="15.5" height="10.5" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M2.25 8.25h15.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M5.5 12.5h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "drawing":
      return (
        <svg {...S}>
          <path d="M12.6 3.9l3.5 3.5L7.5 16H4v-3.5l8.6-8.6Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M11 5.5l3.5 3.5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case "voice":
      return (
        <svg {...S}>
          <rect x="7.4" y="2.5" width="5.2" height="9.6" rx="2.6" stroke="currentColor" strokeWidth="1.5" />
          <path d="M4.75 9.75a5.25 5.25 0 0 0 10.5 0M10 15v2.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "image":
      return (
        <svg {...S}>
          <rect x="2.75" y="3.75" width="14.5" height="12.5" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="7.2" cy="8" r="1.35" stroke="currentColor" strokeWidth="1.3" />
          <path d="M3.5 14.5l3.8-3.4a1.5 1.5 0 0 1 2 .06L13 14.4M12 12.6l1.4-1.2a1.5 1.5 0 0 1 2 .06l1.2 1.1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );
    case "video":
      return (
        <svg {...S}>
          <rect x="2.25" y="5.25" width="10.5" height="9.5" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M12.75 9.4l4.9-2.6a.6.6 0 0 1 .85.54v5.32a.6.6 0 0 1-.85.54l-4.9-2.6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      );
    default:
      return (
        <svg {...S}>
          <rect x="3.75" y="3.75" width="12.5" height="12.5" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
  }
}

const eyeOpen = (
  <>
    <path d="M1.8 10S5 4.5 10 4.5 18.2 10 18.2 10 15 15.5 10 15.5 1.8 10 1.8 10Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <circle cx="10" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.5" />
  </>
);

const eyeOff = (
  <>
    <path d="M3 3l14 14M8.1 8.2A2.4 2.4 0 0 0 10 12.4c.65 0 1.24-.26 1.68-.68M5.2 5.7C3.3 7 1.8 10 1.8 10S5 15.5 10 15.5c1.4 0 2.63-.44 3.7-1.05M15.6 12.9c1.4-1.2 2.6-2.9 2.6-2.9S15 4.5 10 4.5c-.5 0-.98.05-1.45.14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </>
);

export function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      {off ? eyeOff : eyeOpen}
    </svg>
  );
}

export function PinIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 17.5s5.5-4.6 5.5-9a5.5 5.5 0 1 0-11 0c0 4.4 5.5 9 5.5 9Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="10" cy="8.4" r="2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function LinkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8.4 11.6l3.2-3.2M7.1 13.6l-1 .9a3 3 0 0 1-4.2-4.2l2.5-2.5a3 3 0 0 1 4.2 0M12.9 6.4l1-.9a3 3 0 1 1 4.2 4.2l-2.5 2.5a3 3 0 0 1-4.2 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.6 3.9l3.5 3.5L7.5 16H4v-3.5l8.6-8.6Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M11 5.5l3.5 3.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3.5 5.5h13M8 5.5V4a1.5 1.5 0 0 1 1.5-1.5h1A1.5 1.5 0 0 1 12 4v1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 5.5l.7 10a1.5 1.5 0 0 0 1.5 1.4h4.6a1.5 1.5 0 0 0 1.5-1.4l.7-10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.3 8.7v5M11.7 8.7v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function MicIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="7.4" y="2.5" width="5.2" height="9.6" rx="2.6" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4.75 9.75a5.25 5.25 0 0 0 10.5 0M10 15v2.75" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="7" y="7" width="9.5" height="9.5" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M13 4.5A1.5 1.5 0 0 0 11.5 3h-7A1.5 1.5 0 0 0 3 4.5v7A1.5 1.5 0 0 0 4.5 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16.5 10a6.5 6.5 0 1 1-1.9-4.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M16.5 3v3.5H13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
