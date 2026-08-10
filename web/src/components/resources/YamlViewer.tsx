import { useState } from 'react';

interface YamlViewerProps {
  yaml: string;
}

export default function YamlViewer({ yaml }: YamlViewerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(yaml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Basic syntax highlighting logic
  const highlightYaml = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, i) => {
      // Very basic highlighting for demo purposes
      let html = line;
      if (line.includes(':')) {
        const parts = line.split(':');
        html = `<span style="color: var(--color-primary-light)">${parts[0]}</span>:${parts.slice(1).join(':')}`;
      }
      
      return (
        <div key={i} className="flex">
          <span className="text-muted w-8 inline-block select-none text-right pr-2 mr-2 border-r border-light">{i + 1}</span>
          <span dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      );
    });
  };

  return (
    <div className="relative glass-card rounded-lg overflow-hidden h-full flex flex-col">
      <div className="bg-surface p-2 border-b border-light flex justify-between items-center">
        <span className="text-xs font-mono text-muted ml-2">resource.yaml</span>
        <button className="btn btn-secondary text-xs py-1" onClick={handleCopy}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <div className="p-4 overflow-auto flex-1 bg-[#0d0d12] font-mono text-sm leading-relaxed text-[#c9d1d9] whitespace-pre">
        {highlightYaml(yaml)}
      </div>
    </div>
  );
}
