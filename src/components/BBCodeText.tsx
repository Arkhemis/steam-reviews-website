import { Fragment, type ReactNode } from "react";

// Steam autorise un sous-ensemble de BBCode dans le texte des reviews qui
// remonte tel quel dans marts.review_highlight. On le parse ici plutôt que
// côté mart : c'est un souci d'affichage, pas de transformation de donnée.

type TextToken = { type: "text"; value: string };
type MarkerToken = { type: "item" };
type TagToken = { type: "open" | "close"; tag: string; attr?: string };
type Token = TextToken | MarkerToken | TagToken;

type BBNode = string | { tag: string; attr?: string; children: BBNode[] };

// Balises rendues avec leur contenu.
const RENDERED_TAGS = [
  "h1",
  "h2",
  "h3",
  "b",
  "i",
  "u",
  "strike",
  "spoiler",
  "url",
  "list",
  "olist",
  "quote",
  "code",
  "table",
  "tr",
  "th",
  "td",
];
// Séparateurs sans contenu, que Steam écrit quand même par paires : `[hr][/hr]`.
const VOID_TAGS = new Set(["hr"]);
// Contenu littéral : plus rien n'est interprété jusqu'à la fermeture.
const RAW_TAGS = new Set(["noparse"]);
// Médias qu'on ne sait pas rendre : la balise *et* son contenu disparaissent,
// sinon on afficherait l'URL brute de l'image ou l'identifiant de la vidéo.
const DROPPED_TAGS = new Set(["img", "previewyoutube", "dynamiclink"]);

const ALL_TAGS = [...RENDERED_TAGS, ...VOID_TAGS, ...RAW_TAGS, ...DROPPED_TAGS];

// Une seule liste de balises, et la regex en découle : c'est en la dupliquant
// qu'on a laissé `[hr][/hr]` s'afficher en clair. Les noms les plus longs
// passent devant pour que `[img]` ne se fasse pas manger par `i`.
const TAG_RE = new RegExp(
  `\\[(\\/)?(${[...ALL_TAGS].sort((a, b) => b.length - a.length).join("|")})(?:=([^\\]]*))?\\]|\\[\\*\\]`,
  "gi",
);

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let lastIndex = 0;
  TAG_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TAG_RE.exec(text))) {
    if (match.index > lastIndex) {
      tokens.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    lastIndex = TAG_RE.lastIndex;

    if (match[0] === "[*]") {
      tokens.push({ type: "item" });
      continue;
    }

    const tag = match[2].toLowerCase();
    if (!match[1] && RAW_TAGS.has(tag)) {
      const close = text.toLowerCase().indexOf(`[/${tag}]`, lastIndex);
      const end = close === -1 ? text.length : close;
      if (end > lastIndex) tokens.push({ type: "text", value: text.slice(lastIndex, end) });
      lastIndex = close === -1 ? text.length : close + tag.length + 3;
      TAG_RE.lastIndex = lastIndex;
      continue;
    }

    tokens.push(match[1] ? { type: "close", tag } : { type: "open", tag, attr: match[3] });
  }
  if (lastIndex < text.length) {
    tokens.push({ type: "text", value: text.slice(lastIndex) });
  }
  return tokens;
}

function buildTree(tokens: Token[]): BBNode[] {
  const root: BBNode[] = [];
  const stack: { tag: string; attr?: string; children: BBNode[] }[] = [];
  const currentChildren = () => (stack.length ? stack[stack.length - 1].children : root);

  for (const token of tokens) {
    if (token.type === "text") {
      currentChildren().push(token.value);
    } else if (token.type === "item") {
      currentChildren().push({ tag: "*", children: [] });
    } else if (token.type === "open") {
      const node = { tag: token.tag, attr: token.attr, children: [] as BBNode[] };
      currentChildren().push(node);
      // Une balise vide n'attend pas de fermeture : l'empiler avalerait la
      // suite du texte. Le `[/hr]` qui suit ne trouve rien et est ignoré.
      if (!VOID_TAGS.has(token.tag)) stack.push(node);
    } else {
      const openIndex = [...stack].reverse().findIndex((n) => n.tag === token.tag);
      if (openIndex !== -1) {
        stack.length -= openIndex + 1;
      }
    }
  }
  return root;
}

function withLineBreaks(text: string, key: string): ReactNode[] {
  const lines = text.split("\n");
  const nodes: ReactNode[] = [];
  lines.forEach((line, i) => {
    nodes.push(line);
    if (i < lines.length - 1) nodes.push(<br key={`${key}-br-${i}`} />);
  });
  return nodes;
}

