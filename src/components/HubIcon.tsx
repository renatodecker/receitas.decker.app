/** Ícone "Layer" do hub decker.app.br (ver identidade-visual-decker.md) — link de volta para a página inicial do hub. */
export default function HubIcon() {
  return (
    <a
      href="https://decker.app.br"
      aria-label="decker.app — voltar ao hub"
      className="inline-flex shrink-0 items-center justify-center"
    >
      <svg viewBox="0 0 42 42" width="32" height="32" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="10" width="26" height="26" rx="4" fill="#185FA5" opacity="0.5" />
        <rect x="6" y="4" width="26" height="26" rx="4" fill="#378ADD" />
      </svg>
    </a>
  );
}
