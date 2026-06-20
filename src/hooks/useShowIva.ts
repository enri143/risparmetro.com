import { useEffect, useState } from "react";

const SHOW_IVA_KEY = "board_show_iva";
const CHANGE_EVENT = "board:show-iva-change";

function readShowIva(): boolean {
  try {
    return localStorage.getItem(SHOW_IVA_KEY) === "1";
  } catch {
    return false;
  }
}

export function setShowIva(v: boolean) {
  try { localStorage.setItem(SHOW_IVA_KEY, v ? "1" : "0"); } catch { /* noop */ }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useShowIva(): boolean {
  const [show, setShow] = useState<boolean>(readShowIva);

  useEffect(() => {
    const handler = () => setShow(readShowIva());
    window.addEventListener(CHANGE_EVENT, handler);
    return () => window.removeEventListener(CHANGE_EVENT, handler);
  }, []);

  return show;
}