function groupListItems(children: BBNode[]): BBNode[][] {
  const groups: BBNode[][] = [];
  let current: BBNode[] | null = null;
  for (const child of children) {
    if (typeof child !== "string" && child.tag === "*") {
      current = [];
      groups.push(current);
    } else if (current) {
      current.push(child);
    }
  }
  return groups;
}

// Les retours à la ligne entre `[tr]` ou entre `[td]` deviendraient des nœuds
// texte invalides dans un `<table>`.
function withoutBlankText(children: BBNode[]): BBNode[] {
  return children.filter((child) => typeof child !== "string" || child.trim() !== "");
}

// Le texte des reviews est du contenu utilisateur : on ne suit que le web, pas
// un `javascript:` ni un `data:` déguisé en lien.
function safeHref(attr: string | undefined): string | null {
  const href = attr?.trim();
  if (!href) return null;
  return /^https?:\/\//i.test(href) ? href : null;
}

function renderNodes(nodes: BBNode[], keyPrefix: string): ReactNode[] {
  return nodes.map((node, i) => renderNode(node, `${keyPrefix}-${i}`));
}

function renderNode(node: BBNode, key: string): ReactNode {
  if (typeof node === "string") {
    return <Fragment key={key}>{withLineBreaks(node, key)}</Fragment>;
  }

  if (DROPPED_TAGS.has(node.tag)) return null;

  switch (node.tag) {
    case "b":
      return <strong key={key}>{renderNodes(node.children, key)}</strong>;
    case "i":
      return <em key={key}>{renderNodes(node.children, key)}</em>;
    case "u":
      return (
        <span key={key} className="underline">
          {renderNodes(node.children, key)}
        </span>
      );
    case "strike":
      return (
        <span key={key} className="line-through">
          {renderNodes(node.children, key)}
        </span>
      );
    case "h1":
    case "h2":
    case "h3":
      return (
        <strong key={key} className="mt-2 mb-1 block font-bold text-neutral-100">
          {renderNodes(node.children, key)}
        </strong>
      );
    case "hr":
      return <hr key={key} className="my-3 border-0 border-t border-[#1e2b36]" />;
    case "url": {
      const href = safeHref(node.attr);
      if (!href) return <Fragment key={key}>{renderNodes(node.children, key)}</Fragment>;
      return (
        <a key={key} href={href} target="_blank" rel="noopener noreferrer" className="text-brand-blue underline">
          {renderNodes(node.children, key)}
        </a>
      );
    }
    case "spoiler":
      return (
        <details key={key} className="inline">
          <summary className="inline cursor-pointer text-neutral-500">Spoiler</summary>
          {renderNodes(node.children, key)}
        </details>
      );
    case "quote":
      return (
        <blockquote key={key} className="my-2 border-l-2 border-[#1e2b36] pl-3 text-[#b8c5cc]">
          {node.attr ? (
            <cite className="block text-[0.85em] not-italic opacity-70">{node.attr}</cite>
          ) : null}
          {renderNodes(node.children, key)}
        </blockquote>
      );
    case "code":
      return (
        <code key={key} className="rounded bg-[#0f1720] px-1 py-0.5 font-mono text-[0.9em] whitespace-pre-wrap">
          {renderNodes(node.children, key)}
        </code>
      );
    case "table":
      return (
        <table key={key} className="my-2 w-full border-collapse text-[0.9em]">
          <tbody>{renderNodes(withoutBlankText(node.children), key)}</tbody>
        </table>
      );
    case "tr":
      return <tr key={key}>{renderNodes(withoutBlankText(node.children), key)}</tr>;
    case "th":
      return (
        <th key={key} className="border border-[#1e2b36] px-2 py-1 text-left font-bold">
          {renderNodes(node.children, key)}
        </th>
      );
    case "td":
      return (
        <td key={key} className="border border-[#1e2b36] px-2 py-1">
          {renderNodes(node.children, key)}
        </td>
      );
    case "list":
    case "olist": {
      const items = groupListItems(node.children);
      const ListTag = node.tag === "olist" ? "ol" : "ul";
      return (
        <ListTag key={key} className={node.tag === "olist" ? "list-decimal pl-5" : "list-disc pl-5"}>
          {items.map((itemChildren, i) => (
            <li key={`${key}-li-${i}`}>{renderNodes(itemChildren, `${key}-li-${i}`)}</li>
          ))}
        </ListTag>
      );
    }
    default:
      return <Fragment key={key}>{renderNodes(node.children, key)}</Fragment>;
  }
}

export function BBCodeText({ text }: { text: string }) {
  const tree = buildTree(tokenize(text));
  return <>{renderNodes(tree, "n")}</>;
}
