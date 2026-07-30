import { Fragment, type ReactNode } from "react";

// Steam autorise un sous-ensemble de BBCode dans le texte des reviews
// (b, i, u, strike, h1-h3, url, spoiler, list/olist + [*]) qui remonte tel
// quel dans marts.review_highlight. On le parse ici plutôt que côté mart :
// c'est un souci d'affichage, pas de transformation de donnée.

type TextToken = { type: "text"; value: string };
type MarkerToken = { type: "item" };
type TagToken = { type: "open" | "close"; tag: string; attr?: string };
type Token = TextToken | MarkerToken | TagToken;

type BBNode = string | { tag: string; attr?: string; children: BBNode[] };

const KNOWN_TAGS = new Set(["h1", "h2", "h3", "b", "i", "u", "strike", "spoiler", "list", "olist", "url"]);

const TAG_RE = /\[(\/)?(h1|h2|h3|b|i|u|strike|spoiler|list|olist|url)(?:=([^\]]*))?\]|\[\*\]/gi;

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let lastIndex = 0;
  TAG_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TAG_RE.exec(text))) {
    if (match.index > lastIndex) {
      tokens.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    if (match[0] === "[*]") {
      tokens.push({ type: "item" });
    } else {
      const tag = match[2].toLowerCase();
      tokens.push(match[1] ? { type: "close", tag } : { type: "open", tag, attr: match[3] });
    }
    lastIndex = TAG_RE.lastIndex;
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
      if (!KNOWN_TAGS.has(token.tag)) continue;
      const node = { tag: token.tag, attr: token.attr, children: [] as BBNode[] };
      currentChildren().push(node);
      stack.push(node);
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

function renderNodes(nodes: BBNode[], keyPrefix: string): ReactNode[] {
  return nodes.map((node, i) => renderNode(node, `${keyPrefix}-${i}`));
}

function renderNode(node: BBNode, key: string): ReactNode {
  if (typeof node === "string") {
    return <Fragment key={key}>{withLineBreaks(node, key)}</Fragment>;
  }

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
    case "url":
      return (
        <a
          key={key}
          href={node.attr ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-cyan underline"
        >
          {renderNodes(node.children, key)}
        </a>
      );
    case "spoiler":
      return (
        <details key={key} className="inline">
          <summary className="inline cursor-pointer text-neutral-500">Spoiler</summary>
          {renderNodes(node.children, key)}
        </details>
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
