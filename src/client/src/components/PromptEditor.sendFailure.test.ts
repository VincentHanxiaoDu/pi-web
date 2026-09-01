// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";
import { PromptEditor } from "./PromptEditor";

afterEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
});

/**
 * A dropped connection on submit used to swallow the message: the composer
 * cleared optimistically and nothing put it back. Retyping a long prompt and
 * re-picking images that may no longer be at hand is the kind of loss that
 * makes people stop trusting the app.
 */
describe("prompt-editor send failure", () => {
  it("restores the text when the send is rejected", async () => {
    const onSend = vi.fn(() => Promise.resolve(false));
    const editor = await mount(onSend);
    editor.replaceText("a long message worth keeping");

    await submit(editor);

    expect(onSend).toHaveBeenCalled();
    expect(draft(editor)).toBe("a long message worth keeping");
  });

  it("restores the attachments too", async () => {
    const onSend = vi.fn(() => Promise.resolve(false));
    const editor = await mount(onSend);
    editor.restorePrompt({
      text: "look at this",
      attachments: [{ kind: "image", mimeType: "image/png", data: "AAAA", name: "shot.png" }],
    });
    await editor.updateComplete;

    await submit(editor);

    // Re-picking a screenshot from a share sheet is often impossible.
    expect(shadow(editor).querySelectorAll(".attachment-chip")).toHaveLength(1);
    expect(draft(editor)).toBe("look at this");
  });

  it("saves a network-dropped send to the outbox instead of restoring the draft", async () => {
    const onSend = vi.fn(() => Promise.reject(new TypeError("Failed to fetch")));
    const editor = await mount(onSend);
    editor.replaceText("typed while offline");

    await submit(editor);

    // The composer is cleared and the message waits in the outbox for the
    // next online event (see pendingOutbox); retrying is automatic.
    expect(draft(editor)).toBe("");
  });

  it("restores the draft when the send fails for a non-network reason", async () => {
    const onSend = vi.fn(() => Promise.reject(new Error("400 Bad Request")));
    const editor = await mount(onSend);
    editor.replaceText("rejected but not dropped");

    await submit(editor);

    expect(draft(editor)).toBe("rejected but not dropped");
  });

  it("keeps the composer clear when the send succeeds", async () => {
    const onSend = vi.fn(() => Promise.resolve(true));
    const editor = await mount(onSend);
    editor.replaceText("delivered");

    await submit(editor);

    expect(draft(editor)).toBe("");
  });

  it("keeps the composer clear for handlers that report nothing", async () => {
    // Preserves the old contract rather than restoring on every send.
    const onSend = vi.fn(() => undefined);
    const editor = await mount(onSend);
    editor.replaceText("legacy handler");

    await submit(editor);

    expect(draft(editor)).toBe("");
  });

  it("does not overwrite something typed while the send was in flight", async () => {
    let release: (value: boolean) => void = () => undefined;
    const onSend = vi.fn(() => new Promise<boolean>((resolve) => { release = resolve; }));
    const editor = await mount(onSend);
    editor.replaceText("first message");

    await submit(editor);
    editor.replaceText("newer intent");
    release(false);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await editor.updateComplete;

    // The newer text is the user's current intent; replacing it would be a
    // second kind of loss.
    expect(draft(editor)).toBe("newer intent");
  });
});

type SendHandler = NonNullable<PromptEditor["onSend"]>;

async function mount(onSend: SendHandler): Promise<PromptEditor> {
  const editor = new PromptEditor();
  editor.sessionId = "send-failure";
  editor.cwd = "/tmp";
  editor.onSend = onSend;
  document.body.append(editor);
  await editor.updateComplete;
  // The CodeMirror module is loaded lazily, and every assertion here reads the
  // editor's document. Waiting for the view itself rather than a fixed sleep
  // keeps the test honest on a slow machine: a fixed 200ms passed on CI and
  // failed locally under load, which reads as a broken restore when the only
  // thing that was late is the editor's mount.
  await settleEditorView(editor);
  return editor;
}

async function settleEditorView(editor: PromptEditor): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (editor.view !== undefined) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("The prompt editor's view never mounted");
}

async function submit(editor: PromptEditor): Promise<void> {
  const button = shadow(editor).querySelector<HTMLButtonElement>(".send-button");
  if (button === null) throw new Error("Expected a send button");
  button.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await editor.updateComplete;
  // The send handler settles in its own microtask chain and the restore lands
  // after it; give that chain its turns before reading the document.
  await new Promise((resolve) => setTimeout(resolve, 0));
  await editor.updateComplete;
}

function draft(editor: PromptEditor): string {
  return editor.view?.state.doc.toString() ?? "";
}

function shadow(editor: PromptEditor): ShadowRoot {
  const root = editor.shadowRoot;
  if (root === null) throw new Error("Expected prompt-editor shadow root");
  return root;
}
