import { useEffect, useState } from "react";

const DISCOUNT_KEY = "board_negotiation_discount";
const DEBUG_KEY = "board_negotiation_debug";
const CHANGE_EVENT = "board:negotiation-change";

function readDiscount(): number {
  try {
    return parseFloat(localStorage.getItem(DISCOUNT_KEY) ?? "0") || 0;
  } catch {
    return 0;
  }
}

function readDebug(): boolean {
  try {
    return localStorage.getItem(DEBUG_KEY) === "1";
  } catch {
    return false;
  }
}

export function useNegotiationDiscount() {
  const [discount, setDiscountState] = useState<number>(readDiscount);
  const [debug, setDebugState] = useState<boolean>(readDebug);

  useEffect(() => {
    const handler = () => {
      setDiscountState(readDiscount());
      setDebugState(readDebug());
    };
    window.addEventListener(CHANGE_EVENT, handler);
    return () => window.removeEventListener(CHANGE_EVENT, handler);
  }, []);

  const setDiscount = (v: number) => {
    try { localStorage.setItem(DISCOUNT_KEY, String(v)); } catch { /* noop */ }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };

  const setDebug = (v: boolean) => {
    try { localStorage.setItem(DEBUG_KEY, v ? "1" : "0"); } catch { /* noop */ }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };

  const reset = () => setDiscount(0);

  return { discount, debug, setDiscount, setDebug, reset };
}
