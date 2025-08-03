import React from 'react';

interface SyntaxHighlighterProps {
  code: string;
  language: string;
  className?: string;
}

const SyntaxHighlighter: React.FC<SyntaxHighlighterProps> = ({ 
  code, 
  language, 
  className = '' 
}) => {
  // Simple syntax highlighting with basic tokenization
  const highlightCode = (code: string, language: string): string => {
    if (language === 'javascript' || language === 'typescript' || language === 'jsx' || language === 'tsx') {
      return code
        .replace(/\b(const|let|var|function|return|if|else|for|while|class|import|export|from|default)\b/g, '<span class="keyword">$1</span>')
        .replace(/\b(true|false|null|undefined)\b/g, '<span class="boolean">$1</span>')
        .replace(/\b(\d+)\b/g, '<span class="number">$1</span>')
        .replace(/"([^"]*)"/g, '<span class="string">"$1"</span>')
        .replace(/'([^']*)'/g, '<span class="string">\'$1\'</span>')
        .replace(/\/\/(.*)$/gm, '<span class="comment">//$1</span>')
        .replace(/\/\*([\s\S]*?)\*\//g, '<span class="comment">/*$1*/</span>');
    }
    
    if (language === 'python') {
      return code
        .replace(/\b(def|class|import|from|as|if|else|elif|for|while|return|True|False|None)\b/g, '<span class="keyword">$1</span>')
        .replace(/\b(\d+)\b/g, '<span class="number">$1</span>')
        .replace(/("""[\s\S]*?""")/g, '<span class="string">$1</span>')
        .replace(/("([^"]*)")/g, '<span class="string">$1</span>')
        .replace(/('([^']*)')/g, '<span class="string">$1</span>')
        .replace(/#(.*)$/gm, '<span class="comment">#$1</span>');
    }
    
    if (language === 'html') {
      return code
        .replace(/(&lt;[^&]*&gt;)/g, '<span class="tag">$1</span>')
        .replace(/(&lt;\/[^&]*&gt;)/g, '<span class="tag">$1</span>')
        .replace(/(&quot;[^&]*&quot;)/g, '<span class="string">$1</span>');
    }
    
    if (language === 'css') {
      return code
        .replace(/([^{}]+)\s*{/g, '<span class="selector">$1</span> {')
        .replace(/([a-zA-Z-]+):/g, '<span class="property">$1</span>:')
        .replace(/(#[0-9a-fA-F]{3,6})/g, '<span class="color">$1</span>')
        .replace(/(\d+px|\d+em|\d+rem|\d+%)/g, '<span class="number">$1</span>');
    }
    
    if (language === 'json') {
      return code
        .replace(/"([^"]*)":/g, '<span class="property">"$1"</span>:')
        .replace(/"([^"]*)"/g, '<span class="string">"$1"</span>')
        .replace(/\b(true|false|null)\b/g, '<span class="boolean">$1</span>')
        .replace(/\b(\d+)\b/g, '<span class="number">$1</span>');
    }
    
    // Default: just escape HTML
    return code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  return (
    <pre className={`${className} overflow-auto`}>
      <code
        className={`language-${language}`}
        dangerouslySetInnerHTML={{ __html: highlightCode(code, language) }}
      />
    </pre>
  );
};

export default SyntaxHighlighter; 