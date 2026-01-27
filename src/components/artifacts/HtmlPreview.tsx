import { useMemo } from 'react';

interface HtmlPreviewProps {
  html: string;
}

export function HtmlPreview({ html }: HtmlPreviewProps) {
  const isSvg = html.trim().startsWith('<svg') || html.trim().startsWith('<?xml');

  const srcDoc = useMemo(() => {
    // Special handling for SVG - center and scale properly
    if (isSvg) {
      return `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              html, body {
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                background: #f5f5f5;
              }
              svg {
                max-width: 90%;
                max-height: 90%;
                width: auto;
                height: auto;
              }
            </style>
          </head>
          <body>${html}</body>
        </html>
      `;
    }

    // Wrap in a complete HTML document if needed
    if (!html.includes('<html') && !html.includes('<!DOCTYPE')) {
      return `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                padding: 16px;
                margin: 0;
              }
            </style>
          </head>
          <body>${html}</body>
        </html>
      `;
    }
    return html;
  }, [html, isSvg]);

  return (
    <iframe className="html-preview" srcDoc={srcDoc} sandbox="allow-scripts" title="HTML Preview" />
  );
}
