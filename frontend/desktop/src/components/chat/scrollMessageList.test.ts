import { describe, expect, it, vi } from "vitest";

import { scrollMessageListToBottom } from "./scrollMessageList";

describe("scrollMessageListToBottom", () => {
  it("descarta retornos nativos do WebView em vez de expô-los ao useEffect", () => {
    const scrollIntoView = vi.fn(() => 1);

    const result = scrollMessageListToBottom({ scrollIntoView });

    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "end",
    });
    expect(result).toBeUndefined();
  });

  it("aceita a ausência temporária do marcador durante a montagem", () => {
    expect(scrollMessageListToBottom(null)).toBeUndefined();
  });
});
