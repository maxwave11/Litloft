import { afterEach, describe, expect, it } from "vitest";
import {
  GENERIC_PROVIDER,
  _resetPlayerRegistryForTests,
  getLoftPlayer,
  registerLoftPlayer,
  registeredPlayerNames,
  subscribePlayers,
} from "../playerRegistry";

const Stub = () => null;
const Other = () => null;

afterEach(() => {
  _resetPlayerRegistryForTests();
});

describe("playerRegistry", () => {
  it("returns null for unregistered providers", () => {
    expect(getLoftPlayer("unknown")).toBeNull();
    expect(getLoftPlayer(GENERIC_PROVIDER)).toBeNull();
  });

  it("registers and resolves a player by name", () => {
    registerLoftPlayer("youtube", Stub);
    expect(getLoftPlayer("youtube")).toBe(Stub);
  });

  it("re-registering overwrites the previous component", () => {
    registerLoftPlayer("youtube", Stub);
    registerLoftPlayer("youtube", Other);
    expect(getLoftPlayer("youtube")).toBe(Other);
    expect(registeredPlayerNames().filter((n) => n === "youtube")).toHaveLength(1);
  });

  it("tells a subscriber when a player registers, until it unsubscribes", () => {
    let calls = 0;
    const unsubscribe = subscribePlayers(() => {
      calls += 1;
    });
    registerLoftPlayer("youtube", Stub);
    expect(calls).toBe(1);
    unsubscribe();
    registerLoftPlayer("vimeo", Other);
    expect(calls).toBe(1);
  });

  it("rejects empty name", () => {
    expect(() => registerLoftPlayer("", Stub)).toThrow();
  });

  it("rejects the reserved generic name", () => {
    expect(() => registerLoftPlayer(GENERIC_PROVIDER, Stub)).toThrow();
  });

  it("registeredPlayerNames lists all registrations", () => {
    registerLoftPlayer("youtube", Stub);
    registerLoftPlayer("vimeo", Other);
    expect(registeredPlayerNames().sort()).toEqual(["vimeo", "youtube"]);
  });
});
