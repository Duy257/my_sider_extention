// === HTML SANITIZER — làm sạch HTML không tin cậy trước khi render vào trang extension ===
//
// Dùng chiến lược allowlist (danh sách trắng) thay vì chỉ loại bỏ `on*`:
// - Chỉ giữ lại các tag an toàn dành cho nội dung bài đọc.
// - Loại bỏ hoàn toàn subtree của các tag nguy hiểm (script/style/iframe/form/svg...).
// - Unwrap (giữ nội dung con) các tag không nằm trong danh sách.
// - Chỉ giữ attribute an toàn; với attribute chứa URL (href/src/cite) chỉ cho phép
//   scheme http/https/mailto hoặc URL tương đối — chặn javascript:, data:, vbscript:...
//
// DOMParser không thực thi script, nên việc parse/sanitize ở đây là an toàn.

const ALLOWED_TAGS = new Set([
  "a", "abbr", "b", "bdi", "bdo", "blockquote", "br", "caption", "cite", "code",
  "dd", "del", "details", "dfn", "div", "dl", "dt", "em", "figcaption", "figure",
  "h1", "h2", "h3", "h4", "h5", "h6", "hr", "i", "img", "ins", "kbd", "label",
  "li", "mark", "ol", "p", "pre", "q", "s", "samp", "small", "span", "strike",
  "strong", "sub", "summary", "sup", "table", "tbody", "td", "tfoot", "th",
  "thead", "time", "tr", "u", "ul", "var", "wbr",
]);

// Các tag bị xóa toàn bộ cùng nội dung con (không unwrap)
const DROP_WITH_CONTENT_TAGS = new Set([
  "script", "style", "iframe", "frame", "frameset", "object", "embed", "applet",
  "template", "noscript", "meta", "link", "base", "title", "head", "svg", "math",
  "form", "input", "button", "select", "option", "optgroup", "textarea",
  "audio", "video", "source", "track", "canvas", "slot", "dialog",
]);

// Attribute được phép giữ lại
const ALLOWED_ATTRS = new Set([
  "alt", "cite", "class", "colspan", "datetime", "dir", "href", "lang",
  "loading", "rowspan", "src", "start", "title", "type",
]);

// Attribute chứa URL — cần kiểm tra scheme
const URL_ATTRS = new Set(["href", "src", "cite"]);

// Chỉ cho phép scheme an toàn hoặc URL tương đối.
// Trình duyệt bỏ qua tab/xuống dòng bên trong URL, nên chuẩn hóa trước khi kiểm tra
// để chặn cả các biến thể như "jav\tascript:".
function isSafeUrl(raw: string): boolean {
  const value = raw.trim().replace(/[\t\r\n]/g, "");
  if (value === "") return true;

  const schemeMatch = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(value);
  if (!schemeMatch) return true; // URL tương đối (đường dẫn, query, hash, //host)

  const scheme = schemeMatch[1].toLowerCase();
  return scheme === "http" || scheme === "https" || scheme === "mailto";
}

function sanitizeAttributes(el: Element) {
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase();
    if (
      name.startsWith("on") ||
      !ALLOWED_ATTRS.has(name) ||
      (URL_ATTRS.has(name) && !isSafeUrl(attr.value))
    ) {
      el.removeAttribute(attr.name);
    }
  }
}

function sanitizeElement(el: Element) {
  const tagName = el.tagName.toLowerCase();

  if (DROP_WITH_CONTENT_TAGS.has(tagName)) {
    el.remove();
    return;
  }

  if (!ALLOWED_TAGS.has(tagName)) {
    // Tag lạ nhưng vô hại: giữ nội dung bên trong, bỏ vỏ tag
    const parent = el.parentNode;
    if (parent) {
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
    }
    el.remove();
    return;
  }

  sanitizeAttributes(el);
}

export function sanitizeHtml(html: string): string {
  if (!html) return "";

  const doc = new DOMParser().parseFromString(html, "text/html");

  // Nếu chuỗi bắt đầu bằng các tag head-only (meta/title/style/link/base),
  // parser sẽ đưa chúng vào <head> — nội dung head không được render, loại bỏ toàn bộ
  // để chặn cả các vector như <meta http-equiv="refresh">.
  for (const el of Array.from(doc.head.querySelectorAll("*"))) {
    el.remove();
  }

  const container = doc.body;
  // Bản thân <body> có thể mang attribute từ input (vd <body onload="...">)
  sanitizeAttributes(container);

  // Snapshot tĩnh: cây DOM sẽ bị thay đổi trong quá trình duyệt
  for (const el of Array.from(container.querySelectorAll("*"))) {
    sanitizeElement(el);
  }

  return container.innerHTML;
}
