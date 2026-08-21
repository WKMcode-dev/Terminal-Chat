interface ScrollTarget {
  scrollIntoView(options?: ScrollIntoViewOptions): void;
}

export function scrollMessageListToBottom(target: ScrollTarget | null): void {
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "end" });
}
