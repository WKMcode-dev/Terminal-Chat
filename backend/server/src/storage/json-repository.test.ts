import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { JsonRepository } from "./json-repository.js";

describe("JsonRepository social profiles", () => {
  it("persists profile edits and the complete friendship lifecycle", async () => {
    const directory = await mkdtemp(join(tmpdir(), "terminal-chat-social-"));
    const repository = new JsonRepository(join(directory, "data.json"));
    await repository.init();
    const kenneth = await repository.createUser({
      username: "kenneth",
      displayName: "Kenneth",
      passwordHash: "hash-a",
    });
    const naki = await repository.createUser({
      username: "naki",
      displayName: "Naki",
      passwordHash: "hash-b",
    });

    const updated = await repository.updateProfile(kenneth.id, {
      displayName: "Kenneth Kitsune",
      bio: "Desenvolvedor do Terminal Chat",
      avatar: "🦊",
      activity: "Programando",
    });
    expect(updated.avatar).toBe("🦊");
    expect(updated.bio).toContain("Terminal Chat");

    const request = await repository.createFriendRequest(kenneth.id, naki.id);
    expect(request.status).toBe("pending");
    const accepted = await repository.respondFriendRequest(
      naki.id,
      request.id,
      "accept",
    );
    expect(accepted?.status).toBe("accepted");
    expect(await repository.removeFriendship(kenneth.id, naki.id)).toBe(true);

    const blocked = await repository.blockUser(kenneth.id, naki.id);
    expect(blocked.status).toBe("blocked");
    await expect(
      repository.createFriendRequest(naki.id, kenneth.id),
    ).rejects.toThrow("USER_BLOCKED");
    expect(await repository.removeFriendship(kenneth.id, naki.id)).toBe(true);
    await repository.close();
  });
});
