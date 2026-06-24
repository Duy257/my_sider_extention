export default defineUnlistedScript(() => {
  window.dispatchEvent(new CustomEvent("personal-ai-sidebar:agent-ready"));
});
