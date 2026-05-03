export interface SharePayload {
  title: string;
  text: string;
  url?: string;
}

export async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

export async function shareOrCopy(payload: SharePayload) {
  const url = payload.url ?? window.location.href;
  const text = `${payload.text}\n${url}`;

  if (navigator.share) {
    await navigator.share({ title: payload.title, text: payload.text, url });
    return "shared" as const;
  }

  await copyText(text);
  return "copied" as const;
}
