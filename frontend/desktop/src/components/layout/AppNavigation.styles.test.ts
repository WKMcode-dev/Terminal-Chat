/// <reference types="node" />

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const layout = readFileSync(
  new URL("../../styles/layout.css", import.meta.url),
  "utf8",
);
const tokens = readFileSync(
  new URL("../../styles/tokens.css", import.meta.url),
  "utf8",
);

describe("contrato responsivo da navegação", () => {
  it("mantém ícone e rótulo em zonas estáveis", () => {
    expect(layout).toMatch(/\.nav-icon\s*\{[^}]*width:\s*32px;/s);
    expect(layout).toMatch(/\.nav-icon\s*\{[^}]*height:\s*32px;/s);
    expect(layout).toMatch(/\.nav-label\s*\{[^}]*white-space:\s*nowrap;/s);
  });

  it.each([1180, 960, 720, 520, 380])(
    "preserva o breakpoint oficial de %d px",
    (breakpoint) => {
      expect(layout).toContain(`@media (max-width: ${breakpoint}px)`);
    },
  );

  it("impede rolagem global da janela", () => {
    expect(tokens).toMatch(/body\s*\{[^}]*overflow:\s*hidden;/s);
  });
});
