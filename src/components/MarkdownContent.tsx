import { forwardRef, useMemo } from "react";
import { renderMarkdownWithSentences } from "@/lib/markdown";

interface Props {
  markdown: string;
  className?: string;
  onSentences?: (s: string[]) => void;
}

const MarkdownContent = forwardRef<HTMLDivElement, Props>(({ markdown, className, onSentences }, ref) => {
  const { html, sentences } = useMemo(() => renderMarkdownWithSentences(markdown), [markdown]);

  // notify parent about sentences (post-render)
  useMemo(() => { onSentences?.(sentences); }, [sentences, onSentences]);

  return (
    <div
      ref={ref}
      className={
        "prose prose-sm md:prose-base max-w-none font-body " +
        "prose-headings:font-heading prose-headings:text-foreground " +
        "prose-p:text-foreground/90 prose-li:text-foreground/90 " +
        "prose-strong:text-foreground prose-strong:font-semibold " +
        "prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1 prose-code:py-0.5 prose-code:rounded " +
        "prose-pre:bg-muted prose-pre:text-foreground " +
        "prose-a:text-primary " +
        (className || "")
      }
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});
MarkdownContent.displayName = "MarkdownContent";
export default MarkdownContent;
