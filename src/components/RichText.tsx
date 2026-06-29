import { Fragment, type ReactNode } from 'react';

// Renders lightweight markup found in question banks and knowledge points:
//   X^+^       -> superscript  (Na^+^, Ca^2+^)
//   X~2~       -> subscript    (O~2~, HCO~3~)
//   ==text==   -> highlight    (fluorescent mark for key terms)
// Everything else is plain text. No HTML is injected — XSS-safe.

const TOKEN = /(\^[^\^\s]+\^|~[^~\s]+~|==[^=]+==[^=]?)/g;

export function RichText({ text }: { text: string }): ReactNode {
  if (!text) return null;

  const parts = text.split(TOKEN);
  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null;
        if (part.length > 2 && part.startsWith('^') && part.endsWith('^')) {
          return <sup key={i}>{part.slice(1, -1)}</sup>;
        }
        if (part.length > 2 && part.startsWith('~') && part.endsWith('~')) {
          return <sub key={i}>{part.slice(1, -1)}</sub>;
        }
        if (part.startsWith('==') && part.endsWith('==') && part.length > 4) {
          return <mark key={i} className="hl">{part.slice(2, -2)}</mark>;
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}
